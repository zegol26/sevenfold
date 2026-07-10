import { DashboardClient } from "@/components/dashboard-client";
import { isSuperAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { defaultFrameworkControlPlane } from "@/lib/framework-defaults";
import { getSession } from "@/lib/session";
import type { FrameworkControlPlane, Option, RoleId } from "@/lib/types";
import type { DashboardData, RecordMap } from "@/lib/types";
import { computeGovernanceSummary, getDeliveryGovernanceRegistry } from "@/services/deliveryGovernanceService";
import { getActiveFrameworkSettings } from "@/services/frameworkSettingsService";
import { calculateNetSales, getProjectExecutionRegistry } from "@/services/projectExecutionService";
import { getRatecardRegistry } from "@/services/ratecardService";
import { getTalentPlanningRegistry } from "@/services/talentPlanningService";
import { getTemplateRegistry } from "@/services/templateManagementService";

export const dynamic = "force-dynamic";

type DashboardUserRow = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  legacySourceId: string | null;
  role: { code: string; permissions: unknown };
  client?: { legacySourceId: string | null; code: string } | null;
  resource?: { legacySourceId: string | null; id: string } | null;
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; login_error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const data = await getDashboardData();

  if (data.setupError) {
    return <SetupState message={data.setupError} />;
  }

  if (!data.user) {
    return <LoginPage error={params.login_error} sessionEmail={data.sessionEmail} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardClient data={data} initialSection={params.section} isSuperAdmin={isSuperAdmin(data.user)} />
    </div>
  );
}

async function getDashboardData(): Promise<DashboardData> {
  try {
    const session = await getSession();
    if (!session?.email) {
      return { ...emptyData(null), sessionEmail: session?.email || "" };
    }

    return getDashboardDataFromDb(session.email);
  } catch (error) {
    return {
      ...emptyData(null),
      setupError: error instanceof Error ? error.message : "Unknown setup error",
    };
  }
}

