import React, { useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useAuth } from '../context/AuthContext';
import SubscriptionCard from '../components/SubscriptionCard';
import { summarizeMonthlySpend } from '../utils/dateHelpers';
import { requestNotificationPermission } from '../utils/notifications';

export default function HomeScreen({ navigation }: any) {
  const { subscriptions, loading } = useSubscriptions();
  const { signOut } = useAuth();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  const summary = summarizeMonthlySpend(subscriptions);
  const sorted = [...subscriptions].sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate));
  const categoryEntries = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>Monthly spend</Text>
          <Text style={styles.headerTotal}>${summary.totalMonthly.toFixed(2)}</Text>
          <Text style={styles.headerSub}>{summary.subscriptionCount} active subscription{summary.subscriptionCount === 1 ? '' : 's'}</Text>

          {categoryEntries.length > 1 && (
            <View style={styles.categoryRow}>
              {categoryEntries.map(([category, amount]) => (
                <View key={category} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{category} · ${amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

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
  headerLabel: { color: '#94A3B8', fontSize: 14 },
  headerTotal: { color: '#F8FAFC', fontSize: 34, fontWeight: '800', marginTop: 2 },
  headerSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  categoryChip: { backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  categoryChipText: { color: '#CBD5E1', fontSize: 12 },
  signOut: { color: '#F87171', fontSize: 14 },
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
