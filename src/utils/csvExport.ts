import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Subscription } from '../types';
import { generateSubscriptionsCSV } from './csv';
import { formatISODate } from './dateHelpers';

/** Writes subscriptions to a CSV file in the cache directory and opens the native share sheet. */
export async function exportSubscriptionsToCSV(subs: Subscription[]): Promise<void> {
  const csv = generateSubscriptionsCSV(subs);
  const file = new File(Paths.cache, `subscriptions-${formatISODate(new Date())}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Subscriptions' });
}
