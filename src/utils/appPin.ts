/**
 * SubPulse app PIN — the PIN second step for the re-login lock tier.
 *
 * Drop-in destination in the SubPulse project: src/utils/appPin.ts
 * (new file; no existing file is replaced by this one).
 *
 * The PIN is never stored as plain text. A random salt is generated for
 * the PIN and only the salt plus the SHA-256 hash of (salt + PIN) are
 * kept in the app's private storage. Verifying a PIN re-hashes the
 * entered digits with the stored salt and compares the two hashes.
 *
 * Honest scope: this is an app lock, not a bank vault. The hash lives
 * in the app's private storage, not in hardware-backed secure storage,
 * so it stops someone holding the unlocked phone from opening SubPulse
 * — it is not a defence against forensic extraction from the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'pref:appPin.v1';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

interface StoredPin {
  salt: string;
  hash: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigest.SHA256, `${salt}:${pin}`, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/**
 * Returns an error message when the PIN is not usable, or null when it is.
 * A usable PIN is 4 to 8 digits, nothing else.
 */
export function validatePin(pin: string): string | null {
  if (!/^[0-9]+$/.test(pin)) return 'A PIN is digits only.';
  if (pin.length < PIN_MIN_LENGTH) return `A PIN needs at least ${PIN_MIN_LENGTH} digits.`;
  if (pin.length > PIN_MAX_LENGTH) return `A PIN can have at most ${PIN_MAX_LENGTH} digits.`;
  return null;
}

async function readStored(): Promise<StoredPin | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPin>;
    if (typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') return null;
    return { salt: parsed.salt, hash: parsed.hash };
  } catch {
    return null;
  }
}

/** True when an app PIN has been set on this phone. */
export async function hasPin(): Promise<boolean> {
  return (await readStored()) !== null;
}

/**
 * Sets (or replaces) the app PIN. Throws when the PIN is not usable;
 * the previously stored PIN is left untouched in that case.
 */
export async function setPin(pin: string): Promise<void> {
  const error = validatePin(pin);
  if (error) throw new Error(error);
  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const hash = await hashPin(pin, salt);
  await AsyncStorage.setItem(KEY, JSON.stringify({ salt, hash }));
}

/** True only when the entered digits match the stored PIN. Never throws. */
export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = await readStored();
    if (!stored) return false;
    const hash = await hashPin(pin, stored.salt);
    return hash === stored.hash;
  } catch {
    return false;
  }
}

/** Removes the app PIN from this phone. */
export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
