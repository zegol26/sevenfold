/**
 * Shared display formatting for monetary values.
 *
 * Rules (from the enterprise UX audit):
 * - A monetary amount is never rendered without its currency context.
 * - Currency always comes from registered data (scenario/option/project/invoice/
 *   ratecard rows); callers pass it explicitly. `FALLBACK_CURRENCY` (the framework
 *   base currency from the business plan) is only used when a record predates
 *   currency capture, so the UI still never shows a bare unlabeled number.
 * - Detail views keep exact values; compact notation is reserved for summary tiles.
 * - Formatting is display-only: the stored string value is parsed for rendering and
 *   never mutated or written back, so no floating-point drift can reach the database.
 */

/** Framework base currency (business plan §6.7: "Base: USD"). */
export const FALLBACK_CURRENCY = "USD";

function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

/** Currencies conventionally displayed without decimal places. */
const ZERO_DECIMAL = new Set(["IDR", "JPY", "KRW", "VND"]);

export function formatMoney(
  value: string | number | null | undefined,
  currency?: string | null,
  options?: { compact?: boolean; dash?: string },
): string {
  const amount = parseAmount(value);
  if (amount === null) return options?.dash ?? "-";
  const code = (currency || "").trim().toUpperCase() || FALLBACK_CURRENCY;
  const maximumFractionDigits = options?.compact ? 1 : ZERO_DECIMAL.has(code) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      notation: options?.compact ? "compact" : "standard",
      maximumFractionDigits,
      // Whole amounts in detail views render as 1,250 not 1,250.00 — denser tables.
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown/custom ISO code registered by an admin: label it explicitly.
    const number = new Intl.NumberFormat("en-US", {
      notation: options?.compact ? "compact" : "standard",
      maximumFractionDigits,
    }).format(amount);
    return `${code} ${number}`;
  }
}

/** Compact form for KPI tiles and summary cards, e.g. "$1.2M" / "IDR 3.4B". */
export function formatMoneyCompact(value: string | number | null | undefined, currency?: string | null): string {
  return formatMoney(value, currency, { compact: true });
}

/** Percentage display for stored ratio strings (e.g. gross margin 0.35 -> "35%"). */
export function formatRatioAsPercent(value: string | number | null | undefined): string {
  const amount = parseAmount(value);
  if (amount === null) return "-";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount * 100)}%`;
}
