import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/PreferencesContext';
import { LOCK_AFTER_OPTIONS, LockMode, promptBiometric, useSecurity } from '../context/SecurityContext';
import { useCodePrompt } from '../components/CodePrompt';
import { Badge, Body, Button, Card, Chip, ChipRow, Heading, Icon, Input, Label, Row, Screen, SectionHeader, Segmented, ToggleRow } from '../ui/kit';
import { disableTotp, finishTotpEnrollment, friendlyMfaError, hasTotp, PendingEnrollment, reauthenticate, startTotpEnrollment } from '../utils/mfa';

export default function SecurityScreen({ navigation }: any) {
  const t = useTheme();
  const { user } = useAuth();
  const { settings, update, biometricAvailable, biometricInBuild, biometricLabel, lockNow } = useSecurity();
  const [codePrompt, askCode] = useCodePrompt();
  const [twoStep, setTwoStep] = useState(hasTotp(user));
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [password, setPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [, setVerifiedTick] = useState(0); // re-render after user.reload()

  const setMode = async (mode: LockMode) => {
    if (mode === 'biometric') {
      if (!biometricInBuild) return Alert.alert('Needs an app update', 'This installed build of SubPulse was made before fingerprint unlock was added. Rebuild the app (eas build) to turn it on — your phone setup is fine. The password lock works now.');
      if (!biometricAvailable) return Alert.alert('Not available', 'Set up a fingerprint or face unlock in your phone settings first, or use the password tier.');
      if (!(await promptBiometric('Confirm to turn on biometric lock'))) return;
    }
    await update({ mode });
  };

  // Changing 2-step needs a fresh password check (Firebase "recent login").
  const withPassword = async (fn: () => Promise<void>) => {
    if (!password) return Alert.alert('Password needed', 'Enter your account password above first.');
    setBusy(true);
    try {
      await reauthenticate(password, () => askCode());
      await fn();
    } catch (e: any) {
      if (e?.code !== 'cancelled') Alert.alert('Two-step verification', friendlyMfaError(e));
    } finally {
      setBusy(false);
    }
  };

  const beginEnroll = () =>
    withPassword(async () => {
      setPending(await startTotpEnrollment());
    });

  const confirmEnroll = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await finishTotpEnrollment(pending, verifyCode);
      setPending(null);
      setVerifyCode('');
      setPassword('');
      setTwoStep(true);
      Alert.alert('Two-step is on', 'From now on, signing in needs your password and a code from your authenticator app.');
    } catch (e: any) {
      Alert.alert('Could not verify', friendlyMfaError(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () =>
    Alert.alert('Turn off two-step?', 'Your account will be protected by the password only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn off',
        style: 'destructive',
        onPress: () =>
          withPassword(async () => {
            await disableTotp();
            setTwoStep(false);
            setPassword('');
          }),
      },
    ]);

  return (
    <Screen>
      {codePrompt}
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Security & lock</Heading>
      </Row>

      <Card>
        <SectionHeader title="App lock" icon="shield-key-outline" right={<Badge text={settings.mode === 'off' ? 'Off' : 'On'} tone={settings.mode === 'off' ? 'warn' : 'ok'} />} />
        <Body small muted style={{ marginVertical: 6 }}>Locks SubPulse when it opens and after you've been away, so someone holding your unlocked phone can't see your bills.</Body>
        <Segmented<LockMode>
          value={settings.mode}
          onChange={setMode}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'biometric', label: biometricLabel },
            { value: 'password', label: 'Password' },
          ]}
        />
        <Body small muted style={{ marginTop: 6 }}>
          {settings.mode === 'biometric'
            ? `${biometricLabel}, with your phone PIN or your SubPulse password as backup.`
            : settings.mode === 'password'
              ? 'Your SubPulse account password (and authenticator code if two-step is on). Strongest option.'
              : 'Anyone with your unlocked phone can open SubPulse.'}
        </Body>
        {!biometricInBuild ? (
          <Body small style={{ color: t.colors.warning, marginTop: 4 }}>Fingerprint unlock needs a newer build of the app (rebuild with eas build). Password lock works now.</Body>
        ) : !biometricAvailable ? (
          <Body small style={{ color: t.colors.warning, marginTop: 4 }}>No fingerprint/face set up on this phone — biometric tier unavailable.</Body>
        ) : null}

        {settings.mode !== 'off' ? (
          <>
            <Label style={{ marginTop: 12, marginBottom: 6 }}>Lock after leaving the app</Label>
            <ChipRow>
              {LOCK_AFTER_OPTIONS.map((o) => (
                <Chip key={o.sec} label={o.label} active={settings.lockAfterSec === o.sec} onPress={() => update({ lockAfterSec: o.sec })} />
              ))}
            </ChipRow>
            <Label style={{ marginTop: 12, marginBottom: 6 }}>Wrong passwords before sign-out</Label>
            <ChipRow>
              {[3, 5, 10].map((n) => (
                <Chip key={n} label={`${n} attempts`} active={settings.maxPasswordAttempts === n} onPress={() => update({ maxPasswordAttempts: n })} />
              ))}
            </ChipRow>
            <ToggleRow
              title="Privacy screen"
              subtitle="Hide SubPulse in Recents and block screenshots"
              value={settings.privacyScreen}
              onChange={(v) => update({ privacyScreen: v })}
            />
            <Button compact kind="secondary" icon="lock-outline" title="Lock now" onPress={lockNow} />
          </>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Two-step verification" icon="cellphone-key" right={<Badge text={twoStep ? 'On' : 'Off'} tone={twoStep ? 'ok' : 'warn'} />} />
        <Body small muted style={{ marginVertical: 6 }}>
          Signing in on any device will need your password plus a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…). Enforced by Firebase's servers.
        </Body>

        {!twoStep && user && !user.emailVerified ? (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Body small style={{ color: t.colors.warning }}>Firebase requires a verified email before two-step can be turned on.</Body>
            <Row>
              <Button style={{ flex: 1 }} compact kind="secondary" icon="email-outline" title="Send verification email" onPress={() => sendEmailVerification(user).then(() => Alert.alert('Email sent', `Open the link sent to ${user.email}, then come back and tap "I've verified".`)).catch((e) => Alert.alert('Could not send', friendlyMfaError(e)))} />
              <Button compact kind="ghost" title="I've verified" onPress={() => user.reload().then(() => setVerifiedTick((n) => n + 1))} />
            </Row>
          </View>
        ) : null}
        {!pending ? (
          <>
            <Label>Account password</Label>
            <Input secureTextEntry value={password} onChangeText={setPassword} placeholder="Required to change two-step" style={{ marginTop: 6 }} />
            {twoStep ? (
              <Button style={{ marginTop: 10 }} kind="danger" title="Turn off two-step" loading={busy} onPress={turnOff} />
            ) : (
              <Button style={{ marginTop: 10 }} icon="shield-key-outline" title="Set up authenticator app" loading={busy} onPress={beginEnroll} />
            )}
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <Body>1. Add SubPulse to your authenticator app:</Body>
            <Button compact icon="open-in-new" title="Open authenticator app" onPress={() => Linking.openURL(pending.otpauthUrl).catch(() => Alert.alert('No authenticator app found', 'Install Google Authenticator (or similar), or copy the setup key below and enter it manually.'))} />
            <Label>Or enter this setup key manually</Label>
            <Pressable onPress={() => Clipboard.setStringAsync(pending.secretKey)}>
              <Row style={{ justifyContent: 'space-between', backgroundColor: t.colors.canvas, padding: 10, borderRadius: t.radius.control }}>
                <Body style={{ fontFamily: t.fonts.bodySemi, letterSpacing: 1, flex: 1 }}>{pending.secretKey.replace(/(.{4})/g, '$1 ').trim()}</Body>
                <Icon name="content-copy" size={16} />
              </Row>
            </Pressable>
            <Body>2. Enter the 6-digit code it shows:</Body>
            <Input mono value={verifyCode} onChangeText={(v) => setVerifyCode(v.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" style={{ fontSize: 20, letterSpacing: 4, textAlign: 'center' }} />
            <Row>
              <Button style={{ flex: 1 }} title="Verify & turn on" disabled={verifyCode.length !== 6} loading={busy} onPress={confirmEnroll} />
              <Button kind="secondary" title="Cancel" onPress={() => setPending(null)} />
            </Row>
          </View>
        )}
      </Card>
      <Body small muted>If you lose your phone: sign in on another device and change your password (Settings → sign-out → "Forgot password?"), which signs out other sessions at their next check. With two-step on, a thief also needs your authenticator.</Body>
    </Screen>
  );
}
