import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { useCashflow } from '../hooks/useCashflow';
import CurrencyPicker from '../components/CurrencyPicker';
import { Badge, Body, Button, Card, Field, Heading, Icon, Input, Label, Metric, Row, Screen, SectionHeader } from '../ui/kit';
import { formatCurrency } from '../utils/currency';
import { refreshStripeBalances, startStripeLink } from '../utils/gateway';

export default function BalancesScreen({ navigation }: any) {
  const t = useTheme();
  const { balances, upsertManualBalance, deleteBalance } = useSubscriptions();
  const { gatewayUrl, baseCurrency } = usePreferences();
  const cf = useCashflow();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [busy, setBusy] = useState<'link' | 'refresh' | null>(null);

  const link = async () => {
    setBusy('link');
    try {
      const { url } = await startStripeLink(gatewayUrl);
      const result = await WebBrowser.openAuthSessionAsync(url, 'subpulse://stripe-linked');
      if (result.type === 'success' || result.type === 'dismiss') {
        const r = await refreshStripeBalances(gatewayUrl);
        Alert.alert('Accounts linked', `${r.updated} account balance${r.updated === 1 ? '' : 's'} synced.`);
      }
    } catch (e: any) {
      Alert.alert('Stripe link unavailable', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    try {
      const r = await refreshStripeBalances(gatewayUrl);
      Alert.alert('Synced', `${r.updated} balance${r.updated === 1 ? '' : 's'} refreshed.`);
    } catch (e: any) {
      Alert.alert('Refresh failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const addManual = async () => {
    const v = parseFloat(amount.replace(/,/g, ''));
    if (!name.trim() || isNaN(v)) return Alert.alert('Missing info', 'Enter an account name and balance.');
    await upsertManualBalance({ name: name.trim(), available: v, currency });
    setName('');
    setAmount('');
  };

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Balances & liquidity</Heading>
      </Row>

      <Card tier={3}>
        <Label>Available liquidity ({baseCurrency})</Label>
        <Metric size={32}>{formatCurrency(cf.balanceTotal, baseCurrency)}</Metric>
        <Body small muted>Next 30 days outflow {formatCurrency(cf.outflow30, baseCurrency)} → {formatCurrency(cf.runwayAfter30, baseCurrency)} left</Body>
      </Card>

      <Card>
        <SectionHeader title="Stripe integration" icon="bank-outline" right={<Badge text={cf.stripeLinked ? 'Live' : 'Off'} tone={cf.stripeLinked ? 'ok' : 'neutral'} />} />
        <Body small muted style={{ marginVertical: 6 }}>
          Link checking/savings accounts through Stripe Financial Connections to see available balances next to upcoming bills. Runs through your SubPulse gateway; SubPulse only requests balance access, never payment permissions.
        </Body>
        {!gatewayUrl ? <Body small style={{ color: t.colors.warning }}>Set the gateway URL first (Settings → Agentic MCP gateway).</Body> : null}
        <Row style={{ marginTop: 6 }}>
          <Button style={{ flex: 1 }} icon="bank-outline" title="Link account" loading={busy === 'link'} disabled={!gatewayUrl} onPress={link} />
          <Button kind="secondary" icon="sync" title="Refresh" loading={busy === 'refresh'} disabled={!gatewayUrl || !cf.stripeLinked} onPress={refresh} />
        </Row>
        {cf.lastBalanceSync ? <Label style={{ marginTop: 6 }}>Last sync {cf.lastBalanceSync.slice(0, 16).replace('T', ' ')}</Label> : null}
      </Card>

      <SectionHeader title="Accounts" right={`${balances.length}`} />
      {balances.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: t.fonts.bodySemi }}>{b.name}{b.last4 ? ` ••${b.last4}` : ''}</Body>
              <Body small muted>{b.institution ?? (b.source === 'manual' ? 'Manual entry' : 'Stripe')} · {b.updatedAt.slice(0, 10)}</Body>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Metric size={16} color={t.colors.accent}>{formatCurrency(b.available, b.currency)}</Metric>
              <Pressable
                onPress={() =>
                  Alert.alert('Remove account?', b.name, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => deleteBalance(b.id) },
                  ])
                }
              >
                <Body small muted>remove</Body>
              </Pressable>
            </View>
          </Row>
        </Card>
      ))}

      <Card>
        <SectionHeader title="Add manual balance" icon="plus" />
        <Field label="Account name">
          <Input value={name} onChangeText={setName} placeholder="Checking" />
        </Field>
        <Field label="Available balance">
          <Input mono value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        </Field>
        <CurrencyPicker value={currency} onChange={setCurrency} />
        <Button style={{ marginTop: 8 }} kind="secondary" title="Save balance" onPress={addManual} />
      </Card>
    </Screen>
  );
}
