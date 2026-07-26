import {
  normalizeToMonthlyCost,
  computeNextRenewalDate,
  daysUntil,
  shouldFireReminder,
  summarizeMonthlySpend,
  parseISODate,
  formatISODate,
  getMonthGrid,
  groupSubscriptionsByRenewalDate,
} from '../dateHelpers';
import { Subscription } from '../../types';

const baseSub: Omit<Subscription, 'id' | 'name' | 'cost' | 'billingCycle' | 'nextRenewalDate' | 'reminderDaysBefore'> = {
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  ownerId: 'test-user',
};

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: '1',
    name: 'Test Sub',
    cost: 9.99,
    billingCycle: 'monthly',
    nextRenewalDate: '2026-08-01',
    reminderDaysBefore: 3,
    ...baseSub,
    ...overrides,
  };
}

describe('normalizeToMonthlyCost', () => {
  test('monthly cost is unchanged', () => {
    expect(normalizeToMonthlyCost(15, 'monthly')).toBeCloseTo(15);
  });
  test('yearly cost divides by 12', () => {
    expect(normalizeToMonthlyCost(120, 'yearly')).toBeCloseTo(10);
  });
  test('weekly cost uses 52/12 weeks per month', () => {
    expect(normalizeToMonthlyCost(10, 'weekly')).toBeCloseTo((10 * 52) / 12);
  });
  test('quarterly cost divides by 3', () => {
    expect(normalizeToMonthlyCost(30, 'quarterly')).toBeCloseTo(10);
  });
});

describe('computeNextRenewalDate', () => {
  test('returns the same date if it is still in the future', () => {
    const today = parseISODate('2026-07-24');
    const result = computeNextRenewalDate('2026-08-01', 'monthly', today);
    expect(formatISODate(result)).toBe('2026-08-01');
  });

  test('rolls a stale monthly date forward past today', () => {
    const today = parseISODate('2026-07-24');
    // Renewal date is 3 months stale.
    const result = computeNextRenewalDate('2026-04-15', 'monthly', today);
    expect(formatISODate(result)).toBe('2026-08-15');
  });

  test('rolls a stale yearly date forward by full years', () => {
    const today = parseISODate('2026-07-24');
    const result = computeNextRenewalDate('2024-03-01', 'yearly', today);
    expect(formatISODate(result)).toBe('2027-03-01');
  });

  test('rolls a stale weekly date forward by weeks', () => {
    const today = parseISODate('2026-07-24');
    const result = computeNextRenewalDate('2026-07-01', 'weekly', today);
    // 2026-07-01 + 7*4 = 2026-07-29 is the first occurrence >= today
    expect(formatISODate(result)).toBe('2026-07-29');
  });

  test('rolls a stale quarterly date forward by 3-month increments', () => {
    const today = parseISODate('2026-07-24');
    const result = computeNextRenewalDate('2026-01-01', 'quarterly', today);
    // Jan 1 -> Apr 1 -> Jul 1 (still stale) -> Oct 1
    expect(formatISODate(result)).toBe('2026-10-01');
  });
});

describe('daysUntil', () => {
  test('computes positive day difference', () => {
    const today = parseISODate('2026-07-24');
    const target = parseISODate('2026-07-27');
    expect(daysUntil(target, today)).toBe(3);
  });
  test('computes zero for same day', () => {
    const today = parseISODate('2026-07-24');
    expect(daysUntil(today, today)).toBe(0);
  });
});

describe('shouldFireReminder', () => {
  test('fires when within reminder window', () => {
    const today = parseISODate('2026-07-30');
    const sub = makeSub({ nextRenewalDate: '2026-08-01', reminderDaysBefore: 3 });
    expect(shouldFireReminder(sub, today)).toBe(true);
  });

  test('does not fire when outside reminder window', () => {
    const today = parseISODate('2026-07-20');
    const sub = makeSub({ nextRenewalDate: '2026-08-01', reminderDaysBefore: 3 });
    expect(shouldFireReminder(sub, today)).toBe(false);
  });

  test('does not fire the day after renewal (handled by rollover instead)', () => {
    const today = parseISODate('2026-08-02');
    const sub = makeSub({ nextRenewalDate: '2026-08-01', reminderDaysBefore: 3, billingCycle: 'monthly' });
    // renewal rolls forward to 2026-09-01, which is 30 days away — outside the 3-day window.
    expect(shouldFireReminder(sub, today)).toBe(false);
  });
});

