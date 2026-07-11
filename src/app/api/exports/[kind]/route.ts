import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { RecordMap } from "@/lib/types";
import { writeAudit } from "@/services/auditService";
import { getDeliveryGovernanceRegistry } from "@/services/deliveryGovernanceService";
import { calculateNetSales, getProjectExecutionRegistry } from "@/services/projectExecutionService";
import { getRatecardRegistry } from "@/services/ratecardService";
import { getTalentPlanningRegistry } from "@/services/talentPlanningService";
import { findUserByEmail } from "@/services/userService";

const EXPORT_KINDS = new Set([
  "opportunity-summary",
  "risk-register",
  "cashflow-summary",
  "sds-summary",
  "sdoa-delta",
  "project-dashboard",
  "site-handler",
  "governance-report",
  "talent-planning",
  "ratecard",
]);

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session?.email) return new NextResponse("Unauthorized", { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.status !== "ACTIVE" || !canExport(user.role.code)) return new NextResponse("Forbidden", { status: 403 });
  if (!user.organizationId) return new NextResponse("Forbidden", { status: 403 });
  const organizationId = user.organizationId;
  const { kind } = await context.params;
  if (!EXPORT_KINDS.has(kind)) return new NextResponse("Unknown export kind", { status: 404 });

  const workbook = XLSX.utils.book_new();
  const rows = await rowsForKind(organizationId, kind);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName(kind));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { guardrail: "on_demand_only", value: "Export is generated only after user click." },
    { guardrail: "no_background_polling", value: "No polling or scheduled export job is used." },
    { guardrail: "secret_safe_logs", value: "Audit stores counts and kind only, not secrets or full documents." },
  ]), "Cost Guardrails");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await writeAudit({ actorId: user.id, action: "EXPORT_SEVENFOLD_XLSX", entityType: "export", entityId: kind, after: { rows: rows.length } });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="sevenfold-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function rowsForKind(organizationId: string, kind: string): Promise<RecordMap[]> {
  if (kind === "project-dashboard") {
    const registry = await getProjectExecutionRegistry(organizationId);
    return registry.projects.map((project) => ({
      project_id: project.projectId,
      customer: project.customer,
      leader: project.projectLeader,
      net_sales_estimate: String(calculateNetSales(registry.sites.filter((site) => site.projectId === project.projectId))),
      resource_gaps: String(registry.resourceDemands.filter((demand) => demand.projectId === project.projectId && demand.gapStatus !== "filled").length),
      pending_commercial: String(registry.commercialFlows.filter((flow) => flow.projectId === project.projectId && !["approved", "closed"].includes(flow.approvalStatus)).length),
      status: project.status,
    }));
  }
  if (kind === "site-handler") return (await getProjectExecutionRegistry(organizationId)).sites as unknown as RecordMap[];
  if (kind === "governance-report") {
    const governance = await getDeliveryGovernanceRegistry(organizationId);
    return [...governance.governanceRecords, ...governance.changeRequests, ...governance.incidents] as unknown as RecordMap[];
  }
  if (kind === "talent-planning") return (await getTalentPlanningRegistry(organizationId)).talents as unknown as RecordMap[];
  if (kind === "ratecard") return (await getRatecardRegistry(organizationId)).resources as unknown as RecordMap[];
  return safeOpportunityRows(organizationId, kind);
}

async function safeOpportunityRows(organizationId: string, kind: string): Promise<RecordMap[]> {
  try {
    if (kind === "opportunity-summary") {
      const rows = await getDb().opportunity.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 500 });
      return rows.map((row) => ({ opportunity_id: row.opportunityCode, customer: row.customerName, deal_type: row.dealType || "", status: row.status }));
    }
    if (kind === "risk-register") {
      const rows = await getDb().riskRegister.findMany({ where: { opportunity: { organizationId } }, include: { opportunity: true }, orderBy: { createdAt: "desc" }, take: 1000 });
      return rows.map((row) => ({ opportunity_id: row.opportunity.opportunityCode, risk_id: row.riskCode, domain: row.domain, commodity: row.commodityCode || "", exposure_after_mitigation: String(row.riskCostAfterMitigation || ""), status: row.status }));
    }
    if (kind === "cashflow-summary") {
      const rows = await getDb().cashflowOption.findMany({ where: { opportunity: { organizationId } }, include: { opportunity: true }, orderBy: { createdAt: "desc" }, take: 500 });
      return rows.map((row) => ({ opportunity_id: row.opportunity.opportunityCode, option_id: row.optionCode, gross_invoice: String(row.grossInvoice), cash_gap: String(row.cashGap), margin: String(row.marginAmount), status: row.status }));
    }
    if (kind === "sds-summary") {
      const rows = await getDb().salesDecisionSubmission.findMany({ where: { opportunity: { organizationId } }, include: { opportunity: true }, orderBy: { createdAt: "desc" }, take: 500 });
      return rows.map((row) => ({ opportunity_id: row.opportunity.opportunityCode, sds_id: row.id, decision: row.decision, sponsor: row.sponsor || "", decided_at: row.decidedAt?.toISOString() || "" }));
    }
    if (kind === "sdoa-delta") {
      const rows = await getDb().contractDeviation.findMany({ where: { orderAcknowledgement: { opportunity: { organizationId } } }, include: { orderAcknowledgement: { include: { opportunity: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        opportunity_id: row.orderAcknowledgement.opportunity.opportunityCode,
        sdoa_id: row.orderAcknowledgement.id,
        category: row.category,
        baseline_value: row.baselineValue || "",
        received_value: row.receivedValue || "",
        decision: row.decision,
        comment: row.comment || "",
      }));
    }
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return [];
}

function sheetName(kind: string) {
  return kind.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ").slice(0, 31);
}

function canExport(roleCode: string) {
  return [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_PROJECT_MANAGER",
    "ROLE_PROGRAM_DIRECTOR",
    "ROLE_PROJECT_FINANCE_MANAGER",
    "ROLE_COMMERCIAL_MANAGER",
    "ROLE_FINANCE_CONTROLLER",
    "ROLE_RESOURCE_MANAGER",
    "ROLE_HR_ADMIN",
    "ROLE_HR_ADMINISTRATOR",
    "ROLE_SPONSOR",
    "ROLE_AUDITOR",
  ].includes(roleCode);
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "P2021" || Boolean(maybeError.message?.includes("does not exist in the current database"));
}
