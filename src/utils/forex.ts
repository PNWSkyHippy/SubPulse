/**
 * Multi-currency support: conversion math (pure) plus a small cached rate
 * fetcher. Rates come from open.er-api.com (free, no API key, updated once a
 * day), which is plenty for budgeting; nothing here is used for trading.
 */

export interface RateTable {
  base: string;
  /** units of currency per 1 unit of base */
  rates: Record<string, number>;
  /** ISO timestamp the provider last updated the rates */
  updatedAt: string;
  fetchedAt: string;
}

/** Convert `amount` in `from` into `to` using a table with any base. Returns null if a rate is missing. */
export function convert(amount: number, from: string, to: string, table: RateTable | null): number | null {
  if (from === to) return amount;
  if (!table) return null;
  const rFrom = from === table.base ? 1 : table.rates[from];
  const rTo = to === table.base ? 1 : table.rates[to];
  if (!rFrom || !rTo) return null;
  return (amount / rFrom) * rTo;
}

/**
 * Sums per-currency totals into one base-currency figure. Currencies with no
 * known rate are returned in `unconverted` instead of being silently dropped.
 */
export function totalInBase(
  byCurrency: Record<string, number>,
  base: string,
  table: RateTable | null
): { total: number; unconverted: Record<string, number> } {
  let total = 0;
  const unconverted: Record<string, number> = {};
  for (const [code, amount] of Object.entries(byCurrency)) {
    const v = convert(amount, code, base, table);
    if (v === null) unconverted[code] = amount;
    else total += v;
  }
  return { total: Math.round(total * 100) / 100, unconverted };
}

export const RATES_URL = (base: string) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface RateStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Returns cached rates when fresh, otherwise fetches; falls back to stale cache when offline. */
export async function getRates(
  base: string,
  storage: RateStorage,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now()
): Promise<RateTable | null> {
  const key = `fx:${base}`;
  let cached: RateTable | null = null;
  try {
    const raw = await storage.getItem(key);
    cached = raw ? (JSON.parse(raw) as RateTable) : null;
  } catch {
    cached = null;
  }
  if (cached && now - Date.parse(cached.fetchedAt) < MAX_AGE_MS) return cached;

  try {
    const res = await fetchImpl(RATES_URL(base));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: any = await res.json();
    if (json.result !== 'success' || !json.rates) throw new Error('bad payload');
    const table: RateTable = {
      base: json.base_code ?? base,
      rates: json.rates,
      updatedAt: json.time_last_update_utc ? new Date(json.time_last_update_utc).toISOString() : new Date(now).toISOString(),
      fetchedAt: new Date(now).toISOString(),
    };
    await storage.setItem(key, JSON.stringify(table)).catch(() => {});
    return table;
  } catch {
    return cached; // stale is better than nothing
  }
}
