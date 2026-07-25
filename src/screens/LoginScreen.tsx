import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
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
      Alert.alert('Sign in failed', err.message ?? 'Please check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Enter your email first', 'Type your email above, then tap "Forgot password?" again.');
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(trimmedEmail);
      Alert.alert('Check your email', `A password reset link has been sent to ${trimmedEmail}.`);
    } catch (err: any) {
      Alert.alert('Could not send reset email', err.message ?? 'Please try again.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable onPress={onForgotPassword} disabled={sendingReset}>
        <Text style={styles.forgotLink}>{sendingReset ? 'Sending…' : 'Forgot password?'}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign In'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.link}>No account? Create one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0F172A' },
  title: { fontSize: 28, fontWeight: '700', color: '#F8FAFC', marginBottom: 24 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  forgotLink: { color: '#6366F1', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  button: { backgroundColor: '#6366F1', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#94A3B8', textAlign: 'center', marginTop: 16 },
});
