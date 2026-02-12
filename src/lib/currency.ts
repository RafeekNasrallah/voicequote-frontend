// Currency utility for VoiceQuote

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  symbolPosition: "before" | "after";
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar", symbolPosition: "before" },
  { code: "EUR", symbol: "€", name: "Euro", symbolPosition: "before" },
  { code: "GBP", symbol: "£", name: "British Pound", symbolPosition: "before" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel", symbolPosition: "before" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", symbolPosition: "after" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", symbolPosition: "after" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", symbolPosition: "before" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", symbolPosition: "before" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", symbolPosition: "before" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", symbolPosition: "before" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", symbolPosition: "before" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", symbolPosition: "before" },
  { code: "MXN", symbol: "$", name: "Mexican Peso", symbolPosition: "before" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", symbolPosition: "before" },
];

export const DEFAULT_CURRENCY = "USD";

/**
 * Get currency object by code
 */
export function getCurrency(code: string): Currency {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code) ||
    SUPPORTED_CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!
  );
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(code: string): string {
  return getCurrency(code).symbol;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, code: string = DEFAULT_CURRENCY): string {
  const currency = getCurrency(code);
  const formattedAmount = amount.toFixed(2);

  if (currency.symbolPosition === "after") {
    return `${formattedAmount} ${currency.symbol}`;
  }
  return `${currency.symbol}${formattedAmount}`;
}

/**
 * Get display label for currency (e.g., "USD ($)")
 */
export function getCurrencyLabel(code: string): string {
  const currency = getCurrency(code);
  return `${currency.code} (${currency.symbol})`;
}
