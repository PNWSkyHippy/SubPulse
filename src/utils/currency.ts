export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'MXN', 'CHF', 'INR', 'CNY', 'KRW', 'NZD', 'SEK', 'BRL', 'PHP'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
  MXN: 'MX$',
  CHF: 'CHF ',
  INR: '₹',
  CNY: 'CN¥',
  KRW: '₩',
  NZD: 'NZ$',
  SEK: 'kr ',
  BRL: 'R$',
  PHP: '₱',
};

/** Currencies with no minor unit in everyday use. */
const ZERO_DECIMAL = ['JPY', 'KRW'];

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code + ' ';
}

/** JPY has no minor unit (no decimal places) in normal usage; everything else uses 2. */
export function formatCurrency(amount: number, code: string): string {
  const symbol = currencySymbol(code);
  const decimals = ZERO_DECIMAL.includes(code) ? 0 : 2;
  const sign = amount < 0 ? '-' : '';
  const fixed = Math.abs(amount).toFixed(decimals);
  const [i, d] = fixed.split('.');
  return `${sign}${symbol}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${d ? '.' + d : ''}`;
}
