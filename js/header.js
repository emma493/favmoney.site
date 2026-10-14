// Favmoney shared member header (ES module, no backend).
// Import from any page: `import { mountHeader, stopHeader } from './js/header.js'`
// Inside your onAuthStateChanged handler, call:
//   await mountHeader(user);   // user or null — paints chip, balance,
//                              // diamonds, and starts/stops the chest.
// Returns the wallet object for signed-in users (null for guests / on error),
// so pages can reuse it instead of calling getWallet() twice.
// Claim/balance authority is unchanged: paintDualChip + startDiamondChest
// from js/diamonds.js do the painting; this module only removes duplication.
import { getWallet } from './firebase.js';
import { paintDualChip, startDiamondChest } from './diamonds.js';
import { formatUSD } from './currency.js';

let stopChest = null;
function stop() {
  try { if (stopChest) stopChest(); } catch (_) { /* noop */ }
  stopChest = null;
}

// Drop the injected diamond adornment so logged-out headers never show a
// stale ◆ count (paintDualChip re-injects it on the next member paint).
function clearDia() {
  try {
    const dia = document.getElementById('chip-dia');
    if (dia) {
      const prev = dia.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('dia-sep')) prev.remove();
      dia.remove();
    }
  } catch (_) { /* noop */ }
}

export function paintGuestHeader() {
  stop();
  try {
    const chip = document.getElementById('user-chip');
    const bal = document.getElementById('chip-bal');
    const name = document.getElementById('chip-name');
    if (chip) chip.setAttribute('href', 'signin.html');
    if (name) name.textContent = 'Sign in';
    if (bal) bal.textContent = '—';
  } catch (_) { /* noop */ }
  clearDia();
}

export async function paintMemberHeader(user) {
  const email = (user && user.email) || 'Member';
  try {
    const chip = document.getElementById('user-chip');
    const name = document.getElementById('chip-name');
    if (chip) chip.setAttribute('href', 'profile.html');
    if (name) name.textContent = email.split('@')[0];
  } catch (_) { /* noop */ }
  try {
    const w = await getWallet(user.uid);
    paintDualChip(w.pending, w.diamonds);
    stop();
    stopChest = startDiamondChest(user.uid, {
      onBalance: function (w2) {
        try { paintDualChip(w2.pending, w2.diamonds); } catch (_) { /* noop */ }
      }
    });
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

export function stopHeader() { stop(); }
