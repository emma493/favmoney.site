// Favmoney auth gate — three states only: unknown -> member | login page.
// There is deliberately NO guest state: every app page calls requireAuth()
// first and renders nothing until Firebase resolves. Logged-out visitors are
// hard-redirected to signin.html?next=<page> instead of ever seeing app UI.
import { auth, onAuthStateChanged } from './firebase.js';

var resolved = false;
var cachedUser = null;
var waiters = [];

// Persistent session hint: proves THIS browser has signed in before.
// Written on every confirmed login, cleared ONLY by an explicit sign-out
// tap. Survives slow networks/CDN where Firebase hasn't answered yet, so
// the gate can tell "member, still checking" apart from "genuine guest".
var HINT_KEY = 'fav_had_session';
function readHint() {
  try {
    var raw = localStorage.getItem(HINT_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (o && o.uid) return o;
    return null;
  } catch (_) { return null; }
}
function writeHint(user) {
  try {
    if (user && user.uid) localStorage.setItem(HINT_KEY, JSON.stringify({ uid: user.uid, at: Date.now() }));
  } catch (_) {}
}
export function clearSessionHint() {
  try { localStorage.removeItem(HINT_KEY); } catch (_) {}
}

function settle(user) {
  if (resolved) return;
  resolved = true;
  cachedUser = user || null;
  if (cachedUser) writeHint(cachedUser);
  try { document.documentElement.setAttribute('data-auth', cachedUser ? 'member' : 'leaving'); } catch (_) {}
  var w = waiters; waiters = [];
  for (var i = 0; i < w.length; i++) { try { w[i](cachedUser); } catch (_) {} }
}

try {
  onAuthStateChanged(auth, function (user) { settle(user || null); });
} catch (_) {}

function loginTarget() {
  try {
    var file = (location.pathname.split('/').pop() || 'earn.html');
    if (!/^[a-z0-9_-]+\.html?$/i.test(file)) file = 'earn.html';
    try { sessionStorage.setItem('fav_next', file); } catch (_) {}
    return 'signin.html?next=' + encodeURIComponent(file);
  } catch (_) { return 'signin.html'; }
}

function goLogin() {
  try { location.replace(loginTarget()); } catch (_) {}
}

// Gate for app pages. Resolves with the Firebase user. Redirects to signin
// ONLY on an explicit "no user" answer from Firebase — never on a timeout
// when this browser has a session hint. No navigation, however slow, can
// bounce a member to login: with a hint present the loader simply holds
// (with the page's retry button) until Firebase answers.
// Genuine first-time guests (no hint) still redirect after 8s so nobody
// hangs on a spinner.
export function requireAuth() {
  return new Promise(function (resolve) {
    if (resolved) {
      if (cachedUser) resolve(cachedUser);
      else goLogin();
      return;
    }
    var done = false;
    waiters.push(function (u) {
      if (done) return; done = true;
      if (u) { writeHint(u); resolve(u); }
      else goLogin();
    });
    setTimeout(function () {
      if (done || resolved) return; done = true;
      if (readHint()) return; // member, still checking — hold, never redirect
      goLogin();
    }, 8000);
  });
}

// Non-redirecting peek for public pages (signin/signup bounce to the app
// when already logged in). Resolves null when signed out or unreachable.
export function currentUserOnce() {
  return new Promise(function (resolve) {
    if (resolved) { resolve(cachedUser); return; }
    var done = false;
    waiters.push(function (u) { if (!done) { done = true; resolve(u); } });
    setTimeout(function () { if (!done) { done = true; resolve(cachedUser); } }, 8000);
  });
}

// Safe post-login landing: ?next= file, else stashed page, else fallback.
// Never returns signin/signup (redirect loops).
export function nextTarget(fallback) {
  var fb = fallback || 'earn.html';
  try {
    var q = '';
    try { q = new URLSearchParams(location.search).get('next') || ''; } catch (_) { q = ''; }
    if (/^[a-z0-9_-]+\.html?$/i.test(q) && !/^sign(in|up)\.html?$/i.test(q)) return q;
    var s = '';
    try { s = sessionStorage.getItem('fav_next') || ''; } catch (_) { s = ''; }
    try { sessionStorage.removeItem('fav_next'); } catch (_) {}
    if (/^[a-z0-9_-]+\.html?$/i.test(s) && !/^sign(in|up)\.html?$/i.test(s)) return s;
  } catch (_) {}
  return fb;
}
