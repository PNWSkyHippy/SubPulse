/**
 * Ads for the free tier (AdMob via react-native-google-mobile-ads).
 *
 * - Pinned to react-native-google-mobile-ads 17.0.0: 17.1+ requires
 *   react-native >= 0.86, newer than Expo SDK 54's 0.81. The 17.0.0 config
 *   plugin was verified to write the AdMob app id into AndroidManifest during
 *   `expo prebuild`.
 * - The native module only exists in a development/production build. In Expo
 *   Go the require() below fails, and every function here quietly no-ops, so
 *   the rest of the app keeps working.
 * - Google's TEST unit ids are used in development builds (__DEV__). Never
 *   show real ad units in a dev build — that can get the AdMob account flagged.
 * - Ad-free = the RevenueCat "premium" entitlement (one-time purchase or sub).
 */
import { Platform } from 'react-native';

// Real AdMob app ids (public identifiers, safe to commit) — also set in app.json's plugin config.
export const ADMOB_APP_IDS = {
  android: 'ca-app-pub-6551024191049113~2639682721',
  ios: 'ca-app-pub-6551024191049113~5753051363',
};

// Real interstitial unit ids ("Save Screen Interstitial").
export const AD_UNIT_IDS = {
  android: 'ca-app-pub-6551024191049113/3253926245',
  ios: 'ca-app-pub-6551024191049113/7001599560',
};

// Optional banner unit ids — create a Banner ad unit in AdMob and put the ids in .env.
const BANNER_UNIT_IDS = {
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? '',
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? '',
};

/** Full-screen ads after this many saves (store policies discourage ads on every action). */
const SAVES_BETWEEN_ADS = 4;
/** And never more often than this. */
const MIN_MS_BETWEEN_ADS = 3 * 60 * 1000;

let ads: any = null;
let adsLoaded = false;
function sdk(): any {
  if (adsLoaded) return ads;
  adsLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ads = require('react-native-google-mobile-ads');
  } catch {
    ads = null; // Expo Go / web: no native module
  }
  return ads;
}

let initialized = false;
export async function initAds(): Promise<void> {
  const m = sdk();
  if (!m || initialized) return;
  try {
    await m.default().initialize();
    initialized = true;
  } catch {
    /* native module missing at runtime */
  }
}

export function adsAvailable(): boolean {
  return !!sdk();
}

function interstitialUnit(): string {
  const m = sdk();
  if (__DEV__ && m?.TestIds) return m.TestIds.INTERSTITIAL;
  return Platform.OS === 'ios' ? AD_UNIT_IDS.ios : AD_UNIT_IDS.android;
}

export function bannerUnit(): string | null {
  const m = sdk();
  if (!m) return null;
  if (__DEV__ && m.TestIds) return m.TestIds.ADAPTIVE_BANNER ?? m.TestIds.BANNER;
  const id = Platform.OS === 'ios' ? BANNER_UNIT_IDS.ios : BANNER_UNIT_IDS.android;
  return id || null;
}

let saveCountSinceLastAd = 0;
let lastAdAt = 0;

/**
 * Call after a successful "save" (adding an item, recording a payment...).
 * Shows an interstitial every few saves for free-tier users. Never throws.
 */
export async function maybeShowInterstitialAfterSave(isPremium: boolean): Promise<boolean> {
  if (isPremium) return false;
  saveCountSinceLastAd++;
  if (saveCountSinceLastAd < SAVES_BETWEEN_ADS || Date.now() - lastAdAt < MIN_MS_BETWEEN_ADS) return false;
  const m = sdk();
  if (!m) return false;
  try {
    await initAds();
    const ad = m.InterstitialAd.createForAdRequest(interstitialUnit(), { requestNonPersonalizedAdsOnly: true });
    await new Promise<void>((resolve, reject) => {
      const offLoaded = ad.addAdEventListener(m.AdEventType.LOADED, () => {
        offLoaded();
        resolve();
      });
      const offError = ad.addAdEventListener(m.AdEventType.ERROR, (e: unknown) => {
        offError();
        reject(e);
      });
      ad.load();
      setTimeout(() => reject(new Error('ad load timeout')), 8000);
    });
    await ad.show();
    saveCountSinceLastAd = 0;
    lastAdAt = Date.now();
    return true;
  } catch {
    return false;
  }
}
