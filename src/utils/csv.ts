import { Subscription } from '../types';
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
