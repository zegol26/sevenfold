// Real cash-timing calculation for Cashflow Analysis (business_plan.md §6.2, §13).
// Replaces the previous single-line "cashImpact = revenue - discount - tax - cost"
// formula, which never used dsoDays despite capturing it. This models the deal as two
// dated cash events (a cost outflow and a DSO-driven revenue inflow) and derives a real
// time-phased schedule, cash gap, break-even date, working-capital days, and NPV from
// them, instead of accepting those as unexplained manual inputs.

export type CashflowEngineInput = {
  invoiceDate: Date;
  dsoDays: number;
  grossInvoice: number;
  discountAmount: number;
  withholdingTax: number;
  costAmount: number;
  /** Defaults to invoiceDate when omitted (cost assumed incurred at invoicing). */
  costDate?: Date;
  /** Annual discount rate used for NPV. Defaults to 10%. */
  discountRatePercent?: number;
};

export type CashflowScheduleEvent = {
  date: string;
  label: string;
  type: "cost_outflow" | "revenue_inflow";
  amount: number;
  cumulative: number;
};

export type CashflowEngineResult = {
  netInvoiceAmount: number;
  cashInflowDate: string;
  costOutflowDate: string;
  schedule: CashflowScheduleEvent[];
  openingBalance: number;
  closingBalance: number;
  cashGap: number;
  marginAmount: number;
  workingCapitalDays: number;
  breakEvenDate: string | null;
  npv: number;
  discountRatePercent: number;
  assumptions: {
    dsoDays: number;
    discountAmount: number;
    withholdingTax: number;
    costAmount: number;
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateCashflow(input: CashflowEngineInput): CashflowEngineResult {
  const discountRatePercent = input.discountRatePercent ?? 10;
  const costDate = input.costDate ?? input.invoiceDate;
  const cashInflowDate = addDays(input.invoiceDate, input.dsoDays);
  const netInvoiceAmount = input.grossInvoice - input.discountAmount - input.withholdingTax;

  const rawEvents: Array<{ date: Date; label: string; type: CashflowScheduleEvent["type"]; amount: number }> = [
    { date: costDate, label: "Cost outflow", type: "cost_outflow" as const, amount: -input.costAmount },
    { date: cashInflowDate, label: "Revenue inflow (net of discount/withholding)", type: "revenue_inflow" as const, amount: netInvoiceAmount },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  let cashGap = 0;
  let breakEvenDate: string | null = null;
  const schedule: CashflowScheduleEvent[] = rawEvents.map((event) => {
    running += event.amount;
    cashGap = Math.min(cashGap, running);
    if (breakEvenDate === null && running >= 0) {
      breakEvenDate = event.date.toISOString().slice(0, 10);
    }
    return {
      date: event.date.toISOString().slice(0, 10),
      label: event.label,
      type: event.type,
      amount: round2(event.amount),
      cumulative: round2(running),
    };
  });

  const earliest = rawEvents[0].date;
  const npv = rawEvents.reduce((sum, event) => {
    const days = Math.max(0, (event.date.getTime() - earliest.getTime()) / MS_PER_DAY);
    const discountFactor = Math.pow(1 + discountRatePercent / 100, days / 365);
    return sum + event.amount / discountFactor;
  }, 0);

  return {
    netInvoiceAmount: round2(netInvoiceAmount),
    cashInflowDate: cashInflowDate.toISOString().slice(0, 10),
    costOutflowDate: costDate.toISOString().slice(0, 10),
    schedule,
    openingBalance: 0,
    closingBalance: round2(running),
    cashGap: round2(cashGap),
    marginAmount: round2(netInvoiceAmount - input.costAmount),
    workingCapitalDays: Math.round((cashInflowDate.getTime() - costDate.getTime()) / MS_PER_DAY),
    breakEvenDate,
    npv: round2(npv),
    discountRatePercent,
    assumptions: {
      dsoDays: input.dsoDays,
      discountAmount: input.discountAmount,
      withholdingTax: input.withholdingTax,
      costAmount: input.costAmount,
    },
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
