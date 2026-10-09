import React, { useMemo } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { KIND_ICONS, useStatusVisual } from '../components/ItemCard';
import Calculator from '../components/Calculator';
import {
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  Divider,
  EmptyState,
  Heading,
  Icon,
  Label,
  Metric,
  Row,
  Screen,
  SectionHeader,
} from '../ui/kit';
import {
  CYCLE_LABELS,
  KIND_LABELS,
  escalationDates,
  escalationDaysOf,
  isAutoPay,
  kindOf,
  splitCost,
  statusOf,
} from '../utils/billing';
import { formatCurrency } from '../utils/currency';
import { exportToKeep, sendToGemini } from '../utils/noteExport';
import { maybeShowInterstitialAfterSave } from '../utils/ad';
import { catalogFor } from '../utils/insights';
import { formatNumber } from '../utils/calculator';
import { snoozeItem } from '../utils/notifications';
import { Subscription } from '../types';

export default function ItemDetailScreen({ route, navigation }: any) {
  const { subscriptions } = useSubscriptions();
  const item = subscriptions.find((s) => s.id === route.params.id);
  if (!item) {
    return (
      <Screen>
        <EmptyState icon="close-circle-outline" title="Entry not found" body="It may have been deleted on another device." action={<Button compact title="Back" onPress={() => navigation.goBack()} />} />
      </Screen>
    );
  }
  return <ItemDetailBody sub={item} navigation={navigation} />;
}

