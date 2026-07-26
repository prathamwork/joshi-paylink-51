export type CurrencyCode =
  | "INR" | "USD" | "GBP" | "EUR" | "AUD" | "CAD" | "NZD" | "SGD" | "AED";

export const CURRENCIES: Record<CurrencyCode, { symbol: string; label: string; exponent: number; requiresIntl?: boolean }> = {
  INR: { symbol: "₹", label: "Indian Rupee", exponent: 2 },
  USD: { symbol: "$", label: "US Dollar", exponent: 2, requiresIntl: true },
  GBP: { symbol: "£", label: "British Pound", exponent: 2, requiresIntl: true },
  EUR: { symbol: "€", label: "Euro", exponent: 2, requiresIntl: true },
  AUD: { symbol: "A$", label: "Australian Dollar", exponent: 2, requiresIntl: true },
  CAD: { symbol: "C$", label: "Canadian Dollar", exponent: 2, requiresIntl: true },
  NZD: { symbol: "NZ$", label: "New Zealand Dollar", exponent: 2, requiresIntl: true },
  SGD: { symbol: "S$", label: "Singapore Dollar", exponent: 2, requiresIntl: true },
  AED: { symbol: "د.إ", label: "UAE Dirham", exponent: 2, requiresIntl: true },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(c: string): c is CurrencyCode {
  return c in CURRENCIES;
}

export function toMinor(major: number, currency: CurrencyCode): number {
  const e = CURRENCIES[currency].exponent;
  return Math.round(major * 10 ** e);
}

export function fromMinor(minor: number, currency: CurrencyCode): number {
  const e = CURRENCIES[currency].exponent;
  return minor / 10 ** e;
}

export function formatMoney(minor: number, currency: CurrencyCode): string {
  const value = fromMinor(minor, currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: CURRENCIES[currency].exponent,
    }).format(value);
  } catch {
    return `${CURRENCIES[currency].symbol}${value.toFixed(CURRENCIES[currency].exponent)}`;
  }
}
