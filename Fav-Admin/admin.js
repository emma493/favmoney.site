// Fav-Admin: single-seat gate (signup once -> signin + TOTP) + empty shell.
// Auth: Firebase email/password (hashed server-side, never in code).
// Single seat: Firestore admin/owner created once; rules reject a second seat.
// 2FA: app-level RFC 6238 TOTP, secret in admin/owner (owner-only read).
import { auth, db } from '../js/firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

var SES_KEY = 'fav-admin-auth';
var ownerRef = doc(db, 'admin', 'owner');
var pendingSecret = null;
var creatingSeat = false;
var attempts = 0, lockUntil = 0;

function $(id) { return document.getElementById(id); }
function show(view) {
  ['view-signup', 'view-setup', 'view-signin', 'view-verify'].forEach(function (v) {
    $(v).style.display = v === view ? '' : 'none';
  });
}
function err(id, msg) {
  var e = $(id);
  if (!msg) { e.textContent = ''; e.classList.remove('show'); return; }
  e.textContent = msg;
  e.classList.add('show');
}
function locked() {
  if (Date.now() < lockUntil) return true;
  if (attempts >= 5) {
    lockUntil = Date.now() + 60000;
    attempts = 0;
    return true;
  }
  return false;
}
function fail(id, msg) {
  attempts++;
  err(id, locked() ? 'Too many tries — wait 60 seconds.' : msg);
}
function authed(uid) {
  try { sessionStorage.setItem(SES_KEY, uid); } catch (e) {}
  document.body.classList.add('authed');
  document.title = 'Fav-Admin · Overview';
}
function deauthed() {
  try { sessionStorage.removeItem(SES_KEY); } catch (e) {}
  document.body.classList.remove('authed');
  document.title = 'Fav-Admin · Sign in';
}

