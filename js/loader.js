// Favmoney smart loading helper (vanilla, classic script, no deps).
// Blur veil + spinner only (no text); skeletons cover slow data; buttons cover slow actions.
// Usage: include <script src="js/loader.js"></script> in <head>, overlay div right after <body>.
// Data pages call FavLoader.pageReady() after first paint; fallback auto-hides on window.load.
(function () {
  var MIN_MS = 400, MAX_MS = 8000;
  var t0 = window.__favLoaderT0 || Date.now();
  var readyCalled = false, slowTimer = null, done = false;

  function $(id) { return document.getElementById(id); }

  function showSlow() {
    var ov = $('page-loader');
    if (!ov || done) return;
    // No text or toast by design — just reveal the icon-only retry.
    ov.classList.add('slow');
  }

  function hide() {
    if (done) return;
    done = true;
    if (slowTimer) clearTimeout(slowTimer);
    var ov = $('page-loader');
    var wait = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(function () {
      if (!ov) return;
      ov.classList.add('hide');
      ov.setAttribute('aria-hidden', 'true');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 450);
    }, wait);
  }

  function bindRetry() {
    var r = $('loader-retry');
    if (r && !r.dataset.bound) {
      r.dataset.bound = '1';
      r.addEventListener('click', function () {
        try { if (window.FavStats) {} } catch (e) {}
        location.reload();
      });
    }
  }

  // Boot: runs even before DOMContentLoaded (script in head + overlay after body).
  function boot() {
    bindRetry();
    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = setTimeout(showSlow, MAX_MS);
    // Failsafe: never trap the user behind the overlay.
    setTimeout(function () {
      if (!done) { showSlow(); }
      // Keep overlay with Retry visible; do NOT force-hide data skeletons.
    }, MAX_MS);
    if (document.readyState === 'complete') {
      scheduleAuto();
    } else {
      window.addEventListener('load', scheduleAuto);
      // Extra safety if load event never fires (CDN hang).
      setTimeout(scheduleAuto, MAX_MS + 1000);
    }
  }

  var autoScheduled = false;
  function scheduleAuto() {
    if (autoScheduled || done || readyCalled) return;
    autoScheduled = true;
    // Default pages (static landing): hide shortly after load so overlay never sticks
    // when a page forgets to call pageReady(). Data pages call hold()/pageReady().
    setTimeout(function () { if (!readyCalled && !done) hide(); }, 600);
  }

  var api = {
    pageStart: function () {
      window.__favLoaderT0 = window.__favLoaderT0 || Date.now();
      t0 = window.__favLoaderT0;
      bindRetry();
    },
    hold: function () {
      // Data page takes control: cancel auto-hide, wait for explicit pageReady().
      readyCalled = true;
      autoScheduled = true;
    },
    pageReady: function () {
      readyCalled = true;
      hide();
    },
    // Wrap an async button action: disable + spinner, restore after settle.
    // withButton(btn, function(){ return promise })
    withButton: function (btn, fn) {
      if (!btn) return fn();
      if (btn.disabled || btn.classList.contains('loading')) return;
      var orig = btn.innerHTML;
      btn.classList.add('loading');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      var sp = document.createElement('span');
      sp.className = 'spinner spinner-btn';
      sp.setAttribute('aria-hidden', 'true');
      btn.prepend(sp);
      function restore() {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        var s = btn.querySelector('.spinner-btn');
        if (s) { if (s.remove) s.remove(); else if (s.parentNode) s.parentNode.removeChild(s); }
        // keep any label changes the handler made; only restore if emptied
        if (!btn.innerHTML.trim()) btn.innerHTML = orig;
      }
      try {
        var r = fn(restore);
        if (r && typeof r.then === 'function') {
          r.then(function () { restore(); }, function () { restore(); });
        }
        return r;
      } catch (e) {
        restore();
        throw e;
      }
    },
    // Section skeleton helper: el gets .is-loading + aria-busy until ready.
    section: function (el, state) {
      if (!el) return;
      if (state === 'loading') {
        el.classList.add('is-loading');
        el.setAttribute('aria-busy', 'true');
      } else {
        el.classList.remove('is-loading');
        el.removeAttribute('aria-busy');
      }
    }
  };

  window.FavLoader = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
