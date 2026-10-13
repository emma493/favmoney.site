// Favmoney PTC catalog + sponsor surfaces (ES module, no backend).
// Ad-safety rules enforced by construction:
//  - Sponsor URLs load ONLY in a sandboxed same-page iframe (embedSponsor)
//    with no top-navigation permission, so framed pages can neither break
//    out nor navigate the app. New-tab opens happen ONLY from an explicit
//    user tap on a fallback link (openSponsor / manual anchors).
//  - No prefetch, preload, or fetch of sponsor URLs — the single load is
//    the visible iframe, set when a reward modal opens and cleared on close.
//  - Pay is bounded in code to PTC_TIERS ($0.10-$0.30, 10-60s). claimPtcView
//    re-checks the catalog entry before paying, so edited client timers or
//    amounts cannot raise a payout.
// To add links 2-50: append entries {id,title,text,url,secs,pay,
// intervalHrs,slots} — same shape, no other file needs structural changes.

// Single source of truth for the sponsor URL (PTC + Grow boost share it).
export const SPONSOR_URL = 'https://www.profitableratecpmnetwork.com/ahct9uhb?key=f4da12d7aaa67cd61f6a1196381da654';

// Allowed pay bands. secs 30-50 / pay $0.10-$0.30 is the live operating band;
// 10s/15s/60s rows exist so future links have bounded options.
export const PTC_TIERS = [
  { secs: 10, pay: 0.10 },
  { secs: 15, pay: 0.11 },
  { secs: 30, pay: 0.13 },
  { secs: 40, pay: 0.20 },
  { secs: 60, pay: 0.30 }
];
export const PTC_MIN_PAY = 0.10;
export const PTC_MAX_PAY = 0.30;

// How many ready ads the Watch page shows at once. The rest unlock
// 1-for-1 as the user claims (see ptc.html paint()).
export const PTC_VISIBLE_COUNT = 30;

function tierForIndex(i) {
  // Weighted mix to bound daily exposure (50 ads, ~$6.50 max):
  // 20x 10s/$0.10, 12x 15s/$0.11, 10x 30s/$0.13, 5x 40s/$0.20, 3x 60s/$0.30.
  if (i < 20) return { secs: 10, pay: 0.10 };
  if (i < 32) return { secs: 15, pay: 0.11 };
  if (i < 42) return { secs: 30, pay: 0.13 };
  if (i < 47) return { secs: 40, pay: 0.20 };
  return { secs: 60, pay: 0.30 };
}

