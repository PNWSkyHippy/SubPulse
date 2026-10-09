import React from 'react';
import { View } from 'react-native';
import { Subscription } from '../types';
import { useTheme } from '../context/PreferencesContext';
import { Avatar, Badge, BadgeTone, Body, Card, IconName, Metric } from '../ui/kit';
import { CYCLE_LABELS, getDueInfo, isAutoPay, kindOf, statusOf } from '../utils/billing';
import { formatCurrency } from '../utils/currency';
import { ItemKind } from '../types';

export const KIND_ICONS: Record<ItemKind, IconName> = {
  subscription: 'repeat',
  lease: 'home-city-outline',
  utility: 'flash-outline',
  magazine: 'newspaper-variant-outline',
  insurance: 'shield-check-outline',
  loan: 'cash-clock',
  membership: 'card-account-details-outline',
  'one-time': 'receipt-text-outline',
  other: 'dots-horizontal-circle-outline',
};

export function useStatusVisual(sub: Subscription) {
  const t = useTheme();
  const info = getDueInfo(sub);
  let tone: BadgeTone = 'neutral';
  let label = '';
  let bar = t.colors.accent;
  let line = '';
  const manual = !isAutoPay(sub);
  switch (info.state) {
    case 'inactive':
      tone = 'neutral';
      label = statusOf(sub);
      bar = t.colors.textFaint;
      line = statusOf(sub) === 'completed' ? `Paid ${sub.lastPaidDate ?? ''}` : 'Not billing';
      break;
    case 'overdue':
      tone = 'danger';
      label = `Overdue ${info.daysOverdue}d`;
      bar = t.colors.danger;
      line = info.unpaidCycles > 1 ? `${info.unpaidCycles} payments missed` : `Was due ${info.dueDateISO}`;
      break;
    case 'due-today':
      tone = 'warn';
      label = 'Due today';
      bar = t.colors.warning;
      line = manual ? 'Pay today' : 'Charges today';
      break;
    case 'upcoming':
      tone = 'warn';
      label = `In ${info.days}d`;
      bar = t.colors.warning;
      line = `${manual ? 'Due' : 'Renews'} ${info.dueDateISO}`;
      break;
    default:
      tone = sub.lastPaidDate ? 'ok' : 'neutral';
      label = sub.lastPaidDate && manual ? 'Paid' : isAutoPay(sub) ? 'Auto-pay' : 'Scheduled';
      bar = t.colors.accent;
      line = `${manual ? 'Due' : 'Renews'} in ${info.days} days · ${info.dueDateISO}`;
  }
  return { info, tone, label, bar, line };
}

export default function ItemCard({ sub, onPress }: { sub: Subscription; onPress: () => void }) {
  const t = useTheme();
  const { tone, label, bar, line } = useStatusVisual(sub);
  const kind = kindOf(sub);
  return (
    <Card indicator={bar} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar name={sub.name} icon={kind === 'subscription' ? undefined : KIND_ICONS[kind]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Body numberOfLines={1} style={{ fontFamily: t.fonts.bodySemi, fontSize: 15 }}>{sub.name}</Body>
        <Body small muted numberOfLines={1}>{line} · {CYCLE_LABELS[sub.billingCycle]}</Body>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Metric size={15}>{formatCurrency(sub.cost, sub.currency)}</Metric>
        <Badge text={label} tone={tone} />
      </View>
    </Card>
  );
}
