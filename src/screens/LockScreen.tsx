/**
 * SubPulse lock screen — complete replacement file.
 *
 * Drop-in destination in the SubPulse project: src/screens/LockScreen.tsx
 * (replaces the existing file of the same name).
 *
 * Full-screen lock shown over the app (see SecurityContext for tiers).
 * The older tiers work exactly as before:
 *   biometric — fingerprint / face button, with the account password as backup
 *   password  — account password (+ authenticator code if two-step is on)
 *
 * The new relogin tier (idle-only) unlocks in two steps, in order:
 *   Step 1 — the SubPulse account password (with the authenticator code
 *            prompt if two-step verification is on for the account).
 *   Step 2 — fingerprint, or the app PIN. When fingerprint is chosen but
 *            is unavailable on this phone, the app PIN is used instead.
 *            When no second step is available at all (no fingerprint and
 *            no PIN set), the screen stays locked and explains how to
 *            recover: sign out, sign back in, and set a PIN in Security.
 *            It never unlocks on the password alone.
 *
 * Wrong account passwords and wrong app PINs both count toward the
 * "wrong attempts before sign-out" limit. Cancelled fingerprint prompts
 * do not count — the user can retry or switch to the PIN.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/PreferencesContext';
import { promptBiometric, useSecurity } from '../context/SecurityContext';
import { useCodePrompt } from '../components/CodePrompt';
import { Body, Button, Card, Heading, Icon, Input, Label } from '../ui/kit';
import { friendlyMfaError, reauthenticate } from '../utils/mfa';
import { hasPin, verifyPin } from '../utils/appPin';

type ReloginStep = 'password' | 'second';
type SecondMethod = 'fingerprint' | 'pin' | 'blocked' | 'loading';

export default function LockScreen() {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const { settings, unlock, biometricAvailable, biometricLabel, failedPasswordAttempts, registerFailedPassword } = useSecurity();
  const [codePrompt, askCode] = useCodePrompt();

  const isRelogin = settings.mode === 'relogin';
  const useBio = !isRelogin && settings.mode === 'biometric' && biometricAvailable;

  // Older tiers.
  const [showPassword, setShowPassword] = useState(!useBio);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Relogin tier.
  const [step, setStep] = useState<ReloginStep>('password');
  const [pin, setPin] = useState('');
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pinFallback, setPinFallback] = useState(false);
  const [pinError, setPinError] = useState('');
  const autoBioDone = useRef(false);

  useEffect(() => {
    let alive = true;
    hasPin().then((v) => {
      if (alive) setPinSet(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (step === 'password') autoBioDone.current = false;
  }, [step]);

  const secondMethod: SecondMethod = !isRelogin
    ? 'loading'
    : settings.secondStep === 'pin'
      ? pinSet === null
        ? 'loading'
        : pinSet
          ? 'pin'
          : 'blocked'
      : biometricAvailable
        ? 'fingerprint'
        : pinSet === true
          ? 'pin'
          : pinSet === false
            ? 'blocked'
            : 'loading';

  const effectiveSecond: SecondMethod =
    secondMethod === 'fingerprint' && pinFallback ? 'pin' : secondMethod;

  const tryBiometric = useCallback(async () => {
    if (await promptBiometric()) unlock();
    else setShowPassword(true);
  }, [unlock]);

  useEffect(() => {
    if (useBio) tryBiometric();
  }, [useBio, tryBiometric]);

  const tryReloginBiometric = useCallback(async () => {
    if (await promptBiometric()) {
      unlock();
    } else if (pinSet) {
      setPinFallback(true);
    }
  }, [unlock, pinSet]);

  useEffect(() => {
    if (isRelogin && step === 'second' && effectiveSecond === 'fingerprint' && !autoBioDone.current) {
      autoBioDone.current = true;
      tryReloginBiometric();
    }
  }, [isRelogin, step, effectiveSecond, tryReloginBiometric]);

  const submitPassword = async () => {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await reauthenticate(password, () => askCode());
      setPassword('');
      if (isRelogin) {
        setStep('second');
      } else {
        unlock();
      }
    } catch (e: any) {
      if (e?.code !== 'cancelled') {
        setError(friendlyMfaError(e));
        if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-verification-code'].includes(e?.code)) await registerFailedPassword();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async () => {
    if (!pin) return;
    setBusy(true);
    setPinError('');
    try {
      if (await verifyPin(pin)) {
        setPin('');
        unlock();
      } else {
        setPinError('Wrong PIN.');
        await registerFailedPassword();
      }
    } finally {
      setBusy(false);
    }
  };

  const left = settings.maxPasswordAttempts - failedPasswordAttempts;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.canvas, justifyContent: 'center', padding: 24 }}>
      {codePrompt}
      <View style={{ alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.colors.accentSoft, borderWidth: 1, borderColor: t.colors.accentBorder, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-key-outline" size={34} color={t.colors.accent} />
        </View>
        <Heading size="lg">SubPulse is locked</Heading>
        <Label>{user?.email ?? ''}</Label>
        {isRelogin ? <Body small muted>Step {step === 'password' ? '1' : '2'} of 2</Body> : null}
      </View>

      {/* Older tiers — unchanged behavior. */}
      {!isRelogin && useBio ? <Button icon="fingerprint" title={`Unlock with ${biometricLabel}`} onPress={tryBiometric} /> : null}

      {!isRelogin && showPassword ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Label>Account password</Label>
          <Input secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" onSubmitEditing={submitPassword} autoFocus={!useBio} />
          {error ? <Body small style={{ color: t.colors.danger }}>{error}</Body> : null}
          {failedPasswordAttempts > 0 ? <Body small muted>{left} attempt{left === 1 ? '' : 's'} left before you are signed out.</Body> : null}
          <Button title="Unlock" loading={busy} onPress={submitPassword} />
        </Card>
      ) : null}

      {!isRelogin && !showPassword ? (
        <Pressable onPress={() => setShowPassword(true)}>
          <Body muted style={{ textAlign: 'center', marginTop: 16 }}>Use account password instead</Body>
        </Pressable>
      ) : null}

      {/* Relogin tier, step 1 — account password. */}
      {isRelogin && step === 'password' ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Label>Account password</Label>
          <Input secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" onSubmitEditing={submitPassword} autoFocus />
          {error ? <Body small style={{ color: t.colors.danger }}>{error}</Body> : null}
          {failedPasswordAttempts > 0 ? <Body small muted>{left} attempt{left === 1 ? '' : 's'} left before you are signed out.</Body> : null}
          <Button title="Continue" loading={busy} onPress={submitPassword} />
        </Card>
      ) : null}

      {/* Relogin tier, step 2 — fingerprint. */}
      {isRelogin && step === 'second' && effectiveSecond === 'fingerprint' ? (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Button icon="fingerprint" title={`Unlock with ${biometricLabel}`} onPress={tryReloginBiometric} />
          {pinSet ? (
            <Pressable onPress={() => setPinFallback(true)}>
              <Body muted style={{ textAlign: 'center' }}>Use app PIN instead</Body>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Relogin tier, step 2 — app PIN. */}
      {isRelogin && step === 'second' && effectiveSecond === 'pin' ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Label>App PIN</Label>
          <Input
            secureTextEntry
            keyboardType="number-pad"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 8))}
            placeholder="••••"
            onSubmitEditing={submitPin}
            autoFocus
          />
          {pinError ? <Body small style={{ color: t.colors.danger }}>{pinError}</Body> : null}
          {failedPasswordAttempts > 0 ? <Body small muted>{left} attempt{left === 1 ? '' : 's'} left before you are signed out.</Body> : null}
          <Button title="Unlock" loading={busy} onPress={submitPin} />
          {settings.secondStep === 'fingerprint' && biometricAvailable ? (
            <Pressable onPress={() => setPinFallback(false)}>
              <Body muted style={{ textAlign: 'center' }}>Use {biometricLabel} instead</Body>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* Relogin tier, step 2 — no second step available. Stays locked. */}
      {isRelogin && step === 'second' && effectiveSecond === 'blocked' ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Body>No second step is available on this phone right now: fingerprint is unavailable and no app PIN is set. This lock will not open on the password alone.</Body>
          <Body small muted>Sign out below, sign back in, and set an app PIN in Security to use this lock again.</Body>
        </Card>
      ) : null}

      {isRelogin && step === 'second' && effectiveSecond === 'loading' ? (
        <Body muted style={{ textAlign: 'center', marginTop: 12 }}>Checking second step…</Body>
      ) : null}

      <Pressable onPress={signOut}>
        <Body small muted style={{ textAlign: 'center', marginTop: 24 }}>Sign out</Body>
      </Pressable>
    </SafeAreaView>
  );
}

/** Plain cover shown in the app switcher when the privacy screen is on. */
export function PrivacyCover() {
  const t = useTheme();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="shield-key-outline" size={48} color={t.colors.accent} />
    </View>
  );
}
