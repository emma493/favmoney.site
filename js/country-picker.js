// Reusable searchable country picker with flags (flagcdn, no key).
// Usage: mountCountryPicker(el, { value, placeholder, onSelect })
// REQUIRED pattern: value starts as '' and shows "Choose country".
import { COUNTRIES, flagUrl } from './countries.js';

export function mountCountryPicker(el, opts) {
  var o = opts || {};
  var value = o.value || ''; // '' = nothing chosen (required)
  var onSelect = typeof o.onSelect === 'function' ? o.onSelect : function () {};
  var placeholder = o.placeholder || 'Choose country';

  el.classList.add('fav-country');
  el.innerHTML =
    '<button type="button" class="fav-country-btn" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="fav-country-val">Choose country</span>' +
      '<span class="fav-country-chev">▾</span>' +
    '</button>' +
    '<div class="fav-country-pop" role="listbox" hidden>' +
      '<input class="fav-country-search" type="text" placeholder="Search country…" autocomplete="off" aria-label="Search country" />' +
      '<div class="fav-country-list"></div>' +
    '</div>';

  var btn = el.querySelector('.fav-country-btn');
  var val = el.querySelector('.fav-country-val');
  var pop = el.querySelector('.fav-country-pop');
  var search = el.querySelector('.fav-country-search');
  var list = el.querySelector('.fav-country-list');

  function paintVal() {
    var hit = null;
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (COUNTRIES[i].code === value) { hit = COUNTRIES[i]; break; }
    }
    if (!hit) {
      val.innerHTML = '<span class="fav-country-ph">' + placeholder + '</span>';
    } else {
      val.innerHTML = '<img src="' + flagUrl(hit.code, 40) + '" alt="" loading="lazy" /> ' +
        '<span>' + hit.name + ' · ' + hit.currency + '</span>';
    }
  }

  function paintList(q) {
    var query = String(q || '').trim().toLowerCase();
    var rows = COUNTRIES.filter(function (c) {
      if (!query) return true;
      return c.name.toLowerCase().indexOf(query) >= 0 || c.code.toLowerCase() === query || c.currency.toLowerCase().indexOf(query) >= 0;
    }).slice(0, 249);
    if (!rows.length) {
      list.innerHTML = '<div class="fav-country-empty">No match.</div>';
      return;
    }
    list.innerHTML = rows.map(function (c) {
      var sel = c.code === value ? ' sel' : '';
      return '<button type="button" role="option" aria-selected="' + (c.code === value) + '" class="fav-country-row' + sel + '" data-code="' + c.code + '">' +
        '<img src="' + flagUrl(c.code, 40) + '" alt="" loading="lazy" />' +
        '<span class="fav-country-name">' + c.name + '</span>' +
        '<span class="fav-country-cur">' + c.currency + '</span></button>';
    }).join('');
  }

  function open() {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    paintList(search.value);
    setTimeout(function () { try { search.focus(); } catch (_) {} }, 0);
  }
  function close() {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function () {
    if (pop.hidden) open(); else close();
  });
  search.addEventListener('input', function () { paintList(search.value); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-code]');
    if (!b) return;
    e.preventDefault();
    value = b.dataset.code;
    paintVal();
    paintList(search.value);
    close();
    btn.classList.remove('fav-country-error');
    var err = el.parentElement && el.parentElement.querySelector('[data-country-error]');
    if (err) err.style.display = 'none';
    onSelect(value);
  });
  document.addEventListener('click', function (e) {
    if (!el.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  paintVal();
  paintList('');

  return {
    get value() { return value; },
    set(v) { value = v || ''; paintVal(); paintList(search.value); },
    markError: function () {
      btn.classList.add('fav-country-error');
      var err = el.parentElement && el.parentElement.querySelector('[data-country-error]');
      if (err) err.style.display = '';
    }
  };
}
