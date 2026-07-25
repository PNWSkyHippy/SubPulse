import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { BillingCycle } from '../types';
import { computeNextRenewalDate, formatISODate } from '../utils/dateHelpers';
import CurrencyPicker from '../components/CurrencyPicker';

const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'yearly'];

export default function SubscriptionDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { subscriptions, updateSubscription, deleteSubscription } = useSubscriptions();
  const sub = subscriptions.find((s) => s.id === id);

  const [name, setName] = useState(sub?.name ?? '');
  const [cost, setCost] = useState(sub ? String(sub.cost) : '');
  const [currency, setCurrency] = useState(sub?.currency ?? 'USD');
  const [cycle, setCycle] = useState<BillingCycle>(sub?.billingCycle ?? 'monthly');
  const [category, setCategory] = useState(sub?.category ?? '');
  const [renewalDate, setRenewalDate] = useState(sub?.nextRenewalDate ?? '');
  const [reminderDays, setReminderDays] = useState(sub ? String(sub.reminderDaysBefore) : '3');
  const [notes, setNotes] = useState(sub?.notes ?? '');
  const [saving, setSaving] = useState(false);

  if (!sub) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#94A3B8' }}>Subscription not found.</Text>
      </View>
    );
  }

  const nextRenewal = computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle);

  const onSave = async () => {
    const costNum = parseFloat(cost);
    const reminderNum = parseInt(reminderDays, 10);

    if (!name.trim()) return Alert.alert('Name required', 'Give the subscription a name.');
    if (isNaN(costNum) || costNum < 0) return Alert.alert('Invalid cost', 'Enter a valid cost, e.g. 9.99.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) return Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
    if (isNaN(reminderNum) || reminderNum < 0) return Alert.alert('Invalid reminder', 'Enter a whole number of days.');

    setSaving(true);
    try {
      await updateSubscription(sub.id, {
        name: name.trim(),
        cost: costNum,
        currency,
        billingCycle: cycle,
        nextRenewalDate: renewalDate,
        reminderDaysBefore: reminderNum,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Saved', 'Subscription updated.');
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
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
      <Text style={styles.title}>Edit Subscription</Text>
      <Text style={styles.currentRenewal}>Currently renews {formatISODate(nextRenewal)}</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Cost per billing cycle</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />

      <Text style={styles.label}>Currency</Text>
      <CurrencyPicker value={currency} onChange={setCurrency} />

      <Text style={styles.label}>Billing cycle</Text>
      <View style={styles.segmentRow}>
        {CYCLES.map((c) => (
          <Pressable
            key={c}
            style={[styles.segment, cycle === c && styles.segmentActive]}
            onPress={() => setCycle(c)}
          >
            <Text style={[styles.segmentText, cycle === c && styles.segmentTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Next renewal date</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={renewalDate} onChangeText={setRenewalDate} />

      <Text style={styles.label}>Remind me (days before)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={reminderDays} onChangeText={setReminderDays} />

      <Text style={styles.label}>Category (optional)</Text>
      <TextInput style={styles.input} value={category} onChangeText={setCategory} />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="e.g. shared with family, cancel before trial ends"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable style={styles.button} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
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
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC' },
  currentRenewal: { color: '#94A3B8', fontSize: 13, marginTop: 4, marginBottom: 8 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 10, padding: 14, fontSize: 16 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center' },
  segmentActive: { backgroundColor: '#6366F1' },
  segmentText: { color: '#94A3B8', textTransform: 'capitalize' },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  button: { backgroundColor: '#6366F1', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  deleteText: { color: '#F87171', fontSize: 15, fontWeight: '600' },
});
