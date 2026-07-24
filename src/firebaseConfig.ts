import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
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

// NOTE: We intentionally do NOT use getReactNativePersistence here. In several
// firebase npm package versions (verified: 10.14.1), the package's exports map
// has no "react-native" condition for the ./auth subpath, so Metro resolves to
// the web build, which does not contain getReactNativePersistence at all —
// calling it throws, which then made getAuth() fail with "Component auth has
// not been registered yet" (initializeAuth never completed registration).
//
// Trade-off: auth state is in-memory only, so signing in again is required
// after fully closing (not just backgrounding) the app. This can be revisited
// later using a package like @react-native-firebase or a verified-working
// firebase version, once the app is otherwise stable.
let authInstance;
try {
  authInstance = initializeAuth(app);
} catch (e) {
  // initializeAuth throws if called twice on the same app instance
  // (e.g. during Fast Refresh) — fall back to the existing instance.
  authInstance = getAuth(app);
}
export const auth = authInstance;

export const db = getFirestore(app);
export default app;
