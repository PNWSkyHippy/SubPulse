import React, { useEffect } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useAuth } from '../context/AuthContext';
import SubscriptionCard from '../components/SubscriptionCard';
import { summarizeMonthlySpend } from '../utils/dateHelpers';
import { requestNotificationPermission, sendTestNotification } from '../utils/notifications';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Monthly spend</Text>
          <Text style={styles.headerTotal}>${summary.totalMonthly.toFixed(2)}</Text>
          <Text style={styles.headerSub}>{summary.subscriptionCount} active subscription{summary.subscriptionCount === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {/* TEMPORARY debug button — remove once notification delivery is confirmed working */}
      <Pressable
        style={({ pressed }) => [styles.testButton, pressed && styles.testButtonPressed]}
        onPress={async () => {
          Alert.alert('Tap registered', 'Notification scheduled. Swipe down your notification shade in about 10 seconds.');
          await sendTestNotification();
        }}
      >
        <Text style={styles.testButtonText}>Send test notification (10s)</Text>
      </Pressable>

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
  signOut: { color: '#F87171', fontSize: 14 },
  testButton: { marginHorizontal: 20, marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center' },
  testButtonPressed: { backgroundColor: '#334155' },
  testButtonText: { color: '#94A3B8', fontSize: 12 },
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