// Advertiser pool (VieFaucet-style): fictional faucet-ecosystem display
// names + blurbs. Display-only — every entry still loads SPONSOR_URL, and
// claim validation keys on id/secs/pay, never on title/text. The wall picks
// 50 distinct pool entries per 3h slot + UTC day, so names always rotate.
export const ADVERTISER_POOL = [
  { title: 'Win Free Spins & Bonus Rounds', blurb: 'Register and claim starter spins plus bonus rounds.' },
  { title: 'Chain Quest Rewards', blurb: 'Finish missions, unlock items and earn tokens.' },
  { title: 'Mega Cash Prize Draw', blurb: 'Enter the weekly prize draw with cash-style rewards.' },
  { title: 'Daily BTC Earn Guide', blurb: 'Explore legit ways to earn free crypto daily.' },
  { title: 'Virtual Crypto Mining', blurb: 'Play, complete tasks and grow a virtual mining farm.' },
  { title: 'PTC Surveys & Tasks Hub', blurb: 'PTC, surveys and tasks with instant test payments.' },
  { title: 'Free Litecoin Claims', blurb: 'Instant litecoin-style faucet claims, fast rewards.' },
  { title: 'Drop Claim Launch', blurb: 'Fresh faucet launch with instant secure login.' },
  { title: 'Mining Game Alternative', blurb: 'Free-to-play mining game with daily rewards.' },
  { title: 'Free Doge Rewards', blurb: 'Daily dogecoin-style rewards app with streak bonuses.' },
  { title: 'Low-Cashout Earn Hub', blurb: 'PTC, tasks, videos and surveys from a tiny test cashout.' },
  { title: 'CryptoFuture-Style Faucet', blurb: 'Litecoin-style faucet with instant test payouts.' },
  { title: 'Dollar-A-Day Projects', blurb: 'Three starter projects paying test rewards daily.' },
  { title: 'New No-Timer Faucet', blurb: 'No-timer faucet with PTC and video walls.' },
  { title: 'Instant Faucet Monitor', blurb: 'Faucet monitor with instant test payments.' },
  { title: 'Demo Trading Bonus', blurb: 'Free demo account with practice balance for starters.' },
  { title: 'Play & Earn Tokens', blurb: 'Register free, play games and earn tokens daily.' },
  { title: 'Traffic Monetizer', blurb: 'Banners, push and video ads for publishers.' },
  { title: 'Bucks Rewards Wall', blurb: 'Short ad wall with fast test rewards.' },
  { title: 'LTC Mining Bonus Site', blurb: 'New mining-style site with free starter hashpower.' },
  { title: 'Press Release Board', blurb: 'Crypto press-release distribution demo board.' },
  { title: 'BNB-Style Mining Site', blurb: 'Starter mining demo with daily test earnings.' },
  { title: 'Claim Satoshi Hub', blurb: 'Daily faucet hub with rewards and challenges.' },
  { title: 'Mine & Earn Demo', blurb: 'Online mining demo with simple test earnings.' },
  { title: 'Starter Bonus Board', blurb: 'Create a free account and unlock starter bonuses.' },
  { title: 'Cloud Mining Demo', blurb: 'Free cloud-mining demo for starter assets.' },
  { title: 'Signup Bonus Trial', blurb: 'Fast signup with a starter income trial.' },
  { title: 'Daily Spin Jackpot', blurb: 'Daily free spin with jackpot-style test prizes.' },
  { title: 'Instant Demo Account', blurb: 'Minimum-test demo account for new traders.' },
  { title: 'Free Spins Trial', blurb: 'Signup trial with free spins, no deposit needed.' },
  { title: 'Spin Bonus Round', blurb: 'Up to 225 free test spins for new members.' },
  { title: 'Coin News Pulse', blurb: 'Daily coin news with faucet and rewards links.' },
  { title: 'Software Offers Board', blurb: 'Curated software offers and trial rewards.' },
  { title: 'Doge Mining Demo', blurb: 'Doge-style mining demo with instant-style payouts.' },
  { title: 'Lite Mining Platform', blurb: 'LTC-style mining platform with free starter power.' },
  { title: 'FC Instant Faucet', blurb: 'Fast instant faucet with per-minute claims.' },
  { title: '100-Ads PTC Board', blurb: 'High-volume PTC board with 100 daily test ads.' },
  { title: 'Free Bitcoin Starter', blurb: 'Free starter account with daily bitcoin-style rewards.' },
  { title: 'Link Promo Board', blurb: 'Get paid test rewards to promote a link.' },
  { title: 'Gold Earn Faucet & PTC', blurb: 'New faucet and PTC combo with shortlinks.' },
  { title: 'USD Pick Board', blurb: 'Faucet, games and surveys picker.' },
  { title: 'Free Tron Claims', blurb: 'Instant tron-style claims with fast withdrawal test.' },
  { title: 'BCH Pick Board', blurb: 'Faucet, games and surveys for BCH-style assets.' },
  { title: 'Bitcoin Signup Trial', blurb: 'Signup trial to earn free bitcoin-style rewards.' },
  { title: 'Kiddy Earn Faucet', blurb: 'Instant faucet with per-minute coin claims.' },
  { title: 'Pepe-Style Instant Faucet', blurb: 'Instant faucet with big daily coin drops.' },
  { title: 'Long-Term Earn Site', blurb: 'Long-term earning demo with wallet connect.' },
  { title: 'Funds Reward Hub', blurb: 'Daily high-rate rewards with instant test payments.' },
  { title: 'Gold Earn Combo Site', blurb: 'Faucet, PTC, shortlinks and offerwalls combo.' },
  { title: 'Earnslick-Style Stake', blurb: 'Faucet and stake combo to grow earnings.' },
  { title: 'Earn Free Coin Board', blurb: 'Earn coins by clicking PTC ads.' },
  { title: 'Diamantina-Style Game', blurb: 'Faucet game with levels and activity bonuses.' },
  { title: 'Auto Faucet Demo', blurb: 'Auto faucet with level and activity bonuses.' },
  { title: 'Video Watch & Earn', blurb: 'Watch short videos and earn test rewards.' },
  { title: 'Music Drop Premiere', blurb: 'New music premiere with watch rewards.' },
  { title: 'Free Tools Board', blurb: 'Free online tools with quick test rewards.' },
  { title: 'TRX Bonus Flow', blurb: 'Hourly TRX-style bonus with auto payments.' },
  { title: 'Airdrop Check Board', blurb: 'Airdrop, testnet and tool checks from sources.' },
  { title: 'Hourly Bonus Trial', blurb: 'Small hourly bonus with daily percent demo.' },
  { title: 'Crypto Learn Sprint', blurb: 'Quick crypto quiz sprints for learners.' },
  { title: 'Staking Rewards Demo', blurb: 'Stake demo assets and watch test yield accrue.' },
  { title: 'Referral Boost Board', blurb: 'Invite friends and boost test earnings.' },
  { title: 'Jackpot Wheel Trial', blurb: 'Spin the trial wheel for multiplier prizes.' },
  { title: 'Satoshi Quiz Arena', blurb: 'Answer quiz questions against the clock.' }
];

function dayNumber(nowMs) {
  return Math.floor(Number(nowMs || Date.now()) / 86400000);
}

