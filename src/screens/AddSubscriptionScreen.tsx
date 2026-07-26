import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { BillingCycle } from '../types';
import { formatISODate } from '../utils/dateHelpers';
import CurrencyPicker from '../components/CurrencyPicker';
import AlternatePricesInput from '../components/AlternatePricesInput';

const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export default function AddSubscriptionScreen({ navigation }: any) {
  const { addSubscription } = useSubscriptions();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [category, setCategory] = useState('');
  const [renewalDate, setRenewalDate] = useState(formatISODate(new Date()));
  const [reminderDays, setReminderDays] = useState('3');
  const [notes, setNotes] = useState('');
  const [alternatePrices, setAlternatePrices] = useState<Partial<Record<BillingCycle, number>>>({});
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const costNum = parseFloat(cost);
    const reminderNum = parseInt(reminderDays, 10);

    if (!name.trim()) return Alert.alert('Name required', 'Give the subscription a name.');
    if (isNaN(costNum) || costNum < 0) return Alert.alert('Invalid cost', 'Enter a valid cost, e.g. 9.99.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) return Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
    if (isNaN(reminderNum) || reminderNum < 0) return Alert.alert('Invalid reminder', 'Enter a whole number of days.');

    setSaving(true);
    try {
      await addSubscription({
        name: name.trim(),
        cost: costNum,
        currency,
        billingCycle: cycle,
        nextRenewalDate: renewalDate,
        reminderDaysBefore: reminderNum,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
        alternatePrices: Object.keys(alternatePrices).length > 0 ? alternatePrices : undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Add Subscription</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} placeholder="Netflix" value={name} onChangeText={setName} />

      <Text style={styles.label}>Cost per billing cycle</Text>
      <TextInput style={styles.input} placeholder="9.99" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />

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
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={renewalDate}
        onChangeText={setRenewalDate}
      />

      <Text style={styles.label}>Remind me (days before)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={reminderDays} onChangeText={setReminderDays} />

      <Text style={styles.label}>Category (optional)</Text>
      <TextInput style={styles.input} placeholder="Streaming" value={category} onChangeText={setCategory} />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="e.g. shared with family, cancel before trial ends"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Text style={styles.label}>Other pricing options (optional)</Text>
      <AlternatePricesInput currentCycle={cycle} value={alternatePrices} onChange={setAlternatePrices} />

      <Pressable style={styles.button} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Subscription'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  title: { fontSize: 24, fontWeight: '700', color: '#F8FAFC', marginBottom: 20 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 10, padding: 14, fontSize: 16 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center' },
  segmentActive: { backgroundColor: '#6366F1' },
  segmentText: { color: '#94A3B8', textTransform: 'capitalize', fontSize: 12 },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  button: { backgroundColor: '#6366F1', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
