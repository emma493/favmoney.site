// Favmoney Diamonds — shared floating chest + dual-balance chip (ES module).
// Import from any page: `import { paintDualChip, startDiamondChest } from './js/diamonds.js'`
// Pages keep their own auth flow; after sign-in + getWallet(), call:
//   paintDualChip(w.pending, w.diamonds);
//   startDiamondChest(uid, { onBalance: (w2) => paintDualChip(w2.pending, w2.diamonds) });
// The chest auto-injects its button + ad modal into the DOM (no HTML edits needed).
import { getWallet, getChestState, claimDiamondAd, claimDiamondPassive } from './firebase.js';

export const DIA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M9 3l3 6 3-6M12 9l0 12"/></svg>';
const CHEST_SVG = '<svg class="chest-scene" viewBox="0 0 96 80" aria-hidden="true"><defs><linearGradient id="chWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4226"/><stop offset=".55" stop-color="#4a2c1a"/><stop offset="1" stop-color="#2e1c10"/></linearGradient><linearGradient id="chGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#ffd75e"/><stop offset=".7" stop-color="#c9962e"/><stop offset="1" stop-color="#8a5f14"/></linearGradient><radialGradient id="chGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffdc82" stop-opacity=".95"/><stop offset=".6" stop-color="#ffb450" stop-opacity=".45"/><stop offset="1" stop-color="#ffb450" stop-opacity="0"/></radialGradient><linearGradient id="chGem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#bfe3ff"/><stop offset=".8" stop-color="#6aa9e8"/><stop offset="1" stop-color="#3b6ea5"/></linearGradient><linearGradient id="chFire" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset=".5" stop-color="#f0abfc"/><stop offset="1" stop-color="#67e8f9"/></linearGradient></defs><ellipse cx="48" cy="72" rx="30" ry="4" fill="#000" opacity=".35"/><rect x="22" y="64" width="9" height="7" rx="1.5" fill="#241407" stroke="#120903"/><rect x="65" y="64" width="9" height="7" rx="1.5" fill="#241407" stroke="#120903"/><path d="M17,38 L79,38 L75,64 L21,64 Z" fill="url(#chWood)" stroke="#160c05"/><path d="M19,51 L77,51 M38,40 L38,62 M58,40 L58,62" stroke="#241407" stroke-width="1" opacity=".55"/><rect x="19" y="62" width="58" height="3" fill="url(#chGold)"/><rect x="15" y="35" width="66" height="4" rx="2" fill="url(#chGold)"/><circle cx="24" cy="37" r="1.2" fill="#fff3c4"/><circle cx="72" cy="37" r="1.2" fill="#fff3c4"/><g class="g-closed"><path d="M17,36 C17,20 31,11 48,11 C65,11 79,20 79,36 Z" fill="url(#chWood)" stroke="#160c05"/><path d="M30,34 C32,24 40,18 48,18 M66,34 C64,24 56,18 48,18" stroke="#241407" stroke-width="1" fill="none" opacity=".55"/><rect x="15" y="33" width="66" height="5" rx="2.5" fill="url(#chGold)"/><rect x="42" y="33" width="12" height="13" rx="2" fill="url(#chGold)" stroke="#7a5410"/><circle cx="48" cy="39" r="2" fill="#241407"/><rect x="47" y="39" width="2" height="4" fill="#241407"/></g><g class="g-open"><g transform="rotate(-24 48 37)"><path d="M17,32 C17,12 31,3 48,3 C65,3 79,12 79,32 Z" fill="url(#chWood)" stroke="#160c05"/><rect x="15" y="29" width="66" height="5" rx="2.5" fill="url(#chGold)"/></g><ellipse cx="48" cy="37" rx="29" ry="5.5" fill="#0b0603"/><ellipse class="glow" cx="48" cy="33" rx="22" ry="9" fill="url(#chGlow)"/><g class="pile"><polygon points="48,16 54,19 57,25 54,31 48,34 42,31 39,25 42,19" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".8"/><path d="M48,25 L48,16 M48,25 L54,19 M48,25 L57,25 M48,25 L54,31 M48,25 L48,34 M48,25 L42,31 M48,25 L39,25 M48,25 L42,19" stroke="#ffffff" stroke-width=".6" opacity=".7"/><polygon points="48,21 51,23 52,25 51,27 48,29 45,27 44,25 45,23" fill="none" stroke="#ffffff" stroke-width=".6" opacity=".8"/><path d="M20,29 Q30,21 40,29 Q30,37 20,29 Z" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".7"/><path d="M20,29 L40,29 M30,23 L30,35" stroke="#ffffff" stroke-width=".6" opacity=".7"/><path d="M56,29 Q66,21 76,29 Q66,37 56,29 Z" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".7"/><path d="M56,29 L76,29 M66,23 L66,35" stroke="#ffffff" stroke-width=".6" opacity=".7"/><rect x="41" y="29" width="14" height="8" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".7"/><rect x="43.5" y="30.5" width="9" height="5" fill="none" stroke="#ffffff" stroke-width=".6" opacity=".8"/><circle cx="35" cy="22" r="2.6" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".6"/><circle cx="61" cy="22" r="2.6" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".6"/><polygon class="fire f-a" points="46,19 48.5,23 45,23" fill="url(#chFire)"/><polygon class="fire f-b" points="58,27 60.5,31 57,31" fill="url(#chFire)"/></g><polygon class="fl f1" points="36,9 38.5,12 36,15 33.5,12" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".5"/><polygon class="fl f2" points="52,6 54.5,9 52,12 49.5,9" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".5"/><polygon class="fl f3" points="63,11 65.5,14 63,17 60.5,14" fill="url(#chGem)" stroke="#e8f6ff" stroke-width=".5"/><polygon class="burst-gem" style="--dx:-16px" points="48,26 50,28 48,30 46,28" fill="url(#chGem)"/><polygon class="burst-gem" style="--dx:-8px;animation-delay:.05s" points="48,26 50,28 48,30 46,28" fill="url(#chFire)"/><polygon class="burst-gem" style="--dx:0px" points="48,25 50.5,28 48,31 45.5,28" fill="url(#chGem)"/><polygon class="burst-gem" style="--dx:8px;animation-delay:.08s" points="48,26 50,28 48,30 46,28" fill="url(#chFire)"/><polygon class="burst-gem" style="--dx:16px" points="48,26 50,28 48,30 46,28" fill="url(#chGem)"/><ellipse class="flash" cx="48" cy="28" rx="30" ry="13" fill="#fff7d6"/></g></svg>';

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
// opts: { flip: 'usd' | 'dia' | 'both', glow: true } replays the flip
// animation on change and flashes the dollar green (see css fav-flip/fav-glow).
function replayFlip(el) {
  if (!el) return;
  try {
    el.classList.remove('fav-flip');
    void el.offsetWidth;
    el.classList.add('fav-flip');
  } catch (_) {}
}
function replayGlow(el) {
  if (!el) return;
  try {
    el.classList.remove('fav-glow');
    void el.offsetWidth;
    el.classList.add('fav-glow');
  } catch (_) {}
}
export function paintDualChip(pending, diamonds, opts) {
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
    dia.setAttribute('title', 'Diamonds — play-only chips for Spin');
    const o = opts || {};
    if (o.flip === 'usd' || o.flip === 'both') replayFlip(bal);
    if (o.flip === 'dia' || o.flip === 'both') replayFlip(dia);
    if (o.glow) replayGlow(bal);
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
    chest.innerHTML = '<span class="chest-btn"><span class="chest-art">' + CHEST_SVG + '</span><span class="chest-count" id="dia-chest-count">0</span></span><span class="chest-sub" id="dia-chest-sub">Chest</span>';
    document.body.appendChild(chest);
  }
  const countEl = document.getElementById('dia-chest-count');
  const subEl = document.getElementById('dia-chest-sub');

  function pageBurst() {
    try {
      if (!chest) return;
      chest.classList.remove('burst');
      void chest.offsetWidth;
      chest.classList.add('burst');
      setTimeout(function () { try { chest.classList.remove('burst'); } catch (_) {} }, 950);
    } catch (_) {}
  }

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
          pageToast('+' + r.reward + ' diamonds — spend them on Spin.');
          pageBurst();
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
          pageBurst();
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