describe('summarizeMonthlySpend', () => {
  test('sums mixed billing cycles and groups by category', () => {
    const subs: Subscription[] = [
      makeSub({ id: '1', name: 'Netflix', cost: 15.49, billingCycle: 'monthly', category: 'Streaming' }),
      makeSub({ id: '2', name: 'Spotify', cost: 11.99, billingCycle: 'monthly', category: 'Streaming' }),
      makeSub({ id: '3', name: 'Domain', cost: 12, billingCycle: 'yearly', category: 'Software' }),
    ];
    const summary = summarizeMonthlySpend(subs);
    expect(summary.subscriptionCount).toBe(3);
    expect(summary.byCategory['Streaming']).toBeCloseTo(27.48);
    expect(summary.byCategory['Software']).toBeCloseTo(1);
    expect(summary.totalMonthly).toBeCloseTo(28.48);
  });

  test('defaults missing category to Uncategorized', () => {
    const subs: Subscription[] = [makeSub({ id: '1', category: undefined })];
    const summary = summarizeMonthlySpend(subs);
    expect(summary.byCategory['Uncategorized']).toBeDefined();
  });

  test('groups totals by currency', () => {
    const subs: Subscription[] = [
      makeSub({ id: '1', cost: 10, currency: 'USD' }),
      makeSub({ id: '2', cost: 20, currency: 'USD' }),
      makeSub({ id: '3', cost: 5, currency: 'EUR' }),
    ];
    const summary = summarizeMonthlySpend(subs);
    expect(summary.byCurrency['USD']).toBeCloseTo(30);
    expect(summary.byCurrency['EUR']).toBeCloseTo(5);
  });
});

describe('getMonthGrid', () => {
  test('July 2026 starts on Wednesday and has 31 days, laid out in 5 weeks', () => {
    const grid = getMonthGrid(2026, 6); // month is 0-indexed: 6 = July
    expect(grid[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(grid.length).toBe(5);
    const lastWeek = grid[grid.length - 1];
    expect(lastWeek).toEqual([26, 27, 28, 29, 30, 31, null]);
  });

  test('February 2026 (non-leap year) has 28 days', () => {
    const grid = getMonthGrid(2026, 1); // February
    const allDays = grid.flat().filter((d) => d !== null);
    expect(Math.max(...(allDays as number[]))).toBe(28);
  });

  test('February 2028 (leap year) has 29 days', () => {
    const grid = getMonthGrid(2028, 1);
    const allDays = grid.flat().filter((d) => d !== null);
    expect(Math.max(...(allDays as number[]))).toBe(29);
  });
});

describe('groupSubscriptionsByRenewalDate', () => {
  test('groups subscriptions under their computed next renewal date', () => {
    const today = parseISODate('2026-07-24');
    const subs: Subscription[] = [
      makeSub({ id: '1', name: 'Netflix', nextRenewalDate: '2026-07-30', billingCycle: 'monthly' }),
      makeSub({ id: '2', name: 'Spotify', nextRenewalDate: '2026-07-30', billingCycle: 'monthly' }),
      makeSub({ id: '3', name: 'Domain', nextRenewalDate: '2026-08-15', billingCycle: 'yearly' }),
    ];
    const groups = groupSubscriptionsByRenewalDate(subs, today);
    expect(groups['2026-07-30']?.map((s) => s.name).sort()).toEqual(['Netflix', 'Spotify']);
    expect(groups['2026-08-15']?.map((s) => s.name)).toEqual(['Domain']);
  });

  test('rolls a stale renewal date forward before grouping', () => {
    const today = parseISODate('2026-08-05');
    const subs: Subscription[] = [makeSub({ id: '1', nextRenewalDate: '2026-07-01', billingCycle: 'monthly' })];
    const groups = groupSubscriptionsByRenewalDate(subs, today);
    // July 1 and Aug 1 have both already passed relative to Aug 5, so it rolls to Sept 1.
    expect(groups['2026-09-01']).toBeDefined();
    expect(groups['2026-07-01']).toBeUndefined();
  });
});
