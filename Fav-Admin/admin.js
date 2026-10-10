// Fav-Admin ops console (single seat). Requires the firestore.rules in this
// repo to be pasted in Console: isAdmin() unlocks cross-user reads, bounded
// wallet adjusts (<= $100 + audit proof), and cashout review -> paid|rejected.
// Auth gate: first signed-in user claims admin/owner forever; everyone else
// sees Access denied. No TOTP yet — see System view hardening notes.
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../js/firebase.js';
import {
  FAUCET_AMOUNT, FAUCET_INTERVAL_MS, FAUCET_DAILY_CAP,
  PTC_DAILY_CAP, PTC_MIN_PAY, PTC_MAX_PAY,
  DIAMOND_COST_SPIN, DIAMOND_COST_QUIZ,
  INVEST_BASE_APR, INVEST_BOOST_APR, INVEST_MAX_STAKE,
  REWARD_TIERS, REWARD_TRACKS
} from '../js/firebase.js';
import { PTC_CATALOG, PTC_SLOT_MS } from '../js/ptc-catalog.js';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  query, where, getDocs, limit, updateDoc, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

if (window.FavLoader) FavLoader.hold();
(function () {
  var me = null, loaded = {};
  var toast = document.getElementById('toast'), tm = null;
  function show(m) { toast.textContent = m; toast.classList.add('show'); clearTimeout(tm); tm = setTimeout(function () { toast.classList.remove('show'); }, 3400); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n, d) { return '$' + Number(n || 0).toFixed(d == null ? 2 : d); }
  function tsMs(at) {
    try {
      if (at == null) return 0;
      if (typeof at === 'number') return at > 1e12 ? at : at * 1000;
      if (typeof at.seconds === 'number') return at.seconds * 1000;
      var t = new Date(at).getTime();
      return isNaN(t) ? 0 : t;
    } catch (_) { return 0; }
  }
  function dayStr(ms) { try { return new Date(ms).toISOString().slice(0, 10); } catch (_) { return ''; } }
  function rel(ms) {
    if (!ms) return '—';
    var d = Math.max(0, Math.round((Date.now() - ms) / 864e5));
    if (d === 0) return 'today'; if (d === 1) return '1d ago'; if (d < 30) return d + 'd ago';
    return Math.floor(d / 30) + 'mo ago';
  }
  function clock(ms) {
    ms = Math.max(0, ms); var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return h > 0 ? p(h) + ':' + p(m) + ':' + p(ss) : p(m) + ':' + p(ss);
  }
  function ready() { if (window.FavLoader) FavLoader.pageReady(); }
  function err(id, msg) {
    var e = document.getElementById(id);
    if (!e) return;
    if (!msg) { e.classList.remove('show'); e.textContent = ''; return; }
    e.textContent = msg; e.classList.add('show');
  }
  function gateView(id) {
    ['view-signin', 'view-claim', 'view-denied'].forEach(function (v) {
      document.getElementById(v).style.display = v === id ? '' : 'none';
    });
    document.title = 'Fav-Admin · ' + (id === 'view-claim' ? 'Claim seat' : id === 'view-denied' ? 'Denied' : 'Sign in');
  }

  /* ---------- gate ---------- */
  async function seatOf() {
    try {
      var s = await getDoc(doc(db, 'admin', 'owner'));
      return s.exists() ? s.data() : null;
    } catch (_) { return { __unreadable: true }; }
  }
  async function enter(user) {
    me = user;
    document.body.classList.add('authed');
    document.title = 'Fav-Admin · Overview';
    document.getElementById('ad-me').textContent = (user.email || user.uid) + ' · seat owner';
    showView('overview');
    ready();
  }
  try {
    onAuthStateChanged(auth, async function (user) {
      if (!user) { me = null; document.body.classList.remove('authed'); gateView('view-signin'); ready(); return; }
      var seat = await seatOf();
      if (seat && seat.__unreadable) {
        // Rules not pasted yet (or not owner): owner get fails closed.
        document.body.classList.remove('authed');
        gateView('view-denied');
        document.getElementById('denied-sub').textContent = 'Cannot verify the seat. Paste the repo firestore.rules, then sign in with the owner account.';
        ready(); return;
      }
      if (!seat) { gateView('view-claim'); ready(); return; }
      if (seat.uid === user.uid) { enter(user); return; }
      document.body.classList.remove('authed');
      gateView('view-denied');
      document.getElementById('denied-sub').textContent = 'This account does not own the admin seat.';
      ready();
    });
  } catch (_) { gateView('view-signin'); ready(); }

  async function doSignin() {
    err('si-err');
    var em = document.getElementById('si-email').value.trim(), pw = document.getElementById('si-pass').value;
    if (!em || !pw) { err('si-err', 'Enter email and password.'); return; }
    try { await signInWithEmailAndPassword(auth, em, pw); }
    catch (e) { err('si-err', 'Sign-in failed — check credentials.'); }
  }
  async function doClaim() {
    err('su-err');
    var em = document.getElementById('su-email').value.trim(), pw = document.getElementById('su-pass').value;
    if (!em || pw.length < 8) { err('su-err', 'Email + 8-character password required.'); return; }
    try {
      var cred = await createUserWithEmailAndPassword(auth, em, pw);
      await setDoc(doc(db, 'admin', 'owner'), { uid: cred.user.uid, email: em, createdAt: serverTimestamp(), totpSecret: null });
      show('Seat claimed.');
      enter(cred.user);
    } catch (e) { err('su-err', 'Claim failed — seat may already be taken.'); }
  }
  document.getElementById('si-go').addEventListener('click', doSignin);
  document.getElementById('su-go').addEventListener('click', doClaim);
  document.getElementById('to-claim').addEventListener('click', function () { err('si-err'); gateView('view-claim'); });
  document.getElementById('to-signin').addEventListener('click', function () { err('su-err'); gateView('view-signin'); });
  document.getElementById('denied-out').addEventListener('click', function () { try { signOut(auth); } catch (_) {} });
  document.getElementById('ad-logout').addEventListener('click', function () { try { signOut(auth); } catch (_) {} });
  [['si-email', doSignin], ['si-pass', doSignin], ['su-email', doClaim], ['su-pass', doClaim]].forEach(function (t) {
    document.getElementById(t[0]).addEventListener('keydown', function (e) { if (e.key === 'Enter') t[1](); });
  });

  /* ---------- router ---------- */
  function showView(v) {
    document.querySelectorAll('#ad-nav button[data-view], #ad-tabs button[data-view]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    document.querySelectorAll('.ad-view').forEach(function (s) { s.classList.remove('on'); });
    document.getElementById('v-' + v).classList.add('on');
    document.title = 'Fav-Admin · ' + v.charAt(0).toUpperCase() + v.slice(1);
    if (!loaded[v]) { loaded[v] = true; ({ overview: loadOverview, users: initUsers, payouts: loadPayouts, ledger: loadLedger, earn: loadEarn, system: loadSystem })[v](); }
  }
  document.querySelectorAll('#ad-nav button[data-view], #ad-tabs button[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });

  async function colAll(name, n) {
    var snap = await getDocs(query(collection(db, name), limit(n || 200)));
    var rows = [];
    snap.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
    return rows;
  }

  /* ---------- overview ---------- */
  async function loadOverview() {
    try {
      var users = await colAll('users', 500);
      var cash = await colAll('cashouts', 200);
      var proofs = await colAll('proofs', 300);
      var today = dayStr(Date.now());
      var q = cash.filter(function (c) { return c.status === 'review'; });
      var qSum = q.reduce(function (s, c) { return s + Number(c.amount || 0); }, 0);
      var paid = cash.filter(function (c) { return c.status === 'paid'; });
      var paidSum = paid.reduce(function (s, c) { return s + Number(c.amount || 0); }, 0);
      var byLabel = {};
      proofs.forEach(function (p) {
        var lb = String(p.label || '?');
        byLabel[lb] = byLabel[lb] || { n: 0, usd: 0 };
        byLabel[lb].n++;
        byLabel[lb].usd += Number(p.amount || 0);
      });
      function todaySum(lb) {
        return proofs.filter(function (p) { return p.label === lb && dayStr(tsMs(p.at)) === today; })
          .reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
      }
      var stats = [
        ['Users (≤500)', String(users.length), ''],
        ['Payouts in review', q.length + ' · ' + money(qSum), q.length ? 'warn' : ''],
        ['Paid lifetime (≤200)', money(paidSum), ''],
        ['Proof rows (≤300)', String(proofs.length), ''],
        ['Faucet paid today', money(todaySum('play:faucet')), ''],
        ['PTC paid today', money(todaySum('ptc-view')), ''],
        ['Spin paid today', money(todaySum('spin-win')), '']
      ];
      document.getElementById('ov-stats').innerHTML = stats.map(function (s) {
        return '<div class="ad-stat"><b class="' + s[2] + '">' + esc(s[1]) + '</b><span>' + esc(s[0]) + '</span></div>';
      }).join('');
      var methods = {};
      cash.filter(function (c) { return c.status !== 'review'; }).forEach(function (c) {
        var m = String(c.method || 'unknown');
        methods[m] = methods[m] || { n: 0, usd: 0 };
        methods[m].n++; methods[m].usd += Number(c.amount || 0);
      });
      var keys = Object.keys(methods);
      document.getElementById('ov-methods').innerHTML = keys.length
        ? '<table class="ad-tbl"><thead><tr><th>Method</th><th>Decided</th><th>Total</th></tr></thead><tbody>' +
          keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + methods[k].n + '</td><td>' + money(methods[k].usd) + '</td></tr>'; }).join('') +
          '</tbody></table>'
        : '<p class="psub">No decided cashouts yet.</p>';
      var nb = document.getElementById('nav-n');
      if (nb) { if (q.length) { nb.textContent = q.length > 9 ? '9+' : q.length; nb.style.display = ''; } else nb.style.display = 'none'; }
    } catch (_) {
      document.getElementById('ov-stats').innerHTML = '<div class="ad-panel"><p class="psub">Load failed — paste the repo firestore.rules, then reload.</p></div>';
    }
  }

  /* ---------- users ---------- */
  var curUser = null;
  function initUsers() {
    document.getElementById('u-go').addEventListener('click', lookupUser);
    document.getElementById('u-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') lookupUser(); });
  }
  async function lookupUser() {
    var q = document.getElementById('u-q').value.trim();
    var out = document.getElementById('u-out');
    if (!q) { out.innerHTML = '<p class="psub">Enter an email or UID.</p>'; return; }
    out.innerHTML = '<p class="psub">Loading…</p>';
    curUser = null;
    try {
      var uid = q, udoc = null;
      if (q.indexOf('@') >= 0) {
        var s = await getDocs(query(collection(db, 'users'), where('email', '==', q), limit(5)));
        var found = null;
        s.forEach(function (d) { if (!found) found = { id: d.id, ...d.data() }; });
        if (!found) { out.innerHTML = '<p class="psub">No user with that email.</p>'; return; }
        uid = found.id; udoc = found;
      } else {
        var g = await getDoc(doc(db, 'users', uid));
        if (!g.exists()) { out.innerHTML = '<p class="psub">No user with that UID.</p>'; return; }
        udoc = { id: g.id, ...g.data() };
      }
      var w = {};
      try { var wg = await getDoc(doc(db, 'wallets', uid)); w = wg.exists() ? wg.data() : {}; } catch (_) {}
      var pr = await getDocs(query(collection(db, 'proofs'), where('uid', '==', uid), limit(50)));
      var rows = [];
      pr.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
      rows.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
      var rf = await getDocs(query(collection(db, 'referrals'), where('ownerUid', '==', uid), limit(50)));
      var refN = 0; rf.forEach(function () { refN++; });
      curUser = { uid: uid };
      var earnSum = rows.filter(function (p) { return Number(p.amount || 0) > 0 && p.status === 'pending'; }).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
      out.innerHTML =
        '<dl class="kv">' +
        '<dt>UID</dt><dd class="mono">' + esc(uid) + '</dd>' +
        '<dt>Email</dt><dd>' + esc(udoc.email || '—') + '</dd>' +
        '<dt>Available</dt><dd>' + money(w.pending) + ' · lifetime ' + money(w.lifetime) + '</dd>' +
        '<dt>Staked (user)</dt><dd>' + money(w.invested) + ' · taskEarned ' + money(udoc.taskEarned) + '</dd>' +
        '<dt>Diamonds</dt><dd>' + Math.max(0, Math.floor(Number(w.diamonds || 0))) + '</dd>' +
        '<dt>Referrals</dt><dd>' + refN + ' joined</dd>' +
        '<dt>Recent earnings</dt><dd>' + money(earnSum) + ' across ' + rows.length + ' proof rows (≤50)</dd>' +
        '</dl>' +
        '<div class="ad-row"><input id="adj-amt" type="number" min="0.01" max="100" step="0.01" placeholder="Amount USD (≤100)" style="max-width:200px" />' +
        '<input id="adj-note" class="grow" placeholder="Reason (written to audit proof)" maxlength="120" />' +
        '<button class="ad-btn green" id="adj-go">Credit</button></div>' +
        '<table class="ad-tbl"><thead><tr><th>Proof</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
        (rows.slice(0, 20).map(function (p) {
          return '<tr><td class="mono">' + esc(p.label || '?') + '</td><td>' + money(p.amount) + '</td><td><span class="pill ' + esc(p.status || 'pending') + '">' + esc(p.status || 'pending') + '</span></td><td>' + rel(tsMs(p.at)) + '</td></tr>';
        }).join('') || '<tr><td colspan="4">No proofs.</td></tr>') +
        '</tbody></table>';
      document.getElementById('adj-go').addEventListener('click', adjustUser);
    } catch (_) { out.innerHTML = '<p class="psub">Lookup failed — check rules + connection.</p>'; }
  }
  async function adjustUser() {
    if (!curUser) return;
    var amt = Math.round(Number(document.getElementById('adj-amt').value || 0) * 100) / 100;
    var note = document.getElementById('adj-note').value.trim();
    if (!(amt >= 0.01 && amt <= 100)) { show('Amount must be $0.01–$100.'); return; }
    if (!note) { show('Add a reason — it lands on the audit proof.'); return; }
    if (!window.confirm('Credit ' + money(amt) + ' to ' + curUser.uid + '?')) return;
    try {
      await updateDoc(doc(db, 'wallets', curUser.uid), {
        pending: increment(amt), lifetime: increment(amt), updatedAt: serverTimestamp(), lastLabel: 'admin-adjust'
      });
      await addDoc(collection(db, 'proofs'), {
        uid: curUser.uid, amount: amt, label: 'admin-adjust', status: 'done', note: note, by: me ? me.email : 'admin', at: serverTimestamp()
      });
      show('Credited ' + money(amt) + '.');
      lookupUser();
    } catch (_) { show('Adjust failed — check rules + connection.'); }
  }

  /* ---------- payouts ---------- */
  async function loadPayouts() {
    var qEl = document.getElementById('p-queue'), dEl = document.getElementById('p-done');
    try {
      var qs = await getDocs(query(collection(db, 'cashouts'), where('status', '==', 'review'), limit(100)));
      var queue = [];
      qs.forEach(function (d) { queue.push({ id: d.id, ...d.data() }); });
      queue.sort(function (a, b) { return tsMs(a.at) - tsMs(b.at); });
      qEl.innerHTML = queue.length
        ? '<table class="ad-tbl"><thead><tr><th>User</th><th>Method → dest</th><th>Amount</th><th>Age</th><th></th></tr></thead><tbody>' +
          queue.map(function (c) {
            return '<tr><td class="mono">' + esc(String(c.uid || '').slice(0, 8)) + '…</td>' +
              '<td><b>' + esc(c.method || '?') + '</b><br /><span class="mono">' + esc(c.dest || '') + '</span></td>' +
              '<td><b>' + money(c.amount) + '</b></td><td>' + rel(tsMs(c.at)) + '</td>' +
              '<td style="white-space:nowrap"><button class="ad-btn green" data-decide="paid:' + esc(c.id) + '">Pay</button> ' +
              '<button class="ad-btn red" data-decide="rejected:' + esc(c.id) + '">Reject</button></td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="psub">Queue empty. Nothing awaiting review.</p>';
      var all = await colAll('cashouts', 200);
      var done = all.filter(function (c) { return c.status !== 'review'; })
        .sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); }).slice(0, 50);
      dEl.innerHTML = done.length
        ? '<table class="ad-tbl"><thead><tr><th>User</th><th>Method</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
          done.map(function (c) {
            return '<tr><td class="mono">' + esc(String(c.uid || '').slice(0, 8)) + '…</td><td>' + esc(c.method || '?') + '</td><td>' + money(c.amount) + '</td>' +
              '<td><span class="pill ' + esc(c.status) + '">' + esc(c.status) + '</span></td><td>' + rel(tsMs(c.at)) + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="psub">No decided cashouts yet.</p>';
      var nb = document.getElementById('nav-n');
      if (nb) { if (queue.length) { nb.textContent = queue.length > 9 ? '9+' : queue.length; nb.style.display = ''; } else nb.style.display = 'none'; }
    } catch (_) {
      qEl.innerHTML = '<p class="psub">Load failed — paste the repo firestore.rules, then reload.</p>';
      dEl.innerHTML = '';
    }
  }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-decide]');
    if (!b) return;
    var parts = b.getAttribute('data-decide').split(':');
    var to = parts[0], id = parts.slice(1).join(':');
    if (!window.confirm((to === 'paid' ? 'Mark PAID ' : 'REJECT ') + id + '? Decisions are final.')) return;
    b.disabled = true;
    try {
      await updateDoc(doc(db, 'cashouts', id), { status: to });
      show(to === 'paid' ? 'Marked paid.' : 'Rejected.');
      loaded.payouts = false; await loadPayouts(); loaded.payouts = true;
      loaded.overview = false;
    } catch (_) { show('Decision failed — check rules + connection.'); b.disabled = false; }
  });

  /* ---------- ledger ---------- */
  var ledgerRows = [];
  async function loadLedger() {
    var out = document.getElementById('l-out');
    try {
      ledgerRows = await colAll('proofs', 200);
      ledgerRows.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
      var sel = document.getElementById('l-filter');
      var labels = {};
      ledgerRows.forEach(function (p) { labels[String(p.label || '?')] = 1; });
      sel.innerHTML = '<option value="">All labels</option>' + Object.keys(labels).sort().map(function (l) {
        return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
      }).join('');
      paintLedger('');
    } catch (_) { out.innerHTML = '<p class="psub">Load failed — check rules + connection.</p>'; }
  }
  function paintLedger(f) {
    var rows = ledgerRows.filter(function (p) { return !f || String(p.label || '') === f; });
    var n = rows.length, usd = rows.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
    document.getElementById('l-out').innerHTML =
      '<p class="psub">' + n + ' rows · ' + money(usd) + ' total in sample.</p>' +
      '<table class="ad-tbl"><thead><tr><th>User</th><th>Label</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
      (rows.slice(0, 100).map(function (p) {
        return '<tr><td class="mono">' + esc(String(p.uid || '').slice(0, 8)) + '…</td><td class="mono">' + esc(p.label || '?') + '</td><td>' + money(p.amount) + '</td>' +
          '<td><span class="pill ' + esc(p.status || 'pending') + '">' + esc(p.status || 'pending') + '</span></td><td>' + rel(tsMs(p.at)) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">No rows.</td></tr>') + '</tbody></table>';
  }

  /* ---------- earn ---------- */
  function loadEarn() {
    var tiers = PTC_CATALOG.map(function (a) {
      return '<tr><td class="mono">' + esc(a.id) + '</td><td>' + esc(a.title || '') + '</td><td>' + a.secs + 's</td><td>' + money(a.pay) + '</td><td>' + (a.intervalHrs || 24) + 'h</td><td>' + (Array.isArray(a.slots) ? a.slots.length : 0) + '/8 slots</td></tr>';
    }).join('');
    var tracks = REWARD_TRACKS.map(function (t) {
      return '<tr><td>' + esc(t.name) + '</td><td class="mono">' + t.targets.join(' / ') + '</td><td>' + REWARD_TIERS.map(function (x) { return money(x); }).join(' / ') + '</td></tr>';
    }).join('');
    document.getElementById('e-out').innerHTML =
      '<div class="ad-panel"><h2>Economy constants (live code)</h2><p class="psub">Faucet ' + money(FAUCET_AMOUNT) + ' / ' + Math.round(FAUCET_INTERVAL_MS / 60000) + 'min / cap ' + FAUCET_DAILY_CAP +
      ' · PTC cap ' + PTC_DAILY_CAP + '/day (' + money(PTC_MIN_PAY) + '–' + money(PTC_MAX_PAY) + ') · Spin extra ' + DIAMOND_COST_SPIN + '◆ · Quiz entry ' + DIAMOND_COST_QUIZ +
      '◆ · Grow ' + INVEST_BASE_APR + '%/' + INVEST_BOOST_APR + '% · max stake ' + money(INVEST_MAX_STAKE) + '.</p></div>' +
      '<div class="ad-panel"><h2>PTC catalog (' + PTC_CATALOG.length + ' live)</h2><p class="psub">Rotation every ' + Math.round(PTC_SLOT_MS / 3600000) + 'h. New links ship via code deploy, not here.</p>' +
      '<table class="ad-tbl"><thead><tr><th>ID</th><th>Title</th><th>View</th><th>Pay</th><th>Every</th><th>Slots</th></tr></thead><tbody>' + tiers + '</tbody></table></div>' +
      '<div class="ad-panel"><h2>Reward tracks</h2><p class="psub">Milestone targets → tier payouts.</p>' +
      '<table class="ad-tbl"><thead><tr><th>Track</th><th>Targets</th><th>Pays</th></tr></thead><tbody>' + tracks + '</tbody></table></div>';
  }

  /* ---------- system ---------- */
  async function loadSystem() {
    var seat = null;
    try { var s = await getDoc(doc(db, 'admin', 'owner')); seat = s.exists() ? s.data() : null; } catch (_) {}
    document.getElementById('s-out').innerHTML =
      '<div class="ad-panel"><h2>Session</h2><dl class="kv">' +
      '<dt>Signed in</dt><dd>' + esc(me ? (me.email || me.uid) : '—') + '</dd>' +
      '<dt>Seat UID</dt><dd class="mono">' + esc(seat && seat.uid ? seat.uid : '—') + '</dd>' +
      '<dt>Seat since</dt><dd>' + (seat && seat.createdAt ? rel(tsMs(seat.createdAt)) : '—') + '</dd></dl>' +
      '<button class="ad-btn ghost" id="sys-out">Sign out</button></div>' +
      '<div class="ad-panel"><h2>Rules checklist</h2><p class="psub">' +
      '1. Paste this repo\'s <span class="mono">firestore.rules</span> into Console → Firestore → Rules → Publish.<br />' +
      '2. Reload this page — Overview numbers prove the admin reads work.<br />' +
      '3. <span class="mono">robots.txt</span> already blocks <span class="mono">/Fav-Admin</span> from crawlers.</p></div>' +
      '<div class="ad-panel"><h2>Hardening follow-ups</h2><p class="psub">' +
      '· Second factor on the seat (TOTP) is not restored yet — add before sharing access.<br />' +
      '· Amounts are client-enforced; full server authority needs a Cloud Function.<br />' +
      '· Admin reads bill per document — keep sample caps where they are.</p></div>';
    document.getElementById('sys-out').addEventListener('click', function () { try { signOut(auth); } catch (_) {} });
  }
  document.getElementById('l-go').addEventListener('click', function () {
    if (!ledgerRows.length) { loadLedger(); return; }
    paintLedger(document.getElementById('l-filter').value);
  });
  document.getElementById('l-filter').addEventListener('change', function () { paintLedger(this.value); });

  setTimeout(ready, 6000);
})();
