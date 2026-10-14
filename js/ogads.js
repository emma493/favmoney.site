// Favmoney OGAds helper (ES module, pure — no window/document at import).
// Offer list comes from Worker GET /api/ogads-offers (key stays server-side).
// Clicks open the OGAds click URL in a FULL new tab with the Firebase uid
// passed as aff_sub4 (their postback echoes aff_sub4 back, mapping the
// conversion to the user).

export const OGADS_MAX_VISIBLE = 20;

// Append the uid as aff_sub4 to an OGAds click link. Returns '' when unsafe.
export function ogadsClickUrl(link, uid) {
  const base = String(link || '');
  const id = String(uid || '').slice(0, 128);
  if (!base || !id) return '';
  if (!/^https?:\/\//i.test(base)) return '';
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'aff_sub4=' + encodeURIComponent(id);
}

// User-facing reward: 70% of provider payout, bounded per conversion.
export function ogadsUserPay(payout, share, cap) {
  const s = Number(share == null ? 0.7 : share);
  const c = Number(cap == null ? 20 : cap);
  const amt = Math.round(Number(payout || 0) * s * 100) / 100;
  if (!(amt > 0)) return 0;
  return Math.min(amt, c);
}