function ItemDetailBody({ sub, navigation }: { sub: Subscription; navigation: any }) {
  const t = useTheme();
  const { payments, notes, contacts, recordPayment, updateSubscription, deleteSubscription, deletePayment } = useSubscriptions();
  const { isPremium } = usePreferences();
  const id = sub.id;
  const itemPayments = useMemo(() => payments.filter((p) => p.itemId === id).sort((a, b) => b.paidDate.localeCompare(a.paidDate)), [payments, id]);
  const itemNotes = useMemo(() => notes.filter((n) => n.itemId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes, id]);
  const contactName = (cid?: string) => contacts.find((c) => c.id === cid)?.name ?? 'Unknown contact';
  const visual = useStatusVisual(sub);
  const { info } = visual;
  const manual = !isAutoPay(sub);
  const status = statusOf(sub);
  const kind = kindOf(sub);
  const svc = catalogFor(sub);
  const money = (n: number) => formatCurrency(n, sub.currency);
  const splitLines = splitCost(sub.cost, sub.splits);

  const markPaid = () =>
    Alert.alert('Mark as paid?', `Record ${money(sub.cost)} paid today for the ${info.dueDateISO} ${manual ? 'due date' : 'charge'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark paid',
        onPress: async () => {
          try {
            await recordPayment(sub.id);
            maybeShowInterstitialAfterSave(isPremium);
          } catch (e: any) {
            Alert.alert('Could not record payment', e?.message ?? 'Try again.');
          }
        },
      },
    ]);

  const setStatus = (s: 'active' | 'paused' | 'cancelled') => updateSubscription(sub.id, { status: s });

  const remove = () =>
    Alert.alert('Delete entry?', `Removes ${sub.name}, its reminders and its payment history link. Notes stay in your notes list.`, [
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

  const requestShares = () => {
    const lines = splitLines.filter((l) => l.contactId).map((l) => `${contactName(l.contactId!)}: ${money(l.amount)}`);
    Share.share({ message: `${sub.name} (${money(sub.cost)} ${CYCLE_LABELS[sub.billingCycle].toLowerCase()}, due ${info.dueDateISO})\nSplit:\n${lines.join('\n')}\nMy share: ${money(splitLines[0].amount)}` });
  };

  // Escalation protocol steps (manual-pay only)
  const escDates = escalationDates(sub);
  const steps = manual
    ? [
        { key: 'remind', label: 'Remind', sub: sub.reminderDaysBefore ? `${sub.reminderDaysBefore}d prior` : 'off', done: info.days <= sub.reminderDaysBefore || info.state === 'overdue' },
        { key: 'due', label: 'Due now', sub: info.dueDateISO, done: info.days <= 0 },
        { key: 'esc', label: info.escalationLevel ? `Stage ${info.escalationLevel}` : 'Escalate', sub: `${escalationDaysOf(sub).join('/')}d late`, done: info.escalationLevel > 0 },
        { key: 'clear', label: 'Cleared', sub: sub.lastPaidDate ? `paid ${sub.lastPaidDate}` : 'ledger reconciled', done: info.state !== 'overdue' && info.state !== 'due-today' && !!sub.lastPaidDate },
      ]
    : [];

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Label>Inspector & ledger</Label>
        <Badge text={status === 'active' ? 'Active audit' : status} tone={status === 'active' ? 'ok' : 'neutral'} />
      </Row>

      <Card indicator={visual.bar}>
        <Row gap={12}>
          <Avatar name={sub.name} size={48} icon={kind === 'subscription' ? undefined : KIND_ICONS[kind]} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Badge text={KIND_LABELS[kind]} />
              {manual ? <Badge text="Manual pay" tone="warn" /> : <Badge text="Auto-pay" tone="ok" />}
            </Row>
            <Heading size="lg" style={{ marginTop: 4 }}>{sub.name}</Heading>
            {sub.category ? <Body small muted>{sub.category}{svc ? ` · ${svc.domain ?? svc.name}` : ''}</Body> : null}
          </View>
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Label>Recurring burn</Label>
            <Metric size={28}>{money(sub.cost)}</Metric>
            <Body small muted>{CYCLE_LABELS[sub.billingCycle]}</Body>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Label>{manual ? 'Next due' : 'Next billing'}</Label>
            <Metric size={18} color={visual.bar}>{info.dueDateISO}</Metric>
            <Badge text={visual.label} tone={visual.tone} />
          </View>
        </Row>
        {sub.payeeContactId ? <Body small muted style={{ marginTop: 6 }}>Payee: {contactName(sub.payeeContactId)}</Body> : null}
        {info.state === 'overdue' ? (
          <Body style={{ color: t.colors.danger, marginTop: 6 }}>
            {money(info.amountDue)} outstanding · {info.daysOverdue} day{info.daysOverdue === 1 ? '' : 's'} late
          </Body>
        ) : null}
      </Card>

      {manual && status === 'active' ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <SectionHeader title="Payment escalation protocol" />
            {info.escalationLevel ? <Badge text={`Stage ${info.escalationLevel} active`} tone="danger" /> : null}
          </Row>
          <Row style={{ marginTop: 10, alignItems: 'flex-start' }} gap={6}>
            {steps.map((s, i) => (
              <View key={s.key} style={{ flex: 1, gap: 4 }}>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: s.done ? (i === 2 ? t.colors.danger : t.colors.accent) : t.colors.surface3 }} />
                <Label color={s.done ? t.colors.text : t.colors.textFaint}>{`0${i + 1} ${s.label}`}</Label>
                <Body small muted>{s.sub}</Body>
              </View>
            ))}
          </Row>
          {escDates.length ? <Body small muted style={{ marginTop: 6 }}>Escalation alerts: {escDates.join(', ')}</Body> : null}
        </Card>
      ) : null}

      {status === 'active' ? (
        <Button icon="check-circle-outline" title={`Mark as paid (${money(sub.cost)})`} onPress={markPaid} />
      ) : status === 'completed' ? null : (
        <Button icon="play-circle-outline" title="Resume tracking" onPress={() => setStatus('active')} />
      )}
      <Row>
        <Button style={{ flex: 1 }} compact kind="secondary" icon="pencil-outline" title="Edit entity" onPress={() => navigation.navigate('EditItem', { id: sub.id })} />
        {status === 'active' ? (
          <Button style={{ flex: 1 }} compact kind="warning" icon="pause-circle-outline" title="Pause stream" onPress={() => setStatus('paused')} />
        ) : null}
      </Row>
      {status === 'active' && (info.state === 'overdue' || info.state === 'due-today') ? (
        <Button compact kind="secondary" icon="bell-ring-outline" title="Remind me tomorrow" onPress={() => snoozeItem(sub).then(() => Alert.alert('Snoozed', "We'll remind you tomorrow."))} />
      ) : null}

      {/* Payments */}
      <SectionHeader title="Payment history" icon="history" right={`${itemPayments.length} records`} />
      {itemPayments.length === 0 ? <Body small muted>No payments recorded yet.</Body> : null}
      {itemPayments.slice(0, 12).map((p) => (
        <Card key={p.id} style={{ paddingVertical: 10 }}>
          <Pressable
            onLongPress={() =>
              Alert.alert('Delete payment record?', 'This only removes the record; it does not move the due date back.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deletePayment(p.id) },
              ])
            }
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Body>{p.paidDate}</Body>
                <Body small muted>settles {p.dueDate}{p.method ? ` · ${p.method}` : ''}</Body>
              </View>
              <Metric size={15} color={t.colors.accent}>{formatCurrency(p.amount, p.currency)}</Metric>
            </Row>
          </Pressable>
        </Card>
      ))}

      {/* Notes */}
      <SectionHeader title="Attached notes vault" icon="note-text-outline" right={`${itemNotes.length} attached`} />
      {itemNotes.map((n) => (
        <Card key={n.id} onPress={() => navigation.navigate('NoteEditor', { noteId: n.id })}>
          <Body style={{ fontFamily: t.fonts.bodySemi }}>{n.title}</Body>
          <Body small muted numberOfLines={3}>{n.body}</Body>
          {n.tags?.length ? (
            <Row style={{ marginTop: 6, flexWrap: 'wrap' }} gap={6}>
              {n.tags.map((tag) => (
                <Badge key={tag} text={tag} />
              ))}
            </Row>
          ) : null}
          <Row style={{ marginTop: 8 }}>
            <Button style={{ flex: 1 }} compact kind="warning" icon="lightbulb-outline" title="Export Keep" onPress={() => exportToKeep(n, sub)} />
            <Button style={{ flex: 1 }} compact kind="secondary" icon="creation" title="Send to Gemini" onPress={() => sendToGemini(n, sub)} />
          </Row>
        </Card>
      ))}
      <Button compact kind="secondary" icon="plus" title="Attach new note" onPress={() => navigation.navigate('NoteEditor', { itemId: sub.id })} />
      {sub.notes ? (
        <Card>
          <Label>Inline notes</Label>
          <Body small muted>{sub.notes}</Body>
        </Card>
      ) : null}

      {/* Splits */}
      {sub.splits?.length ? (
        <Card>
          <SectionHeader title="Split breakdown" icon="account-multiple-outline" right={`${sub.splits.length + 1} people`} />
          {splitLines.map((l, i) => (
            <Row key={i} style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Body>{l.contactId ? contactName(l.contactId) : 'You'}</Body>
              <Metric size={15}>{money(l.amount)}</Metric>
            </Row>
          ))}
          <Button style={{ marginTop: 10 }} compact icon="share-variant-outline" title="Send split request" onPress={requestShares} />
        </Card>
      ) : null}

      {/* Calculator */}
      <SectionHeader title="Recurring splitter" icon="calculator-variant" />
      <Calculator
        compact
        initialValue={sub.cost}
        applyLabel="Set as amount"
        onApply={(v) =>
          Alert.alert('Update amount?', `Change ${sub.name} from ${money(sub.cost)} to ${money(v)}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Update', onPress: () => updateSubscription(sub.id, { cost: v }) },
          ])
        }
        onSplit={(v) => {
          if (!sub.splits?.length) {
            Alert.alert('No split set up', 'Edit this entry and tap contacts under "Assign contact / split payee" to share the cost.', [
              { text: 'OK', style: 'cancel' },
              { text: 'Edit entry', onPress: () => navigation.navigate('EditItem', { id: sub.id }) },
            ]);
            return;
          }
          const lines = splitCost(v, sub.splits);
          Alert.alert('Split result', lines.map((l) => `${l.contactId ? contactName(l.contactId) : 'You'}: ${formatNumber(l.amount)}`).join('\n'));
        }}
      />

      <Divider />
      <Row>
        {status !== 'cancelled' ? <Button style={{ flex: 1 }} compact kind="secondary" icon="cancel" title="Mark cancelled" onPress={() => setStatus('cancelled')} /> : null}
        <Button style={{ flex: 1 }} compact kind="danger" icon="delete-outline" title="Delete" onPress={remove} />
      </Row>
    </Screen>
  );
}
