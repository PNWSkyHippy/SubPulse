import { BillingCycle, ItemKind, ItemStatus, SplitShare, Subscription } from '../types';
import {
  addCycle,
  addCycles,
  computeNextRenewalDate,
  daysUntil,
  formatISODate,
  parseISODate,
} from './dateHelpers';

/**
 * Billing rules for every tracked item: what is due, what is overdue, how
 * far an overdue bill has escalated, and what recording a payment does.
 *
 * Two kinds of items:
 *  - auto-pay (card / bank debit): the charge happens on its own, so the
 *    stored date simply rolls forward and the item can never be "late".
 *  - manual-pay (rent by transfer, a utility you pay online...): the stored
 *    date is the current UNPAID due date. It does not move until a payment is
 *    recorded, so a missed bill turns overdue and escalates.
 */

export const DEFAULT_ESCALATION_DAYS = [1, 3, 7];

/** Kinds that are almost always card-debited; everything else defaults to manual pay. */
const AUTO_PAY_KINDS: ItemKind[] = ['subscription', 'magazine', 'membership'];

export function kindOf(sub: Subscription): ItemKind {
  return sub.kind ?? 'subscription';
}

export function statusOf(sub: Subscription): ItemStatus {
  return sub.status ?? 'active';
}

export function isAutoPay(sub: Subscription): boolean {
  if (typeof sub.autoPay === 'boolean') return sub.autoPay;
  return AUTO_PAY_KINDS.includes(kindOf(sub));
}

export function escalationDaysOf(sub: Subscription): number[] {
  const days = sub.escalationDays && sub.escalationDays.length > 0 ? sub.escalationDays : DEFAULT_ESCALATION_DAYS;
  return [...days].filter((d) => d > 0).sort((a, b) => a - b);
}

export type DueState =
  | 'inactive' // paused, cancelled or completed
  | 'scheduled' // due later than the reminder window
  | 'upcoming' // inside the reminder window
  | 'due-today'
  | 'overdue';

export interface DueInfo {
  state: DueState;
  /** The date the next (or currently unpaid) charge is due. */
  dueDate: Date;
  dueDateISO: string;
  /** Days until due; negative when overdue. */
  days: number;
  daysOverdue: number;
  /** 0 = not escalated, 1..n = how many escalation steps have been reached. */
  escalationLevel: number;
  /** Total number of unpaid cycles for an overdue manual-pay item (1 if only the current one). */
  unpaidCycles: number;
  /** Amount outstanding for overdue items (unpaidCycles x cost), otherwise the next charge. */
  amountDue: number;
}

export function getDueInfo(sub: Subscription, today: Date = new Date()): DueInfo {
  const status = statusOf(sub);
  const manual = !isAutoPay(sub);
  const dueDate = manual ? parseISODate(sub.nextRenewalDate) : computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle, today);
  const days = daysUntil(dueDate, today);
  const base = {
    dueDate,
    dueDateISO: formatISODate(dueDate),
    days,
    daysOverdue: 0,
    escalationLevel: 0,
    unpaidCycles: 0,
    amountDue: sub.cost,
  };

  if (status !== 'active') return { ...base, state: 'inactive' };

  if (days < 0) {
    // Only manual-pay items can reach here (auto-pay dates are rolled forward).
    const daysOverdue = -days;
    const escalationLevel = escalationDaysOf(sub).filter((d) => daysOverdue >= d).length;
    const unpaidCycles = countUnpaidCycles(sub, today);
    return {
      ...base,
      state: 'overdue',
      daysOverdue,
      escalationLevel,
      unpaidCycles,
      amountDue: Math.round(sub.cost * unpaidCycles * 100) / 100,
    };
  }
  if (days === 0) return { ...base, state: 'due-today', unpaidCycles: manual ? 1 : 0 };
  if (days <= sub.reminderDaysBefore) return { ...base, state: 'upcoming' };
  return { ...base, state: 'scheduled' };
}

/** For a manual-pay item: how many due dates (inclusive of the stored one) are on or before today. */
export function countUnpaidCycles(sub: Subscription, today: Date = new Date()): number {
  const anchor = parseISODate(sub.nextRenewalDate);
  if (daysUntil(anchor, today) > 0) return 0;
  if (sub.billingCycle === 'once') return 1;
  let n = 0;
  while (n < 1000 && daysUntil(addCycles(anchor, sub.billingCycle, n), today) <= 0) n++;
  return n;
}

export interface PaymentResult {
  /** Fields to write back onto the item. */
  updates: Partial<Subscription>;
  /** The due date this payment settled (ISO). */
  settledDueDate: string;
}

