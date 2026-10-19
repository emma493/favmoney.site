// Favmoney Cloudflare Worker: static assets + offerwall postback receivers
// (Golden Goose, OGAds, CPA Grip, MyLead).
//
// Routes:
//   GET /api/gg-postback?p1={p1}&p2={p2}&event_id={event_id}&event={event}
//     &profit={profit}&campaign_id={campaign_id}&landing_id={landing_id}
//     &operator={operator}&key=<secret>
//   GET|POST /api/ogads-postback (uid via aff_sub4, key via ?key=)
//   GET|POST /api/cpagrip-postback?payout={payout}&offer={offer_id}&subid={tracking_id}
//     (CPA Grip POSTs password/payout/offer_id/tracking_id; GET tokens also read)
//   GET /api/mylead-postback?transaction_id={id}&player_id={uid}
//     &payout_decimal={eur}&currency={cur}&status={status}
//     (MyLead signs via X-MyLead-Security-Hash header + MYLEAD_POSTBACK_KEY)
//   POST /api/notify-cashout {idToken, cashoutId, type, displayAmount}
//     (member/admin cashout mail via Resend; type received|paid)
// Everything else falls through to static assets (env.ASSETS).
//
// Required secrets (never commit — dashboard or `wrangler secret put <NAME>`):
//   GG_POSTBACK_KEY            shared secret you append as &key= in GG dashboard
//   OGADS_POSTBACK_KEY         shared secret for OGAds global postback
//   CPAGRIP_POSTBACK_KEY       password set on CPA Grip Global Postback page
//   MYLEAD_POSTBACK_KEY        MyLead postback verification security key
//   FIREBASE_SERVICE_ACCOUNT   full service-account JSON (client_email + private_key)
//   RESEND_API_KEY             Resend sending key for cashout mail
// Optional vars (wrangler.jsonc [vars]):
//   MAIL_FROM (default 'Favmoney <payments@favmoney.site>')
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

