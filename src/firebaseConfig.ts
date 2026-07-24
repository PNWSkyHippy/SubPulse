import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence's types only resolve via Metro's
// RN-specific module resolution, not plain tsc. Correct at actual build time.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// @ts-ignore - no official types for this subpath
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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

// initializeAuth must be called before getAuth ever succeeds in React Native
// (it's what registers the auth component for this platform). It throws if
// called a second time on the same app instance (e.g. during Fast Refresh),
// so fall back to getAuth in that case rather than re-checking getApps().
let authInstance;
try {
  authInstance = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });
} catch (e) {
  authInstance = getAuth(app);
}
export const auth = authInstance;

export const db = getFirestore(app);
export default app;
