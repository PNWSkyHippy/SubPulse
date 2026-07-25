import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Subscription } from '../types';
import { computeNextRenewalDate, daysUntil, formatISODate } from '../utils/dateHelpers';
import { formatCurrency } from '../utils/currency';

export default function SubscriptionCard({
  sub,
  onPress,
}: {
  sub: Subscription;
  onPress: () => void;
}) {
  const nextRenewal = computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle);
  const days = daysUntil(nextRenewal);

  let urgencyColor = '#94A3B8';
  if (days <= sub.reminderDaysBefore) urgencyColor = '#F87171';
  else if (days <= 7) urgencyColor = '#FBBF24';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{sub.name}</Text>
        <Text style={styles.meta}>
          {sub.category ?? 'Uncategorized'} · {sub.billingCycle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.cost}>{formatCurrency(sub.cost, sub.currency)}</Text>
        <Text style={[styles.days, { color: urgencyColor }]}>
          {days === 0 ? 'Renews today' : days < 0 ? 'Overdue' : `${days}d · ${formatISODate(nextRenewal)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
  },
  name: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  meta: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  cost: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  days: { fontSize: 12, marginTop: 2, fontWeight: '500' },
});
