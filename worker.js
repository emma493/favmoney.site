// Favmoney Cloudflare Worker: static assets + Golden Goose postback receiver.
//
// Route: GET /api/gg-postback?p1={p1}&p2={p2}&event_id={event_id}&event={event}
//   &profit={profit}&campaign_id={campaign_id}&landing_id={landing_id}
//   &operator={operator}&key=<secret>
// Everything else falls through to static assets (env.ASSETS).
//
// Required secrets (never commit — `wrangler secret put <NAME>`):
//   GG_POSTBACK_KEY            shared secret you append as &key= in GG dashboard
//   FIREBASE_SERVICE_ACCOUNT   full service-account JSON (client_email + private_key)
// Optional vars (wrangler.jsonc [vars]):
//   FIREBASE_PROJECT_ID (default 'favmoney'), GG_SHARE (default 0.7),
//   GG_MAX_PAYOUT (default 20), GG_CREDIT_EVENTS (default 'redeem,iclick')
//
// Crediting policy: auto-credit ONLY allowlisted events with profit > 0.
// subs/unsubs/rebill/hold* are recorded, never auto-credited (carrier-billing
// refunds make auto-credit on subs unsafe). Idempotency key: event_id.

// ---------- pure helpers (unit-testable, no platform APIs) ----------
export function ggParseParams(url) {
  const u = new URL(url);
  const q = u.searchParams;
  return {
    p1: (q.get('p1') || '').slice(0, 512),
    p2: (q.get('p2') || '').slice(0, 512),
    eventId: (q.get('event_id') || '').slice(0, 128),
    event: (q.get('event') || '').slice(0, 64).toLowerCase(),
    profit: Number(q.get('profit') || 0),
    campaignId: (q.get('campaign_id') || '').slice(0, 128),
    landingId: (q.get('landing_id') || '').slice(0, 128),
    operator: (q.get('operator') || '').slice(0, 128),
    source: (q.get('source') || '').slice(0, 64),
    site: (q.get('site') || '').slice(0, 64),
    key: q.get('key') || ''
  };
}

export function ggCreditEvents(env) {
  const raw = String((env && env.GG_CREDIT_EVENTS) || 'redeem,iclick');
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function ggShouldCredit(event, profit, creditList) {
  if (!event || !(profit > 0)) return false;
  return (creditList || []).indexOf(String(event).toLowerCase()) >= 0;
}

export function ggUserAmount(profit, share, cap) {
  const s = Number(share || 0.7);
  const c = Number(cap || 20);
  const amt = Math.round(Number(profit || 0) * s * 100) / 100;
  if (!(amt > 0)) return 0;
  return Math.min(amt, c);
}

function isUid(v) {
  return /^[A-Za-z0-9]{10,128}$/.test(String(v || ''));
}

function timingSafeEqual(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length || x.length === 0) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ---------- Firebase Admin via REST (service account JWT -> OAuth) ----------
let tokenCache = { token: '', exp: 0 };

function pemToDer(pem) {
  const b64 = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(saJson) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.exp - 60 > now) return tokenCache.token;
  const sa = JSON.parse(saJson);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const enc = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = enc(header) + '.' + enc(claim);
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwt)
  });
  if (!res.ok) throw new Error('oauth ' + res.status);
  const data = await res.json();
  tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return tokenCache.token;
}

