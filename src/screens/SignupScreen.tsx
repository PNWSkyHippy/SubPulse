import React, { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Card, Field, Heading, Input, Screen } from '../ui/kit';
import { friendlyError } from '../utils/errors';

export default function SignupScreen({ navigation }: any) {
  const t = useTheme();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign up failed', friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card style={{ gap: 12, marginTop: 64 }}>
        <Heading size="lg">Create your account</Heading>
        <Body muted small>Your bills sync across devices and stay private to your account.</Body>
        <Field label="Email"><Input autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /></Field>
        <Field label="Password (min 6 characters)"><Input secureTextEntry value={password} onChangeText={setPassword} /></Field>
        <Button title="Create account" loading={submitting} onPress={onSubmit} />
      </Card>
      <Pressable onPress={() => navigation.goBack()}>
        <Body muted style={{ textAlign: 'center', marginTop: 12 }}>
          Already have an account? <Body style={{ color: t.colors.accent }}>Sign in</Body>
        </Body>
      </Pressable>
    </Screen>
  );
}
