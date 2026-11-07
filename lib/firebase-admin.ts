import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// With FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set, the Admin SDK talks to the emulators.
const app =
  getApps()[0] ??
  initializeApp(
    process.env.FIREBASE_SERVICE_ACCOUNT
      ? { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) }
      : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  );

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
