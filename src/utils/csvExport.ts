import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Subscription } from '../types';
import { generateSubscriptionsCSV, parseSubscriptionsCSV, CSVImportResult } from './csv';
import { formatISODate, todayLocal } from './dateHelpers';

/** Writes subscriptions to a CSV file in the cache directory and opens the native share sheet. */
export async function exportSubscriptionsToCSV(subs: Subscription[]): Promise<void> {
  const csv = generateSubscriptionsCSV(subs);
  const file = new File(Paths.cache, `subscriptions-${formatISODate(todayLocal())}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Subscriptions' });
}

/**
 * Opens the system file picker, reads the selected file as text, and parses
 * it into subscription-shaped rows. Returns null if the user cancels the
 * picker (not an error). Accepts any file type, since Android file providers
 * frequently misreport CSV files under generic or inconsistent MIME types.
 */
export async function pickAndParseSubscriptionsCSV(): Promise<CSVImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const file = new File(result.assets[0].uri);
  const text = await file.text();
  return parseSubscriptionsCSV(text);
}
