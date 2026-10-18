// Favmoney Firebase bootstrap (ES module, CDN, Pages-safe, no npm build step).
// Uses Firebase JS SDK v12 via gstatic. Web apiKey is public by design; real
// security comes from Auth + Firestore rules, not key secrecy.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { isSupported as analyticsSupported, getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  serverTimestamp, updateDoc, increment, query, where, getDocs, limit, arrayUnion,
  runTransaction, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

import { coinPour } from './js/sfx.js';

export const firebaseConfig = {
  // Public web key (ships in client JS by design; GitHub secret-scan alert
  // expected — see repo Security tab. Restrict by referrer + API in Cloud
  // Console; backend secured via firestore.rules, not key secrecy).
  apiKey: 'AIzaSyBbPQlrTQHFk6XBPEDUrE7a3gIMNvvlric',
  authDomain: 'favmoney.firebaseapp.com',
  projectId: 'favmoney',
  storageBucket: 'favmoney.firebasestorage.app',
  messagingSenderId: '802605978689',
  appId: '1:802605978689:web:e767279c4bf625bb27a2c0',
  measurementId: 'G-DJXC5LBFZE'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics only where supported (https + real browser). Never blocks app.
export let analytics = null;
try {
  analyticsSupported().then(function (ok) {
    if (ok) { try { analytics = getAnalytics(app); } catch (e) { analytics = null; } }
  }).catch(function () {});
} catch (e) { analytics = null; }
export function track(name, params) {
  try { if (analytics) logEvent(analytics, name, params || {}); } catch (e) {}
}

export async function ensureUserDoc(user, provider, extra) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const ex = (extra && typeof extra === 'object') ? extra : {};
  const cc = typeof ex.country === 'string' && /^[A-Z]{2}$/.test(ex.country) ? ex.country : null;
  const cu = typeof ex.currency === 'string' && /^[A-Z]{3}$/.test(ex.currency) ? ex.currency : null;
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null, provider: provider || 'email',
      taskEarned: 0, investedUser: 0, activeDays: [],
      country: cc, currency: cu, countryName: typeof ex.countryName === 'string' ? ex.countryName.slice(0, 80) : null,
      createdAt: serverTimestamp()
    });
  } else {
    // Heal country fields for accounts created before the picker (never touch balances).
    try {
      const d = snap.data() || {};
      const heal = {};
      if (!('country' in d) && cc) heal.country = cc;
      if (!('currency' in d) && cu) heal.currency = cu;
      if (!('countryName' in d) && ex.countryName) heal.countryName = String(ex.countryName).slice(0, 80);
      if (Object.keys(heal).length) { heal.updatedAt = serverTimestamp(); await setDoc(ref, heal, { merge: true }); }
    } catch (_) {}
  }
  const wref = doc(db, 'wallets', user.uid);
  const w = await getDoc(wref);
  if (!w.exists()) {
    // Every account starts with a locked $1.00 grower seed (invest-only, never withdrawable).
    await setDoc(wref, { pending: 0, lifetime: 0, invested: 1, investedAt: Date.now(), boostUntil: 0, mineUntil: 0, updatedAt: serverTimestamp() });
  } else {
    // Heal pre-shift wallets: a missing mineUntil means a legacy account — grant
    // the one-time free 6h starter shift so nobody's miner dies on deploy day.
    try {
      const d = w.data() || {};
      const heal = {};
      if (!('mineUntil' in d)) heal.mineUntil = Date.now() + MINE_SHIFT_MS;
      if (Object.keys(heal).length) { heal.updatedAt = serverTimestamp(); await setDoc(wref, heal, { merge: true }); }
    } catch (_) {}
  }
}

export async function getWallet(uid) {
  const snap = await getDoc(doc(db, 'wallets', uid));
  if (!snap.exists()) return { pending: 0, lifetime: 0, invested: 0, investedAt: 0, boostUntil: 0, mineUntil: 0 };
  const d = snap.data();
  return {
    pending: Number(d.pending || 0), lifetime: Number(d.lifetime || 0),
    invested: Number(d.invested || 0), investedAt: Number(d.investedAt || 0), boostUntil: Number(d.boostUntil || 0),
    mineUntil: Number(d.mineUntil || 0)
  };
}

/** Live wallet subscription. Calls onChange({pending, lifetime, ...}) on every Firestore change.
 *  Returns an unsubscribe function. Caller should unsubscribe on page unload/component cleanup. */
export function subscribeWallet(uid, onChange) {
  const wref = doc(db, 'wallets', uid);
  return onSnapshot(wref, (snap) => {
    if (!snap.exists()) {
      try { onChange({ pending: 0, lifetime: 0, invested: 0, investedAt: 0, boostUntil: 0, mineUntil: 0 }); } catch (_) {}
      return;
    }
    const d = snap.data();
    try { onChange({
      pending: Number(d.pending || 0), lifetime: Number(d.lifetime || 0),
      invested: Number(d.invested || 0), investedAt: Number(d.investedAt || 0), boostUntil: Number(d.boostUntil || 0),
      mineUntil: Number(d.mineUntil || 0)
    }); } catch (_) {}
  }, (err) => {
    // Fail silently — live balance is a nicety, not critical path.
  });
}

export async function creditWallet(uid, amount, label) {
  const wref = doc(db, 'wallets', uid);
  await updateDoc(wref, {
    pending: increment(amount), lifetime: increment(amount),
    updatedAt: serverTimestamp(), lastLabel: label || null
  }).catch(async () => {
    await setDoc(wref, { pending: amount, lifetime: amount, updatedAt: serverTimestamp() }, { merge: true });
  });
  await addDoc(collection(db, 'proofs'), {
    uid, amount, label: label || 'quest',
    status: 'pending', at: serverTimestamp()
  });
}

export async function submitProof(uid, data) {
  await addDoc(collection(db, 'proofs'), {
    uid, ...data, status: 'pending', at: serverTimestamp()
  });
  if (data && data.amount) await creditWallet(uid, 0, data.label || 'proof-filed');
}

export async function requestCashout(uid, data) {
  const amount = Number(data.amount || 0);
  const wref = doc(db, 'wallets', uid);
  try {
    const ref = await runTransaction(db, async (transaction) => {
      const walletSnap = await transaction.get(wref);
      const currentPending = walletSnap.exists() ? Number(walletSnap.data().pending || 0) : 0;
      if (currentPending < amount) throw new Error('insufficient balance');
      const cashoutRef = doc(collection(db, 'cashouts'));
      transaction.set(cashoutRef, {
        uid, ...data, status: 'review', at: serverTimestamp()
      });
      transaction.update(wref, {
        pending: currentPending - amount,
        updatedAt: serverTimestamp()
      });
      return cashoutRef;
    });
    return ref.id;
  } catch (e) {
    console.log('[favmoney] requestCashout failed:', e && e.message ? e.message : e);
    return null;
  }
}

// ---- Favmoney profile fields (replaces localStorage: streak, started, claimed) ----
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { streak: { days: 0, last: '' }, started: {}, claimedQuests: [] };
  const d = snap.data();
  return {
    streak: d.streak || { days: 0, last: '' },
    started: d.started || {},
    claimedQuests: d.claimedQuests || [],
    refcode: d.refcode || null,
    referredBy: d.referredBy || null,
    myCode: d.myCode || null,
    taskEarned: Number(d.taskEarned || 0),
    investedUser: Number(d.investedUser || 0),
    activeDays: Array.isArray(d.activeDays) ? d.activeDays : [],
    lastSpinDay: d.lastSpinDay || '',
    lastQuizDay: d.lastQuizDay || '',
    spinTickets: Math.max(0, Math.floor(Number(d.spinTickets || 0))),
    spinCount: Math.max(0, Math.floor(Number(d.spinCount || 0))),
    spinWon: Number(d.spinWon || 0),
    country: (typeof d.country === 'string' && /^[A-Z]{2}$/.test(d.country)) ? d.country : null,
    currency: (typeof d.currency === 'string' && /^[A-Z]{3}$/.test(d.currency)) ? d.currency : 'USD',
    countryName: typeof d.countryName === 'string' ? d.countryName : null,
    createdAtMs: (d.createdAt && typeof d.createdAt.toMillis === 'function') ? d.createdAt.toMillis() : (Number(d.createdAt) || 0)
  };
}

export async function updateUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Referral engine: $1 invitee + $0.50 inviter, instant-available ----
// codes/{CODE} -> { uid } is the public directory (immutable, first-come).
// referrals/{newUid} is the $0.50 claim filed by the new user, claimed by owner.
// commissions/{autoId} are lifetime % debts filed by the earner, claimed by owner.
export const REF_INVITEE_AMOUNT = 1;
export const REF_INVITER_AMOUNT = 0.5;
export const REF_TASK_RATE = 0.25;
export const REF_OFFER_RATE = 0.10;