async function getDashboardDataFromDb(email: string): Promise<DashboardData> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { role: true, client: true, resource: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return { ...emptyData(null), sessionEmail: email };
  }

  const [
    users,
    clients,
    projects,
    resources,
    assignments,
    invoices,
    documents,
    feedbacks,
    timesheets,
    overtimeRequests,
    leaveRequests,
    grRecords,
    projectApplications,
    opportunities,
    opportunityFrameworkVersionSettings,
    projectExecutionRegistry,
    deliveryGovernanceRegistry,
    talentPlanningRegistry,
    ratecardRegistry,
    frameworkControlPlane,
    templateRegistry,
    auditLogs,
  ] = await Promise.all([
    db.user.findMany({
      where: { status: { not: "DELETED" } },
      include: { role: true, client: true, resource: true },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.project.findMany({ include: { client: true }, orderBy: { name: "asc" } }),
    db.resource.findMany({ orderBy: { createdAt: "desc" } }),
    db.assignment.findMany({ include: { client: true, project: true, resource: true }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ include: { client: true, project: true, grRecord: true }, orderBy: { createdAt: "desc" } }),
    db.document.findMany({ orderBy: { createdAt: "desc" } }),
    db.clientFeedback.findMany({ include: { candidate: true, client: true, project: true }, orderBy: { createdAt: "desc" } }),
    db.timesheet.findMany({ include: { resource: true, assignment: true }, orderBy: { createdAt: "desc" } }),
    db.overtimeRequest.findMany({ include: { resource: true, assignment: true }, orderBy: { createdAt: "desc" } }),
    db.leaveRequest.findMany({ include: { resource: true, assignment: true }, orderBy: { createdAt: "desc" } }),
    db.grRecord.findMany({ include: { client: true, project: true }, orderBy: { createdAt: "desc" } }),
    db.projectApplication.findMany({ include: { resource: true, project: { include: { client: true } } }, orderBy: { createdAt: "desc" } }),
    getOpportunityDashboardRows(),
    safeFindSystemSettingsByPrefix("sevenfold.entity_framework_version.opportunity."),
    getProjectExecutionRegistry(),
    getDeliveryGovernanceRegistry(),
    getTalentPlanningRegistry(),
    getRatecardRegistry(),
    getFrameworkControlPlane(),
    getTemplateRegistry(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { actor: true } }),
  ]);

  const latestFeedbackByCandidate = new Map(feedbacks.map((feedback) => [feedback.candidateId, feedback]));
  const candidates = resources
    .filter((row) => row.kind === "CANDIDATE")
    .map((resource) => resourceToCandidateRecord(resource, latestFeedbackByCandidate.get(resource.id)));
  const employees = resources.filter((row) => row.kind !== "CANDIDATE").map(resourceToEmployeeRecord);
  const matchedEmployeeResource = user.resource || resources.find((resource) => (
    resource.kind !== "CANDIDATE" &&
    resource.email?.toLowerCase() === user.email.toLowerCase()
  )) || null;
  const userRecord = {
    ...userToAppUser(user),
    employee_id: userToAppUser(user).employee_id || matchedEmployeeResource?.legacySourceId || matchedEmployeeResource?.id || "",
  };
  const isEmployee = user.role.code === "ROLE_EMPLOYEE";
  const isClientRole = user.role.code === "ROLE_CLIENT_APPROVER" || user.role.code === "ROLE_CLIENT_FINANCE_VIEWER";
  const isSuperAdmin = user.role.code === "ROLE_SUPER_ADMIN";
  const isAdminRole = [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_TEMPLATE_ADMIN",
    "ROLE_AUDITOR",
    "ROLE_HR_ADMIN",
    "ROLE_HR_ADMINISTRATOR",
    "ROLE_PAYROLL_ADMIN_OPS",
  ].includes(user.role.code);
  const userResourceId = matchedEmployeeResource?.id || "";
  const userEmployeeId = matchedEmployeeResource?.legacySourceId || matchedEmployeeResource?.id || "";
  const userClientId = user.client?.legacySourceId || user.client?.code || "";
  const scopedCandidates = isClientRole && userClientId
    ? candidates.filter((candidate) => candidate.client_id === userClientId)
    : isEmployee
      ? []
      : candidates;
  const scopedEmployees = isEmployee
    ? employees.filter((employee) => employee.employee_id === userEmployeeId)
    : isClientRole && userClientId
      ? employees.filter((employee) => employee.assigned_client_id === userClientId)
      : employees;
  const scopedAssignments = isEmployee
    ? assignments.filter((assignment) => assignment.resourceId === userResourceId)
    : isClientRole && userClientId
      ? assignments.filter((assignment) => (assignment.client.legacySourceId || assignment.client.code) === userClientId)
      : assignments;
  const scopedTimesheets = isEmployee
    ? timesheets.filter((timesheet) => timesheet.resourceId === userResourceId)
    : isClientRole && userClientId
      ? timesheets.filter((timesheet) => scopedAssignments.some((assignment) => assignment.id === timesheet.assignmentId))
      : timesheets;
  const scopedOvertimeRequests = isEmployee
    ? overtimeRequests.filter((overtime) => overtime.resourceId === userResourceId)
    : isClientRole && userClientId
      ? overtimeRequests.filter((overtime) => scopedAssignments.some((assignment) => assignment.id === overtime.assignmentId))
      : overtimeRequests;
  const scopedLeaveRequests = isEmployee
    ? leaveRequests.filter((leave) => leave.resourceId === userResourceId)
    : isClientRole && userClientId
      ? leaveRequests.filter((leave) => scopedAssignments.some((assignment) => assignment.id === leave.assignmentId))
      : leaveRequests;
  const scopedProjectApplications = isEmployee
    ? projectApplications.filter((application) => application.resourceId === userResourceId)
    : isClientRole && userClientId
      ? projectApplications.filter((application) => (application.project.client.legacySourceId || application.project.client.code) === userClientId)
      : projectApplications;
  const scopedDocuments = isEmployee
    ? documents.filter((document) => document.entityType === "EMPLOYEE" && document.entityId === userEmployeeId)
    : isClientRole
      ? []
      : documents;
  const scopedGrRecords = isClientRole && userClientId
    ? grRecords.filter((gr) => (gr.client.legacySourceId || gr.client.code) === userClientId)
    : isEmployee
      ? []
      : grRecords;
  const scopedInvoices = isClientRole && userClientId
    ? invoices.filter((invoice) => (invoice.client.legacySourceId || invoice.client.code) === userClientId)
    : isEmployee
      ? []
      : invoices;

  const clientOptions: Option[] = clients.map((client) => ({
    id: client.legacySourceId || client.code,
    label: client.name,
    meta: client.code,
  }));
  const projectOptions: Option[] = projects.map((project) => ({
    id: project.legacySourceId || project.code,
    label: project.name,
    meta: project.client.legacySourceId || project.client.code,
    currency: project.currency || "USD",
  }));
  const opportunityAnalysis = mapOpportunityAnalysis(opportunities, opportunityFrameworkVersionSettings);
  const changeRequestsByProject = new Map<string, { additionalBudget: number; additionalRevenue: number }>();
  deliveryGovernanceRegistry.changeRequests
    .filter((cr) => cr.approvalStatus === "approved")
    .forEach((cr) => {
      const current = changeRequestsByProject.get(cr.projectId) || { additionalBudget: 0, additionalRevenue: 0 };
      current.additionalBudget += Number(cr.additionalBudget || 0);
      current.additionalRevenue += Number(cr.addOnSalesValue || 0);
      changeRequestsByProject.set(cr.projectId, current);
    });
  const executionForDashboard = {
    ...projectExecutionRegistry,
    projects: projectExecutionRegistry.projects.map((project) => {
      const crImpact = changeRequestsByProject.get(project.projectId);
      return {
        ...project,
        netSalesEstimate: String(calculateNetSales(projectExecutionRegistry.sites.filter((site) => site.projectId === project.projectId))),
        additionalBudget: String(crImpact?.additionalBudget || Number(project.additionalBudget || 0)),
        additionalRevenue: String(crImpact?.additionalRevenue || Number(project.additionalRevenue || 0)),
      };
    }),
    sites: projectExecutionRegistry.sites.slice(0, 50),
    resourceDemands: projectExecutionRegistry.resourceDemands.slice(0, 50),
    commercialFlows: projectExecutionRegistry.commercialFlows.slice(0, 50),
  };

  return {
    user: userRecord,
    sessionEmail: email,
    metrics: {
      candidates: scopedCandidates.length,
      employees: scopedEmployees.length,
      pendingFeedback: scopedCandidates.filter((candidate) => !candidate.decision).length,
      readyResources: scopedEmployees.filter((employee) => employee.resource_ready_at).length,
      timesheets: scopedTimesheets.length,
      pendingApprovals: scopedTimesheets.filter((row) => row.status === "submitted").length + scopedOvertimeRequests.filter((row) => row.status === "submitted").length + scopedLeaveRequests.filter((row) => row.status === "submitted").length,
      overtimeRequests: scopedOvertimeRequests.length,
      leaveRequests: scopedLeaveRequests.length,
      invoices: scopedInvoices.length,
    },
    users: isSuperAdmin ? users.map(userToRecord) : [],
    clients: clientOptions,
    projects: projectOptions,
    candidates: scopedCandidates,
    employees: scopedEmployees,
    employee_documents: scopedDocuments.filter((document) => document.entityType === "EMPLOYEE").map(documentToRecord),
    onboarding_documents: documents.filter((document) => document.entityType === "ONBOARDING_TEMPLATE").map(documentToRecord),
    employee_contracts: [],
    candidate_documents: isAdminRole ? scopedDocuments.filter((document) => document.entityType === "CANDIDATE").map(documentToRecord) : [],
    assignments: scopedAssignments.map((assignment) => ({
      assignment_id: assignment.legacySourceId || assignment.id,
      employee_id: assignment.resource.legacySourceId || assignment.resource.id,
      client_id: assignment.client.legacySourceId || assignment.client.code,
      project_id: assignment.project.legacySourceId || assignment.project.code,
      role_title: assignment.roleTitle || "",
      start_date: formatDbDate(assignment.startDate),
      end_date: formatDbDate(assignment.endDate),
      status: assignment.status,
      created_at: assignment.createdAt.toISOString(),
    })),
    timesheets: scopedTimesheets.map((timesheet) => ({
      timesheet_id: timesheet.legacySourceId || timesheet.id,
      employee_id: timesheet.resource.legacySourceId || timesheet.resource.id,
      assignment_id: timesheet.assignment?.legacySourceId || timesheet.assignment?.id || "",
      period_start: formatDbDateTime(timesheet.periodStart),
      period_end: formatDbDateTime(timesheet.periodEnd),
      total_hours: decimalToString(timesheet.totalHours),
      nexus_review_status: timesheet.nexusReviewStatus,
      client_approval_status: timesheet.clientApprovalStatus,
      rejection_reason: timesheet.rejectionReason || "",
      status: timesheet.status,
      created_at: timesheet.createdAt.toISOString(),
    })),
    overtime_requests: scopedOvertimeRequests.map((overtime) => ({
      overtime_id: overtime.legacySourceId || overtime.id,
      employee_id: overtime.resource.legacySourceId || overtime.resource.id,
      assignment_id: overtime.assignment?.legacySourceId || overtime.assignment?.id || "",
      request_date: formatDbDate(overtime.requestDate),
      start_at: formatDbDateTime(overtime.startAt),
      end_at: formatDbDateTime(overtime.endAt),
      hours: decimalToString(overtime.hours),
      reason: overtime.reason || "",
      nexus_validation_status: overtime.nexusValidationStatus,
      client_approval_status: overtime.clientApprovalStatus,
      rejection_reason: overtime.rejectionReason || "",
      status: overtime.status,
      created_at: overtime.createdAt.toISOString(),
    })),
    leave_requests: scopedLeaveRequests.map((leave) => ({
      leave_id: leave.legacySourceId || leave.id,
      employee_id: leave.resource.legacySourceId || leave.resource.id,
      assignment_id: leave.assignment?.legacySourceId || leave.assignment?.id || "",
      leave_type: leave.leaveType,
      start_date: formatDbDate(leave.startDate),
      end_date: formatDbDate(leave.endDate),
      total_days: decimalToString(leave.totalDays),
      reason: leave.reason || "",
      hr_review_status: leave.hrReviewStatus,
      client_approval_status: leave.clientApprovalStatus,
      timesheet_impact: leave.timesheetImpact || "",
      rejection_reason: leave.rejectionReason || "",
      status: leave.status,
      created_at: leave.createdAt.toISOString(),
    })),
    gr_records: scopedGrRecords.map((gr) => ({
      gr_id: gr.legacySourceId || gr.id,
      client_id: gr.client.legacySourceId || gr.client.code,
      project_id: gr.project?.legacySourceId || gr.project?.code || "",
      period_month: gr.periodMonth,
      work_summary: gr.workSummary || "",
      approved_timesheet_ids: gr.approvedTimesheetIds || "",
      service_acceptance_status: gr.serviceAcceptanceStatus,
      drive_file_id: gr.driveFileId || "",
      status: gr.status,
      created_at: gr.createdAt.toISOString(),
    })),
    invoices: scopedInvoices.map((invoice) => ({
      invoice_id: invoice.legacySourceId || invoice.id,
      client_id: invoice.client.legacySourceId || invoice.client.code,
      project_id: invoice.project?.legacySourceId || invoice.project?.code || "",
      invoice_number: invoice.invoiceNumber,
      invoice_date: formatDbDate(invoice.invoiceDate),
      due_date: formatDbDate(invoice.dueDate),
      currency: invoice.currency,
      subtotal: decimalToString(invoice.subtotal),
      tax_amount: decimalToString(invoice.taxAmount),
      total_amount: decimalToString(invoice.totalAmount),
      management_fee_amount: decimalToString(invoice.managementFeeAmount),
      recruitment_fee: decimalToString(invoice.recruitmentFeeAmount),
      invoice_status: invoice.status,
      payment_status: invoice.paymentStatus,
      status: String(invoice.status).toLowerCase(),
      created_at: invoice.createdAt.toISOString(),
    })),
    invoice_lines: [],
    project_applications: scopedProjectApplications.map((application) => ({
      application_id: application.legacySourceId || application.id,
      employee_id: application.resource.legacySourceId || application.resource.id,
      project_id: application.project.legacySourceId || application.project.code,
      client_id: application.project.client.legacySourceId || application.project.client.code,
      role_interest: application.roleInterest || "",
      availability_date: formatDbDate(application.availabilityDate),
      notes: application.notes || "",
      review_status: application.status,
      status: application.status,
      created_at: application.createdAt.toISOString(),
    })),
    opportunity_analysis: opportunityAnalysis,
    project_execution: executionForDashboard,
    delivery_governance: isEmployee ? { changeRequests: [], incidents: [], governanceRecords: [] } : deliveryGovernanceRegistry,
    governance_summary: computeGovernanceSummary(deliveryGovernanceRegistry, projectExecutionRegistry),
    talent_planning: isEmployee || isClientRole ? { talents: [] } : talentPlanningRegistry,
    ratecard: isEmployee || isClientRole ? { resources: [], fxRates: [], fxUpdatedAt: "" } : ratecardRegistry,
    framework_settings: frameworkControlPlane,
    template_management: isAdminRole ? templateRegistry : { templates: [] },
    audit_logs: isAdminRole ? auditLogs.map((audit) => ({
      audit_id: audit.id,
      actor: audit.actor?.email || "",
      action: audit.action,
      entity_type: audit.entityType,
      entity_id: audit.entityId || "",
      reason: auditMetadataValue(audit.metadata, "reason"),
      approval_reference: auditMetadataValue(audit.metadata, "approval_reference"),
      created_at: audit.createdAt.toISOString(),
    })) : [],
  };
}

