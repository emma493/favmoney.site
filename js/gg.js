// Favmoney offerwall provider catalog (ES module, no backend).
// Clicking a card opens the provider in a FULL new tab with the user's
// Firebase uid passed as p1 (Golden Goose returns it verbatim on postback).
// Provider URLs are NEVER iframed or prefetched — same safety rule as PTC.

// TODO(owner): paste your Golden Goose SmartLink / promo base URL here.
// Find it in gg.agency dashboard -> Promo / SmartLink. Keep any existing
// query params; uid/source/site are appended automatically.
export const GG_PROMO_BASE = 'https://jhuweq.com/cl/8e606e488b499750';

// MyLead offerwall (iframe wall opened in a NEW TAB, never embedded).
// The Firebase uid travels as ?player_id= so conversions attribute back.
export const MYLEAD_WALL_URL = 'https://reward-me.eu/597dbb1a-c964-11f1-973a-8a5fb7be40ea';

export const OFFER_PROVIDERS = [
  {
    id: 'gg',
    name: 'Golden Goose',
    tag: 'gg.agency · Mobile offers',
    desc: 'Complete mobile offers from gg.agency. You keep 70% of each approved payout.',
    cta: 'Open offers',
    img: 'images/goldengoose.png',
    base: GG_PROMO_BASE
  },
  {
    id: 'mylead',
    name: 'MyLead',
    tag: 'mylead.global · Offerwall',
    desc: 'Complete offerwall deals from mylead.global. You keep 70% of each approved payout.',
    cta: 'Open wall',
    img: 'images/mylead.png',
    base: MYLEAD_WALL_URL,
    playerParam: 'player_id'
  }
];

// Pure builder — safe to unit-test, no window/document access.
export function providerClickUrl(provider, uid) {
  const base = String((provider && provider.base) || '');
  if (!base) return '';
  const id = String((uid || '')).slice(0, 128);
  if (!id) return '';
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  if (provider && provider.playerParam) {
    return base + sep + encodeURIComponent(provider.playerParam) + '=' + encodeURIComponent(id);
  }
  return base + sep + 'p1=' + encodeURIComponent(id)
    + '&p2=' + encodeURIComponent(provider.id || 'gg')
    + '&source=' + encodeURIComponent('favmoney')
    + '&site=' + encodeURIComponent('offerwalls');
}

export function getProvider(pid) {
  const list = Array.isArray(OFFER_PROVIDERS) ? OFFER_PROVIDERS : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === pid) return list[i];
  }
  return null;
}
