/**
 * SubPulse app lock — complete replacement file.
 *
 * Drop-in destination in the SubPulse project: src/context/SecurityContext.tsx
 * (replaces the existing file of the same name; no other file needs to
 * change for the lock itself to work).
 *
 * App lock. Tiers:
 *   off        — no lock (anyone holding the unlocked phone can open SubPulse)
 *   biometric  — fingerprint / face, with the phone's PIN/pattern as fallback
 *   password   — the SubPulse account password (+ authenticator code if 2-step is on)
 *   relogin    — NEW. Idle-only re-login + second step. This tier never
 *                locks when the app opens. It locks only after the app has
 *                been idle in the background for `idleMinutes` (1 to 30,
 *                default 5, changeable at any time). Unlocking then needs
 *                two steps: the SubPulse account password, then a second
 *                step — fingerprint, or the app PIN. An app PIN must be
 *                set before this tier can be turned on, so a fingerprint
 *                fallback always exists even when fingerprint is chosen.
 *
 * The older tiers behave exactly as before: they lock on every cold
 * start and after the app has been in the background for `lockAfterSec`.
 * Too many wrong passwords (or wrong app PINs on the relogin tier) signs
 * the user out entirely. "Privacy screen" sets Android FLAG_SECURE
 * (hidden in Recents, screenshots blocked) and covers the UI while the
 * app is in the switcher.
 *
 * Settings are per device (AsyncStorage): losing this phone doesn't change
 * how another device is protected, and the lock still works offline.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAuth, screenCapture } from '../utils/nativeSecurity';
import { useAuth } from './AuthContext';

export type LockMode = 'off' | 'biometric' | 'password' | 'relogin';

/** Second step for the relogin tier: device fingerprint/face, or the app PIN. */
export type ReloginSecondStep = 'fingerprint' | 'pin';

export interface SecuritySettings {
  mode: LockMode;
  lockAfterSec: number; // 0 = immediately on leaving the app (older tiers only)
  privacyScreen: boolean;
  maxPasswordAttempts: number; // then sign out completely
  /** Idle minutes before the relogin tier locks. Always 1 to 30. */
  idleMinutes: number;
  /** Second step for the relogin tier. */
  secondStep: ReloginSecondStep;
}

export const RELOGIN_IDLE_MIN = 1;
export const RELOGIN_IDLE_MAX = 30;
export const RELOGIN_IDLE_DEFAULT = 5;

/** Clamps any value to a whole number of idle minutes in the 1 to 30 range. */
export function clampIdleMinutes(value: number): number {
  if (!Number.isFinite(value)) return RELOGIN_IDLE_DEFAULT;
  return Math.min(RELOGIN_IDLE_MAX, Math.max(RELOGIN_IDLE_MIN, Math.round(value)));
}

export const DEFAULT_SECURITY: SecuritySettings = {
  mode: 'off',
  lockAfterSec: 60,
  privacyScreen: true,
  maxPasswordAttempts: 5,
  idleMinutes: RELOGIN_IDLE_DEFAULT,
  secondStep: 'fingerprint',
};
export const LOCK_AFTER_OPTIONS = [
  { sec: 0, label: 'Immediately' },
  { sec: 60, label: '1 minute' },
  { sec: 300, label: '5 minutes' },
  { sec: 900, label: '15 minutes' },
];

const KEY = 'pref:security';

interface SecurityValue {
  settings: SecuritySettings;
  update: (patch: Partial<SecuritySettings>) => Promise<void>;
  locked: boolean;
  /** True while the app is in the switcher and the privacy screen is on. */
  obscured: boolean;
  unlock: () => void;
  lockNow: () => void;
  biometricAvailable: boolean;
  /** False when this app build doesn't include the biometric module (needs a rebuild). */
  biometricInBuild: boolean;
  biometricLabel: string;
  failedPasswordAttempts: number;
  registerFailedPassword: () => Promise<void>;
  ready: boolean;
}

const Ctx = createContext<SecurityValue | undefined>(undefined);

