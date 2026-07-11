import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getSession } from "@/lib/session";
import { calculateNetSales, getProjectExecutionRegistry } from "@/services/projectExecutionService";
import { findUserByEmail } from "@/services/userService";
import { writeAudit } from "@/services/auditService";

export async function GET() {
  const session = await getSession();
  if (!session?.email) return new NextResponse("Unauthorized", { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.status !== "ACTIVE" || !canExport(user.role.code)) return new NextResponse("Forbidden", { status: 403 });
  if (!user.organizationId) return new NextResponse("Forbidden", { status: 403 });

  const registry = await getProjectExecutionRegistry(user.organizationId);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(registry.projects.map((project) => ({
    ...project,
    netSalesEstimate: calculateNetSales(registry.sites.filter((site) => site.projectId === project.projectId)),
  }))), "Projects");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(registry.gates), "Gates");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(registry.sites), "Site Handler");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(registry.resourceDemands), "Resource Demand");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(registry.commercialFlows), "Commercial Flow");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { guardrail: "pagination", implementation: "Dashboard slices site, resource, and commercial tables to 50 rows." },
    { guardrail: "on_demand_export", implementation: "Workbook is generated only when the user clicks export." },
    { guardrail: "secret_safe_logs", implementation: "Audit logs export counts only." },
  ]), "Cost Guardrails");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await writeAudit({ actorId: user.id, action: "EXPORT_PROJECT_EXECUTION_XLSX", entityType: "project_execution", entityId: "all", after: { projects: registry.projects.length, sites: registry.sites.length, resources: registry.resourceDemands.length, commercialFlows: registry.commercialFlows.length } });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="sevenfold-project-execution-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function canExport(roleCode: string) {
  return [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_PROJECT_MANAGER",
    "ROLE_PROGRAM_DIRECTOR",
    "ROLE_PROJECT_FINANCE_MANAGER",
    "ROLE_SPONSOR",
    "ROLE_AUDITOR",
  ].includes(roleCode);
}
