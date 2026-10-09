import { Subscription } from '../../types';
import {
  applyPayment,
  chargesInWindow,
  countUnpaidCycles,
  escalationDates,
  evenSplits,
  getDueInfo,
  isAutoPay,
  splitCost,
} from '../billing';
import { computeNextRenewalDate, formatISODate, normalizeToMonthlyCost, summarizeMonthlySpend } from '../dateHelpers';

const today = new Date(Date.UTC(2026, 9, 8)); // 2026-10-08

function make(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'x',
    name: 'Item',
    cost: 100,
    currency: 'USD',
    billingCycle: 'monthly',
    nextRenewalDate: '2026-10-20',
    reminderDaysBefore: 3,
    createdAt: '2026-01-01T00:00:00Z',
    ownerId: 'u',
    ...overrides,
  };
}

describe('auto-pay defaults', () => {
  test('legacy documents (no kind) are auto-pay subscriptions', () => {
    expect(isAutoPay(make())).toBe(true);
  });
  test('leases and utilities default to manual pay', () => {
    expect(isAutoPay(make({ kind: 'lease' }))).toBe(false);
    expect(isAutoPay(make({ kind: 'utility' }))).toBe(false);
  });
  test('explicit autoPay wins over kind', () => {
    expect(isAutoPay(make({ kind: 'lease', autoPay: true }))).toBe(true);
  });
});

describe('getDueInfo', () => {
  test('auto-pay item with a past date rolls forward and is never overdue', () => {
    const info = getDueInfo(make({ nextRenewalDate: '2026-06-15' }), today);
    expect(info.state).not.toBe('overdue');
    expect(info.dueDateISO).toBe('2026-10-15');
  });

  test('upcoming inside reminder window', () => {
    expect(getDueInfo(make({ nextRenewalDate: '2026-10-10' }), today).state).toBe('upcoming');
    expect(getDueInfo(make({ nextRenewalDate: '2026-10-30' }), today).state).toBe('scheduled');
    expect(getDueInfo(make({ nextRenewalDate: '2026-10-08' }), today).state).toBe('due-today');
  });

  test('manual-pay item stays on its due date and escalates', () => {
    const lease = make({ kind: 'lease', nextRenewalDate: '2026-10-04' }); // 4 days late
    const info = getDueInfo(lease, today);
    expect(info.state).toBe('overdue');
    expect(info.daysOverdue).toBe(4);
    expect(info.escalationLevel).toBe(2); // passed day 1 and day 3, not day 7
    expect(info.unpaidCycles).toBe(1);
    expect(info.amountDue).toBe(100);
  });

  test('several missed cycles accumulate', () => {
    const lease = make({ kind: 'lease', nextRenewalDate: '2026-08-01' });
    const info = getDueInfo(lease, today);
    expect(info.unpaidCycles).toBe(3); // Aug 1, Sep 1, Oct 1
    expect(info.amountDue).toBe(300);
    expect(info.escalationLevel).toBe(3);
  });

  test('paused / cancelled items are inactive', () => {
    expect(getDueInfo(make({ status: 'paused' }), today).state).toBe('inactive');
    expect(getDueInfo(make({ status: 'cancelled', kind: 'lease', nextRenewalDate: '2026-01-01' }), today).state).toBe('inactive');
  });

  test('custom escalation days', () => {
    const info = getDueInfo(make({ kind: 'utility', nextRenewalDate: '2026-10-06', escalationDays: [2, 10] }), today);
    expect(info.escalationLevel).toBe(1);
  });
});

describe('applyPayment', () => {
  test('manual pay settles the oldest unpaid cycle only', () => {
    const lease = make({ kind: 'lease', nextRenewalDate: '2026-08-01' });
    const { updates, settledDueDate } = applyPayment(lease, today);
    expect(settledDueDate).toBe('2026-08-01');
    expect(updates.nextRenewalDate).toBe('2026-09-01');
    expect(updates.lastPaidDate).toBe('2026-10-08');
  });

  test('auto-pay payment advances past the upcoming charge', () => {
    const { updates, settledDueDate } = applyPayment(make({ nextRenewalDate: '2026-06-15' }), today);
    expect(settledDueDate).toBe('2026-10-15');
    expect(updates.nextRenewalDate).toBe('2026-11-15');
  });

  test('one-time fee completes', () => {
    const { updates } = applyPayment(make({ billingCycle: 'once', kind: 'one-time', nextRenewalDate: '2026-10-01' }), today);
    expect(updates.status).toBe('completed');
    expect(updates.nextRenewalDate).toBeUndefined();
  });
});

