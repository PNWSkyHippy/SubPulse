import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAuth, screenCapture } from '../utils/nativeSecurity';
import { useAuth } from './AuthContext';

/**
 * App lock. Tiers:
 *   off        — no lock (anyone holding the unlocked phone can open SubPulse)
 *   biometric  — fingerprint / face, with the phone's PIN/pattern as fallback
 *   password   — the SubPulse account password (+ authenticator code if 2-step is on)
 *
 * The lock engages on every cold start and after the app has been in the
 * background for `lockAfterSec`. Too many wrong passwords signs the user out
 * entirely. "Privacy screen" sets Android FLAG_SECURE (hidden in Recents,
 * screenshots blocked) and covers the UI while the app is in the switcher.
 *
 * Settings are per device (AsyncStorage): losing this phone doesn't change
 * how another device is protected, and the lock still works offline.
 */

export type LockMode = 'off' | 'biometric' | 'password';

export interface SecuritySettings {
  mode: LockMode;
  lockAfterSec: number; // 0 = immediately on leaving the app
  privacyScreen: boolean;
  maxPasswordAttempts: number; // then sign out completely
}

export const DEFAULT_SECURITY: SecuritySettings = { mode: 'off', lockAfterSec: 60, privacyScreen: true, maxPasswordAttempts: 5 };
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
  biometricLabel: string;
  failedPasswordAttempts: number;
  registerFailedPassword: () => Promise<void>;
  ready: boolean;
}

const Ctx = createContext<SecurityValue | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false);
  const [biometricAvailable, setBioAvail] = useState(false);
  const [biometricLabel, setBioLabel] = useState('Biometrics');
  const [failedPasswordAttempts, setFailed] = useState(0);
  const backgroundedAt = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load settings; lock on cold start if a lock tier is set.
  useEffect(() => {
    (async () => {
      let s = DEFAULT_SECURITY;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) s = { ...DEFAULT_SECURITY, ...JSON.parse(raw) };
      } catch {
        /* defaults */
      }
      setSettings(s);
      setLocked(s.mode !== 'off');
      try {
        const LocalAuthentication = localAuth();
        if (!LocalAuthentication) throw new Error('local auth not in this build');
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

  // Lock after time in background.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      const s = settingsRef.current;
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        if (s.mode !== 'off' && s.privacyScreen) setObscured(true);
        if (s.mode !== 'off' && s.lockAfterSec === 0 && state === 'background') setLocked(true);
      } else if (state === 'active') {
        setObscured(false);
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (s.mode !== 'off' && since !== null && Date.now() - since >= s.lockAfterSec * 1000) setLocked(true);
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
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const unlock = useCallback(() => {
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
