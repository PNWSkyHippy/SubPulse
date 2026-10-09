import { contactDedupeKey, parseVCards } from '../vcard';
import { convert, getRates, totalInBase, RateTable } from '../forex';

describe('parseVCards', () => {
  test('parses Google Contacts style 3.0 export', () => {
    const vcf = [
      'BEGIN:VCARD', 'VERSION:3.0', 'FN:Marcus Vance', 'N:Vance;Marcus;;;',
      'TEL;TYPE=CELL:+1 415-890-4100', 'EMAIL;TYPE=INTERNET:marcus@example.com', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Rossi;Elena;;;', 'item1.TEL:555 0100', 'END:VCARD',
    ].join('\r\n');
    expect(parseVCards(vcf)).toEqual([
      { name: 'Marcus Vance', phone: '+1 415-890-4100', email: 'marcus@example.com' },
      { name: 'Elena Rossi', phone: '555 0100', email: undefined },
    ]);
  });

  test('handles folded lines, quoted-printable and preferred phone', () => {
    const vcf = [
      'BEGIN:VCARD', 'VERSION:2.1', 'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Pe', ' rez',
      'TEL;HOME:111', 'TEL;CELL;PREF:222', 'END:VCARD',
    ].join('\n');
    const [c] = parseVCards(vcf);
    expect(c.name).toBe('José Perez');
    expect(c.phone).toBe('222');
  });

  test('dedupe key prefers email then last 10 phone digits', () => {
    expect(contactDedupeKey({ name: 'A', email: 'X@Y.com' })).toBe('e:x@y.com');
    expect(contactDedupeKey({ name: 'A', phone: '+1 (415) 890-4100' })).toBe('p:4158904100');
  });
});

describe('forex', () => {
  const table: RateTable = { base: 'USD', rates: { USD: 1, EUR: 0.9, JPY: 150 }, updatedAt: '', fetchedAt: '' };

  test('converts through the table base', () => {
    expect(convert(90, 'EUR', 'USD', table)).toBeCloseTo(100);
    expect(convert(9, 'EUR', 'JPY', table)).toBeCloseTo(1500);
    expect(convert(1, 'XYZ', 'USD', table)).toBeNull();
  });

  test('totalInBase keeps unknown currencies separate', () => {
    expect(totalInBase({ USD: 10, EUR: 9, XYZ: 5 }, 'USD', table)).toEqual({ total: 20, unconverted: { XYZ: 5 } });
  });

  test('getRates caches and falls back to stale cache offline', async () => {
    const store: Record<string, string> = {};
    const storage = { getItem: async (k: string) => store[k] ?? null, setItem: async (k: string, v: string) => { store[k] = v; } };
    const ok = (async () => ({ ok: true, json: async () => ({ result: 'success', base_code: 'USD', rates: { EUR: 0.9 }, time_last_update_utc: 'Thu, 08 Oct 2026 00:00:01 +0000' }) })) as any;
    const t1 = await getRates('USD', storage, ok, Date.UTC(2026, 9, 8));
    expect(t1?.rates.EUR).toBe(0.9);
    const failing = (async () => { throw new Error('offline'); }) as any;
    const t2 = await getRates('USD', storage, failing, Date.UTC(2026, 9, 10)); // stale, fetch fails
    expect(t2?.rates.EUR).toBe(0.9);
  });
});
