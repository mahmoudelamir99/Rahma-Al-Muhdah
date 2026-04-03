const FIREBASE_CDN_BASE = 'https://www.gstatic.com/firebasejs/11.5.0';

export type FirebaseRuntimeConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type FirebaseServices = {
  app: unknown;
  auth: any;
  db: any;
  storage: any;
  authModule: any;
  firestoreModule: any;
  storageModule: any;
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

function getRuntimeFirebaseConfig(): FirebaseRuntimeConfig {
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
  const firebaseConfig = getRuntimeFirebaseConfig();
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

let firebaseServicesPromise: Promise<FirebaseServices | null> | null = null;

async function importFirebaseModule(modulePath: string) {
  return import(/* @vite-ignore */ `${FIREBASE_CDN_BASE}/${modulePath}`);
}

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (!firebaseServicesPromise) {
    firebaseServicesPromise = (async () => {
      try {
        const [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
          importFirebaseModule('firebase-app.js'),
          importFirebaseModule('firebase-auth.js'),
          importFirebaseModule('firebase-firestore.js'),
          importFirebaseModule('firebase-storage.js'),
        ]);

        const firebaseConfig = getRuntimeFirebaseConfig();
        const app = appModule.getApps?.().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
        const auth = authModule.getAuth(app);
        const db = firestoreModule.getFirestore(app);
        const storage = storageModule.getStorage(app);

        return {
          app,
          auth,
          db,
          storage,
          authModule,
          firestoreModule,
          storageModule,
        };
      } catch (error) {
        console.warn('Firebase bootstrap failed in Auth app', error);
        firebaseServicesPromise = null;
        return null;
      }
    })();
  }

  return firebaseServicesPromise;
}

export function getFirebaseConfig() {
  return { ...getRuntimeFirebaseConfig() };
}