function mapOpportunityAnalysis(opportunities: Array<{
  id: string;
  opportunityCode: string;
  customerName: string;
  customerSegment: string | null;
  accountManager: string | null;
  solutionArchitect: string | null;
  dealType: string | null;
  scopeSummary: string | null;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  scenarios: Array<{
    id: string;
    opportunityId: string;
    scenarioCode: string;
    name: string;
    description: string | null;
    currency: string;
    totalCost: unknown;
    totalPrice: unknown;
    grossMargin: unknown;
    status: string;
    commodityLines: Array<{
      id: string;
      commodityCode: string;
      description: string | null;
      quantity: unknown;
      unitCost: unknown;
      unitPrice: unknown;
      resourceCost: unknown;
      partnerCost: unknown;
      procurementCost: unknown;
      projectCost: unknown;
    }>;
  }>;
  risks: Array<{
    id: string;
    riskCode: string;
    domain: string;
    commodityCode: string | null;
    description: string;
    probabilityScore: unknown;
    impactCost: unknown;
    mitigationPlan: string | null;
    mitigationCost: unknown;
    residualExposure: unknown;
    riskCostAfterMitigation: unknown;
    predictedOccurrenceDate: Date | null;
    severity: string | null;
    status: string;
  }>;
  pricingDecisions: Array<{
    id: string;
    scenarioId: string | null;
    scenario: { scenarioCode: string } | null;
    decision: string;
    comment: string | null;
    status: string;
  }>;
  cashflowOptions: Array<{
    id: string;
    optionCode: string;
    name: string;
    currency: string;
    dsoDays: number;
    grossInvoice: unknown;
    discountAmount: unknown;
    withholdingTax: unknown;
    cashGap: unknown;
    marginAmount: unknown;
    npv: unknown;
    approvedBy: string | null;
    approvedAt: Date | null;
    status: string;
  }>;
  sdsApprovals: Array<{
    id: string;
    customerValue: string | null;
    companyValue: string | null;
    upsellOpportunity: string | null;
    growthAspect: string | null;
    selectedScenario: string | null;
    selectedCashflow: string | null;
    deliveryCapability: string | null;
    decision: string;
    sponsor: string | null;
    decidedAt: Date | null;
    comment: string | null;
  }>;
  sdoaApprovals: Array<{
    id: string;
    receivedPoNumber: string | null;
    contractDocumentId: string | null;
    outcome: string;
    sponsor: string | null;
    decidedAt: Date | null;
    comment: string | null;
    deviations: Array<{
      id: string;
      category: string;
      baselineValue: string | null;
      receivedValue: string | null;
      decision: string;
      comment: string | null;
    }>;
  }>;
}>, frameworkVersionSettings: Array<{ value: unknown }>) {
  const frameworkVersionByOpportunity = new Map<string, string>();
  frameworkVersionSettings.forEach((setting) => {
    if (!setting.value || typeof setting.value !== "object" || Array.isArray(setting.value)) return;
    const value = setting.value as Record<string, unknown>;
    const entityId = typeof value.entityId === "string" ? value.entityId : "";
    const frameworkVersion = typeof value.frameworkVersion === "string" ? value.frameworkVersion : "";
    if (entityId && frameworkVersion) frameworkVersionByOpportunity.set(entityId, frameworkVersion);
  });
  const rows = opportunities.map((opportunity) => {
    const commercialScenario = opportunity.scenarios.find((scenario) => scenario.status === "selected") || opportunity.scenarios[0];
    return {
      opportunity_id: opportunity.opportunityCode,
      customer_name: opportunity.customerName,
      customer_segment: opportunity.customerSegment || "",
      deal_type: opportunity.dealType || "",
      opportunity_status: opportunity.status,
      framework_version: frameworkVersionByOpportunity.get(opportunity.id) || "",
      owner: opportunity.accountManager || opportunity.createdBy || "",
      solution_architect: opportunity.solutionArchitect || "",
      commercial_scenario: commercialScenario?.scenarioCode || "",
      scope_summary: opportunity.scopeSummary || "",
      created_at: opportunity.createdAt.toISOString(),
    };
  });

  const scenarios = opportunities.flatMap((opportunity) => opportunity.scenarios.map((scenario) => ({
    opportunity_id: opportunity.opportunityCode,
    scenario_id: scenario.scenarioCode,
    scenario_name: scenario.name,
    description: scenario.description || "",
    currency: scenario.currency,
    total_cost: decimalToString(scenario.totalCost),
    total_price: decimalToString(scenario.totalPrice),
    gross_margin: decimalToString(scenario.grossMargin),
    status: scenario.status,
  })));

  const commodityLines = opportunities.flatMap((opportunity) => opportunity.scenarios.flatMap((scenario) => scenario.commodityLines.map((line) => ({
    opportunity_id: opportunity.opportunityCode,
    scenario_id: scenario.scenarioCode,
    commodity_code: line.commodityCode,
    description: line.description || "",
    quantity: decimalToString(line.quantity),
    unit_cost: decimalToString(line.unitCost),
    unit_price: decimalToString(line.unitPrice),
    resource_cost: decimalToString(line.resourceCost),
    partner_cost: decimalToString(line.partnerCost),
    procurement_cost: decimalToString(line.procurementCost),
    project_cost: decimalToString(line.projectCost),
  }))));

  const risks = opportunities.flatMap((opportunity) => opportunity.risks.map((risk) => ({
    opportunity_id: opportunity.opportunityCode,
    risk_id: risk.riskCode,
    risk_title: risk.description,
    risk_domain: risk.domain,
    linked_commodity: risk.commodityCode || "",
    probability: decimalToString(risk.probabilityScore),
    impact: decimalToString(risk.impactCost),
    exposure_before_mitigation: decimalToString(risk.impactCost),
    mitigation_plan: risk.mitigationPlan || "",
    mitigation_cost: decimalToString(risk.mitigationCost),
    exposure_after_mitigation: decimalToString(risk.riskCostAfterMitigation || risk.residualExposure),
    predicted_occurrence_date: formatDbDate(risk.predictedOccurrenceDate),
    risk_owner: opportunity.solutionArchitect || opportunity.accountManager || "",
    severity: risk.severity || "",
    status: risk.status,
  })));

  return {
    opportunities: rows,
    scenarios,
    commodityLines,
    risks,
    pricingDecisions: opportunities.flatMap((opportunity) => opportunity.pricingDecisions.map((decision) => ({
      opportunity_id: opportunity.opportunityCode,
      scenario_id: decision.scenario?.scenarioCode || decision.scenarioId || "",
      decision: decision.decision,
      comment: decision.comment || "",
      status: decision.status,
    }))),
    cashflowOptions: opportunities.flatMap((opportunity) => opportunity.cashflowOptions.map((option) => ({
      opportunity_id: opportunity.opportunityCode,
      option_id: option.optionCode,
      option_name: option.name,
      currency: option.currency,
      dso_days: String(option.dsoDays),
      payment_terms: `${option.dsoDays} days`,
      gross_invoice: decimalToString(option.grossInvoice),
      incentive_discount: decimalToString(option.discountAmount),
      withholding_tax: decimalToString(option.withholdingTax),
      revenue_timing: "",
      cost_timing: "",
      cash_impact: decimalToString(option.cashGap),
      margin_impact: decimalToString(option.marginAmount),
      approved_by: option.approvedBy || "",
      approved_at: formatDbDateTime(option.approvedAt),
      status: option.status,
    }))),
    sdsRecords: opportunities.flatMap((opportunity) => opportunity.sdsApprovals.map((sds) => ({
      sds_id: sds.id,
      opportunity_id: opportunity.opportunityCode,
      selected_scenario: sds.selectedScenario || "",
      selected_cashflow: sds.selectedCashflow || "",
      customer_value: sds.customerValue || "",
      company_value: sds.companyValue || "",
      business_value_notes: [sds.customerValue, sds.companyValue, sds.upsellOpportunity, sds.growthAspect].filter(Boolean).join(" | "),
      delivery_capability_notes: sds.deliveryCapability || "",
      decision: sds.decision,
      approver: sds.sponsor || "",
      timestamp: formatDbDateTime(sds.decidedAt),
      comments: sds.comment || "",
      status: sds.decision,
    }))),
    sdoaRecords: opportunities.flatMap((opportunity) => opportunity.sdoaApprovals.map((sdoa) => ({
      sdoa_id: sdoa.id,
      opportunity_id: opportunity.opportunityCode,
      received_po_number: sdoa.receivedPoNumber || "",
      contract_document_id: sdoa.contractDocumentId || "",
      outcome: sdoa.outcome,
      sponsor: sdoa.sponsor || "",
      decided_at: formatDbDateTime(sdoa.decidedAt),
      comments: sdoa.comment || "",
      status: sdoa.outcome,
    }))),
    sdoaDeviations: opportunities.flatMap((opportunity) => opportunity.sdoaApprovals.flatMap((sdoa) => sdoa.deviations.map((deviation) => ({
      sdoa_id: sdoa.id,
      opportunity_id: opportunity.opportunityCode,
      category: deviation.category,
      baseline_value: deviation.baselineValue || "",
      received_value: deviation.receivedValue || "",
      decision: deviation.decision,
      comment: deviation.comment || "",
      status: deviation.decision,
    })))),
    urgentRisks: [...risks]
      .filter((risk) => risk.predicted_occurrence_date)
      .sort((left, right) => left.predicted_occurrence_date.localeCompare(right.predicted_occurrence_date))
      .slice(0, 3),
    topExposureRisks: [...risks]
      .sort((left, right) => Number(right.exposure_after_mitigation || 0) - Number(left.exposure_after_mitigation || 0))
      .slice(0, 3),
  };
}

function auditMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return value === undefined || value === null ? "" : String(value);
}

async function getFrameworkControlPlane(): Promise<FrameworkControlPlane> {
  return getActiveFrameworkSettings();
}

async function getOpportunityDashboardRows(): Promise<Parameters<typeof mapOpportunityAnalysis>[0]> {
  try {
    return await getDb().opportunity.findMany({
      include: {
        scenarios: { include: { commodityLines: true } },
        risks: true,
        pricingDecisions: { include: { scenario: true } },
        cashflowOptions: true,
        sdsApprovals: true,
        sdoaApprovals: { include: { deviations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      console.warn("Opportunity Analysis tables are not available in the active database yet. Rendering empty module state.");
      return [];
    }
    throw error;
  }
}

async function safeFindSystemSettingsByPrefix(prefix: string): Promise<Array<{ value: unknown }>> {
  try {
    return await getDb().systemSetting.findMany({ where: { key: { startsWith: prefix } } });
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

function userToAppUser(row: DashboardUserRow): NonNullable<DashboardData["user"]> {
  return {
    user_id: row.legacySourceId || row.id,
    email: row.email,
    full_name: row.fullName,
    role_id: row.role.code as RoleId,
    client_id: row.client?.legacySourceId || row.client?.code || "",
    project_id: "",
    employee_id: row.resource?.legacySourceId || "",
    status: String(row.status).toLowerCase(),
    permissions: Array.isArray(row.role.permissions) ? row.role.permissions.join(",") : String(row.role.permissions || ""),
  };
}

function userToRecord(user: DashboardUserRow): RecordMap {
  const appUser = userToAppUser(user);
  return { ...appUser, project_id: "" };
}

function resourceToCandidateRecord(resource: {
  id: string;
  legacySourceId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  assignedClientLegacyId: string | null;
  assignedProjectLegacyId: string | null;
  position: string | null;
  candidateStage: string | null;
  status: string;
  createdAt: Date;
}, feedback?: {
  rating: number | null;
  decision: string;
  rejectionReason: string | null;
  comment: string;
}): RecordMap {
  return {
    candidate_id: resource.legacySourceId || resource.id,
    full_name: resource.fullName,
    email: resource.email || "",
    phone: resource.phone || "",
    client_id: resource.assignedClientLegacyId || "",
    project_id: resource.assignedProjectLegacyId || "",
    position_applied: resource.position || "",
    interview_status: resource.candidateStage || "",
    rating: feedback?.rating ? String(feedback.rating) : "",
    decision: feedback?.decision || "",
    decision_reason: feedback?.rejectionReason || feedback?.comment || "",
    status: resource.status,
    created_at: resource.createdAt.toISOString(),
  };
}

function resourceToEmployeeRecord(resource: {
  id: string;
  legacySourceId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  assignedClientLegacyId: string | null;
  assignedProjectLegacyId: string | null;
  employmentType: string | null;
  joinDate: Date | null;
  endDate: Date | null;
  contractStatus: string | null;
  driveFolderId: string | null;
  ndaAcknowledgedAt: Date | null;
  codeOfEthicsAcknowledgedAt: Date | null;
  dataPrivacyConsentAcknowledgedAt: Date | null;
  onboardingTrainingCompletedAt: Date | null;
  resourceReadyAt: Date | null;
  contractType: string | null;
  contractNumber: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  baseSalary: unknown;
  allowanceAmount: unknown;
  grossMonthlySalary: unknown;
  dailyRate: unknown;
  hourlyRate: unknown;
  clientBillRate: unknown;
  managementFeeRate: unknown;
  managementFeeAmount: unknown;
  recruitmentFee: unknown;
  taxType: string | null;
  taxRate: unknown;
  pph21Amount: unknown;
  pph23Amount: unknown;
  bpjsKesehatanRate: unknown;
  bpjsKesehatanAmount: unknown;
  bpjsTkRate: unknown;
  bpjsTkAmount: unknown;
  netPayEstimate: unknown;
  invoiceAmountEstimate: unknown;
  commercialNotes: string | null;
  status: string;
  createdAt: Date;
}): RecordMap {
  return {
    employee_id: resource.legacySourceId || resource.id,
    full_name: resource.fullName,
    email: resource.email || "",
    phone: resource.phone || "",
    join_date: formatDbDate(resource.joinDate),
    end_date: formatDbDate(resource.endDate),
    employment_type: resource.employmentType || "",
    assigned_client_id: resource.assignedClientLegacyId || "",
    assigned_project_id: resource.assignedProjectLegacyId || "",
    contract_status: resource.contractStatus || "",
    drive_folder_id: resource.driveFolderId || "",
    nda_acknowledged_at: formatDbDateTime(resource.ndaAcknowledgedAt),
    code_of_ethics_acknowledged_at: formatDbDateTime(resource.codeOfEthicsAcknowledgedAt),
    data_privacy_consent_acknowledged_at: formatDbDateTime(resource.dataPrivacyConsentAcknowledgedAt),
    onboarding_training_completed_at: formatDbDateTime(resource.onboardingTrainingCompletedAt),
    resource_ready_at: formatDbDateTime(resource.resourceReadyAt),
    contract_type: resource.contractType || "",
    contract_number: resource.contractNumber || "",
    contract_start_date: formatDbDate(resource.contractStartDate),
    contract_end_date: formatDbDate(resource.contractEndDate),
    base_salary: decimalToString(resource.baseSalary),
    allowance_amount: decimalToString(resource.allowanceAmount),
    gross_monthly_salary: decimalToString(resource.grossMonthlySalary),
    daily_rate: decimalToString(resource.dailyRate),
    hourly_rate: decimalToString(resource.hourlyRate),
    client_bill_rate: decimalToString(resource.clientBillRate),
    management_fee_rate: decimalToString(resource.managementFeeRate),
    management_fee_amount: decimalToString(resource.managementFeeAmount),
    recruitment_fee: decimalToString(resource.recruitmentFee),
    tax_type: resource.taxType || "",
    tax_rate: decimalToString(resource.taxRate),
    pph21_amount: decimalToString(resource.pph21Amount),
    pph23_amount: decimalToString(resource.pph23Amount),
    bpjs_kesehatan_rate: decimalToString(resource.bpjsKesehatanRate),
    bpjs_kesehatan_amount: decimalToString(resource.bpjsKesehatanAmount),
    bpjs_tk_rate: decimalToString(resource.bpjsTkRate),
    bpjs_tk_amount: decimalToString(resource.bpjsTkAmount),
    net_pay_estimate: decimalToString(resource.netPayEstimate),
    invoice_amount_estimate: decimalToString(resource.invoiceAmountEstimate),
    commercial_notes: resource.commercialNotes || "",
    status: resource.status,
    created_at: resource.createdAt.toISOString(),
  };
}

function documentToRecord(document: {
  id: string;
  legacySourceId: string | null;
  documentType: string;
  fileName: string;
  driveFileId: string;
  entityType: string;
  entityId: string;
  status: string;
  createdAt: Date;
}): RecordMap {
  return {
    document_id: document.legacySourceId || document.id,
    document_type: document.documentType,
    file_name: document.fileName,
    drive_file_id: document.driveFileId,
    entity_type: document.entityType,
    entity_id: document.entityId,
    employee_id: document.entityType === "EMPLOYEE" ? document.entityId : "",
    candidate_id: document.entityType === "CANDIDATE" ? document.entityId : "",
    status: document.status,
    created_at: document.createdAt.toISOString(),
  };
}

function decimalToString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function formatDbDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatDbDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function emptyData(user: DashboardData["user"]): DashboardData {
  return {
    user,
    sessionEmail: "",
    metrics: { candidates: 0, employees: 0, pendingFeedback: 0, readyResources: 0 },
    users: [],
    candidates: [],
    employees: [],
    clients: [],
    projects: [],
    employee_documents: [],
    onboarding_documents: [],
    employee_contracts: [],
    candidate_documents: [],
    assignments: [],
    timesheets: [],
    overtime_requests: [],
    leave_requests: [],
    gr_records: [],
    invoices: [],
    invoice_lines: [],
    project_applications: [],
    opportunity_analysis: {
      opportunities: [],
      scenarios: [],
      commodityLines: [],
      risks: [],
      pricingDecisions: [],
      cashflowOptions: [],
      sdsRecords: [],
      sdoaRecords: [],
      sdoaDeviations: [],
      urgentRisks: [],
      topExposureRisks: [],
    },
    project_execution: { projects: [], gates: [], sites: [], resourceDemands: [], commercialFlows: [] },
    delivery_governance: { changeRequests: [], incidents: [], governanceRecords: [] },
    governance_summary: {
      openChangeRequests: 0,
      approvedChangeRequests: 0,
      additionalBudget: "0",
      addOnSalesValue: "0",
      openIncidents: 0,
      redIncidents: 0,
      overdueActions: 0,
      netSalesEstimate: "0",
      resourceGaps: 0,
      timesheetNotReady: 0,
      latestEscalations: [],
    },
    talent_planning: { talents: [] },
    ratecard: { resources: [], fxRates: [], fxUpdatedAt: "" },
    framework_settings: defaultFrameworkControlPlane(),
    template_management: { templates: [] },
    audit_logs: [],
  };
}

function LoginPage({ error, sessionEmail }: { error?: string; sessionEmail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 text-white shadow-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-300">NEXUS SEVENFOLD</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to Nexus</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Your Nexus account is verified through the Apps Script API and users tab.
        </p>
        {sessionEmail && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Signed in as {sessionEmail}, but this account is not active in Nexus users.
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        )}
        <form action="/api/auth/login" className="mt-6 grid gap-3" method="post">
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            name="email"
            placeholder="Email"
            required
            type="email"
          />
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            name="password"
            placeholder="Password"
            required
            type="password"
          />
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

function SetupState({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6">
      <div className="w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-8 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-300">NEXUS SEVENFOLD</p>
        <h1 className="mt-3 text-2xl font-semibold">Configuration required</h1>
        <p className="mt-3 text-sm text-slate-300">{message}</p>
        <div className="mt-6 rounded-md bg-slate-950 p-4 text-sm text-slate-300">
          Set <code>NEXUS_GAS_WEB_APP_URL</code>, <code>NEXUS_GAS_API_SECRET</code>, and{" "}
          <code>NEXUS_SESSION_SECRET</code>.
        </div>
      </div>
    </main>
  );
}