describe('month-end anchoring', () => {
  test('a bill due on the 31st does not drift after February', () => {
    const d = computeNextRenewalDate('2026-01-31', 'monthly', new Date(Date.UTC(2026, 2, 2)));
    expect(formatISODate(d)).toBe('2026-03-31');
    const feb = computeNextRenewalDate('2026-01-31', 'monthly', new Date(Date.UTC(2026, 1, 2)));
    expect(formatISODate(feb)).toBe('2026-02-28');
  });
  test('one-time dates never roll', () => {
    expect(formatISODate(computeNextRenewalDate('2026-01-05', 'once', today))).toBe('2026-01-05');
  });
});

describe('new cycles', () => {
  test('normalizes biweekly, semiannual and one-time', () => {
    expect(normalizeToMonthlyCost(100, 'biweekly')).toBeCloseTo(216.67, 2);
    expect(normalizeToMonthlyCost(600, 'semiannual')).toBe(100);
    expect(normalizeToMonthlyCost(500, 'once')).toBe(0);
  });
  test('summary ignores inactive items', () => {
    const s = summarizeMonthlySpend([make({ cost: 10 }), make({ id: 'y', cost: 50, status: 'cancelled' })]);
    expect(s.totalMonthly).toBe(10);
    expect(s.subscriptionCount).toBe(1);
  });
});

describe('countUnpaidCycles / escalationDates', () => {
  test('future due date has nothing unpaid', () => {
    expect(countUnpaidCycles(make({ kind: 'lease', nextRenewalDate: '2026-11-01' }), today)).toBe(0);
  });
  test('escalation dates offset from due date; none for auto-pay', () => {
    expect(escalationDates(make({ kind: 'lease', nextRenewalDate: '2026-10-01' }))).toEqual(['2026-10-02', '2026-10-04', '2026-10-08']);
    expect(escalationDates(make())).toEqual([]);
  });
});

describe('chargesInWindow', () => {
  test('includes repeat weekly charges, overdue amounts and excludes inactive', () => {
    const items = [
      make({ id: 'w', name: 'Weekly', billingCycle: 'weekly', cost: 10, nextRenewalDate: '2026-10-09' }),
      make({ id: 'l', name: 'Lease', kind: 'lease', cost: 1000, nextRenewalDate: '2026-10-01' }),
      make({ id: 'c', name: 'Old', status: 'cancelled', nextRenewalDate: '2026-10-10' }),
    ];
    const charges = chargesInWindow(items, 30, today);
    expect(charges.filter((c) => c.item.id === 'w').map((c) => c.dateISO)).toEqual(['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
    const lease = charges.filter((c) => c.item.id === 'l');
    expect(lease[0]).toMatchObject({ dateISO: '2026-10-08', amount: 1000 }); // overdue, due now
    expect(lease[1].dateISO).toBe('2026-11-01'); // next cycle
    expect(charges.some((c) => c.item.id === 'c')).toBe(false);
  });
});

describe('splits', () => {
  test('even split puts rounding remainder on the user', () => {
    const lines = splitCost(100, evenSplits(['a', 'b']));
    expect(lines).toEqual([
      { contactId: null, amount: 33.34 },
      { contactId: 'a', amount: 33.33 },
      { contactId: 'b', amount: 33.33 },
    ]);
  });
});

describe('todayLocal', () => {
  test('uses the local calendar day, not the UTC day', () => {
    const { todayLocal } = require('../dateHelpers');
    // 2026-10-08 20:30 local time is 2026-10-09 in UTC for US time zones; we must keep the 8th.
    const evening = new Date(2026, 9, 8, 20, 30);
    expect(todayLocal(evening).toISOString().slice(0, 10)).toBe('2026-10-08');
    const morning = new Date(2026, 9, 8, 0, 5);
    expect(todayLocal(morning).toISOString().slice(0, 10)).toBe('2026-10-08');
  });
});
