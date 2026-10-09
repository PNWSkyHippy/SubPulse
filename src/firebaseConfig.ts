import { initializeApp, getApps } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { initializeAuth, Persistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

// Fill these in from your Firebase project settings (console.firebase.google.com
// -> Project settings -> General -> Your apps -> SDK setup and configuration).
// These are safe to commit for client apps; access is controlled by Firestore
// security rules (see firestore.rules), not by hiding this config.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'REPLACE_ME',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'REPLACE_ME',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'REPLACE_ME',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'REPLACE_ME',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? 'REPLACE_ME',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? 'REPLACE_ME',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Persistent sign-in. metro.config.js turns off package-exports resolution, so
// Metro loads @firebase/auth's "react-native" build (dist/rn), which exports
// getReactNativePersistence (Expo Go logs "initializing Firebase Auth for React
// Native", confirming that build is used). The web build has no such export, so
// it is looked up dynamically and we fall back to in-memory persistence (sign in
// again after closing the app) instead of crashing if it is ever missing.
// initializeAuth is called exactly once either way; calling getAuth() first
// would register auth without persistence.
const getRNPersistence: ((storage: unknown) => Persistence) | undefined = (FirebaseAuth as any).getReactNativePersistence;
export const auth =
  typeof getRNPersistence === 'function'
    ? initializeAuth(app, { persistence: getRNPersistence(ReactNativeAsyncStorage) })
    : initializeAuth(app);

export const db = getFirestore(app);
export default app;