/**
 * What recording one payment does to an item. Paying settles exactly one
 * cycle: if three months of rent are overdue, one payment clears the oldest
 * and the next one is still overdue.
 */
export function applyPayment(sub: Subscription, paidDate: Date = new Date()): PaymentResult {
  const paidISO = formatISODate(paidDate);
  const settled = isAutoPay(sub)
    ? computeNextRenewalDate(sub.nextRenewalDate, sub.billingCycle, paidDate)
    : parseISODate(sub.nextRenewalDate);
  const settledDueDate = formatISODate(settled);

  if (sub.billingCycle === 'once') {
    return { settledDueDate, updates: { lastPaidDate: paidISO, status: 'completed' } };
  }
  return {
    settledDueDate,
    updates: { lastPaidDate: paidISO, nextRenewalDate: formatISODate(addCycle(settled, sub.billingCycle)) },
  };
}

/** Dates (ISO) at which overdue escalation reminders should fire for the current due date. */
export function escalationDates(sub: Subscription): string[] {
  if (isAutoPay(sub) || statusOf(sub) !== 'active') return [];
  const due = parseISODate(sub.nextRenewalDate);
  return escalationDaysOf(sub).map((d) => {
    const x = new Date(due.getTime());
    x.setUTCDate(x.getUTCDate() + d);
    return formatISODate(x);
  });
}

export function escalationLabel(level: number): string {
  switch (level) {
    case 0:
      return 'Overdue';
    case 1:
      return 'Stage 1 · Reminder';
    case 2:
      return 'Stage 2 · Escalated';
    default:
      return `Stage ${level} · Critical`;
  }
}

export interface ScheduledCharge {
  item: Subscription;
  dateISO: string;
  amount: number;
  currency: string;
}

/**
 * Every charge expected between today and today+days (inclusive), including
 * repeat occurrences (a weekly item appears ~4 times in 30 days) and unpaid
 * overdue amounts (dated today). Sorted by date.
 */
export function chargesInWindow(subs: Subscription[], days: number, today: Date = new Date()): ScheduledCharge[] {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
  const todayISO = formatISODate(today);
  const out: ScheduledCharge[] = [];

  for (const item of subs) {
    if (statusOf(item) !== 'active') continue;
    const info = getDueInfo(item, today);
    if (info.state === 'overdue') {
      out.push({ item, dateISO: todayISO, amount: info.amountDue, currency: item.currency });
    }
    const first = info.state === 'overdue' ? addCycles(parseISODate(item.nextRenewalDate), item.billingCycle, info.unpaidCycles) : info.dueDate;
    if (item.billingCycle === 'once') {
      if (info.state !== 'overdue' && first.getTime() <= end.getTime()) {
        out.push({ item, dateISO: formatISODate(first), amount: item.cost, currency: item.currency });
      }
      continue;
    }
    for (let n = 0; n < 400; n++) {
      const d = addCycles(first, item.billingCycle, n);
      if (d.getTime() > end.getTime()) break;
      out.push({ item, dateISO: formatISODate(d), amount: item.cost, currency: item.currency });
    }
  }
  return out.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.item.name.localeCompare(b.item.name));
}

export interface SplitLine {
  contactId: string | null; // null = the user's own share
  amount: number;
}

/** Splits a cost by share fractions; the user keeps whatever isn't assigned. Rounds to cents and puts any rounding remainder on the user. */
export function splitCost(cost: number, splits: SplitShare[] = []): SplitLine[] {
  const lines: SplitLine[] = splits
    .filter((s) => s.share > 0)
    .map((s) => ({ contactId: s.contactId, amount: Math.round(cost * s.share * 100) / 100 }));
  const assigned = lines.reduce((sum, l) => sum + l.amount, 0);
  const mine = Math.round((cost - assigned) * 100) / 100;
  return [{ contactId: null, amount: mine }, ...lines];
}

/** Even split among the user plus `contactIds`. */
export function evenSplits(contactIds: string[]): SplitShare[] {
  const share = 1 / (contactIds.length + 1);
  return contactIds.map((contactId) => ({ contactId, share }));
}

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 months',
  yearly: 'Yearly',
  once: 'One-time',
};

export const KIND_LABELS: Record<ItemKind, string> = {
  subscription: 'Subscription',
  lease: 'Lease / Rent',
  utility: 'Utility',
  magazine: 'Magazine',
  insurance: 'Insurance',
  loan: 'Loan',
  membership: 'Membership',
  'one-time': 'One-time fee',
  other: 'Other',
};