// ---------- Offerwall.me postback (signed user IDs + MD5 signature) ----------
// MD5 (pure JS; crypto.subtle has no MD5)
function md5(str) {
  const s = String(str || '');
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const x = [];
  for (let i = 0; i < s.length; i++) x[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
  x[s.length >> 2] |= 0x80 << ((s.length % 4) * 8);
  x[(((s.length + 8) >>> 6) << 4) + 14] = s.length * 8;
  const rot = (n, c) => (n << c) | (n >>> (32 - c));
  const fn = (k) => {
    let xx = x[k];
    return xx < 0 ? xx + 4294967296 : xx;
  };
  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    const ff = (q, r, s, t, m, n, k) => {
      const f = (r & s) | (~r & t);
      const g = fn(m) + q + f + k;
      return rot(g, n) + r;
    };
    const gg = (q, r, s, t, m, n, k) => {
      const f = (r & t) | (s & ~t);
      const g = fn(m) + q + f + k;
      return rot(g, n) + r;
    };
    const hh = (q, r, s, t, m, n, k) => {
      const f = r ^ s ^ t;
      const g = fn(m) + q + f + k;
      return rot(g, n) + r;
    };
    const ii = (q, r, s, t, m, n, k) => {
      const f = s ^ (r | ~t);
      const g = fn(m) + q + f + k;
      return rot(g, n) + r;
    };
    a = ff(a, b, c, d, i + 0, 7, -680876936);
    d = ff(d, a, b, c, i + 1, 12, -389564586);
    c = ff(c, d, a, b, i + 2, 17, 606105819);
    b = ff(b, c, d, a, i + 3, 22, -1044525330);
    a = ff(a, b, c, d, i + 4, 7, -176418897);
    d = ff(d, a, b, c, i + 5, 12, 1200080426);
    c = ff(c, d, a, b, i + 6, 17, -1473231341);
    b = ff(b, c, d, a, i + 7, 22, -45705983);
    a = ff(a, b, c, d, i + 8, 7, 1770035416);
    d = ff(d, a, b, c, i + 9, 12, -1958414417);
    c = ff(c, d, a, b, i + 10, 17, -42063);
    b = ff(b, c, d, a, i + 11, 22, -1990404162);
    a = ff(a, b, c, d, i + 12, 7, 1804603682);
    d = ff(d, a, b, c, i + 13, 12, -40341101);
    c = ff(c, d, a, b, i + 14, 17, -1502002290);
    b = ff(b, c, d, a, i + 15, 22, 1236535329);
    a = gg(a, b, c, d, i + 1, 5, -165796510);
    d = gg(d, a, b, c, i + 6, 9, -1069501632);
    c = gg(c, d, a, b, i + 11, 14, 643717713);
    b = gg(b, c, d, a, i + 0, 20, -373897302);
    a = gg(a, b, c, d, i + 5, 5, -701558691);
    d = gg(d, a, b, c, i + 10, 9, 38016083);
    c = gg(c, d, a, b, i + 15, 14, -660478335);
    b = gg(b, c, d, a, i + 4, 20, -405537848);
    a = gg(a, b, c, d, i + 9, 5, 568446438);
    d = gg(d, a, b, c, i + 14, 9, -1019803690);
    c = gg(c, d, a, b, i + 3, 14, -187363961);
    b = gg(b, c, d, a, i + 8, 20, 116353150);
    a = gg(a, b, c, d, i + 13, 5, -1444681467);
    d = gg(d, a, b, c, i + 2, 9, -51403784);
    c = gg(c, d, a, b, i + 7, 14, 1735328473);
    b = gg(b, c, d, a, i + 12, 20, -1926607734);
    a = hh(a, b, c, d, i + 5, 4, -378558);
    d = hh(d, a, b, c, i + 8, 11, -2022574463);
    c = hh(c, d, a, b, i + 11, 16, 1839030562);
    b = hh(b, c, d, a, i + 14, 23, -35309556);
    a = hh(a, b, c, d, i + 1, 4, -1530992060);
    d = hh(d, a, b, c, i + 4, 11, 1272893353);
    c = hh(c, d, a, b, i + 7, 16, -155497632);
    b = hh(b, c, d, a, i + 10, 23, -1094730640);
    a = hh(a, b, c, d, i + 13, 4, 681279174);
    d = hh(d, a, b, c, i + 0, 11, -358537222);
    c = hh(c, d, a, b, i + 3, 16, -722521979);
    b = hh(b, c, d, a, i + 6, 23, 76029189);
    a = hh(a, b, c, d, i + 9, 4, -640364487);
    d = hh(d, a, b, c, i + 12, 11, -421815835);
    c = hh(c, d, a, b, i + 15, 16, 530742520);
    b = hh(b, c, d, a, i + 2, 23, -995338651);
    a = ii(a, b, c, d, i + 0, 6, -198630844);
    d = ii(d, a, b, c, i + 7, 10, 1126891415);
    c = ii(c, d, a, b, i + 14, 15, -1416354905);
    b = ii(b, c, d, a, i + 5, 21, -57434055);
    a = ii(a, b, c, d, i + 12, 6, 1700485571);
    d = ii(d, a, b, c, i + 3, 10, -1894986606);
    c = ii(c, d, a, b, i + 10, 15, -1051523);
    b = ii(b, c, d, a, i + 1, 21, -2054922799);
    a = ii(a, b, c, d, i + 8, 6, 1873313359);
    d = ii(d, a, b, c, i + 15, 10, -30611744);
    c = ii(c, d, a, b, i + 6, 15, -1560198380);
    b = ii(b, c, d, a, i + 13, 21, 1309151649);
    a = ii(a, b, c, d, i + 4, 6, -145523070);
    d = ii(d, a, b, c, i + 11, 10, -1120210379);
    c = ii(c, d, a, b, i + 2, 15, 718787259);
    b = ii(b, c, d, a, i + 9, 21, -343485551);
    a = (a + olda) | 0;
    b = (b + oldb) | 0;
    c = (c + oldc) | 0;
    d = (d + oldd) | 0;
  }
  const hex = (n) => {
    let h = '';
    for (let i = 0; i < 4; i++) h += '0123456789abcdef'.charAt((n >> (i * 8 + 4)) & 0xF) + '0123456789abcdef'.charAt((n >> (i * 8)) & 0xF);
    return h;
  };
  return hex(a) + hex(b) + hex(c) + hex(d);
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

// ---------- MyLead offerwall postback (player_id wall, GET) ----------
// Wall opens in a new tab with ?player_id=<uid>; approved conversions GET
// back here with transaction_id / player_id / payout_decimal / currency /
// status (+ optional destination_program_name for the ledger label).
// Verification: X-MyLead-Security-Hash header compared against a hash of the
// received postback URL + MYLEAD_POSTBACK_KEY.
// NOTE (unconfirmed): default scheme below is SHA-1 hex over (url + key).
// Every hit logs url + received + expected so one test postback pins the
// exact recipe; flip MYLEAD_HASH to the winner if it differs.
export function myleadShare(env) {
  return Number((env && env.MYLEAD_SHARE) || 0.7);
}

export function myleadMaxPayout(env) {
  return Number((env && env.MYLEAD_MAX_PAYOUT) || 20);
}

export function myleadEurUsd(env) {
  const r = Number((env && env.MYLEAD_EURUSD) || 1.08);
  return r > 0 ? r : 1.08;
}

export function myleadUserAmount(payoutEur, share, cap, rate) {
  const s = Number(share == null ? 0.7 : share);
  const c = Number(cap == null ? 20 : cap);
  const r = Number(rate == null || !(rate > 0) ? 1.08 : rate);
  const usd = Number(payoutEur || 0) * r;
  const amt = Math.round(usd * s * 100) / 100;
  if (!(amt > 0)) return 0;
  return Math.min(amt, c);
}

export function myleadEventId(uid, txId) {
  return 'ml-' + String(uid || '') + '-' + String(txId || '0').slice(0, 64);
}

function mlPostbackParams(url) {
  const u = new URL(url);
  const q = u.searchParams;
  return {
    txId: (q.get('transaction_id') || '').slice(0, 64),
    uid: (q.get('player_id') || '').slice(0, 128),
    payout: Number(q.get('payout_decimal') || 0),
    currency: (q.get('currency') || 'EUR').slice(0, 8).toUpperCase(),
    status: (q.get('status') || '').slice(0, 32).toLowerCase(),
    offerName: (q.get('destination_program_name') || '').slice(0, 128)
  };
}

function hexOf(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function myleadVerifyHash(url, received, key) {
  const u = new URL(url);
  const full = u.origin + u.pathname + u.search;
  const data = full + String(key || '');
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data));
  return { expected: hexOf(digest), full };
}

