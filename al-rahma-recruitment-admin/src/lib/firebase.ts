import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  getIdTokenResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  authModule: {
    EmailAuthProvider: typeof EmailAuthProvider;
    browserLocalPersistence: typeof browserLocalPersistence;
    browserSessionPersistence: typeof browserSessionPersistence;
    getIdTokenResult: typeof getIdTokenResult;
    onAuthStateChanged: typeof onAuthStateChanged;
    reauthenticateWithCredential: typeof reauthenticateWithCredential;
    sendPasswordResetEmail: typeof sendPasswordResetEmail;
    setPersistence: typeof setPersistence;
    signInWithEmailAndPassword: typeof signInWithEmailAndPassword;
    signOut: typeof signOut;
    updateEmail: typeof updateEmail;
    updatePassword: typeof updatePassword;
    updateProfile: typeof updateProfile;
  };
  firestoreModule: {
    collection: typeof collection;
    doc: typeof doc;
    getDoc: typeof getDoc;
    getDocs: typeof getDocs;
    onSnapshot: typeof onSnapshot;
    setDoc: typeof setDoc;
    writeBatch: typeof writeBatch;
  };
  storageModule: {
    getDownloadURL: typeof getDownloadURL;
    ref: typeof ref;
    uploadBytes: typeof uploadBytes;
  };
};

type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

declare global {
  interface Window {
    __RAHMA_FIREBASE_CONFIG__?: Partial<FirebaseRuntimeConfig>;
  }
}

const envFirebaseConfig: FirebaseRuntimeConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || '',
};

export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  const runtimeConfig =
    typeof window !== 'undefined' && window.__RAHMA_FIREBASE_CONFIG__ && typeof window.__RAHMA_FIREBASE_CONFIG__ === 'object'
      ? window.__RAHMA_FIREBASE_CONFIG__
      : {};

  return {
    apiKey: String(envFirebaseConfig.apiKey || runtimeConfig.apiKey || '').trim(),
    authDomain: String(envFirebaseConfig.authDomain || runtimeConfig.authDomain || '').trim(),
    projectId: String(envFirebaseConfig.projectId || runtimeConfig.projectId || '').trim(),
    storageBucket: String(envFirebaseConfig.storageBucket || runtimeConfig.storageBucket || '').trim(),
    messagingSenderId: String(envFirebaseConfig.messagingSenderId || runtimeConfig.messagingSenderId || '').trim(),
    appId: String(envFirebaseConfig.appId || runtimeConfig.appId || '').trim(),
    measurementId: String(envFirebaseConfig.measurementId || runtimeConfig.measurementId || '').trim(),
  };
}

export function hasFirebaseConfig() {
  const firebaseConfig = getFirebaseRuntimeConfig();
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

let firebaseServicesPromise: Promise<FirebaseServices | null> | null = null;

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (!firebaseServicesPromise) {
    firebaseServicesPromise = Promise.resolve().then(() => {
      const firebaseConfig = getFirebaseRuntimeConfig();
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      const storage = getStorage(app);

      return {
        app,
        auth,
        db,
        storage,
        authModule: {
          EmailAuthProvider,
          browserLocalPersistence,
          browserSessionPersistence,
          getIdTokenResult,
          onAuthStateChanged,
          reauthenticateWithCredential,
          sendPasswordResetEmail,
          setPersistence,
          signInWithEmailAndPassword,
          signOut,
          updateEmail,
          updatePassword,
          updateProfile,
        },
        firestoreModule: {
          collection,
          doc,
          getDoc,
          getDocs,
          onSnapshot,
          setDoc,
          writeBatch,
        },
        storageModule: {
          getDownloadURL,
          ref,
          uploadBytes,
        },
      };
    });
  }

  return firebaseServicesPromise;
}
