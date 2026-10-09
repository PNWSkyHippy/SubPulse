/**
 * Optional native modules for the app lock. They need a build that includes
 * them (`eas build`). Loading them lazily means an older development build
 * still runs: biometrics report "unavailable" and the password tier works.
 */
type LA = typeof import('expo-local-authentication');
type SC = typeof import('expo-screen-capture');

function load<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

let la: LA | null | undefined;
let sc: SC | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const localAuth = (): LA | null => (la === undefined ? (la = load(() => require('expo-local-authentication') as LA)) : la);
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const screenCapture = (): SC | null => (sc === undefined ? (sc = load(() => require('expo-screen-capture') as SC)) : sc);
