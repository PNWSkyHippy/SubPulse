import React, { useMemo, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { useCashflow } from '../hooks/useCashflow';
import { AppHeader, Badge, BadgeTone, Body, Button, Card, Chip, ChipRow, EmptyState, Heading, Label, Metric, Row, Screen, SectionHeader } from '../ui/kit';
import { catalogFor, SavingsOpportunity } from '../utils/insights';
import { formatCurrency } from '../utils/currency';
import AdBanner from '../components/AdBanner';

const TYPE_BADGE: Record<SavingsOpportunity['type'], { text: string; tone: BadgeTone }> = {
  duplicate: { text: 'Duplicate', tone: 'danger' },
  bundle: { text: 'Bundle overlap', tone: 'danger' },
  overlap: { text: 'Overlap alert', tone: 'warn' },
  'annual-switch': { text: 'Cadence arbitrage', tone: 'accent' },
  promotion: { text: 'Flash window', tone: 'warn' },
};
const CONFIDENCE_LABEL: Record<SavingsOpportunity['confidence'], string> = {
  exact: 'from your numbers',
  'list-price': 'list price — verify',
  estimate: 'estimate',
};

/** Future value of investing `monthly` every month for `years` at annual `rate` (monthly compounding). */
function futureValue(monthly: number, rate: number, years: number): number {
  const n = years * 12;
  if (rate === 0) return monthly * n;
  const r = rate / 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

export default function OptimizerScreen({ navigation }: any) {
  const t = useTheme();
  const { subscriptions, updateSubscription } = useSubscriptions();
  const { isPremium } = usePreferences();
  const cf = useCashflow();
  const [rate, setRate] = useState(0.05);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const money = (n: number) => formatCurrency(n, cf.baseCurrency);

  const opps = useMemo(() => cf.savings.opportunities.filter((o) => !dismissed.includes(o.id)), [cf.savings, dismissed]);
  const byId = (id: string) => subscriptions.find((s) => s.id === id);

  const act = (o: SavingsOpportunity) => {
    const target = byId(o.itemIds[0]);
    if (!target) return;
    const svc = catalogFor(target);
    switch (o.action) {
      case 'cancel':
        Alert.alert(
          `Cancel ${target.name}?`,
          `SubPulse will mark it cancelled and stop reminders. You still need to cancel with the provider${svc?.domain ? ` (${svc.domain})` : ''} so you aren't charged.`,
          [
            { text: 'Not now', style: 'cancel' },
            ...(svc?.domain ? [{ text: 'Open provider site', onPress: () => Linking.openURL(`https://${svc.domain}`) }] : []),
            { text: 'Mark cancelled', style: 'destructive' as const, onPress: () => updateSubscription(target.id, { status: 'cancelled' }) },
          ]
        );
        break;
      case 'switch-yearly': {
        const yearly = target.alternatePrices?.yearly ?? svc?.plans.find((p) => p.monthly !== undefined && Math.abs(p.monthly - target.cost) < 0.02)?.yearly;
        if (yearly === undefined) return navigation.navigate('ItemDetail', { id: target.id });
        Alert.alert(
          `Switch ${target.name} to yearly?`,
          `Once you've switched with the provider, SubPulse will track ${formatCurrency(yearly, target.currency)} per year instead of ${formatCurrency(target.cost, target.currency)} per month.`,
          [
            { text: 'Cancel', style: 'cancel' },
            ...(svc?.domain ? [{ text: 'Open provider site', onPress: () => Linking.openURL(`https://${svc.domain}`) }] : []),
            {
              text: 'I switched',
              onPress: () => {
                // Firestore rejects nested undefined values, so drop the key instead of setting it undefined.
                const alt = { ...(target.alternatePrices ?? {}), monthly: target.cost };
                delete alt.yearly;
                return updateSubscription(target.id, { billingCycle: 'yearly', cost: yearly, alternatePrices: alt });
              },
            },
          ]
        );
        break;
      }
      case 'apply-promo':
        if (o.promoCode) Clipboard.setStringAsync(o.promoCode);
        Alert.alert('Promo', `${o.promoCode ? `Code ${o.promoCode} copied. ` : ''}${o.url ? 'Open the offer page?' : ''}`, [
          { text: 'OK', style: 'cancel' },
          ...(o.url ? [{ text: 'Open', onPress: () => Linking.openURL(o.url!) }] : []),
        ]);
        break;
      default:
        navigation.navigate('ItemDetail', { id: target.id });
    }
  };

  const monthlySavings = cf.savings.totalAnnual / 12;

  return (
    <Screen>
      <AppHeader section="Optimizer" />

      <Card tier={3}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge text="Optimizer active" tone="accent" />
          <Label>{opps.length} actions</Label>
        </Row>
        <Label style={{ marginTop: 8 }}>Projected annual savings</Label>
        <Row gap={6} style={{ alignItems: 'flex-end' }}>
          <Metric size={34} color={t.colors.accent}>{money(cf.savings.totalAnnual)}</Metric>
          <Body muted style={{ marginBottom: 6 }}>/ year</Body>
        </Row>
        <Body small muted>Each item counted once. Burn today: {money(cf.burnMonthly)}/mo → {money(Math.max(0, cf.burnMonthly - monthlySavings))}/mo if you act on everything.</Body>
      </Card>

      <SectionHeader title="Actionable playbooks" right="Ranked by savings" icon="creation" />
      {opps.length === 0 ? (
        <EmptyState
          icon="check-circle-outline"
          title="Nothing to optimize yet"
          body="Link entries to known services (Add → Known App) or enter yearly prices on an item so the optimizer can compare. Duplicates, bundle overlaps, annual-plan savings and promos show up here."
        />
      ) : null}
      {opps.map((o) => {
        const badge = TYPE_BADGE[o.type];
        return (
          <Card key={o.id} indicator={badge.tone === 'danger' ? t.colors.danger : badge.tone === 'warn' ? t.colors.warning : t.colors.accent}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge text={badge.text} tone={badge.tone} />
              <Metric size={15} color={t.colors.accent}>−{formatCurrency(o.annualSavings, byId(o.itemIds[0])?.currency ?? cf.baseCurrency)}/yr</Metric>
            </Row>
            <Heading size="sm" style={{ marginTop: 6 }}>{o.title}</Heading>
            <Body muted small style={{ marginTop: 2 }}>{o.detail}</Body>
            <Label style={{ marginTop: 6 }}>{CONFIDENCE_LABEL[o.confidence]}</Label>
            <Row style={{ marginTop: 10 }}>
              <Button
                compact
                style={{ flex: 1 }}
                kind={o.action === 'apply-promo' ? 'warning' : 'primary'}
                icon={o.action === 'cancel' ? 'cancel' : o.action === 'switch-yearly' ? 'swap-horizontal' : o.action === 'apply-promo' ? 'tag-outline' : 'magnify'}
                title={o.action === 'cancel' ? 'Cancel duplicate' : o.action === 'switch-yearly' ? 'Switch to annual' : o.action === 'apply-promo' ? 'Apply promo' : 'Review usage'}
                onPress={() => act(o)}
              />
              <Button compact kind="secondary" title="Dismiss" onPress={() => setDismissed((d) => [...d, o.id])} />
            </Row>
          </Card>
        );
      })}

      {cf.savings.totalAnnual > 0 ? (
        <Card>
          <SectionHeader title="Compound projection" icon="trending-up" right={`${Math.round(rate * 100)}% APY`} />
          <Body small muted style={{ marginTop: 4 }}>If you invest the {money(monthlySavings)}/mo you'd save:</Body>
          <ChipRow>
            {[0, 0.03, 0.05, 0.07].map((r) => (
              <Chip key={r} label={`${Math.round(r * 100)}%`} active={rate === r} onPress={() => setRate(r)} />
            ))}
          </ChipRow>
          <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
            {[1, 3, 5].map((y) => (
              <View key={y}>
                <Label>Year {y}</Label>
                <Metric size={16} color={y === 5 ? t.colors.accent : undefined}>{money(futureValue(monthlySavings, rate, y))}</Metric>
              </View>
            ))}
          </Row>
          <Body small muted style={{ marginTop: 6, color: t.colors.textFaint }}>Illustration only, not financial advice.</Body>
        </Card>
      ) : null}

      {!isPremium ? (
        <Card tier={2}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading size="sm">SubPulse Pro</Heading>
            <Badge text="Zero ads" tone="accent" />
          </Row>
          <Body muted small style={{ marginVertical: 6 }}>Remove all ads with a one-time purchase.</Body>
          <Button title="Upgrade to Pro & go ad-free" icon="crown-outline" onPress={() => navigation.navigate('Paywall')} />
        </Card>
      ) : null}
      <AdBanner onUpgrade={() => navigation.navigate('Paywall')} />
    </Screen>
  );
}
