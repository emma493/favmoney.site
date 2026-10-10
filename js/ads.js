/* Favmoney ads — banner pool controller (classic script, no modules).
 *
 * Mirrors the shortxx.live pool design: every page carries the same hidden
 * `.ads` pool of `data-ad-slot` spans (container + atoptions). The static
 * markup is the first impression; this module replays each slot's code on a
 * timer so long-lived tabs keep earning:
 *   - every 60 s of visible page time,
 * with a 30 s global floor between batches (never faster).
 * (shortxx also refreshes every 3rd video change — Favmoney has no swipe
 * feed, and every navigation loads fresh impressions anyway.)
 *
 * Serialized queue: all banner slots share the global `atOptions`, so slots
 * re-inject strictly one at a time — never overlapping, never mixed keys.
 * DOM injection only — never document.write (post-load write wipes the page).
 * Usage: <script defer src="js/ads.js"></script> (pool div must be in markup).
 */
(function () {
  'use strict';
  var WATCH_SECONDS_PER_BATCH = 60;
  var MIN_BATCH_GAP_MS = 30000;
  var TICK_MS = 5000;

  var slots = [];
  var queue = Promise.resolve();
  var watchAccum = 0;
  var lastBatchAt = 0;
  var batches = 0;

  function collectSlots() {
    var found = [];
    try {
      var els = document.querySelectorAll('[data-ad-slot]');
      for (var i = 0; i < els.length; i++) {
        (function (el) {
          var type = el.getAttribute('data-ad-type') || 'atoptions';
          if (type === 'container') {
            var src = el.getAttribute('data-ad-src') || '';
            var container = el.getAttribute('data-ad-container') || '';
            if (!src || !container) return;
            found.push({ el: el, type: type, src: src, container: container, async: el.getAttribute('data-ad-async') === '1' });
          } else {
            var key = el.getAttribute('data-ad-key') || '';
            var host = el.getAttribute('data-ad-host') || 'https://www.highrevenueformat.com';
            var w = parseInt(el.getAttribute('data-ad-w') || '0', 10) || 0;
            var h = parseInt(el.getAttribute('data-ad-h') || '0', 10) || 0;
            if (!key) return;
            found.push({ el: el, type: 'atoptions', key: key, host: host, w: w, h: h });
          }
        })(els[i]);
      }
    } catch (e) {}
    return found;
  }

  function injectScript(container, src, isAsync) {
    return new Promise(function (resolve) {
      try {
        var s = document.createElement('script');
        s.type = 'text/javascript';
        if (isAsync) s.async = true;
        try { s.setAttribute('data-cfasync', 'false'); } catch (e) {}
        s.src = src;
        var done = false;
        var finish = function () { if (!done) { done = true; resolve(); } };
        s.onload = function () { setTimeout(finish, 250); };
        s.onerror = finish;
        setTimeout(finish, 8000);
        container.appendChild(s);
      } catch (e) {
        resolve();
      }
    });
  }

  function refreshSlot(s) {
    return (async function () {
      try {
        if (!document.contains(s.el)) return;
        s.el.innerHTML = '';
        if (s.type === 'container') {
          var box = document.createElement('div');
          box.id = s.container;
          s.el.appendChild(box);
          await injectScript(s.el, s.src, s.async);
        } else {
          try {
            window.atOptions = { key: s.key, format: 'iframe', height: s.h, width: s.w, params: {} };
          } catch (e) {}
          await injectScript(s.el, s.host + '/' + s.key + '/invoke.js', false);
        }
      } catch (e) {}
    })();
  }

  function floorOpen() {
    try {
      return Date.now() - lastBatchAt >= MIN_BATCH_GAP_MS;
    } catch (e) {
      return true;
    }
  }

  function runBatch() {
    lastBatchAt = Date.now();
    watchAccum = 0;
    batches++;
    slots.forEach(function (s) {
      queue = queue.then(function () { return refreshSlot(s); });
    });
    queue = queue.catch(function () {});
  }

  function pageVisible() {
    try {
      return !document.hidden;
    } catch (e) {
      return true;
    }
  }

  function boot() {
    slots = collectSlots();
    if (!slots.length) return;
    // The static markup is the first impression — the floor counts from here.
    lastBatchAt = Date.now();
    setInterval(function () {
      try {
        if (!pageVisible()) return;
        watchAccum += TICK_MS / 1000;
        if (watchAccum >= WATCH_SECONDS_PER_BATCH && floorOpen()) runBatch();
      } catch (e) {}
    }, TICK_MS);
    // Manual trigger (console/debug): window.favAdsRefresh().
    window.favAdsRefresh = function () {
      if (floorOpen()) runBatch();
      return batches;
    };
    window.favAdsStats = function () {
      return { batches: batches, slots: slots.length, watchAccum: watchAccum };
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
