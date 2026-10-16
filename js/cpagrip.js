// Favmoney CPA Grip helper (ES module, pure — no window/document at import).
// Card 2 SmartLink: https://doctoredits.com/1918631/ with the member uid
// passed as tracking_id (CPA Grip echoes it back on the Global Postback,
// mapping the conversion to the user). Clicks open in a FULL new tab —
// provider URLs are NEVER iframed or prefetched, same rule as PTC/GG/OGAds.

export const CPAGRIP_SMARTLINK_BASE = 'https://doctoredits.com/1918631/';
export const CPAGRIP_ID = 'cpagrip';

// Append the uid as tracking_id to a CPA Grip link. Returns '' when unsafe.
export function cpagripClickUrl(link, uid) {
  const base = String(link || '');
  const id = String(uid || '').slice(0, 128);
  if (!base || !id) return '';
  if (!/^https?:\/\//i.test(base)) return '';
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  return base + sep + 'tracking_id=' + encodeURIComponent(id);
}

// User-facing reward: 70% of provider payout, bounded per conversion.
export function cpagripUserPay(payout, share, cap) {
  const s = Number(share == null ? 0.7 : share);
  const c = Number(cap == null ? 20 : cap);
  const amt = Math.round(Number(payout || 0) * s * 100) / 100;
  if (!(amt > 0)) return 0;
  return Math.min(amt, c);
}
