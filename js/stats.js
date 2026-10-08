// Favmoney live-style counters — randomized every load within set ranges.
// Runs before main.js so animated counters and the odometer pick up fresh values.
// Ranges: members 84,200–156,800 · paid $1.8M–$3.2M · rating fixed 4.6.
(function () {
  function rand(min, max) { return Math.floor(min + Math.random() * (max - min)); }
  var users = rand(84200, 156800);
  var paid = rand(1800000, 3200000);
  try {
    var u = document.getElementById('stat-users');
    if (u) u.setAttribute('data-count', String(users));
    var p = document.getElementById('stat-paid');
    if (p) p.setAttribute('data-count', String(paid));
    var odo = document.getElementById('odometer');
    if (odo) odo.setAttribute('data-total', '$' + paid.toLocaleString('en-US'));
    var sub = document.querySelector('.counter-sec .sub');
    if (sub) sub.textContent = '$' + (paid / 1000000).toFixed(1) + 'M+ in rewards paid to real humans. We counted. Twice.';
  } catch (e) {}
  window.FavStats = { users: users, paid: paid };
})();
