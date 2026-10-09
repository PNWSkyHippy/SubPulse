import { Subscription } from '../../types';
import { buildSavingsReport } from '../insights';

let n = 0;
function make(overrides: Partial<Subscription>): Subscription {
  n++;
  return {
    id: overrides.id ?? `s${n}`,
    name: 'X',
    cost: 10,
    currency: 'USD',
    billingCycle: 'monthly',
    nextRenewalDate: '2026-10-20',
    reminderDaysBefore: 3,
    createdAt: '2026-01-01T00:00:00Z',
    ownerId: 'u',
    ...overrides,
  };
}

const today = new Date(Date.UTC(2026, 9, 8));

describe('buildSavingsReport', () => {
  test('flags a service paid separately that a bundle already includes', () => {
    const r = buildSavingsReport([
      make({ id: 'one', name: 'Apple One', catalogId: 'apple-one', cost: 19.95 }),
      make({ id: 'music', name: 'Apple Music', catalogId: 'apple-music', cost: 10.99 }),
    ], [], today);
    const b = r.opportunities.find((o) => o.type === 'bundle');
    expect(b?.itemIds[0]).toBe('music');
    expect(b?.annualSavings).toBeCloseTo(131.88, 2);
    expect(b?.confidence).toBe('exact');
  });

  test('two music services overlap; keeps the priciest', () => {
    const r = buildSavingsReport([
      make({ id: 'sp', name: 'Spotify Premium', cost: 11.99 }),
      make({ id: 'am', name: 'Apple Music', cost: 10.99 }),
    ], [], today);
    const o = r.opportunities.find((x) => x.type === 'overlap');
    expect(o).toBeDefined();
    expect(o!.itemIds[o!.itemIds.length - 1]).toBe('sp');
    expect(o!.annualSavings).toBeCloseTo(131.88, 2);
  });

  test('two streaming services is not flagged, three is', () => {
    const two = [make({ name: 'Netflix', cost: 17.99 }), make({ name: 'Hulu', cost: 9.99 })];
    expect(buildSavingsReport(two, [], today).opportunities.some((o) => o.type === 'overlap')).toBe(false);
    const three = [...two, make({ name: 'Peacock', cost: 10.99 })];
    expect(buildSavingsReport(three, [], today).opportunities.some((o) => o.type === 'overlap')).toBe(true);
  });

  test('list-price annual switch when the price matches a known monthly plan', () => {
    const r = buildSavingsReport([make({ id: 'yt', name: 'YouTube Premium', cost: 13.99 })], [], today);
    const sw = r.opportunities.find((o) => o.type === 'annual-switch');
    expect(sw?.confidence).toBe('list-price');
    expect(sw?.annualSavings).toBeCloseTo(13.99 * 12 - 139.99, 2);
  });

  test('user-entered alternate prices take precedence over list price', () => {
    const r = buildSavingsReport([make({ name: 'YouTube Premium', cost: 13.99, alternatePrices: { yearly: 120 } })], [], today);
    const switches = r.opportunities.filter((o) => o.type === 'annual-switch');
    expect(switches).toHaveLength(1);
    expect(switches[0].confidence).toBe('exact');
  });

  test('exact duplicates, but never for leases/utilities', () => {
    const r = buildSavingsReport([
      make({ name: 'Netflix', cost: 17.99 }),
      make({ name: 'netflix', cost: 7.99 }),
      make({ name: 'Electricity', kind: 'utility', cost: 80 }),
      make({ name: 'Electricity', kind: 'utility', cost: 60 }),
    ], [], today);
    const dups = r.opportunities.filter((o) => o.type === 'duplicate');
    expect(dups).toHaveLength(1);
    expect(dups[0].annualSavings).toBeCloseTo(95.88, 2);
  });

  test('promotions match by catalog and ignore expired ones', () => {
    const items = [make({ id: 'n', name: 'NordVPN', cost: 12.99 })];
    const r = buildSavingsReport(items, [
      { id: 'p1', catalogId: 'nordvpn', title: 'Renewal deal', discountPct: 45, code: 'SAVE45', expires: '2026-12-01' },
      { id: 'p2', catalogId: 'nordvpn', title: 'Old deal', discountPct: 90, expires: '2026-01-01' },
    ], today);
    const promos = r.opportunities.filter((o) => o.type === 'promotion');
    expect(promos).toHaveLength(1);
    expect(promos[0].promoCode).toBe('SAVE45');
    expect(promos[0].annualSavings).toBeCloseTo(12.99 * 12 * 0.45, 2);
  });

  test('headline total counts each item once', () => {
    const r = buildSavingsReport([
      make({ id: 'one', name: 'Apple One', catalogId: 'apple-one', cost: 19.95 }),
      make({ id: 'am', name: 'Apple Music', cost: 10.99 }),
      make({ id: 'sp', name: 'Spotify Premium', cost: 11.99 }),
    ], [], today);
    // Apple Music is both "in the bundle" and "overlapping music": counted once.
    expect(r.totalAnnual).toBeCloseTo(10.99 * 12, 2);
  });

  test('cancelled items are ignored', () => {
    const r = buildSavingsReport([
      make({ name: 'Spotify Premium', cost: 11.99 }),
      make({ name: 'Apple Music', cost: 10.99, status: 'cancelled' }),
    ], [], today);
    expect(r.opportunities).toHaveLength(0);
  });
});
