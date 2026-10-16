// Favmoney shared rewarded-view controller (ES module, no dependencies).
//
// One active view at a time per controller instance:
//   Visit click -> ad opens in a NEW TAB (never iframed) -> timestamp timer
//   runs in the background -> the tab handle is polled (a closed tab pauses
//   and does NOT count) -> returning early shows a paused bar + Resume ->
//   time met triggers the page's onCredit() (auto-claim / auto-grant) ->
//   credited screen + Close. There is no claim button by design.
//
// Timestamps (not ticks) drive progress, so hidden-tab timer throttling and
// reloads can neither inflate nor lose time. localStorage resume survives
// reloads. Honest limit: this verifies tab-open + elapsed time, not eyeballs.

export const RV_IDLE = 'idle';
export const RV_VIEWING = 'viewing';
export const RV_PAUSED = 'paused';
export const RV_CREDITING = 'crediting';
export const RV_CREDITED = 'credited';

function memGet(key) {
  try {
    var raw = localStorage.getItem('fav_rv_' + key);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.id && Number(o.secs) > 0) return o;
  } catch (_) {}
  return null;
}
function memPut(key, s) {
  try {
    if (!s || s.status === RV_IDLE || s.status === RV_CREDITED) {
      localStorage.removeItem('fav_rv_' + key);
    } else {
      localStorage.setItem('fav_rv_' + key, JSON.stringify({
        id: s.id, url: s.url, secs: s.secs, accumMs: s.accumMs, status: s.status
      }));
    }
  } catch (_) {}
}
function memClear(key) {
  try { localStorage.removeItem('fav_rv_' + key); } catch (_) {}
}

