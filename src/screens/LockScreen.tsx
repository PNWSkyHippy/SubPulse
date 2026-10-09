import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/PreferencesContext';
import { promptBiometric, useSecurity } from '../context/SecurityContext';
import { useCodePrompt } from '../components/CodePrompt';
import { Body, Button, Card, Heading, Icon, Input, Label } from '../ui/kit';
import { friendlyMfaError, reauthenticate } from '../utils/mfa';

/** Full-screen lock shown over the app (see SecurityContext for tiers). */
export default function LockScreen() {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const { settings, unlock, biometricAvailable, biometricLabel, failedPasswordAttempts, registerFailedPassword } = useSecurity();
  const [codePrompt, askCode] = useCodePrompt();
  const useBio = settings.mode === 'biometric' && biometricAvailable;
  const [showPassword, setShowPassword] = useState(!useBio);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tryBiometric = useCallback(async () => {
    if (await promptBiometric()) unlock();
    else setShowPassword(true);
  }, [unlock]);

  useEffect(() => {
    if (useBio) tryBiometric();
  }, [useBio, tryBiometric]);

  const submitPassword = async () => {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await reauthenticate(password, () => askCode());
      setPassword('');
      unlock();
    } catch (e: any) {
      if (e?.code !== 'cancelled') {
        setError(friendlyMfaError(e));
        if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-verification-code'].includes(e?.code)) await registerFailedPassword();
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
      </View>

      {useBio ? <Button icon="fingerprint" title={`Unlock with ${biometricLabel}`} onPress={tryBiometric} /> : null}

      {showPassword ? (
        <Card style={{ gap: 10, marginTop: 12 }}>
          <Label>Account password</Label>
          <Input secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" onSubmitEditing={submitPassword} autoFocus={!useBio} />
          {error ? <Body small style={{ color: t.colors.danger }}>{error}</Body> : null}
          {failedPasswordAttempts > 0 ? <Body small muted>{left} attempt{left === 1 ? '' : 's'} left before you are signed out.</Body> : null}
          <Button title="Unlock" loading={busy} onPress={submitPassword} />
        </Card>
      ) : (
        <Pressable onPress={() => setShowPassword(true)}>
          <Body muted style={{ textAlign: 'center', marginTop: 16 }}>Use account password instead</Body>
        </Pressable>
      )}

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
