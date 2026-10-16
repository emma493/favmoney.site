// Favmoney shared member header (ES module, no backend).
// Import from any page: `import { mountHeader, stopHeader } from './js/header.js'`
// Inside your onAuthStateChanged handler, call:
//   await mountHeader(user);   // user or null — paints chip + balance.
// Returns the wallet object for signed-in users (null for guests / on error),
// so pages can reuse it instead of calling getWallet() twice.
import { getWallet } from './firebase.js';
import { formatUSD } from './currency.js';
import { avatarImg } from './avatars.js';

function paintAvatar(uid) {
  try {
    const chip = document.getElementById('user-chip');
    if (!chip) return;
    let av = document.getElementById('chip-av');
    if (!av) {
      av = document.createElement('span');
      av.className = 'fav-av';
      av.id = 'chip-av';
      chip.insertBefore(av, chip.firstChild);
    }
    av.innerHTML = avatarImg(uid, 22);
  } catch (_) { /* noop */ }
}

function clearAvatar() {
  try {
    const av = document.getElementById('chip-av');
    if (av) av.remove();
  } catch (_) { /* noop */ }
}

export function paintGuestHeader() {
  try {
    const chip = document.getElementById('user-chip');
    const bal = document.getElementById('chip-bal');
    const name = document.getElementById('chip-name');
    if (chip) chip.setAttribute('href', 'signin.html');
    if (name) name.textContent = 'Sign in';
    if (bal) bal.textContent = '—';
  } catch (_) { /* noop */ }
  clearAvatar();
}

export async function paintMemberHeader(user) {
  const email = (user && user.email) || 'Member';
  try {
    const chip = document.getElementById('user-chip');
    const name = document.getElementById('chip-name');
    if (chip) chip.setAttribute('href', 'profile.html');
    if (name) name.textContent = email.split('@')[0];
    paintAvatar(user.uid);
  } catch (_) { /* noop */ }
  try {
    const w = await getWallet(user.uid);
    try {
      const bal = document.getElementById('chip-bal');
      if (bal) bal.textContent = formatUSD(w.pending);
    } catch (_) { /* noop */ }
    return w;
  } catch (_) {
    try { document.getElementById('chip-bal').textContent = formatUSD(0); } catch (_) { /* noop */ }
    return null;
  }
}

export async function mountHeader(user) {
  if (!user) { paintGuestHeader(); return null; }
  return paintMemberHeader(user);
}

export function stopHeader() {}
