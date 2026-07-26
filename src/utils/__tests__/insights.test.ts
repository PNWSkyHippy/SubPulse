import { findDuplicateSubscriptions, findYearlySavingsCandidates } from '../insights';
import { Subscription } from '../../types';

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: '1',
    name: 'Test Sub',
    cost: 9.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextRenewalDate: '2026-08-01',
    reminderDaysBefore: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    ownerId: 'test-user',
    ...overrides,
  };
}

describe('findDuplicateSubscriptions', () => {
  test('flags subscriptions with the exact same name (case-insensitive)', () => {
    const subs = [
      makeSub({ id: '1', name: 'Netflix' }),
      makeSub({ id: '2', name: 'netflix' }),
      makeSub({ id: '3', name: 'Spotify' }),
    ];
    const dupes = findDuplicateSubscriptions(subs);
    expect(dupes.length).toBe(1);
    expect(dupes[0].map((s) => s.id).sort()).toEqual(['1', '2']);
  });

  test('trims whitespace before comparing', () => {
    const subs = [makeSub({ id: '1', name: 'Netflix' }), makeSub({ id: '2', name: '  Netflix  ' })];
    const dupes = findDuplicateSubscriptions(subs);
    expect(dupes.length).toBe(1);
  });

  test('does not flag similar-but-different names', () => {
    const subs = [makeSub({ id: '1', name: 'Disney+' }), makeSub({ id: '2', name: 'Disney+ Bundle' })];
    const dupes = findDuplicateSubscriptions(subs);
    expect(dupes.length).toBe(0);
  });

  test('returns empty array when there are no duplicates', () => {
    const subs = [makeSub({ id: '1', name: 'Netflix' }), makeSub({ id: '2', name: 'Spotify' })];
    expect(findDuplicateSubscriptions(subs)).toEqual([]);
  });

  test('handles three-way duplicates as a single group', () => {
    const subs = [
      makeSub({ id: '1', name: 'Netflix' }),
      makeSub({ id: '2', name: 'Netflix' }),
      makeSub({ id: '3', name: 'Netflix' }),
    ];
    const dupes = findDuplicateSubscriptions(subs);
    expect(dupes.length).toBe(1);
    expect(dupes[0].length).toBe(3);
  });
});

describe('findYearlySavingsCandidates', () => {
  test('excludes subscriptions already on a yearly plan', () => {
    const subs = [
      makeSub({ id: '1', name: 'Monthly Sub', billingCycle: 'monthly', cost: 10 }),
      makeSub({ id: '2', name: 'Yearly Sub', billingCycle: 'yearly', cost: 100 }),
    ];
    const candidates = findYearlySavingsCandidates(subs);
    expect(candidates.map((s) => s.id)).toEqual(['1']);
  });

  test('sorts by annualized cost, most expensive first', () => {
    const subs = [
      makeSub({ id: '1', name: 'Cheap', billingCycle: 'monthly', cost: 5 }),
      makeSub({ id: '2', name: 'Expensive', billingCycle: 'monthly', cost: 50 }),
      makeSub({ id: '3', name: 'Weekly', billingCycle: 'weekly', cost: 20 }), // ~86.67/mo equivalent
    ];
    const candidates = findYearlySavingsCandidates(subs);
    expect(candidates.map((s) => s.id)).toEqual(['3', '2', '1']);
  });

  test('respects the limit parameter', () => {
    const subs = Array.from({ length: 10 }, (_, i) =>
      makeSub({ id: String(i), name: `Sub ${i}`, billingCycle: 'monthly', cost: i + 1 })
    );
    const candidates = findYearlySavingsCandidates(subs, 3);
    expect(candidates.length).toBe(3);
  });

  test('returns empty array when everything is already yearly', () => {
    const subs = [makeSub({ id: '1', billingCycle: 'yearly' })];
    expect(findYearlySavingsCandidates(subs)).toEqual([]);
  });
});
