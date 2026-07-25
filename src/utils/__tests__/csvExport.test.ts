import { generateSubscriptionsCSV } from '../csv';
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

describe('generateSubscriptionsCSV', () => {
  test('includes header row and one row per subscription', () => {
    const csv = generateSubscriptionsCSV([
      makeSub({ name: 'Netflix', cost: 15.49, category: 'Streaming' }),
      makeSub({ name: 'Spotify', cost: 11.99, category: 'Streaming' }),
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Cost,Currency,Billing Cycle,Next Renewal,Category,Notes');
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('Netflix');
    expect(lines[2]).toContain('Spotify');
  });

  test('escapes fields containing commas', () => {
    const csv = generateSubscriptionsCSV([makeSub({ name: 'Test', notes: 'shared, cancel soon' })]);
    expect(csv).toContain('"shared, cancel soon"');
  });

  test('escapes fields containing quotes', () => {
    const csv = generateSubscriptionsCSV([makeSub({ name: 'Test', notes: 'the "best" plan' })]);
    expect(csv).toContain('"the ""best"" plan"');
  });

  test('handles missing optional fields as empty strings', () => {
    const csv = generateSubscriptionsCSV([makeSub({ category: undefined, notes: undefined })]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.endsWith(',,')).toBe(true);
  });
});
