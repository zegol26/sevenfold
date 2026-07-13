"use client";

/**
 * In-product online manual and knowledge guide.
 *
 * Content is written strictly from implemented behavior and business_plan.md:
 * - Sales management (accounts, opportunities, commercial info, approvals, handoff)
 * - Integrated delivery & business governance (projects, gates, sites, closure)
 * - Candidate / employee / resource / workforce management
 *
 * Organized by task and role (not by screen), searchable client-side, and readable on
 * mobile. No implementation details, credentials, or tenant data appear here.
 */

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { RoleId } from "@/lib/types";

type GuideTopic = {
  id: string;
  title: string;
  roles: string[];
  /** What happens next after the key action, plus step-by-step procedure. */
  body: string[];
  steps?: string[];
  whatHappensNext?: string;
  troubleshooting?: string[];
};

type GuideSection = {
  id: string;
  label: string;
  intro: string;
  topics: GuideTopic[];
};

const SECTIONS: GuideSection[] = [
  {
    id: "sales",
    label: "Sales Management",
    intro: "From first opportunity to Sponsor-approved submission and contract handshake. One opportunity, one controlled workflow: scenarios, costs, risks, pricing, cashflow, SDS, and SDOA always belong to a single Opportunity ID.",
    topics: [
      {
        id: "accounts",
        title: "Set up clients and projects",
        roles: ["Account Manager", "Program Director", "Admin"],
        body: [
          "Clients and projects are master data that every downstream workflow reuses — candidates, assignments, invoices, and project currency all reference them.",
          "Register the client first (name, code, primary contact), then its projects with a project code and currency. The project currency drives how monetary values are labelled everywhere else.",
        ],
        steps: [
          "Open Client & Project Setup.",
          "Create the client with a short unique code (e.g. TECHBROS).",
          "Create each project under that client and choose its currency.",
        ],
        whatHappensNext: "The client and project appear in every relevant picker (candidates, invoices, project setup). You never retype their details.",
        troubleshooting: ["A project is missing from a picker: confirm it was created under the right client and that your role has access to that module."],
      },
      {
        id: "create-opportunity",
        title: "Create and analyze an opportunity",
        roles: ["Account Manager", "Solution Architect"],
        body: [
          "The Account Manager creates the Opportunity ID with customer, deal type, and scope summary. New opportunities always start in Draft.",
          "The Solution Architect then builds proposal scenarios, adds commodity cost lines (HW, SW, SVC, TRN, MGS, AIS, TMM), and registers risks by domain with probability, impact, mitigation plan, and mitigation cost.",
          "Scenario totals, gross margin, and risk exposure are calculated automatically from the entered lines — never typed in by hand.",
        ],
        steps: [
          "Opportunity Analysis → Opportunities → Create.",
          "Add one or more proposal scenarios (each with its own currency).",
          "Add commodity cost lines per scenario.",
          "Register risks; the top urgent and top exposure risks surface automatically.",
          "Record the Pricing Structure Decision and mark the commercial scenario.",
        ],
        whatHappensNext: "Use the workflow actions on the opportunity page — Submit for Review, Approve Pricing Structure, Release to Cashflow Analysis, Approve Opportunity. Each step validates its entry criteria and is recorded in the audit trail.",
        troubleshooting: [
          "\"Submit for Review\" is rejected: add at least one proposal scenario first.",
          "\"Approve Pricing Structure\" is rejected: record an approved Pricing Structure Decision first.",
          "You cannot see workflow buttons: your role may not be authorized for that transition.",
        ],
      },
      {
        id: "cashflow",
        title: "Model and approve cashflow options",
        roles: ["Commercial Manager", "Financial Controller"],
        body: [
          "Cashflow Analysis only accepts opportunities that passed pricing approval. Create one option per commercial alternative (e.g. different payment terms or discounts).",
          "You enter the dated cash events — invoice date, DSO days, gross invoice, discount, withholding tax, cost amount and date. The engine derives net invoice, cash gap, margin, break-even date, working-capital days, and NPV at your chosen discount rate. Calculated values are never entered manually.",
          "When several options exist, the comparison cards highlight the best cash gap and best NPV so the decision is visible at a glance.",
        ],
        steps: [
          "Cashflow Analysis → Create Cashflow Option.",
          "Select the eligible opportunity and enter the dated assumptions.",
          "Review the derived schedule and comparison, then Approve the chosen option.",
        ],
        whatHappensNext: "Approved options are locked (create a new option instead of editing). The approved option becomes the baseline the SDS summarizes.",
      },
      {
        id: "sds",
        title: "Sales Decision for Submission (SDS)",
        roles: ["Account Manager", "Solution Architect", "Program Director", "Sponsor"],
        body: [
          "SDS is the business decision to submit the proposal. It requires an approved cashflow option.",
          "Scope, selected scenario, commodity breakdown, risk summary, cashflow outcome, and pricing decision are pulled from the opportunity automatically — you add the business value narrative, delivery capability notes, and presenter.",
          "Presenter rule: Solution Architect presents Recurrence/Small deals; Program Director presents High/Very High deals.",
        ],
        steps: [
          "Sales Decision Submission → Create.",
          "Pick the opportunity, presenter role and name, and add value/capability notes.",
          "The Sponsor reviews the summary card and approves or rejects.",
        ],
        whatHappensNext: "An approved SDS makes the opportunity eligible for Order Acknowledgement when the customer PO or contract arrives. A rejected SDS goes back to the team for revision.",
      },
      {
        id: "sdoa",
        title: "Order Acknowledgement (SDOA) — the contract handshake",
        roles: ["Contract Manager / Legal", "Commercial Manager", "Sponsor"],
        body: [
          "When the PO or contract is received, record it against the approved SDS and capture the deviations: value, scope, timeline, payment terms, delivery obligations, and legal/commercial deltas.",
          "The Sponsor decides: Acknowledge (accept), Return (needs clarification), or Reject (deviation too large).",
        ],
        whatHappensNext: "An acknowledged SDOA is the only entry point to project setup — delivery never starts on an unvalidated contract.",
      },
    ],
  },
  {
    id: "delivery",
    label: "Delivery & Governance",
    intro: "Gate-based project execution from an acknowledged SDOA to closure: every gate has entry criteria, outputs, and Sponsor approval, with weekly visibility of schedule, scope, cost, quality, sites, and resources.",
    topics: [
      {
        id: "project-setup",
        title: "Create the project from an approved SDOA",
        roles: ["Project Manager", "Program Director"],
        body: [
          "Projects are created only from an acknowledged SDOA. The linked opportunity, customer, and framework version come across automatically.",
          "Assign the Sponsor, project leader, finance manager, resource manager, and other owners from the registered team directory, define the milestone plan, site/cluster configuration, baselines, and governance cadence, and set the project currency.",
        ],
        whatHappensNext: "Five execution gates are created automatically: Establishment, Execution Validation, Ready to Acceptance, Ready to Handover, Closure.",
      },
      {
        id: "gates",
        title: "Move through execution gates",
        roles: ["Project Manager", "Program Director", "Sponsor"],
        body: [
          "Each gate has a checklist, required inputs/outputs, and a RAG status. The PM or Program Director prepares the gate and requests approval; the Sponsor approves or rejects.",
          "A gate cannot move forward while its mandatory checklist is incomplete, unless the Sponsor explicitly approves an exception — which is recorded.",
        ],
        whatHappensNext: "Gate decisions are written to the audit trail. Gate 5 (Closure) completes the project after handover, invoicing, and lessons learned.",
      },
      {
        id: "sites",
        title: "Track sites, acceptance, GR, and invoicing",
        roles: ["Project Manager", "Project Finance Management"],
        body: [
          "The Site Handler tracks each site/cluster through progress, acceptance, goods receipt (GR), invoicing, and handover, with the accepted scope value per site.",
          "Net Sales is estimated automatically from accepted sites that are not yet invoiced, and rolls up to the project dashboard and governance summary.",
        ],
        troubleshooting: ["Only 50 site rows appear: the dashboard shows the most recent rows; use Export for the full list."],
      },
      {
        id: "change-requests",
        title: "Raise and decide change requests",
        roles: ["Project Manager", "Program Director", "Sponsor"],
        body: [
          "Change requests capture scope, schedule, cost, revenue, and risk impact, plus additional budget and add-on sales value.",
          "The Sponsor decision (approve / reject / return) is explicit and confirmed; approved CRs update the project's budget and revenue impact on the dashboards.",
        ],
      },
      {
        id: "quality",
        title: "Quality incidents and governance records",
        roles: ["Quality Manager", "Project Manager", "Program Director"],
        body: [
          "Log incidents with severity, source, owners, root cause, corrective and preventive actions, due date, and RAG impact.",
          "Governance records capture the weekly/monthly review outcomes per workstream — escalations surface on the executive dashboard.",
        ],
      },
      {
        id: "resources-in-execution",
        title: "Plan resources inside project execution",
        roles: ["Resource Manager", "Supply Manager"],
        body: [
          "Resource demand is planned per project: role, skill, location, dates, allocation %, assigned resource, gap status, onboarding status, and timesheet readiness.",
          "Resource management is a tool inside Project Execution — demands link to the project and roll up as resource-gap counts in governance summaries.",
        ],
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce Management",
    intro: "Candidate intake through onboarding, assignment, time tracking, and talent planning — with client-scoped visibility and full auditability.",
    topics: [
      {
        id: "candidates",
        title: "Candidate intake and client feedback",
        roles: ["HR Administrator", "Resource Manager", "Client Approver"],
        body: [
          "Register candidates with position, skills, and target client/project, then submit them for client review.",
          "The client records a rating and decision: Proceed, Hold, or Rejected (with reason). Decisions are visible on the candidate row.",
        ],
        whatHappensNext: "A Proceed decision unlocks Start Onboarding, which converts the candidate into an employee/resource record.",
      },
      {
        id: "onboarding",
        title: "Resource onboarding and readiness",
        roles: ["HR Administrator", "Resource Manager", "Client Approver", "Employee"],
        body: [
          "Onboarding requires acknowledgement of the published NDA, Code of Ethics, Data Privacy Consent, and completion of onboarding training.",
          "Each step needs its published document available; the resource can only be confirmed Ready (by the client or an admin) once all four steps are complete.",
        ],
        troubleshooting: ["Acknowledge is disabled: the corresponding onboarding document has not been published under Documents yet."],
      },
      {
        id: "commercial-terms",
        title: "Commercial terms and contracts",
        roles: ["HR Administrator", "Finance"],
        body: [
          "Record remuneration, bill rate, management fee, recruitment fee, tax type (PPH21/PPH23), and BPJS rates per employee.",
          "Net pay and invoice estimates are recalculated automatically when terms are saved; a contract snapshot is kept in the contract register.",
          "Amounts display in the assignment project's currency; Indonesian statutory items default to IDR.",
        ],
      },
      {
        id: "time",
        title: "Timesheets, overtime, and leave",
        roles: ["Employee", "Resource Manager", "Client Approver", "Payroll"],
        body: [
          "Employees submit timesheets by period — hours are calculated from start and end times. Overtime and leave requests follow the same submit → review → client approval path.",
          "Reviewers set internal and client approval statuses; rejections require a reason, and leave records its timesheet impact for payroll and billing.",
        ],
        whatHappensNext: "Approved timesheets feed GR (service acceptance) records, which in turn feed invoice drafts under GR & Invoices.",
      },
      {
        id: "talent",
        title: "Talent planning and succession",
        roles: ["HR Administrator", "Resource Manager", "Program Director"],
        body: [
          "Import talent data from Excel (name, age, gender, current/expected role, leaving risk, impact) or add records manually.",
          "Readiness (Immediately / 1–2 years / 3–5 years), succession candidacy, certification requirements, and manager readiness support the succession review.",
          "Filter by readiness to build the high-impact / high-leaving-risk watchlist.",
        ],
      },
    ],
  },
];

const GLOSSARY: Array<[string, string]> = [
  ["Opportunity ID", "The single controlled identifier for a deal. All scenarios, costs, risks, pricing, cashflow, SDS, and SDOA records belong to exactly one Opportunity ID."],
  ["Deal Type", "Recurrence, Small, High, or Very High — configurable criteria that drive who presents the SDS and the depth of governance."],
  ["Proposal Scenario", "One commercial alternative for an opportunity, with its own currency, commodity cost lines, totals, and margin."],
  ["Commodity Code", "Cost category for scenario lines: HW, SW, SVC, TRN, MGS, AIS, TMM, OTH."],
  ["Pricing Structure Decision", "The Account Manager's approval of the selected pricing scenario — required before cashflow analysis."],
  ["Cashflow Option", "A dated model of deal economics (invoice, DSO, discount, tax, costs) with derived cash gap, margin, break-even, working-capital days, and NPV."],
  ["DSO", "Days Sales Outstanding — the assumed days between invoice and payment."],
  ["Cash Gap", "The most negative point of cumulative cashflow across the deal — the peak funding requirement."],
  ["NPV", "Net present value of the deal's cash events at the stated annual discount rate."],
  ["SDS", "Sales Decision for Submission — the Sponsor-approved decision to submit the proposal."],
  ["SDOA", "Sales Decision Order Acknowledgement — validation of the received PO/contract against the SDS baseline."],
  ["Gate", "One of five execution checkpoints (Establishment, Execution Validation, Ready to Acceptance, Ready to Handover, Closure), each Sponsor-approved."],
  ["RAG", "Red / Amber / Green status classification used on gates and quality impact."],
  ["Site / Cluster", "A deliverable unit tracked through progress, acceptance, GR, invoice, and handover."],
  ["GR", "Goods Receipt / service acceptance confirmation from the customer, prerequisite to invoicing."],
  ["Net Sales Estimate", "Value of accepted sites not yet invoiced, calculated automatically."],
  ["Change Request (CR)", "A Sponsor-approved change to project scope, schedule, cost, or revenue baseline."],
  ["Ratecard", "Hourly resource cost by type and currency, derived from salary and absorbed costs plus markup."],
  ["Blended Rate", "Weighted hourly cost across location, work mode, and seniority mix."],
  ["Framework Version", "The versioned snapshot of admin settings an opportunity or project was created under."],
];

const LIFECYCLE: Array<[string, string]> = [
  ["Draft", "Being analyzed — scenarios, costs, and risks are still being built."],
  ["Submitted", "Analysis submitted; awaiting pricing structure approval."],
  ["Pricing Approved", "Account Manager approved the pricing structure decision."],
  ["Ready for Cashflow", "Open for Commercial Manager cashflow options."],
  ["Approved", "Commercially approved — eligible for SDS creation."],
];

const FAQS: Array<[string, string]> = [
  ["Why can't I create a cashflow option for my opportunity?", "Only opportunities that passed pricing approval are eligible. Use the workflow actions on the opportunity page to move it forward first."],
  ["Why is the Create Project form not showing my deal?", "Projects can only be created from an acknowledged SDOA. Check the Order Acknowledgement module for the Sponsor decision."],
  ["I closed a form by accident — is my input lost?", "No. Dialogs with unsaved changes don't close on outside clicks, and Escape or Cancel asks for confirmation before discarding."],
  ["Why is a value shown as 'Mixed currencies'?", "That total would sum projects with different registered currencies, which isn't a meaningful single amount. Open the module's table for per-project values."],
  ["Who can approve an SDS or SDOA?", "The Sponsor (or an authorized governance role). Approve/Reject buttons only appear for roles with that authority."],
  ["Can I edit an approved cashflow option?", "No — approved options are locked as the commercial baseline. Create a new option instead."],
  ["Where do I see what changed and who changed it?", "Admins can open the Audit Logs tab in the Admin Control Plane; every approval and configuration change is recorded."],
];

export function KnowledgeGuide({ role }: { role: RoleId }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      topics: section.topics.filter((topic) =>
        [topic.title, ...topic.roles, ...topic.body, ...(topic.steps || []), topic.whatHappensNext || "", ...(topic.troubleshooting || [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    })).filter((section) => section.topics.length > 0);
  }, [normalizedQuery]);

  const filteredGlossary = useMemo(
    () => GLOSSARY.filter(([term, definition]) => !normalizedQuery || `${term} ${definition}`.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );
  const filteredFaqs = useMemo(
    () => FAQS.filter(([question, answer]) => !normalizedQuery || `${question} ${answer}`.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600" /> Sevenfold Knowledge Guide</CardTitle>
              <CardDescription>
                Task-based operating procedures for sales management, integrated delivery governance, and workforce management.
                Signed in as {humanRole(role)} — topics relevant to your role are tagged below.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder="Search the guide…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search the knowledge guide"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="sales">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="sales">Sales Management</TabsTrigger>
          <TabsTrigger value="delivery">Delivery &amp; Governance</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle &amp; Statuses</TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="faq">FAQ &amp; Troubleshooting</TabsTrigger>
        </TabsList>

        {SECTIONS.map((section) => {
          const filtered = filteredSections.find((item) => item.id === section.id);
          return (
            <TabsContent key={section.id} value={section.id} className="grid gap-4">
              <p className="text-sm text-muted-foreground">{section.intro}</p>
              {(filtered?.topics || []).map((topic) => <TopicCard key={topic.id} topic={topic} />)}
              {normalizedQuery && !filtered && (
                <p className="text-sm text-muted-foreground">No topics in this section match “{query}”.</p>
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="lifecycle" className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunity lifecycle</CardTitle>
              <CardDescription>Status only changes through explicit workflow actions — each move validates its entry criteria and is audited.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {LIFECYCLE.map(([status, meaning], index) => (
                <div key={status} className="flex items-start gap-3 rounded-md border p-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{index + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{status}</div>
                    <div className="text-sm text-muted-foreground">{meaning}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution gates</CardTitle>
              <CardDescription>Every gate is initiated by the PM/Program Director and approved by the Sponsor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                ["Gate 1 — Establishment", "Project setup: charter, milestone plan, resource plan, finance baseline, site tracker."],
                ["Gate 2 — Execution Validation", "Resources allocated, procurement started, weekly tracking and change control active."],
                ["Gate 3 — Ready to Acceptance", "Scope delivered, quality resolved, acceptance evidence and net-sales calculation prepared."],
                ["Gate 4 — Ready to Handover", "Acceptance completed, GR received or in progress, invoice package prepared."],
                ["Gate 5 — Closure", "Handover done, invoicing tracked, lessons learned and final finance report approved."],
              ].map(([gate, meaning], index) => (
                <div key={gate} className="flex items-start gap-3 rounded-md border p-3">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">{index + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{gate}</div>
                    <div className="text-sm text-muted-foreground">{meaning}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="glossary">
          <Card>
            <CardContent className="grid gap-1 p-4">
              {filteredGlossary.map(([term, definition]) => (
                <div key={term} className="grid grid-cols-[180px_1fr] gap-3 border-b py-2.5 text-sm last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1">
                  <div className="font-medium">{term}</div>
                  <div className="text-muted-foreground">{definition}</div>
                </div>
              ))}
              {!filteredGlossary.length && <p className="py-4 text-sm text-muted-foreground">No glossary entries match “{query}”.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="grid gap-3">
          {filteredFaqs.map(([question, answer]) => (
            <Card key={question}>
              <CardContent className="p-4">
                <div className="text-sm font-medium">{question}</div>
                <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
              </CardContent>
            </Card>
          ))}
          {!filteredFaqs.length && <p className="text-sm text-muted-foreground">No FAQ entries match “{query}”.</p>}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TopicCard({ topic }: { topic: GuideTopic }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{topic.title}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {topic.roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {topic.body.map((paragraph) => <p key={paragraph.slice(0, 40)} className="leading-relaxed">{paragraph}</p>)}
        {topic.steps && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step by step</div>
            <ol className="grid gap-1 ps-5" style={{ listStyleType: "decimal" }}>
              {topic.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}
        {topic.whatHappensNext && (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happens next</div>
            <p className="mt-1">{topic.whatHappensNext}</p>
          </div>
        )}
        {topic.troubleshooting && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Troubleshooting</div>
            <ul className="grid gap-1 ps-5" style={{ listStyleType: "disc" }}>
              {topic.troubleshooting.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function humanRole(role?: string) {
  if (!role) return "member";
  return role.replace(/^ROLE_/, "").toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
