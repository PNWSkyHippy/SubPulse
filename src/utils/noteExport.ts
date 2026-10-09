import { Platform, Share } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { Note, Subscription } from '../types';
import { formatCurrency } from './currency';

/**
 * Exporting notes to Google Keep and Gemini.
 *
 * Neither Keep nor the Gemini app offers a public API for personal accounts,
 * so export goes through Android's share mechanism: an ACTION_SEND intent
 * targeted at the app's package. If that app isn't installed (or on iOS), we
 * fall back to the system share sheet where the user can pick it.
 */
export const KEEP_PACKAGE = 'com.google.android.keep';
export const GEMINI_PACKAGE = 'com.google.android.apps.bard';

export function formatNoteText(note: Pick<Note, 'title' | 'body' | 'tags'>, item?: Subscription): string {
  const lines = [note.title.trim()];
  if (item) {
    lines.push(`${item.name} · ${formatCurrency(item.cost, item.currency)} ${item.billingCycle}${item.nextRenewalDate ? ` · next ${item.nextRenewalDate}` : ''}`);
  }
  lines.push('', note.body.trim());
  if (note.tags?.length) lines.push('', note.tags.map((t) => `#${t.replace(/\s+/g, '_')}`).join(' '));
  lines.push('', '— exported from SubPulse');
  return lines.join('\n');
}

export function geminiPrompt(note: Pick<Note, 'title' | 'body' | 'tags'>, item?: Subscription): string {
  return `Summarize this note about a recurring bill and list any action items or deadlines:\n\n${formatNoteText(note, item)}`;
}

async function sendToPackage(pkg: string, title: string, text: string): Promise<'app' | 'sheet'> {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        type: 'text/plain',
        packageName: pkg,
        extra: { 'android.intent.extra.TEXT': text, 'android.intent.extra.SUBJECT': title, 'android.intent.extra.TITLE': title },
      });
      return 'app';
    } catch {
      // app not installed or rejected the intent -> generic share sheet
    }
  }
  await Share.share({ title, message: text });
  return 'sheet';
}

export function exportToKeep(note: Pick<Note, 'title' | 'body' | 'tags'>, item?: Subscription) {
  return sendToPackage(KEEP_PACKAGE, note.title, formatNoteText(note, item));
}

export function sendToGemini(note: Pick<Note, 'title' | 'body' | 'tags'>, item?: Subscription) {
  return sendToPackage(GEMINI_PACKAGE, note.title, geminiPrompt(note, item));
}
