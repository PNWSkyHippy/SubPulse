import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SUPPORTED_CURRENCIES } from '../utils/currency';

export default function CurrencyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (currency: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, value === c && styles.chipActive]}
            onPress={() => onChange(c)}
          >
            <Text style={[styles.chipText, value === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1E293B' },
  chipActive: { backgroundColor: '#6366F1' },
  chipText: { color: '#94A3B8', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
