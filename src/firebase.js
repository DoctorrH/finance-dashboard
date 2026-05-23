import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB9LqUHFxVxg_jxmaf184mjRPbHgzHvvwo",
  authDomain: "financedashboard141.firebaseapp.com",
  projectId: "financedashboard141",
  storageBucket: "financedashboard141.firebasestorage.app",
  messagingSenderId: "453798762974",
  appId: "1:453798762974:web:23546d45a185d2fa2c654f",
  measurementId: "G-9MT45XVBTY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// === Google Auth ===
const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// Helper: user-scoped document reference
const userDoc = (uid, docName) => doc(db, 'users', uid, 'data', docName);

// === Portfolio ===
export const savePortfolioToFirebase = async (uid, portfolioData) => {
  try {
    await setDoc(userDoc(uid, 'portfolio'), { portfolio: portfolioData }, { merge: true });
  } catch (err) {
    console.error("Error saving portfolio: ", err);
  }
};

export const savePurchasingPowerToFirebase = async (uid, purchasingPower) => {
  try {
    await setDoc(userDoc(uid, 'portfolio'), { purchasingPower }, { merge: true });
  } catch (err) {
    console.error("Error saving purchasing power: ", err);
  }
};

export const subscribeToPortfolio = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'portfolio'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        portfolio: data.portfolio || [],
        purchasingPower: data.purchasingPower || 0
      });
    } else {
      callback({ portfolio: [], purchasingPower: 0 });
    }
  });
};

// === Transactions (Chi tiêu & Thu nhập) ===
export const saveTransactions = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'transactions'), { items: data }, { merge: true });
  } catch (err) {
    console.error("Error saving transactions: ", err);
  }
};

export const subscribeTransactions = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'transactions'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().items || []);
    } else {
      callback([]);
    }
  });
};

// === Debts (Quản lý Nợ) ===
export const saveDebts = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'debts'), { items: data }, { merge: true });
  } catch (err) {
    console.error("Error saving debts: ", err);
  }
};

export const subscribeDebts = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'debts'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().items || []);
    } else {
      callback([]);
    }
  });
};

// === Savings (Tiết kiệm) ===
export const saveSavings = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'savings'), { items: data }, { merge: true });
  } catch (err) {
    console.error("Error saving savings: ", err);
  }
};

export const subscribeSavings = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'savings'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().items || []);
    } else {
      callback([]);
    }
  });
};

// === Passbooks (Sổ tiết kiệm) ===
export const savePassbooks = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'passbooks'), { items: data }, { merge: true });
  } catch (err) {
    console.error("Error saving passbooks: ", err);
  }
};

export const subscribePassbooks = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'passbooks'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().items || []);
    } else {
      callback([]);
    }
  });
};

// === Gold Holdings (Vàng đang nắm giữ) ===
export const saveGoldHoldings = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'gold_holdings'), { items: data }, { merge: true });
  } catch (err) {
    console.error("Error saving gold holdings: ", err);
  }
};

export const subscribeGoldHoldings = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'gold_holdings'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().items || []);
    } else {
      callback([]);
    }
  });
};

// === Asset History (Lịch sử Tài sản) ===
export const saveAssetHistory = async (uid, data) => {
  try {
    await setDoc(userDoc(uid, 'asset_history'), { history: data }, { merge: true });
  } catch (err) {
    console.error("Error saving asset history: ", err);
  }
};

export const subscribeAssetHistory = (uid, callback) => {
  return onSnapshot(userDoc(uid, 'asset_history'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().history || []);
    } else {
      callback([]);
    }
  });
};

// === Migration: chuyển dữ liệu cũ sang tài khoản user mới ===
export const migrateOldData = async (uid) => {
  try {
    // Nếu user đã có dữ liệu portfolio → đã migrate rồi, bỏ qua
    const existingSnap = await getDoc(userDoc(uid, 'portfolio'));
    if (existingSnap.exists()) {
      console.log('User already has data, skipping migration.');
      return;
    }

    console.log('Starting data migration for user:', uid);

    // Migrate portfolio từ path cũ
    const oldPortfolioRef = doc(db, 'users', 'personal_portfolio_v1');
    const oldPortfolioSnap = await getDoc(oldPortfolioRef);
    if (oldPortfolioSnap.exists() && oldPortfolioSnap.data().portfolio?.length > 0) {
      await setDoc(userDoc(uid, 'portfolio'), oldPortfolioSnap.data());
      console.log('Migrated portfolio.');
    }

    // Migrate finance data từ path cũ
    const collections = [
      { old: 'transactions', new: 'transactions' },
      { old: 'debts', new: 'debts' },
      { old: 'savings', new: 'savings' },
      { old: 'gold_holdings', new: 'gold_holdings' },
      { old: 'asset_history', new: 'asset_history' },
    ];

    for (const col of collections) {
      const oldRef = doc(db, 'finance', col.old);
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists()) {
        await setDoc(userDoc(uid, col.new), oldSnap.data());
        console.log(`Migrated ${col.old}.`);
      }
    }

    console.log('Migration completed!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
};
