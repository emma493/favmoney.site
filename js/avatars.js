// Favmoney member avatars (ES module, pure — no DOM at import).
// Illustrated vector portraits: flat-style faces with varied skin tones,
// hair styles/colors, tops and optional glasses. No photos, no emoji art.
// Deterministic: hash(uid) % 24, so every account — past, present, future —
// already "has" an avatar with zero migration or backfill. A stored
// user-doc `avatar` field may override it later; until then the derived
// face is the avatar. Zero external requests.
export const AVATAR_COUNT = 24;

const BGS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
const SKINS = ['#ffdfc4', '#f0c08c', '#d8a066', '#a06a3b', '#6f4423', '#ffe3c2'];
const HAIRS = ['#1d1d24', '#4a2f1d', '#7a4a21', '#b07a2a'];
const SHIRTS = ['#0e7490', '#6d28d9', '#047857', '#b45309', '#b91c1c', '#0f766e'];

export function hashUid(uid) {
  const s = String(uid || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h + s.charCodeAt(i)) >>> 0);
  return h;
}

export function avatarIndex(uid) {
  if (typeof uid === 'number' && isFinite(uid)) return Math.abs(Math.floor(uid)) % AVATAR_COUNT;
  return hashUid(uid) % AVATAR_COUNT;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = function (v) { return Math.max(0, Math.min(255, v + amt)); };
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hairBack(style, hc) {
  if (style === 2) {
    // Curly crown: ring of puffs behind the face.
    let c = '';
    const pts = [[24, 11], [15, 14], [33, 14], [12, 21], [36, 21], [14, 27], [34, 27]];
    for (let k = 0; k < pts.length; k++) c += '<circle cx="' + pts[k][0] + '" cy="' + pts[k][1] + '" r="5" fill="' + hc + '"/>';
    return c;
  }
  if (style === 3) {
    // Long hair falling past the shoulders.
    return '<path d="M12,20 Q12,8 24,8 Q36,8 36,20 L36,38 Q30,36 30,28 L18,28 Q18,36 12,38 Z" fill="' + hc + '"/>';
  }
  // Short crop / side part share a close cap; sweep differs in the fringe.
  return '<path d="M13,23 Q13,10 24,10 Q35,10 35,23 L33,23 Q33,13 24,13 Q15,13 15,23 Z" fill="' + hc + '"/>';
}

function fringe(style, hc) {
  if (style === 1) return '<path d="M15,20 Q20,13 27,15 Q31,16 33,20 Q27,16.5 21,18.5 Q17,20 15,20 Z" fill="' + hc + '"/>';
  if (style === 2) return '<circle cx="19" cy="15" r="4.4" fill="' + hc + '"/><circle cx="24" cy="13.4" r="4.6" fill="' + hc + '"/><circle cx="29" cy="15" r="4.4" fill="' + hc + '"/>';
  return '<path d="M15,21 Q16,14.5 24,14.5 Q32,14.5 33,21 Q28,17.5 24,18.5 Q20,19.5 15,21 Z" fill="' + hc + '"/>';
}

function eyes(style) {
  const ink = '#26263a';
  const L = '<ellipse cx="19.4" cy="25.5" rx="2.3" ry="2.7" fill="#fff"/><circle cx="19.7" cy="25.9" r="1.25" fill="' + ink + '"/><circle cx="20.2" cy="25.3" r="0.42" fill="#fff"/>';
  const R = '<ellipse cx="28.6" cy="25.5" rx="2.3" ry="2.7" fill="#fff"/><circle cx="28.9" cy="25.9" r="1.25" fill="' + ink + '"/><circle cx="29.4" cy="25.3" r="0.42" fill="#fff"/>';
  if (style === 1) {
    return '<path d="M16.9,25.8 Q19.4,23.4 21.9,25.8" stroke="' + ink + '" stroke-width="1.9" fill="none" stroke-linecap="round"/>'
      + '<path d="M26.1,25.8 Q28.6,23.4 31.1,25.8" stroke="' + ink + '" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
  }
  return L + R;
}

function brows() {
  return '<rect x="16.4" y="20.4" width="5.4" height="1.5" rx="0.75" fill="#26263a" transform="rotate(-6 19 21)"/>'
    + '<rect x="26.2" y="20.4" width="5.4" height="1.5" rx="0.75" fill="#26263a" transform="rotate(6 29 21)"/>';
}

function mouth(style) {
  const ink = '#26263a';
  if (style === 1) return '<path d="M19,31 Q24,30.4 29,31 Q28.4,35.6 24,35.6 Q19.6,35.6 19,31 Z" fill="' + ink + '"/><rect x="20.6" y="31" width="6.8" height="2" rx="1" fill="#fff"/>';
  if (style === 2) return '<path d="M20.5,32.2 Q24,34 27.5,32.2" stroke="' + ink + '" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
  return '<path d="M19,31.4 Q24,35.4 29,31.4" stroke="' + ink + '" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
}

function glasses() {
  const g = '#2b2b3d';
  return '<circle cx="19.4" cy="25.5" r="3.7" fill="none" stroke="' + g + '" stroke-width="1.4"/>'
    + '<circle cx="28.6" cy="25.5" r="3.7" fill="none" stroke="' + g + '" stroke-width="1.4"/>'
    + '<path d="M23.1,25.5 h1.8" stroke="' + g + '" stroke-width="1.4"/>';
}

function faceSVG(i) {
  const bg = BGS[i % BGS.length];
  const skin = SKINS[i % SKINS.length];
  const hc = HAIRS[(i >> 1) % HAIRS.length];
  const style = i % 4;
  const spec = (i >> 2) % 3;
  const dark = shade(skin, -28);
  return '<circle cx="24" cy="24" r="24" fill="' + bg + '"/>'
    + '<path d="M9,48 Q9,38.5 24,38.5 Q39,38.5 39,48 Z" fill="' + SHIRTS[(i * 5 + 1) % SHIRTS.length] + '"/>'
    + hairBack(style, hc)
    + '<circle cx="14.2" cy="25.5" r="2" fill="' + skin + '"/><circle cx="33.8" cy="25.5" r="2" fill="' + skin + '"/>'
    + '<rect x="21" y="30" width="6" height="7" rx="2.5" fill="' + dark + '"/>'
    + '<ellipse cx="24" cy="24.5" rx="9.6" ry="10.6" fill="' + skin + '"/>'
    + fringe(style, hc)
    + brows() + eyes(spec) + ((i % 5 === 4) ? glasses() : '')
    + '<path d="M24,28.4 q-1.1,1.8 0.4,2.4" stroke="' + dark + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
    + mouth(spec);
}

// Full-face SVG for a uid string (hashed) or a 0-23 index.
export function avatarSVG(uidOrIndex) {
  const i = avatarIndex(uidOrIndex);
  return '<svg viewBox="0 0 48 48" role="img" aria-hidden="true">' + faceSVG(i) + '</svg>';
}

// Data-URI version (for <img> contexts). Keeps the zero-external-request rule.
export function avatarURL(uidOrIndex) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSVG(uidOrIndex));
}

// Sized inline face. Presentation (circle crop) comes from inline style so it
// renders correctly at every call site without per-page CSS.
export function avatarImg(uidOrIndex, size, alt) {
  const s = Math.max(16, Math.floor(Number(size) || 40));
  const a = String(alt || 'Member').replace(/["<>]/g, '').slice(0, 40);
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 48 48" role="img" aria-label="' + a + '" style="width:100%;height:100%;border-radius:50%;display:block">' + faceSVG(avatarIndex(uidOrIndex)) + '</svg>';
}

// Masked public handle from a real handle or uid: first 3 + ***.
export function maskHandle(h) {
  const clean = String(h || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  if (!clean) return '???';
  return (clean.slice(0, 3) + '***').toUpperCase();
}