function sanitizeSettings(raw: Partial<SecuritySettings>): SecuritySettings {
  const merged = { ...DEFAULT_SECURITY, ...raw };
  return {
    ...merged,
    idleMinutes: clampIdleMinutes(merged.idleMinutes),
    secondStep: merged.secondStep === 'pin' ? 'pin' : 'fingerprint',
  };
}

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false);
  const [biometricAvailable, setBioAvail] = useState(false);
  const [biometricInBuild, setBioInBuild] = useState(false);
  const [biometricLabel, setBioLabel] = useState('Biometrics');
  const [failedPasswordAttempts, setFailed] = useState(0);
  const backgroundedAt = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load settings. Older tiers lock on cold start when set; the relogin
  // tier never locks on cold start — it is idle-only by design.
  useEffect(() => {
    (async () => {
      let s = DEFAULT_SECURITY;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) s = sanitizeSettings(JSON.parse(raw));
      } catch {
        /* defaults */
      }
      setSettings(s);
      setLocked(s.mode !== 'off' && s.mode !== 'relogin');
      try {
        const LocalAuthentication = localAuth();
        if (!LocalAuthentication) throw new Error('local auth not in this build');
        setBioInBuild(true);
        const [hw, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        setBioAvail(hw && enrolled);
        setBioLabel(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'Face unlock' : 'Fingerprint');
      } catch {
        setBioAvail(false); // native module missing (e.g. old build) -> password tier only
      }
      setReady(true);
    })();
  }, []);

  // Screenshot / Recents protection.
  useEffect(() => {
    if (!ready) return;
    const on = settings.privacyScreen && settings.mode !== 'off';
    const ScreenCapture = screenCapture();
    if (!ScreenCapture) return;
    (on ? ScreenCapture.preventScreenCaptureAsync('subpulse-lock') : ScreenCapture.allowScreenCaptureAsync('subpulse-lock')).catch(() => {});
  }, [settings.privacyScreen, settings.mode, ready]);

  // Lock after time in background. The relogin tier uses idleMinutes;
  // the older tiers use lockAfterSec (including "immediately" = 0).
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      const s = settingsRef.current;
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        if (s.mode !== 'off' && s.privacyScreen) setObscured(true);
        if (s.mode !== 'off' && s.mode !== 'relogin' && s.lockAfterSec === 0 && state === 'background') setLocked(true);
      } else if (state === 'active') {
        setObscured(false);
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (s.mode === 'off' || since === null) return;
        const thresholdMs = s.mode === 'relogin' ? s.idleMinutes * 60 * 1000 : s.lockAfterSec * 1000;
        if (Date.now() - since >= thresholdMs) setLocked(true);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // Signed-out users see the login screen instead of the lock.
  useEffect(() => {
    if (!user) {
      setLocked(false);
      setFailed(0);
    }
  }, [user]);

  const update = useCallback(async (patch: Partial<SecuritySettings>) => {
    const next = sanitizeSettings({ ...settingsRef.current, ...patch });
    setSettings(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Unlocking restarts the idle clock: the full timer must elapse again
  // before the next lock, so unlocking never leads straight back to the lock.
  const unlock = useCallback(() => {
    backgroundedAt.current = null;
    setLocked(false);
    setFailed(0);
  }, []);

  const lockNow = useCallback(() => {
    if (settingsRef.current.mode !== 'off') setLocked(true);
  }, []);

  const registerFailedPassword = useCallback(async () => {
    const n = failedPasswordAttempts + 1;
    setFailed(n);
    if (n >= settingsRef.current.maxPasswordAttempts) {
      setFailed(0);
      setLocked(false);
      await signOut();
    }
  }, [failedPasswordAttempts, signOut]);

  return (
    <Ctx.Provider
      value={{
        settings,
        update,
        locked: locked && !!user,
        obscured: obscured && !!user,
        unlock,
        lockNow,
        biometricAvailable,
        biometricInBuild,
        biometricLabel,
        failedPasswordAttempts,
        registerFailedPassword,
        ready,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSecurity(): SecurityValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSecurity must be used within SecurityProvider');
  return v;
}

/** Biometric prompt with the device PIN/pattern allowed as fallback. */
export async function promptBiometric(reason = 'Unlock SubPulse'): Promise<boolean> {
  try {
    const LocalAuthentication = localAuth();
    if (!LocalAuthentication) return false;
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Use password', disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
