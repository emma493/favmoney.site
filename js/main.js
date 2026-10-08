// Favmoney landing interactions (vanilla, no deps)
(function () {
  var root = document.documentElement;

  // 1. Header blur on scroll
  function onScroll() {
    if (window.scrollY > 0) root.setAttribute('data-top-nav-scrolled', 'true');
    else root.removeAttribute('data-top-nav-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 2. Toast helper (static mock auth)
  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
  }

  // 3. Email validation + mock signup
  var form = document.getElementById('email-form');
  var email = document.getElementById('email');
  var startBtn = document.getElementById('start-btn');
  var field = document.getElementById('email-field');
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  if (email && startBtn) {
    email.addEventListener('input', function () {
      var ok = validEmail(email.value.trim());
      startBtn.disabled = !ok;
      field.classList.toggle('invalid', email.value.length > 3 && !ok);
    });
  }
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = email.value.trim();
      if (!validEmail(v)) {
        field.classList.add('invalid');
        showToast('Please enter a valid email to claim your free account.');
        return;
      }
      if (window.FavStore) { FavStore.addToWaitlist(v); FavStore.setUser({ email: v, at: new Date().toISOString(), provider: 'email' }); }
      else { try { localStorage.setItem('favmoney_waitlist', JSON.stringify({ email: v, at: new Date().toISOString() })); } catch (err) {} }
      showToast('You are on the list! We saved ' + v + ' — invites open soon.');
      email.value = '';
      startBtn.disabled = true;
    });
  }
  document.querySelectorAll('[data-oauth]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var provider = btn.getAttribute('data-oauth');
      if (provider !== 'Google') {
        showToast(provider + ' is not enabled. Use Google or email.');
        return;
      }
      try {
        var fb = await import('./firebase.js');
        var cred = await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
        await fb.ensureUserDoc(cred.user, 'google');
        if (window.FavStore) FavStore.setUser({ uid: cred.user.uid, email: cred.user.email, at: new Date().toISOString(), provider: 'google' });
        try { fb.track('login', { method: 'google' }); } catch (e) {}
        showToast('Signed in with Google. Redirecting…');
        setTimeout(function () { location.href = 'tasks.html'; }, 900);
      } catch (err) {
        if (err && err.code === 'auth/popup-closed-by-user') showToast('Google popup closed. Try again.');
        else showToast('Google sign-in failed here. Continue on Sign Up page.');
      }
    });
  });
  var signin = document.querySelector('[data-signin]');
  if (signin) signin.addEventListener('click', function () {
    setTimeout(function () { showToast('Sign-in is coming soon — join the waitlist above to get early access.'); }, 350);
  });

  // 3b. Footer stubs: cookie settings, language, social placeholders
  document.querySelectorAll('[data-cookie]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      try { localStorage.setItem('favmoney_cookies', JSON.stringify({ choice: 'essential', at: new Date().toISOString() })); } catch (e) {}
      showToast('Cookie preferences saved for this browser.');
    });
  });
  document.querySelectorAll('[data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showToast('English is the current language. More languages coming soon.');
    });
  });
  document.querySelectorAll('[data-soon]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showToast('Our social pages launch soon. Join the waitlist to hear first.');
    });
  });

  // 4. FAQ accordion (single-open)
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('button');
    btn.addEventListener('click', function () {
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        o.classList.remove('open');
        o.querySelector('button').setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // 5. Reveal on scroll
  var io = null;
  function reveal(el) { el.classList.add('in'); }
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.rv').forEach(reveal);
  }

  // 6. Animated stat counters
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (!target) return;
    var dur = 1400, t0 = null;
    function fmt(n) { return n.toLocaleString('en-US'); }
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target.toLocaleString('en-US');
      return;
    }
    requestAnimationFrame(step);
  }
  var counted = false;
  var statsEl = document.querySelector('.stats');
  if (statsEl && 'IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !counted) {
          counted = true;
          document.querySelectorAll('[data-count]').forEach(animateCount);
          sio.disconnect();
        }
      });
    }, { threshold: 0.3 });
    sio.observe(statsEl);
  }

  // 7. Odometer (total seeded by js/stats.js)
  var odo = document.getElementById('odometer');
  if (odo) {
    var str = odo.getAttribute('data-total') || '$2,400,000';
    str.split('').forEach(function (ch) {
      var d = document.createElement('span');
      if (ch === '$' || ch === ',') { d.className = 'digit sym'; d.textContent = ch; }
      else { d.className = 'digit'; d.textContent = ch; }
      odo.appendChild(d);
    });
  }

  // 8. Active nav link on scroll
  var sections = ['top', 'rewards'];
  function setActive() {
    var y = window.scrollY + 120;
    var current = 'top';
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.offsetTop <= y) current = id;
    });
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = a.getAttribute('href');
      var on = (href === '#top' && current === 'top') || (href === '#rewards' && current === 'rewards');
      a.classList.toggle('active', on);
    });
  }
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();

  // 9. Deep-link #signup-form focus nudge
  if (location.hash === '#signup-form') {
    setTimeout(function () {
      var em = document.getElementById('email');
      if (em) em.focus({ preventScroll: true });
    }, 500);
  }
})();
