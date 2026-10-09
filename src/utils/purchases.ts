import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

// Fill these in from your RevenueCat dashboard (app.revenuecat.com ->
// Project settings -> API keys) once you've created a RevenueCat project
// and linked it to your App Store Connect / Google Play Console apps.
// RevenueCat requires products to already exist in those stores first —
// create the store accounts and products before this becomes functional.
const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? 'REPLACE_ME',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? 'REPLACE_ME',
};

// The entitlement identifier configured in the RevenueCat dashboard that
// represents "paid access" to this app. Adjust to match what you name it.
export const PREMIUM_ENTITLEMENT_ID = 'premium';

let configured = false;

/**
 * Initializes the RevenueCat SDK. Call this once, early in app startup
 * (e.g. in App.tsx), after a user is signed in if you want purchases tied
 * to your own user IDs.
 *
 * Safe to call in Expo Go — react-native-purchases mocks native calls
 * there, so the app won't crash, but real purchases only work in a
 * development build or production build (npx expo run / eas build).
 */
export function configurePurchases(appUserId?: string): void {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
  if (apiKey === 'REPLACE_ME') {
    console.warn('RevenueCat API key not set — skipping configuration. See src/utils/purchases.ts.');
    return;
  }
  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
}

/** Fetches the current default offering (the set of packages/prices to show on a paywall). */
export function purchasesConfigured(): boolean {
  return configured;
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

/** Purchases a specific package (e.g. the monthly or annual plan from an offering). */
export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0]): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/** Restores previous purchases — always expose this in your UI (App Store review requires it). */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** Whether the current user has active premium access. */
export async function hasPremiumEntitlement(): Promise<boolean> {
  if (!configured) return false; // no RevenueCat keys yet -> everyone is on the free tier
  const customerInfo = await Purchases.getCustomerInfo();
  return typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
}
