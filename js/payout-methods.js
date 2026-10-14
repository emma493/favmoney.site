// Favmoney payout rails — per-country methods with global defaults.
// Wallet/cashouts stay USD internally; methods are display + routing metadata.
// Defaults (every country): PayPal + crypto (Bitcoin, Litecoin, Dogecoin).
// Overrides add local rails (bank / mobile money) for specific countries.
// Cashout docs carry { method, methodKind, country } for ops routing.
//
// Each method declares `fields` (rendered as separate inputs) plus a
// `validate(values)` check. validate returns { ok:true } or
// { ok:false, msg } with a user-facing error. Pure — unit-testable.

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

function hasName(v) {
  var s = String(v || '').trim().replace(/[^A-Za-z]/g, '');
  return s.length >= 2;
}

function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

// Mobile-money numbers: 9–13 digits after stripping spaces, dashes and an
// optional leading +. Covers local (e.g. 0803…) and intl (e.g. +234…) forms.
function isMomoNumber(v) {
  var d = digitsOnly(v);
  return d.length >= 9 && d.length <= 13;
}

function isBankNumber(v) {
  var d = digitsOnly(v);
  return d.length >= 8 && d.length <= 20;
}

function isBtc(v) {
  var s = String(v || '').trim();
  return /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(s);
}

