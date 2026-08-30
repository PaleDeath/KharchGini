/**
 * Firebase initialisation.
 *
 * Deliberately lazy and deliberately survivable. If the environment variables
 * are missing, this module does NOT throw at import time — it reports
 * `firebaseReady === false` and lets the app render a setup screen instead of a
 * white page with a stack trace. A first run that fails silently is the fastest
 * way to lose someone before they have entered a single rupee.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** True when there is enough configuration to attempt a connection at all. */
export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId);

/** Names only — used by the setup screen to say which values are missing. */
export const missingFirebaseKeys: string[] = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!firebaseReady) {
    throw new Error('Firebase is not configured. Fill in .env.local.');
  }
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

/**
 * Firestore with persistent local cache. Two consequences worth stating:
 *
 *  1. The app opens instantly on a return visit, because the ledger is already
 *     on the device — no spinner over an empty screen.
 *  2. It works with no signal. Entries written offline queue and sync when the
 *     connection returns, which is the difference between "I'll log it later"
 *     and never logging it.
 */
export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = initializeFirestore(ensureApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return dbInstance;
}
