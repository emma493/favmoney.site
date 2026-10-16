// Favmoney bell panel (ES module, no backend). Reads the `notifications`
// collection (bell-only feed) — Rewards dots stay on getUnclaimedRewards.
// Tap bell -> dropdown list of latest 30 -> opening marks all read.
import { getNotifications, getUnreadNotifCount, markNotifsRead } from './firebase.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function bellUnread(uid) {
  if (!uid) return 0;
  try { return await getUnreadNotifCount(uid); } catch (_) { return 0; }
}

// Paint the bell badge/ping from the unread notification count.
// Rewards navdot is painted separately and untouched.
export function paintBell(n) {
  var bb = document.getElementById('bell-badge');
  if (bb) { if (n > 0) { bb.textContent = n > 9 ? '9+' : n; bb.style.display = 'flex'; } else { bb.style.display = 'none'; } }
  var bell = document.getElementById('bell');
  if (bell) { var ping = bell.querySelector('.ping'); if (ping) ping.style.display = n > 0 ? '' : 'none'; }
}

function relTs(ts) {
  var ms = 0;
  try {
    if (!ts) return '';
    ms = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    if (!ms) return '';
  } catch (_) { return ''; }
  var d = Math.max(0, Math.round((Date.now() - ms) / 864e5));
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return d + ' days ago';
  return Math.floor(d / 30) + 'mo ago';
}

// Toggle the panel. Opening renders the list and clears the dot.
export async function bellToggle(uid) {
  var panel = document.getElementById('bell-panel');
  if (!panel) return;
  if (!panel.hidden) { panel.hidden = true; return; }
  panel.innerHTML = '<div class="np-head"><b>Notifications</b><button class="np-x" id="np-close" aria-label="Close">Close</button></div><p class="np-empty">Loading…</p>';
  panel.hidden = false;
  var rows = [];
  try { rows = await getNotifications(uid, 30); } catch (_) { rows = []; }
  panel.innerHTML = '<div class="np-head"><b>Notifications</b><button class="np-x" id="np-close" aria-label="Close">Close</button></div>'
    + (rows.length ? rows.map(function (r) {
      var href = esc(r.link || 'rewards.html');
      return '<a class="nitem" href="' + href + '"><b>' + esc(r.title || 'Update') + '</b><span>' + esc(r.body || '') + '</span><small>' + esc(relTs(r.at)) + '</small></a>';
    }).join('') : '<p class="np-empty">No new notifications.</p>');
  var x = document.getElementById('np-close');
  if (x) x.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden = true; });
  try { await markNotifsRead(uid); } catch (_) {}
  paintBell(0);
}
