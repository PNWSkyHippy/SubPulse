/**
 * Optional native modules for the app lock. They need a build that includes
 * them (`eas build`). Loading them lazily means an older development build
 * still runs: biometrics report "unavailable" and the password tier works.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type LA = typeof import('expo-local-authentication');
type SC = typeof import('expo-screen-capture');

function load<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** True only if this app binary contains the native module (an older dev build or Expo Go won't). */
function hasNative(name: string): boolean {
  if (Platform.OS === 'web') return true; // web shims exist
  try {
    return requireOptionalNativeModule(name) != null;
  } catch {
    return false;
  }
}

let la: LA | null | undefined;
let sc: SC | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const localAuth = (): LA | null =>
  la === undefined ? (la = hasNative('ExpoLocalAuthentication') ? load(() => require('expo-local-authentication') as LA) : null) : la;
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const screenCapture = (): SC | null =>
  sc === undefined ? (sc = hasNative('ExpoScreenCapture') ? load(() => require('expo-screen-capture') as SC) : null) : sc;
