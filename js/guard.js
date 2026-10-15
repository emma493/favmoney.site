// Favmoney auth gate — three states only: unknown -> member | login page.
// There is deliberately NO guest state: every app page calls requireAuth()
// first and renders nothing until Firebase resolves. Logged-out visitors are
// hard-redirected to signin.html?next=<page> instead of ever seeing app UI.
import { auth, onAuthStateChanged } from './firebase.js';

var resolved = false;
var cachedUser = null;
var waiters = [];

function settle(user) {
  if (resolved) return;
  resolved = true;
  cachedUser = user || null;
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

// Gate for app pages. Resolves with the Firebase user. Never resolves for
// logged-out visitors — they are redirected to signin instead, so no page
// ever renders guest content, guest banners, or "Sign in" text.
// 8s fallback: if Firebase is unreachable, go to signin (which surfaces the
// network error) instead of hanging on the loader forever.
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
      if (u) resolve(u);
      else goLogin();
    });
    setTimeout(function () {
      if (done || resolved) return; done = true;
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
