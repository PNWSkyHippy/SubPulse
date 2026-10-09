import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Card, Field, Heading, Icon, Input, Label, Screen } from '../ui/kit';
import { friendlyError } from '../utils/errors';

export default function LoginScreen({ navigation }: any) {
  const t = useTheme();
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign in failed', friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return Alert.alert('Enter your email first', 'Type your email above, then tap "Forgot password?" again.');
    setSendingReset(true);
    try {
      await resetPassword(trimmedEmail);
      Alert.alert('Check your email', `A password reset link has been sent to ${trimmedEmail}.`);
    } catch (err: any) {
      Alert.alert('Could not send reset email', friendlyError(err));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <Screen>
      <View style={{ marginTop: 48, alignItems: 'center', gap: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pulse" size={32} color={t.colors.onAccent} />
        </View>
        <Heading size="xl">SubPulse</Heading>
        <Label>Recurring capital, under control</Label>
      </View>
      <Card style={{ gap: 12, marginTop: 24 }}>
        <Heading size="md">Welcome back</Heading>
        <Field label="Email"><Input autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" /></Field>
        <Field label="Password"><Input secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" /></Field>
        <Pressable onPress={onForgotPassword} disabled={sendingReset}>
          <Body small style={{ color: t.colors.accent, textAlign: 'right' }}>{sendingReset ? 'Sending…' : 'Forgot password?'}</Body>
        </Pressable>
        <Button title="Sign in" loading={submitting} onPress={onSubmit} />
      </Card>
      <Pressable onPress={() => navigation.navigate('Signup')}>
        <Body muted style={{ textAlign: 'center', marginTop: 12 }}>
          No account? <Body style={{ color: t.colors.accent }}>Create one</Body>
        </Body>
      </Pressable>
    </Screen>
  );
}
