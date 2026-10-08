// Favmoney Firebase bootstrap (ES module, CDN, Pages-safe, no npm build step).
// Uses Firebase JS SDK v12 via gstatic. Web apiKey is public by design; real
// security comes from Auth + Firestore rules, not key secrecy.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { isSupported as analyticsSupported, getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection,
  serverTimestamp, updateDoc, increment
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const firebaseConfig = {
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

export async function joinWaitlist(email, source) {
  await addDoc(collection(db, 'waitlist'), {
    email, source: source || 'landing', at: serverTimestamp()
  });
}

export {
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup
};
