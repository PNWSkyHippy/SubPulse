import React from 'react';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { Chip, ChipRow } from '../ui/kit';

export default function CurrencyPicker({ value, onChange }: { value: string; onChange: (currency: string) => void }) {
  return (
    <ChipRow>
      {SUPPORTED_CURRENCIES.map((c) => (
        <Chip key={c} label={c} active={value === c} onPress={() => onChange(c)} />
      ))}
    </ChipRow>
  );
}
