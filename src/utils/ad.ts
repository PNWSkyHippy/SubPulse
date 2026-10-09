/**
 * ADS SCAFFOLD — NOT YET FUNCTIONAL.
 *
 * This file defines the intended shape of ad logic (when/whether to show an
 * interstitial, respecting a "remove ads" purchase) WITHOUT depending on a
 * real ad SDK yet. Two reasons for holding off on the actual install:
 *
 * 1. As of this writing, react-native-google-mobile-ads has an open,
 *    unresolved bug specifically against Expo SDK 54 (its config plugin
 *    fails to load — see github.com/invertase/react-native-google-mobile-ads
 *    issue #820). Installing it now risks destabilizing a working app for a
 *    library that's known-broken against your exact setup.
 * 2. Like RevenueCat, this needs a real native/dev build to test at all —
 *    it cannot run in Expo Go regardless of the bug above, so there's no
 *    testing capability lost by waiting.
 *
 * When ready (your first real `eas build`), re-check whether that bug is
 * fixed, then: `npx expo install react-native-google-mobile-ads`, add the
 * config plugin with real AdMob app IDs from your AdMob account, replace
 * the stub below with real InterstitialAd.createForAdRequest(...) calls,
 * and use Google's official TEST ad unit IDs during development (never
 * real ad unit IDs in a dev build — that risks your AdMob account being
 * flagged for invalid traffic).
 *
 * Google's current test interstitial unit IDs (safe to hardcode for dev):
 *   Android: ca-app-pub-3940256099942544/1033173712
 *   iOS:     ca-app-pub-3940256099942544/4411468910
 */

import { hasPremiumEntitlement } from './purchases';

// Real AdMob App ID (from admob.google.com, account ronkhensley@gmail.com).
// App IDs are meant to be public (same idea as the Firebase config values in
// firebaseConfig.ts) — safe to commit, unlike a secret API key. Android only
// so far; add an iOS entry here once that app is created in AdMob too.
export const ADMOB_APP_IDS = {
  android: 'ca-app-pub-6551024191049113~2639682721',
  ios: 'ca-app-pub-6551024191049113~5753051363',
};

// Still needed before this can go live: an actual Ad Unit ID (different
// from the App ID above) for the specific interstitial placement — created
// under Ad units -> Add ad unit -> Interstitial in the AdMob console.
export const AD_UNIT_IDS = {
  android: 'ca-app-pub-6551024191049113/3253926245', // Save Screen Interstitial
  ios: 'ca-app-pub-6551024191049113/7001599560', // Save Screen Interstitial
};

// How many "save" actions between showing an interstitial. Showing one on
// literally every save (like the competitor app you tried) is both an
// obnoxious user experience and against Google Play / App Store policy on
// excessive full-screen ad frequency — most stores expect meaningful gaps.
const SAVES_BETWEEN_ADS = 4;

let saveCountSinceLastAd = 0;

/**
 * Call this after a "successful save" action (e.g. adding a subscription).
 * Returns true if an ad WOULD show at this point (once real ad code exists),
 * so calling code can decide whether to wait before navigating away, etc.
 * Currently a no-op stub: never actually shows anything, just tracks the
 * counter so the real implementation can drop in without changing callers.
 */
export async function maybeShowInterstitialAfterSave(): Promise<boolean> {
  const adsRemoved = await hasPremiumEntitlement(); // reuses the same entitlement check as RevenueCat premium
  if (adsRemoved) return false;

  saveCountSinceLastAd++;
  if (saveCountSinceLastAd < SAVES_BETWEEN_ADS) return false;

  saveCountSinceLastAd = 0;
  // TODO once react-native-google-mobile-ads is installed:
  // const interstitial = InterstitialAd.createForAdRequest(adUnitId);
  // await interstitial.load();
  // await interstitial.show();
  return true; // signals "an ad would have shown here"
}