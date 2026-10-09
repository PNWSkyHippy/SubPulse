import { ALL_BILLING_CYCLES, ALL_ITEM_KINDS, BillingCycle, ItemKind, ItemStatus, Subscription } from '../types';
import { computeNextRenewalDate, formatISODate, todayLocal } from './dateHelpers';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateSubscriptionsCSV(subs: Subscription[]): string {
  const headers = [
    'Name', 'Cost', 'Currency', 'Billing Cycle', 'Next Renewal', 'Category', 'Notes',
    'Alt Weekly Price', 'Alt Monthly Price', 'Alt Quarterly Price', 'Alt Yearly Price',
    'Kind', 'Status', 'Auto Pay', 'Reminder Days', 'Catalog Id', 'Last Paid',
  ];
  const rows = subs.map((sub) => {
    // Manual-pay items keep their unpaid due date (rolling it would hide an overdue bill);
    // auto-pay items export their upcoming charge date.
    const manual = sub.autoPay === false || (sub.autoPay === undefined && sub.kind !== undefined && !['subscription', 'magazine', 'membership'].includes(sub.kind));
    const nextRenewal = manual ? sub.nextRenewalDate : formatISODate(computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle));
    return [
      sub.name,
      sub.cost.toString(),
      sub.currency,
      sub.billingCycle,
      nextRenewal,
      sub.category ?? '',
      sub.notes ?? '',
      sub.alternatePrices?.weekly?.toString() ?? '',
      sub.alternatePrices?.monthly?.toString() ?? '',
      sub.alternatePrices?.quarterly?.toString() ?? '',
      sub.alternatePrices?.yearly?.toString() ?? '',
      sub.kind ?? '',
      sub.status ?? '',
      sub.autoPay === undefined ? '' : sub.autoPay ? 'yes' : 'no',
      String(sub.reminderDaysBefore ?? ''),
      sub.catalogId ?? '',
      sub.lastPaidDate ?? '',
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
  alternatePrices?: Partial<Record<BillingCycle, number>>;
  kind?: ItemKind;
  status?: ItemStatus;
  autoPay?: boolean;
  catalogId?: string;
  lastPaidDate?: string;
}

export interface CSVImportResult {
  rows: ParsedSubscriptionInput[];
  errors: string[];
}

const VALID_CYCLES: BillingCycle[] = ALL_BILLING_CYCLES;
const CYCLE_ALIASES: Record<string, BillingCycle> = {
  annual: 'yearly',
  annually: 'yearly',
  year: 'yearly',
  month: 'monthly',
  week: 'weekly',
  'bi-weekly': 'biweekly',
  fortnightly: 'biweekly',
  'semi-annual': 'semiannual',
  'semi-annually': 'semiannual',
  'one-time': 'once',
  onetime: 'once',
  'one time': 'once',
};
const VALID_STATUSES: ItemStatus[] = ['active', 'paused', 'cancelled', 'completed'];
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
  'alt weekly price': 'altWeekly',
  'alt monthly price': 'altMonthly',
  'alt quarterly price': 'altQuarterly',
  'alt yearly price': 'altYearly',
  amount: 'cost',
  price: 'cost',
  frequency: 'billingCycle',
  cycle: 'billingCycle',
  'due date': 'nextRenewalDate',
  kind: 'kind',
  type: 'kind',
  status: 'status',
  'auto pay': 'autoPay',
  autopay: 'autoPay',
  'reminder days': 'reminderDays',
  'catalog id': 'catalogId',
  'last paid': 'lastPaidDate',
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

    const costNum = parseFloat(get('cost').replace(/[$€£¥,\s]/g, ''));
    if (isNaN(costNum) || costNum < 0) {
      errors.push(`Row ${rowNum} (${name}): invalid cost, skipped.`);
      continue;
    }

    const cycleIn = get('billingCycle').toLowerCase() || 'monthly';
    const cycleRaw = CYCLE_ALIASES[cycleIn] ?? cycleIn;
    const billingCycle = VALID_CYCLES.includes(cycleRaw as BillingCycle) ? (cycleRaw as BillingCycle) : 'monthly';
    if (!VALID_CYCLES.includes(cycleRaw as BillingCycle) && get('billingCycle')) {
      errors.push(`Row ${rowNum} (${name}): unknown billing cycle "${cycleRaw}", defaulted to monthly.`);
    }

    const dateRaw = get('nextRenewalDate');
    const nextRenewalDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : formatISODate(todayLocal());
    if (dateRaw && nextRenewalDate !== dateRaw) {
      errors.push(`Row ${rowNum} (${name}): invalid date "${dateRaw}", defaulted to today.`);
    }

    const altPrices: Partial<Record<BillingCycle, number>> = {};
    const altColumns: [string, BillingCycle][] = [
      ['altWeekly', 'weekly'],
      ['altMonthly', 'monthly'],
      ['altQuarterly', 'quarterly'],
      ['altYearly', 'yearly'],
    ];
    for (const [column, altCycle] of altColumns) {
      const raw = get(column);
      if (!raw) continue;
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0) {
        errors.push(`Row ${rowNum} (${name}): invalid alternate ${altCycle} price "${raw}", ignored.`);
        continue;
      }
      altPrices[altCycle] = num;
    }

    const kindRaw = get('kind').toLowerCase();
    const kind = ALL_ITEM_KINDS.includes(kindRaw as ItemKind) ? (kindRaw as ItemKind) : undefined;
    const statusRaw = get('status').toLowerCase();
    const status = VALID_STATUSES.includes(statusRaw as ItemStatus) ? (statusRaw as ItemStatus) : undefined;
    const autoPayRaw = get('autoPay').toLowerCase();
    const autoPay = ['yes', 'true', '1', 'y'].includes(autoPayRaw) ? true : ['no', 'false', '0', 'n'].includes(autoPayRaw) ? false : undefined;
    const reminderNum = parseInt(get('reminderDays'), 10);
    const lastPaid = get('lastPaidDate');

    rows.push({
      name,
      cost: costNum,
      currency: (get('currency') || 'USD').toUpperCase(),
      billingCycle,
      nextRenewalDate,
      reminderDaysBefore: Number.isFinite(reminderNum) && reminderNum >= 0 ? reminderNum : 3,
      kind,
      status,
      autoPay,
      catalogId: get('catalogId') || undefined,
      lastPaidDate: /^\d{4}-\d{2}-\d{2}$/.test(lastPaid) ? lastPaid : undefined,
      category: get('category') || undefined,
      notes: get('notes') || undefined,
      alternatePrices: Object.keys(altPrices).length > 0 ? altPrices : undefined,
    });
  }

  return { rows, errors };
}
