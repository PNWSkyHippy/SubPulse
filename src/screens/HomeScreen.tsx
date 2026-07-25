import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useAuth } from '../context/AuthContext';
import SubscriptionCard from '../components/SubscriptionCard';
import { summarizeMonthlySpend } from '../utils/dateHelpers';
import { requestNotificationPermission } from '../utils/notifications';
import { formatCurrency } from '../utils/currency';
import { exportSubscriptionsToCSV } from '../utils/csvExport';
import { Subscription } from '../types';

type SortKey = 'renewal' | 'cost' | 'name' | 'category';
type Period = 'monthly' | 'yearly';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'renewal', label: 'Renewal date' },
  { key: 'cost', label: 'Cost' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
];

function sortSubscriptions(subs: Subscription[], sortKey: SortKey): Subscription[] {
  const copy = [...subs];
  switch (sortKey) {
    case 'renewal':
      return copy.sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate));
    case 'cost':
      return copy.sort((a, b) => b.cost - a.cost);
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'category':
      return copy.sort((a, b) => (a.category ?? 'Uncategorized').localeCompare(b.category ?? 'Uncategorized'));
  }
}

export default function HomeScreen({ navigation }: any) {
  const { subscriptions, loading } = useSubscriptions();
  const { signOut } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('renewal');
  const [period, setPeriod] = useState<Period>('monthly');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const summary = useMemo(() => summarizeMonthlySpend(subscriptions), [subscriptions]);
  const sorted = useMemo(() => sortSubscriptions(subscriptions, sortKey), [subscriptions, sortKey]);
  const periodMultiplier = period === 'yearly' ? 12 : 1;
  const currencyCodes = Object.keys(summary.byCurrency);
  const singleCurrency = currencyCodes.length <= 1;

  const onExport = async () => {
    if (subscriptions.length === 0) {
      Alert.alert('Nothing to export', 'Add a subscription first.');
      return;
    }
    setExporting(true);
    try {
      await exportSubscriptionsToCSV(subscriptions);
    } catch (err: any) {
      Alert.alert('Export failed', err.message ?? 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.periodRow}>
            <Text style={styles.headerLabel}>{period === 'monthly' ? 'Monthly' : 'Yearly'} spend</Text>
            <Pressable
              onPress={() => setPeriod(period === 'monthly' ? 'yearly' : 'monthly')}
              style={styles.periodToggle}
            >
              <Text style={styles.periodToggleText}>Show {period === 'monthly' ? 'yearly' : 'monthly'}</Text>
            </Pressable>
          </View>

          {singleCurrency ? (
            <Text style={styles.headerTotal}>
              {formatCurrency(summary.totalMonthly * periodMultiplier, currencyCodes[0] ?? 'USD')}
            </Text>
          ) : (
            <View style={styles.multiCurrencyRow}>
              {currencyCodes.map((code) => (
                <Text key={code} style={styles.multiCurrencyTotal}>
                  {formatCurrency(summary.byCurrency[code] * periodMultiplier, code)}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.headerSub}>{summary.subscriptionCount} active subscription{summary.subscriptionCount === 1 ? '' : 's'}</Text>

          {Object.keys(summary.byCategory).length > 1 && (
            <View style={styles.categoryRow}>
              {Object.entries(summary.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <View key={category} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>
                      {category} · {formatCurrency(amount * periodMultiplier, currencyCodes[0] ?? 'USD')}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 12 }}>
          <Pressable onPress={signOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
          <Pressable onPress={onExport} disabled={exporting}>
            <Text style={styles.exportLink}>{exporting ? 'Exporting…' : 'Export CSV'}</Text>
          </Pressable>
        </View>
      </View>

      {subscriptions.length > 0 && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.sortChip, sortKey === opt.key && styles.sortChipActive]}
              onPress={() => setSortKey(opt.key)}
            >
              <Text style={[styles.sortChipText, sortKey === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No subscriptions yet. Tap + to add your first one.</Text>
        }
        renderItem={({ item }) => (
          <SubscriptionCard sub={item} onPress={() => navigation.navigate('SubscriptionDetail', { id: item.id })} />
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddSubscription')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
  },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLabel: { color: '#94A3B8', fontSize: 14 },
  periodToggle: { backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  periodToggleText: { color: '#818CF8', fontSize: 11, fontWeight: '600' },
  headerTotal: { color: '#F8FAFC', fontSize: 34, fontWeight: '800', marginTop: 2 },
  multiCurrencyRow: { marginTop: 4 },
  multiCurrencyTotal: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  categoryChip: { backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  categoryChipText: { color: '#CBD5E1', fontSize: 12 },
  signOut: { color: '#F87171', fontSize: 14 },
  exportLink: { color: '#818CF8', fontSize: 13 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 4 },
  sortChip: { backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sortChipActive: { backgroundColor: '#334155' },
  sortChipText: { color: '#64748B', fontSize: 12 },
  sortChipTextActive: { color: '#F8FAFC', fontWeight: '600' },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 60 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
