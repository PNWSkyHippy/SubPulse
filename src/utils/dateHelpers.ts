import { BillingCycle, Subscription, MonthlySpendSummary } from '../types';

/** Parse an ISO 'yyyy-mm-dd' date string as a UTC midnight Date, avoiding local-timezone drift. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convert a per-cycle cost into an equivalent average monthly cost. */
export function normalizeToMonthlyCost(cost: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':
      return (cost * 52) / 12;
    case 'monthly':
      return cost;
    case 'yearly':
      return cost / 12;
    default:
      throw new Error(`Unknown billing cycle: ${cycle}`);
  }
}

function addCycle(date: Date, cycle: BillingCycle): Date {
  const next = new Date(date.getTime());
  switch (cycle) {
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

/**
 * Roll a (possibly stale/past) renewal date forward to the next occurrence
 * on or after `today`. Handles the case where the app hasn't been opened
 * in a while and a stored renewal date has already passed.
 */
export function computeNextRenewalDate(
  storedRenewalDateISO: string,
  cycle: BillingCycle,
  today: Date = new Date()
): Date {
  let renewal = parseISODate(storedRenewalDateISO);
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Safety cap to avoid infinite loops on malformed data.
  let iterations = 0;
  while (renewal.getTime() < todayUTC.getTime() && iterations < 1000) {
    renewal = addCycle(renewal, cycle);
    iterations++;
  }
  return renewal;
}

export function daysUntil(targetDate: Date, today: Date = new Date()): number {
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const targetUTC = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  return Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));
}

/** Whether a reminder notification should fire today for this subscription. */
export function shouldFireReminder(sub: Subscription, today: Date = new Date()): boolean {
  const nextRenewal = computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle, today);
  const days = daysUntil(nextRenewal, today);
  return days >= 0 && days <= sub.reminderDaysBefore;
}

export function summarizeMonthlySpend(subs: Subscription[]): MonthlySpendSummary {
  const byCategory: Record<string, number> = {};
  const byCurrency: Record<string, number> = {};
  let totalMonthly = 0;

  for (const sub of subs) {
    const monthly = normalizeToMonthlyCost(sub.cost, sub.billingCycle);
    totalMonthly += monthly;
    const cat = sub.category?.trim() || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + monthly;
    byCurrency[sub.currency] = (byCurrency[sub.currency] || 0) + monthly;
  }

  // Round to cents to avoid floating point noise in the UI.
  totalMonthly = Math.round(totalMonthly * 100) / 100;
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = Math.round(byCategory[cat] * 100) / 100;
  }
  for (const cur of Object.keys(byCurrency)) {
    byCurrency[cur] = Math.round(byCurrency[cur] * 100) / 100;
  }

  return { totalMonthly, byCategory, byCurrency, subscriptionCount: subs.length };
}
