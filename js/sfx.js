// Favmoney SFX — tiny WebAudio coin-pour synth, zero assets, offline-safe.
// Import: `import { coinPour, isMuted, toggleMute } from './js/sfx.js'`
// Sound unlocks on the first user-gesture call (autoplay policy); background
// tabs stay silent. Mute persists in localStorage ('fav_mute').
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('fav_mute') === '1'; } catch (_) {}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('fav_mute', muted ? '1' : '0'); } catch (_) {}
  return muted;
}

function ac() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  } catch (_) { return null; }
}

// Coins pouring: a quick arpeggio of bright metallic pings (~0.7s).
export function coinPour() {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + 0.01;
    const scale = [2637, 3136, 3520, 4186, 4699, 5274];
    for (let i = 0; i < 9; i++) {
      const t = t0 + i * 0.07 + Math.random() * 0.02;
      const f = scale[Math.floor(Math.random() * scale.length)];
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.25);
    }
  } catch (_) {}
}

// Short wrong-answer thud (one soft low blip). Same unlock/mute rules.
export function softThud() {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t = c.currentTime + 0.01;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.25);
  } catch (_) {}
}
