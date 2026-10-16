// Favmoney Cloudflare Worker: static assets + offerwall postback receivers
// (Golden Goose, OGAds, CPA Grip).
//
// Routes:
//   GET /api/gg-postback?p1={p1}&p2={p2}&event_id={event_id}&event={event}
//     &profit={profit}&campaign_id={campaign_id}&landing_id={landing_id}
//     &operator={operator}&key=<secret>
//   GET|POST /api/ogads-postback (uid via aff_sub4, key via ?key=)
//   GET|POST /api/cpagrip-postback?payout={payout}&offer={offer_id}&subid={tracking_id}
//     (CPA Grip POSTs password/payout/offer_id/tracking_id; GET tokens also read)
// Everything else falls through to static assets (env.ASSETS).
//
// Required secrets (never commit — dashboard or `wrangler secret put <NAME>`):
//   GG_POSTBACK_KEY            shared secret you append as &key= in GG dashboard
//   OGADS_POSTBACK_KEY         shared secret for OGAds global postback
//   CPAGRIP_POSTBACK_KEY       password set on CPA Grip Global Postback page
//   FIREBASE_SERVICE_ACCOUNT   full service-account JSON (client_email + private_key)
// Optional vars (wrangler.jsonc [vars]):
//   FIREBASE_PROJECT_ID (default 'favmoney'), GG_SHARE (default 0.7),
//   GG_MAX_PAYOUT (default 20), GG_CREDIT_EVENTS (default 'redeem,iclick'),
//   OGADS_SHARE (default 0.7), OGADS_MAX_PAYOUT (default 20),
//   CPAGRIP_SHARE (default 0.7), CPAGRIP_MAX_PAYOUT (default 20)
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
  let sa;
  try { sa = JSON.parse(saJson); }
  catch (_) { throw new Error('sa-json invalid (re-upload secret from file, do not hand-paste)'); }
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
  const data = await resJson(res, 'oauth');
  tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return tokenCache.token;
}