export function cleanCode(v) {
  return (v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
}

export function randomCode() {
  try {
    const buf = new Uint32Array(6);
    (crypto.getRandomValues ? crypto.getRandomValues(buf) : buf.map(() => Math.floor(Math.random() * 4294967296)));
    let s = '';
    for (let i = 0; i < 6; i++) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[buf[i] % 26];
    return s;
  } catch (e) {
    let s = '';
    for (let i = 0; i < 6; i++) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    return s;
  }
}

// Instant-available wallet credit: wallet increment + proofs row with status done.
export async function creditInstant(uid, amount, label) {
  const wref = doc(db, 'wallets', uid);
  await updateDoc(wref, {
    pending: increment(amount), lifetime: increment(amount),
    updatedAt: serverTimestamp(), lastLabel: label || null
  }).catch(async () => {
    await setDoc(wref, { pending: amount, lifetime: amount, updatedAt: serverTimestamp() }, { merge: true });
  });
  await addDoc(collection(db, 'proofs'), {
    uid, amount, label: label || 'referral',
    status: 'done', at: serverTimestamp()
  });
}

export async function resolveCodeOwner(code) {
  const c = cleanCode(code);
  if (c.length !== 6) return null;
  try {
    const snap = await getDoc(doc(db, 'codes', c));
    if (!snap.exists()) return null;
    return snap.data().uid || null;
  } catch (e) { return null; }
}

export async function getOrCreateMyCode(uid) {
  // Return existing code if present.
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const existing = snap.exists() && snap.data().myCode ? cleanCode(snap.data().myCode) : '';
    if (existing.length === 6) {
      // Heal directory entry if missing (legacy accounts).
      try { await setDoc(doc(db, 'codes', existing), { uid, createdAt: serverTimestamp() }, { merge: false }).catch(() => {}); } catch (_) {}
      return existing;
    }
  } catch (e) {}
  // Mint a fresh code with collision retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const taken = await getDoc(doc(db, 'codes', code));
      if (taken.exists()) continue;
      try {
        await setDoc(doc(db, 'codes', code), { uid, createdAt: serverTimestamp() });
      } catch (err) {
        // Lost a race on first-come ownership — retry with a new code.
        continue;
      }
      try { await setDoc(doc(db, 'users', uid), { myCode: code, updatedAt: serverTimestamp() }, { merge: true }); } catch (_) {}
      return code;
    } catch (e) { continue; }
  }
  // Deterministic fallback from uid (still 6x A-Z).
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  let s = '';
  for (let i = 0; i < 6; i++) { s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(h >> (i * 4)) % 26]; }
  try { await setDoc(doc(db, 'users', uid), { myCode: s, updatedAt: serverTimestamp() }, { merge: true }); } catch (_) {}
  try { await setDoc(doc(db, 'codes', s), { uid, createdAt: serverTimestamp() }).catch(() => {}); } catch (_) {}
  return s;
}

