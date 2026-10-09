import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { ALL_BILLING_CYCLES, ALL_ITEM_KINDS, BillingCycle, ItemKind, NewSubscription, SplitShare } from '../types';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Card, Chip, ChipRow, Field, Input, Label, Row, ToggleRow } from '../ui/kit';
import { CYCLE_LABELS, DEFAULT_ESCALATION_DAYS, KIND_LABELS, evenSplits } from '../utils/billing';
import { formatISODate, todayLocal, addCycle, parseISODate } from '../utils/dateHelpers';
import CurrencyPicker from './CurrencyPicker';
import AlternatePricesInput from './AlternatePricesInput';
import { KIND_ICONS } from './ItemCard';

const AUTO_PAY_KINDS: ItemKind[] = ['subscription', 'magazine', 'membership'];
const REMINDER_PRESETS = [0, 1, 3, 7, 14];
const ESCALATION_PRESETS: { label: string; days: number[] }[] = [
  { label: '1 · 3 · 7 days', days: [1, 3, 7] },
  { label: '1 · 5 · 10 days', days: [1, 5, 10] },
  { label: 'Day 1 only', days: [1] },
];

export type ItemFormValues = NewSubscription;

/**
 * One form for every kind of recurring commitment — subscriptions, leases,
 * utilities, magazines, insurance, loans, one-time fees. Used by "Add"
 * (blank or pre-filled from the catalog) and by "Edit" on the detail screen.
 */