function mulberry32(seed) {
  var a = (Number(seed) >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic pool pick: 50 distinct entries, stable within a slot,
// different across 3h slots and UTC days. Pure function of time.
export function poolAdvertisers(nowMs) {
  const n = Number(nowMs || Date.now());
  const seed = (dayNumber(n) * PTC_SLOT_COUNT + slotIndex(n)) >>> 0;
  const rand = mulberry32(seed || 1);
  const idx = ADVERTISER_POOL.map(function (_, i) { return i; });
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }
  return idx.slice(0, 50).map(function (k) { return ADVERTISER_POOL[k]; });
}

function decorateOne(a, p) {
  const secs = Number(a.secs || 0), pay = Number(a.pay || 0);
  const pick = p || { title: 'Sponsored view', blurb: 'Partner offer.' };
  return {
    id: a.id,
    title: pick.title,
    text: 'Visit ' + pick.title + ' — ' + pick.blurb + ' Keep this page visible for ' + secs + 's, then claim $' + pay.toFixed(2) + '.',
    url: a.url,
    secs: secs,
    pay: pay,
    intervalHrs: a.intervalHrs,
    slots: a.slots
  };
}

function decorateAds(baseAds, nowMs) {
  const picks = poolAdvertisers(nowMs);
  return baseAds.map(function (a, i) {
    return decorateOne(a, picks[i % picks.length]);
  });
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

export const PTC_CATALOG = (function buildCatalog() {
  var out = [];
  for (var i = 0; i < 50; i++) {
    var t = tierForIndex(i);
    var n = i + 1;
    var id = n === 1 ? 'adsterra-01' : 'ptc-' + pad2(n);
    var p = ADVERTISER_POOL[i % ADVERTISER_POOL.length];
    out.push({
      id: id,
      title: p.title,
      text: 'Visit ' + p.title + ' — ' + p.blurb + ' Keep this page visible for ' + t.secs + ' seconds, then claim $' + t.pay.toFixed(2) + '.',
      url: SPONSOR_URL,
      secs: t.secs,
      pay: t.pay,
      intervalHrs: 24,
      slots: [0, 1, 2, 3, 4, 5, 6, 7]
    });
  }
  // First row keeps the top-tier 40s/$0.20 economics with a pool name.
  out[0].secs = 40;
  out[0].pay = 0.20;
  out[0].text = 'Visit ' + out[0].title + ' — keep this page visible for 40 seconds, then claim $0.20.';
  return out;
})();

// Rotation: 3-hour UTC slots, 8 batches/day. Pure function of time.
export const PTC_SLOT_MS = 3 * 3600000;
export const PTC_SLOT_COUNT = 8;
export function slotIndex(nowMs) {
  const n = Number(nowMs || Date.now());
  return Math.floor(n / PTC_SLOT_MS) % PTC_SLOT_COUNT;
}
export function slotResetMs(nowMs) {
  const n = Number(nowMs || Date.now());
  return (Math.floor(n / PTC_SLOT_MS) + 1) * PTC_SLOT_MS - n;
}
export function adsForSlot(nowMs) {
  const s = slotIndex(nowMs);
  const picks = poolAdvertisers(nowMs);
  const out = [];
  for (let i = 0; i < PTC_CATALOG.length; i++) {
    const a = PTC_CATALOG[i];
    if (!a || !Array.isArray(a.slots) || a.slots.indexOf(s) < 0) continue;
    // Catalog-index positional pick: matches getAd for the same id/slot,
    // even if future entries ever restrict their slots.
    out.push(decorateOne(a, picks[i % picks.length]));
  }
  return out;
}
export function getAd(adId, nowMs) {
  const list = Array.isArray(PTC_CATALOG) ? PTC_CATALOG : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === adId) {
      // Same positional pick as adsForSlot (catalog index i -> picks[i]),
      // so the modal title always matches the painted list row.
      const picks = poolAdvertisers(nowMs == null ? Date.now() : nowMs);
      return decorateOne(list[i], picks[i % picks.length]);
    }
  }
  return null;
}

// Same-page sponsor surface: load url into a sandboxed iframe. The sandbox
// (no allow-top-navigation) traps frame-busting ads inside the frame — the
// app page can never be navigated away. Call with the modal's iframe on open,
// clearSponsor() on close so nothing keeps playing. Returns true on success.
export function embedSponsor(frame, url) {
  try {
    if (!frame) return false;
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('title', 'Sponsored view');
    frame.src = String(url || SPONSOR_URL);
    return true;
  } catch (_) { return false; }
}

// Stop the framed page (audio/video/timers) when its modal closes.
export function clearSponsor(frame) {
  try { if (frame) frame.removeAttribute('src'); } catch (_) {}
}

// Safe opener: explicit user tap -> full new tab, noopener, no referrer
// beyond a normal navigation. Returns true when the tab opened; false when
// a popup blocker stopped it (caller shows a manual tap-to-open anchor).
export function openSponsor(url) {
  const u = String(url || SPONSOR_URL);
  try {
    const w = window.open(u, '_blank', 'noopener,noreferrer');
    if (w) { try { w.opener = null; } catch (_) {} return true; }
  } catch (_) {}
  // Popup blocked: fall back to a synthetic anchor click (still a user
  // gesture descendant, so it usually succeeds where window.open failed).
  try {
    const a = document.createElement('a');
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener sponsored nofollow';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); } catch (_) {} }, 1000);
    return true;
  } catch (_) { return false; }
}
