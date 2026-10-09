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
  serverTimestamp, updateDoc, increment, query, where, getDocs, limit
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
      createdAt: serverTimestamp()
    });
  }
  const wref = doc(db, 'wallets', user.uid);
  const w = await getDoc(wref);
  if (!w.exists()) {
    await setDoc(wref, { pending: 0, lifetime: 0, updatedAt: serverTimestamp() });
  }
}

export async function getWallet(uid) {
  const snap = await getDoc(doc(db, 'wallets', uid));
  if (!snap.exists()) return { pending: 0, lifetime: 0 };
  const d = snap.data();
  return { pending: Number(d.pending || 0), lifetime: Number(d.lifetime || 0) };
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
    refcode: d.refcode || null
  };
}

export async function updateUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// Single reward write path (replaces FavStore.addReward): wallet + proof row.
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
