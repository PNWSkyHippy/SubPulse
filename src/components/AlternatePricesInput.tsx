import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { BillingCycle } from '../types';

const ALL_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly price',
  monthly: 'Monthly price',
  quarterly: 'Quarterly price',
  yearly: 'Yearly price',
};

export default function AlternatePricesInput({
  currentCycle,
  value,
  onChange,
}: {
  currentCycle: BillingCycle;
  value: Partial<Record<BillingCycle, number>>;
  onChange: (value: Partial<Record<BillingCycle, number>>) => void;
}) {
  const otherCycles = ALL_CYCLES.filter((c) => c !== currentCycle);

  const setFieldText = (cycle: BillingCycle, text: string) => {
    const trimmed = text.trim();
    const next = { ...value };
    if (trimmed === '') {
      delete next[cycle];
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num >= 0) {
        next[cycle] = num;
      }
    }
    onChange(next);
  };

  return (
    <View>
      <Text style={styles.helpText}>
        Know what this costs on a different billing cycle? Enter it below so Insights can show an exact savings
        comparison instead of a general nudge.
      </Text>
      {otherCycles.map((cycle) => (
        <View key={cycle} style={styles.row}>
          <Text style={styles.rowLabel}>{CYCLE_LABELS[cycle]}</Text>
          <TextInput
            style={styles.rowInput}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor="#475569"
            defaultValue={value[cycle] !== undefined ? String(value[cycle]) : ''}
            onChangeText={(text) => setFieldText(cycle, text)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  helpText: { color: '#64748B', fontSize: 12, marginBottom: 10, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { color: '#94A3B8', fontSize: 13, textTransform: 'capitalize' },
  rowInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    width: 100,
    textAlign: 'right',
  },
});