async function handleMyleadPostback(request, env) {
  const p = mlPostbackParams(request.url);
  const received = request.headers.get('X-MyLead-Security-Hash') || '';
  const secret = (env && env.MYLEAD_POSTBACK_KEY) || '';
  if (!secret) {
    console.log('mylead-postback: MYLEAD_POSTBACK_KEY not configured; url=' + request.url + ' hash=' + received);
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const v = await myleadVerifyHash(request.url, received, secret);
  if (!timingSafeEqual(String(received).toLowerCase(), v.expected)) {
    console.log('mylead-postback: hash mismatch; url=' + v.full + ' received=' + received + ' expected=' + v.expected);
    return json({ ok: false, reason: 'auth' }, 401);
  }
  if (!p.txId) return json({ ok: false, reason: 'transaction_id' }, 400);
  if (!isUid(p.uid)) return json({ ok: false, reason: 'uid' }, 400);
  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
  if (!saJson) {
    console.log('mylead-postback: FIREBASE_SERVICE_ACCOUNT not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const eventId = myleadEventId(p.uid, p.txId);
  try {
    const token = await googleAccessToken(saJson);
    const seen = await fsGet(projectId, token, 'ml_events/' + encodeURIComponent(eventId));
    if (seen) return text('OK');
    if (p.status !== 'approved') {
      await fsCreate(projectId, token, 'ml_events', eventId, {
        uid: S(p.uid), provider: S('mylead'), eventId: S(eventId),
        txId: S(p.txId), status: S(p.status || 'unknown'),
        offerName: S(p.offerName), at: T()
      });
      return text('OK');
    }
    if (!(p.payout > 0)) return json({ ok: false, reason: 'payout' }, 400);
    const rate = p.currency === 'USD' ? 1 : myleadEurUsd(env);
    const amount = myleadUserAmount(p.payout, myleadShare(env), myleadMaxPayout(env), rate);
    if (!(amount > 0)) return json({ ok: false, reason: 'payout' }, 400);
    const baseFields = {
      uid: S(p.uid), provider: S('mylead'), eventId: S(eventId), txId: S(p.txId),
      offerName: S(p.offerName), profit: N(p.payout), currency: S(p.currency),
      amount: N(amount), at: T()
    };
    const created = await fsCreate(projectId, token, 'ml_events', eventId, { ...baseFields, status: S('processing') });
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
      provider: S('mylead'), eventId: S(eventId), offerName: S(p.offerName), profit: N(p.payout)
    });
    try {
      await fsCreate(projectId, token, 'notifications', 'notif-' + eventId, {
        uid: S(p.uid), kind: S('offer-credit'), title: S('Offer approved'),
        body: S('+$' + amount.toFixed(2) + ' from MyLead'), link: S('profile.html'),
        read: B(false), at: T()
      });
    } catch (_) {}
    await fsPatch(projectId, token, 'ml_events/' + encodeURIComponent(eventId), { status: S('credited'), amount: N(amount) }, ['status', 'amount']);
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
    console.log('mylead-postback error: ' + (e && e.message ? e.message : e));
    return json({ ok: false, reason: 'write' }, 502);
  }
}

// ---------- Offerwall.me postback (signed user IDs + MD5 signature) ----------
// POST /api/offerwall-postback
// Body params (form or JSON): subId, transId, offer_name, offer_type, reward,
// status ("1" credit | "2" reversal), signature, userIp, country, payout.
// Verification: md5(subId + transId + reward + OFFERWALL_SECRET_KEY) === signature.
// Idempotency key: transId. Wallet is created if the uid has none.
// Dedupe collection: offerwall_events/{transId}. Wallet: wallets/{subId}.
async function owPostbackBody(request) {
  const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.indexOf('application/json') >= 0) return await request.json();
  if (ct.indexOf('form') >= 0) {
    const out = {};
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) out[k] = v;
    return out;
  }
  const txt = await request.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch (_) {}
  const out = {};
  for (const [k, v] of new URLSearchParams(txt).entries()) out[k] = v;
  return out;
}

