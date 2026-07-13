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
    version: "0.3.2",
    date: "2026-07-14",
    slogan: "Failed saves now tell you why, instead of a generic 'could not be completed' banner.",
    highlights: [
      "Root cause: Next.js hides the real error message from any Server Action that throws once deployed to production, no matter how clear the message is - the form always fell back to a generic banner.",
      "Added a return-based error path (toActionError) that survives production, and wired ActionForm to use it. Converted Update Scenario, Add Commodity Cost Line, and Create SDS (Sales Decision for Submission) as the first three - their errors (missing scenario, ungated SDS, presenter role mismatch, etc.) now show their real reason on screen.",
      "The remaining action forms still use the old throw-based path (same generic banner as before) and are next in line to convert to the same pattern.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-07-14",
    slogan: "Fixed a 'Scenario not found' error when adding commodity cost lines.",
    highlights: [
      "Add Commodity Cost Structure now picks the Scenario from a dropdown scoped to the selected Opportunity, instead of a free-text ID - eliminates the typo/wrong-ID mismatches that were throwing 'Scenario not found'.",
      "The underlying error (also reachable from Edit Scenario) now names the scenario and opportunity IDs it looked for, so any future mismatch is diagnosable straight from the error instead of a bare message.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-13",
    slogan: "Enterprise workflow pass: guarded opportunity lifecycle, stable forms, currency-safe figures, and an in-product Knowledge Guide.",
    highlights: [
      "Opportunity status now moves only through explicit workflow actions (Submit for Review, Approve Pricing Structure, Release to Cashflow, Approve Opportunity) with server-side entry criteria, role checks, and audit trail.",
      "Every form is now protected: unsaved changes survive accidental clicks and failures, dialogs confirm before discarding, duplicate submits are blocked, and successful saves close with clear feedback.",
      "Every monetary value shows its currency (from registered scenario/option/project/invoice data); mixed-currency totals are flagged instead of mislabeled.",
      "Opportunity detail reorganized into an executive header plus Scope & Commercial, Risks, Cashflow, and Approvals & History tabs; opportunity rows are fully clickable.",
      "Opportunity Analysis leads with 'My Opportunities' (your deals and their next step) instead of generic counters.",
      "New Knowledge Guide (Help menu): searchable manuals for sales, delivery & governance, and workforce management, with lifecycle references, glossary, and FAQs.",
      "Grouped, scrollable navigation with a proper mobile drawer; tables scroll horizontally on small screens; internal/technical wording replaced with product language.",
    ],
  },
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