function fsBase(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

async function resJson(res, what) {
  const t = await res.text();
  try { return JSON.parse(t); }
  catch (_) { throw new Error(what + ' non-json ' + res.status + ': ' + t.slice(0, 80)); }
}

async function fsGet(projectId, token, path) {
  const res = await fetch(fsBase(projectId) + '/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('fsGet ' + res.status);
  return resJson(res, 'fsGet');
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
  return resJson(res, 'fsCreate');
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
  return resJson(res, 'fsPatch');
}

const S = (v) => ({ stringValue: String(v == null ? '' : v) });
const N = (v) => ({ doubleValue: Number(v || 0) });
const B = (v) => ({ booleanValue: !!v });
const T = () => ({ timestampValue: new Date().toISOString() });

// List every document in a collection (paginated). Returns raw REST docs.
async function fsListAll(projectId, token, collection, pageSize) {
  const out = [];
  let pageToken = '';
  for (let p = 0; p < 50; p++) {
    let url = fsBase(projectId) + '/' + collection + '?pageSize=' + (pageSize || 300);
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('fsList ' + res.status);
    const data = await resJson(res, 'fsList');
    if (Array.isArray(data.documents)) out.push(...data.documents);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

function restStr(doc, field) {
  try {
    const f = doc && doc.fields && doc.fields[field];
    return String((f && (f.stringValue || f.integerValue)) || '');
  } catch (_) { return ''; }
}

// ---------- Top-inviters board (hourly cron -> leaderboard/top_inviters) ----------
// Counts referrals per ownerUid, resolves each owner's handle from their user
// doc (email prefix), writes the top 10 to one public doc. Pure + testable
// fold over REST-shaped docs lives in topInvitersFromDocs().
export function topInvitersFromDocs(refDocs, userByUid, topN) {
  const counts = {};
  for (const d of (Array.isArray(refDocs) ? refDocs : [])) {
    const owner = restStr(d, 'ownerUid');
    if (!owner) continue;
    counts[owner] = (counts[owner] || 0) + 1;
  }
  return Object.keys(counts)
    .map((uid) => {
      const u = (userByUid && userByUid[uid]) || {};
      const email = String(u.email || '');
      const handle = (email.split('@')[0] || 'friend').slice(0, 24);
      return { uid, handle, invited: counts[uid] };
    })
    .sort((a, b) => b.invited - a.invited)
    .slice(0, Math.max(1, Math.min(10, Number(topN) || 10)));
}

async function rebuildTopInviters(env) {
  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && env.FIREBASE_SERVICE_ACCOUNT) || '';
  if (!saJson) { console.log('top-inviters: FIREBASE_SERVICE_ACCOUNT not configured'); return; }
  const token = await googleAccessToken(saJson);
  const refs = await fsListAll(projectId, token, 'referrals', 500);
  const counts = {};
  for (const d of refs) {
    const owner = restStr(d, 'ownerUid');
    if (owner) counts[owner] = (counts[owner] || 0) + 1;
  }
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);
  const entries = [];
  for (const uid of top) {
    let handle = 'friend';
    try {
      const u = await fsGet(projectId, token, 'users/' + encodeURIComponent(uid));
      const email = String((u && u.fields && u.fields.email && u.fields.email.stringValue) || '');
      if (email.split('@')[0]) handle = email.split('@')[0].slice(0, 24);
    } catch (_) {}
    entries.push({ uid, handle, invited: counts[uid] });
  }
  await fsPatch(projectId, token, 'leaderboard/top_inviters', {
    entries: {
      arrayValue: {
        values: entries.map((e) => ({
          mapValue: { fields: { uid: S(e.uid), handle: S(e.handle), invited: N(e.invited) } }
        }))
      }
    },
    updatedAt: N(Date.now())
  }, ['entries', 'updatedAt']);
  console.log('top-inviters: wrote ' + entries.length + ' entries');
}

// ---------- OGAds offer feed (API v2, key in OGADS_API_KEY secret) ----------
async function handleOgadsOffers(request, env) {
  const key = (env && env.OGADS_API_KEY) || '';
  if (!key) {
    console.log('ogads-offers: OGADS_API_KEY not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const fwd = request.headers.get('X-Forwarded-For') || '';
  const ip = request.headers.get('CF-Connecting-IP') || fwd.split(',')[0].trim();
  const ua = request.headers.get('User-Agent') || '';
  const lang = request.headers.get('Accept-Language') || '';
  if (!ip || !ua) return json({ ok: false, reason: 'client' }, 400);
  const share = Number((env && env.OGADS_SHARE) || (env && env.GG_SHARE) || 0.7);
  const cap = Number((env && env.OGADS_MAX_PAYOUT) || (env && env.GG_MAX_PAYOUT) || 20);
  const qs = new URLSearchParams({
    ip, user_agent: ua,
    site: 'favmoney.site/offerwalls.html',
    max: '25'
  });
  if (lang) qs.set('lang', lang.slice(0, 64));
  const res = await fetch('https://apptrck.net/api/v2?' + qs.toString(), {
    headers: { Authorization: 'Bearer ' + key }
  });
  const data = await resJson(res, 'ogads');
  if (!data || data.success !== true || !Array.isArray(data.offers)) {
    console.log('ogads-offers: provider error ' + (data && data.error ? data.error : res.status));
    return json({ ok: false, reason: 'provider' }, 502);
  }
  const offers = data.offers.slice(0, 25).map(function (o) {
    const payout = Math.round(Number((o && o.payout) || 0) * 100) / 100;
    return {
      offerid: Number((o && o.offerid) || 0),
      name: String((o && (o.name_short || o.name)) || 'Offer').slice(0, 80),
      adcopy: String((o && o.adcopy) || '').slice(0, 160),
      picture: String((o && o.picture) || '').slice(0, 512),
      payout: payout,
      userPay: Math.min(cap, Math.round(payout * share * 100) / 100),
      device: String((o && o.device) || '').slice(0, 64),
      country: String((o && o.country) || '').slice(0, 128),
      link: String((o && o.link) || '').slice(0, 512)
    };
  }).filter(function (o) { return o.offerid && o.link && /^https?:\/\//i.test(o.link) && o.userPay > 0; });
  return json({ ok: true, count: offers.length, offers });
}

// ---------- OGAds postback (global postback fires on approved conversion) ----------
// Dedupe key: OGAds exposes no transaction id, so composite uid+offer+payout
// +datetime identifies a conversion. {ran} is excluded (random per fire).
function ogPostbackParams(url) {
  const u = new URL(url);
  const q = u.searchParams;
  // uid arrives via aff_sub4 (per OGAds PHP example); accept aff_sub/uid
  // as fallbacks for hand-built test URLs.
  const sub4 = (q.get('aff_sub4') || '').slice(0, 128);
  const sub = (q.get('aff_sub') || '').slice(0, 128);
  return {
    uid: sub4 || sub || (q.get('uid') || '').slice(0, 128),
    offerId: (q.get('offer_id') || '').slice(0, 64),
    offerName: (q.get('offer_name') || '').slice(0, 128),
    payout: Number(q.get('payout') || 0),
    ip: (q.get('ip') || '').slice(0, 64),
    at: (q.get('at') || '').slice(0, 64),
    source: (q.get('source') || '').slice(0, 64),
    key: q.get('key') || ''
  };
}

async function handleOgadsPostback(request, env) {
  const p = ogPostbackParams(request.url);
  const secret = (env && env.OGADS_POSTBACK_KEY) || '';
  if (!secret) {
    console.log('ogads-postback: OGADS_POSTBACK_KEY not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  if (!timingSafeEqual(p.key, secret)) return json({ ok: false, reason: 'auth' }, 401);
  if (!isUid(p.uid)) return json({ ok: false, reason: 'uid' }, 400);
  if (!(p.payout > 0)) return json({ ok: false, reason: 'payout' }, 400);
  const share = Number((env && env.OGADS_SHARE) || 0.7);
  const cap = Number((env && env.OGADS_MAX_PAYOUT) || 20);
  const amount = Math.min(cap, Math.round(p.payout * share * 100) / 100);
  if (!(amount > 0)) return json({ ok: false, reason: 'payout' }, 400);
  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
  if (!saJson) {
    console.log('ogads-postback: FIREBASE_SERVICE_ACCOUNT not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const stamp = (p.at || '').replace(/[^0-9A-Za-z:\- ]/g, '').slice(0, 32) || 'nodate';
  const eventId = 'og-' + p.uid + '-' + (p.offerId || '0') + '-' + stamp + '-' + String(Math.round(p.payout * 100));
  try {
    const token = await googleAccessToken(saJson);
    const seen = await fsGet(projectId, token, 'og_events/' + encodeURIComponent(eventId));
    if (seen) return text('OK');
    const baseFields = {
      uid: S(p.uid), provider: S('ogads'), offerId: S(p.offerId), offerName: S(p.offerName),
      eventId: S(eventId), profit: N(p.payout), amount: N(amount),
      ip: S(p.ip), source: S(p.source), at: T()
    };
    const created = await fsCreate(projectId, token, 'og_events', eventId, { ...baseFields, status: S('processing') });
    if (created && created.conflict) return text('OK');
    const wallet = await fsGet(projectId, token, 'wallets/' + encodeURIComponent(p.uid));
    const wf = (wallet && wallet.fields) || {};
    const pending = Number((wf.pending && (wf.pending.doubleValue || wf.pending.integerValue)) || 0);
    const lifetime = Number((wf.lifetime && (wf.lifetime.doubleValue || wf.lifetime.integerValue)) || 0);
    const invested = wf.invested || { doubleValue: 1 };
    const walletFields = {
      pending: N(Math.round((pending + amount) * 100) / 100),
      lifetime: N(Math.round((lifetime + amount) * 100) / 100),
      invested,
      lastLabel: S('play:offers'),
      updatedAt: T()
    };
    if (wallet) {
      await fsPatch(projectId, token, 'wallets/' + encodeURIComponent(p.uid), walletFields, ['pending', 'lifetime', 'invested', 'lastLabel', 'updatedAt']);
    } else {
      await fsCreate(projectId, token, 'wallets', p.uid, {
        ...walletFields, investedAt: N(Date.now()), boostUntil: N(0)
      });
    }
    await fsCreate(projectId, token, 'proofs', '', {
      uid: S(p.uid), amount: N(amount), label: S('play:offers'), status: S('pending'), at: T(),
      provider: S('ogads'), eventId: S(eventId), offerId: S(p.offerId), profit: N(p.payout)
    });
    try {
      await fsCreate(projectId, token, 'notifications', 'notif-' + eventId, {
        uid: S(p.uid), kind: S('offer-credit'), title: S('Offer approved'),
        body: S('+$' + amount.toFixed(2) + ' from OGAds'), link: S('profile.html'),
        read: B(false), at: T()
      });
    } catch (_) {}
    await fsPatch(projectId, token, 'og_events/' + encodeURIComponent(eventId), { status: S('credited'), amount: N(amount) }, ['status', 'amount']);
    try {
      const uref = 'users/' + encodeURIComponent(p.uid);
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
    console.log('ogads-postback error: ' + (e && e.message ? e.message : e));
    return json({ ok: false, reason: 'write' }, 502);
  }
}

// ---------- CPA Grip postback (SmartLink + offer wall, Global Postback) ----------
// CPA Grip POSTs form fields: password, payout, offer_id, tracking_id.
// The saved postback URL also carries GET tokens (?payout={payout}
// &offer={offer_id}&subid={tracking_id}) — both are read, POST wins.
// NOTE: CPA Grip sends no transaction id, so the dedupe key is the
// uid+offer+payout composite (same tradeoff as OGAds): two identical
// conversions dedupe, differing ones credit separately.
export function cpagripShare(env) {
  return Number((env && env.CPAGRIP_SHARE) || 0.7);
}

export function cpagripMaxPayout(env) {
  return Number((env && env.CPAGRIP_MAX_PAYOUT) || 20);
}

export function cpagripUserAmount(payout, share, cap) {
  const s = Number(share == null ? 0.7 : share);
  const c = Number(cap == null ? 20 : cap);
  const amt = Math.round(Number(payout || 0) * s * 100) / 100;
  if (!(amt > 0)) return 0;
  return Math.min(amt, c);
}

export function cpagripEventId(uid, offerId, payout) {
  return 'cp-' + String(uid || '') + '-' + String(offerId || '0')
    + '-' + String(Math.round(Number(payout || 0) * 100));
}

async function readPostBody(request) {
  try {
    const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
    if (ct.indexOf('application/json') >= 0) return await request.json();
    if (ct.indexOf('form') >= 0) {
      const out = {};
      for (const [k, v] of (await request.formData()).entries()) out[k] = v;
      return out;
    }
    const t = await request.text();
    if (!t) return {};
    try { return JSON.parse(t); } catch (_) {}
    const out = {};
    for (const [k, v] of new URLSearchParams(t).entries()) out[k] = v;
    return out;
  } catch (_) { return {}; }
}

async function handleCpagripPostback(request, env) {
  const q = new URL(request.url).searchParams;
  const body = (request.method === 'POST') ? await readPostBody(request) : {};
  const str = (v) => String(v == null ? '' : v);
  const key = str(body.password || body.key || q.get('key'));
  const secret = (env && env.CPAGRIP_POSTBACK_KEY) || '';
  if (!secret) {
    console.log('cpagrip-postback: CPAGRIP_POSTBACK_KEY not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  if (!timingSafeEqual(key, secret)) return json({ ok: false, reason: 'auth' }, 401);
  const uid = str(body.tracking_id || body.subid || body.uid || q.get('subid') || q.get('tracking_id')).slice(0, 128);
  const payout = Number(body.payout || q.get('payout') || 0);
  const offerId = str(body.offer_id || body.offer || q.get('offer') || q.get('offer_id')).slice(0, 64);
  if (!isUid(uid)) return json({ ok: false, reason: 'uid' }, 400);
  if (!(payout > 0)) return json({ ok: false, reason: 'payout' }, 400);
  const amount = cpagripUserAmount(payout, cpagripShare(env), cpagripMaxPayout(env));
  if (!(amount > 0)) return json({ ok: false, reason: 'payout' }, 400);
  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
  if (!saJson) {
    console.log('cpagrip-postback: FIREBASE_SERVICE_ACCOUNT not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const eventId = cpagripEventId(uid, offerId, payout);
  try {
    const token = await googleAccessToken(saJson);
    const seen = await fsGet(projectId, token, 'cp_events/' + encodeURIComponent(eventId));
    if (seen) return text('OK');
    const baseFields = {
      uid: S(uid), provider: S('cpagrip'), offerId: S(offerId),
      eventId: S(eventId), profit: N(payout), amount: N(amount), at: T()
    };
    const created = await fsCreate(projectId, token, 'cp_events', eventId, { ...baseFields, status: S('processing') });
    if (created && created.conflict) return text('OK');
    const wallet = await fsGet(projectId, token, 'wallets/' + encodeURIComponent(uid));
    const wf = (wallet && wallet.fields) || {};
    const pending = Number((wf.pending && (wf.pending.doubleValue || wf.pending.integerValue)) || 0);
    const lifetime = Number((wf.lifetime && (wf.lifetime.doubleValue || wf.lifetime.integerValue)) || 0);
    const invested = wf.invested || { doubleValue: 1 };
    const walletFields = {
      pending: N(Math.round((pending + amount) * 100) / 100),
      lifetime: N(Math.round((lifetime + amount) * 100) / 100),
      invested,
      lastLabel: S('play:offers'),
      updatedAt: T()
    };
    if (wallet) {
      await fsPatch(projectId, token, 'wallets/' + encodeURIComponent(uid), walletFields, ['pending', 'lifetime', 'invested', 'lastLabel', 'updatedAt']);
    } else {
      await fsCreate(projectId, token, 'wallets', uid, {
        ...walletFields, investedAt: N(Date.now()), boostUntil: N(0)
      });
    }
    await fsCreate(projectId, token, 'proofs', '', {
      uid: S(uid), amount: N(amount), label: S('play:offers'), status: S('pending'), at: T(),
      provider: S('cpagrip'), eventId: S(eventId), offerId: S(offerId), profit: N(payout)
    });
    try {
      await fsCreate(projectId, token, 'notifications', 'notif-' + eventId, {
        uid: S(uid), kind: S('offer-credit'), title: S('Offer approved'),
        body: S('+$' + amount.toFixed(2) + ' from CPA Grip'), link: S('profile.html'),
        read: B(false), at: T()
      });
    } catch (_) {}
    await fsPatch(projectId, token, 'cp_events/' + encodeURIComponent(eventId), { status: S('credited'), amount: N(amount) }, ['status', 'amount']);
    try {
      const uref = 'users/' + encodeURIComponent(uid);
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
    console.log('cpagrip-postback error: ' + (e && e.message ? e.message : e));
    return json({ ok: false, reason: 'write' }, 502);
  }
}

// ---------- request handler ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ogads-offers' || url.pathname === '/api/ogads-offers/') {
      if (request.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
      try { return await handleOgadsOffers(request, env); }
      catch (e) {
        console.log('ogads-offers error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'provider' }, 502);
      }
    }
    if (url.pathname === '/api/ogads-postback' || url.pathname === '/api/ogads-postback/') {
      if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);
      try { return await handleOgadsPostback(request, env); }
      catch (e) {
        console.log('ogads-postback error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'write' }, 502);
      }
    }
    if (url.pathname === '/api/cpagrip-postback' || url.pathname === '/api/cpagrip-postback/') {
      if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);
      try { return await handleCpagripPostback(request, env); }
      catch (e) {
        console.log('cpagrip-postback error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'write' }, 502);
      }
    }
    if (url.pathname !== '/api/gg-postback' && url.pathname !== '/api/gg-postback/') {
      try {
        if (env && env.ASSETS) return await env.ASSETS.fetch(request);
      } catch (_) {}
      return new Response('Not found', { status: 404 });
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
    // Provider URL validators (GG pings the saved postback with empty
    // placeholders). Real conversions always carry event_id + event, so an
    // empty probe is answered OK without writing anything.
    if (!p.eventId && !p.event) return text('OK');
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
      // Creates the wallet if the uid never signed in (mirrors client ensureUserDoc).
      const wallet = await fsGet(projectId, token, 'wallets/' + encodeURIComponent(p.p1));
      const wf = (wallet && wallet.fields) || {};
      const pending = Number((wf.pending && (wf.pending.doubleValue || wf.pending.integerValue)) || 0);
      const lifetime = Number((wf.lifetime && (wf.lifetime.doubleValue || wf.lifetime.integerValue)) || 0);
      const invested = wf.invested || { doubleValue: 1 };
      const walletFields = {
        pending: N(Math.round((pending + amount) * 100) / 100),
        lifetime: N(Math.round((lifetime + amount) * 100) / 100),
        invested,
        lastLabel: S('play:offers'),
        updatedAt: T()
      };
      if (wallet) {
        await fsPatch(projectId, token, 'wallets/' + encodeURIComponent(p.p1), walletFields, ['pending', 'lifetime', 'invested', 'lastLabel', 'updatedAt']);
      } else {
        await fsCreate(projectId, token, 'wallets', p.p1, {
          ...walletFields, investedAt: N(Date.now()), boostUntil: N(0)
        });
      }
      await fsCreate(projectId, token, 'proofs', '', {
        uid: S(p.p1), amount: N(amount), label: S('play:offers'), status: S('pending'), at: T(),
        provider: S('gg'), eventId: S(p.eventId), event: S(p.event),
        campaignId: S(p.campaignId), operator: S(p.operator), profit: N(p.profit)
      });
      try {
        await fsCreate(projectId, token, 'notifications', 'notif-' + p.eventId, {
          uid: S(p.p1), kind: S('offer-credit'), title: S('Offer approved'),
          body: S('+$' + amount.toFixed(2) + ' from Golden Goose'), link: S('profile.html'),
          read: B(false), at: T()
        });
      } catch (_) {}
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
  },
  // Hourly cron (see wrangler.jsonc [triggers]): rebuild the public
  // top-inviters board. Never throws out — a failed run retries next hour.
  async scheduled(event, env, ctx) {
    try { await rebuildTopInviters(env); }
    catch (e) { console.log('top-inviters cron error: ' + (e && e.message ? e.message : e)); }
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
function text(s) {
  return new Response(s, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
