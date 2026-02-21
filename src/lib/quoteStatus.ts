export type QuoteWorkflowStatus =
  | "draft"
  | "needs_pricing"
  | "needs_client"
  | "ready";

export type QuoteWorkflowFilter = "all" | QuoteWorkflowStatus;

interface QuoteStatusInput {
  clientId: number | null;
  totalCost: number | null;
  status?: string | null;
}

function isQuoteWorkflowStatus(value: unknown): value is QuoteWorkflowStatus {
  return (
    value === "draft" ||
    value === "needs_pricing" ||
    value === "needs_client" ||
    value === "ready"
  );
}

/**
 * Uses backend-provided status when available, with a local fallback.
 */
export function deriveQuoteWorkflowStatus(
  quote: QuoteStatusInput,
): QuoteWorkflowStatus {
  if (isQuoteWorkflowStatus(quote.status)) return quote.status;

  const hasClient = quote.clientId != null;
  const hasValidPricing = quote.totalCost != null && quote.totalCost > 0;

  if (hasClient && hasValidPricing) return "ready";
  if (!hasClient && hasValidPricing) return "needs_client";
  if (hasClient) return "needs_pricing";
  return "draft";
}

export function getQuoteStatusBadge(
  status: QuoteWorkflowStatus,
  t: (key: string) => string,
): { label: string; bg: string; text: string } {
  switch (status) {
    case "ready":
      return {
        label: t("quotes.statusReady"),
        bg: "bg-emerald-50",
        text: "text-emerald-700",
      };
    case "needs_client":
      return {
        label: t("quotes.statusNoClient"),
        bg: "bg-amber-50",
        text: "text-amber-700",
      };
    case "needs_pricing":
      return {
        label: t("quotes.statusNeedsPricing"),
        bg: "bg-sky-50",
        text: "text-sky-700",
      };
    case "draft":
    default:
      return {
        label: t("quotes.statusDraft"),
        bg: "bg-slate-100",
        text: "text-slate-600",
      };
  }
}
