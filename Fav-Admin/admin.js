// Fav-Admin ops console (two seats, full build). Requires the firestore.rules
// in this repo to be pasted in Console: isAdmin() unlocks cross-user reads,
// bounded wallet adjusts (credit AND debit <= $100 + audit proof), cashout
// review -> paid|rejected, soft-ban flags on users/*, and the append-only
// admin_logs trail. Two admin seats, first-come, max two, forever: this
// console carries its own email/password sign-in + one-click claim. Owners
// sign in here; everyone else sees Locked/Denied and every read/write still
// fails closed in the rules.
// NOTE: amounts are still client-enforced; full server authority needs a
// Cloud Function when backend lands.
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut } from '../js/firebase.js';
import {
  FAUCET_AMOUNT, FAUCET_INTERVAL_MS, FAUCET_DAILY_CAP,
  PTC_DAILY_CAP, PTC_MIN_PAY, PTC_MAX_PAY,
  SPIN_AD_DAILY_CAP, QUIZ_AD_DAILY_CAP,
  INVEST_BASE_APR, INVEST_BOOST_APR, INVEST_MAX_STAKE, MINE_SHIFT_MS,
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
  function fullTs(ms) { try { return ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—'; } catch (_) { return '—'; } }
  function rel(ms) {
    if (!ms) return '—';
    var d = Math.max(0, Math.round((Date.now() - ms) / 864e5));
    if (d === 0) return 'today'; if (d === 1) return '1d ago'; if (d < 30) return d + 'd ago';
    return Math.floor(d / 30) + 'mo ago';
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
      var el = document.getElementById(v);
      if (el) el.style.display = v === id ? '' : 'none';
    });
    document.title = 'Fav-Admin · ' + (id === 'view-claim' ? 'Claim seat' : id === 'view-denied' ? 'Locked' : 'Sign in');
  }

  /* ---------- CSV export ---------- */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCSV(name, headers, rows) {
    try {
      var out = headers.map(csvCell).join(',') + '\n' +
        rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
      var blob = new Blob([out], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (_) {} }, 2000);
    } catch (_) { show('Export failed in this browser.'); }
  }

  /* ---------- audit trail ---------- */
  async function audit(action, target, amount, note) {
    try {
      await addDoc(collection(db, 'admin_logs'), {
        by: me ? (me.email || me.uid) : 'admin',
        action: String(action || ''),
        target: String(target || ''),
        amount: Number(amount || 0),
        note: String(note || '').slice(0, 300),
        at: serverTimestamp()
      });
    } catch (_) {}
  }

  /* ---------- gate (two admin seats, first-come, max two) ---------- */
  // Reads fail closed for non-owners, so a seat we cannot read is either
  // taken by the other admin or (pre-rules-paste) unreadable. Seat
  // availability is therefore decided by attempting the create, in order.
  async function mySeatId(uid) {
    for (const id of ['seat1', 'seat2']) {
      try {
        const s = await getDoc(doc(db, 'admin', id));
        if (s.exists() && s.data() && s.data().uid === uid) return id;
      } catch (_) {}
    }
    return null;
  }
  async function enter(user, seatId) {
    me = user;
    document.body.classList.add('authed');
    document.title = 'Fav-Admin · Overview';
    document.getElementById('ad-me').textContent = (user.email || user.uid) + ' · admin (' + seatId + ' of 2)';
    showView('overview');
    ready();
  }
  function locked(msg) {
    me = null;
    document.body.classList.remove('authed');
    gateView('view-denied');
    document.getElementById('denied-sub').textContent = msg;
    ready();
  }
  function showClaim(user) {
    me = null;
    document.body.classList.remove('authed');
    document.getElementById('claim-who').textContent = user.email || user.uid;
    err('claim-err');
    gateView('view-claim');
    ready();
  }
  try {
    onAuthStateChanged(auth, async function (user) {
      if (!user) {
        // Hard sign-out: drop the stale admin identity and force every view
        // to reload fresh on the next sign-in (no cross-account leakage).
        if (me) { try { show('Signed out.'); } catch (_) {} }
        me = null; loaded = {};
        gateView('view-signin'); ready(); return;
      }
      var seat = await mySeatId(user.uid);
      if (seat) { enter(user, seat); return; }
      showClaim(user);
    });
  } catch (_) { locked('Console failed to start. Reload and try again.'); }

  // Claim loop: try seat1, then seat2. Rules enforce !exists, so a simultaneous
  // race still yields at most one winner per seat — max two admins, forever.
  async function claimSeatsFor(user) {
    for (const id of ['seat1', 'seat2']) {
      try {
        await setDoc(doc(db, 'admin', id), { uid: user.uid, email: user.email || '', createdAt: serverTimestamp(), totpSecret: null });
        return id;
      } catch (_) {}
    }
    return null;
  }
  async function doSignin() {
    err('si-err');
    var em = document.getElementById('si-email').value.trim(), pw = document.getElementById('si-pass').value;
    if (!em || !pw) { err('si-err', 'Enter email and password.'); return; }
    try { await signInWithEmailAndPassword(auth, em, pw); }
    catch (e) {
      var msg = 'Sign-in failed — check credentials.';
      if (e && e.code === 'auth/invalid-credential') msg = 'Wrong email or password.';
      else if (e && e.code === 'auth/user-not-found') msg = 'No admin account for this email.';
      else if (e && e.code === 'auth/too-many-requests') msg = 'Too many attempts — wait 5 minutes and try once.';
      else if (e && e.code === 'auth/user-disabled') msg = 'This account is disabled.';
      err('si-err', msg);
    }
  }
  async function doClaimSeat() {
    err('claim-err');
    var user = null;
    try { user = auth.currentUser; } catch (_) { user = null; }
    if (!user) { err('claim-err', 'No session — use the main site first.'); return; }
    var owned = await mySeatId(user.uid);
    if (owned) { enter(user, owned); return; }
    var seat = await claimSeatsFor(user);
    if (seat) { show('Admin seat claimed (' + seat + ' of 2).'); enter(user, seat); return; }
    err('claim-err', 'Claim failed — both seats may be taken, or the latest firestore.rules is not published yet.');
  }
  document.getElementById('si-go').addEventListener('click', doSignin);
  document.getElementById('claim-go').addEventListener('click', doClaimSeat);
  document.getElementById('denied-out').addEventListener('click', function () { location.reload(); });
  document.getElementById('ad-logout').addEventListener('click', function () { try { signOut(auth); } catch (_) {} });
  [['si-email', doSignin], ['si-pass', doSignin]].forEach(function (t) {
    document.getElementById(t[0]).addEventListener('keydown', function (e) { if (e.key === 'Enter') t[1](); });
  });

  /* ---------- router ---------- */
  var VIEW_LOADERS = { overview: loadOverview, users: initUsers, payouts: loadPayouts, ledger: loadLedger, providers: loadProviders, earn: loadEarn, system: loadSystem, audit: loadAudit };
  function showView(v) {
    document.querySelectorAll('#ad-nav button[data-view], #ad-tabs button[data-view]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    document.querySelectorAll('.ad-view').forEach(function (s) { s.classList.remove('on'); });
    document.getElementById('v-' + v).classList.add('on');
    document.title = 'Fav-Admin · ' + v.charAt(0).toUpperCase() + v.slice(1);
    if (!loaded[v]) { loaded[v] = true; VIEW_LOADERS[v](); }
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
      var banned = users.filter(function (u) { return u.disabled === true; }).length;
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
        ['Spin paid today', money(todaySum('spin-win')), ''],
        ['Soft-banned', String(banned), banned ? 'warn' : '']
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
      var html = keys.length
        ? '<table class="ad-tbl"><thead><tr><th>Method</th><th>Decided</th><th>Total</th></tr></thead><tbody>' +
          keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + methods[k].n + '</td><td>' + money(methods[k].usd) + '</td></tr>'; }).join('') +
          '</tbody></table>'
        : '<p class="psub">No decided cashouts yet.</p>';
      try {
        var logs = await colAll('admin_logs', 10);
        logs.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
        html += '<h2 style="margin:18px 0 4px;font-size:14px;color:#fff">Recent admin actions</h2>' +
          (logs.length
            ? '<table class="ad-tbl"><thead><tr><th>Action</th><th>Target</th><th>When</th></tr></thead><tbody>' +
              logs.map(function (l) {
                return '<tr><td><span class="pill done">' + esc(l.action || '?') + '</span></td><td class="mono">' + esc(String(l.target || '').slice(0, 12)) + '</td><td>' + rel(tsMs(l.at)) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="psub">No admin actions logged yet.</p>');
      } catch (_) {}
      document.getElementById('ov-methods').innerHTML = html;
      var nb = document.getElementById('nav-n');
      if (nb) { if (q.length) { nb.textContent = q.length > 9 ? '9+' : q.length; nb.style.display = ''; } else nb.style.display = 'none'; }
    } catch (_) {
      document.getElementById('ov-stats').innerHTML = '<div class="ad-panel"><p class="psub">Load failed — paste the repo firestore.rules, then reload.</p></div>';
    }
  }

  /* ---------- users ---------- */
  var curUser = null, curWallet = null, usersWired = false;
  var browse = { rows: [], limit: 0 };
  function initUsers() {
    if (usersWired) return;
    usersWired = true;
    document.getElementById('u-go').addEventListener('click', lookupUser);
    document.getElementById('u-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') lookupUser(); });
    document.getElementById('u-load').addEventListener('click', function () { browse.limit = 100; loadBrowse(); });
    document.getElementById('u-more').addEventListener('click', function () { browse.limit = Math.min(1000, browse.limit + 100); loadBrowse(); });
    document.getElementById('u-filter').addEventListener('input', paintBrowse);
    document.getElementById('u-csv').addEventListener('click', function () {
      if (!browse.rows.length) { show('Load browse first.'); return; }
      downloadCSV('favmoney-users.csv', ['uid', 'email', 'disabled', 'taskEarned'],
        browse.rows.map(function (u) { return [u.id, u.email || '', u.disabled === true ? 'yes' : 'no', u.taskEarned || 0]; }));
    });
  }
  async function loadBrowse() {
    var listEl = document.getElementById('u-list');
    listEl.innerHTML = '<p class="psub">Loading ' + browse.limit + '…</p>';
    try {
      browse.rows = await colAll('users', browse.limit);
      paintBrowse();
    } catch (_) { listEl.innerHTML = '<p class="psub">Load failed — check rules + connection.</p>'; }
  }
  function paintBrowse() {
    var f = (document.getElementById('u-filter').value || '').toLowerCase().trim();
    var rows = browse.rows.filter(function (u) {
      if (!f) return true;
      return String(u.id || '').toLowerCase().indexOf(f) >= 0 || String(u.email || '').toLowerCase().indexOf(f) >= 0;
    });
    document.getElementById('u-count').textContent = browse.rows.length + ' loaded · ' + rows.length + ' shown';
    document.getElementById('u-more').style.display = browse.rows.length >= browse.limit && browse.limit < 1000 ? '' : 'none';
    document.getElementById('u-list').innerHTML = rows.length
      ? '<table class="ad-tbl"><thead><tr><th>Email</th><th>UID</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows.slice(0, 100).map(function (u) {
          return '<tr><td>' + esc(u.email || '—') + '</td><td class="mono">' + esc(String(u.id || '').slice(0, 10)) + '…</td>' +
            '<td>' + (u.disabled === true ? '<span class="pill rejected">banned</span>' : '<span class="pill paid">active</span>') + '</td>' +
            '<td><button class="ad-btn ghost" data-inspect="' + esc(u.id) + '">Inspect</button></td></tr>';
        }).join('') + '</tbody></table>' + (rows.length > 100 ? '<p class="psub">First 100 shown — refine the filter or export CSV for all.</p>' : '')
      : '<p class="psub">No rows match.</p>';
  }
  async function lookupUser() {
    var q = document.getElementById('u-q').value.trim();
    var out = document.getElementById('u-out');
    if (!q) { out.innerHTML = '<p class="psub">Enter an email or UID.</p>'; return; }
    out.innerHTML = '<p class="psub">Loading…</p>';
    curUser = null; curWallet = null;
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
      curWallet = w;
      var banned = udoc.disabled === true;
      var earnSum = rows.filter(function (p) { return Number(p.amount || 0) > 0 && p.status === 'pending'; }).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
      out.innerHTML =
        '<dl class="kv">' +
        '<dt>UID</dt><dd class="mono">' + esc(uid) + '</dd>' +
        '<dt>Email</dt><dd>' + esc(udoc.email || '—') + '</dd>' +
        '<dt>Status</dt><dd>' + (banned ? '<span class="pill rejected">banned</span> ' + esc(udoc.disabledReason || '') : '<span class="pill paid">active</span>') + '</dd>' +
        '<dt>Available</dt><dd>' + money(w.pending) + ' · lifetime ' + money(w.lifetime) + '</dd>' +
        '<dt>Staked (user)</dt><dd>' + money(w.invested) + ' · taskEarned ' + money(udoc.taskEarned) + '</dd>' +
        '<dt>Referrals</dt><dd>' + refN + ' joined</dd>' +
        '<dt>Recent earnings</dt><dd>' + money(earnSum) + ' across ' + rows.length + ' proof rows (≤50)</dd>' +
        '</dl>' +
        '<div class="ad-row"><input id="adj-amt" type="number" min="0.01" max="100" step="0.01" placeholder="Amount USD (≤100)" style="max-width:200px" />' +
        '<input id="adj-note" class="grow" placeholder="Reason (written to audit proof + log)" maxlength="120" />' +
        '<button class="ad-btn green" id="adj-go">Credit</button>' +
        '<button class="ad-btn red" id="adj-take">Debit</button></div>' +
        '<div class="ad-row"><input id="ban-reason" class="grow" placeholder="Ban reason (shown to future enforcement)" maxlength="120" value="' + esc(udoc.disabledReason || '') + '" />' +
        (banned
          ? '<button class="ad-btn ghost" id="ban-toggle">Unban</button>'
          : '<button class="ad-btn red" id="ban-toggle">Ban</button>') +
        '<button class="ad-btn ghost" id="u-csv-one">Export history CSV</button></div>' +
        '<table class="ad-tbl"><thead><tr><th>Proof</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
        (rows.slice(0, 20).map(function (p) {
          return '<tr><td class="mono">' + esc(p.label || '?') + '</td><td>' + money(p.amount) + '</td><td><span class="pill ' + esc(p.status || 'pending') + '">' + esc(p.status || 'pending') + '</span></td><td>' + rel(tsMs(p.at)) + '</td></tr>';
        }).join('') || '<tr><td colspan="4">No proofs.</td></tr>') +
        '</tbody></table>';
      document.getElementById('adj-go').addEventListener('click', function () { adjustUser('credit'); });
      document.getElementById('adj-take').addEventListener('click', function () { adjustUser('debit'); });
      document.getElementById('ban-toggle').addEventListener('click', function () { setBan(!banned); });
      document.getElementById('u-csv-one').addEventListener('click', function () {
        downloadCSV('user-' + uid.slice(0, 8) + '-proofs.csv', ['label', 'amount', 'status', 'when'],
          rows.map(function (p) { return [p.label || '', p.amount || 0, p.status || '', fullTs(tsMs(p.at))]; }));
      });
    } catch (_) { out.innerHTML = '<p class="psub">Lookup failed — check rules + connection.</p>'; }
  }
  async function adjustUser(kind) {
    if (!curUser) return;
    var isDebit = kind === 'debit';
    var amt = Math.round(Number(document.getElementById('adj-amt').value || 0) * 100) / 100;
    var note = document.getElementById('adj-note').value.trim();
    if (!(amt >= 0.01 && amt <= 100)) { show('Amount must be $0.01–$100.'); return; }
    if (!note) { show('Add a reason — it lands on the audit proof + log.'); return; }
    if (isDebit && amt > Number((curWallet && curWallet.pending) || 0) + 1e-9) { show('Debit exceeds available ' + money(curWallet && curWallet.pending) + '.'); return; }
    if (!window.confirm((isDebit ? 'DEBIT ' : 'Credit ') + money(amt) + (isDebit ? ' from ' : ' to ') + curUser.uid + '?')) return;
    try {
      var patch = isDebit
        ? { pending: increment(-amt), updatedAt: serverTimestamp(), lastLabel: 'admin-debit' }
        : { pending: increment(amt), lifetime: increment(amt), updatedAt: serverTimestamp(), lastLabel: 'admin-credit' };
      await updateDoc(doc(db, 'wallets', curUser.uid), patch);
      await addDoc(collection(db, 'proofs'), {
        uid: curUser.uid, amount: isDebit ? -amt : amt,
        label: isDebit ? 'admin-debit' : 'admin-credit',
        status: 'done', note: note, by: me ? me.email : 'admin', at: serverTimestamp()
      });
      await audit(isDebit ? 'debit' : 'credit', curUser.uid, isDebit ? -amt : amt, note);
      show((isDebit ? 'Debited ' : 'Credited ') + money(amt) + '.');
      lookupUser();
    } catch (_) { show('Adjust failed — check rules + connection.'); }
  }
  async function setBan(ban) {
    if (!curUser) return;
    var reason = (document.getElementById('ban-reason') || {}).value || '';
    reason = String(reason).trim().slice(0, 120);
    if (ban && !reason) { show('Add a ban reason first.'); return; }
    if (!window.confirm((ban ? 'BAN ' : 'UNBAN ') + curUser.uid + '?')) return;
    try {
      var patch = ban
        ? { disabled: true, disabledAt: serverTimestamp(), disabledReason: reason, disabledBy: me ? me.email : 'admin' }
        : { disabled: false, disabledReason: '', disabledBy: me ? me.email : 'admin' };
      try {
        await updateDoc(doc(db, 'users', curUser.uid), patch);
      } catch (_) {
        await setDoc(doc(db, 'users', curUser.uid), patch, { merge: true });
      }
      await audit(ban ? 'ban' : 'unban', curUser.uid, 0, reason);
      show(ban ? 'User banned.' : 'User unbanned.');
      lookupUser();
    } catch (_) { show('Ban update failed — paste the latest firestore.rules.'); }
  }

  /* ---------- payouts ---------- */
  var payState = { all: [], queue: [], limit: 200 };
  async function loadPayouts() {
    var qEl = document.getElementById('p-queue'), dEl = document.getElementById('p-done');
    try {
      var qs = await getDocs(query(collection(db, 'cashouts'), where('status', '==', 'review'), limit(100)));
      var queue = [];
      qs.forEach(function (d) { queue.push({ id: d.id, ...d.data() }); });
      queue.sort(function (a, b) { return tsMs(a.at) - tsMs(b.at); });
      payState.queue = queue;
      var all = await colAll('cashouts', payState.limit);
      payState.all = all;
      var msel = document.getElementById('p-method');
      var cur = msel.value;
      var methods = {};
      all.forEach(function (c) { methods[String(c.method || 'unknown')] = 1; });
      msel.innerHTML = '<option value="">All methods</option>' + Object.keys(methods).sort().map(function (m) {
        return '<option value="' + esc(m) + '"' + (m === cur ? ' selected' : '') + '>' + esc(m) + '</option>';
      }).join('');
      paintPayouts();
      var nb = document.getElementById('nav-n');
      if (nb) { if (queue.length) { nb.textContent = queue.length > 9 ? '9+' : queue.length; nb.style.display = ''; } else nb.style.display = 'none'; }
    } catch (_) {
      qEl.innerHTML = '<p class="psub">Load failed — paste the repo firestore.rules, then reload.</p>';
      dEl.innerHTML = '';
    }
  }
  function payFilter(rows) {
    var m = document.getElementById('p-method').value;
    var q = (document.getElementById('p-q').value || '').toLowerCase().trim();
    return rows.filter(function (c) {
      if (m && String(c.method || '') !== m) return false;
      if (q && String(c.uid || '').toLowerCase().indexOf(q) < 0 && String(c.dest || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function paintPayouts() {
    var q = payFilter(payState.queue);
    var done = payState.all.filter(function (c) { return c.status !== 'review'; });
    done = payFilter(done).sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); }).slice(0, 50);
    document.getElementById('p-queue').innerHTML = q.length
      ? '<table class="ad-tbl"><thead><tr><th>User</th><th>Method → dest</th><th>Amount</th><th>Age</th><th></th></tr></thead><tbody>' +
        q.map(function (c) {
          return '<tr><td class="mono">' + esc(String(c.uid || '').slice(0, 8)) + '…</td>' +
            '<td><b>' + esc(c.method || '?') + '</b><br /><span class="mono">' + esc(c.dest || '') + '</span></td>' +
            '<td><b>' + money(c.amount) + '</b></td><td>' + rel(tsMs(c.at)) + '</td>' +
            '<td style="white-space:nowrap"><button class="ad-btn green" data-decide="paid:' + esc(c.id) + '">Pay</button> ' +
            '<button class="ad-btn red" data-decide="rejected:' + esc(c.id) + '">Reject</button></td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="psub">Queue empty. Nothing awaiting review.</p>';
    document.getElementById('p-done').innerHTML = done.length
      ? '<p class="psub">' + done.length + ' shown.</p><table class="ad-tbl"><thead><tr><th>User</th><th>Method</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
        done.map(function (c) {
          return '<tr><td class="mono">' + esc(String(c.uid || '').slice(0, 8)) + '…</td><td>' + esc(c.method || '?') + '</td><td>' + money(c.amount) + '</td>' +
            '<td><span class="pill ' + esc(c.status) + '">' + esc(c.status) + '</span></td><td>' + rel(tsMs(c.at)) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="psub">No decided cashouts yet.</p>';
  }
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-decide]');
    if (!b) {
      var ins = e.target.closest('[data-inspect]');
      if (ins) {
        document.getElementById('u-q').value = ins.getAttribute('data-inspect');
        showView('users');
        lookupUser();
        window.scrollTo(0, 0);
      }
      return;
    }
    var parts = b.getAttribute('data-decide').split(':');
    var to = parts[0], id = parts.slice(1).join(':');
    if (!window.confirm((to === 'paid' ? 'Mark PAID ' : 'REJECT ') + id + '? Decisions are final.')) return;
    b.disabled = true;
    try {
      await updateDoc(doc(db, 'cashouts', id), { status: to });
      await audit(to === 'paid' ? 'payout-paid' : 'payout-rejected', id, 0, to);
      show(to === 'paid' ? 'Marked paid.' : 'Rejected.');
      await loadPayouts();
      loaded.overview = false;
    } catch (_) { show('Decision failed — check rules + connection.'); b.disabled = false; }
  });

  /* ---------- ledger ---------- */
  var ledgerRows = [], ledgerLimit = 200;
  async function loadLedger() {
    var out = document.getElementById('l-out');
    try {
      ledgerRows = await colAll('proofs', ledgerLimit);
      ledgerRows.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
      var sel = document.getElementById('l-filter');
      var cur = sel.value;
      var labels = {};
      ledgerRows.forEach(function (p) { labels[String(p.label || '?')] = 1; });
      sel.innerHTML = '<option value="">All labels</option>' + Object.keys(labels).sort().map(function (l) {
        return '<option value="' + esc(l) + '"' + (l === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
      }).join('');
      paintLedger();
    } catch (_) { out.innerHTML = '<p class="psub">Load failed — check rules + connection.</p>'; }
  }
  function paintLedger() {
    var f = document.getElementById('l-filter').value;
    var q = (document.getElementById('l-q').value || '').toLowerCase().trim();
    var rows = ledgerRows.filter(function (p) {
      if (f && String(p.label || '') !== f) return false;
      if (q && String(p.uid || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var n = rows.length, usd = rows.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
    document.getElementById('l-out').innerHTML =
      '<p class="psub">' + n + ' rows · ' + money(usd) + ' net in sample of ' + ledgerRows.length + '.</p>' +
      '<table class="ad-tbl"><thead><tr><th>User</th><th>Label</th><th>Amount</th><th>Status</th><th>When</th></tr></thead><tbody>' +
      (rows.slice(0, 100).map(function (p) {
        return '<tr><td class="mono">' + esc(String(p.uid || '').slice(0, 8)) + '…</td><td class="mono">' + esc(p.label || '?') + '</td><td>' + money(p.amount) + '</td>' +
          '<td><span class="pill ' + esc(p.status || 'pending') + '">' + esc(p.status || 'pending') + '</span></td><td>' + rel(tsMs(p.at)) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">No rows.</td></tr>') + '</tbody></table>' +
      (rows.length > 100 ? '<p class="psub">First 100 shown — export CSV for all ' + rows.length + '.</p>' : '');
  }

  /* ---------- providers (offerwall conversions, read-only audit) ---------- */
  var provRows = [], provLimit = 200;
  async function loadProviders() {
    var out = document.getElementById('pv-out');
    try {
      var gg = await colAll('gg_events', provLimit);
      var og = await colAll('og_events', provLimit);
      provRows = gg.concat(og);
      provRows.forEach(function (r) {
        if (!r.provider) r.provider = (String(r.eventId || '').indexOf('og-') === 0) ? 'ogads' : 'gg';
      });
      provRows.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
      paintProviders();
    } catch (_) { out.innerHTML = '<p class="psub">Load failed - check rules (gg_events, og_events) + connection.</p>'; }
  }
  function provOffer(r) {
    return r.offerName || r.offerId || r.campaignId || r.landingId || String(r.eventId || '').slice(0, 12) || '?';
  }
  function paintProviders() {
    var f = document.getElementById('pv-filter').value;
    var q = (document.getElementById('pv-q').value || '').toLowerCase().trim();
    var rows = provRows.filter(function (r) {
      if (f && String(r.provider || '') !== f) return false;
      if (q && String(r.uid || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var paid = rows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var profit = rows.reduce(function (s, r) { return s + Number(r.profit || 0); }, 0);
    document.getElementById('pv-out').innerHTML =
      '<p class="psub">' + rows.length + ' conversions - ' + money(paid) + ' paid to users (' + money(profit) + ' provider gross) in sample of ' + provRows.length + '.</p>' +
      '<table class="ad-tbl"><thead><tr><th>When</th><th>User</th><th>Provider</th><th>Offer</th><th>Gross</th><th>Paid</th><th>Status</th></tr></thead><tbody>' +
      (rows.slice(0, 100).map(function (r) {
        return '<tr><td style="white-space:nowrap">' + fullTs(tsMs(r.at)) + '</td>' +
          '<td class="mono">' + esc(String(r.uid || '').slice(0, 8)) + '..</td>' +
          '<td><span class="pill done">' + esc(r.provider || '?') + '</span></td>' +
          '<td>' + esc(provOffer(r)) + '</td>' +
          '<td>' + money(r.profit) + '</td><td>' + money(r.amount) + '</td>' +
          '<td><span class="pill ' + esc(r.status || 'pending') + '">' + esc(r.status || 'pending') + '</span></td></tr>';
      }).join('') || '<tr><td colspan="7">No rows.</td></tr>') + '</tbody></table>' +
      (rows.length > 100 ? '<p class="psub">First 100 shown.</p>' : '');
  }
  document.getElementById('pv-go').addEventListener('click', function () { provLimit = 200; loadProviders(); });
  document.getElementById('pv-more').addEventListener('click', function () {
    provLimit = Math.min(1000, provLimit + 300); loadProviders();
  });
  document.getElementById('pv-filter').addEventListener('change', paintProviders);
  document.getElementById('pv-q').addEventListener('input', paintProviders);

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
      ' · PTC cap ' + PTC_DAILY_CAP + '/day (' + money(PTC_MIN_PAY) + '–' + money(PTC_MAX_PAY) + ') · Spin 1 free + ' + SPIN_AD_DAILY_CAP + ' ads/day · Quiz 1 free + ' + QUIZ_AD_DAILY_CAP +
      ' ads/day · Grow ' + INVEST_BASE_APR + '%/' + INVEST_BOOST_APR + '% · ' + Math.round(MINE_SHIFT_MS / 3600000) + 'h shifts · max stake ' + money(INVEST_MAX_STAKE) + '.</p></div>' +
      '<div class="ad-panel"><h2>PTC catalog (' + PTC_CATALOG.length + ' live)</h2><p class="psub">Rotation every ' + Math.round(PTC_SLOT_MS / 3600000) + 'h. New links ship via code deploy, not here.</p>' +
      '<table class="ad-tbl"><thead><tr><th>ID</th><th>Title</th><th>View</th><th>Pay</th><th>Every</th><th>Slots</th></tr></thead><tbody>' + tiers + '</tbody></table></div>' +
      '<div class="ad-panel"><h2>Reward tracks</h2><p class="psub">Milestone targets → tier payouts.</p>' +
      '<table class="ad-tbl"><thead><tr><th>Track</th><th>Targets</th><th>Pays</th></tr></thead><tbody>' + tracks + '</tbody></table></div>';
    document.getElementById('e-faucet').value = FAUCET_AMOUNT;
    document.getElementById('e-ptccap').value = PTC_DAILY_CAP;
    document.getElementById('e-maxstake').value = INVEST_MAX_STAKE;
    document.getElementById('e-spincap').value = SPIN_AD_DAILY_CAP;
    document.getElementById('e-quizcap').value = QUIZ_AD_DAILY_CAP;
  }
  function genSnippet() {
    var f = Number(document.getElementById('e-faucet').value || FAUCET_AMOUNT);
    var pc = Math.floor(Number(document.getElementById('e-ptccap').value || PTC_DAILY_CAP));
    var ms = Math.floor(Number(document.getElementById('e-maxstake').value || INVEST_MAX_STAKE));
    var sc = Math.floor(Number(document.getElementById('e-spincap').value || SPIN_AD_DAILY_CAP));
    var qc = Math.floor(Number(document.getElementById('e-quizcap').value || QUIZ_AD_DAILY_CAP));
    document.getElementById('e-snippet').textContent =
      '// Paste into js/firebase.js, then deploy + test.\n' +
      'export const FAUCET_AMOUNT = ' + f.toFixed(2) + ';\n' +
      'export const PTC_DAILY_CAP = ' + pc + ';\n' +
      'export const INVEST_MAX_STAKE = ' + ms + ';\n' +
      'export const SPIN_AD_DAILY_CAP = ' + sc + ';\n' +
      'export const QUIZ_AD_DAILY_CAP = ' + qc + ';';
  }

  /* ---------- audit ---------- */
  var auditRows = [], auditLimit = 200;
  async function loadAudit() {
    var out = document.getElementById('a-out');
    try {
      auditRows = await colAll('admin_logs', auditLimit);
      auditRows.sort(function (a, b) { return tsMs(b.at) - tsMs(a.at); });
      paintAudit();
    } catch (_) { out.innerHTML = '<p class="psub">Load failed — paste the latest firestore.rules (admin_logs), then reload.</p>'; }
  }
  function paintAudit() {
    var f = document.getElementById('a-filter').value;
    var rows = auditRows.filter(function (l) { return !f || String(l.action || '') === f; });
    document.getElementById('a-out').innerHTML =
      '<p class="psub">' + rows.length + ' rows in sample of ' + auditRows.length + '.</p>' +
      '<table class="ad-tbl"><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Amount</th><th>By / note</th></tr></thead><tbody>' +
      (rows.slice(0, 100).map(function (l) {
        return '<tr><td style="white-space:nowrap">' + fullTs(tsMs(l.at)) + '</td>' +
          '<td><span class="pill done">' + esc(l.action || '?') + '</span></td>' +
          '<td class="mono">' + esc(String(l.target || '').slice(0, 14)) + '</td>' +
          '<td>' + money(l.amount) + '</td>' +
          '<td>' + esc(l.by || '') + (l.note ? '<br /><span class="mono">' + esc(l.note) + '</span>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="5">No rows.</td></tr>') + '</tbody></table>' +
      (rows.length > 100 ? '<p class="psub">First 100 shown — export CSV for all ' + rows.length + '.</p>' : '');
  }

  /* ---------- system ---------- */
  async function loadSystem() {
    var seatId = me ? await mySeatId(me.uid) : null;
    document.getElementById('s-out').innerHTML =
      '<div class="ad-panel"><h2>Session</h2><dl class="kv">' +
      '<dt>Signed in</dt><dd>' + esc(me ? (me.email || me.uid) : '—') + '</dd>' +
      '<dt>My seat</dt><dd class="mono">' + esc(seatId ? seatId + ' of 2' : '—') + '</dd>' +
      '<dt>Seat UID</dt><dd class="mono">' + esc(me ? me.uid : '—') + '</dd></dl>' +
      '<div class="ad-row"><button class="ad-btn ghost" id="sys-out">Sign out (site-wide)</button></div>' +
      '<p class="psub">Signing out here signs the owner out of the whole site (shared session).</p></div>' +
      '<div class="ad-panel"><h2>Rules checklist</h2><p class="psub">' +
      '1. Paste this repo\'s <span class="mono">firestore.rules</span> into Console → Firestore → Rules → Publish.<br />' +
      '2. Reload this page — Overview numbers prove the admin reads work.<br />' +
      '3. <span class="mono">robots.txt</span> already blocks <span class="mono">/Fav-Admin</span> from crawlers.<br />' +
      '4. Banned users carry <span class="mono">users/{uid}.disabled == true</span> — app pages should block earning for flagged accounts.</p></div>' +
      '<div class="ad-panel"><h2>Hardening follow-ups</h2><p class="psub">' +
      '· Two admin seats, first-come, max two — enforced in firestore.rules, no third seat can exist.<br />' +
      '· Amounts are client-enforced; full server authority needs a Cloud Function.<br />' +
      '· Admin reads bill per document — keep sample caps where they are.</p></div>';
    document.getElementById('sys-out').addEventListener('click', function () { try { signOut(auth); } catch (_) {} });
  }

  /* ---------- static wiring (elements exist at parse time) ---------- */
  document.getElementById('p-reload').addEventListener('click', function () { loadPayouts(); });
  document.getElementById('p-more').addEventListener('click', function () { payState.limit = Math.min(1000, payState.limit + 200); loadPayouts(); });
  document.getElementById('p-method').addEventListener('change', paintPayouts);
  document.getElementById('p-q').addEventListener('input', paintPayouts);
  document.getElementById('p-csv').addEventListener('click', function () {
    var rows = payFilter(payState.all);
    if (!rows.length) { show('Nothing to export.'); return; }
    downloadCSV('favmoney-payouts.csv', ['id', 'uid', 'method', 'dest', 'amount', 'status', 'when'],
      rows.map(function (c) { return [c.id, c.uid || '', c.method || '', c.dest || '', c.amount || 0, c.status || '', fullTs(tsMs(c.at))]; }));
  });
  document.getElementById('l-go').addEventListener('click', function () { ledgerLimit = 200; loadLedger(); });
  document.getElementById('l-more').addEventListener('click', function () {
    ledgerLimit = Math.min(1000, ledgerLimit + 300);
    loadLedger();
  });
  document.getElementById('l-filter').addEventListener('change', paintLedger);
  document.getElementById('l-q').addEventListener('input', paintLedger);
  document.getElementById('l-csv').addEventListener('click', function () {
    if (!ledgerRows.length) { show('Reload ledger first.'); return; }
    downloadCSV('favmoney-ledger.csv', ['uid', 'label', 'amount', 'status', 'when'],
      ledgerRows.map(function (p) { return [p.uid || '', p.label || '', p.amount || 0, p.status || '', fullTs(tsMs(p.at))]; }));
  });
  document.getElementById('e-gen').addEventListener('click', genSnippet);
  document.getElementById('e-copy').addEventListener('click', function () {
    var t = document.getElementById('e-snippet').textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { show('Snippet copied.'); }, function () { show('Copy blocked — select manually.'); });
      else show('Copy blocked — select manually.');
    } catch (_) { show('Copy blocked — select manually.'); }
  });
  document.getElementById('a-reload').addEventListener('click', function () { auditLimit = 200; loadAudit(); });
  document.getElementById('a-more').addEventListener('click', function () { auditLimit = Math.min(1000, auditLimit + 300); loadAudit(); });
  document.getElementById('a-filter').addEventListener('change', paintAudit);
  document.getElementById('a-csv').addEventListener('click', function () {
    if (!auditRows.length) { show('Reload audit first.'); return; }
    downloadCSV('favmoney-audit.csv', ['when', 'action', 'target', 'amount', 'by', 'note'],
      auditRows.map(function (l) { return [fullTs(tsMs(l.at)), l.action || '', l.target || '', l.amount || 0, l.by || '', l.note || '']; }));
  });

  setTimeout(ready, 6000);
})();
