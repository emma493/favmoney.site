// Favmoney cartoon avatars (ES module, pure — no DOM at import).
// Deterministic: hash(uid) % 24 picks one of 24 face variants, so every
// account — past, present, future — already "has" an avatar with zero
// migration or backfill. A stored user-doc `avatar` field may override it
// later; until then the derived face is the avatar.
export const AVATAR_COUNT = 24;

const BGS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
const SKINS = ['#ffdfc4', '#f0c08c', '#d8a066', '#a06a3b', '#6f4423', '#ffe0bd'];

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

function faceParts(style, skin) {
  const ink = '#23233a';
  let eyes = '', mouth = '';
  if (style === 0) {
    eyes = '<circle cx="18" cy="24" r="2.4" fill="' + ink + '"/><circle cx="30" cy="24" r="2.4" fill="' + ink + '"/>';
    mouth = '<path d="M18.5,31.5 Q24,36 29.5,31.5" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  } else if (style === 1) {
    eyes = '<path d="M15.5,24.5 Q18,21 20.5,24.5" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M27.5,24.5 Q30,21 32.5,24.5" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    mouth = '<path d="M18,30.5 Q24,30 30,30.5 Q29,36.5 24,36.5 Q19,36.5 18,30.5 Z" fill="' + ink + '"/><rect x="20" y="30.5" width="8" height="2.4" rx="1.2" fill="#fff"/>';
  } else {
    eyes = '<circle cx="18" cy="24" r="2.4" fill="' + ink + '"/><path d="M27.5,24.5 Q30,22 32.5,24.5" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    mouth = '<path d="M20,32 Q24,34.5 28,32" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  }
  const cheeks = '<circle cx="15" cy="29" r="2.4" fill="#ff9aa2" opacity=".55"/><circle cx="33" cy="29" r="2.4" fill="#ff9aa2" opacity=".55"/>';
  return { eyes, mouth, cheeks, skin };
}

// uidOrIndex: a uid string (hashed) or a 0-23 index. size: px.
export function avatarSVG(uidOrIndex, size) {
  const i = avatarIndex(uidOrIndex);
  const s = Math.max(16, Math.floor(Number(size) || 40));
  const bg = BGS[i % BGS.length];
  const skin = SKINS[i % SKINS.length];
  const style = Math.floor(i / 2) % 3;
  const p = faceParts(style, skin);
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 48 48" role="img" aria-hidden="true">'
    + '<circle cx="24" cy="24" r="24" fill="' + bg + '"/>'
    + '<circle cx="24" cy="26" r="14" fill="' + p.skin + '"/>'
    + p.cheeks + p.eyes + p.mouth + '</svg>';
}

// Masked public handle from a real handle or uid: first 3 + ***.
export function maskHandle(h) {
  const clean = String(h || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  if (!clean) return '???';
  return (clean.slice(0, 3) + '***').toUpperCase();
}
