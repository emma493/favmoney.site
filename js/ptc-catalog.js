// Favmoney PTC catalog + safe sponsor opener (ES module, no backend).
// Adsterra-safety rules enforced by construction:
//  - Sponsor URLs are NEVER iframed, prefetched, preloaded, or fetched.
//    The ONLY touch is openSponsor(), called from a real user click, which
//    opens a full new tab with noopener. No auto-open, no auto-refresh.
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

export const PTC_CATALOG = [
  {
    id: 'adsterra-01',
    title: 'Sponsored partner',
    text: 'Visit our partner in a new tab, keep this page visible for 40 seconds, then claim $0.20.',
    url: SPONSOR_URL,
    secs: 40,
    pay: 0.20,
    intervalHrs: 24,
    slots: [0, 1, 2, 3, 4, 5, 6, 7]
  }
];

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
  return PTC_CATALOG.filter(function (a) {
    return Array.isArray(a.slots) && a.slots.indexOf(s) >= 0;
  });
}
export function getAd(adId) {
  const list = Array.isArray(PTC_CATALOG) ? PTC_CATALOG : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === adId) return list[i];
  }
  return null;
}

// Safe opener: real click -> full new tab, noopener, no referrer leakage
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
