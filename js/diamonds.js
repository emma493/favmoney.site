// Favmoney Diamonds — shared floating chest + dual-balance chip (ES module).
// Import from any page: `import { paintDualChip, startDiamondChest } from './js/diamonds.js'`
// Pages keep their own auth flow; after sign-in + getWallet(), call:
//   paintDualChip(w.pending, w.diamonds);
//   startDiamondChest(uid, { onBalance: (w2) => paintDualChip(w2.pending, w2.diamonds) });
// The chest auto-injects its button + ad modal into the DOM (no HTML edits needed).
import { getWallet, getChestState, claimDiamondAd, claimDiamondPassive } from './firebase.js';

export const DIA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M9 3l3 6 3-6M12 9l0 12"/></svg>';
const CHEST_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V8z"/><path d="M3 10v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8"/><path d="M12 12v6M9.5 13.5 12 11l2.5 2.5"/></svg>';

function fmtClock(ms) {
  ms = Math.max(0, Number(ms || 0));
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  const ss = s % 60, mm = m % 60;
  if (h > 0) return h + 'h ' + (mm < 10 ? '0' : '') + mm + 'm';
  if (m > 0) return m + 'm ' + (ss < 10 ? '0' : '') + ss + 's';
  return ss + 's';
}

function pageToast(msg) {
  try {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__diaTm);
    t.__diaTm = setTimeout(function () { t.classList.remove('show'); }, 3400);
  } catch (_) {}
}

// Paint `$X.XX | ◆ N` into the standard header chip. Injects the diamond span
// on first call so no per-page HTML edit is required.
export function paintDualChip(pending, diamonds) {
  try {
    const bal = document.getElementById('chip-bal');
    if (bal) bal.textContent = '$' + Number(pending || 0).toFixed(2);
    const chip = document.getElementById('user-chip');
    if (!chip) return;
    let dia = document.getElementById('chip-dia');
    if (!dia) {
      const sep = document.createElement('span');
      sep.className = 'dia-sep';
      sep.textContent = '|';
      dia = document.createElement('span');
      dia.className = 'dia';
      dia.id = 'chip-dia';
      chip.insertBefore(sep, document.getElementById('chip-name'));
      chip.insertBefore(dia, document.getElementById('chip-name'));
    }
    dia.innerHTML = DIA_SVG + '<span>' + Math.max(0, Math.floor(Number(diamonds || 0))) + '</span>';
    dia.setAttribute('title', 'Diamonds — play-only chips for Spin, Flip, Dice');
  } catch (_) {}
}

