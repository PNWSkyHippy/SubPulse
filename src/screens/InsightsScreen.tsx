import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { findDuplicateSubscriptions, findYearlySavingsCandidates } from '../utils/insights';
import { formatCurrency } from '../utils/currency';

export default function InsightsScreen({ navigation }: any) {
  const { subscriptions } = useSubscriptions();

  const duplicates = useMemo(() => findDuplicateSubscriptions(subscriptions), [subscriptions]);
  const yearlyCandidates = useMemo(() => findYearlySavingsCandidates(subscriptions), [subscriptions]);

  const hasNothingToShow = duplicates.length === 0 && yearlyCandidates.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {hasNothingToShow && (
        <Text style={styles.empty}>
          Nothing to flag right now. Add a few subscriptions to see duplicate checks and savings candidates.
        </Text>
      )}

      {duplicates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possible Duplicates</Text>
          <Text style={styles.sectionSubtitle}>
            These subscriptions share the same name — worth checking if one is a forgotten leftover.
          </Text>
          {duplicates.map((group, idx) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.cardTitle}>{group[0].name}</Text>
              {group.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={styles.cardRow}
                  onPress={() => navigation.navigate('SubscriptionDetail', { id: sub.id })}
                >
                  <Text style={styles.cardRowText}>
                    {formatCurrency(sub.cost, sub.currency)} / {sub.billingCycle} · renews {sub.nextRenewalDate}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {yearlyCandidates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worth Checking for an Annual Plan</Text>
          <Text style={styles.sectionSubtitle}>
            Your priciest non-yearly subscriptions. Many services discount annual billing — worth checking
            each provider directly, since we can't know their actual annual price from here.
          </Text>
          {yearlyCandidates.map((sub) => (
            <Pressable
              key={sub.id}
              style={styles.card}
              onPress={() => navigation.navigate('SubscriptionDetail', { id: sub.id })}
            >
              <Text style={styles.cardTitle}>{sub.name}</Text>
              <Text style={styles.cardRowText}>
                {formatCurrency(sub.cost, sub.currency)} / {sub.billingCycle}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 60, lineHeight: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { color: '#94A3B8', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  cardRow: { paddingVertical: 4 },
  cardRowText: { color: '#CBD5E1', fontSize: 13 },
});