function fsBase(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

async function fsGet(projectId, token, path) {
  const res = await fetch(fsBase(projectId) + '/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('fsGet ' + res.status);
  return res.json();
}

async function fsCreate(projectId, token, collection, docId, fields) {
  const url = fsBase(projectId) + '/' + collection + (docId ? '?documentId=' + encodeURIComponent(docId) : '');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (res.status === 409) return { conflict: true };
  if (!res.ok) throw new Error('fsCreate ' + res.status);
  return res.json();
}

async function fsPatch(projectId, token, path, fields, mask) {
  let url = fsBase(projectId) + '/' + path;
  if (mask) url += '?updateMask.fieldPaths=' + mask.map(encodeURIComponent).join('&updateMask.fieldPaths=');
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error('fsPatch ' + res.status);
  return res.json();
}

const S = (v) => ({ stringValue: String(v == null ? '' : v) });
const N = (v) => ({ doubleValue: Number(v || 0) });
const T = () => ({ timestampValue: new Date().toISOString() });

// ---------- request handler ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/gg-postback' && url.pathname !== '/api/gg-postback/') {
      try {
        if (env && env.ASSETS) return await env.ASSETS.fetch(request);
      } catch (_) {}
      return fetch(request);
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ ok: false, reason: 'method' }, 405);
    }
    const p = ggParseParams(request.url);
    const secret = (env && env.GG_POSTBACK_KEY) || '';
    if (!secret) {
      console.log('gg-postback: GG_POSTBACK_KEY not configured');
      return json({ ok: false, reason: 'setup' }, 500);
    }
    if (!timingSafeEqual(p.key, secret)) return json({ ok: false, reason: 'auth' }, 401);
    if (!p.eventId) return json({ ok: false, reason: 'event_id' }, 400);
    if (!isUid(p.p1)) return json({ ok: false, reason: 'uid' }, 400);

    const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
    const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
    if (!saJson) {
      console.log('gg-postback: FIREBASE_SERVICE_ACCOUNT not configured');
      return json({ ok: false, reason: 'setup' }, 500);
    }

    const creditList = ggCreditEvents(env);
    const credit = ggShouldCredit(p.event, p.profit, creditList);
    const amount = credit ? ggUserAmount(p.profit, (env && env.GG_SHARE) || 0.7, (env && env.GG_MAX_PAYOUT) || 20) : 0;

    try {
      const token = await googleAccessToken(saJson);
      // Idempotency: event_id claimed once.
      const seen = await fsGet(projectId, token, 'gg_events/' + encodeURIComponent(p.eventId));
      if (seen) return text('OK');
      const baseFields = {
        uid: S(p.p1), provider: S('gg'), tag: S(p.p2), eventId: S(p.eventId),
        event: S(p.event), profit: N(p.profit), amount: N(amount),
        campaignId: S(p.campaignId), landingId: S(p.landingId), operator: S(p.operator),
        source: S(p.source), site: S(p.site), at: T()
      };
      if (!credit) {
        await fsCreate(projectId, token, 'gg_events', p.eventId, { ...baseFields, status: S('recorded-no-credit') });
        return text('OK');
      }
      const created = await fsCreate(projectId, token, 'gg_events', p.eventId, { ...baseFields, status: S('processing') });
      if (created && created.conflict) return text('OK');
      // Wallet read-modify-write (offerwall volume is low; race window acceptable).
      const wallet = await fsGet(projectId, token, 'wallets/' + encodeURIComponent(p.p1));
      const wf = (wallet && wallet.fields) || {};
      const pending = Number((wf.pending && (wf.pending.doubleValue || wf.pending.integerValue)) || 0);
      const lifetime = Number((wf.lifetime && (wf.lifetime.doubleValue || wf.lifetime.integerValue)) || 0);
      const invested = wf.invested || { doubleValue: 1 };
      await fsPatch(projectId, token, 'wallets/' + encodeURIComponent(p.p1), {
        pending: N(Math.round((pending + amount) * 100) / 100),
        lifetime: N(Math.round((lifetime + amount) * 100) / 100),
        invested,
        lastLabel: S('play:offers'),
        updatedAt: T()
      }, ['pending', 'lifetime', 'invested', 'lastLabel', 'updatedAt']);
      await fsCreate(projectId, token, 'proofs', '', {
        uid: S(p.p1), amount: N(amount), label: S('play:offers'), status: S('pending'), at: T(),
        provider: S('gg'), eventId: S(p.eventId), event: S(p.event),
        campaignId: S(p.campaignId), operator: S(p.operator), profit: N(p.profit)
      });
      await fsPatch(projectId, token, 'gg_events/' + encodeURIComponent(p.eventId), { status: S('credited'), amount: N(amount) }, ['status', 'amount']);
      try {
        const uref = 'users/' + encodeURIComponent(p.p1);
        const u = await fsGet(projectId, token, uref);
        const uf = (u && u.fields) || {};
        const earned = Number((uf.taskEarned && (uf.taskEarned.doubleValue || uf.taskEarned.integerValue)) || 0);
        await fsPatch(projectId, token, uref, {
          taskEarned: N(Math.round((earned + amount) * 100) / 100),
          updatedAt: T()
        }, ['taskEarned', 'updatedAt']);
      } catch (_) {}
      return text('OK');
    } catch (e) {
      console.log('gg-postback error: ' + (e && e.message ? e.message : e));
      return json({ ok: false, reason: 'write' }, 502);
    }
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
function text(s) {
  return new Response(s, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