async function handleOfferwallPostback(request, env) {
  if (request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);
  const secret = (env && env.OFFERWALL_SECRET_KEY) || '';
  if (!secret) {
    console.log('offerwall-postback: OFFERWALL_SECRET_KEY not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  let b;
  try { b = await owPostbackBody(request); } catch (_) { return json({ ok: false, reason: 'body' }, 400); }
  const str = (v) => String(v == null ? '' : v);
  const subId = str(b.subId || b.userId || b.uid).slice(0, 128);
  const transId = str(b.transId || b.transactionId).slice(0, 128);
  const reward = str(b.reward || b.amount || '0');
  const status = str(b.status || b.action || '');
  const signature = str(b.signature).toLowerCase();
  const offerName = str(b.offer_name || b.offerName || '').slice(0, 128);
  const offerType = str(b.offer_type || b.type || '').slice(0, 32);
  const userIp = str(b.userIp || b.ip || '0.0.0.0').slice(0, 64);
  const country = str(b.country || '').slice(0, 8).toUpperCase();
  const payout = str(b.payout || '0');

  const computed = md5(subId + transId + reward + secret).toLowerCase();
  if (computed !== signature) {
    console.log('offerwall-postback: signature mismatch; subId=' + subId + ' transId=' + transId + ' computed=' + computed + ' received=' + signature);
    return json({ ok: false, reason: 'auth', debug: { subId: subId, transId: transId, reward: reward, payout: payout, reward_value: (b.reward_value || ''), computed: computed, received: signature, keys: Object.keys(b || {}) } }, 401);
  }
  if (!subId || !transId || !reward) return json({ ok: false, reason: 'params' }, 400);
  const amt = Math.round(Number(reward || 0) * 100) / 100;
  if (!(amt >= 0)) return json({ ok: false, reason: 'reward' }, 400);

  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
  if (!saJson) {
    console.log('offerwall-postback: FIREBASE_SERVICE_ACCOUNT not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const eventId = 'ow-' + transId;
  try {
    const token = await googleAccessToken(saJson);
    // Idempotency: transId claimed once.
    const seen = await fsGet(projectId, token, 'offerwall_events/' + encodeURIComponent(eventId));
    if (seen) return text('ok');
    const baseFields = {
      uid: S(subId), provider: S('offerwall.me'), eventId: S(eventId),
      transId: S(transId), offerName: S(offerName), offerType: S(offerType),
      reward: N(amt), status: S(status), userIp: S(userIp), country: S(country),
      payout: N(payout), at: T()
    };
    await fsCreate(projectId, token, 'offerwall_events', eventId, { ...baseFields, status: S('processing') });

    const credit = status === '1';
    const reversal = status === '2';
    if (!credit && !reversal) {
      await fsPatch(projectId, token, 'offerwall_events/' + encodeURIComponent(eventId), { status: S('ignored') }, ['status']);
      return text('ok');
    }

    const wallet = await fsGet(projectId, token, 'wallets/' + encodeURIComponent(subId));
    const wf = (wallet && wallet.fields) || {};
    const pending = Number((wf.pending && (wf.pending.doubleValue || wf.pending.integerValue)) || 0);
    const lifetime = Number((wf.lifetime && (wf.lifetime.doubleValue || wf.lifetime.integerValue)) || 0);
    const invested = wf.invested || { doubleValue: 1 };
    const delta = credit ? amt : -amt;
    const walletFields = {
      pending: N(Math.round((pending + delta) * 100) / 100),
      lifetime: N(Math.round((lifetime + delta) * 100) / 100),
      invested,
      lastLabel: S('play:offers'),
      updatedAt: T()
    };
    if (wallet) {
      await fsPatch(projectId, token, 'wallets/' + encodeURIComponent(subId), walletFields, ['pending', 'lifetime', 'invested', 'lastLabel', 'updatedAt']);
    } else {
      await fsCreate(projectId, token, 'wallets', subId, {
        ...walletFields, investedAt: N(Date.now()), boostUntil: N(0)
      });
    }
    await fsCreate(projectId, token, 'proofs', '', {
      uid: S(subId), amount: N(Math.abs(delta)), label: S('play:offers'), status: S(credit ? 'done' : 'pending'), at: T(),
      provider: S('offerwall.me'), eventId: S(eventId), offerName: S(offerName), profit: N(amt)
    });
    try {
      await fsCreate(projectId, token, 'notifications', 'notif-' + eventId, {
        uid: S(subId), kind: S('offer-credit'),
        title: S(credit ? 'Offer approved' : 'Offer reversed'),
        body: S((credit ? '+' : '-') + amt.toFixed(2) + ' from Offerwall.me'), link: S('profile.html'),
        read: B(false), at: T()
      });
    } catch (_) {}
    await fsPatch(projectId, token, 'offerwall_events/' + encodeURIComponent(eventId), { status: S(credit ? 'credited' : 'reversed'), amount: N(amt) }, ['status', 'amount']);
    try {
      const uref = 'users/' + encodeURIComponent(subId);
      const u = await fsGet(projectId, token, uref);
      const uf = (u && u.fields) || {};
      const earned = Number((uf.taskEarned && (uf.taskEarned.doubleValue || uf.taskEarned.integerValue)) || 0);
      if (credit) {
        await fsPatch(projectId, token, uref, {
          taskEarned: N(Math.round((earned + amt) * 100) / 100),
          updatedAt: T()
        }, ['taskEarned', 'updatedAt']);
      }
    } catch (_) {}
    return text('ok');
  } catch (e) {
    console.log('offerwall-postback error: ' + (e && e.message ? e.message : e));
    return json({ ok: false, reason: 'write' }, 502);
  }
}

// ---------- Offerwall.me signed URL (identity signing) ----------
// GET /api/offerwall-url?uid=USER_ID&idToken=FIREBASE_ID_TOKEN
// Verifies the Firebase ID token, then returns a signed offerwall URL:
// https://offerwall.me/offerwall/{PUBLIC_API_KEY}/{uid}?identityExpires=...&identitySignature=...
async function handleOfferwallUrl(request, env) {
  if (request.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
  const publicKey = (env && env.OFFERWALL_PUBLIC_API_KEY) || '';
  const privateSecret = (env && env.OFFERWALL_SECRET_KEY) || '';
  if (!publicKey || !privateSecret) {
    console.log('offerwall-url: OFFERWALL_PUBLIC_API_KEY / OFFERWALL_SECRET_KEY not configured');
    return json({ ok: false, reason: 'setup' }, 500);
  }
  const url = new URL(request.url);
  const uid = (url.searchParams.get('uid') || '').slice(0, 128);
  const idToken = url.searchParams.get('idToken') || '';
  if (!uid) return json({ ok: false, reason: 'uid' }, 400);
  // Verify ownership via Firebase ID token.
  const me = await verifyIdToken(idToken, env);
  if (!me || me.uid !== uid) return json({ ok: false, reason: 'auth' }, 401);
  const expires = (String(Math.floor(Date.now() / 1000) + 3600));
  const message = 'offerwall-user-v1\n' + publicKey + '\n' + uid + '\n' + expires;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(privateSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const signature = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const signedUrl = 'https://offerwall.me/offerwall/' + encodeURIComponent(publicKey)
    + '/' + encodeURIComponent(uid)
    + '?' + new URLSearchParams({ identityExpires: expires, identitySignature: signature }).toString();
  return json({ ok: true, url: signedUrl, expires: expires });
}

// ---------- cashout mail (Resend) ----------
// POST /api/notify-cashout { idToken, cashoutId, type: received|paid, displayAmount? }
// Verifies the Firebase ID token via identitytoolkit (web key is public by
// design, same value the client ships), checks ownership (received: caller
// owns the cashout; paid: caller holds an admin seat), then sends one mail
// per (cashout,type) — mailLog/{cashoutId}_{type} makes retries idempotent.
// Cashout writes never depend on mail; every failure path returns ok:false
// but the client treats mail as fire-and-forget.
function webApiKey(env) {
  return (env && env.FIREBASE_WEB_API_KEY) || 'AIzaSyBbPQlrTQHFk6XBPEDUrE7a3gIMNvvlric';
}

async function verifyIdToken(idToken, env) {
  const t = String(idToken || '');
  if (t.length < 100) return null;
  try {
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(webApiKey(env)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: t })
    });
    if (!res.ok) return null;
    const data = await resJson(res, 'idtoken');
    const u = data && Array.isArray(data.users) ? data.users[0] : null;
    if (!u || !u.localId) return null;
    return { uid: String(u.localId), email: String(u.email || '') };
  } catch (_) { return null; }
}

function maskDest(dest) {
  const s = String(dest || '').trim();
  if (!s) return '—';
  const at = s.indexOf('@');
  if (at > 0) {
    const local = s.slice(0, at), domain = s.slice(at + 1);
    return (local.charAt(0) || '*') + '•••@' + domain;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 6) return '••••' + digits.slice(-4);
  if (s.length <= 8) return s.charAt(0) + '•••';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Pure builders — unit-testable, no platform APIs.
export function cashoutMail(type, d) {
  const amount = String(d.displayAmount || ('$' + Number(d.usd || 0).toFixed(2)));
  const method = String(d.method || 'your method');
  const dest = maskDest(d.dest);
  const id = String(d.cashoutId || '—');
  const date = String(d.dateUtc || '');
  const appUrl = 'https://favmoney.site';
  if (type === 'paid') {
    return {
      subject: 'Your ' + amount + ' has been sent via ' + method + ' · Favmoney',
      text:
        'Hi ' + d.name + ',\n\n' +
        'Good news — your withdrawal has been paid.\n\n' +
        'Amount: ' + amount + '\n' +
        'Method: ' + method + '\n' +
        'Destination: ' + dest + '\n' +
        'Request ID: ' + id + '\n' +
        'Paid: ' + date + '\n\n' +
        'Depending on the rail, arrival can take a few minutes to a few hours. ' +
        'Track it anytime: ' + appUrl + '/withdrawals.html\n\n' +
        "If this wasn't you, contact support immediately.\n\n" +
        "— The Favmoney team\n" +
        "Security note: we'll never ask for your password or keys. This is a notification-only address.",
      html:
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">' +
        '<h2 style="margin:0 0 8px">Hi ' + escHtml(d.name) + ',</h2>' +
        '<p><strong>Good news — your withdrawal has been paid.</strong></p>' +
        '<table style="border-collapse:collapse;width:100%;margin:12px 0"><tbody>' +
        '<tr><td style="padding:6px 10px;color:#666">Amount</td><td style="padding:6px 10px"><strong>' + escHtml(amount) + '</strong></td></tr>' +
        '<tr><td style="padding:6px 10px;color:#666">Method</td><td style="padding:6px 10px">' + escHtml(method) + '</td></tr>' +
        '<tr><td style="padding:6px 10px;color:#666">Destination</td><td style="padding:6px 10px">' + escHtml(dest) + '</td></tr>' +
        '<tr><td style="padding:6px 10px;color:#666">Request ID</td><td style="padding:6px 10px">' + escHtml(id) + '</td></tr>' +
        '<tr><td style="padding:6px 10px;color:#666">Paid</td><td style="padding:6px 10px">' + escHtml(date) + '</td></tr>' +
        '</tbody></table>' +
        '<p>Depending on the rail, arrival can take a few minutes to a few hours. ' +
        '<a href="' + appUrl + '/withdrawals.html">Track it here</a>.</p>' +
        "<p>If this wasn't you, contact support immediately.</p>" +
        '<p style="color:#888;font-size:12px">— The Favmoney team<br>Security note: we\'ll never ask for your password or keys. This is a notification-only address.</p>' +
        '</div>'
    };
  }
  return {
    subject: 'Withdrawal received — ' + amount + ' via ' + method + ' · Favmoney',
    text:
      'Hi ' + d.name + ',\n\n' +
      "We've received your withdrawal request. It is now under review.\n\n" +
      'Amount: ' + amount + '\n' +
      'Method: ' + method + '\n' +
      'Destination: ' + dest + '\n' +
      'Request ID: ' + id + '\n' +
      'Requested: ' + date + '\n\n' +
      'What happens next: review usually completes within a few hours, and payout lands within 24 hours of your request. ' +
      'Track status anytime: ' + appUrl + '/withdrawals.html\n\n' +
      "If you didn't request this, contact support immediately.\n\n" +
      '— The Favmoney team\n' +
      "Security note: we'll never ask for your password or keys. This is a notification-only address."
    ,
    html:
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">' +
      '<h2 style="margin:0 0 8px">Hi ' + escHtml(d.name) + ',</h2>' +
      "<p><strong>We've received your withdrawal request.</strong> It is now under review.</p>" +
      '<table style="border-collapse:collapse;width:100%;margin:12px 0"><tbody>' +
      '<tr><td style="padding:6px 10px;color:#666">Amount</td><td style="padding:6px 10px"><strong>' + escHtml(amount) + '</strong></td></tr>' +
      '<tr><td style="padding:6px 10px;color:#666">Method</td><td style="padding:6px 10px">' + escHtml(method) + '</td></tr>' +
      '<tr><td style="padding:6px 10px;color:#666">Destination</td><td style="padding:6px 10px">' + escHtml(dest) + '</td></tr>' +
      '<tr><td style="padding:6px 10px;color:#666">Request ID</td><td style="padding:6px 10px">' + escHtml(id) + '</td></tr>' +
      '<tr><td style="padding:6px 10px;color:#666">Requested</td><td style="padding:6px 10px">' + escHtml(date) + '</td></tr>' +
      '</tbody></table>' +
      '<p><strong>What happens next:</strong> review usually completes within a few hours, and payout lands <strong>within 24 hours</strong> of your request. ' +
      '<a href="' + appUrl + '/withdrawals.html">Track status here</a>.</p>' +
      "<p>If you didn't request this, contact support immediately.</p>" +
      '<p style="color:#888;font-size:12px">— The Favmoney team<br>Security note: we\'ll never ask for your password or keys. This is a notification-only address.</p>' +
      '</div>'
  };
}

async function resendSend(env, msg) {
  const key = (env && env.RESEND_API_KEY) || '';
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: (env && env.MAIL_FROM) || 'Favmoney <payments@favmoney.site>',
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(function () { return ''; });
    throw new Error('resend ' + res.status + ': ' + String(t).slice(0, 120));
  }
  return resJson(res, 'resend');
}

function restNum(doc, field) {
  try {
    const f = doc && doc.fields && doc.fields[field];
    if (!f) return 0;
    if (typeof f.doubleValue === 'number') return f.doubleValue;
    if (typeof f.integerValue === 'string') return Number(f.integerValue);
    return Number(f.doubleValue || 0);
  } catch (_) { return 0; }
}

async function handleNotifyCashout(request, env) {
  let body = null;
  try { body = await request.json(); } catch (_) { return json({ ok: false, reason: 'body' }, 400); }
  const type = String((body && body.type) || '');
  if (type !== 'received' && type !== 'paid') return json({ ok: false, reason: 'type' }, 400);
  const cashoutId = String((body && body.cashoutId) || '').slice(0, 128);
  if (!cashoutId) return json({ ok: false, reason: 'cashoutId' }, 400);
  const me = await verifyIdToken(body && body.idToken, env);
  if (!me) return json({ ok: false, reason: 'auth' }, 401);
  if (!((env && env.RESEND_API_KEY) || '')) return json({ ok: false, reason: 'setup' }, 500);
  const projectId = (env && env.FIREBASE_PROJECT_ID) || 'favmoney';
  const saJson = (env && (env.FIREBASE_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT_JSON)) || '';
  if (!saJson) return json({ ok: false, reason: 'setup' }, 500);
  try {
    const token = await googleAccessToken(saJson);
    const co = await fsGet(projectId, token, 'cashouts/' + encodeURIComponent(cashoutId));
    if (!co) return json({ ok: false, reason: 'unknown' }, 404);
    const ownerUid = restStr(co, 'uid');
    if (type === 'received') {
      if (!ownerUid || ownerUid !== me.uid) return json({ ok: false, reason: 'auth' }, 403);
    } else {
      // paid: caller must hold an admin seat (owner console session).
      let admin = false;
      for (const seat of ['seat1', 'seat2']) {
        try {
          const s = await fsGet(projectId, token, 'admin/' + seat);
          if (s && restStr(s, 'uid') === me.uid) { admin = true; break; }
        } catch (_) {}
      }
      if (!admin) return json({ ok: false, reason: 'auth' }, 403);
    }
    // Idempotency: one mail per (cashout, type).
    try {
      const seen = await fsGet(projectId, token, 'mailLog/' + encodeURIComponent(cashoutId + '_' + type));
      if (seen) return json({ ok: true, deduped: true });
    } catch (_) {}
    const amount = restNum(co, 'amount');
    const method = restStr(co, 'method') || 'your method';
    const dest = restStr(co, 'dest');
    let to = '', name = 'there', currency = 'USD';
    try {
      const u = await fsGet(projectId, token, 'users/' + encodeURIComponent(ownerUid));
      to = restStr(u, 'email') || me.email;
      const em = to || me.email || '';
      name = (em.split('@')[0] || 'there').slice(0, 24);
      const cu = restStr(u, 'currency');
      if (/^[A-Z]{3}$/.test(cu)) currency = cu;
    } catch (_) { to = me.email; }
    if (!to || to.indexOf('@') < 0) return json({ ok: false, reason: 'noemail' }, 400);
    let display = String((body && body.displayAmount) || '').slice(0, 40);
    if (!display) display = '$' + amount.toFixed(2) + (currency !== 'USD' ? ' (USD ' + amount.toFixed(2) + ')' : '');
    let atIso = '';
    try {
      const at = co.fields && co.fields.at;
      atIso = (at && (at.timestampValue || '')) || '';
    } catch (_) {}
    let dateUtc = atIso;
    try { if (atIso) dateUtc = new Date(atIso).toUTCString(); } catch (_) {}
    const mail = cashoutMail(type, {
      name, displayAmount: display, method, dest,
      cashoutId, dateUtc: dateUtc || new Date().toUTCString(),
      usd: amount
    });
    await resendSend(env, { to, subject: mail.subject, html: mail.html, text: mail.text });
    try {
      await fsCreate(projectId, token, 'mailLog', cashoutId + '_' + type, {
        uid: S(ownerUid), type: S(type), to: S(to), at: T()
      });
    } catch (_) {}
    return json({ ok: true });
  } catch (e) {
    console.log('notify-cashout error: ' + (e && e.message ? e.message : e));
    return json({ ok: false, reason: 'send' }, 502);
  }
}

// ---------- request handler ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/notify-cashout' || url.pathname === '/api/notify-cashout/') {
      if (request.method !== 'POST') return json({ ok: false, reason: 'method' }, 405);
      try { return await handleNotifyCashout(request, env); }
      catch (e) {
        console.log('notify-cashout error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'send' }, 502);
      }
    }
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
    if (url.pathname === '/api/mylead-postback' || url.pathname === '/api/mylead-postback/') {
      if (request.method !== 'GET') return json({ ok: false, reason: 'method' }, 405);
      try { return await handleMyleadPostback(request, env); }
      catch (e) {
        console.log('mylead-postback error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'write' }, 502);
      }
    }
    if (url.pathname === '/api/offerwall-postback' || url.pathname === '/api/offerwall-postback/') {
      try { return await handleOfferwallPostback(request, env); }
      catch (e) {
        console.log('offerwall-postback error: ' + (e && e.message ? e.message : e));
        return json({ ok: false, reason: 'write' }, 502);
      }
    }
    if (url.pathname === '/api/offerwall-url' || url.pathname === '/api/offerwall-url/') {
      try { return await handleOfferwallUrl(request, env); }
      catch (e) {
        console.log('offerwall-url error: ' + (e && e.message ? e.message : e));
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