// Called once right after signup. Credits the invitee $1 instantly,
// files the $0.50 claim for the owner to pick up (owner wallet is self-only).
// handle is the invitee's public display handle (email prefix); shown masked
// on the inviter's referrals list. Never throws — signup must succeed even
// if referral writes fail.
export async function redeemReferral(newUid, rawCode, handle) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) return { ok: false, reason: 'empty' };
  let ownerUid = null;
  try { ownerUid = await resolveCodeOwner(code); } catch (_) { ownerUid = null; }
  if (!ownerUid) return { ok: false, reason: 'invalid' };
  if (ownerUid === newUid) return { ok: false, reason: 'self' };
  const h = String(handle || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24);
  try {
    await setDoc(doc(db, 'users', newUid), { refcode: code, referredBy: ownerUid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (_) {}
  try {
    await creditInstant(newUid, REF_INVITEE_AMOUNT, 'referral-invitee');
  } catch (_) {}
  try {
    await setDoc(doc(db, 'referrals', newUid), {
      code, ownerUid, newUid, handle: h,
      amount: REF_INVITER_AMOUNT, inviteeAmount: REF_INVITEE_AMOUNT,
      claimed: false, createdAt: serverTimestamp()
    });
  } catch (_) {}
  return { ok: true, ownerUid };
}

function commissionKind(label) {
  const l = (label || '').toLowerCase();
  if (/offer|partner|adgate|timewall|app install|trial/.test(l)) return 'offer';
  return 'task';
}

// Owner-side: claim all pending $0.50 referral bonuses. Idempotent via claimed flag.
export async function claimReferrals(uid) {
  let rows = [];
  try {
    const snap = await getDocs(query(collection(db, 'referrals'), where('ownerUid', '==', uid), limit(100)));
    snap.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
  } catch (e) { return { claimed: 0, total: 0 }; }
  rows = rows.filter(function (r) { return r.claimed === false; });
  let n = 0;
  for (const r of rows) {
    try {
      await creditInstant(uid, REF_INVITER_AMOUNT, 'referral-inviter');
      await setDoc(doc(db, 'referrals', r.id), { claimed: true }, { merge: true });
      n++;
    } catch (_) {}
  }
  const refTotal = Math.round(n * REF_INVITER_AMOUNT * 100) / 100;
  if (n > 0) {
    try { await notifyUser(uid, 'referral-payout', 'Referral payout', '+$' + refTotal.toFixed(2) + ' from invites', 'invite.html'); } catch (_) {}
  }
  return { claimed: n, total: refTotal };
}

// Earner-side: after every reward, file the owner's lifetime % debt (fire-and-forget).
// Invest + referral payouts never compound: their labels are excluded here.
export async function recordCommission(fromUid, baseAmount, label) {
  const base = Number(baseAmount || 0);
  if (!(base > 0)) return 0;
  const ll = (label || '').toLowerCase();
  if (/^(referral-|invest-|ad-)/.test(ll)) return 0;
  let ownerUid = null;
  try {
    const snap = await getDoc(doc(db, 'users', fromUid));
    ownerUid = snap.exists() ? (snap.data().referredBy || null) : null;
  } catch (e) { ownerUid = null; }
  if (!ownerUid || ownerUid === fromUid) return 0;
  const kind = commissionKind(label);
  const rate = kind === 'offer' ? REF_OFFER_RATE : REF_TASK_RATE;
  const commission = Math.floor(base * rate * 100) / 100;
  if (!(commission >= 0.01)) return 0;
  try {
    await addDoc(collection(db, 'commissions'), {
      fromUid, ownerUid, baseAmount: base, commission, kind,
      claimed: false, at: serverTimestamp()
    });
  } catch (_) { return 0; }
  return commission;
}

// Owner-side: claim all pending lifetime commissions as one batch credit.
export async function claimCommissions(uid) {
  let rows = [];
  try {
    const snap = await getDocs(query(collection(db, 'commissions'), where('ownerUid', '==', uid), limit(100)));
    snap.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
  } catch (e) { return { claimed: 0, total: 0 }; }
  rows = rows.filter(function (r) { return r.claimed === false && Number(r.commission) > 0; });
  if (!rows.length) return { claimed: 0, total: 0 };
  const total = Math.floor(rows.reduce(function (s, r) { return s + Number(r.commission || 0); }, 0) * 100) / 100;
  try {
    await creditInstant(uid, total, 'referral-commission-batch');
  } catch (_) { return { claimed: 0, total: 0 }; }
  for (const r of rows) {
    try { await setDoc(doc(db, 'commissions', r.id), { claimed: true }, { merge: true }); } catch (_) {}
  }
  try { await notifyUser(uid, 'referral-payout', 'Commission paid', '+$' + total.toFixed(2) + ' from referrals', 'invite.html'); } catch (_) {}
  return { claimed: rows.length, total };
}

export async function fetchReferrals(ownerUid, n) {
  try {
    const snap = await getDocs(query(collection(db, 'referrals'), where('ownerUid', '==', ownerUid), limit(n || 50)));
    const rows = [];
    snap.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
    rows.sort(function (a, b) {
      const ta = (a.createdAt && a.createdAt.seconds) || 0, tb = (b.createdAt && b.createdAt.seconds) || 0;
      return tb - ta;
    });
    return rows;
  } catch (e) { return []; }
}

// Hourly top-inviters board, written by the Worker cron to
// leaderboard/top_inviters ({ entries: [{uid, handle, invited}], updatedAt }).
// Returns null when the cron has not run yet — callers show the empty state.
export async function getTopInviters() {
  try {
    const snap = await getDoc(doc(db, 'leaderboard', 'top_inviters'));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    const entries = Array.isArray(d.entries) ? d.entries.filter(function (e) {
      return e && typeof e.uid === 'string' && Number(e.invited) > 0;
    }).slice(0, 10) : [];
    return { entries, updatedAtMs: Number(d.updatedAt) || 0 };
  } catch (_) { return null; }
}

// ---- Ad-gated extra plays: 1 free/day + 10 ad plays/day per game ----
// Diamonds removed 2026-10-15. Extra Spin / Quiz sessions are granted only
// after a verified 20s ad view (UI must verify BEFORE calling). Caps count
// entry rows per UTC day: spin-ad (Spin) and quiz-ad (Quiz).
export const SPIN_AD_DAILY_CAP = 10;
export const QUIZ_AD_DAILY_CAP = 10;

// ---- Spin the Wheel: 1 free UTC-day spin + 10 ad spins, cash-only wins ----
// Cash-only since 2026-10-15 (diamonds removed). Cash wins flow through
// creditReward (instant-available + tiny referrer commission, like all quests).
// Ticket wins bump users.spinTickets for an instant re-spin (no ad cost).
// Each spin writes exactly one win row (win/ticket) plus one entry row
// (free/ad), so the Rewards spin track counts wins without double-counting.
export const SPIN_PRIZES = [
  { id: 'cash02', kind: 'cash', amount: 0.02, weight: 34 },
  { id: 'cash05', kind: 'cash', amount: 0.05, weight: 28 },
  { id: 'cash10', kind: 'cash', amount: 0.10, weight: 21 },
  { id: 'ticket', kind: 'ticket', weight: 10 },
  { id: 'cash25', kind: 'cash', amount: 0.25, weight: 5 },
  { id: 'cash100', kind: 'cash', amount: 1.00, weight: 2 }
];
export function rollSpinPrize(rand) {
  const r = typeof rand === 'function' ? rand() : Math.random();
  let acc = 0;
  for (const p of SPIN_PRIZES) {
    acc += p.weight / 100;
    if (r < acc) return { ...p };
  }
  return { ...SPIN_PRIZES[0] };
}
export function spinResetMs(nowMs) {
  const now = Number(nowMs || Date.now());
  const day = Math.floor(now / 86400000) * 86400000;
  return day + 86400000 - now;
}
export async function getSpinState(uid, nowMs) {
  const now = Number(nowMs || Date.now());
  const [w, u] = await Promise.all([getWallet(uid), getUserDoc(uid)]);
  const today = utcDayStr(now);
  let adUsed = 0;
  try {
    const proofs = await fetchUserDocs(uid, 'proofs', 100);
    for (const p of proofs) {
      if (String((p && p.label) || '') !== 'spin-ad') continue;
      if (utcDayStr(proofMs(p, now)) === today) adUsed++;
    }
  } catch (_) {}
  adUsed = Math.min(SPIN_AD_DAILY_CAP, adUsed);
  return {
    today, pending: Number(w.pending || 0),
    tickets: u.spinTickets, spinCount: u.spinCount, spinWon: u.spinWon,
    freeLeft: u.lastSpinDay === today ? 0 : 1,
    adUsed, adLeft: Math.max(0, SPIN_AD_DAILY_CAP - adUsed),
    resetMs: spinResetMs(now)
  };
}
async function writeSpinWin(uid, prize) {
  if (prize.kind === 'cash') {
    await creditReward(uid, prize.amount, 'spin-win');
    await setDoc(doc(db, 'users', uid), {
      spinCount: increment(1), spinWon: increment(prize.amount), updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    await setDoc(doc(db, 'users', uid), { spinTickets: increment(1), spinCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'spin-ticket', status: 'done', at: serverTimestamp() });
  }
}
// mode: 'free' | 'ticket' | 'ad'. UI must verify the 20s ad view BEFORE calling
// with mode 'ad'. Returns { ok, prize } or { ok:false, reason }.
export async function playSpin(uid, mode, rand) {
  const now = Date.now();
  const today = utcDayStr(now);
  if (mode === 'free') {
    const u = await getUserDoc(uid);
    if (u.lastSpinDay === today && !(u.spinTickets > 0)) return { ok: false, reason: 'nofree' };
    // A banked ticket takes precedence: free day stays intact.
    if (u.spinTickets > 0) return playSpin(uid, 'ticket', rand);
    try {
      await setDoc(doc(db, 'users', uid), { lastSpinDay: today, updatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'spin-free', status: 'done', at: serverTimestamp() });
    } catch (_) { return { ok: false, reason: 'write' }; }
  } else if (mode === 'ticket') {
    const u = await getUserDoc(uid);
    if (!(u.spinTickets > 0)) return { ok: false, reason: 'tickets' };
    try {
      await setDoc(doc(db, 'users', uid), { spinTickets: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
    } catch (_) { return { ok: false, reason: 'write' }; }
  } else if (mode === 'ad' || mode === 'extra') {
    // 'extra' kept as alias for old clients; both mean one verified ad play.
    let proofs = [];
    try { proofs = await fetchUserDocs(uid, 'proofs', 100); } catch (_) { return { ok: false, reason: 'write' }; }
    let used = 0;
    for (const p of proofs) {
      if (String((p && p.label) || '') !== 'spin-ad') continue;
      if (utcDayStr(proofMs(p, now)) === today) used++;
    }
    if (used >= SPIN_AD_DAILY_CAP) return { ok: false, reason: 'capped', adLeft: 0 };
    try {
      await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'spin-ad', status: 'done', at: serverTimestamp() });
    } catch (_) { return { ok: false, reason: 'write' }; }
  } else {
    return { ok: false, reason: 'mode' };
  }
  const prize = rollSpinPrize(rand);
  try {
    await writeSpinWin(uid, prize);
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, prize };
}

// ---- Free Faucet: $0.15 drip per 5-minute claim, rolling batches of 10 ----
// Timer-only anti-bot at launch: visible countdown + cooldown enforced on a
// re-read of the user's own proofs before every pay (same pattern as
// claimMilestone), so double-taps and stale tabs cannot double-pay. Claims
// flow through creditReward(uid, 0.15, 'play:faucet') so the Rewards faucet
// track, Grow taskEarned/stakeable ceiling, and referral commission all pick
// them up with no rules change (status 'pending' passes with any label).
// Batch model: claim every 5 min, 10 drips per batch. Exhausting a batch
// starts a 1-hour wait, after which the next batch of 10 unlocks — up to
// 4 batches, then capped until UTC midnight.
// Bounded: 4 batches x 10 x $0.15 = $6.00/user/UTC-day.
export const FAUCET_AMOUNT = 0.15;
export const FAUCET_INTERVAL_MS = 5 * 60000;
export const FAUCET_BATCH_WAIT_MS = 60 * 60000;
export const FAUCET_BATCH_SIZE = 10;
export const FAUCET_BATCHES_PER_DAY = 4;
export const FAUCET_DAILY_CAP = FAUCET_BATCH_SIZE * FAUCET_BATCHES_PER_DAY;

// Pure: ms timestamp of a proof row. Server Timestamps expose .seconds;
// a just-written local estimate may carry null — treat as just-now (which
// keeps the cooldown active, the safe direction).
export function proofMs(p, nowMs) {
  try {
    const now = Number(nowMs || Date.now());
    if (!p) return 0;
    const at = p.at;
    if (at == null) return now;
    if (typeof at === 'number') return at > 1e12 ? at : (at > 1e9 ? at * 1000 : now);
    if (typeof at.seconds === 'number') return at.seconds * 1000;
    const t = new Date(at).getTime();
    return isNaN(t) ? 0 : t;
  } catch (_) { return 0; }
}

// Pure faucet state from an array of proof rows — no Firestore.
// Returns { ready, waitMs, waitTotal, batchWait, claimedToday,
//   remainingToday, lastClaimMs, resetMs, batch (1-based), inBatch (0..size),
//   batchSize, batchesPerDay }.
// Timing: 5 min between drips inside a batch; finishing a batch (10th,
// 20th, 30th claim) starts a 1-hour wait for the next batch.
export function faucetState(proofs, nowMs) {
  const now = Number(nowMs || Date.now());
  const today = utcDayStr(now);
  let last = 0, todayN = 0;
  for (const p of (Array.isArray(proofs) ? proofs : [])) {
    if (String((p && p.label) || '') !== 'play:faucet') continue;
    const ms = proofMs(p, now);
    if (ms > last) last = ms;
    if (utcDayStr(ms) === today) todayN++;
  }
  const batchDone = todayN > 0 && todayN % FAUCET_BATCH_SIZE === 0;
  const waitTotal = batchDone ? FAUCET_BATCH_WAIT_MS : FAUCET_INTERVAL_MS;
  const waitMs = Math.max(0, last + waitTotal - now);
  const remainingToday = Math.max(0, FAUCET_DAILY_CAP - todayN);
  const batch = Math.min(FAUCET_BATCHES_PER_DAY, Math.floor(todayN / FAUCET_BATCH_SIZE) + 1);
  const inBatch = Math.min(FAUCET_BATCH_SIZE, todayN % FAUCET_BATCH_SIZE);
  return {
    ready: waitMs <= 0 && remainingToday > 0,
    waitMs, waitTotal, batchWait: batchDone,
    claimedToday: todayN, remainingToday, lastClaimMs: last,
    capped: remainingToday <= 0,
    resetMs: spinResetMs(now),
    batch, inBatch, batchSize: FAUCET_BATCH_SIZE, batchesPerDay: FAUCET_BATCHES_PER_DAY
  };
}

// Claim one paid drip. Returns { ok:true, amount } or
// { ok:false, reason:'cooldown'|'capped'|'write', waitMs?, remainingToday? }.
export async function claimFaucet(uid) {
  let proofs = [];
  try { proofs = await fetchUserDocs(uid, 'proofs', 100); } catch (_) { return { ok: false, reason: 'write' }; }
  const st = faucetState(proofs, Date.now());
  if (st.capped) return { ok: false, reason: 'capped', remainingToday: 0, resetMs: st.resetMs };
  if (!st.ready) return { ok: false, reason: 'cooldown', waitMs: st.waitMs, remainingToday: st.remainingToday };
  try {
    await creditReward(uid, FAUCET_AMOUNT, 'play:faucet');
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, amount: FAUCET_AMOUNT, remainingToday: st.remainingToday - 1 };
}

// ---- Quiz & Earn math arcade: 1 free session/day + 10 ad sessions/day ----
// Loop: free daily 30Q session (lastQuizDay) or 1 verified ad view -> quiz-ad ->
 // pick + - x / -> answer generated questions
// (4 options, 10s each). Correct pays $0.10 to main balance via creditReward
// (label 'play:quiz': Rewards track + 25% commission + Grow gate, no rules
// change — status 'pending' passes with any label). One rescue life per
// session via a 20s house-promo view; a second fail ends the session and
// unanswered questions are lost. Max exposure: 30 x $0.10 = $3.00/session.
export const QUIZ_SESSION_SIZE = 30;
export const QUIZ_PAY = 0.10;
export const QUIZ_TIME_MS = 10000;
export const QUIZ_OPS = ['+', '-', 'x', '/'];

// Difficulty tier from questions already answered this session. Pure.
export function quizTier(answered) {
  const n = Math.max(0, Math.floor(Number(answered || 0)));
  return n < 10 ? 0 : n < 20 ? 1 : 2;
}

function qint(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

// Pure question generator — no Firestore. Returns
// { a, op, b, answer, text }. Division is always clean, subtraction never
// goes negative. rand is an injectable () => [0,1) for tests.
export function genQuizQuestion(op, answered, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const R = function (lo, hi) { return qint(r, lo, hi); };
  const t = quizTier(answered);
  const o = QUIZ_OPS.indexOf(op) >= 0 ? op : QUIZ_OPS[Math.floor(r() * 4)];
  let a = 0, b = 0, answer = 0;
  if (o === '+') {
    const hi = t === 0 ? 20 : t === 1 ? 50 : 100;
    const lo = t === 0 ? 2 : t === 1 ? 5 : 10;
    a = R(lo, hi); b = R(lo, hi); answer = a + b;
  } else if (o === '-') {
    const hi = t === 0 ? 20 : t === 1 ? 50 : 100;
    const lo = t === 0 ? 2 : t === 1 ? 5 : 10;
    a = R(lo, hi); b = R(lo, a); answer = a - b;
  } else if (o === 'x') {
    const hi = t === 0 ? 5 : t === 1 ? 9 : 12;
    a = R(2, hi); b = R(2, hi); answer = a * b;
  } else {
    const hi = t === 0 ? 5 : t === 1 ? 9 : 12;
    b = R(2, hi); answer = R(2, hi); a = b * answer;
  }
  const sym = o === 'x' ? '×' : o === '/' ? '÷' : o === '-' ? '−' : '+';
  return { a, op: o, b, answer, text: a + ' ' + sym + ' ' + b };
}

// Pure: verify a question is internally consistent (a op b === answer).
// The server re-checks this so tampered clients cannot invent pays.
export function quizCheck(q) {
  try {
    if (!q || typeof q.a !== 'number' || typeof q.b !== 'number' || typeof q.answer !== 'number') return false;
    const v = q.op === '+' ? q.a + q.b : q.op === '-' ? q.a - q.b : q.op === 'x' ? q.a * q.b : q.op === '/' ? (q.b !== 0 ? q.a / q.b : NaN) : NaN;
    return v === q.answer;
  } catch (_) { return false; }
}

function quizShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Pure: 4 unique options (correct + 3 distractors), shuffled. Distractors
// stay >= 0. rand is injectable for tests.
export function quizOptions(answer, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const ans = Math.floor(Number(answer || 0));
  const cands = quizShuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans - 3, ans + 5, ans - 5, ans + 10, ans - 10], r);
  const picks = [];
  for (const c of cands) {
    if (picks.length >= 3) break;
    if (c < 0 || c === ans || picks.indexOf(c) >= 0) continue;
    picks.push(c);
  }
  // Answer 0..2 has fewer valid distractors — fill upward (never duplicates).
  let f = ans + 4;
  while (picks.length < 3) {
    if (picks.indexOf(f) < 0 && f !== ans) picks.push(f);
    f++;
  }
  return quizShuffle([ans].concat(picks), r);
}

// Pure session fold over proof rows — no Firestore. The session is anchored
// on the latest entry row (quiz-ad for ad sessions, quiz-free
// for the daily free session); answers at the same-or-later timestamp belong
// to it (server stamps have 1s resolution, so >= keeps a same-second first
// answer inside the session — the safe direction).
// Kill markers: any 'quiz-abandon' row voids everything at-or-before it, so
// failed, quit or stale sessions can never resume — the next start is 0/30.
// Returns { entries, lastEntryMs, hasSession, active, answered, correct,
// misses, lifeUsed, earned, remaining, freeEntry }.
export function quizSession(proofs, nowMs) {
  const now = Number(nowMs || Date.now());
  const rows = Array.isArray(proofs) ? proofs : [];
  let lastEntryMs = 0, entries = 0, freeEntry = false, killMs = 0;
  for (const p of rows) {
    if (String((p && p.label) || '') !== 'quiz-abandon') continue;
    const ms = proofMs(p, now);
    if (ms > killMs) killMs = ms;
  }
  for (const p of rows) {
    const lb = String((p && p.label) || '');
    if (lb !== 'quiz-ad' && lb !== 'quiz-free') continue;
    const ms = proofMs(p, now);
    if (ms < killMs) continue;
    entries++;
    if (ms >= lastEntryMs) { lastEntryMs = ms; freeEntry = lb === 'quiz-free'; }
  }
  let answered = 0, correct = 0, misses = 0, lifeUsed = false, earned = 0;
  if (entries > 0) {
    for (const p of rows) {
      const lb = String((p && p.label) || '');
      if (lb !== 'play:quiz' && lb !== 'quiz-miss' && lb !== 'quiz-life') continue;
      const ms = proofMs(p, now);
      if (ms < lastEntryMs || ms <= killMs) continue;
      if (lb === 'play:quiz') { answered++; correct++; earned = Math.round((earned + Number(p.amount || 0)) * 100) / 100; }
      else if (lb === 'quiz-miss') { answered++; misses++; }
      else lifeUsed = true;
    }
  }
  const remaining = Math.max(0, QUIZ_SESSION_SIZE - answered);
  return {
    entries, lastEntryMs, hasSession: entries > 0, active: entries > 0 && remaining > 0,
    answered, correct, misses, lifeUsed, earned, remaining, freeEntry
  };
}

// Hard-kill the current session (fail, quit, stale return): everything
// before this marker stops counting, so the next start is fresh at 0/30.
// status 'pending' passes Firestore rules with any label. Earnings already
// credited stay credited — only the session dies.
export async function endQuizSession(uid) {
  try {
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-abandon', status: 'pending', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true };
}

// Pure free-day state — no Firestore beyond the user doc row.
// Mirrors getSpinState: 1 free 30Q session per UTC day + 10 ad sessions.
export async function getQuizState(uid, nowMs) {
  const now = Number(nowMs || Date.now());
  const [w, u] = await Promise.all([getWallet(uid), getUserDoc(uid)]);
  const today = utcDayStr(now);
  let adUsed = 0;
  try {
    const proofs = await fetchUserDocs(uid, 'proofs', 100);
    for (const p of proofs) {
      if (String((p && p.label) || '') !== 'quiz-ad') continue;
      if (utcDayStr(proofMs(p, now)) === today) adUsed++;
    }
  } catch (_) {}
  adUsed = Math.min(QUIZ_AD_DAILY_CAP, adUsed);
  return {
    today, pending: Number(w.pending || 0),
    freeLeft: u.lastQuizDay === today ? 0 : 1,
    adUsed, adLeft: Math.max(0, QUIZ_AD_DAILY_CAP - adUsed),
    resetMs: spinResetMs(now)
  };
}

// Open a session. mode: 'free' (daily) | 'ad' (1 verified 20s view).
// An explicit start always begins at 0: if a previous session is still
// active it is voided first (a 'quiz-abandon' marker row; the fresh entry
// row orphans its answers so counts restart). Daily gates still apply.
// Returns { ok, mode } or { ok:false, reason }.
export async function startQuizSession(uid, mode) {
  const m = mode === 'free' ? 'free' : 'ad';
  let proofs = null;
  // 50 rows cover a full session (entry + 30 answers + life) with margin.
  try { proofs = await fetchUserDocs(uid, 'proofs', 50); } catch (_) { return { ok: false, reason: 'write' }; }
  const prev = quizSession(proofs, Date.now());
  async function voidPrior() {
    if (!prev.active) return;
    try { await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-abandon', status: 'done', at: serverTimestamp() }); } catch (_) {}
  }
  if (m === 'free') {
    const now = Date.now();
    const today = utcDayStr(now);
    let u = null;
    try { u = await getUserDoc(uid); } catch (_) { return { ok: false, reason: 'write' }; }
    if (u.lastQuizDay === today) return { ok: false, reason: 'nofree' };
    try {
      await setDoc(doc(db, 'users', uid), { lastQuizDay: today, updatedAt: serverTimestamp() }, { merge: true });
      await voidPrior();
      await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-free', status: 'done', at: serverTimestamp() });
    } catch (_) { return { ok: false, reason: 'write' }; }
    return { ok: true, mode: 'free' };
  }
  const now = Date.now();
  const today = utcDayStr(now);
  let used = 0;
  for (const p of (proofs || [])) {
    if (String((p && p.label) || '') !== 'quiz-ad') continue;
    if (utcDayStr(proofMs(p, now)) === today) used++;
  }
  if (used >= QUIZ_AD_DAILY_CAP) return { ok: false, reason: 'capped', adLeft: 0 };
  try {
    await voidPrior();
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-ad', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, mode: 'ad' };
}

// Grade one answer. q is the generated question, pickedIdx the tapped option
// (-1 on timeout). Re-reads proofs first: session must be active and under
// 30, the question must check out, and the picked option must equal the
// answer — otherwise no pay. Correct writes play:quiz ($0.10 via
// creditReward); wrong writes quiz-miss (amount 0 bookkeeping).
// Returns { ok:true, correct } or { ok:false, reason }.
export async function answerQuiz(uid, q, pickedIdx) {
  if (!quizCheck(q) || !q.options || q.options.length !== 4 || q.options.indexOf(q.answer) < 0) {
    return { ok: false, reason: 'question' };
  }
  // The options must be exactly {answer + 3 unique distractors}.
  const uniq = {};
  for (const o of q.options) {
    if (typeof o !== 'number' || !(o >= 0)) return { ok: false, reason: 'question' };
    uniq[o] = true;
  }
  if (Object.keys(uniq).length !== 4) return { ok: false, reason: 'question' };
  let proofs = null;
  try { proofs = await fetchUserDocs(uid, 'proofs', 50); } catch (_) { return { ok: false, reason: 'write' }; }
  const st = quizSession(proofs, Date.now());
  if (!st.active) return { ok: false, reason: 'session' };
  const correct = Number(q.options[pickedIdx]) === Number(q.answer);
  try {
    if (correct) await creditReward(uid, QUIZ_PAY, 'play:quiz');
    else await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-miss', status: 'pending', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, correct };
}

// Spend the one rescue life for this session. The UI must verify the 20s ad
// view BEFORE calling. Returns { ok } or { ok:false, reason }.
export async function useQuizLife(uid) {
  let proofs = null;
  try { proofs = await fetchUserDocs(uid, 'proofs', 50); } catch (_) { return { ok: false, reason: 'write' }; }
  const st = quizSession(proofs, Date.now());
  if (!st.active) return { ok: false, reason: 'session' };
  if (st.lifeUsed) return { ok: false, reason: 'used' };
  try {
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'quiz-life', status: 'pending', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true };
}

// ---- Paid PTC: per-link catalog views, 50 paid views per UTC day ----
// Same timer-only, re-read-before-pay pattern as the faucet. Each catalog
// entry carries its own secs/pay/intervalHrs; the pay is re-validated here
// against PTC_MIN_PAY..PTC_MAX_PAY and the catalog row, so tampered clients
// cannot invent amounts. Proofs use label 'ptc-view' (status 'pending'
// passes rules with any label) and count toward the Rewards ads track.
// Max exposure: 50 mixed-tier views ≈ $6.50/user/day (20x$0.10 + 12x$0.11 + 10x$0.13 + 5x$0.20 + 3x$0.30, first slot is $0.20).
export const PTC_DAILY_CAP = 50;
export const PTC_MIN_PAY = 0.10;
export const PTC_MAX_PAY = 0.30;

// Pure PTC state — no Firestore.
// catalog: array of {id,secs,pay,intervalHrs}; proofs: proof rows.
// Returns { paidToday, remainingToday, capped, resetMs, ads: {id: {ready, waitMs, lastMs, pay, secs}} }.
export function ptcState(proofs, catalog, nowMs) {
  const now = Number(nowMs || Date.now());
  const today = utcDayStr(now);
  const list = Array.isArray(catalog) ? catalog : [];
  const byAd = {};
  let paidToday = 0;
  for (const p of (Array.isArray(proofs) ? proofs : [])) {
    if (String((p && p.label) || '') !== 'ptc-view') continue;
    const id = p && p.adId ? String(p.adId) : '';
    const ms = proofMs(p, now);
    if (utcDayStr(ms) === today) paidToday++;
    if (id) {
      if (!byAd[id] || ms > byAd[id]) byAd[id] = ms;
    }
  }
  const ads = {};
  for (const a of list) {
    if (!a || !a.id) continue;
    const last = byAd[a.id] || 0;
    const waitMs = Math.max(0, last + Number(a.intervalHrs || 24) * 3600000 - now);
    ads[a.id] = { ready: waitMs <= 0, waitMs, lastMs: last, pay: Number(a.pay || 0), secs: Number(a.secs || 0) };
  }
  const remainingToday = Math.max(0, PTC_DAILY_CAP - paidToday);
  return {
    paidToday, remainingToday, capped: remainingToday <= 0,
    resetMs: spinResetMs(now), ads
  };
}

// Claim one catalog view. ad: the catalog row (id/secs/pay re-checked).
// Returns { ok:true, amount } or { ok:false, reason:'unknown'|'capped'|'cooldown'|'write', ... }.
export async function claimPtcView(uid, ad) {
  if (!ad || !ad.id) return { ok: false, reason: 'unknown' };
  const pay = Math.round(Number(ad.pay || 0) * 100) / 100;
  const secs = Math.floor(Number(ad.secs || 0));
  if (!(pay >= PTC_MIN_PAY && pay <= PTC_MAX_PAY && secs >= 10 && secs <= 60)) {
    return { ok: false, reason: 'unknown' };
  }
  let proofs = [];
  try { proofs = await fetchUserDocs(uid, 'proofs', 200); } catch (_) { return { ok: false, reason: 'write' }; }
  const st = ptcState(proofs, [ad], Date.now());
  if (st.capped) return { ok: false, reason: 'capped', remainingToday: 0, resetMs: st.resetMs };
  const a = st.ads[ad.id];
  if (!a || !a.ready) return { ok: false, reason: 'cooldown', waitMs: a ? a.waitMs : 0, remainingToday: st.remainingToday };
  try {
    await creditReward(uid, pay, 'ptc-view', { adId: ad.id });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, amount: pay, remainingToday: st.remainingToday - 1 };
}

// ---- Rewards milestones: task-completion tracks claimed on rewards.html ----
// Card tracks count proofs written by each game page via
// creditReward(uid, amount, 'play:<card>') (status 'pending' passes rules with
// any label). Wiring checklist: each game page must emit its play:<card>
// event when it goes live; until then that track reads 0/N.
// Claim proofs use label 'task-reward' + milestone '<track>:<tier>' field,
// also status 'pending', so no rules change is needed. Amounts are bounded
// client-side to REWARD_TIERS (full authority needs the Cloud Function).
// The 'welcome' track is synthetic: every signed-in user reads 1/1 until
// its once-ever $0.10 chest is claimed.
export const REWARD_TIERS = [0.10, 0.50, 1.00, 2.00];
export const REWARD_TRACKS = [
  { id: 'welcome', name: 'Welcome Chest', tag: 'Your first reward — on the house', icon: 'gift', counter: 'welcome', targets: [1] },
  { id: 'offers', name: 'Offers & Apps', tag: 'Complete app offers', icon: 'layers', counter: 'offers', targets: [1, 3, 10, 25] },
  { id: 'ads', name: 'Watch Ads', tag: 'Watch ad views', icon: 'play', counter: 'ads', targets: [5, 20, 50, 100] },
  { id: 'quiz', name: 'Quiz & Earn', tag: 'Pass quizzes', icon: 'graduation-cap', counter: 'quiz', targets: [1, 5, 20, 50] },
  { id: 'faucet', name: 'Free Faucet', tag: 'Collect claims', icon: 'droplets', counter: 'faucet', targets: [5, 25, 100, 250] },
  { id: 'spin', name: 'Spin the Wheel', tag: 'Use daily spins', icon: 'rotate-cw', counter: 'spin', targets: [3, 7, 14, 30] },
  { id: 'invite', name: 'Inviter', tag: 'Friends joined', icon: 'users', counter: 'invites', targets: [1, 3, 10, 25] },
  { id: 'share-wa', name: 'WhatsApp Sharer', tag: 'Shares on WhatsApp', icon: 'share', counter: 'share_wa', targets: [3, 5, 10, 25] },
  { id: 'share-tg', name: 'Telegram Sharer', tag: 'Shares on Telegram', icon: 'share', counter: 'share_tg', targets: [3, 5, 10, 25] },
  { id: 'share-x', name: 'X Sharer', tag: 'Posts on X', icon: 'share', counter: 'share_x', targets: [3, 5, 10, 25] },
  { id: 'share-fb', name: 'Facebook Sharer', tag: 'Shares on Facebook', icon: 'share', counter: 'share_fb', targets: [3, 5, 10, 25] },
  { id: 'share-em', name: 'Email Sharer', tag: 'Shares by email', icon: 'share', counter: 'share_em', targets: [3, 5, 10, 25] },
  { id: 'streak', name: 'Streak Keeper', tag: 'Active days in a row', icon: 'flame', counter: 'streak', targets: [3, 7, 14, 30] },
  { id: 'grow', name: 'Grower', tag: 'Grow milestones', icon: 'trending-up', counter: null, targets: [1, 1, 1, 25], counters: ['stakes', 'boosts', 'yields', 'stakedTotal'] },
];
const REWARD_COUNTERS = ['offers', 'ads', 'quiz', 'faucet', 'spin'];

// Pure stats fold over a proofs array + user doc + referrals — no Firestore.
export function foldRewardStats(proofs, userDoc, referrals) {
  const s = { welcome: 1, offers: 0, ads: 0, quiz: 0, faucet: 0, spin: 0, invites: 0, streak: 0, stakes: 0, boosts: 0, yields: 0, stakedTotal: 0, share_wa: 0, share_tg: 0, share_x: 0, share_fb: 0, share_em: 0, claimed: {} };
  for (const p of (Array.isArray(proofs) ? proofs : [])) {
    const lb = String((p && p.label) || '');
    if (lb === 'ad-view') { s.ads++; s.boosts++; continue; }
    if (lb === 'ptc-view') { s.ads++; continue; }
    if (/^spin-(win|ticket|free|ad)$/.test(lb)) {
      // One spin = exactly one win row (win/ticket). Entry rows
      // (free/ad) are bookkeeping and must not double-count the track.
      if (/^spin-(win|ticket)$/.test(lb)) s.spin++;
      continue;
    }
    if (lb === 'invest-stake') { s.stakes++; s.stakedTotal = Math.round((s.stakedTotal + Number(p.amount || 0)) * 100) / 100; continue; }
    if (lb === 'invest-yield') { s.yields++; continue; }
    // Share milestones: one counted tap per channel per cooldown window.
    // Deep links cannot confirm a send, so taps count (see logShare).
    var shm = /^share:(wa|tg|x|fb|em)$/.exec(lb);
    if (shm) { s['share_' + shm[1]]++; continue; }
    if (lb === 'task-reward' && p.milestone) { s.claimed[String(p.milestone)] = true; continue; }
    const m = /^play:([a-z]+)$/.exec(lb);
    // Only play:quiz (correct answers) counts toward the quiz track.
    if (m && REWARD_COUNTERS.indexOf(m[1]) >= 0) s[m[1]]++;
  }
  s.invites = Array.isArray(referrals) ? referrals.length : 0;
  try { s.streak = Number((userDoc && userDoc.streak && userDoc.streak.days) || 0); } catch (_) { s.streak = 0; }
  return s;
}

// Full progress snapshot: per-track per-tier { target, amount, progress,
// unlocked, claimed }. Reads: proofs(200) + user doc + referrals(100).
export async function getRewardsProgress(uid) {
  const [proofs, userDoc, referrals] = await Promise.all([
    fetchUserDocs(uid, 'proofs', 200).catch(() => []),
    getUserDoc(uid).catch(() => ({})),
    fetchReferrals(uid, 100).catch(() => []),
  ]);
  const stats = foldRewardStats(proofs, userDoc, referrals);
  const tracks = REWARD_TRACKS.map(function (t) {
    const tiers = t.targets.map(function (target, i) {
      const key = t.counter || (t.counters && t.counters[i]);
      const progress = key === 'stakedTotal' ? Math.floor(Number(stats[key] || 0)) : Number(stats[key] || 0);
      const id = t.id + ':' + i;
      return { id, target, amount: REWARD_TIERS[i], progress, unlocked: progress >= target, claimed: !!stats.claimed[id] };
    });
    return { ...t, tiers };
  });
  let unclaimed = 0, unclaimedTotal = 0;
  // One active reward per track: only the first-unclaimed tier can be
  // claimed. Later tiers unlock strictly after claiming the current one,
  // so badge counts never advertise a stack of claimables on one card.
  tracks.forEach(function (t) {
    for (var i = 0; i < t.tiers.length; i++) {
      if (t.tiers[i].claimed) continue;
      if (t.tiers[i].unlocked) { unclaimed++; unclaimedTotal = Math.round((unclaimedTotal + t.tiers[i].amount) * 100) / 100; }
      break;
    }
  });
  return { tracks, stats, unclaimed, unclaimedTotal };
}

// ---- Notifications: bell feed, separate from Rewards dots ----
// Collection `notifications`: { uid, kind, title, body, link, read, at }.
// Kinds: self-filed 'reward-ready' + 'referral-payout'; admin-filed
// 'payout-paid' + 'payout-rejected'; worker-filed 'offer-credit' (server SDK,
// bypasses rules). Readers see own docs only; mark-read flips `read` only.
export const NOTIF_KINDS = ['reward-ready', 'referral-payout', 'offer-credit', 'payout-paid', 'payout-rejected'];

export async function notifyUser(uid, kind, title, body, link) {
  if (!uid || NOTIF_KINDS.indexOf(kind) < 0) return null;
  try {
    const r = await addDoc(collection(db, 'notifications'), {
      uid, kind,
      title: String(title || '').slice(0, 80),
      body: String(body || '').slice(0, 160),
      link: String(link || 'rewards.html').slice(0, 64),
      read: false, at: serverTimestamp()
    });
    return r.id;
  } catch (_) { return null; }
}

export async function getNotifications(uid, n) {
  try { return await fetchUserDocs(uid, 'notifications', n || 30); }
  catch (_) { return []; }
}

export async function getUnreadNotifCount(uid) {
  try {
    const rows = await fetchUserDocs(uid, 'notifications', 30);
    return rows.filter(function (r) { return r.read !== true; }).length;
  } catch (_) { return 0; }
}

// Mark all unread as read. Best-effort: failures never block the UI.
export async function markNotifsRead(uid) {
  try {
    const rows = await fetchUserDocs(uid, 'notifications', 30);
    for (const r of rows) {
      if (r.read === true || !r.id) continue;
      try { await setDoc(doc(db, 'notifications', r.id), { read: true }, { merge: true }); } catch (_) {}
    }
  } catch (_) {}
  return true;
}

export async function getUnclaimedRewards(uid) {
  try {
    const p = await getRewardsProgress(uid);
    return p.unclaimed;
  } catch (_) { return 0; }
}

// First-unclaimed tier index on a track — the single active reward.
// The shared lifetime counter keeps counting underneath; only display and
// claiming advance one step at a time. Returns -1 when all are claimed.
export function activeTierIdx(claimed, trackId, tierCount) {
  for (var i = 0; i < tierCount; i++) {
    if (!claimed[trackId + ':' + i]) return i;
  }
  return -1;
}

// Claim one milestone tier. Re-verifies unlocked + unclaimed server-side-read
// before writing, so double-clicks and stale tabs cannot double-pay.
// Tiers unlock strictly in order: claiming tier N requires N-1 claimed.
export async function claimMilestone(uid, trackId, tierIdx) {
  const t = REWARD_TRACKS.filter(function (x) { return x.id === trackId; })[0];
  if (!t || !(tierIdx >= 0) || tierIdx >= t.targets.length) return { ok: false, reason: 'unknown' };
  const amount = REWARD_TIERS[tierIdx];
  const p = await getRewardsProgress(uid);
  if (activeTierIdx(p.stats.claimed, trackId, t.targets.length) !== tierIdx) return { ok: false, reason: 'locked' };
  const tr = p.tracks.filter(function (x) { return x.id === trackId; })[0].tiers[tierIdx];
  if (!tr.unlocked) return { ok: false, reason: 'locked' };
  if (tr.claimed) return { ok: false, reason: 'claimed' };
  try {
    await creditReward(uid, amount, 'task-reward', { milestone: tr.id });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, amount };
}

// ---- Share milestones: one track per channel (WhatsApp, Telegram, X,
// Facebook, Email), each climbing [3, 5, 10, 25] on the standard payout
// ladder. Channel deep links cannot confirm a send, so a tap counts —
// gated by a per-channel cooldown (client-side, small amounts) plus the
// sequential claim order shared by all tracks.
export const SHARE_CHANNELS = ['wa', 'tg', 'x', 'fb', 'em'];
export const SHARE_NAMES = { wa: 'WhatsApp', tg: 'Telegram', x: 'X', fb: 'Facebook', em: 'Email' };
export const SHARE_COOLDOWN_MS = 5 * 60000;

export function shareCooldownLeft(channel, nowMs) {
  try {
    var last = Number(localStorage.getItem('fav_share_' + channel) || 0);
    var left = last + SHARE_COOLDOWN_MS - Number(nowMs || Date.now());
    return left > 0 ? Math.ceil(left) : 0;
  } catch (_) { return 0; }
}

// Log one counted share. Never blocks the share sheet itself — a tap inside
// the cooldown just doesn't write a proof. Amount 0: no wallet movement,
// no taskEarned, no commission; the proof row is the counter.
export async function logShare(uid, channel) {
  if (!uid || SHARE_CHANNELS.indexOf(channel) < 0) return { ok: false, reason: 'unknown' };
  if (shareCooldownLeft(channel) > 0) return { ok: false, reason: 'cooldown', waitMs: shareCooldownLeft(channel) };
  try {
    await creditReward(uid, 0, 'share:' + channel, {});
  } catch (_) { return { ok: false, reason: 'write' }; }
  try { localStorage.setItem('fav_share_' + channel, String(Date.now())); } catch (_) {}
  return { ok: true };
}

// ---- Grow engine: invest task earnings, live ticker, 6-hour mining shifts ----
// Mining runs in 6h shifts: watching an ad sets mineUntil = now + 6h, and
// yield accrues ONLY while now <= mineUntil. Watching an ad during a live
// shift also lights +1500% boost (15000% total) for exactly 1h; refill tops
// to 60:00, no stacking/banking; expiry falls back to 10000%. The $1 seed is
// invest-only: it accrues yield but its principal can never move to available.
// Referral bonuses never compound here.
export const INVEST_BASE_APR = 10000;
export const INVEST_BOOST_APR = 15000;
export const INVEST_BOOST_MS = 3600000;
export const MINE_SHIFT_MS = 6 * 3600000;
export const INVEST_SEED = 1;
export const INVEST_MAX_STAKE = 100;
export const INVEST_MIN_STAKE = 0.10;
export const INVEST_SETTLE_WINDOW_MS = 90 * 86400000;
// Legacy constant (kept for compatibility): mining never stops now, so the
// 72h grace no longer gates anything.
export const INVEST_SEED_GRACE_MS = 72 * 3600000;
const SECONDS_PER_YEAR = 31536000;

export function utcDayStr(ms) {
  try { return new Date(ms).toISOString().slice(0, 10); } catch (e) { return ''; }
}

// Pure yield math — no Firestore, fully unit-testable.
// Returns { yield, boostedSec, baseSec } for principal over [fromMs, toMs).
// Yield accrues ONLY inside the mining shift: toMs is capped at mineUntilMs
// (0/expired = no accrual). Base/boost split by boostUntilMs. activeDays /
// seedGrace args are kept for call compatibility but no longer gate anything.
export function computeYield(principal, fromMs, toMs, boostUntilMs, activeDays, seedGrace, mineUntilMs) {
  const p = Number(principal || 0);
  if (!(p > 0)) return { yield: 0, boostedSec: 0, baseSec: 0 };
  let from = Number(fromMs || 0), to = Number(toMs || 0);
  // mineUntilMs == null (legacy caller) = no cap. A provided value caps the
  // window — including 0, which means "no live shift" and yields nothing.
  if (mineUntilMs != null) {
    const mineUntil = Number(mineUntilMs || 0);
    if (to > mineUntil) to = mineUntil;
  }
  if (!(to > from)) return { yield: 0, boostedSec: 0, baseSec: 0 };
  if (to - from > INVEST_SETTLE_WINDOW_MS) from = to - INVEST_SETTLE_WINDOW_MS;
  const boostUntil = Number(boostUntilMs || 0);
  const bTo = Math.min(to, boostUntil);
  const boostedSec = bTo > from ? (bTo - from) / 1000 : 0;
  const baseSec = (to - from) / 1000 - boostedSec;
  const y = p * (baseSec * (INVEST_BASE_APR / 100) + boostedSec * (INVEST_BOOST_APR / 100)) / SECONDS_PER_YEAR;
  return { yield: y, boostedSec, baseSec };
}

async function readInvestState(uid) {
  const [w, u] = await Promise.all([getWallet(uid), getUserDoc(uid)]);
  return {
    pending: Number(w.pending || 0), lifetime: Number(w.lifetime || 0),
    invested: Number(w.invested || 0), investedAt: Number(w.investedAt || 0), boostUntil: Number(w.boostUntil || 0),
    mineUntil: Number(w.mineUntil || 0),
    taskEarned: Number(u.taskEarned || 0), investedUser: Number(u.investedUser || 0),
    activeDays: Array.isArray(u.activeDays) ? u.activeDays : [],
    createdAtMs: Number(u.createdAtMs || 0)
  };
}

function seedGraceFor(s, now) {
  if (!s.createdAtMs) return null;
  const graceUntilMs = s.createdAtMs + INVEST_SEED_GRACE_MS;
  if (graceUntilMs <= now) return null;
  return { seed: INVEST_SEED, graceUntilMs };
}

// Backfill the $1 seed for pre-Grow accounts. Never overwrites existing principal.
export async function ensureSeed(uid) {
  const now = Date.now();
  try {
    const wref = doc(db, 'wallets', uid);
    const w = await getDoc(wref);
    if (!w.exists()) {
      await setDoc(wref, { pending: 0, lifetime: 0, invested: INVEST_SEED, investedAt: now, boostUntil: 0, mineUntil: 0, updatedAt: serverTimestamp() });
    } else {
      const d = w.data();
      if (!(Number(d.invested || 0) > 0) && d.invested !== 0) {
        await setDoc(wref, { invested: INVEST_SEED, investedAt: now, boostUntil: 0, updatedAt: serverTimestamp() }, { merge: true });
      } else if (!d.investedAt) {
        await setDoc(wref, { investedAt: now, updatedAt: serverTimestamp() }, { merge: true });
      }
      // One-time starter shift for pre-shift wallets (field missing = legacy).
      if (!('mineUntil' in d)) {
        await setDoc(wref, { mineUntil: now + MINE_SHIFT_MS, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  } catch (_) {}
  try {
    await setDoc(doc(db, 'users', uid), { updatedAt: serverTimestamp() }, { merge: true });
  } catch (_) {}
  // Prune runaway activeDays lists opportunistically.
  try {
    const u = await getUserDoc(uid);
    if (u.activeDays.length > 90) {
      await setDoc(doc(db, 'users', uid), { activeDays: u.activeDays.slice(-90) }, { merge: true });
    }
  } catch (_) {}
}

// Realize accrued yield into available. Returns { yield, boostedSec, baseSec }.
export async function settleInvest(uid) {
  const now = Date.now();
  const s = await readInvestState(uid);
  if (!(s.invested > 0)) {
    try { await setDoc(doc(db, 'wallets', uid), { investedAt: now, updatedAt: serverTimestamp() }, { merge: true }); } catch (_) {}
    return { yield: 0, boostedSec: 0, baseSec: 0 };
  }
  const from = s.investedAt > 0 ? s.investedAt : now;
  const r = computeYield(s.invested, from, now, s.boostUntil, s.activeDays, seedGraceFor(s, now), s.mineUntil);
  const y = Math.floor(r.yield * 100000000) / 100000000;
  try {
    const wref = doc(db, 'wallets', uid);
    if (y > 0) {
      await updateDoc(wref, {
        pending: increment(y), lifetime: increment(y),
        investedAt: now, updatedAt: serverTimestamp(), lastLabel: 'invest-yield'
      }).catch(async () => {
        await setDoc(wref, { pending: y, lifetime: y, invested: s.invested, investedAt: now, boostUntil: s.boostUntil, updatedAt: serverTimestamp() }, { merge: true });
      });
      await addDoc(collection(db, 'proofs'), { uid, amount: y, label: 'invest-yield', status: 'done', at: serverTimestamp() });
    } else {
      await setDoc(wref, { investedAt: now, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (_) {}
  return { yield: y, boostedSec: r.boostedSec, baseSec: r.baseSec };
}

// Pure read for the ticker: current principal, unsettled accrual, boost + shift state.
export async function getLiveState(uid, atMs) {
  const now = Number(atMs || Date.now());
  const s = await readInvestState(uid);
  const from = s.investedAt > 0 ? s.investedAt : now;
  const grace = seedGraceFor(s, now);
  const r = computeYield(s.invested, from, now, s.boostUntil, s.activeDays, grace, s.mineUntil);
  const boosted = s.boostUntil > now;
  const mining = s.mineUntil > now;
  return {
    invested: s.invested, pending: s.pending,
    accrued: r.yield, boostedSec: r.boostedSec, baseSec: r.baseSec,
    boosted, boostUntil: s.boostUntil, boostRemainingMs: boosted ? s.boostUntil - now : 0,
    mining, mineUntil: s.mineUntil, shiftRemainingMs: mining ? s.mineUntil - now : 0,
    apr: boosted ? INVEST_BOOST_APR : INVEST_BASE_APR,
    investedUser: s.investedUser, taskEarned: s.taskEarned,
    graceMsLeft: grace ? Math.max(0, grace.graceUntilMs - now) : 0,
    stakeable: Math.max(0, Math.floor((s.taskEarned - s.investedUser) * 100) / 100)
  };
}

// Move available -> invested. Settles first so no yield is lost or double-paid.
export async function stakeInvest(uid, rawAmount) {
  const amount = Math.floor(Number(rawAmount || 0) * 100) / 100;
  if (!(amount >= INVEST_MIN_STAKE)) return { ok: false, reason: 'min' };
  await settleInvest(uid);
  const s = await readInvestState(uid);
  if (amount > s.pending + 1e-9) return { ok: false, reason: 'funds' };
  if (s.investedUser + amount > INVEST_MAX_STAKE + 1e-9) return { ok: false, reason: 'cap' };
  if (s.investedUser + amount > s.taskEarned + 1e-9) return { ok: false, reason: 'task-only' };
  try {
    await updateDoc(doc(db, 'wallets', uid), {
      pending: increment(-amount), invested: increment(amount),
      investedAt: Date.now(), updatedAt: serverTimestamp(), lastLabel: 'invest-stake'
    });
    await setDoc(doc(db, 'users', uid), { investedUser: Math.round((s.investedUser + amount) * 100) / 100 }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount, label: 'invest-stake', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true };
}

// Return everything above the locked $1 seed to available.
export async function unstakeAll(uid) {
  await settleInvest(uid);
  const s = await readInvestState(uid);
  const movable = Math.floor(Math.max(0, s.invested - INVEST_SEED) * 100) / 100;
  if (!(movable > 0)) return { ok: false, reason: 'seed-only' };
  try {
    await updateDoc(doc(db, 'wallets', uid), {
      pending: increment(movable), invested: INVEST_SEED,
      investedAt: Date.now(), updatedAt: serverTimestamp(), lastLabel: 'invest-unstake'
    });
    await setDoc(doc(db, 'users', uid), { investedUser: 0 }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount: movable, label: 'invest-unstake', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, amount: movable };
}

// Called after a verified ad view: settle, then top the boost tank to a full hour.
// Boost applies inside a live mining shift (a second ad during a shift).
export async function activateBoost(uid) {
  const now = Date.now();
  const s = await readInvestState(uid);
  if (s.boostUntil - now > 55 * 60000) return { ok: false, reason: 'full' };
  if (!(s.mineUntil > now)) return { ok: false, reason: 'noshift' };
  await settleInvest(uid);
  try {
    await setDoc(doc(db, 'wallets', uid), { boostUntil: now + INVEST_BOOST_MS, updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'ad-view', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, boostUntil: now + INVEST_BOOST_MS };
}

// Called after a verified ad view: settle, then open a fresh 6h mining shift.
// Re-watching with a nearly-full tank is refused (no stacking/banking).
export async function activateMining(uid) {
  const now = Date.now();
  const s = await readInvestState(uid);
  if (s.mineUntil - now > MINE_SHIFT_MS - 5 * 60000) return { ok: false, reason: 'full' };
  await settleInvest(uid);
  try {
    await setDoc(doc(db, 'wallets', uid), { mineUntil: now + MINE_SHIFT_MS, updatedAt: serverTimestamp(), lastLabel: 'mine-start' }, { merge: true });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, mineUntil: now + MINE_SHIFT_MS };
}

// Single reward write path (replaces FavStore.addReward): wallet + proof row.
// Also files the referrer's lifetime % debt (25% task / 10% offer) — fire-and-forget.
export async function creditReward(uid, amount, label, extra) {
  const wref = doc(db, 'wallets', uid);
  await updateDoc(wref, {
    pending: increment(amount), lifetime: increment(amount),
    updatedAt: serverTimestamp(), lastLabel: label || null
  }).catch(async () => {
    await setDoc(wref, { pending: amount, lifetime: amount, updatedAt: serverTimestamp() }, { merge: true });
  });
  await addDoc(collection(db, 'proofs'), {
    uid, amount, label: label || 'quest',
    status: 'pending', at: serverTimestamp(), ...(extra || {})
  });
  try { recordCommission(uid, amount, label); } catch (_) {}
  // Sound on every credit (muted-safe: coinPour() is a no-op when muted).
  try { if (Number(amount) > 0) coinPour(); } catch (_) {}
  // Grow bookkeeping: task earnings raise the stakeable ceiling and mark
  // today active (stats only — mining never stops). Referral/invest labels are excluded.
  try {
    const ll = (label || '').toLowerCase();
    if (!/^(referral-|invest-|ad-)/.test(ll) && Number(amount) > 0) {
      const day = utcDayStr(Date.now());
      const ud = { taskEarned: increment(Number(amount)), updatedAt: serverTimestamp() };
      if (day) ud.activeDays = arrayUnion(day);
      await setDoc(doc(db, 'users', uid), ud, { merge: true });
    }
  } catch (_) {}
}

// One-time migration: local wallet/proofs -> Firestore, then wipe every favmoney_* key.
export async function migrateLocal(uid) {
  let wallet = null, proofs = [];
  try {
    const raw = localStorage.getItem('favmoney_wallet');
    if (raw) wallet = JSON.parse(raw);
  } catch (e) {}
  try {
    const raw = localStorage.getItem('favmoney_proofs');
    if (raw) proofs = JSON.parse(raw) || [];
  } catch (e) {}
  const moved = (wallet && (Number(wallet.pending) > 0 || Number(wallet.lifetime) > 0)) || proofs.length > 0;
  if (moved) {
    const amt = wallet ? Math.round(Number(wallet.pending || 0) * 100) / 100 : 0;
    if (amt > 0) await creditReward(uid, amt, 'Migrated balance');
    for (const p of proofs.slice(0, 50)) {
      await addDoc(collection(db, 'proofs'), {
        uid, amount: Number(p.amount || 0), label: p.label || 'quest',
        status: 'pending', at: serverTimestamp()
      });
    }
  }
  try {
    ['favmoney_user', 'favmoney_wallet', 'favmoney_proofs', 'favmoney_waitlist',
     'favmoney_cashouts', 'favmoney_streak', 'favmoney_started',
     'favmoney_claimed_quests'].forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  try { localStorage.setItem('favmoney_migrated', '1'); } catch (e) {}
  return moved;
}

export function wasMigrated() {
  try { return localStorage.getItem('favmoney_migrated') === '1'; } catch (e) { return true; }
}

// Recent docs for one user (client-sorted, no composite index needed).
export async function fetchUserDocs(uid, name, n) {
  const snap = await getDocs(query(
    collection(db, name), where('uid', '==', uid), limit(n || 20)
  ));
  const rows = [];
  snap.forEach(function (d) { rows.push({ id: d.id, ...d.data() }); });
  rows.sort(function (a, b) {
    const ta = (a.at && a.at.seconds) || 0, tb = (b.at && b.at.seconds) || 0;
    return tb - ta;
  });
  return rows;
}

export {
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail
};
