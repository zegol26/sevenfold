// Release history shown in the Topbar's version badge (VersionBadge). Newest first.
// Convention: any change worth shipping adds one entry here and bumps the
// `version` field in package.json to match CHANGELOG[0].version - there is no
// CI/build step that does this automatically, since none exists in this repo yet.
export type ChangelogEntry = {
  version: string;
  date: string;
  slogan: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2026-07-12",
    slogan: "Opportunities and Cashflow Options are now editable, and clickable through to full detail.",
    highlights: [
      "Opportunity, Scenario, and Cashflow Option records can now be edited after creation.",
      "Click any Opportunity to open a full detail page (Scenarios, Commodity Lines, Risks, Pricing Decisions, Cashflow Options), at its own URL.",
      "Replaced the auto-dismissing create dialogs with stable, non-modal inline forms for Opportunity, Scenario, and Cashflow Option.",
      "Cashflow Analysis now visualizes the cash schedule (cost outflow, revenue inflow, break-even, cash gap) instead of numbers only, plus a side-by-side comparison when an opportunity has multiple cashflow options.",
      "Denser, SAP Fiori-style layout for Opportunity Analysis and Cashflow Analysis (sticky table headers, semantic status colors, right-aligned figures).",
      "Fixed a bug (caught during UAT) where saving an inline edit could silently fail to persist if the row collapsed before the save completed.",
      "Added this version badge - every future release note will show up here.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-11",
    slogan: "Multi-tenant Organization scoping and a real cashflow engine.",
    highlights: [
      "Added Organization-scoped multi-tenancy across the data model.",
      "Replaced the naive cashflow formula with a dated cash-schedule engine (cash gap, break-even, NPV).",
    ],
  },
];
