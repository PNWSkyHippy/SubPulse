import React, { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { useCashflow } from '../hooks/useCashflow';
import ItemCard from '../components/ItemCard';
import AdBanner from '../components/AdBanner';
import {
  AppHeader,
  Badge,
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Heading,
  Icon,
  IconName,
  Label,
  Metric,
  Row,
  Screen,
  SectionHeader,
} from '../ui/kit';
import { formatCurrency } from '../utils/currency';
import { escalationLabel, kindOf } from '../utils/billing';
import { snoozeItem } from '../utils/notifications';
import { maybeShowInterstitialAfterSave } from '../utils/ad';
import { ItemKind } from '../types';

type Filter = 'all' | 'subscriptions' | 'housing' | 'utilities' | 'one-time' | 'other';
const FILTERS: { key: Filter; label: string; kinds: ItemKind[] | null }[] = [
  { key: 'all', label: 'All', kinds: null },
  { key: 'subscriptions', label: 'Subscriptions', kinds: ['subscription', 'membership', 'magazine'] },
  { key: 'housing', label: 'Leases & Rent', kinds: ['lease'] },
  { key: 'utilities', label: 'Utilities', kinds: ['utility'] },
  { key: 'one-time', label: 'One-time', kinds: ['one-time'] },
  { key: 'other', label: 'Loans & Insurance', kinds: ['loan', 'insurance', 'other'] },
];

export default function DashboardScreen({ navigation }: any) {
  const t = useTheme();
  const { subscriptions, loading, recordPayment } = useSubscriptions();
  const { isPremium } = usePreferences();
  const cf = useCashflow();
  const [filter, setFilter] = useState<Filter>('all');
  const money = (n: number) => formatCurrency(n, cf.baseCurrency);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const items = f.kinds ? subscriptions.filter((s) => f.kinds!.includes(kindOf(s))) : subscriptions;
    // Overdue first, then by due date.
    return [...items].sort((a, b) => {
      const sa = a.status && a.status !== 'active' ? 1 : 0;
      const sb = b.status && b.status !== 'active' ? 1 : 0;
      return sa - sb || a.nextRenewalDate.localeCompare(b.nextRenewalDate);
    });
  }, [subscriptions, filter]);

  const worst = cf.overdue[0];

  const markPaid = (id: string, name: string, amount: string) => {
    Alert.alert('Mark as paid?', `Record a ${amount} payment for ${name} today and move it to the next cycle.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark paid',
        onPress: async () => {
          try {
            await recordPayment(id);
            maybeShowInterstitialAfterSave(isPremium);
          } catch (e: any) {
            Alert.alert('Could not record payment', e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  };

  const pickDueToPay = () => {
    const candidates = [...cf.overdue, ...cf.dueSoon].slice(0, 6);
    if (candidates.length === 0) {
      Alert.alert('Nothing due', 'No bills are due or overdue right now. Open any item to record a payment.');
      return;
    }
    Alert.alert(
      'Record a payment',
      'Which bill did you pay?',
      [
        ...candidates.map(({ item }) => ({ text: `${item.name} · ${formatCurrency(item.cost, item.currency)}`, onPress: () => markPaid(item.id, item.name, formatCurrency(item.cost, item.currency)) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const rapid: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'cash-multiple', label: 'Record Pay', onPress: pickDueToPay },
    { icon: 'upload-outline', label: 'Import CSV', onPress: () => navigation.navigate('Add', { mode: 'csv' }) },
    { icon: 'calculator-variant', label: 'Calculator', onPress: () => navigation.navigate('Calculator') },
    { icon: 'calendar-month-outline', label: 'Calendar', onPress: () => navigation.navigate('Calendar') },
  ];

  const maxWeek = Math.max(1, ...cf.weeks);

  return (
    <Screen
      footer={
        <Pressable
          onPress={() => navigation.navigate('Add', { mode: 'known' })}
          style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: t.colors.accent, borderRadius: t.radius.control + 6, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', gap: 6, alignItems: 'center', elevation: 6 }}
        >
          <Icon name="plus" color={t.colors.onAccent} />
          <Body style={{ color: t.colors.onAccent, fontFamily: t.fonts.bodySemi }}>Quick Add</Body>
        </Pressable>
      }
    >
      <AppHeader
        section="Dashboard"
        right={
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Icon name={cf.overdue.length ? 'bell-ring-outline' : 'bell-outline'} color={cf.overdue.length ? t.colors.danger : t.colors.textMuted} />
          </Pressable>
        }
      />

      {/* Liquidity */}
      <Card onPress={() => navigation.navigate('Balances')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{cf.stripeLinked ? 'Stripe treasury feed' : 'Available liquidity'}</Label>
          <Badge text={cf.stripeLinked ? 'Stripe connected' : cf.balanceTotal ? 'Manual' : 'Not linked'} tone={cf.stripeLinked ? 'ok' : 'neutral'} />
        </Row>
        <Metric size={34} style={{ marginTop: 6 }}>{money(cf.balanceTotal)}</Metric>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <View>
            <Label>Outflow next 30 days</Label>
            <Metric size={16} color={t.colors.warning}>−{money(cf.outflow30)}</Metric>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label>After 30 days</Label>
            <Metric size={16} color={cf.runwayAfter30 < 0 ? t.colors.danger : t.colors.accent}>{money(cf.runwayAfter30)}</Metric>
          </View>
        </Row>
        {!cf.balanceTotal ? <Body small muted style={{ marginTop: 6 }}>Tap to link a bank via Stripe or enter a balance manually.</Body> : null}
      </Card>

      {/* Burn */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Committed monthly burn</Label>
          <Pressable onPress={() => navigation.navigate('Currency')}>
            <Badge text={cf.baseCurrency} tone="accent" />
          </Pressable>
        </Row>
        <Row style={{ alignItems: 'flex-end', marginTop: 4 }} gap={6}>
          <Metric size={30}>{money(cf.burnMonthly)}</Metric>
          <Body muted style={{ marginBottom: 6 }}>/ month · {cf.activeCount} items</Body>
        </Row>
        {Object.keys(cf.unconverted).length ? (
          <Body small muted>+ {Object.entries(cf.unconverted).map(([c, v]) => formatCurrency(v, c)).join(', ')} (no rate yet)</Body>
        ) : null}
        <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <View>
            <Label>Annual burn</Label>
            <Metric size={15}>{money(cf.burnAnnual)}</Metric>
          </View>
          <View>
            <Label>One-off fees</Label>
            <Metric size={15} color={t.colors.warning}>{money(cf.oneOff30)}</Metric>
            <Body small muted>next 30 days</Body>
          </View>
          <View>
            <Label>Contracts</Label>
            <Metric size={15} color={t.colors.accent}>{cf.contracts} active</Metric>
          </View>
        </Row>
        {/* 30-day outflow by week */}
        <Row style={{ alignItems: 'flex-end', height: 52, marginTop: 12 }} gap={6}>
          {cf.weeks.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: Math.max(3, (w / maxWeek) * 40), backgroundColor: i === 0 ? t.colors.accent : t.colors.surface3, borderRadius: 2 }} />
              <Body small muted style={{ fontSize: 9 }}>{i === 4 ? 'wk 5' : `wk ${i + 1}`}</Body>
            </View>
          ))}
        </Row>
      </Card>

      {/* Escalation */}
      {worst ? (
        <Card style={{ backgroundColor: t.colors.dangerSoft, borderColor: t.colors.dangerBorder, borderWidth: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}>
              <Icon name="alert-octagon-outline" color={t.colors.danger} />
              <Label color={t.colors.danger}>{escalationLabel(worst.due.escalationLevel)}</Label>
            </Row>
            <Badge text={`${cf.overdue.length} overdue`} tone="danger" />
          </Row>
          <Heading size="md" style={{ marginTop: 6 }}>{worst.item.name}</Heading>
          <Body muted>
            {formatCurrency(worst.due.amountDue, worst.item.currency)} overdue by {worst.due.daysOverdue} day{worst.due.daysOverdue === 1 ? '' : 's'}
            {worst.due.unpaidCycles > 1 ? ` (${worst.due.unpaidCycles} payments missed)` : ''}.
          </Body>
          <Row style={{ marginTop: 10 }}>
            <Button style={{ flex: 1 }} kind="danger" icon="check-circle-outline" title={`Mark paid (${formatCurrency(worst.item.cost, worst.item.currency)})`} onPress={() => markPaid(worst.item.id, worst.item.name, formatCurrency(worst.item.cost, worst.item.currency))} />
            <Button kind="secondary" title="Snooze 24h" onPress={() => snoozeItem(worst.item).then(() => Alert.alert('Snoozed', "We'll remind you again tomorrow."))} />
          </Row>
        </Card>
      ) : null}

      {/* Rapid protocols */}
      <SectionHeader title="Rapid actions" right={`${rapid.length} ready`} />
      <Row gap={8}>
        {rapid.map((r) => (
          <Card key={r.label} onPress={r.onPress} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 }}>
            <Icon name={r.icon} color={t.colors.accent} size={22} />
            <Body small style={{ textAlign: 'center' }}>{r.label}</Body>
          </Card>
        ))}
      </Row>

      {/* Savings teaser */}
      {cf.savings.opportunities.length ? (
        <Card tier={3} onPress={() => navigation.navigate('Optimizer')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={t.colors.accent}>Optimization engine</Label>
            <Badge text={`${cf.savings.opportunities.length} actions`} tone="accent" />
          </Row>
          <Heading size="lg" style={{ marginTop: 4 }}>Save {money(cf.savings.totalAnnual)} / year</Heading>
          <Body muted numberOfLines={2}>{cf.savings.opportunities.slice(0, 2).map((o) => o.title).join(' · ')}</Body>
        </Card>
      ) : null}

      {/* Commitments */}
      <SectionHeader title="Active commitments" right={`${list.length} scheduled`} />
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipRow>
      {!loading && list.length === 0 ? (
        <EmptyState
          icon="plus-circle-outline"
          title={subscriptions.length ? 'Nothing in this filter' : 'Track your first bill'}
          body="Add a known app in one tap, a lease or utility with a custom amount, or import a CSV."
          action={<Button compact title="Add entry" onPress={() => navigation.navigate('Add', { mode: 'known' })} />}
        />
      ) : null}
      {list.map((s) => (
        <ItemCard key={s.id} sub={s} onPress={() => navigation.navigate('ItemDetail', { id: s.id })} />
      ))}

      <AdBanner onUpgrade={() => navigation.navigate('Paywall')} />
      <View style={{ height: 70 }} />
    </Screen>
  );
}
