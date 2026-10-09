import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Subscription } from '../types';
import { escalationDates, getDueInfo, isAutoPay, statusOf } from './billing';
import { formatCurrency } from './currency';
import { parseISODate } from './dateHelpers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const CHANNEL_REMINDERS = 'renewal-reminders';
export const CHANNEL_ESCALATIONS = 'payment-escalations';
export const CATEGORY_BILL = 'bill-actions';
export const ACTION_MARK_PAID = 'mark-paid';
export const ACTION_SNOOZE = 'snooze-1d';

/** Local hour (24h) reminders fire at. */
const REMINDER_HOUR = 9;

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Renewal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_ESCALATIONS, {
      name: 'Overdue payment escalations',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
    });
  }
  // Action buttons on bill notifications ("Mark paid" / "Snooze").
  await Notifications.setNotificationCategoryAsync(CATEGORY_BILL, [
    { identifier: ACTION_MARK_PAID, buttonTitle: 'Mark paid', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Remind tomorrow', options: { opensAppToForeground: false } },
  ]).catch(() => {});
  return finalStatus === 'granted';
}

/** Identifier prefix shared by every notification belonging to one item. */
const prefixFor = (itemId: string) => `item-${itemId}-`;
/** v1 identifier, still cancelled so upgrades don't leave a stale reminder behind. */
const legacyIdFor = (itemId: string) => `renewal-${itemId}`;

/** A local-time Date at REMINDER_HOUR on the given ISO day. */
function atReminderHour(isoDay: string): Date {
  const d = parseISODate(isoDay);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), REMINDER_HOUR, 0, 0, 0);
}

function shiftDays(isoDay: string, days: number): string {
  const d = parseISODate(isoDay);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function schedule(id: string, date: Date, title: string, body: string, channelId: string, itemId: string) {
  if (date.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { itemId }, categoryIdentifier: CATEGORY_BILL },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
  });
}

export async function cancelReminderNotification(itemId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(legacyIdFor(itemId)).catch(() => {});
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(prefixFor(itemId)))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

/**
 * (Re)schedules every notification for one item:
 *  - a reminder `reminderDaysBefore` days ahead,
 *  - a "due today" notice for manual-pay items,
 *  - overdue escalations at each escalation step (manual-pay only).
 * Recording a payment moves the due date, and rescheduling clears the old set.
 */
export async function scheduleReminderNotification(sub: Subscription): Promise<void> {
  await cancelReminderNotification(sub.id);
  if (statusOf(sub) !== 'active') return;

  const info = getDueInfo(sub);
  const due = info.dueDateISO;
  const money = formatCurrency(sub.cost, sub.currency);
  const p = prefixFor(sub.id);
  const manual = !isAutoPay(sub);

  if (sub.reminderDaysBefore > 0) {
    await schedule(
      `${p}reminder`,
      atReminderHour(shiftDays(due, -sub.reminderDaysBefore)),
      `${sub.name} ${manual ? 'is due' : 'renews'} soon`,
      `${money} ${manual ? 'due' : 'charges'} in ${sub.reminderDaysBefore} day${sub.reminderDaysBefore === 1 ? '' : 's'} (${due}).`,
      CHANNEL_REMINDERS,
      sub.id
    );
  }

  if (manual) {
    await schedule(`${p}due`, atReminderHour(due), `${sub.name} is due today`, `${money} due today. Tap "Mark paid" once it's sent.`, CHANNEL_REMINDERS, sub.id);
    const steps = escalationDates(sub);
    for (let i = 0; i < steps.length; i++) {
      const level = i + 1;
      await schedule(
        `${p}esc-${level}`,
        atReminderHour(steps[i]),
        `${level >= 3 ? 'CRITICAL: ' : ''}${sub.name} is overdue`,
        `${money} was due ${due}. Escalation stage ${level}${level >= 2 ? ' — late fees may apply' : ''}.`,
        CHANNEL_ESCALATIONS,
        sub.id
      );
    }
  }
}

/** One-off "remind me again tomorrow" for an item (snooze action). */
export async function snoozeItem(sub: Subscription): Promise<void> {
  const when = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    identifier: `${prefixFor(sub.id)}snooze-${when.getTime()}`,
    content: {
      title: `${sub.name} still needs attention`,
      body: `${formatCurrency(sub.cost, sub.currency)} — snoozed reminder.`,
      data: { itemId: sub.id },
      categoryIdentifier: CATEGORY_BILL,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ESCALATIONS },
  });
}
