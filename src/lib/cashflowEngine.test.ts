import { describe, expect, it } from "vitest";
import { calculateCashflow } from "./cashflowEngine";

describe("calculateCashflow", () => {
  it("derives the cash inflow date from invoice date + DSO days, not a manual input", () => {
    const result = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 45,
      grossInvoice: 100_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 0,
    });
    expect(result.cashInflowDate).toBe("2026-02-15");
  });

  it("nets discount and withholding tax out of the invoice amount", () => {
    const result = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 30,
      grossInvoice: 100_000,
      discountAmount: 5_000,
      withholdingTax: 2_000,
      costAmount: 0,
    });
    expect(result.netInvoiceAmount).toBe(93_000);
  });

  it("computes cash gap as the trough of the cumulative cash position, not a copy of a form field", () => {
    const result = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 60,
      grossInvoice: 50_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 20_000,
      costDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    // Cost lands first (-20,000), revenue lands 60 days later (+50,000).
    expect(result.cashGap).toBe(-20_000);
    expect(result.closingBalance).toBe(30_000);
    expect(result.breakEvenDate).toBe("2026-03-02");
  });

  it("computes working capital days as the gap between the cost date and the cash inflow date", () => {
    const result = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 30,
      grossInvoice: 10_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 5_000,
      costDate: new Date("2025-12-15T00:00:00.000Z"),
    });
    // Cost on Dec 15, cash in on Jan 31 (Jan 1 + 30 days) = 47 days.
    expect(result.workingCapitalDays).toBe(47);
  });

  it("discounts cashflows at the given annual rate for NPV instead of accepting a manual NPV", () => {
    const noDiscount = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 0,
      grossInvoice: 10_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 0,
      discountRatePercent: 0,
    });
    // Both events land the same day at a 0% rate, so NPV equals raw net cashflow.
    expect(noDiscount.npv).toBe(10_000);

    const discounted = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 365,
      grossInvoice: 10_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 0,
      costDate: new Date("2026-01-01T00:00:00.000Z"),
      discountRatePercent: 10,
    });
    // A cashflow one full year out at a 10% annual rate should discount to ~9,090.91.
    expect(discounted.npv).toBeCloseTo(9_090.91, 1);
  });

  it("returns a null break-even date when the position never recovers", () => {
    const result = calculateCashflow({
      invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
      dsoDays: 30,
      grossInvoice: 1_000,
      discountAmount: 0,
      withholdingTax: 0,
      costAmount: 5_000,
    });
    expect(result.breakEvenDate).toBeNull();
    expect(result.closingBalance).toBe(-4_000);
  });
});