export function createRewardedView(opts) {
  opts = opts || {};
  var key = String(opts.key || 'default');
  var pollMs = Math.max(500, Number(opts.pollMs || 1000));
  var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
  var onCredit = typeof opts.onCredit === 'function' ? opts.onCredit : function () {
    return Promise.resolve({ ok: false, retryable: true });
  };
  var notify = typeof opts.notify === 'function' ? opts.notify : function () {};

  var sess = {
    status: RV_IDLE, id: null, url: null, secs: 0,
    accumMs: 0, resumeAt: 0, amount: 0, error: null, tabClosed: false
  };
  var handle = null, timer = null, crediting = false;

  function elapsed() {
    var a = Number(sess.accumMs || 0);
    if (sess.status === RV_VIEWING && sess.resumeAt) a += Math.max(0, Date.now() - sess.resumeAt);
    return a;
  }
  function snapshot() {
    return {
      status: sess.status, id: sess.id, url: sess.url, secs: sess.secs,
      accumMs: elapsed(), requiredMs: sess.secs * 1000,
      tabClosed: sess.tabClosed, amount: sess.amount, error: sess.error
    };
  }
  function emit() {
    memPut(key, {
      status: sess.status, id: sess.id, url: sess.url,
      secs: sess.secs, accumMs: sess.status === RV_VIEWING ? elapsed() : sess.accumMs
    });
    try { onChange(snapshot()); } catch (_) {}
  }
  function openTab(url) {
    var w = null;
    try { w = window.open(url, '_blank', 'noopener,noreferrer'); } catch (_) { w = null; }
    if (w) { try { w.opener = null; } catch (_) {} }
    return w;
  }
  function tabAlive() {
    if (!handle) return false;
    try { return !handle.closed; } catch (_) { return false; }
  }

  function start(item) {
    if (sess.status === RV_VIEWING || sess.status === RV_PAUSED || sess.status === RV_CREDITING) {
      return { ok: false, reason: 'busy' };
    }
    if (!item || !item.id || !item.url || !(Number(item.secs) > 0)) {
      return { ok: false, reason: 'unknown' };
    }
    handle = openTab(item.url);
    sess = {
      status: RV_VIEWING, id: String(item.id), url: String(item.url),
      secs: Math.floor(Number(item.secs)), accumMs: 0, resumeAt: Date.now(),
      amount: 0, error: null, tabClosed: false
    };
    if (!handle) {
      // Popup blocked: nothing verified yet — sit paused until the user taps
      // Resume (a real-gesture click usually succeeds where script open failed).
      sess.status = RV_PAUSED;
      sess.resumeAt = 0;
      sess.error = 'Popup blocked — tap Resume to open the ad.';
    }
    ensureTick();
    emit();
    return { ok: true, blocked: !handle };
  }

  function pause(auto) {
    if (sess.status !== RV_VIEWING) return;
    sess.accumMs = elapsed();
    sess.resumeAt = 0;
    sess.status = RV_PAUSED;
    emit();
  }

  function resume() {
    if (sess.status === RV_CREDITING || sess.status === RV_CREDITED) return { ok: false };
    if (sess.status !== RV_PAUSED && sess.status !== RV_VIEWING) return { ok: false };
    if (sess.id && elapsed() >= sess.secs * 1000) { complete(); return { ok: true }; }
    if (handle && tabAlive()) {
      try { handle.focus(); } catch (_) {}
      sess.tabClosed = false;
    } else {
      handle = openTab(sess.url);
      if (!handle) {
        sess.error = 'Popup blocked — allow popups, then Resume again.';
        emit();
        return { ok: false, reason: 'blocked' };
      }
      sess.tabClosed = false;
    }
    sess.status = RV_VIEWING;
    sess.resumeAt = Date.now();
    sess.error = null;
    ensureTick();
    emit();
    return { ok: true };
  }

  // Raw-anchor path: the user tapped a real link (never blocked) so no tab
  // handle exists. Count elapsed time honestly WITHOUT close detection —
  // server caps and per-ad cooldowns bound this weaker mode.
  function assumeOpen() {
    if (sess.status !== RV_PAUSED) return { ok: false };
    if (sess.id && elapsed() >= sess.secs * 1000) { complete(); return { ok: true }; }
    handle = null;
    sess.tabClosed = false;
    sess.status = RV_VIEWING;
    sess.resumeAt = Date.now();
    sess.error = null;
    ensureTick();
    emit();
    return { ok: true };
  }

  function abandon() {    sess = {
      status: RV_IDLE, id: null, url: null, secs: 0,
      accumMs: 0, resumeAt: 0, amount: 0, error: null, tabClosed: false
    };
    handle = null;
    memClear(key);
    try { onChange(snapshot()); } catch (_) {}
  }

  function busy() {
    return sess.status === RV_VIEWING || sess.status === RV_PAUSED || sess.status === RV_CREDITING;
  }

  function hasHandle() {
    if (!handle) return false;
    try { return !handle.closed; } catch (_) { return false; }
  }

  async function complete() {
    if (!sess.id || !sess.secs) return;
    if (sess.status === RV_CREDITED || crediting) return;
    if (elapsed() < sess.secs * 1000) return;
    // Freeze progress first: a failed credit must resume from full time,
    // never restart the timer from zero.
    sess.accumMs = elapsed();
    crediting = true;
    sess.status = RV_CREDITING;
    sess.resumeAt = 0;
    emit();
    var r = null;
    try { r = await onCredit(snapshot()); }
    catch (_) { r = { ok: false, retryable: true }; }
    crediting = false;
    if (r && r.ok) {
      sess.status = RV_CREDITED;
      sess.amount = Number(r.amount || 0);
      sess.error = null;
      memClear(key);
      emit();
      return;
    }
    if (r && r.retryable) {
      sess.status = RV_PAUSED;
      sess.error = (r && r.message) || 'Claim failed — tap Resume to retry.';
      emit();
      if (r && r.message) { try { notify(r.message); } catch (_) {} }
      return;
    }
    // Terminal failure (capped / cooldown / unknown): nothing left to earn.
    var msg = (r && r.message) || 'Claim failed.';
    try { notify(msg); } catch (_) {}
    abandon();
  }

  function tick() {
    if (sess.status !== RV_VIEWING) return;
    if (handle && !tabAlive()) {
      sess.tabClosed = true;
      pause(true);
      return;
    }
    if (sess.id && elapsed() >= sess.secs * 1000) { complete(); return; }
    emit();
  }

  function ensureTick() {
    if (timer) return;
    try { timer = setInterval(tick, pollMs); } catch (_) {}
  }

  function restore() {
    var s = memGet(key);
    if (!s) return null;
    // The tab handle never survives a reload: resume paused. Accumulated time
    // is kept; Resume re-opens the tab. A mid-credit reload retries on retry().
    sess = {
      status: RV_PAUSED, id: String(s.id), url: String(s.url),
      secs: Math.floor(Number(s.secs)), accumMs: Number(s.accumMs || 0),
      resumeAt: 0, amount: 0, error: null, tabClosed: true
    };
    handle = null;
    ensureTick();
    emit();
    return snapshot();
  }

  function retry() {
    if (!sess.id) return false;
    if (sess.status === RV_CREDITING) { complete(); return true; }
    if (sess.status === RV_PAUSED && elapsed() >= sess.secs * 1000) { complete(); return true; }
    return false;
  }

  function destroy() {
    if (timer) { try { clearInterval(timer); } catch (_) {} timer = null; }
  }

  try {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (sess.status !== RV_VIEWING) return;
      // Back on our page: tab still open + time met -> credit now. Time
      // short -> pause and show the paused bar + Resume (per spec).
      if (handle && !tabAlive()) { sess.tabClosed = true; pause(true); return; }
      if (sess.id && elapsed() >= sess.secs * 1000) { complete(); return; }
      pause(false);
    });
  } catch (_) {}
  try {
    window.addEventListener('beforeunload', function () {
      if (sess.status === RV_VIEWING) {
        sess.accumMs = elapsed();
        sess.resumeAt = 0;
        sess.status = RV_PAUSED;
        memPut(key, {
          status: sess.status, id: sess.id, url: sess.url,
          secs: sess.secs, accumMs: sess.accumMs
        });
      }
    });
  } catch (_) {}

  ensureTick();
  return {
    start, resume, abandon, busy, hasHandle,
    snapshot: snapshot, restore, retry, destroy, assumeOpen,
    states: { IDLE: RV_IDLE, VIEWING: RV_VIEWING, PAUSED: RV_PAUSED, CREDITING: RV_CREDITING, CREDITED: RV_CREDITED }
  };
}