/* ---- TOTP (RFC 6238, SHA-1, 30s, 6 digits) ---- */
var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(bytes) {
  var out = '', bits = 0, val = 0;
  for (var i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32decode(s) {
  s = String(s).replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
  var out = [], bits = 0, val = 0;
  for (var i = 0; i < s.length; i++) {
    var n = B32.indexOf(s[i]);
    if (n < 0) throw new Error('bad key');
    val = (val << 5) | n;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function hotp(secret, counter) {
  var key = await crypto.subtle.importKey('raw', b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  var msg = new ArrayBuffer(8);
  var dv = new DataView(msg);
  dv.setUint32(0, Math.floor(counter / 4294967296));
  dv.setUint32(4, counter >>> 0);
  var sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  var o = sig[19] & 15;
  var code = ((sig[o] & 127) << 24) | (sig[o + 1] << 16) | (sig[o + 2] << 8) | sig[o + 3];
  return String(code % 1000000).padStart(6, '0');
}
async function verifyTotp(secret, code) {
  var c = Math.floor(Date.now() / 30000);
  for (var d = -1; d <= 1; d++) {
    try { if (await hotp(secret, c + d) === code) return true; } catch (e) { return false; }
  }
  return false;
}
function newSecret() {
  var b = new Uint8Array(20);
  crypto.getRandomValues(b);
  return b32encode(b);
}

/* ---- flows ---- */
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

async function doSignup() {
  err('su-err');
  if (locked()) { fail('su-err', ''); return; }
  var email = $('su-email').value.trim(), pass = $('su-pass').value;
  if (!validEmail(email)) { fail('su-err', 'Enter a valid email.'); return; }
  if (pass.length < 8) { fail('su-err', 'Password needs 8+ characters.'); return; }
  var btn = $('su-go');
  btn.disabled = true;
  creatingSeat = true;
  try {
    var cred = await createUserWithEmailAndPassword(auth, email, pass);
    try {
      await setDoc(ownerRef, { uid: cred.user.uid, email: email, createdAt: serverTimestamp(), totpSecret: null });
    } catch (e) {
      // Seat already claimed: drop this stray auth account from the client.
      try { await signOut(auth); } catch (_) {}
      fail('su-err', 'Seat already claimed — use sign in.');
      btn.disabled = false;
      return;
    }
    attempts = 0;
    creatingSeat = false;
    enterSetup();
    if (window.FavLoader) FavLoader.pageReady();
  } catch (e) {
    creatingSeat = false;
    var msg = (e && e.code === 'auth/email-already-in-use')
      ? 'Email already registered — use sign in.'
      : 'Signup failed — check connection and that Email/Password auth is on.';
    fail('su-err', msg);
    btn.disabled = false;
  }
}

function enterSetup() {
  pendingSecret = newSecret();
  $('setup-key').textContent = pendingSecret;
  $('setup-code').value = '';
  err('setup-err');
  show('view-setup');
}

async function doSetup() {
  err('setup-err');
  var code = $('setup-code').value.replace(/\D/g, '');
  if (code.length !== 6) { fail('setup-err', 'Enter the 6-digit code.'); return; }
  if (!pendingSecret) { fail('setup-err', 'Reload and sign in again.'); return; }
  if (!(await verifyTotp(pendingSecret, code))) { fail('setup-err', 'Code did not match — try the current one.'); return; }
  try {
    await updateDoc(ownerRef, { totpSecret: pendingSecret });
    pendingSecret = null;
    attempts = 0;
    enterShell();
  } catch (e) {
    fail('setup-err', 'Could not save — check connection and rules.');
  }
}

async function doSignin() {
  err('si-err');
  if (locked()) { fail('si-err', ''); return; }
  var email = $('si-email').value.trim(), pass = $('si-pass').value;
  if (!validEmail(email) || !pass) { fail('si-err', 'Enter email and password.'); return; }
  var btn = $('si-go');
  btn.disabled = true;
  try {
    var cred = await signInWithEmailAndPassword(auth, email, pass);
    var snap = await getDoc(ownerRef);
    if (!snap.exists() || snap.data().uid !== cred.user.uid) {
      try { await signOut(auth); } catch (_) {}
      fail('si-err', 'This account is not the admin.');
      btn.disabled = false;
      return;
    }
    attempts = 0;
    btn.disabled = false;
    if (!snap.data().totpSecret) { enterSetup(); return; }
    $('vf-code').value = '';
    err('vf-err');
    show('view-verify');
  } catch (e) {
    fail('si-err', 'Wrong email or password.');
    btn.disabled = false;
  }
}

async function doVerify() {
  err('vf-err');
  var code = $('vf-code').value.replace(/\D/g, '');
  if (code.length !== 6) { fail('vf-err', 'Enter the 6-digit code.'); return; }
  var btn = $('vf-go');
  btn.disabled = true;
  try {
    var snap = await getDoc(ownerRef);
    var secret = snap.exists() ? snap.data().totpSecret : null;
    if (secret && await verifyTotp(secret, code)) {
      attempts = 0;
      enterShell();
    } else {
      fail('vf-err', 'Wrong code — try the current one.');
    }
  } catch (e) {
    fail('vf-err', 'Could not verify — check connection.');
  }
  btn.disabled = false;
}

function enterShell() {
  var uid = (auth.currentUser && auth.currentUser.uid) || '';
  try { uid = uid || sessionStorage.getItem(SES_KEY) || ''; } catch (e) {}
  authed(uid);
  if (window.FavLoader) FavLoader.pageReady();
}

async function doLogout() {
  try { await signOut(auth); } catch (e) {}
  deauthed();
  show('view-signin');
}

/* ---- wire up ---- */
$('su-go').addEventListener('click', doSignup);
$('setup-go').addEventListener('click', doSetup);
$('si-go').addEventListener('click', doSignin);
$('vf-go').addEventListener('click', doVerify);
$('to-signin').addEventListener('click', function () { err('su-err'); show('view-signin'); });
$('vf-out').addEventListener('click', doLogout);
$('ad-logout').addEventListener('click', doLogout);
$('copy-key').addEventListener('click', async function () {
  try { await navigator.clipboard.writeText($('setup-key').textContent); } catch (e) {
    var r = document.createRange();
    r.selectNodeContents($('setup-key'));
    var s = getSelection();
    s.removeAllRanges(); s.addRange(r);
  }
});
[['su-pass', 'su-go', doSignup], ['si-pass', 'si-go', doSignin],
 ['setup-code', 'setup-go', doSetup], ['vf-code', 'vf-go', doVerify]
].forEach(function (t) {
  $(t[0]).addEventListener('keydown', function (e) { if (e.key === 'Enter') t[2](); });
});

/* ---- boot: resume session or show signin ---- */
if (window.FavLoader) FavLoader.hold();
try {
  onAuthStateChanged(auth, async function (user) {
    if (creatingSeat) {
      if (window.FavLoader) FavLoader.pageReady();
      return;
    }
    if (!user) {
      deauthed();
      show('view-signin');
      if (window.FavLoader) FavLoader.pageReady();
      return;
    }
    var sess = null;
    try { sess = sessionStorage.getItem(SES_KEY); } catch (e) {}
    if (sess === user.uid) { enterShell(); return; }
    // Fresh auth without a verified session: re-check the seat, then decide.
    try {
      var snap = await getDoc(ownerRef);
      if (snap.exists() && snap.data().uid === user.uid) {
        if (!snap.data().totpSecret) { show('view-setup'); if (!pendingSecret) enterSetup(); }
        else { $('vf-code').value = ''; show('view-verify'); }
      } else {
        try { await signOut(auth); } catch (_) {}
        deauthed();
        show('view-signin');
        err('si-err', 'This account is not the admin.');
      }
    } catch (e) {
      deauthed();
      show('view-signin');
    }
    if (window.FavLoader) FavLoader.pageReady();
  });
} catch (e) {
  show('view-signin');
  if (window.FavLoader) FavLoader.pageReady();
}