export default function ItemForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ItemFormValues>;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void>;
}) {
  const t = useTheme();
  const { contacts } = useSubscriptions();

  const [kind, setKind] = useState<ItemKind>(initial?.kind ?? 'subscription');
  const [name, setName] = useState(initial?.name ?? '');
  const [cost, setCost] = useState(initial?.cost !== undefined ? String(initial.cost) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [cycle, setCycle] = useState<BillingCycle>(initial?.billingCycle ?? 'monthly');
  const [dueDate, setDueDate] = useState(initial?.nextRenewalDate ?? formatISODate(todayLocal()));
  const [reminderDays, setReminderDays] = useState(initial?.reminderDaysBefore ?? 3);
  const [autoPay, setAutoPay] = useState<boolean>(initial?.autoPay ?? AUTO_PAY_KINDS.includes(initial?.kind ?? 'subscription'));
  const [autoPayTouched, setAutoPayTouched] = useState(initial?.autoPay !== undefined);
  const [escalation, setEscalation] = useState<number[]>(initial?.escalationDays ?? DEFAULT_ESCALATION_DAYS);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [payee, setPayee] = useState<string | undefined>(initial?.payeeContactId);
  const [splitIds, setSplitIds] = useState<string[]>((initial?.splits ?? []).map((s) => s.contactId));
  const [alternatePrices, setAlternatePrices] = useState<Partial<Record<BillingCycle, number>>>(initial?.alternatePrices ?? {});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const sortedContacts = useMemo(() => [...contacts].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40), [contacts]);

  const pickKind = (k: ItemKind) => {
    setKind(k);
    if (!autoPayTouched) setAutoPay(AUTO_PAY_KINDS.includes(k));
    if (k === 'one-time') setCycle('once');
    else if (cycle === 'once') setCycle('monthly');
  };

  const shiftDue = (mode: 'today' | 'next') => {
    if (mode === 'today') return setDueDate(formatISODate(todayLocal()));
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) setDueDate(formatISODate(addCycle(parseISODate(dueDate), cycle === 'once' ? 'monthly' : cycle)));
  };

  const toggleSplit = (id: string) => setSplitIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    const costNum = parseFloat(cost.replace(/,/g, ''));
    if (!name.trim()) return Alert.alert('Name required', 'Give this entry a name.');
    if (isNaN(costNum) || costNum < 0) return Alert.alert('Invalid amount', 'Enter a valid amount, e.g. 9.99.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || isNaN(parseISODate(dueDate).getTime())) return Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
    const splits: SplitShare[] | undefined = splitIds.length ? evenSplits(splitIds) : undefined;
    setSaving(true);
    try {
      await onSubmit({
        kind,
        name: name.trim(),
        cost: Math.round(costNum * 100) / 100,
        currency,
        billingCycle: cycle,
        nextRenewalDate: dueDate,
        reminderDaysBefore: reminderDays,
        autoPay,
        escalationDays: autoPay ? undefined : escalation,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
        payeeContactId: payee,
        splits,
        alternatePrices: Object.keys(alternatePrices).length ? alternatePrices : undefined,
        catalogId: initial?.catalogId,
        status: initial?.status ?? 'active',
      });
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Field label="Entity category">
        <ChipRow scroll={false}>
          {ALL_ITEM_KINDS.map((k) => (
            <Chip key={k} label={KIND_LABELS[k]} icon={KIND_ICONS[k]} active={kind === k} onPress={() => pickKind(k)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Entity / vendor name" required>
        <Input value={name} onChangeText={setName} placeholder={kind === 'lease' ? 'Office Space Lease (Unit 4B)' : 'Netflix'} />
      </Field>

      <Field label={cycle === 'once' ? 'Amount' : 'Amount per billing cycle'} required>
        <Input mono value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      <CurrencyPicker value={currency} onChange={setCurrency} />

      <Field label="Cadence">
        <ChipRow>
          {ALL_BILLING_CYCLES.map((c) => (
            <Chip key={c} label={CYCLE_LABELS[c]} active={cycle === c} onPress={() => setCycle(c)} />
          ))}
        </ChipRow>
      </Field>

      <Field label={autoPay ? 'Next charge date' : 'Next due date'} hint={autoPay ? undefined : 'Stays on this date until you mark it paid, so a missed payment shows as overdue.'}>
        <Row>
          <Input style={{ flex: 1 }} mono value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
          <Button compact kind="secondary" title="Today" onPress={() => shiftDue('today')} />
          {cycle !== 'once' ? <Button compact kind="secondary" title="+1 cycle" onPress={() => shiftDue('next')} /> : null}
        </Row>
      </Field>

      <ToggleRow
        title="Auto-pay (card or bank debit)"
        subtitle={autoPay ? 'Charges on its own; date rolls forward automatically.' : 'You pay it yourself; SubPulse reminds and escalates if late.'}
        value={autoPay}
        onChange={(v) => {
          setAutoPay(v);
          setAutoPayTouched(true);
        }}
      />

      <Field label="Alert before due date">
        <ChipRow>
          {REMINDER_PRESETS.map((d) => (
            <Chip key={d} label={d === 0 ? 'Off' : `${d} day${d === 1 ? '' : 's'} before`} active={reminderDays === d} onPress={() => setReminderDays(d)} />
          ))}
        </ChipRow>
      </Field>

      {!autoPay ? (
        <Field label="Late payment escalation" hint="Escalating notifications after the due date until it's marked paid.">
          <ChipRow>
            {ESCALATION_PRESETS.map((p) => (
              <Chip key={p.label} label={p.label} active={p.days.join() === escalation.join()} onPress={() => setEscalation(p.days)} />
            ))}
          </ChipRow>
        </Field>
      ) : null}

      <Field label="Assign contact / split payee" hint={contacts.length === 0 ? 'Import contacts in Settings → Contacts to assign landlords or split costs.' : 'Tap people to split this cost evenly with you; pick who gets paid below.'}>
        {contacts.length > 0 ? (
          <ChipRow>
            {sortedContacts.map((c) => (
              <Chip
                key={c.id}
                label={`${c.name}${payee === c.id ? ' · payee' : ''}${splitIds.includes(c.id) ? ` (${Math.round((1 / (splitIds.length + 1)) * 100)}%)` : ''}`}
                active={splitIds.includes(c.id) || payee === c.id}
                onPress={() => toggleSplit(c.id)}
              />
            ))}
          </ChipRow>
        ) : null}
        {contacts.length > 0 ? (
          <ChipRow>
            <Label>Payee:</Label>
            <Chip label="None" active={!payee} onPress={() => setPayee(undefined)} />
            {sortedContacts.slice(0, 12).map((c) => (
              <Chip key={c.id} label={c.name} active={payee === c.id} onPress={() => setPayee(c.id)} />
            ))}
          </ChipRow>
        ) : null}
      </Field>

      <Field label="Category (optional)">
        <Input value={category} onChangeText={setCategory} placeholder={kind === 'utility' ? 'Utilities' : 'Streaming'} />
      </Field>

      <Field label="Attachment & audit trail (notes)">
        <Input value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} placeholder="e.g. lease countersigned via DocuSign, wire receipts kept in email" />
      </Field>

      <Card tier={1} onPress={() => setShowMore((v) => !v)}>
        <Body muted>{showMore ? '▾' : '▸'} Other pricing options (exact annual-switch savings)</Body>
      </Card>
      {showMore ? <AlternatePricesInput currentCycle={cycle} value={alternatePrices} onChange={setAlternatePrices} /> : null}

      <Button title={submitLabel} icon="check-circle-outline" onPress={submit} loading={saving} style={{ marginTop: 6 }} />
      <Body small muted style={{ textAlign: 'center', color: t.colors.textFaint }}>Synced to your account; reminders are scheduled on this device.</Body>
    </View>
  );
}
