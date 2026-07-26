import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getInitials, getColorForName } from '../utils/subscriptionIcon';

export default function SubscriptionIcon({ name, size = 40 }: { name: string; size?: number }) {
  const color = getColorForName(name);
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
