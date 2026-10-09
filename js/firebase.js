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
  serverTimestamp, updateDoc, increment, query, where, getDocs, limit, arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

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

export async function ensureUserDoc(user, provider) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null, provider: provider || 'email',
      taskEarned: 0, investedUser: 0, activeDays: [],
      createdAt: serverTimestamp()
    });
  }
  const wref = doc(db, 'wallets', user.uid);
  const w = await getDoc(wref);
  if (!w.exists()) {
    // Every account starts with a locked $1.00 grower seed (invest-only, never withdrawable).
    await setDoc(wref, { pending: 0, lifetime: 0, invested: 1, investedAt: Date.now(), boostUntil: 0, updatedAt: serverTimestamp() });
  }
}

export async function getWallet(uid) {
  const snap = await getDoc(doc(db, 'wallets', uid));
  if (!snap.exists()) return { pending: 0, lifetime: 0, invested: 0, investedAt: 0, boostUntil: 0 };
  const d = snap.data();
  return {
    pending: Number(d.pending || 0), lifetime: Number(d.lifetime || 0),
    invested: Number(d.invested || 0), investedAt: Number(d.investedAt || 0), boostUntil: Number(d.boostUntil || 0)
  };
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
  await addDoc(collection(db, 'cashouts'), {
    uid, ...data, status: 'review', at: serverTimestamp()
  });
  const wref = doc(db, 'wallets', uid);
  await updateDoc(wref, {
    pending: increment(-Number(data.amount || 0)),
    updatedAt: serverTimestamp()
  });
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
// Never throws — signup must succeed even if referral writes fail.
export async function redeemReferral(newUid, rawCode) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) return { ok: false, reason: 'empty' };
  let ownerUid = null;
  try { ownerUid = await resolveCodeOwner(code); } catch (_) { ownerUid = null; }
  if (!ownerUid) return { ok: false, reason: 'invalid' };
  if (ownerUid === newUid) return { ok: false, reason: 'self' };
  try {
    await setDoc(doc(db, 'users', newUid), { refcode: code, referredBy: ownerUid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (_) {}
  try {
    await creditInstant(newUid, REF_INVITEE_AMOUNT, 'referral-invitee');
  } catch (_) {}
  try {
    await setDoc(doc(db, 'referrals', newUid), {
      code, ownerUid, newUid,
      amount: REF_INVITER_AMOUNT, inviteeAmount: REF_INVITEE_AMOUNT,
      claimed: false, createdAt: serverTimestamp()
    });
  } catch (_) {}
  return { ok: true, ownerUid };
}

function commissionKind(label) {
  const l = (label || '').toLowerCase();
  if (/offer|survey|partner|adgate|timewall|app install|trial/.test(l)) return 'offer';
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
  return { claimed: n, total: Math.round(n * REF_INVITER_AMOUNT * 100) / 100 };
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

// ---- Grow engine: invest task earnings, live ticker, hourly ad booster ----
// Base 3000% APR always on. Watching an ad sets boostUntil = now + 1h, during
// which 4500% APR applies. Yield accrues only on UTC days with rewarded activity
// (activeDays gate). The $1 seed is invest-only: it accrues yield but its
// principal can never move to available. Referral bonuses never compound here.
export const INVEST_BASE_APR = 3000;
export const INVEST_BOOST_APR = 4500;
export const INVEST_BOOST_MS = 3600000;
export const INVEST_SEED = 1;
export const INVEST_MAX_STAKE = 100;
export const INVEST_MIN_STAKE = 0.10;
export const INVEST_SETTLE_WINDOW_MS = 90 * 86400000;
// Welcome ignition: the $1 seed accrues at base rate for 72h after signup even
// with no rewarded activity yet, so the ticker is alive from the first visit.
// Bounded: at most ~$0.25 per account, then the activity gate takes over.
export const INVEST_SEED_GRACE_MS = 72 * 3600000;
const SECONDS_PER_YEAR = 31536000;

export function utcDayStr(ms) {
  try { return new Date(ms).toISOString().slice(0, 10); } catch (e) { return ''; }
}

// Pure yield math — no Firestore, fully unit-testable.
// Returns { yield, boostedSec, baseSec } for principal over [fromMs, toMs).
// seedGrace ({ seed, graceUntilMs }, optional): on days WITHOUT activity, the
// seed portion still accrues while segFrom < graceUntilMs. Bounds farmability
// to a small welcome drip instead of a frozen-at-zero first impression.
export function computeYield(principal, fromMs, toMs, boostUntilMs, activeDays, seedGrace) {
  const p = Number(principal || 0);
  if (!(p > 0)) return { yield: 0, boostedSec: 0, baseSec: 0 };
  let from = Number(fromMs || 0), to = Number(toMs || 0);
  if (!(to > from)) return { yield: 0, boostedSec: 0, baseSec: 0 };
  if (to - from > INVEST_SETTLE_WINDOW_MS) from = to - INVEST_SETTLE_WINDOW_MS;
  const active = new Set(Array.isArray(activeDays) ? activeDays : []);
  const boostUntil = Number(boostUntilMs || 0);
  const graceSeed = seedGrace ? Math.min(Number(seedGrace.seed || 0), p) : 0;
  const graceUntil = seedGrace ? Number(seedGrace.graceUntilMs || 0) : 0;
  const boostSplit = (a, b) => {
    const bTo = Math.min(b, boostUntil);
    const boosted = bTo > a ? (bTo - a) / 1000 : 0;
    return [boosted, (b - a) / 1000 - boosted];
  };
  let y = 0, bSec = 0, baseSec = 0;
  // Walk UTC-day segments so the activity gate applies per calendar day.
  let dayStart = Math.floor(from / 86400000) * 86400000;
  let guard = 0;
  while (dayStart < to && guard < 100) {
    guard++;
    const segFrom = Math.max(from, dayStart), segTo = Math.min(to, dayStart + 86400000);
    dayStart += 86400000;
    if (!(segTo > segFrom)) continue;
    if (active.has(utcDayStr(segFrom))) {
      const [boosted, base] = boostSplit(segFrom, segTo);
      bSec += boosted; baseSec += base;
      y += p * (base * (INVEST_BASE_APR / 100) + boosted * (INVEST_BOOST_APR / 100)) / SECONDS_PER_YEAR;
      continue;
    }
    // Inactive day: only the seed drip, only inside the welcome grace.
    if (graceSeed > 0 && segFrom < graceUntil) {
      const gTo = Math.min(segTo, graceUntil);
      const [boosted, base] = boostSplit(segFrom, gTo);
      bSec += boosted; baseSec += base;
      y += graceSeed * (base * (INVEST_BASE_APR / 100) + boosted * (INVEST_BOOST_APR / 100)) / SECONDS_PER_YEAR;
    }
  }
  return { yield: y, boostedSec: bSec, baseSec: baseSec };
}

async function readInvestState(uid) {
  const [w, u] = await Promise.all([getWallet(uid), getUserDoc(uid)]);
  return {
    pending: Number(w.pending || 0), lifetime: Number(w.lifetime || 0),
    invested: Number(w.invested || 0), investedAt: Number(w.investedAt || 0), boostUntil: Number(w.boostUntil || 0),
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
      await setDoc(wref, { pending: 0, lifetime: 0, invested: INVEST_SEED, investedAt: now, boostUntil: 0, updatedAt: serverTimestamp() });
    } else {
      const d = w.data();
      if (!(Number(d.invested || 0) > 0) && d.invested !== 0) {
        await setDoc(wref, { invested: INVEST_SEED, investedAt: now, boostUntil: 0, updatedAt: serverTimestamp() }, { merge: true });
      } else if (!d.investedAt) {
        await setDoc(wref, { investedAt: now, updatedAt: serverTimestamp() }, { merge: true });
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
  const r = computeYield(s.invested, from, now, s.boostUntil, s.activeDays, seedGraceFor(s, now));
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

// Pure read for the ticker: current principal, unsettled accrual, boost state.
export async function getLiveState(uid, atMs) {
  const now = Number(atMs || Date.now());
  const s = await readInvestState(uid);
  const from = s.investedAt > 0 ? s.investedAt : now;
  const grace = seedGraceFor(s, now);
  const r = computeYield(s.invested, from, now, s.boostUntil, s.activeDays, grace);
  const boosted = s.boostUntil > now;
  return {
    invested: s.invested, pending: s.pending,
    accrued: r.yield, boostedSec: r.boostedSec, baseSec: r.baseSec,
    boosted, boostUntil: s.boostUntil, boostRemainingMs: boosted ? s.boostUntil - now : 0,
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

// Return the user's own principal to available. The $1 seed never moves.
export async function unstakeAll(uid) {
  await settleInvest(uid);
  const s = await readInvestState(uid);
  const movable = Math.floor(Math.min(s.investedUser, s.invested - INVEST_SEED) * 100) / 100;
  if (!(movable > 0)) return { ok: false, reason: 'seed-only' };
  try {
    await updateDoc(doc(db, 'wallets', uid), {
      pending: increment(movable), invested: increment(-movable),
      investedAt: Date.now(), updatedAt: serverTimestamp(), lastLabel: 'invest-unstake'
    });
    await setDoc(doc(db, 'users', uid), { investedUser: Math.max(0, Math.round((s.investedUser - movable) * 100) / 100) }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount: movable, label: 'invest-unstake', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, amount: movable };
}

// Called after a verified ad view: settle, then top the boost tank to a full hour.
export async function activateBoost(uid) {
  const now = Date.now();
  const s = await readInvestState(uid);
  if (s.boostUntil - now > 55 * 60000) return { ok: false, reason: 'full' };
  await settleInvest(uid);
  try {
    await setDoc(doc(db, 'wallets', uid), { boostUntil: now + INVEST_BOOST_MS, updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, 'proofs'), { uid, amount: 0, label: 'ad-view', status: 'done', at: serverTimestamp() });
  } catch (_) { return { ok: false, reason: 'write' }; }
  return { ok: true, boostUntil: now + INVEST_BOOST_MS };
}

// Single reward write path (replaces FavStore.addReward): wallet + proof row.
// Also files the referrer's lifetime % debt (25% task / 10% offer) — fire-and-forget.
export async function creditReward(uid, amount, label) {
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
  try { recordCommission(uid, amount, label); } catch (_) {}
  // Grow gate bookkeeping: task earnings raise the stakeable ceiling and mark
  // today active for yield accrual. Referral/invest labels are excluded.
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
