// Favmoney browser storage — OFFLINE CACHE + Firebase mirror.
// Firebase is live in js/firebase.js. FavStore stays synchronous so every page
// works offline; Firebase module scripts mirror the same writes to Firestore.
// Single source of truth going forward: Firestore (wallets/proofs/cashouts).
// Local keys: favmoney_user, favmoney_wallet, favmoney_proofs, favmoney_waitlist
(function (global) {
  var KEYS = {
    user: 'favmoney_user',
    wallet: 'favmoney_wallet',
    proofs: 'favmoney_proofs',
    waitlist: 'favmoney_waitlist'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var FavStore = {
    KEYS: KEYS,
    // TODO(firebase): replace these with Firestore/Auth calls. Same signatures.
    getUser: function () { return read(KEYS.user, null); },
    setUser: function (u) { write(KEYS.user, u); return u; },
    clearUser: function () { try { localStorage.removeItem(KEYS.user); } catch (e) {} },
    getWallet: function () { return read(KEYS.wallet, { balance: 0, pending: 0, lifetime: 0 }); },
    addReward: function (amount, label) {
      var w = FavStore.getWallet();
      w.pending = Math.round((w.pending + amount) * 100) / 100;
      w.lifetime = Math.round((w.lifetime + amount) * 100) / 100;
      write(KEYS.wallet, w);
      var proofs = FavStore.getProofs();
      proofs.push({ amount: amount, label: label || 'quest', at: new Date().toISOString(), status: 'pending' });
      write(KEYS.proofs, proofs);
      return w;
    },
    getProofs: function () { return read(KEYS.proofs, []); },
    addToWaitlist: function (email) {
      var list = read(KEYS.waitlist, []);
      if (list.indexOf(email) === -1) { list.push(email); write(KEYS.waitlist, list); }
      return list;
    }
  };

  global.FavStore = FavStore;
})(window);
