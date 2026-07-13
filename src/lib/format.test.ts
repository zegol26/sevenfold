import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyCompact, formatRatioAsPercent } from "./format";

describe("formatMoney", () => {
  it("always includes currency context", () => {
    expect(formatMoney("1000000000", "JPY")).toBe("¥1,000,000,000");
    expect(formatMoney("1500.5", "USD")).toBe("$1,500.5");
    expect(formatMoney("2500000", "IDR")).toContain("2,500,000");
    expect(formatMoney("2500000", "IDR")).toMatch(/IDR|Rp/);
  });

  it("falls back to the framework base currency instead of a bare number", () => {
    expect(formatMoney("120")).toBe("$120");
  });

  it("labels unknown admin-registered codes explicitly", () => {
    // Intl renders code-style currencies with a non-breaking space (U+00A0/U+202F);
    // normalize it — the requirement is that the code and amount appear together.
    const normalized = formatMoney("42", "XXA").replace(/[  ]/g, " ");
    expect(normalized).toBe("XXA 42");
  });

  it("keeps exact values in standard notation (no float mutation)", () => {
    expect(formatMoney("1234567.89", "USD")).toBe("$1,234,567.89");
    expect(formatMoney(0, "USD")).toBe("$0");
  });

  it("handles comma-grouped input strings from legacy records", () => {
    expect(formatMoney("1,250,000", "USD")).toBe("$1,250,000");
  });

  it("returns a dash for missing values instead of a fake zero", () => {
    expect(formatMoney("", "USD")).toBe("-");
    expect(formatMoney(null, "USD")).toBe("-");
    expect(formatMoney(undefined, "USD")).toBe("-");
    expect(formatMoney("abc", "USD")).toBe("-");
  });

  it("uses compact notation for summary tiles", () => {
    expect(formatMoneyCompact("1000000000", "JPY")).toBe("¥1B");
    expect(formatMoneyCompact("1234000", "USD")).toBe("$1.2M");
  });
});

describe("formatRatioAsPercent", () => {
  it("renders stored ratios as percentages", () => {
    expect(formatRatioAsPercent("0.35")).toBe("35%");
    expect(formatRatioAsPercent("")).toBe("-");
  });
});