// Mount the floating chest for a signed-in user. Returns a stop() function.
// opts.onBalance(wallet) fires after every successful claim so pages repaint.
export function startDiamondChest(uid, opts) {
  const o = opts || {};
  if (!uid) return function () {};
  let stopped = false, timer = null, busy = false;
  let w = { diamonds: 0, lastDiamondAdAt: 0, lastDiamondPassiveAt: Date.now() };

  // --- inject chest button ---
  let chest = document.getElementById('dia-chest');
  if (!chest) {
    chest = document.createElement('button');
    chest.id = 'dia-chest';
    chest.type = 'button';
    chest.setAttribute('aria-label', 'Diamond chest — earn play chips');
    chest.innerHTML = '<span class="chest-btn">' + CHEST_SVG + '<span class="chest-count" id="dia-chest-count">0</span></span><span class="chest-sub" id="dia-chest-sub">Chest</span>';
    document.body.appendChild(chest);
  }
  const countEl = document.getElementById('dia-chest-count');
  const subEl = document.getElementById('dia-chest-sub');

  // --- inject ad modal (namespaced, Grow untouched) ---
  let veil = document.getElementById('dia-ad-modal');
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'dia-veil';
    veil.id = 'dia-ad-modal';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-label', 'Sponsored view for diamonds');
    veil.innerHTML =
      '<div class="dia-box"><div class="dia-stage"><div class="mark">' + CHEST_SVG + '</div>' +
      '<h3 id="dia-ad-title">Diamond break</h3><p id="dia-ad-text"></p></div>' +
      '<div class="dia-foot"><div class="dia-timer"><span id="dia-ad-msg">Keep this view visible…</span><b id="dia-ad-count">20s</b></div>' +
      '<div class="prog" style="margin:0 0 14px"><i id="dia-ad-bar" style="width:0%"></i></div>' +
      '<button class="btn btn-green btn-block" id="dia-ad-go" style="display:none">Continue · claim diamonds</button>' +
      '<button class="btn btn-ghost btn-block" id="dia-ad-close" style="margin-top:8px">Close</button></div></div>';
    document.body.appendChild(veil);
  }

  const ADS = [
    ['Spin costs diamonds, wins pay cash', 'One free spin a day. Extra spins cost diamonds — prizes land as bonus chips and small USD cents.'],
    ['Invite pays both ways', 'Friends get $1.00 instantly, you get $0.50 instantly. Your link lives on the Invite page.'],
    ['Cash out from $5', 'PayPal, Visa prepaid and crypto. Diamonds stay in games — cash stays withdrawable.']
  ];
  let adIdx = 0;
  const AD_MS = 20000;
  let adLeft = AD_MS, adTimer = null, adOpen = false;

  function paintAd() {
    const s = Math.max(0, Math.ceil(adLeft / 1000));
    const c = document.getElementById('dia-ad-count');
    const bar = document.getElementById('dia-ad-bar');
    const msg = document.getElementById('dia-ad-msg');
    if (c) c.textContent = s + 's';
    if (bar) bar.style.width = Math.min(100, (AD_MS - adLeft) / AD_MS * 100) + '%';
    if (msg) msg.textContent = document.hidden ? 'Paused — keep this view visible…' : (adLeft > 0 ? 'Keep this view visible…' : 'View verified.');
  }
  function closeAd() {
    adOpen = false;
    if (adTimer) { clearInterval(adTimer); adTimer = null; }
    veil.classList.remove('open');
  }
  function openAd() {
    adIdx = (adIdx + 1) % ADS.length;
    document.getElementById('dia-ad-title').textContent = ADS[adIdx][0];
    document.getElementById('dia-ad-text').textContent = ADS[adIdx][1];
    veil.classList.add('open');
    document.getElementById('dia-ad-go').style.display = 'none';
    adLeft = AD_MS; adOpen = true; paintAd();
    if (adTimer) clearInterval(adTimer);
    adTimer = setInterval(function () {
      if (!adOpen) return;
      if (!document.hidden) adLeft -= 250;
      paintAd();
      if (adLeft <= 0) {
        clearInterval(adTimer); adTimer = null;
        document.getElementById('dia-ad-go').style.display = '';
      }
    }, 250);
  }
  const closeBtn = document.getElementById('dia-ad-close');
  if (closeBtn && !closeBtn.__diaWired) {
    closeBtn.__diaWired = true;
    closeBtn.addEventListener('click', closeAd);
  }
  const goBtn = document.getElementById('dia-ad-go');
  if (goBtn && !goBtn.__diaWired) {
    goBtn.__diaWired = true;
    goBtn.addEventListener('click', async function () {
      closeAd();
      if (busy) return;
      busy = true;
      try {
        const r = await claimDiamondAd(uid);
        if (r.ok) {
          pageToast('+' + r.reward + ' diamonds — spend them on Spin, Flip, Dice.');
          await refresh(true);
        } else if (r.reason === 'cooldown') {
          pageToast('Chest refills in ' + fmtClock(r.waitMs) + '.');
          await refresh(false);
        } else {
          pageToast('Claim failed — check connection and try again.');
        }
      } catch (_) { pageToast('Claim failed — check connection and try again.'); }
      busy = false;
    });
  }

  async function onChestTap() {
    if (busy) return;
    const st = getChestState(w, Date.now());
    // Passive first: free, no ad.
    if (st.passiveReady) {
      busy = true;
      try {
        const r = await claimDiamondPassive(uid);
        if (r.ok) {
          pageToast('+' + r.reward + ' diamonds from the chest drip.');
          await refresh(true);
        } else { openAdIfReady(st); }
      } catch (_) { pageToast('Claim failed — check connection and try again.'); }
      busy = false;
      return;
    }
    openAdIfReady(st);
  }
  function openAdIfReady(st) {
    const s = st || getChestState(w, Date.now());
    if (s.adReady) { openAd(); return; }
    const nextMs = Math.min(s.adWaitMs, s.passiveWaitMs);
    pageToast('Chest refills in ' + fmtClock(nextMs) + ' — passive drip lands first.');
  }
  if (!chest.__diaWired) {
    chest.__diaWired = true;
    chest.addEventListener('click', onChestTap);
  }

  function paint() {
    if (stopped) return;
    const st = getChestState(w, Date.now());
    if (countEl) countEl.textContent = st.diamonds;
    if (subEl) {
      if (st.passiveReady) subEl.textContent = 'Claim +2';
      else if (st.adReady) subEl.textContent = 'Watch ad · 2–10';
      else subEl.textContent = fmtClock(Math.min(st.adWaitMs, st.passiveWaitMs));
    }
    chest.classList.toggle('ready', st.ready);
    chest.setAttribute('aria-label', st.passiveReady ? 'Diamond chest ready — claim 2 diamonds' : (st.adReady ? 'Diamond chest ready — watch an ad for 2 to 10 diamonds' : 'Diamond chest refills soon'));
  }
  async function refresh(notify) {
    try {
      w = await getWallet(uid);
      paint();
      if (notify && typeof o.onBalance === 'function') { try { o.onBalance(w); } catch (_) {} }
    } catch (_) {}
  }
  async function boot() {
    await refresh(true);
    paint();
    if (!stopped) timer = setInterval(paint, 1000);
  }
  boot();
  return function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    closeAd();
  };
}
