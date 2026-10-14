// Favmoney payout rails — per-country methods with global defaults.
// Wallet/cashouts stay USD internally; methods are display + routing metadata.
// Defaults (every country): PayPal + crypto (Bitcoin, Litecoin, Dogecoin).
// Overrides add local rails (bank / mobile money) for specific countries.
// Cashout docs carry { method, methodKind, country } for ops routing.

export const METHOD_DEFS = {
  'PayPal': {
    id: 'PayPal', kind: 'paypal', sec: 'pop',
    img: 'assets/cashout/paypal.webp', min: 5,
    denoms: [5, 10, 20, 30, 50, 75, 100, 200],
    destLabel: 'Destination (PayPal email)',
    destPlaceholder: 'you@example.com'
  },
  'Visa Prepaid': {
    id: 'Visa Prepaid', kind: 'visa', sec: 'pop',
    img: 'assets/cashout/visa.webp', min: 5,
    denoms: [5, 10, 25, 50, 75, 100, 150, 200],
    destLabel: 'Destination (cardholder email)',
    destPlaceholder: 'you@example.com'
  },
  'Bitcoin': {
    id: 'Bitcoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/bitcoin.png', min: 5,
    denoms: [5, 10, 25, 50, 100, 200],
    destLabel: 'Destination (BTC address)',
    destPlaceholder: 'bc1…'
  },
  'Litecoin': {
    id: 'Litecoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/litecoin.png', min: 5,
    denoms: [5, 10, 25, 50, 100, 200],
    destLabel: 'Destination (LTC address)',
    destPlaceholder: 'ltc1…'
  },
  'Dogecoin': {
    id: 'Dogecoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/dogecoin.png', min: 5,
    denoms: [5, 10, 25, 50, 100, 200],
    destLabel: 'Destination (DOGE address)',
    destPlaceholder: 'D…'
  },
  'Bank Transfer': {
    id: 'Bank Transfer', kind: 'bank', sec: 'local',
    img: null, min: 5,
    denoms: [5, 10, 20, 30, 50, 75, 100, 200],
    destLabel: 'Destination (bank name + account number)',
    destPlaceholder: 'e.g. GTBank · 0123456789 · Account Name'
  },
  'Mobile Money': {
    id: 'Mobile Money', kind: 'momo', sec: 'local',
    img: null, min: 3,
    denoms: [3, 5, 10, 20, 30, 50, 100, 200],
    destLabel: 'Destination (mobile money number)',
    destPlaceholder: 'e.g. 0803 000 0000 · Network · Name'
  },
  'MTN MoMo': {
    id: 'MTN MoMo', kind: 'momo', sec: 'local',
    img: null, min: 3,
    denoms: [3, 5, 10, 20, 30, 50, 100, 200],
    destLabel: 'Destination (MTN MoMo number + name)',
    destPlaceholder: 'e.g. 024 000 0000 · Name'
  },
  'M-Pesa': {
    id: 'M-Pesa', kind: 'momo', sec: 'local',
    img: null, min: 3,
    denoms: [3, 5, 10, 20, 30, 50, 100, 200],
    destLabel: 'Destination (M-Pesa number + name)',
    destPlaceholder: 'e.g. 07XX 000 000 · Name'
  }
};

// Global defaults: PayPal + some crypto. Every country gets at least these.
export const DEFAULT_METHOD_IDS = ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin'];

// Countries with card rails (Visa) in addition to defaults.
const VISA_COUNTRIES = ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'GR', 'AT', 'FI', 'SE', 'NO', 'DK', 'CH'];

// Explicit local-rail overrides. All other countries fall back to defaults
// (+ Visa where listed above).
export const COUNTRY_METHODS = {
  NG: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Bank Transfer', 'Mobile Money'],
  GH: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'MTN MoMo', 'Bank Transfer'],
  KE: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'M-Pesa', 'Bank Transfer'],
  ZA: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Bank Transfer'],
  UG: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money'],
  TZ: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money'],
  CM: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money'],
  SN: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money'],
  CI: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money'],
  RW: ['PayPal', 'Bitcoin', 'Litecoin', 'Dogecoin', 'Mobile Money']
};

export function methodsForCountry(code) {
  var cc = String(code || 'US').toUpperCase();
  var ids = COUNTRY_METHODS[cc];
  if (!ids) {
    ids = DEFAULT_METHOD_IDS.slice();
    if (VISA_COUNTRIES.indexOf(cc) >= 0) ids.splice(1, 0, 'Visa Prepaid');
  }
  return ids
    .map(function (id) { return METHOD_DEFS[id]; })
    .filter(Boolean);
}

export function methodById(id) {
  return METHOD_DEFS[String(id || '')] || null;
}
