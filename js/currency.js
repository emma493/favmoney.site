// Favmoney currency — display-only conversion. Wallet/proofs/cashouts stay USD.
// Preference: localStorage (guest) -> users/{uid} {country, currency} (signed in).
import { COUNTRY_MAP, COUNTRIES } from './countries.js';

const LS_KEY = 'favmoney_country';
const RATE_CACHE_KEY = 'favmoney_rates_v1';

function readLS() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && COUNTRY_MAP[o.country]) return o;
    return null;
  } catch (_) { return null; }
}

export function getStoredCountry() {
  return readLS();
}

export function setStoredCountry(code) {
  var c = COUNTRY_MAP[String(code || '').toUpperCase()];
  if (!c) return null;
  var o = { country: c.code, currency: c.currency };
  try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (_) {}
  try { window.__favCountry = o; } catch (_) {}
  try { document.dispatchEvent(new CustomEvent('fav-country', { detail: o })); } catch (_) {}
  return o;
}

export function currentCountry() {
  try {
    if (window.__favCountry && COUNTRY_MAP[window.__favCountry.country]) return window.__favCountry;
  } catch (_) {}
  var ls = readLS();
  if (ls) {
    try { window.__favCountry = ls; } catch (_) {}
    return ls;
  }
  return { country: 'US', currency: 'USD' };
}

export function setMemoryCountry(code, currency) {
  var cc = String(code || 'US').toUpperCase();
  var o = { country: COUNTRY_MAP[cc] ? cc : 'US', currency: currency || (COUNTRY_MAP[cc] ? COUNTRY_MAP[cc].currency : 'USD') };
  try { window.__favCountry = o; } catch (_) {}
  return o;
}

function liveRates() {
  try {
    var raw = localStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return {};
    var o = JSON.parse(raw);
    if (!o || !o.at || Date.now() - o.at > 12 * 3600000) return {};
    return o.rates || {};
  } catch (_) { return {}; }
}

function rateFor(currency) {
  var lr = liveRates();
  if (lr && lr[currency]) {
    var v = Number(lr[currency]);
    if (v > 0 && v < 1000000) return v;
  }
  var hit = null;
  for (var i = 0; i < COUNTRIES.length; i++) {
    if (COUNTRIES[i].currency === currency) { hit = COUNTRIES[i]; break; }
  }
  return hit ? hit.rate : 1;
}

function decimalsFor(currency) {
  if (currency === 'JPY' || currency === 'KRW' || currency === 'VND' || currency === 'IDR' || currency === 'UGX' || currency === 'GNF') return 0;
  return 2;
}

// Convert USD -> target currency amount (number).
export function convertUSD(usd, currency) {
  var cur = currency || currentCountry().currency || 'USD';
  var r = rateFor(cur);
  return Math.round(Number(usd || 0) * r * 100) / 100;
}

// Format a USD amount in the active (or given) currency. Pure.
export function formatUSD(usd, currency) {
  var cur = currency || currentCountry().currency || 'USD';
  var sym = cur;
  for (var i = 0; i < COUNTRIES.length; i++) {
    if (COUNTRIES[i].currency === cur) { sym = COUNTRIES[i].symbol; break; }
  }
  if (cur === 'USD') sym = '$';
  var v = convertUSD(usd, cur);
  var dec = decimalsFor(cur);
  var str = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return sym + str;
}

// Symbol for a currency code (e.g. NGN -> ₦). Pure.
export function symbolFor(currency) {
  var cur = currency || currentCountry().currency || 'USD';
  if (cur === 'USD') return '$';
  for (var i = 0; i < COUNTRIES.length; i++) {
    if (COUNTRIES[i].currency === cur) return COUNTRIES[i].symbol;
  }
  return cur + ' ';
}

// Adopt a Firestore user doc's country into memory + localStorage.
// Call after auth on every page so task rates follow the profile country
// even on a new device where localStorage is empty. Never throws.
export function adoptUserCountry(doc) {
  try {
    var code = doc && doc.country && COUNTRY_MAP[doc.country] ? doc.country : (currentCountry().country || 'US');
    var o = setMemoryCountry(code, (doc && doc.currency) || (COUNTRY_MAP[code] || {}).currency || 'USD');
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (_) {}
    return o;
  } catch (_) { return currentCountry(); }
}

// Paint every [data-usd] element as converted money. Usage:
//   <b data-usd="0.15"></b>  ->  ₵2.33 / $0.15 depending on country.
// Re-runs automatically when the country or live rates change.
export function paintMoney(scope) {
  try {
    var root = scope || document;
    var els = root.querySelectorAll('[data-usd]');
    for (var i = 0; i < els.length; i++) {
      var v = Number(els[i].getAttribute('data-usd'));
      if (!isFinite(v)) continue;
      els[i].textContent = formatUSD(v);
    }
  } catch (_) {}
}

try {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { paintMoney(); });
    } else {
      paintMoney();
    }
    document.addEventListener('fav-country', function () { paintMoney(); });
    document.addEventListener('fav-rates', function () { paintMoney(); });
  }
} catch (_) {}
export async function refreshRates(force) {
  try {
    // Cache-first: liveRates() already enforces the 12h TTL on read, so a
    // fresh cache means no network at all (repeat visits stay instant).
    try {
      var raw0 = localStorage.getItem(RATE_CACHE_KEY);
      if (!force && raw0) {
        var c0 = JSON.parse(raw0);
        if (c0 && c0.at && c0.rates && (Date.now() - Number(c0.at) < 12 * 3600000)) {
          try { document.dispatchEvent(new CustomEvent('fav-rates')); } catch (_) {}
          return true;
        }
      }
    } catch (_) {}
    var ctl = null, timer = 0;
    try {
      if (typeof AbortController !== 'undefined') {
        ctl = new AbortController();
        timer = setTimeout(function () { try { ctl.abort(); } catch (_) {} }, 6000);
      }
    } catch (_) {}
    var res = await fetch('https://api.frankfurter.app/latest?from=USD', ctl ? { signal: ctl.signal } : undefined);
    try { if (timer) clearTimeout(timer); } catch (_) {}
    if (!res.ok) return false;
    var j = await res.json();
    if (!j || !j.rates) return false;
    try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ at: Date.now(), rates: j.rates })); } catch (_) {}
    try { document.dispatchEvent(new CustomEvent('fav-rates')); } catch (_) {}
    return true;
  } catch (_) { return false; }
}
