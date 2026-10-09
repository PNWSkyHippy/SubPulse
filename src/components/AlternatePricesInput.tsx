import React from 'react';
import { View } from 'react-native';
import { BillingCycle } from '../types';
import { Body, Input, Row } from '../ui/kit';
import { CYCLE_LABELS } from '../utils/billing';

const ALT_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

/** Optional known prices on other billing cycles, so the optimizer can show exact savings. */
export default function AlternatePricesInput({
  currentCycle,
  value,
  onChange,
}: {
  currentCycle: BillingCycle;
  value: Partial<Record<BillingCycle, number>>;
  onChange: (value: Partial<Record<BillingCycle, number>>) => void;
}) {
  const otherCycles = ALT_CYCLES.filter((c) => c !== currentCycle);

  const setFieldText = (cycle: BillingCycle, text: string) => {
    const trimmed = text.trim();
    const next = { ...value };
    if (trimmed === '') {
      delete next[cycle];
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num >= 0) next[cycle] = num;
    }
    onChange(next);
  };

  return (
    <View style={{ gap: 8 }}>
      <Body small muted>
        Know what this costs on a different billing cycle? Enter it so the optimizer can show an exact savings comparison.
      </Body>
      {otherCycles.map((cycle) => (
        <Row key={cycle} style={{ justifyContent: 'space-between' }}>
          <Body muted>{CYCLE_LABELS[cycle]} price</Body>
          <Input
            mono
            style={{ width: 110, textAlign: 'right' }}
            keyboardType="decimal-pad"
            placeholder="optional"
            defaultValue={value[cycle] !== undefined ? String(value[cycle]) : ''}
            onChangeText={(text) => setFieldText(cycle, text)}
          />
        </Row>
      ))}
    </View>
  );
}
