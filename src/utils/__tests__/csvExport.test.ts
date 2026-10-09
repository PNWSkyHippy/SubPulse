import { generateSubscriptionsCSV, parseCSVText, parseSubscriptionsCSV } from '../csv';
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
    expect(lines[0]).toBe(
      'Name,Cost,Currency,Billing Cycle,Next Renewal,Category,Notes,Alt Weekly Price,Alt Monthly Price,Alt Quarterly Price,Alt Yearly Price,Kind,Status,Auto Pay,Reminder Days,Catalog Id,Last Paid'
    );
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
    const fields = dataLine.split(',');
    // category, notes and the 4 alternate-price columns are empty
    expect(fields.slice(5, 11)).toEqual(['', '', '', '', '', '']);
    // kind, status, auto pay empty; reminder days present; catalog id, last paid empty
    expect(fields.slice(11)).toEqual(['', '', '', '3', '', '']);
  });
});

describe('parseCSVText', () => {
  test('parses simple comma-separated rows', () => {
    const rows = parseCSVText('a,b,c\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  test('handles a quoted field containing a comma', () => {
    const rows = parseCSVText('Name,Notes\nTest,"shared, cancel soon"');
    expect(rows[1]).toEqual(['Test', 'shared, cancel soon']);
  });

  test('handles a quoted field containing escaped quotes', () => {
    const rows = parseCSVText('Name,Notes\nTest,"the ""best"" plan"');
    expect(rows[1]).toEqual(['Test', 'the "best" plan']);
  });

  test('handles a quoted field containing a real newline', () => {
    const rows = parseCSVText('Name,Notes\nTest,"line one\nline two"\nSecond,fine');
    expect(rows.length).toBe(3);
    expect(rows[1]).toEqual(['Test', 'line one\nline two']);
    expect(rows[2]).toEqual(['Second', 'fine']);
  });

  test('ignores trailing blank lines', () => {
    const rows = parseCSVText('a,b\n1,2\n\n');
    expect(rows.length).toBe(2);
  });
});

describe('parseSubscriptionsCSV', () => {
  test('round-trips a generated CSV back into equivalent subscription data', () => {
    const original = [
      makeSub({ name: 'Netflix', cost: 15.49, currency: 'USD', category: 'Streaming', notes: 'shared, family plan' }),
      makeSub({ name: 'Spotify', cost: 11.99, currency: 'EUR', category: undefined, notes: undefined }),
    ];
    const csv = generateSubscriptionsCSV(original);
    const { rows, errors } = parseSubscriptionsCSV(csv);

    expect(errors).toEqual([]);
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({ name: 'Netflix', cost: 15.49, currency: 'USD', category: 'Streaming', notes: 'shared, family plan' });
    expect(rows[1]).toMatchObject({ name: 'Spotify', cost: 11.99, currency: 'EUR' });
    expect(rows[1].category).toBeUndefined();
  });

  test('round-trips alternatePrices through export and import', () => {
    const original = [
      makeSub({
        name: 'Netflix',
        billingCycle: 'monthly',
        cost: 15.49,
        alternatePrices: { yearly: 120, quarterly: 40 },
      }),
      makeSub({ name: 'Spotify', billingCycle: 'monthly', cost: 11.99 }), // no alternate prices at all
    ];
    const csv = generateSubscriptionsCSV(original);
    const { rows, errors } = parseSubscriptionsCSV(csv);

    expect(errors).toEqual([]);
    expect(rows[0].alternatePrices).toEqual({ yearly: 120, quarterly: 40 });
    expect(rows[1].alternatePrices).toBeUndefined();
  });
  test('works with reordered columns (matches by header name, not position)', () => {
    const csv = 'Category,Name,Cost\nStreaming,Netflix,15.49';
    const { rows, errors } = parseSubscriptionsCSV(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Netflix', cost: 15.49, category: 'Streaming' });
  });

  test('skips a row with missing name and reports it', () => {
    const csv = 'Name,Cost\n,9.99\nSpotify,11.99';
    const { rows, errors } = parseSubscriptionsCSV(csv);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Spotify');
    expect(errors[0]).toContain('Row 2');
  });

  test('skips a row with invalid cost and reports it', () => {
    const csv = 'Name,Cost\nNetflix,not-a-number';
    const { rows, errors } = parseSubscriptionsCSV(csv);
    expect(rows.length).toBe(0);
    expect(errors[0]).toContain('invalid cost');
  });

  test('defaults an unknown billing cycle to monthly and reports it', () => {
    const csv = 'Name,Cost,Billing Cycle\nNetflix,9.99,every-blue-moon';
    const { rows, errors } = parseSubscriptionsCSV(csv);
    expect(rows[0].billingCycle).toBe('monthly');
    expect(errors[0]).toContain('unknown billing cycle');
  });

  test('errors when required columns are entirely missing', () => {
    const csv = 'Foo,Bar\n1,2';
    const { rows, errors } = parseSubscriptionsCSV(csv);
    expect(rows).toEqual([]);
    expect(errors[0]).toContain('must have at least');
  });
});
