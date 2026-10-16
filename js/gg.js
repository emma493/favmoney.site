// Favmoney offerwall provider catalog (ES module, no backend).
// Clicking a card opens the provider in a FULL new tab with the user's
// Firebase uid passed as p1 (Golden Goose returns it verbatim on postback).
// Provider URLs are NEVER iframed or prefetched — same safety rule as PTC.

// TODO(owner): paste your Golden Goose SmartLink / promo base URL here.
// Find it in gg.agency dashboard -> Promo / SmartLink. Keep any existing
// query params; uid/source/site are appended automatically.
export const GG_PROMO_BASE = 'https://jhuweq.com/cl/8e606e488b499750';

export const OFFER_PROVIDERS = [
  {
    id: 'gg',
    name: 'Golden Goose',
    tag: 'gg.agency · Mobile offers',
    desc: 'Complete mobile offers from gg.agency. You keep 70% of each approved payout.',
    cta: 'Open offers',
    img: 'images/offers-and-apps.png',
    base: GG_PROMO_BASE
  },
  {
    id: 'provider-2',
    name: 'Golden Goose',
    tag: 'gg.agency · Mobile offers',
    desc: 'Complete mobile offers from gg.agency. You keep 70% of each approved payout.',
    cta: 'Open offers',
    img: 'images/offers-and-apps.png',
    base: '',
    page: 'provider-2.html'
  },
  {
    id: 'provider-3',
    name: 'Golden Goose',
    tag: 'gg.agency · Mobile offers',
    desc: 'Complete mobile offers from gg.agency. You keep 70% of each approved payout.',
    cta: 'Open offers',
    img: 'images/offers-and-apps.png',
    base: '',
    page: 'provider-3.html'
  },
  {
    id: 'provider-4',
    name: 'Golden Goose',
    tag: 'gg.agency · Mobile offers',
    desc: 'Complete mobile offers from gg.agency. You keep 70% of each approved payout.',
    cta: 'Open offers',
    img: 'images/offers-and-apps.png',
    base: '',
    page: 'provider-4.html'
  }
];

// Pure builder — safe to unit-test, no window/document access.
export function providerClickUrl(provider, uid) {
  const base = String((provider && provider.base) || '');
  if (!base) return '';
  const id = String((uid || '')).slice(0, 128);
  if (!id) return '';
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
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
