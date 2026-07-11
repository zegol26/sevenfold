import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/services/userService";
import { writeAudit } from "@/services/auditService";

export async function GET() {
  const session = await getSession();
  if (!session?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const user = await findUserByEmail(session.email);
  if (!user || user.status !== "ACTIVE" || !canExport(user.role.code)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!user.organizationId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const opportunities = await getOpportunityRowsForExport(user.organizationId);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(opportunities.map((opportunity) => ({
    opportunity_id: opportunity.opportunityCode,
    customer_name: opportunity.customerName,
    deal_type: opportunity.dealType || "",
    opportunity_status: opportunity.status,
    owner: opportunity.accountManager || "",
    solution_architect: opportunity.solutionArchitect || "",
    scope_summary: opportunity.scopeSummary || "",
    created_at: opportunity.createdAt.toISOString(),
  }))), "Opportunities");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(opportunities.flatMap((opportunity) => opportunity.scenarios.map((scenario) => ({
    opportunity_id: opportunity.opportunityCode,
    scenario_id: scenario.scenarioCode,
    scenario_name: scenario.name,
    currency: scenario.currency,
    total_cost: String(scenario.totalCost),
    total_price: String(scenario.totalPrice),
    gross_margin: scenario.grossMargin ? String(scenario.grossMargin) : "",
    status: scenario.status,
  })))), "Scenarios");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(opportunities.flatMap((opportunity) => opportunity.scenarios.flatMap((scenario) => scenario.commodityLines.map((line) => ({
    opportunity_id: opportunity.opportunityCode,
    scenario_id: scenario.scenarioCode,
    commodity_code: line.commodityCode,
    description: line.description || "",
    quantity: String(line.quantity),
    unit_cost: String(line.unitCost),
    unit_price: String(line.unitPrice),
    resource_cost: String(line.resourceCost),
    partner_cost: String(line.partnerCost),
    procurement_cost: String(line.procurementCost),
    project_cost: String(line.projectCost),
  }))))), "Commodity Costs");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(opportunities.flatMap((opportunity) => opportunity.risks.map((risk) => ({
    opportunity_id: opportunity.opportunityCode,
    risk_id: risk.riskCode,
    risk_title: risk.description,
    risk_domain: risk.domain,
    linked_commodity: risk.commodityCode || "",
    probability: risk.probabilityScore ? String(risk.probabilityScore) : "",
    impact: String(risk.impactCost),
    exposure_before_mitigation: String(risk.impactCost),
    mitigation_plan: risk.mitigationPlan || "",
    mitigation_cost: String(risk.mitigationCost),
    exposure_after_mitigation: String(risk.riskCostAfterMitigation),
    predicted_occurrence_date: risk.predictedOccurrenceDate?.toISOString().slice(0, 10) || "",
    severity: risk.severity || "",
    status: risk.status,
  })))), "Risk Register");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(opportunities.flatMap((opportunity) => opportunity.pricingDecisions.map((decision) => ({
    opportunity_id: opportunity.opportunityCode,
    scenario_id: decision.scenario?.scenarioCode || "",
    decision: decision.decision,
    comment: decision.comment || "",
    status: decision.status,
    created_at: decision.createdAt.toISOString(),
  })))), "Pricing Decisions");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(bytes);
  await writeAudit({ actorId: user.id, action: "EXPORT_OPPORTUNITY_ANALYSIS_XLSX", entityType: "opportunity", entityId: "all", after: { count: opportunities.length } });
  return new NextResponse(body, {
    headers: {
      "Content-Disposition": `attachment; filename="sevenfold-opportunity-analysis-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function getOpportunityRowsForExport(organizationId: string) {
  try {
    return await getDb().opportunity.findMany({
      where: { organizationId },
      include: {
        scenarios: { include: { commodityLines: true } },
        risks: true,
        pricingDecisions: { include: { scenario: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingPrismaTableError(error)) return [];
    throw error;
  }
}

function isMissingPrismaTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "P2021" || Boolean(maybeError.message?.includes("does not exist in the current database"));
}

function canExport(roleCode: string) {
  return [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_ACCOUNT_MANAGER",
    "ROLE_SOLUTION_ARCHITECT",
    "ROLE_COMMERCIAL_MANAGER",
    "ROLE_PROGRAM_DIRECTOR",
    "ROLE_AUDITOR",
  ].includes(roleCode);
}
