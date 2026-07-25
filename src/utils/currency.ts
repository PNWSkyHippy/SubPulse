export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code + ' ';
}

/** JPY has no minor unit (no decimal places) in normal usage; everything else uses 2. */
export function formatCurrency(amount: number, code: string): string {
  const symbol = currencySymbol(code);
  const decimals = code === 'JPY' ? 0 : 2;
  return `${symbol}${amount.toFixed(decimals)}`;
}
