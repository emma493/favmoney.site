// Favmoney shared member header (ES module, no backend).
// Import from any page: `import { mountHeader, stopHeader } from './js/header.js'`
// Inside your onAuthStateChanged handler, call:
//   await mountHeader(user);   // user or null — paints chip + balance.
// Returns the wallet object for signed-in users (null for guests / on error),
// so pages can reuse it instead of calling getWallet() twice.
import { getWallet, subscribeWallet } from './firebase.js';
import { formatUSD } from './currency.js';

// Active live-wallet unsubscribe (one per mounted header). Cleared by stopHeader().
let _walletUnsub = null;

// No avatar in the nav bar by design: the member chip shows balance + name
// only. (Member avatars still live on the profile page and leaderboards.)
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
  stopHeader();
}

export async function paintMemberHeader(user) {
  const chipInitial = ((user && (user.email || user.displayName || 'Member')) || 'Member')
    .charAt(0).toUpperCase();
  try {
    const chip = document.getElementById('user-chip');
    const name = document.getElementById('chip-name');
    if (chip) chip.setAttribute('href', 'profile.html');
    if (name) name.textContent = chipInitial;
    clearAvatar();
  } catch (_) { /* noop */ }
  // Initial read to paint immediately.
  let initial = null;
  try {
    initial = await getWallet(user.uid);
    try {
      const bal = document.getElementById('chip-bal');
      if (bal) bal.textContent = formatUSD(initial.pending);
    } catch (_) { /* noop */ }
  } catch (_) {
    try { document.getElementById('chip-bal').textContent = formatUSD(0); } catch (_) { /* noop */ }
    return null;
  }
  // Live subscription: re-paint chip-bal on every wallet change.
  stopHeader();
  try {
    _walletUnsub = subscribeWallet(user.uid, (w) => {
      try {
        const bal = document.getElementById('chip-bal');
        if (bal) bal.textContent = formatUSD(w.pending);
      } catch (_) { /* noop */ }
    });
  } catch (_) { /* live balance is a nicety — silent fail OK */ }
  return initial;
}

export async function mountHeader(user) {
  if (!user) { paintGuestHeader(); return null; }
  return paintMemberHeader(user);
}

export function stopHeader() {
  try { if (_walletUnsub) { _walletUnsub(); _walletUnsub = null; } } catch (_) {}
}
