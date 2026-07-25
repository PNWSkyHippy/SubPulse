import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Subscription } from '../types';
import { computeNextRenewalDate } from './dateHelpers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('renewal-reminders', {
      name: 'Renewal reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return finalStatus === 'granted';
}

/** Notification identifiers are keyed by subscription id so we can cancel/replace them. */
function notificationIdFor(subscriptionId: string): string {
  return `renewal-${subscriptionId}`;
}

export async function scheduleReminderNotification(sub: Subscription): Promise<void> {
  const id = notificationIdFor(sub.id);
  // Clear any existing scheduled notification for this subscription first,
  // so edits (e.g. changing reminderDaysBefore) don't leave stale duplicates.
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  const nextRenewal = computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle);
  const triggerDate = new Date(nextRenewal.getTime());
  triggerDate.setUTCDate(triggerDate.getUTCDate() - sub.reminderDaysBefore);
  triggerDate.setUTCHours(15, 0, 0, 0); // 9am Pacific-ish default; user's local 9am handled by device tz in a full build

  if (triggerDate.getTime() <= Date.now()) return; // don't schedule in the past

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `${sub.name} renews soon`,
      body: `$${sub.cost.toFixed(2)} charges in ${sub.reminderDaysBefore} day${sub.reminderDaysBefore === 1 ? '' : 's'}.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });
}

export async function cancelReminderNotification(subscriptionId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationIdFor(subscriptionId)).catch(() => {});
}

/** Fires a notification ~10 seconds from now, for verifying that permissions
 * and delivery actually work, independent of renewal-date scheduling logic. */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test notification',
      body: 'If you see this, local notifications are working correctly.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: false },
  });
}
