import { BillingCycle, Subscription } from '../types';
import { computeNextRenewalDate, formatISODate } from './dateHelpers';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateSubscriptionsCSV(subs: Subscription[]): string {
  const headers = ['Name', 'Cost', 'Currency', 'Billing Cycle', 'Next Renewal', 'Category', 'Notes'];
  const rows = subs.map((sub) => {
    const nextRenewal = formatISODate(computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle));
    return [
      sub.name,
      sub.cost.toString(),
      sub.currency,
      sub.billingCycle,
      nextRenewal,
      sub.category ?? '',
      sub.notes ?? '',
    ]
      .map(escapeCsvField)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parses raw CSV text into rows of string fields, respecting RFC4180-style
 * quoting: quoted fields may contain commas, newlines, and escaped ("")
 * double quotes. This is a full-text parser (not line-by-line split) so a
 * real newline inside a quoted field doesn't break row boundaries.
 */
export function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Normalize line endings so \r\n doesn't leak stray \r characters into fields.
  const input = text.replace(/\r\n/g, '\n');

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += char;
    i++;
  }
  // Final field/row (files may or may not end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export interface ParsedSubscriptionInput {
  name: string;
  cost: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string;
  reminderDaysBefore: number;
  category?: string;
  notes?: string;
}

export interface CSVImportResult {
  rows: ParsedSubscriptionInput[];
  errors: string[];
}

const VALID_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'yearly'];
const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  cost: 'cost',
  currency: 'currency',
  'billing cycle': 'billingCycle',
  billingcycle: 'billingCycle',
  'next renewal': 'nextRenewalDate',
  'next renewal date': 'nextRenewalDate',
  category: 'category',
  notes: 'notes',
};

/**
 * Parses CSV text (as produced by generateSubscriptionsCSV, or hand-edited
 * in a spreadsheet) back into subscription-shaped data. Maps columns by
 * header name rather than fixed position, so reordered columns still work.
 * Invalid rows are collected as errors rather than aborting the whole import,
 * so one bad row doesn't block restoring everything else.
 */
export function parseSubscriptionsCSV(text: string): CSVImportResult {
  const table = parseCSVText(text);
  const errors: string[] = [];

  if (table.length === 0) {
    return { rows: [], errors: ['File is empty.'] };
  }

  const headerRow = table[0].map((h) => h.trim().toLowerCase());
  const columnIndex: Partial<Record<string, number>> = {};
  headerRow.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key) columnIndex[key] = idx;
  });

  if (columnIndex.name === undefined || columnIndex.cost === undefined) {
    errors.push('CSV must have at least "Name" and "Cost" columns.');
    return { rows: [], errors };
  }

  const rows: ParsedSubscriptionInput[] = [];

  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    const rowNum = i + 1; // 1-based, matches what a spreadsheet app would show
    const get = (key: string): string => {
      const idx = columnIndex[key];
      return idx !== undefined ? (raw[idx] ?? '').trim() : '';
    };

    const name = get('name');
    if (!name) {
      errors.push(`Row ${rowNum}: missing name, skipped.`);
      continue;
    }

    const costNum = parseFloat(get('cost'));
    if (isNaN(costNum) || costNum < 0) {
      errors.push(`Row ${rowNum} (${name}): invalid cost, skipped.`);
      continue;
    }

    const cycleRaw = get('billingCycle').toLowerCase() || 'monthly';
    const billingCycle = VALID_CYCLES.includes(cycleRaw as BillingCycle) ? (cycleRaw as BillingCycle) : 'monthly';
    if (!VALID_CYCLES.includes(cycleRaw as BillingCycle) && get('billingCycle')) {
      errors.push(`Row ${rowNum} (${name}): unknown billing cycle "${cycleRaw}", defaulted to monthly.`);
    }

    const dateRaw = get('nextRenewalDate');
    const nextRenewalDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : formatISODate(new Date());
    if (dateRaw && nextRenewalDate !== dateRaw) {
      errors.push(`Row ${rowNum} (${name}): invalid date "${dateRaw}", defaulted to today.`);
    }

    rows.push({
      name,
      cost: costNum,
      currency: get('currency') || 'USD',
      billingCycle,
      nextRenewalDate,
      reminderDaysBefore: 3,
      category: get('category') || undefined,
      notes: get('notes') || undefined,
    });
  }

  return { rows, errors };
}
