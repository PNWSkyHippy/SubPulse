# Subscription Tracker

Track recurring subscriptions, see total monthly spend, and get a reminder
before each renewal. One codebase (Expo / React Native + TypeScript) ships
to both Android and iOS. Data syncs across devices via Firebase.

## What's already built and verified

- Sign up / sign in (Firebase Auth, email+password)
- Add / view / edit / delete subscriptions, synced live via Firestore
- Monthly spend total, normalized across weekly/monthly/yearly billing cycles
- Local push reminder N days before each renewal (`expo-notifications`)
- Firestore security rules so each user only ever sees their own data

**Already tested in this environment (not just written — actually run):**
- `npm test` → 14/14 unit tests passing, covering renewal-date rollover
  (including stale/past dates), monthly-cost normalization across billing
  cycles, and the reminder-firing window logic — the parts of a subscription
  tracker that are easy to get subtly wrong.
- `npx tsc --noEmit` → clean, whole project type-checks with no errors.

What I *can't* test in this sandbox: the actual on-device UI (no phone
emulator here). That needs the Expo Go step below, which takes a few minutes
on your end.

## 1. One-time setup

1. Install [Node.js 18+](https://nodejs.org) if you don't have it.
2. `npm install -g eas-cli` (only needed later, for store builds).
3. Install **Expo Go** on your phone (App Store / Play Store) — this lets
   you run and test the real app on your real phone during development,
   with no build step and no developer account needed yet.
4. Create a free [Firebase project](https://console.firebase.google.com):
   - Enable **Authentication → Email/Password**.
   - Create a **Firestore** database (start in production mode).
   - Paste the `firestore.rules` file's contents into Firestore's Rules tab.
   - Project settings → General → "Your apps" → add a Web app → copy the
     config values into a `.env` file at the project root:
     ```
     EXPO_PUBLIC_FIREBASE_API_KEY=...
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
     EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
     EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
     EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
     EXPO_PUBLIC_FIREBASE_APP_ID=...
     ```

## 2. Run it on your phone

```bash
npm install
npx expo start
```
Scan the QR code with Expo Go (Android) or the Camera app (iOS). Sign up,
add a subscription with a renewal date a few days out, and confirm the
reminder notification arrives.

## 3. Run the tests yourself

```bash
npm test          # unit tests for renewal/cost/reminder logic
npm run typecheck # full TypeScript check
```

## 4. Publishing — what's real about this step

I can't create your developer accounts, pay their fees, or click submit —
those require your identity and payment info. Here's exactly what's left,
in order:

1. **Google Play**: [Play Console](https://play.google.com/console) signup,
   $25 one-time fee, ~1 day identity verification.
2. **Apple**: [Apple Developer Program](https://developer.apple.com/programs/)
   signup, $99/year, identity verification (can take a few days).
3. Once you have accounts, run `eas build --platform android` and
   `eas build --platform ios` (needs `eas login` and `eas build:configure`
   first) — this produces the signed `.aab` (Android) and `.ipa` (iOS)
   files the stores require.
4. `eas submit` can push those builds directly to Play Console / App Store
   Connect once the accounts exist.
5. Each store then does its own review (Google: hours to ~1 day typically;
   Apple: often 1–3 days) before the app goes live.

I'm glad to walk through steps 3–4 with you interactively once you have
the accounts from steps 1–2 — those two I genuinely cannot do for you.

## Project structure

```
App.tsx                          navigation + auth-gated routing
src/
  firebaseConfig.ts               Firebase init (reads .env)
  context/AuthContext.tsx         sign in/up/out, auth state
  context/SubscriptionsContext.tsx Firestore CRUD + live sync + reminders
  screens/                        Login, Signup, Home, Add, Detail
  components/SubscriptionCard.tsx
  utils/dateHelpers.ts            renewal-date math, cost normalization
  utils/notifications.ts          local reminder scheduling
  utils/__tests__/                unit tests (run with `npm test`)
firestore.rules                   per-user data isolation
app.json                          Expo/store config (bundle IDs etc.)
```