function isLtc(v) {
  var s = String(v || '').trim();
  return /^(ltc1[a-zA-HJ-NP-Z0-9]{25,62}|[LM][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(s);
}

function isDoge(v) {
  var s = String(v || '').trim();
  return /^D[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s);
}

function emailField(kind) {
  var label = kind === 'visa' ? 'Cardholder email' : 'PayPal email';
  return [{ key: 'email', label: label, placeholder: 'you@example.com', inputmode: 'email' }];
}

function emailValidate(values, methodName) {
  if (!isEmail(values.email)) return { ok: false, msg: 'Enter a valid ' + methodName + ' email address.' };
  return { ok: true };
}

function momoFields(numLabel, numPlaceholder) {
  return [
    { key: 'number', label: numLabel, placeholder: numPlaceholder, inputmode: 'tel' },
    { key: 'name', label: 'Account name', placeholder: 'Full name on the account', inputmode: 'text' }
  ];
}

function momoValidate(values, methodName) {
  if (!isMomoNumber(values.number)) {
    return { ok: false, msg: methodName + ' number must be 9–13 digits (spaces and + allowed). An email is not a valid number.' };
  }
  if (!hasName(values.name)) {
    return { ok: false, msg: 'Enter the account name on the ' + methodName + ' account.' };
  }
  return { ok: true };
}

export const METHOD_DEFS = {
  'PayPal': {
    id: 'PayPal', kind: 'paypal', sec: 'pop',
    img: 'assets/cashout/paypal.webp', min: 20,
    denoms: [20, 30, 50, 75, 100, 200],
    destLabel: 'Destination (PayPal email)',
    destPlaceholder: 'you@example.com',
    fields: emailField('paypal'),
    validate: function (v) { return emailValidate(v, 'PayPal'); },
    pack: function (v) { return String(v.email || '').trim(); }
  },
  'Visa Prepaid': {
    id: 'Visa Prepaid', kind: 'visa', sec: 'pop',
    img: 'assets/cashout/visa.webp', min: 30,
    denoms: [30, 50, 75, 100, 150, 200],
    destLabel: 'Destination (cardholder email)',
    destPlaceholder: 'you@example.com',
    fields: emailField('visa'),
    validate: function (v) { return emailValidate(v, 'cardholder'); },
    pack: function (v) { return String(v.email || '').trim(); }
  },
  'Bitcoin': {
    id: 'Bitcoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/bitcoin.png', min: 25,
    denoms: [25, 50, 100, 200],
    destLabel: 'Destination (BTC address)',
    destPlaceholder: 'bc1…',
    fields: [{ key: 'address', label: 'BTC address', placeholder: 'bc1…', inputmode: 'text' }],
    validate: function (v) {
      if (!isBtc(v.address)) return { ok: false, msg: 'Enter a valid BTC address (bc1… / 1… / 3…). An email is not a wallet address.' };
      return { ok: true };
    },
    pack: function (v) { return String(v.address || '').trim(); }
  },
  'Litecoin': {
    id: 'Litecoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/litecoin.png', min: 25,
    denoms: [25, 50, 100, 200],
    destLabel: 'Destination (LTC address)',
    destPlaceholder: 'ltc1…',
    fields: [{ key: 'address', label: 'LTC address', placeholder: 'ltc1…', inputmode: 'text' }],
    validate: function (v) {
      if (!isLtc(v.address)) return { ok: false, msg: 'Enter a valid LTC address (ltc1… / L… / M…). An email is not a wallet address.' };
      return { ok: true };
    },
    pack: function (v) { return String(v.address || '').trim(); }
  },
  'Dogecoin': {
    id: 'Dogecoin', kind: 'crypto', sec: 'crypto',
    img: 'assets/cashout/dogecoin.png', min: 25,
    denoms: [25, 50, 100, 200],
    destLabel: 'Destination (DOGE address)',
    destPlaceholder: 'D…',
    fields: [{ key: 'address', label: 'DOGE address', placeholder: 'D…', inputmode: 'text' }],
    validate: function (v) {
      if (!isDoge(v.address)) return { ok: false, msg: 'Enter a valid DOGE address (starts with D). An email is not a wallet address.' };
      return { ok: true };
    },
    pack: function (v) { return String(v.address || '').trim(); }
  },
  'Bank Transfer': {
    id: 'Bank Transfer', kind: 'bank', sec: 'local',
    img: null, min: 30,
    denoms: [30, 50, 75, 100, 200],
    destLabel: 'Destination (bank details)',
    destPlaceholder: '',
    fields: [
      { key: 'bank', label: 'Bank name', placeholder: 'e.g. GTBank', inputmode: 'text' },
      { key: 'number', label: 'Account number', placeholder: 'e.g. 0123456789', inputmode: 'numeric' },
      { key: 'name', label: 'Account name', placeholder: 'Full name on the account', inputmode: 'text' }
    ],
    validate: function (v) {
      if (String(v.bank || '').trim().length < 2) return { ok: false, msg: 'Enter the bank name.' };
      if (!isBankNumber(v.number)) return { ok: false, msg: 'Account number must be 8–20 digits.' };
      if (!hasName(v.name)) return { ok: false, msg: 'Enter the account name on the bank account.' };
      return { ok: true };
    },
    pack: function (v) {
      return 'Bank: ' + String(v.bank || '').trim() + ' | Acct: ' + digitsOnly(v.number) + ' | Name: ' + String(v.name || '').trim();
    }
  },
  'Mobile Money': {
    id: 'Mobile Money', kind: 'momo', sec: 'local',
    img: null, min: 30,
    denoms: [30, 50, 75, 100, 200],
    destLabel: 'Destination (mobile money)',
    destPlaceholder: '',
    fields: momoFields('MoMo number', 'e.g. 0803 000 0000'),
    validate: function (v) { return momoValidate(v, 'Mobile Money'); },
    pack: function (v) { return 'MoMo: ' + String(v.number || '').trim() + ' | Name: ' + String(v.name || '').trim(); }
  },
  'MTN MoMo': {
    id: 'MTN MoMo', kind: 'momo', sec: 'local',
    img: null, min: 30,
    denoms: [30, 50, 75, 100, 200],
    destLabel: 'Destination (MTN MoMo)',
    destPlaceholder: '',
    fields: momoFields('MTN MoMo number', 'e.g. 024 000 0000'),
    validate: function (v) { return momoValidate(v, 'MTN MoMo'); },
    pack: function (v) { return 'MTN MoMo: ' + String(v.number || '').trim() + ' | Name: ' + String(v.name || '').trim(); }
  },
  'M-Pesa': {
    id: 'M-Pesa', kind: 'momo', sec: 'local',
    img: null, min: 30,
    denoms: [30, 50, 75, 100, 200],
    destLabel: 'Destination (M-Pesa)',
    destPlaceholder: '',
    fields: momoFields('M-Pesa number', 'e.g. 07XX 000 000'),
    validate: function (v) { return momoValidate(v, 'M-Pesa'); },
    pack: function (v) { return 'M-Pesa: ' + String(v.number || '').trim() + ' | Name: ' + String(v.name || '').trim(); }
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

// Validate raw field values for a method. Always returns { ok, msg? }.
export function validateDest(method, values) {
  try {
    if (method && typeof method.validate === 'function') return method.validate(values || {});
  } catch (_) {}
  var s = '';
  try {
    s = Object.keys(values || {}).map(function (k) { return String(values[k] || '').trim(); }).join(' ').trim();
  } catch (_) {}
  if (s.length < 4) return { ok: false, msg: 'Add a destination.' };
  return { ok: true };
}

// Pack validated fields into the single `dest` string stored on the cashout doc.
export function packDest(method, values) {
  try {
    if (method && typeof method.pack === 'function') return method.pack(values || {});
  } catch (_) {}
  try {
    return Object.keys(values || {}).map(function (k) { return String(values[k] || '').trim(); }).filter(Boolean).join(' | ');
  } catch (_) { return ''; }
}
