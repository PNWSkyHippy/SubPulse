import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { computeNextRenewalDate, formatISODate } from '../utils/dateHelpers';

export default function SubscriptionDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { subscriptions, updateSubscription, deleteSubscription } = useSubscriptions();
  const sub = subscriptions.find((s) => s.id === id);

  const [reminderDays, setReminderDays] = useState(sub ? String(sub.reminderDaysBefore) : '3');
  const [saving, setSaving] = useState(false);

  if (!sub) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#94A3B8' }}>Subscription not found.</Text>
      </View>
    );
  }

  const nextRenewal = computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle);

  const onUpdateReminder = async () => {
    const num = parseInt(reminderDays, 10);
    if (isNaN(num) || num < 0) return Alert.alert('Invalid value', 'Enter a whole number of days.');
    setSaving(true);
    try {
      await updateSubscription(sub.id, { reminderDaysBefore: num });
      Alert.alert('Saved', 'Reminder updated.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete subscription?', `This removes ${sub.name} and cancels its reminder.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(sub.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{sub.name}</Text>
      <Text style={styles.row}>Cost: ${sub.cost.toFixed(2)} / {sub.billingCycle}</Text>
      <Text style={styles.row}>Next renewal: {formatISODate(nextRenewal)}</Text>
      <Text style={styles.row}>Category: {sub.category ?? 'Uncategorized'}</Text>

      <Text style={styles.label}>Remind me (days before)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={reminderDays} onChangeText={setReminderDays} />
      <Pressable style={styles.button} onPress={onUpdateReminder} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Update Reminder'}</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>Delete Subscription</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC', marginBottom: 16 },
  row: { color: '#CBD5E1', fontSize: 15, marginBottom: 6 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 20 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 10, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#6366F1', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { padding: 16, alignItems: 'center', marginTop: 24 },
  deleteText: { color: '#F87171', fontSize: 15, fontWeight: '600' },
});
