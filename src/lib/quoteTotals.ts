export interface QuoteTotalInput {
  totalCost: number | null | undefined;
  laborHours?: number | null;
  laborRate?: number | null;
  laborEnabled?: boolean | null;
}

export interface QuoteTotalSettings {
  defaultLaborRate?: number | null;
  taxEnabled?: boolean | null;
  taxRate?: number | null;
  taxInclusive?: boolean | null;
}

function toFiniteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Matches the quote detail/PDF math:
 * materials + labor, then apply tax only when tax is enabled and exclusive.
 */
export function calculateQuoteGrandTotal(
  quote: QuoteTotalInput,
  settings: QuoteTotalSettings,
): number | null {
  if (quote.totalCost === null || quote.totalCost === undefined) {
    return null;
  }

  const materialsCost = toFiniteNumber(quote.totalCost);
  const laborHours = toFiniteNumber(quote.laborHours);
  const effectiveLaborRate =
    quote.laborRate ?? settings.defaultLaborRate ?? null;
  const laborRate = toFiniteNumber(effectiveLaborRate);
  const laborEnabled = quote.laborEnabled ?? true;

  const laborCost =
    laborEnabled && laborHours > 0 && laborRate > 0 ? laborHours * laborRate : 0;
  const subtotal = materialsCost + laborCost;

  const taxEnabled = settings.taxEnabled ?? false;
  const taxRate = toFiniteNumber(settings.taxRate);
  const taxInclusive = settings.taxInclusive ?? false;

  if (!taxEnabled || taxRate <= 0 || taxInclusive) {
    return subtotal;
  }

  return subtotal + subtotal * (taxRate / 100);
}
