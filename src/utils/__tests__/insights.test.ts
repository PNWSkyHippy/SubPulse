import { findDuplicateSubscriptions, findYearlySavingsCandidates, findRealSavingsOpportunities } from '../insights';
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

  test('excludes subscriptions that have a real (user-entered) savings opportunity', () => {
    const subs = [
      makeSub({
        id: '1',
        name: 'Netflix',
        billingCycle: 'monthly',
        cost: 15.49,
        alternatePrices: { yearly: 120 }, // real, cheaper alternative known
      }),
      makeSub({ id: '2', name: 'Spotify', billingCycle: 'monthly', cost: 11.99 }), // no known alternative
    ];
    const candidates = findYearlySavingsCandidates(subs);
    // Netflix should NOT appear here since it has a precise opportunity instead.
    expect(candidates.map((s) => s.id)).toEqual(['2']);
  });
});

describe('findRealSavingsOpportunities', () => {
  test('finds a real savings opportunity when an entered alternate price is cheaper annualized', () => {
    const subs = [
      makeSub({
        id: '1',
        name: 'Netflix',
        billingCycle: 'monthly',
        cost: 15.49, // $185.88/year
        alternatePrices: { yearly: 120 }, // cheaper: $120/year
      }),
    ];
    const results = findRealSavingsOpportunities(subs);
    expect(results.length).toBe(1);
    expect(results[0].cheaperCycle).toBe('yearly');
    expect(results[0].annualSavings).toBeCloseTo(185.88 - 120, 1);
  });

  test('ignores an alternate price that is NOT actually cheaper', () => {
    const subs = [
      makeSub({
        id: '1',
        billingCycle: 'monthly',
        cost: 10, // $120/year
        alternatePrices: { yearly: 150 }, // worse deal, should not be flagged
      }),
    ];
    expect(findRealSavingsOpportunities(subs)).toEqual([]);
  });

  test('ignores subscriptions with no alternatePrices at all', () => {
    const subs = [makeSub({ id: '1', billingCycle: 'monthly', cost: 10 })];
    expect(findRealSavingsOpportunities(subs)).toEqual([]);
  });

  test('picks the cheapest of multiple entered alternates', () => {
    const subs = [
      makeSub({
        id: '1',
        billingCycle: 'monthly',
        cost: 20, // $240/year
        alternatePrices: { quarterly: 55, yearly: 180 }, // quarterly: $220/yr, yearly: $180/yr -> yearly wins
      }),
    ];
    const results = findRealSavingsOpportunities(subs);
    expect(results[0].cheaperCycle).toBe('yearly');
  });

  test('sorts multiple opportunities by savings amount, largest first', () => {
    const subs = [
      makeSub({ id: '1', name: 'Small saving', billingCycle: 'monthly', cost: 10, alternatePrices: { yearly: 110 } }),
      makeSub({ id: '2', name: 'Big saving', billingCycle: 'monthly', cost: 50, alternatePrices: { yearly: 300 } }),
    ];
    const results = findRealSavingsOpportunities(subs);
    expect(results.map((r) => r.subscription.id)).toEqual(['2', '1']);
  });

  test('ignores an alternatePrices entry for the same cycle the subscription is already on', () => {
    const subs = [
      makeSub({
        id: '1',
        billingCycle: 'monthly',
        cost: 10,
        alternatePrices: { monthly: 5 }, // nonsensical entry for its own current cycle, should be skipped
      }),
    ];
    expect(findRealSavingsOpportunities(subs)).toEqual([]);
  });
});
