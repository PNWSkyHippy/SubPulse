import { Alert } from 'react-native';

/** Turns Firebase/network errors into a message a user can act on. */
export function friendlyError(e: any): string {
  const code: string = e?.code ?? '';
  if (code === 'permission-denied' || /insufficient permissions/i.test(e?.message ?? '')) {
    return "The server rejected this save (Firestore permissions). The SubPulse security rules haven't been deployed to your Firebase project yet — see README → \"Firestore rules\".";
  }
  if (code === 'unavailable') return 'You appear to be offline. Try again when you have a connection.';
  return e?.message ?? 'Something went wrong. Please try again.';
}

/** Runs an async action and shows an alert instead of failing silently. Returns true on success. */
export async function attempt(title: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    Alert.alert(title, friendlyError(e));
    return false;
  }
}
