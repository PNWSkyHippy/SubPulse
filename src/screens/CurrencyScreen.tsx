import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import CurrencyPicker from '../components/CurrencyPicker';
import { Badge, Body, Button, Card, Field, Heading, Icon, Input, Label, Metric, Row, Screen, SectionHeader } from '../ui/kit';
import { SUPPORTED_CURRENCIES, formatCurrency } from '../utils/currency';
import { convert, totalInBase } from '../utils/forex';
import { summarizeMonthlySpend } from '../utils/dateHelpers';

export default function CurrencyScreen({ navigation }: any) {
  const t = useTheme();
  const { subscriptions } = useSubscriptions();
  const { baseCurrency, setBaseCurrency, rates, refreshRates } = usePreferences();
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState(baseCurrency === 'USD' ? 'EUR' : 'USD');
  const [refreshing, setRefreshing] = useState(false);

  const summary = useMemo(() => summarizeMonthlySpend(subscriptions), [subscriptions]);
  const total = totalInBase(summary.byCurrency, baseCurrency, rates);
  const n = parseFloat(amount.replace(/,/g, ''));
  const converted = isNaN(n) ? null : convert(n, from, baseCurrency, rates);

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Multi-currency & forex</Heading>
      </Row>

      <Card tier={3}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Monthly burn in {baseCurrency}</Label>
          <Badge text={rates ? 'Live feed' : 'Offline'} tone={rates ? 'ok' : 'warn'} />
        </Row>
        <Metric size={30}>{formatCurrency(total.total, baseCurrency)}</Metric>
        {Object.entries(summary.byCurrency).map(([c, v]) => (
          <Row key={c} style={{ justifyContent: 'space-between' }}>
            <Body small muted>{c} items</Body>
            <Body small>{formatCurrency(v, c)}{c !== baseCurrency ? ` ≈ ${formatCurrency(convert(v, c, baseCurrency, rates) ?? 0, baseCurrency)}` : ''}</Body>
          </Row>
        ))}
        {rates ? <Label style={{ marginTop: 6 }}>Rates updated {rates.updatedAt.slice(0, 16).replace('T', ' ')} UTC · open.er-api.com</Label> : null}
      </Card>

      <Field label="Base (display) currency">
        <CurrencyPicker value={baseCurrency} onChange={setBaseCurrency} />
      </Field>

      <Card>
        <SectionHeader title="Converter" icon="swap-horizontal" />
        <Row style={{ marginTop: 6 }}>
          <Input style={{ flex: 1 }} mono value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Body muted>{from} →</Body>
        </Row>
        <CurrencyPicker value={from} onChange={setFrom} />
        <Metric size={22} color={t.colors.accent} style={{ marginTop: 8 }}>{converted === null ? '—' : formatCurrency(converted, baseCurrency)}</Metric>
      </Card>

      <SectionHeader title={`Rates per 1 ${baseCurrency}`} right={<Button compact kind="ghost" title="Refresh" loading={refreshing} onPress={async () => { setRefreshing(true); await refreshRates(); setRefreshing(false); }} />} />
      <Card>
        {SUPPORTED_CURRENCIES.filter((c) => c !== baseCurrency).map((c) => (
          <Row key={c} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <Body>{c}</Body>
            <Body style={{ fontVariant: ['tabular-nums'] }}>{rates ? (convert(1, baseCurrency, c, rates)?.toFixed(4) ?? '—') : '—'}</Body>
          </Row>
        ))}
      </Card>
      <Body small muted>Rates refresh about twice a day and are for budgeting only.</Body>
    </Screen>
  );
}
