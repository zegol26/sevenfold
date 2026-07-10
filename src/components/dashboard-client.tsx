"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  Target,
  Timer,
  Users,
} from "lucide-react";
import {
  addFrameworkItemAction,
  cloneOpportunityAction,
  createCandidateAction,
  createClientAction,
  createCommodityCostLineAction,
  createCashflowOptionAction,
  createChangeRequestAction,
  createDocumentMetadataAction,
  createGrRecordAction,
  createGovernanceRecordAction,
  createInvoiceDraftAction,
  createLeaveRequestAction,
  createOpportunityAction,
  createOpportunityRiskAction,
  createOvertimeRequestAction,
  createPricingDecisionAction,
  createProposalScenarioAction,
  createProjectApplicationAction,
  createProjectAction,
  createExecutionProjectFromSdoaAction,
  createQualityIncidentAction,
  createSdoaAction,
  createSdsAction,
  createTalentRecordAction,
  decideCommercialProcurementFlowAction,
  decideProjectGateAction,
  decideChangeRequestAction,
  decideSdoaAction,
  decideSdsAction,
  approveCashflowOptionAction,
  createTimesheetAction,
  createUserAction,
  importTalentPlanningExcelAction,
  importFrameworkSettingsExcelAction,
  importRatecardExcelAction,
  importSiteListExcelAction,
  manualRefreshFxRatesAction,
  markOnboardingStepAction,
  startOnboardingFromCandidateAction,
  submitCandidateAction,
  submitFeedbackAction,
  seedFrameworkControlPlaneAction,
  updateCandidateAction,
  updateDocumentMetadataAction,
  updateLeaveStatusAction,
  updateOvertimeStatusAction,
  updateEmployeeCommercialAction,
  updateFrameworkControlPlaneJsonAction,
  updateProjectGateAction,
  updateTimesheetStatusAction,
  updateUserAction,
  upsertCommercialProcurementFlowAction,
  upsertProjectResourceDemandAction,
  upsertRatecardResourceAction,
  upsertSiteHandlerAction,
  transitionTemplateAction,
  uploadTemplateAction,
} from "@/app/actions";
import type { DashboardData, RecordMap, RoleId } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Section =
  | "home"
  | "control"
  | "opportunity"
  | "cashflow"
  | "sales_submission"
  | "order_ack"
  | "execution"
  | "governance"
  | "talent"
  | "ratecard"
  | "users"
  | "master"
  | "candidates"
  | "feedback"
  | "onboarding"
  | "documents"
  | "timesheets"
  | "overtime"
  | "leave"
  | "finance";

export function DashboardClient({
  data,
  initialSection,
  isSuperAdmin,
}: {
  data: DashboardData;
  initialSection?: string;
  isSuperAdmin: boolean;
}) {
  const [section, setSection] = useState<Section>(coerceSection(initialSection));
  const [clientForCandidate, setClientForCandidate] = useState("");
  const [clientForProject, setClientForProject] = useState(data.clients[0]?.id || "");
  const [feedbackCandidate, setFeedbackCandidate] = useState<RecordMap | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const role = data.user?.role_id as RoleId;
  const nav = getNav(role, isSuperAdmin);
  const activeSection = nav.some((item) => item.id === section) ? section : "home";
  const filteredProjectsForCandidate = useMemo(
    () => data.projects.filter((project) => !clientForCandidate || project.meta === clientForCandidate),
    [data.projects, clientForCandidate],
  );
  const filteredProjectsForSetup = useMemo(
    () => data.projects.filter((project) => !clientForProject || project.meta === clientForProject),
    [data.projects, clientForProject],
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="grid min-h-screen grid-cols-[272px_minmax(0,1fr)] max-lg:grid-cols-1">
          <Sidebar nav={nav} section={activeSection} setSection={setSection} />
          <main className="min-w-0">
            <Topbar user={data.user} section={activeSection} />
            <div className="mx-auto grid max-w-[1600px] gap-5 p-6 max-sm:p-4">
              {activeSection === "home" && <Home data={data} />}
              {activeSection === "control" && <ControlPlanePanel auditLogs={data.audit_logs || []} settings={data.framework_settings} />}
              {activeSection === "opportunity" && <OpportunityPanel data={data} />}
              {activeSection === "cashflow" && <CashflowPanel data={data} />}
              {activeSection === "sales_submission" && <SdsPanel data={data} />}
              {activeSection === "order_ack" && <SdoaPanel data={data} />}
              {activeSection === "execution" && <ProjectExecutionPanel data={data} />}
              {activeSection === "governance" && <GovernancePanel data={data} />}
              {activeSection === "talent" && <TalentPlanningPanel data={data} />}
              {activeSection === "ratecard" && <RatecardPanel data={data} />}
              {activeSection === "users" && <UsersPanel users={data.users} clients={data.clients} projects={data.projects} />}
              {activeSection === "master" && (
                <MasterSetup
                  clients={data.clients}
                  projects={filteredProjectsForSetup}
                  clientForProject={clientForProject}
                  setClientForProject={setClientForProject}
                />
              )}
              {activeSection === "candidates" && (
                <CandidatePanel
                  candidates={data.candidates}
                  clients={data.clients}
                  projects={filteredProjectsForCandidate}
                  clientForCandidate={clientForCandidate}
                  setClientForCandidate={setClientForCandidate}
                  user={data.user}
                />
              )}
              {activeSection === "feedback" && (
                <FeedbackPanel candidates={data.candidates} selected={feedbackCandidate} setSelected={setFeedbackCandidate} />
              )}
              {activeSection === "onboarding" && (
                <OnboardingPanel
                  employees={data.employees}
                  employeeContracts={data.employee_contracts || []}
                  onboardingDocuments={data.onboarding_documents || []}
                  user={data.user}
                />
              )}
              {activeSection === "documents" && (
                <DocumentsPanel
                  candidates={data.candidates}
                  employees={data.employees}
                  employeeDocuments={data.employee_documents || []}
                  candidateDocuments={data.candidate_documents || []}
                  onboardingDocuments={data.onboarding_documents || []}
                  templateManagement={data.template_management || { templates: [] }}
                />
              )}
              {activeSection === "timesheets" && (
                <TimesheetsPanel
                  employees={data.employees}
                  assignments={data.assignments || []}
                  timesheets={data.timesheets || []}
                  user={data.user}
                />
              )}
              {activeSection === "overtime" && (
                <OvertimePanel
                  employees={data.employees}
                  assignments={data.assignments || []}
                  overtimeRequests={data.overtime_requests || []}
                  user={data.user}
                />
              )}
              {activeSection === "leave" && (
                <LeavePanel
                  employees={data.employees}
                  assignments={data.assignments || []}
                  leaveRequests={data.leave_requests || []}
                  user={data.user}
                />
              )}
              {activeSection === "finance" && (
                <FinancePanel
                  clients={data.clients}
                  projects={data.projects}
                  grRecords={data.gr_records || []}
                  invoices={data.invoices || []}
                />
              )}
            </div>
          </main>
        </div>
      </div>
      <Toast open={toastOpen} onOpenChange={setToastOpen}>
        <ToastTitle>Saved</ToastTitle>
        <ToastDescription>The request was sent to the backend.</ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

function Sidebar({
  nav,
  section,
  setSection,
}: {
  nav: { id: Section; label: string; icon: ReactNode }[];
  section: Section;
  setSection: (section: Section) => void;
}) {
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-e bg-sidebar px-4 py-5 text-sidebar-foreground max-lg:static max-lg:h-auto">
      <div className="px-2">
        <div className="text-base font-semibold tracking-wide text-white">NEXUS SEVENFOLD</div>
        <div className="mt-1 text-xs text-slate-300">Business & Project Management</div>
      </div>
      <nav className="mt-7 grid gap-1">
        {nav.map((item) => (
          <button
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm transition-colors",
              section === item.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
            key={item.id}
            onClick={() => setSection(item.id)}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 max-lg:hidden">
        Backend access is enforced by the Next.js server and database policies. Drive documents use the GAS adapter only.
      </div>
    </aside>
  );
}

function Topbar({ user, section }: { user: DashboardData["user"]; section: Section }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/95 px-6 backdrop-blur max-sm:h-auto max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4 max-sm:py-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{titleFor(section)}</h1>
        <p className="text-sm text-muted-foreground">Secure workflow operations dashboard</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right max-sm:text-left">
          <div className="text-sm font-medium">{user?.email}</div>
          <Badge variant="secondary" className="mt-1">{user?.role_id}</Badge>
        </div>
        <form action="/api/auth/logout" method="post">
          <Button variant="outline" type="submit">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </form>
      </div>
    </header>
  );
}

function Home({ data }: { data: DashboardData }) {
  if (data.user?.role_id === "ROLE_EMPLOYEE") {
    return <EmployeeHome data={data} />;
  }

  const metrics = [
    { label: "Candidates", value: data.metrics.candidates, icon: <Users className="h-4 w-4 text-blue-600" /> },
    { label: "Employees", value: data.metrics.employees, icon: <BriefcaseBusiness className="h-4 w-4 text-teal-600" /> },
    { label: "Pending Feedback", value: data.metrics.pendingFeedback, icon: <ClipboardCheck className="h-4 w-4 text-amber-600" /> },
    { label: "Ready Resources", value: data.metrics.readyResources, icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
    { label: "Timesheets", value: data.metrics.timesheets || 0, icon: <Timer className="h-4 w-4 text-blue-600" /> },
    { label: "Pending Approvals", value: data.metrics.pendingApprovals || 0, icon: <ClipboardCheck className="h-4 w-4 text-amber-600" /> },
    { label: "Leave Requests", value: data.metrics.leaveRequests || 0, icon: <CalendarDays className="h-4 w-4 text-teal-600" /> },
    { label: "Invoices", value: data.metrics.invoices || 0, icon: <ReceiptText className="h-4 w-4 text-slate-700" /> },
  ];
  return (
    <>
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{metric.value}</div>
              </div>
              <div className="rounded-md bg-muted p-2">{metric.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Alert>
        <ShieldCheck className="float-left me-2 h-4 w-4 text-blue-600" />
        <AlertTitle>Backend enforced access</AlertTitle>
        <AlertDescription>
          Role, client scope, audit log, and workflow validation are enforced by the Next.js server and Neon database.
          Google Apps Script is used only as the Google Drive repository adapter.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Workflow Overview</CardTitle>
          <CardDescription>Current MVP flow across candidate intake, client feedback, and onboarding.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-sm max-xl:grid-cols-2 max-sm:grid-cols-1">
            {["Create candidate", "Submit to client", "Capture feedback", "Onboard resource", "Track documents", "Approve timesheets", "Process leave/overtime", "Issue GR & invoice"].map((step, index) => (
              <div className="rounded-lg border bg-muted/30 p-4" key={step}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <div className="font-medium">{step}</div>
                <div className="mt-1 text-muted-foreground">Operational data is stored in Sevenfold PostgreSQL.</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function EmployeeHome({ data }: { data: DashboardData }) {
  const employee = data.employees[0] || {};
  const contract = (data.employee_contracts || []).find((row) => row.employee_id === employee.employee_id) || {};
  const assignment = (data.assignments || []).find((row) => row.employee_id === employee.employee_id) || {};
  const latestTimesheet = latestByCreated(data.timesheets || []);
  const latestOvertime = latestByCreated(data.overtime_requests || []);
  const latestLeave = latestByCreated(data.leave_requests || []);
  const availableProjects = data.projects.filter((project) => project.id !== assignment.project_id);

  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Resource Status" value={employee.status || "No employee record"} />
        <MetricCard label="Contract" value={employee.contract_status || contract.status || "PENDING"} />
        <MetricCard label="Timesheet" value={latestTimesheet.status || "No submission"} />
        <MetricCard label="Overtime / Leave" value={`${latestOvertime.status || "No OT"} / ${latestLeave.status || "No leave"}`} />
      </div>
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-5 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>My Resource Profile</CardTitle>
            <CardDescription>Your current assignment, contract, payroll estimate, and readiness status.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm max-sm:grid-cols-1">
            <Info label="Employee ID" value={employee.employee_id} />
            <Info label="Current Project" value={assignment.project_id || employee.assigned_project_id || "-"} />
            <Info label="Client" value={assignment.client_id || employee.assigned_client_id || "-"} />
            <Info label="Role" value={assignment.role_title || "-"} />
            <Info label="Gross Salary" value={money(employee.gross_monthly_salary || contract.gross_monthly_salary)} />
            <Info label="Net Pay Estimate" value={money(employee.net_pay_estimate)} />
            <Info label="Contract Period" value={`${employee.contract_start_date || contract.start_date || "-"} - ${employee.contract_end_date || contract.end_date || "-"}`} />
            <Info label="Resource Ready" value={employee.resource_ready_at ? "Ready" : "In progress"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Apply For Another Project</CardTitle>
            <CardDescription>Submit interest for available projects. HR/Admin will review the request.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProjectApplicationAction} className="grid gap-3">
              <input name="employee_id" type="hidden" value={employee.employee_id || ""} />
              <NativeSelect name="project_id" options={availableProjects} emptyLabel="Select project" required />
              <Input name="role_interest" placeholder="Role interest" />
              <Input name="availability_date" type="date" />
              <Textarea name="notes" placeholder="Notes" />
              <Button type="submit">Apply Project</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Status Timeline</CardTitle>
          <CardDescription>Recent workflow state from backend records.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm max-lg:grid-cols-1">
            <StatusTile label="Timesheet" primary={latestTimesheet.status || "-"} secondary={latestTimesheet.period_start ? `${latestTimesheet.period_start} - ${latestTimesheet.period_end}` : "No period"} />
            <StatusTile label="Overtime" primary={latestOvertime.status || "-"} secondary={latestOvertime.request_date || "No request"} />
            <StatusTile label="Leave" primary={latestLeave.status || "-"} secondary={latestLeave.start_date ? `${latestLeave.start_date} - ${latestLeave.end_date}` : "No request"} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ControlPlanePanel({ auditLogs, settings }: { auditLogs: RecordMap[]; settings?: DashboardData["framework_settings"] }) {
  const config = settings;
  if (!config) {
    return <EmptyState title="Control plane not available" description="Framework settings are not loaded." />;
  }

  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-5 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Administration Control Plane</CardTitle>
            <CardDescription>
              Admin-configurable framework settings for deal type, risk, commodity, currency, and approval thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
            <MetricCard label="Deal Types" value={String(config.dealTypes.length)} />
            <MetricCard label="Commodity Codes" value={String(config.commodityCodes.length)} />
            <MetricCard label="Risk Domains" value={String(config.riskDomains.length)} />
            <MetricCard label="Project Gates" value={String(config.gateDefinitions.length)} />
            <MetricCard label="Active Version" value={config.frameworkVersions.find((item) => item.status === "active")?.version || "none"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Framework Defaults</CardTitle>
            <CardDescription>Seed or reset safe defaults from the current business plan. No destructive database operation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form action={seedFrameworkControlPlaneAction}>
              <Button type="submit">
                <Settings className="h-4 w-4" />
                Seed Business Plan Defaults
              </Button>
            </form>
            <div className="text-xs text-muted-foreground">Last updated: {config.updatedAt ? formatDateTime(config.updatedAt) : "default preview"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {[
          ["User Administration", "Create, scope, reset, activate, and soft-delete users."],
          ["Role & Permission Administration", "Role seed and permission model; detailed editor is scheduled for next control-plane increment."],
          ["Approval Matrix Administration", "Configurable approval thresholds by decision and deal value."],
          ["Framework Settings", "Deal type, commodity, risk domain, currency, and control defaults."],
          ["Template Management", "Document template references through the Drive/GAS repository adapter."],
          ["Framework Versioning", "Versioned control-plane JSON snapshot for reviewed production rollout."],
          ["Audit Logs", "Every setting mutation writes backend audit logs."],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="dealTypes">
        <TabsList className="flex flex-wrap">
            <TabsTrigger value="dealTypes">Deal Types</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="matrices">Matrices</TabsTrigger>
            <TabsTrigger value="commodity">Commodity</TabsTrigger>
            <TabsTrigger value="risk">Risk Domains</TabsTrigger>
            <TabsTrigger value="riskScoring">Risk Scoring</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          <TabsTrigger value="rag">RAG</TabsTrigger>
            <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="workingHours">Working Hours</TabsTrigger>
          <TabsTrigger value="ratecardDefaults">Ratecard Defaults</TabsTrigger>
          <TabsTrigger value="documentCategories">Document Categories</TabsTrigger>
          <TabsTrigger value="workflowStatuses">Workflow Statuses</TabsTrigger>
          <TabsTrigger value="approval">Approval</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="manuals">Manual Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="dealTypes">
          <ControlPlaneTable
            headers={["Name", "Criteria", "Min USD", "Max USD", "Status"]}
            rows={config.dealTypes.map((item) => ({
              name: item.name,
              criteria: item.criteria,
              min_value_usd: item.minValueUsd || "-",
              max_value_usd: item.maxValueUsd || "-",
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="dealTypes" fields={["name", "criteria", "min_value_usd", "max_value_usd", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="roles">
          <ControlPlaneTable
            headers={["Code", "Name", "Description", "Status"]}
            rows={config.roles.map((item) => ({ code: item.code, name: item.name, description: item.description, status: item.status }))}
          />
          <FrameworkAddForm group="roles" fields={["code", "name", "description", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="permissions">
          <ControlPlaneTable
            headers={["Code", "Name", "Module", "Description", "Status"]}
            rows={config.permissions.map((item) => ({ code: item.code, name: item.name, module: item.module, description: item.description, status: item.status }))}
          />
          <FrameworkAddForm group="permissions" fields={["code", "name", "module", "description", "status", "reason", "approval_reference"]} />
          <ControlPlaneTable
            headers={["Role", "Permission", "Status"]}
            rows={config.rolePermissions.map((item) => ({ role: item.roleCode, permission: item.permissionCode, status: item.status }))}
          />
          <FrameworkAddForm group="rolePermissions" fields={["role_code", "permission_code", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="access">
          <ControlPlaneTable
            headers={["Subject", "Type", "Resource", "Scope", "Effect", "Status"]}
            rows={config.userAccessPolicies.map((item) => ({
              subject: item.subject,
              subject_type: item.subjectType,
              resource_type: item.resourceType,
              resource_scope: item.resourceScope,
              effect: item.effect,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="userAccessPolicies" fields={["subject", "subject_type", "resource_type", "resource_scope", "effect", "status", "reason", "approval_reference"]} />
          <ControlPlaneTable
            headers={["Workflow", "Role", "Access", "Status"]}
            rows={config.workflowAccessPolicies.map((item) => ({ workflow: item.workflow, role: item.roleCode, access: item.accessLevel, status: item.status }))}
          />
          <FrameworkAddForm group="workflowAccessPolicies" fields={["workflow", "role_code", "access_level", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="matrices">
          <ControlPlaneTable
            headers={["Workflow", "Decision", "Status"]}
            rows={config.approvalMatrices.map((item) => ({ workflow: item.workflow, decision: item.decision, status: item.status }))}
          />
          <FrameworkAddForm group="approvalMatrices" fields={["id", "workflow", "decision", "status", "reason", "approval_reference"]} />
          <ControlPlaneTable
            headers={["Matrix", "Seq", "Approver Role", "Condition", "Required", "Status"]}
            rows={config.approvalRules.map((item) => ({
              matrix: item.matrixId,
              sequence: item.sequence,
              approver_role: item.approverRole,
              condition: item.condition,
              required: item.required,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="approvalRules" fields={["matrix_id", "sequence", "approver_role", "condition", "required", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="commodity">
          <ControlPlaneTable
            headers={["Code", "Name", "Description", "Status"]}
            rows={config.commodityCodes.map((item) => ({
              code: item.code,
              name: item.name,
              description: item.description,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="commodityCodes" fields={["code", "name", "description", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="risk">
          <ControlPlaneTable
            headers={["Domain", "Status"]}
            rows={config.riskDomains.map((item) => ({ name: item.name, status: item.status }))}
          />
          <FrameworkAddForm group="riskDomains" fields={["name", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="riskScoring">
          <ControlPlaneTable
            headers={["Label", "Min", "Max", "Severity", "Guidance", "Status"]}
            rows={config.riskScoring.map((item) => ({
              label: item.label,
              min_score: item.minScore,
              max_score: item.maxScore,
              severity: item.severity,
              action_guidance: item.actionGuidance,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="riskScoring" fields={["label", "min_score", "max_score", "severity", "action_guidance", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="gates">
          <ControlPlaneTable
            headers={["Gate", "Name", "Owner", "Description", "Status"]}
            rows={config.gateDefinitions.map((item) => ({
              gate: item.gateCode,
              name: item.name,
              owner: item.ownerRole,
              description: item.description,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="gateDefinitions" fields={["gate_code", "name", "owner_role", "description", "status", "reason", "approval_reference"]} />
          <ControlPlaneTable
            headers={["Gate", "Checklist Item", "Mandatory", "Evidence", "Status"]}
            rows={config.gateChecklist.map((item) => ({
              gate: item.gateCode,
              item: item.item,
              mandatory: item.mandatory,
              evidence: item.evidenceType,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="gateChecklist" fields={["gate_code", "item", "mandatory", "evidence_type", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="governance">
          <ControlPlaneTable
            headers={["Forum", "Cadence", "Owner", "Audience", "Status"]}
            rows={config.governanceCadence.map((item) => ({
              forum: item.forum,
              cadence: item.cadence,
              owner: item.ownerRole,
              audience: item.audience,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="governanceCadence" fields={["forum", "cadence", "owner_role", "audience", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="rag">
          <ControlPlaneTable
            headers={["Metric", "Green", "Amber", "Red", "Status"]}
            rows={config.ragThresholds.map((item) => ({
              metric: item.metric,
              green: item.green,
              amber: item.amber,
              red: item.red,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="ragThresholds" fields={["metric", "green", "amber", "red", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="currency">
          <ControlPlaneTable
            headers={["Code", "Name", "Rate To USD", "Status"]}
            rows={config.currencies.map((item) => ({
              code: item.code,
              name: item.name,
              rate_to_usd: item.rateToUsd || "-",
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="currencies" fields={["code", "name", "rate_to_usd", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="workingHours">
          <ControlPlaneTable
            headers={["Country", "Timezone", "Hours/Day", "Days/Week", "Start", "End", "Status"]}
            rows={config.workingHours.map((item) => ({
              country: item.country,
              timezone: item.timezone,
              hours_per_day: item.hoursPerDay,
              days_per_week: item.daysPerWeek,
              start_time: item.startTime,
              end_time: item.endTime,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="workingHours" fields={["country", "timezone", "hours_per_day", "days_per_week", "start_time", "end_time", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="ratecardDefaults">
          <ControlPlaneTable
            headers={["Name", "Value", "Unit", "Description", "Status"]}
            rows={config.defaultRatecardAssumptions.map((item) => ({
              name: item.name,
              value: item.value,
              unit: item.unit,
              description: item.description,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="defaultRatecardAssumptions" fields={["name", "value", "unit", "description", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="documentCategories">
          <ControlPlaneTable
            headers={["Category", "Description", "Retention", "Status"]}
            rows={config.documentCategories.map((item) => ({
              category: item.category,
              description: item.description,
              retention_rule: item.retentionRule,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="documentCategories" fields={["category", "description", "retention_rule", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="workflowStatuses">
          <ControlPlaneTable
            headers={["Workflow", "Code", "Label", "Terminal", "Status"]}
            rows={config.workflowStatuses.map((item) => ({
              workflow: item.workflow,
              status_code: item.statusCode,
              label: item.label,
              terminal: item.terminal,
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="workflowStatuses" fields={["workflow", "status_code", "label", "terminal", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="approval">
          <ControlPlaneTable
            headers={["Decision", "Role", "Min USD", "Max USD", "Status"]}
            rows={config.approvalThresholds.map((item) => ({
              decision: item.decision,
              role: item.role,
              min_value_usd: item.minValueUsd,
              max_value_usd: item.maxValueUsd || "-",
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="approvalThresholds" fields={["decision", "role", "min_value_usd", "max_value_usd", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="templates">
          <ControlPlaneTable
            headers={["Category", "Type", "Template", "Drive File", "Status"]}
            rows={config.documentTemplateSettings.map((item) => ({
              category: item.category,
              document_type: item.documentType,
              template_name: item.templateName,
              drive_file_id: item.driveFileId || "-",
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="documentTemplateSettings" fields={["category", "document_type", "template_name", "drive_file_id", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="versions">
          <ControlPlaneTable
            headers={["Version", "Description", "Effective At", "Status"]}
            rows={config.frameworkVersions.map((item) => ({
              version: item.version,
              description: item.description,
              effective_at: item.effectiveAt || "-",
              status: item.status,
            }))}
          />
          <FrameworkAddForm group="frameworkVersions" fields={["version", "description", "effective_at", "status", "reason", "approval_reference"]} />
        </TabsContent>
        <TabsContent value="audit">
          <ControlPlaneTable
            headers={["When", "Actor", "Action", "Entity", "Reason", "Approval Ref"]}
            rows={auditLogs.map((item) => ({
              created_at: formatDateTime(item.created_at),
              actor: item.actor || "-",
              action: item.action,
              entity: `${item.entity_type}:${item.entity_id}`,
              reason: item.reason || "-",
              approval_reference: item.approval_reference || "-",
            }))}
          />
        </TabsContent>
        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Advanced JSON Editor</CardTitle>
              <CardDescription>Use for bulk edits only. Keep this reviewed before production deployment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateFrameworkControlPlaneJsonAction} className="grid gap-3">
                <Textarea className="min-h-96 font-mono text-xs" name="framework_json" defaultValue={JSON.stringify(config, null, 2)} />
                <Input name="reason" placeholder="Reason for change" required />
                <Input name="approval_reference" placeholder="Approval reference, if applicable" />
                <Button type="submit">Save JSON</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manuals">
          <Card>
            <CardHeader>
              <CardTitle>Manual Generation Notes</CardTitle>
              <CardDescription>These are intentional future tasks. No Word documents are generated automatically.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {config.manualNotes.map((note) => (
                <Alert key={note}>
                  <FileText className="float-left me-2 h-4 w-4 text-blue-600" />
                  <AlertDescription>{note}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ControlPlaneTable({ headers, rows }: { headers: string[]; rows: RecordMap[] }) {
  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        <DataTable
          headers={headers}
          rows={rows}
          render={(row, index) => (
            <TableRow key={`${headers[0]}-${index}`}>
              {Object.values(row).map((value, cellIndex) => (
                <TableCell key={`${value}-${cellIndex}`}>{cellIndex === Object.values(row).length - 1 ? <StatusBadge value={value} /> : value}</TableCell>
              ))}
            </TableRow>
          )}
        />
      </CardContent>
    </Card>
  );
}

function FrameworkAddForm({ group, fields }: { group: string; fields: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Setting</CardTitle>
        <CardDescription>Additive update only. Existing rows are preserved.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={addFrameworkItemAction} className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
          <input name="group" type="hidden" value={group} />
          {fields.map((field) => (
            <Input key={field} name={field} placeholder={field.replace(/_/g, " ")} defaultValue={field === "status" ? "active" : ""} required={["name", "code", "decision", "role", "reason"].includes(field)} />
          ))}
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function OpportunityPanel({ data }: { data: DashboardData }) {
  const analysis = data.opportunity_analysis || { opportunities: [], scenarios: [], commodityLines: [], risks: [], pricingDecisions: [], urgentRisks: [], topExposureRisks: [] };
  const opportunityOptions = analysis.opportunities.map((opportunity) => ({
    id: opportunity.opportunity_id,
    label: `${opportunity.opportunity_id} - ${opportunity.customer_name}`,
  }));
  const dealTypes = data.framework_settings?.dealTypes || [];
  const commodityCodes = data.framework_settings?.commodityCodes || [];
  const riskDomains = data.framework_settings?.riskDomains || [];

  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Opportunities" value={String(analysis.opportunities.length)} />
        <MetricCard label="Scenarios" value={String(analysis.scenarios.length)} />
        <MetricCard label="Commodity Lines" value={String(analysis.commodityLines.length)} />
        <MetricCard label="Open Risks" value={String(analysis.risks.filter((risk) => risk.status !== "closed").length)} />
      </div>

      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <RiskSummaryCard title="Top 3 Urgent Risks" rows={analysis.urgentRisks} valueKey="predicted_occurrence_date" />
        <RiskSummaryCard title="Top 3 Exposure Risks" rows={analysis.topExposureRisks} valueKey="exposure_after_mitigation" />
      </div>

      <Tabs defaultValue="opportunities">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="commodities">Commodity Cost</TabsTrigger>
          <TabsTrigger value="risks">Risk Register</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Decision</TabsTrigger>
          <TabsTrigger value="reuse">Reuse & Export</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Create Opportunity ID</CardTitle>
              <CardDescription>Account Manager creates the commercial opportunity baseline. New records use the latest active framework version.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createOpportunityAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
                <Input name="opportunity_id" placeholder="Opportunity ID optional" />
                <Input name="customer_name" placeholder="Customer name" required />
                <Input name="owner" placeholder="Owner / Account Manager" />
                <Input name="solution_architect" placeholder="Solution Architect" />
                <Select name="deal_type" required>
                  <SelectTrigger><SelectValue placeholder="Deal type" /></SelectTrigger>
                  <SelectContent>{dealTypes.map((deal) => <SelectItem key={deal.id} value={deal.name}>{deal.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input name="customer_segment" placeholder="Customer segment" />
                <Input name="opportunity_status" defaultValue="draft" placeholder="Status" required />
                <Textarea className="xl:col-span-4" name="scope_summary" placeholder="Scope summary" />
                <Button className="xl:col-span-4" type="submit"><Plus className="h-4 w-4" /> Create Opportunity</Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            headers={["Opportunity", "Customer", "Deal", "Status", "Framework", "Owner", "Commercial Scenario"]}
            rows={analysis.opportunities}
            render={(opportunity) => (
              <TableRow key={opportunity.opportunity_id}>
                <TableCell className="font-mono text-xs">{opportunity.opportunity_id}</TableCell>
                <TableCell>{opportunity.customer_name}</TableCell>
                <TableCell>{opportunity.deal_type}</TableCell>
                <TableCell><StatusBadge value={opportunity.opportunity_status} /></TableCell>
                <TableCell>{opportunity.framework_version || "-"}</TableCell>
                <TableCell>{opportunity.owner || "-"}</TableCell>
                <TableCell>{opportunity.commercial_scenario || "-"}</TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="scenarios">
          <OpportunityFormCard title="Create Proposal Scenario">
            <form action={createProposalScenarioAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <OpportunitySelect opportunities={opportunityOptions} />
              <Input name="scenario_id" placeholder="Scenario ID optional" />
              <Input name="scenario_name" placeholder="Scenario name" required />
              <Input name="currency" defaultValue="USD" placeholder="Currency" />
              <Textarea className="xl:col-span-4" name="description" placeholder="Scenario description" />
              <Button className="xl:col-span-4" type="submit"><Plus className="h-4 w-4" /> Create Scenario</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Opportunity", "Scenario", "Name", "Currency", "Cost", "Price", "Margin", "Status"]}
            rows={analysis.scenarios}
            render={(scenario) => (
              <TableRow key={`${scenario.opportunity_id}-${scenario.scenario_id}`}>
                <TableCell className="font-mono text-xs">{scenario.opportunity_id}</TableCell>
                <TableCell className="font-mono text-xs">{scenario.scenario_id}</TableCell>
                <TableCell>{scenario.scenario_name}</TableCell>
                <TableCell>{scenario.currency}</TableCell>
                <TableCell>{money(scenario.total_cost)}</TableCell>
                <TableCell>{money(scenario.total_price)}</TableCell>
                <TableCell>{scenario.gross_margin || "-"}</TableCell>
                <TableCell><StatusBadge value={scenario.status} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="commodities">
          <OpportunityFormCard title="Add Commodity Cost Structure">
            <form action={createCommodityCostLineAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <OpportunitySelect opportunities={opportunityOptions} />
              <Input name="scenario_id" placeholder="Scenario ID" required />
              <Select name="commodity_code" required>
                <SelectTrigger><SelectValue placeholder="Commodity" /></SelectTrigger>
                <SelectContent>{commodityCodes.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input name="description" placeholder="Description" />
              <MoneyInput name="quantity" value="1" placeholder="Quantity" />
              <MoneyInput name="unit_cost" placeholder="Unit cost" />
              <MoneyInput name="unit_price" placeholder="Unit price" />
              <MoneyInput name="resource_cost" placeholder="Resource cost" />
              <MoneyInput name="partner_cost" placeholder="Partner cost" />
              <MoneyInput name="procurement_cost" placeholder="Procurement cost" />
              <MoneyInput name="project_cost" placeholder="Project cost" />
              <Button className="2xl:col-span-5" type="submit"><Plus className="h-4 w-4" /> Add Cost Line</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Opportunity", "Scenario", "Commodity", "Qty", "Unit Cost", "Unit Price", "Resource", "Partner", "Procurement", "Project"]}
            rows={analysis.commodityLines}
            render={(line) => (
              <TableRow key={`${line.opportunity_id}-${line.scenario_id}-${line.commodity_code}-${line.description}`}>
                <TableCell className="font-mono text-xs">{line.opportunity_id}</TableCell>
                <TableCell className="font-mono text-xs">{line.scenario_id}</TableCell>
                <TableCell>{line.commodity_code}</TableCell>
                <TableCell>{line.quantity}</TableCell>
                <TableCell>{money(line.unit_cost)}</TableCell>
                <TableCell>{money(line.unit_price)}</TableCell>
                <TableCell>{money(line.resource_cost)}</TableCell>
                <TableCell>{money(line.partner_cost)}</TableCell>
                <TableCell>{money(line.procurement_cost)}</TableCell>
                <TableCell>{money(line.project_cost)}</TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="risks">
          <OpportunityFormCard title="Add Risk Register Entry">
            <form action={createOpportunityRiskAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <OpportunitySelect opportunities={opportunityOptions} />
              <Input name="risk_id" placeholder="Risk ID optional" />
              <Input name="risk_title" placeholder="Risk title" required />
              <Select name="risk_domain" required>
                <SelectTrigger><SelectValue placeholder="Risk domain" /></SelectTrigger>
                <SelectContent>{riskDomains.map((domain) => <SelectItem key={domain.id} value={domain.name}>{domain.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select name="linked_commodity">
                <SelectTrigger><SelectValue placeholder="Linked commodity" /></SelectTrigger>
                <SelectContent>{commodityCodes.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input name="probability" type="number" step="0.01" placeholder="Probability" />
              <MoneyInput name="impact" placeholder="Impact" />
              <MoneyInput name="exposure_before_mitigation" placeholder="Exposure before mitigation" />
              <MoneyInput name="mitigation_cost" placeholder="Mitigation cost" />
              <MoneyInput name="exposure_after_mitigation" placeholder="Exposure after mitigation" />
              <Input name="predicted_occurrence_date" type="date" />
              <Input name="risk_owner" placeholder="Risk owner" />
              <Input name="severity" placeholder="Severity" />
              <Input name="status" defaultValue="open" placeholder="Status" />
              <Textarea className="2xl:col-span-5" name="mitigation_plan" placeholder="Mitigation plan" />
              <Button className="2xl:col-span-5" type="submit"><Plus className="h-4 w-4" /> Add Risk</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Opportunity", "Risk", "Domain", "Commodity", "Probability", "Impact", "Exposure After", "Occurrence", "Owner", "Status"]}
            rows={analysis.risks}
            render={(risk) => (
              <TableRow key={`${risk.opportunity_id}-${risk.risk_id}`}>
                <TableCell className="font-mono text-xs">{risk.opportunity_id}</TableCell>
                <TableCell>{risk.risk_title}</TableCell>
                <TableCell>{risk.risk_domain}</TableCell>
                <TableCell>{risk.linked_commodity || "-"}</TableCell>
                <TableCell>{risk.probability || "-"}</TableCell>
                <TableCell>{money(risk.impact)}</TableCell>
                <TableCell>{money(risk.exposure_after_mitigation)}</TableCell>
                <TableCell>{risk.predicted_occurrence_date || "-"}</TableCell>
                <TableCell>{risk.risk_owner || "-"}</TableCell>
                <TableCell><StatusBadge value={risk.status} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="pricing">
          <OpportunityFormCard title="Pricing Structure Decision">
            <form action={createPricingDecisionAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <OpportunitySelect opportunities={opportunityOptions} />
              <Input name="scenario_id" placeholder="Scenario ID" />
              <Input name="decision" placeholder="Decision, e.g. SELECT_SCENARIO_A" required />
              <Input name="status" defaultValue="draft" placeholder="Status" />
              <Select name="mark_commercial_scenario" defaultValue="false">
                <SelectTrigger><SelectValue placeholder="Mark commercial scenario?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Do not mark selected</SelectItem>
                  <SelectItem value="true">Mark as commercial scenario</SelectItem>
                </SelectContent>
              </Select>
              <Textarea className="xl:col-span-4" name="comment" placeholder="Decision comment" />
              <Button className="xl:col-span-4" type="submit">Save Pricing Decision</Button>
            </form>
          </OpportunityFormCard>
          <ControlPlaneTable headers={["Opportunity", "Scenario", "Decision", "Comment", "Status"]} rows={analysis.pricingDecisions} />
        </TabsContent>

        <TabsContent value="reuse">
          <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
            <OpportunityFormCard title="Reuse Opportunity">
              <form action={cloneOpportunityAction} className="grid gap-3">
                <Select name="source_opportunity_id" required>
                  <SelectTrigger><SelectValue placeholder="Source opportunity" /></SelectTrigger>
                  <SelectContent>{opportunityOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input name="new_opportunity_id" placeholder="New Opportunity ID optional" />
                <Input name="customer_name" placeholder="New customer name optional" />
                <Button type="submit">Clone Into Draft</Button>
              </form>
            </OpportunityFormCard>
            <Card>
              <CardHeader>
                <CardTitle>Export to Excel</CardTitle>
                <CardDescription>On-demand export only. No background generation and no AI call.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a href="/api/opportunities/export" target="_blank" rel="noreferrer">Download Excel</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function OpportunityFormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OpportunitySelect({ opportunities }: { opportunities: { id: string; label: string }[] }) {
  return (
    <Select name="opportunity_id" required>
      <SelectTrigger><SelectValue placeholder="Opportunity ID" /></SelectTrigger>
      <SelectContent>{opportunities.map((opportunity) => <SelectItem key={opportunity.id} value={opportunity.id}>{opportunity.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function RiskSummaryCard({ title, rows, valueKey }: { title: string; rows: RecordMap[]; valueKey: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.length ? rows.map((risk) => (
          <div className="rounded-md border p-3" key={`${risk.opportunity_id}-${risk.risk_id}-${valueKey}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{risk.risk_title}</div>
              <Badge variant="outline">{risk[valueKey] || "-"}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{risk.opportunity_id} / {risk.risk_domain} / {risk.linked_commodity || "No commodity"}</div>
          </div>
        )) : <EmptyState title="No risks yet" description="Risk register entries will appear here." />}
      </CardContent>
    </Card>
  );
}

function CashflowPanel({ data }: { data: DashboardData }) {
  const analysis = data.opportunity_analysis || emptyOpportunityAnalysis();
  const approvedOpportunities = analysis.opportunities.filter((opportunity) => ["approved", "ready_for_cashflow", "pricing_approved", "submitted"].includes(opportunity.opportunity_status));
  const opportunityOptions = approvedOpportunities.map((opportunity) => ({ id: opportunity.opportunity_id, label: `${opportunity.opportunity_id} - ${opportunity.customer_name}` }));

  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        <MetricCard label="Approved Opportunities" value={String(approvedOpportunities.length)} />
        <MetricCard label="Cashflow Options" value={String(analysis.cashflowOptions.length)} />
        <MetricCard label="Approved Options" value={String(analysis.cashflowOptions.filter((option) => option.status === "approved").length)} />
      </div>
      <OpportunityFormCard title="Create Cashflow Option">
        <form action={createCashflowOptionAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <Select name="opportunity_id" required>
            <SelectTrigger><SelectValue placeholder="Approved Opportunity ID" /></SelectTrigger>
            <SelectContent>{opportunityOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input name="option_id" placeholder="Option ID optional" />
          <Input name="option_name" placeholder="Option name" required />
          <Input name="currency" defaultValue="USD" placeholder="Currency" />
          <Input name="dso_days" defaultValue="30" type="number" placeholder="DSO days" />
          <Input name="payment_terms" placeholder="Payment terms" />
          <MoneyInput name="gross_invoice" placeholder="Gross invoice" />
          <MoneyInput name="incentive_discount" placeholder="Incentive / discount" />
          <MoneyInput name="withholding_tax" placeholder="Withholding tax" />
          <MoneyInput name="revenue_timing_amount" placeholder="Revenue timing amount" />
          <MoneyInput name="cost_timing_amount" placeholder="Cost timing amount" />
          <MoneyInput name="npv" placeholder="NPV optional" />
          <Textarea name="milestone_definition" placeholder="Milestone definition" />
          <Textarea name="invoice_schedule" placeholder="Invoice schedule" />
          <Textarea name="revenue_timing" placeholder="Revenue timing" />
          <Textarea name="cost_timing" placeholder="Cost timing" />
          <Alert className="2xl:col-span-5">
            <AlertTitle>Configurable Formula</AlertTitle>
            <AlertDescription>cash impact = revenue timing amount - discount - withholding tax - cost timing amount. margin impact = gross invoice - discount - withholding tax - cost timing amount.</AlertDescription>
          </Alert>
          <Button className="2xl:col-span-5" type="submit"><Plus className="h-4 w-4" /> Create Cashflow Option</Button>
        </form>
      </OpportunityFormCard>
      <DataTable
        headers={["Opportunity", "Option", "Payment", "Gross", "Discount", "Cash Impact", "Margin", "Approval", "Action"]}
        rows={analysis.cashflowOptions}
        render={(option) => (
          <TableRow key={`${option.opportunity_id}-${option.option_id}`}>
            <TableCell className="font-mono text-xs">{option.opportunity_id}</TableCell>
            <TableCell>{option.option_id} - {option.option_name}</TableCell>
            <TableCell>{option.payment_terms || option.dso_days}</TableCell>
            <TableCell>{money(option.gross_invoice)}</TableCell>
            <TableCell>{money(option.incentive_discount)}</TableCell>
            <TableCell>{money(option.cash_impact)}</TableCell>
            <TableCell>{money(option.margin_impact)}</TableCell>
            <TableCell><StatusBadge value={option.status} /></TableCell>
            <TableCell>
              <form action={approveCashflowOptionAction} className="flex gap-2">
                <input name="opportunity_id" type="hidden" value={option.opportunity_id} />
                <input name="option_id" type="hidden" value={option.option_id} />
                <input name="decision" type="hidden" value="approved" />
                <Button size="sm" type="submit" disabled={option.status === "approved"}>Approve</Button>
              </form>
            </TableCell>
          </TableRow>
        )}
      />
    </section>
  );
}

function SdsPanel({ data }: { data: DashboardData }) {
  const analysis = data.opportunity_analysis || emptyOpportunityAnalysis();
  const opportunities = analysis.opportunities.map((opportunity) => ({ id: opportunity.opportunity_id, label: `${opportunity.opportunity_id} - ${opportunity.customer_name}` }));

  return (
    <section className="grid gap-5">
      <OpportunityFormCard title="Create Sales Decision for Submission">
        <form action={createSdsAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
          <Select name="opportunity_id" required>
            <SelectTrigger><SelectValue placeholder="Opportunity" /></SelectTrigger>
            <SelectContent>{opportunities.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input name="selected_scenario" placeholder="Selected scenario ID" required />
          <Input name="selected_cashflow" placeholder="Approved cashflow option ID" required />
          <Select name="presenter_role" required>
            <SelectTrigger><SelectValue placeholder="Presenter role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Solution Architect">Solution Architect</SelectItem>
              <SelectItem value="Program Director">Program Director</SelectItem>
            </SelectContent>
          </Select>
          <Input name="presenter_name" placeholder="Presenter name" />
          <Textarea name="opportunity_outcome" placeholder="Opportunity Analysis outcome" />
          <Textarea name="commodity_breakdown" placeholder="Commodity breakdown" />
          <Textarea name="risk_summary" placeholder="Risk summary" />
          <Textarea name="cashflow_outcome" placeholder="Cashflow analysis outcome" />
          <Textarea name="pricing_structure_decision" placeholder="Pricing structure decision" />
          <Textarea name="business_value_notes" placeholder="Business value notes" />
          <Textarea name="company_value" placeholder="Company value notes" />
          <Textarea name="delivery_capability_notes" placeholder="Delivery capability notes" />
          <Alert className="xl:col-span-4">
            <AlertTitle>PPT Explanation</AlertTitle>
            <AlertDescription>Offline only. The system records metadata and decisions; it does not generate PPT automatically.</AlertDescription>
          </Alert>
          <Button className="xl:col-span-4" type="submit">Create SDS</Button>
        </form>
      </OpportunityFormCard>
      <DataTable
        headers={["SDS", "Opportunity", "Scenario", "Cashflow", "Business Value", "Delivery", "Decision", "Action"]}
        rows={analysis.sdsRecords}
        render={(sds) => (
          <TableRow key={sds.sds_id}>
            <TableCell className="font-mono text-xs">{sds.sds_id}</TableCell>
            <TableCell>{sds.opportunity_id}</TableCell>
            <TableCell>{sds.selected_scenario}</TableCell>
            <TableCell>{sds.selected_cashflow}</TableCell>
            <TableCell>{sds.business_value_notes}</TableCell>
            <TableCell>{sds.delivery_capability_notes}</TableCell>
            <TableCell><StatusBadge value={sds.decision} /></TableCell>
            <TableCell>
              <div className="flex gap-2">
                <SdsDecisionButton sdsId={sds.sds_id} decision="approved" label="Approve" />
                <SdsDecisionButton sdsId={sds.sds_id} decision="rejected" label="Reject" />
              </div>
            </TableCell>
          </TableRow>
        )}
      />
    </section>
  );
}

function SdsDecisionButton({ sdsId, decision, label }: { sdsId: string; decision: string; label: string }) {
  return (
    <form action={decideSdsAction}>
      <input name="sds_id" type="hidden" value={sdsId} />
      <input name="decision" type="hidden" value={decision} />
      <input name="comments" type="hidden" value={`Sponsor ${decision}`} />
      <Button size="sm" variant={decision === "approved" ? "default" : "outline"} type="submit">{label}</Button>
    </form>
  );
}

function SdoaPanel({ data }: { data: DashboardData }) {
  const analysis = data.opportunity_analysis || emptyOpportunityAnalysis();
  const approvedSdsOpportunityIds = new Set(analysis.sdsRecords.filter((sds) => sds.decision === "approved").map((sds) => sds.opportunity_id));
  const opportunities = analysis.opportunities.filter((opportunity) => approvedSdsOpportunityIds.has(opportunity.opportunity_id)).map((opportunity) => ({ id: opportunity.opportunity_id, label: `${opportunity.opportunity_id} - ${opportunity.customer_name}` }));

  return (
    <section className="grid gap-5">
      <OpportunityFormCard title="Create Sales Decision Order Acknowledgement">
        <form action={createSdoaAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
          <Select name="opportunity_id" required>
            <SelectTrigger><SelectValue placeholder="Approved SDS Opportunity" /></SelectTrigger>
            <SelectContent>{opportunities.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input name="received_po_number" placeholder="Received PO / contract number" />
          <Input name="contract_document_id" placeholder="Contract Drive file link or ID" />
          <Input name="value_baseline" placeholder="Baseline value" />
          <Input name="value_received" placeholder="Received value" />
          <Input name="scope_baseline" placeholder="Baseline scope" />
          <Input name="scope_received" placeholder="Received scope" />
          <Input name="timeline_baseline" placeholder="Baseline timeline" />
          <Input name="timeline_received" placeholder="Received timeline" />
          <Input name="payment_terms_baseline" placeholder="Baseline payment terms" />
          <Input name="payment_terms_received" placeholder="Received payment terms" />
          <Textarea name="delivery_obligations_received" placeholder="Delivery obligations" />
          <Textarea name="legal_commercial_received" placeholder="Legal / commercial deviations" />
          <Textarea name="customer_requirements_received" placeholder="Customer requirements" />
          <Input name="price_delta_received" placeholder="Price delta" />
          <Input name="scope_delta_received" placeholder="Scope delta" />
          <Input name="schedule_delta_received" placeholder="Schedule delta" />
          <Input name="cashflow_delta_received" placeholder="Cashflow delta" />
          <Input name="risk_delta_received" placeholder="Risk delta" />
          <Input name="contract_legal_delta_received" placeholder="Contract/legal delta" />
          <Textarea className="xl:col-span-4" name="comments" placeholder="Comments" />
          <Button className="xl:col-span-4" type="submit">Create SDOA</Button>
        </form>
      </OpportunityFormCard>
      <DataTable
        headers={["SDOA", "Opportunity", "PO", "Outcome", "Sponsor", "Decided", "Comments", "Action"]}
        rows={analysis.sdoaRecords}
        render={(sdoa) => (
          <TableRow key={sdoa.sdoa_id}>
            <TableCell className="font-mono text-xs">{sdoa.sdoa_id}</TableCell>
            <TableCell>{sdoa.opportunity_id}</TableCell>
            <TableCell>{sdoa.received_po_number || "-"}</TableCell>
            <TableCell><StatusBadge value={sdoa.outcome} /></TableCell>
            <TableCell>{sdoa.sponsor || "-"}</TableCell>
            <TableCell>{sdoa.decided_at || "-"}</TableCell>
            <TableCell>{sdoa.comments || "-"}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <SdoaDecisionButton sdoaId={sdoa.sdoa_id} decision="acknowledged" label="Acknowledge" />
                <SdoaDecisionButton sdoaId={sdoa.sdoa_id} decision="returned" label="Return" />
                <SdoaDecisionButton sdoaId={sdoa.sdoa_id} decision="rejected" label="Reject" />
              </div>
            </TableCell>
          </TableRow>
        )}
      />
      <ControlPlaneTable headers={["SDOA", "Opportunity", "Category", "Baseline", "Received", "Decision", "Comment"]} rows={analysis.sdoaDeviations} />
    </section>
  );
}

function SdoaDecisionButton({ sdoaId, decision, label }: { sdoaId: string; decision: string; label: string }) {
  return (
    <form action={decideSdoaAction}>
      <input name="sdoa_id" type="hidden" value={sdoaId} />
      <input name="decision" type="hidden" value={decision} />
      <input name="comments" type="hidden" value={`Sponsor ${decision}`} />
      <Button size="sm" variant={decision === "acknowledged" ? "default" : "outline"} type="submit">{label}</Button>
    </form>
  );
}

function emptyOpportunityAnalysis(): NonNullable<DashboardData["opportunity_analysis"]> {
  return {
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
  };
}

function ProjectExecutionPanel({ data }: { data: DashboardData }) {
  const execution = data.project_execution || { projects: [], gates: [], sites: [], resourceDemands: [], commercialFlows: [] };
  const analysis = data.opportunity_analysis || emptyOpportunityAnalysis();
  const approvedSdoa = analysis.sdoaRecords.filter((sdoa) => ["acknowledged", "approved", "accepted"].includes(sdoa.outcome));
  const projectOptions = execution.projects.map((project) => ({ id: project.projectId, label: `${project.projectId} - ${project.customer}` }));
  const netSales = execution.projects.reduce((sum, project) => sum + Number(project.netSalesEstimate || 0), 0);
  const resourceGaps = execution.resourceDemands.filter((demand) => demand.gapStatus !== "filled").length;
  const commercialPending = execution.commercialFlows.filter((flow) => !["approved", "closed"].includes(flow.approvalStatus)).length;
  const approvedCrCount = data.delivery_governance?.changeRequests.filter((cr) => cr.approvalStatus === "approved").length || 0;
  const crAddOnSales = data.delivery_governance?.changeRequests
    .filter((cr) => cr.approvalStatus === "approved")
    .reduce((sum, cr) => sum + Number(cr.addOnSalesValue || 0), 0) || 0;

  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-8 gap-3 max-2xl:grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Execution Projects" value={String(execution.projects.length)} />
        <MetricCard label="Gate Requests" value={String(execution.gates.filter((gate) => gate.approvalStatus === "requested").length)} />
        <MetricCard label="Loaded Sites" value={String(execution.sites.length)} />
        <MetricCard label="Net Sales Estimate" value={money(String(netSales))} />
        <MetricCard label="Approved CR" value={String(approvedCrCount)} />
        <MetricCard label="CR Add-on Sales" value={money(String(crAddOnSales))} />
        <MetricCard label="Resource Gaps" value={String(resourceGaps)} />
        <MetricCard label="Commercial Pending" value={String(commercialPending)} />
      </div>
      <Tabs defaultValue="setup">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="setup">Project Setup</TabsTrigger>
          <TabsTrigger value="resources">Resource Management</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="sites">Site Handler</TabsTrigger>
          <TabsTrigger value="commercial">Commercial Docs</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="setup">
          <OpportunityFormCard title="Create Project From Approved SDOA">
            <form action={createExecutionProjectFromSdoaAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <Input name="project_id" placeholder="Project ID optional" />
              <Select name="linked_sdoa_id" required>
                <SelectTrigger><SelectValue placeholder="Approved SDOA" /></SelectTrigger>
                <SelectContent>{approvedSdoa.map((sdoa) => <SelectItem key={sdoa.sdoa_id} value={sdoa.sdoa_id}>{sdoa.opportunity_id} / {sdoa.received_po_number || sdoa.sdoa_id}</SelectItem>)}</SelectContent>
              </Select>
              <Input name="linked_opportunity_id" placeholder="Linked opportunity ID" required />
              <Input name="linked_sds_id" placeholder="Linked SDS ID" required />
              <Input name="customer" placeholder="Customer" required />
              <Input name="sponsor" placeholder="Sponsor" required />
              <Input name="project_leader" placeholder="Project Manager / Program Director" required />
              <Input name="project_finance_manager" placeholder="Project Finance Management" />
              <Input name="resource_manager" placeholder="Resource Manager" />
              <Input name="contract_legal_owner" placeholder="Contract / Legal owner" />
              <Input name="commercial_owner" placeholder="Commercial owner" />
              <Input name="framework_version" placeholder="Framework version optional" />
              <Textarea name="milestone_plan" placeholder="Milestone plan" />
              <Textarea name="site_cluster_configuration" placeholder="Site / cluster configuration" />
              <Textarea name="delivery_baseline" placeholder="Delivery baseline" />
              <Textarea name="financial_baseline" placeholder="Financial baseline" />
              <Input name="governance_cadence" placeholder="Governance cadence" />
              <Button className="xl:col-span-4" type="submit">Create Execution Project</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Project", "Opportunity", "SDOA", "Customer", "Leader", "Sponsor", "Framework", "Net Sales", "CR Budget", "CR Revenue", "Status"]}
            rows={execution.projects}
            render={(project) => (
              <TableRow key={project.projectId}>
                <TableCell className="font-mono text-xs">{project.projectId}</TableCell>
                <TableCell>{project.linkedOpportunityId}</TableCell>
                <TableCell>{project.linkedSdoaId}</TableCell>
                <TableCell>{project.customer}</TableCell>
                <TableCell>{project.projectLeader}</TableCell>
                <TableCell>{project.sponsor}</TableCell>
                <TableCell>{project.frameworkVersion}</TableCell>
                <TableCell>{money(project.netSalesEstimate)}</TableCell>
                <TableCell>{money(project.additionalBudget || "0")}</TableCell>
                <TableCell>{money(project.additionalRevenue || "0")}</TableCell>
                <TableCell><StatusBadge value={project.status} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="resources">
          <Alert className="mb-4">
            <AlertTitle>Project Execution Tool</AlertTitle>
            <AlertDescription>Resource Management is a tool inside Project Execution. Rows are capped on dashboard and roll up through governance summaries.</AlertDescription>
          </Alert>
          <OpportunityFormCard title="Project Resource Demand">
            <form action={upsertProjectResourceDemandAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Select name="project_id" required><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent></Select>
              <Input name="project_demand" placeholder="Project demand" />
              <Input name="required_role" placeholder="Required role" required />
              <Input name="required_skill" placeholder="Required skill" />
              <Input name="location" placeholder="Location" />
              <Input name="start_date" type="date" />
              <Input name="end_date" type="date" />
              <Input name="allocation_percent" placeholder="Allocation %" defaultValue="100" />
              <Input name="assigned_resource" placeholder="Assigned resource" />
              <NativeSelect name="gap_status" options={["open_gap", "shortlisted", "filled", "at_risk"]} />
              <NativeSelect name="onboarding_status" options={["not_started", "in_progress", "completed", "blocked"]} />
              <NativeSelect name="timesheet_readiness" options={["not_ready", "ready", "blocked"]} />
              <Input name="resource_risk" placeholder="Resource risk" />
              <Textarea name="replacement_plan" placeholder="Replacement plan" />
              <Button className="2xl:col-span-5" type="submit">Save Resource Demand</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Project", "Demand", "Role", "Skill", "Location", "Dates", "Alloc", "Assigned", "Gap", "Onboarding", "Timesheet", "Risk"]}
            rows={execution.resourceDemands}
            render={(row) => (
              <TableRow key={row.demandId}>
                <TableCell className="font-mono text-xs">{row.projectId}</TableCell>
                <TableCell>{row.projectDemand || "-"}</TableCell>
                <TableCell>{row.requiredRole}</TableCell>
                <TableCell>{row.requiredSkill || "-"}</TableCell>
                <TableCell>{row.location || "-"}</TableCell>
                <TableCell>{row.startDate || "-"} - {row.endDate || "-"}</TableCell>
                <TableCell>{row.allocationPercent}%</TableCell>
                <TableCell>{row.assignedResource || "-"}</TableCell>
                <TableCell><StatusBadge value={row.gapStatus} /></TableCell>
                <TableCell><StatusBadge value={row.onboardingStatus} /></TableCell>
                <TableCell><StatusBadge value={row.timesheetReadiness} /></TableCell>
                <TableCell>{row.resourceRisk || "-"}</TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="gates">
          <DataTable
            headers={["Project", "Gate", "RAG", "Checklist", "Approval", "Decision", "Actions"]}
            rows={execution.gates}
            render={(gate) => (
              <TableRow key={gate.gateId}>
                <TableCell className="font-mono text-xs">{gate.projectId}</TableCell>
                <TableCell>{gate.gateName}</TableCell>
                <TableCell><StatusBadge value={gate.ragStatus} /></TableCell>
                <TableCell><StatusBadge value={gate.mandatoryChecklistComplete === "true" ? "complete" : "missing"} /></TableCell>
                <TableCell><StatusBadge value={gate.approvalStatus} /></TableCell>
                <TableCell>{gate.decision || "-"}</TableCell>
                <TableCell><GateDialog gate={gate} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="sites">
          <Alert className="mb-4">
            <AlertTitle>Pagination Guard</AlertTitle>
            <AlertDescription>The dashboard loads the first 50 site/cluster rows only. Use export for offline review.</AlertDescription>
          </Alert>
          <OpportunityFormCard title="Add or Update Site / Cluster">
            <form action={upsertSiteHandlerAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Select name="project_id" required>
                <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input name="site_cluster_id" placeholder="Site / Cluster ID" required />
              <Input name="scope_package" placeholder="Scope package" />
              <Input name="planned_date" type="date" />
              <Input name="actual_date" type="date" />
              <Input name="progress_status" placeholder="Progress status" />
              <Input name="acceptance_status" placeholder="Acceptance status" />
              <Input name="acceptance_certificate_document" placeholder="Acceptance Certificate Drive ID/link" />
              <Input name="good_receipt_document" placeholder="Good Receipt Drive ID/link" />
              <Input name="invoice_status" placeholder="Invoice status" />
              <Input name="invoice_document" placeholder="Invoice Drive ID/link" />
              <Input name="handover_status" placeholder="Handover status" />
              <MoneyInput name="accepted_scope_value" placeholder="Accepted scope value" />
              <Button className="2xl:col-span-5" type="submit">Save Site / Cluster</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Project", "Site", "Scope", "Plan", "Actual", "Progress", "Acceptance", "GR", "Invoice", "Handover", "Net Sales Value"]}
            rows={execution.sites}
            render={(site) => (
              <TableRow key={`${site.projectId}-${site.siteClusterId}`}>
                <TableCell className="font-mono text-xs">{site.projectId}</TableCell>
                <TableCell>{site.siteClusterId}</TableCell>
                <TableCell>{site.scopePackage}</TableCell>
                <TableCell>{site.plannedDate || "-"}</TableCell>
                <TableCell>{site.actualDate || "-"}</TableCell>
                <TableCell><StatusBadge value={site.progressStatus} /></TableCell>
                <TableCell><StatusBadge value={site.acceptanceStatus} /></TableCell>
                <TableCell>{site.goodReceiptDocument || "-"}</TableCell>
                <TableCell>{site.invoiceStatus}</TableCell>
                <TableCell>{site.handoverStatus}</TableCell>
                <TableCell>{money(site.acceptedScopeValue)}</TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="commercial">
          <Alert className="mb-4">
            <AlertTitle>Workflow Tracking Only</AlertTitle>
            <AlertDescription>This is commercial document and procurement workflow tracking, not an accounting system.</AlertDescription>
          </Alert>
          <OpportunityFormCard title="Commercial Document / Procurement Flow">
            <form action={upsertCommercialProcurementFlowAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Select name="project_id" required><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent></Select>
              <Input name="site_cluster_id" placeholder="Site / cluster" />
              <Input name="accepted_milestone" placeholder="Accepted milestone" />
              <Input name="purchase_request" placeholder="Purchase Request" />
              <Input name="purchase_order" placeholder="Purchase Order" />
              <Input name="supplier_vendor" placeholder="Supplier / vendor" />
              <Input name="customer_po" placeholder="Customer PO" />
              <Input name="invoice" placeholder="Invoice" />
              <Input name="invoice_item" placeholder="Invoice item" />
              <NativeSelect name="invoice_status" options={["draft", "submitted", "approved", "sent", "cancelled"]} />
              <NativeSelect name="payment_status" options={["unpaid", "partial", "paid", "overdue"]} />
              <NativeSelect name="gr_status" options={["pending", "submitted", "accepted", "rejected"]} />
              <Input name="gr_document" placeholder="GR document Drive link/ID" />
              <Input name="customer_po_document" placeholder="Customer PO document Drive link/ID" />
              <Input name="invoice_document" placeholder="Invoice document Drive link/ID" />
              <Input name="document_attachment" placeholder="Other document attachment" />
              <NativeSelect name="approval_status" options={["draft", "submitted", "approved", "rejected"]} />
              <Button className="2xl:col-span-5" type="submit">Save Commercial Flow</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Project", "Site", "Milestone", "PR", "PO", "Vendor", "Customer PO", "Invoice", "Invoice Status", "Payment", "GR", "Approval", "Actions"]}
            rows={execution.commercialFlows}
            render={(row) => (
              <TableRow key={row.flowId}>
                <TableCell className="font-mono text-xs">{row.projectId}</TableCell>
                <TableCell>{row.siteClusterId || "-"}</TableCell>
                <TableCell>{row.acceptedMilestone || "-"}</TableCell>
                <TableCell>{row.purchaseRequest || "-"}</TableCell>
                <TableCell>{row.purchaseOrder || "-"}</TableCell>
                <TableCell>{row.supplierVendor || "-"}</TableCell>
                <TableCell>{row.customerPo || "-"}</TableCell>
                <TableCell>{row.invoice || "-"}</TableCell>
                <TableCell><StatusBadge value={row.invoiceStatus} /></TableCell>
                <TableCell><StatusBadge value={row.paymentStatus} /></TableCell>
                <TableCell><StatusBadge value={row.grStatus} /></TableCell>
                <TableCell><StatusBadge value={row.approvalStatus} /></TableCell>
                <TableCell><CommercialFlowDecisionDialog flowId={row.flowId} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="imports">
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            <OpportunityFormCard title="Import Site List">
              <form action={importSiteListExcelAction} className="grid gap-3">
                <Input name="file" type="file" accept=".xlsx,.xls,.csv" required />
                <Button type="submit">Import Site List</Button>
              </form>
            </OpportunityFormCard>
            <OpportunityFormCard title="Import Framework Settings">
              <form action={importFrameworkSettingsExcelAction} className="grid gap-3">
                <Input name="file" type="file" accept=".xlsx,.xls" required />
                <Input name="reason" placeholder="Reason" />
                <Input name="approval_reference" placeholder="Approval reference optional" />
                <Button type="submit">Admin Import Settings</Button>
              </form>
            </OpportunityFormCard>
          </div>
        </TabsContent>
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Project Execution Export</CardTitle>
              <CardDescription>On-demand Excel exports. No background load of all sites, resources, or commercial records on dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild><a href="/api/project-execution/export" target="_blank" rel="noreferrer">Project Execution Workbook</a></Button>
              {["opportunity-summary", "risk-register", "cashflow-summary", "sds-summary", "sdoa-delta", "project-dashboard", "site-handler", "governance-report", "talent-planning", "ratecard"].map((kind) => (
                <Button asChild key={kind} variant="outline"><a href={`/api/exports/${kind}`} target="_blank" rel="noreferrer">{kind.replaceAll("-", " ")}</a></Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function GateDialog({ gate }: { gate: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline">Gate</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{gate.gateName}</DialogTitle>
          <DialogDescription>Project Manager or Program Director requests approval. Sponsor decides transition.</DialogDescription>
        </DialogHeader>
        <form action={updateProjectGateAction} className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <input name="gate_id" type="hidden" value={gate.gateId} />
          <Textarea name="checklist" defaultValue={gate.checklist} placeholder="Checklist" />
          <Select name="mandatory_checklist_complete" defaultValue={gate.mandatoryChecklistComplete || "false"}>
            <SelectTrigger><SelectValue placeholder="Checklist complete?" /></SelectTrigger>
            <SelectContent><SelectItem value="false">Mandatory missing</SelectItem><SelectItem value="true">Mandatory complete</SelectItem></SelectContent>
          </Select>
          <Textarea name="required_input" defaultValue={gate.requiredInput} placeholder="Required input" />
          <Textarea name="required_output" defaultValue={gate.requiredOutput} placeholder="Required output" />
          <Input name="required_document_template" defaultValue={gate.requiredDocumentTemplate} placeholder="Required document template" />
          <Input name="rag_status" defaultValue={gate.ragStatus || "green"} placeholder="RAG status" />
          <Textarea name="issues" defaultValue={gate.issues} placeholder="Issues" />
          <Textarea name="risks" defaultValue={gate.risks} placeholder="Risks" />
          <Button className="sm:col-span-2" type="submit">Request Sponsor Approval</Button>
        </form>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <GateDecisionForm gateId={gate.gateId} decision="approved" label="Sponsor Approve" />
          <GateDecisionForm gateId={gate.gateId} decision="rejected" label="Sponsor Reject" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GateDecisionForm({ gateId, decision, label }: { gateId: string; decision: string; label: string }) {
  return (
    <form action={decideProjectGateAction} className="grid gap-2 rounded-md border p-3">
      <input name="gate_id" type="hidden" value={gateId} />
      <input name="decision" type="hidden" value={decision} />
      <Select name="sponsor_exception" defaultValue="false">
        <SelectTrigger><SelectValue placeholder="Sponsor exception" /></SelectTrigger>
        <SelectContent><SelectItem value="false">No exception</SelectItem><SelectItem value="true">Approve exception</SelectItem></SelectContent>
      </Select>
      <Input name="comments" placeholder="Sponsor comments" />
      <Button type="submit" variant={decision === "approved" ? "default" : "outline"}>{label}</Button>
    </form>
  );
}

function CommercialFlowDecisionDialog({ flowId }: { flowId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline">Approve</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commercial Flow Approval</DialogTitle>
          <DialogDescription>Tracks approval only. Accounting remains outside Sevenfold.</DialogDescription>
        </DialogHeader>
        <form action={decideCommercialProcurementFlowAction} className="grid gap-3">
          <input name="flow_id" type="hidden" value={flowId} />
          <NativeSelect name="approval_status" options={["approved", "rejected", "returned"]} />
          <Textarea name="comments" placeholder="Comments" />
          <Button type="submit">Save Decision</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GovernancePanel({ data }: { data: DashboardData }) {
  const governance = data.delivery_governance || { changeRequests: [], incidents: [], governanceRecords: [] };
  const summary = data.governance_summary;
  const projectOptions = data.project_execution?.projects.map((project) => ({ id: project.projectId, label: `${project.projectId} - ${project.customer}` })) || [];
  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-8 gap-3 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Open CR" value={String(summary?.openChangeRequests || 0)} />
        <MetricCard label="Approved CR" value={String(summary?.approvedChangeRequests || 0)} />
        <MetricCard label="Add-on Sales" value={money(summary?.addOnSalesValue || "0")} />
        <MetricCard label="Open Incidents" value={String(summary?.openIncidents || 0)} />
        <MetricCard label="Red Quality" value={String(summary?.redIncidents || 0)} />
        <MetricCard label="Net Sales" value={money(summary?.netSalesEstimate || "0")} />
        <MetricCard label="Resource Gaps" value={String(summary?.resourceGaps || 0)} />
        <MetricCard label="Timesheet Not Ready" value={String(summary?.timesheetNotReady || 0)} />
      </div>
      <Tabs defaultValue="executive">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="executive">Executive Dashboard</TabsTrigger>
          <TabsTrigger value="cr">Change Requests</TabsTrigger>
          <TabsTrigger value="quality">Quality & Incidents</TabsTrigger>
          <TabsTrigger value="records">Governance Records</TabsTrigger>
        </TabsList>
        <TabsContent value="executive">
          <Card>
            <CardHeader>
              <CardTitle>Single-pane Executive Dashboard</CardTitle>
              <CardDescription>Cached summary. Heavy detail is loaded only in the tabs below; no polling.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
              {(summary?.latestEscalations || []).map((item) => (
                <div className="rounded-md border p-3" key={item.governanceId}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.level}</p>
                    <StatusBadge value={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.escalations}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.workstream} / {item.actionOwner || "No owner"}</p>
                </div>
              ))}
              {!(summary?.latestEscalations || []).length && <EmptyState title="No escalations" description="Governance escalations will appear here after records are submitted." />}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cr">
          <OpportunityFormCard title="Create Change Request">
            <form action={createChangeRequestAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <Select name="project_id" required><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent></Select>
              <Input name="cr_title" placeholder="CR title" required />
              <MoneyInput name="additional_budget" placeholder="Additional budget" />
              <MoneyInput name="add_on_sales_value" placeholder="Add-on sales value" />
              <Textarea name="description" placeholder="Description" />
              <Textarea name="reason" placeholder="Reason" />
              <Textarea name="scope_impact" placeholder="Scope impact" />
              <Textarea name="schedule_impact" placeholder="Schedule impact" />
              <Textarea name="cost_impact" placeholder="Cost impact" />
              <Textarea name="revenue_impact" placeholder="Revenue impact" />
              <Textarea name="risk_impact" placeholder="Risk impact" />
              <Input name="document_attachment" placeholder="Drive file link or ID" />
              <Button className="xl:col-span-4" type="submit">Submit CR for Sponsor Approval</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["CR", "Project", "Title", "Budget", "Add-on Sales", "Status", "Actions"]}
            rows={governance.changeRequests}
            render={(cr) => (
              <TableRow key={cr.crId}>
                <TableCell className="font-mono text-xs">{cr.crId}</TableCell>
                <TableCell>{cr.projectId}</TableCell>
                <TableCell>{cr.title}</TableCell>
                <TableCell>{money(cr.additionalBudget)}</TableCell>
                <TableCell>{money(cr.addOnSalesValue)}</TableCell>
                <TableCell><StatusBadge value={cr.approvalStatus} /></TableCell>
                <TableCell><CrDecisionDialog crId={cr.crId} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="quality">
          <OpportunityFormCard title="Create Quality / Incident Record">
            <form action={createQualityIncidentAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <Select name="project_id"><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger><SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent></Select>
              <Input name="incident_type" placeholder="Incident type" required />
              <NativeSelect name="severity" options={["low", "medium", "high", "critical"]} />
              <NativeSelect name="source" options={["service", "software", "delivery", "customer", "internal"]} />
              <Input name="incident_owner" placeholder="Incident owner" />
              <Input name="action_owner" placeholder="Action owner" />
              <Input name="gate_id" placeholder="Linked gate ID" />
              <Input name="site_cluster_id" placeholder="Linked site / cluster" />
              <Textarea name="rca" placeholder="Root cause analysis" />
              <Textarea name="corrective_action" placeholder="Corrective action" />
              <Textarea name="preventive_action" placeholder="Preventive action" />
              <Input name="due_date" type="date" />
              <NativeSelect name="rag_impact" options={["green", "amber", "red"]} />
              <NativeSelect name="status" options={["open", "in_progress", "resolved", "closed"]} />
              <Button className="xl:col-span-4" type="submit">Save Incident</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Incident", "Project", "Type", "Severity", "Source", "Owner", "Due", "RAG", "Status"]}
            rows={governance.incidents}
            render={(incident) => (
              <TableRow key={incident.incidentId}>
                <TableCell className="font-mono text-xs">{incident.incidentId}</TableCell>
                <TableCell>{incident.projectId || "-"}</TableCell>
                <TableCell>{incident.incidentType}</TableCell>
                <TableCell><StatusBadge value={incident.severity} /></TableCell>
                <TableCell>{incident.source}</TableCell>
                <TableCell>{incident.actionOwner || incident.incidentOwner}</TableCell>
                <TableCell>{incident.dueDate || "-"}</TableCell>
                <TableCell><StatusBadge value={incident.ragImpact} /></TableCell>
                <TableCell><StatusBadge value={incident.status} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="records">
          <OpportunityFormCard title="Create Governance Record">
            <form action={createGovernanceRecordAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <NativeSelect name="level" options={["Weekly Project Governance", "Bi-weekly Program Governance Board", "Monthly Business Review", "Monthly Portfolio Governance Board", "Quarterly Executive Steering Committee"]} />
              <NativeSelect name="workstream" options={["Project Delivery Governance", "Commercial Governance", "Financial Governance", "Resource Governance", "Quality Governance", "Risk Governance"]} />
              <Select name="project_id"><SelectTrigger><SelectValue placeholder="Project optional" /></SelectTrigger><SelectContent>{projectOptions.map((project) => <SelectItem key={project.id} value={project.id}>{project.label}</SelectItem>)}</SelectContent></Select>
              <Input name="period" placeholder="Period" />
              {["schedule", "scope", "cost_finance", "revenue", "margin", "invoicing", "cash_collection", "resources", "quality", "risks", "issues", "change_requests", "escalations", "decisions"].map((field) => <Textarea key={field} name={field} placeholder={field.replaceAll("_", " ")} />)}
              <Input name="action_owner" placeholder="Action owner" />
              <Input name="due_date" type="date" />
              <NativeSelect name="status" options={["open", "monitoring", "escalated", "closed"]} />
              <Button className="xl:col-span-4" type="submit">Save Governance Record</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Level", "Workstream", "Project", "Period", "Escalations", "Owner", "Status"]}
            rows={governance.governanceRecords}
            render={(record) => (
              <TableRow key={record.governanceId}>
                <TableCell>{record.level}</TableCell>
                <TableCell>{record.workstream}</TableCell>
                <TableCell>{record.projectId || "-"}</TableCell>
                <TableCell>{record.period || "-"}</TableCell>
                <TableCell>{record.escalations || "-"}</TableCell>
                <TableCell>{record.actionOwner || "-"}</TableCell>
                <TableCell><StatusBadge value={record.status} /></TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function CrDecisionDialog({ crId }: { crId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline">Sponsor</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sponsor Decision</DialogTitle>
          <DialogDescription>Approved CRs update project baseline and dashboard impact.</DialogDescription>
        </DialogHeader>
        <form action={decideChangeRequestAction} className="grid gap-3">
          <input name="cr_id" type="hidden" value={crId} />
          <NativeSelect name="decision" options={["approved", "rejected", "returned"]} />
          <Textarea name="comments" placeholder="Decision comments" />
          <Button type="submit">Record Decision</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TalentPlanningPanel({ data }: { data: DashboardData }) {
  const [readiness, setReadiness] = useState("all");
  const talents = data.talent_planning?.talents || [];
  const filtered = readiness === "all" ? talents : talents.filter((talent) => talent.readiness === readiness);
  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Talent Records" value={String(talents.length)} />
        <MetricCard label="Immediate" value={String(talents.filter((talent) => talent.readiness === "immediately").length)} />
        <MetricCard label="High Leaving Risk" value={String(talents.filter((talent) => talent.riskForLeaving.toLowerCase() === "high").length)} />
        <MetricCard label="Succession Candidates" value={String(talents.filter((talent) => talent.successionCandidateStatus).length)} />
      </div>
      <Tabs defaultValue="table">
        <TabsList><TabsTrigger value="table">Talent Table</TabsTrigger><TabsTrigger value="import">Import / Add</TabsTrigger></TabsList>
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Talent Planning</CardTitle>
              <CardDescription>Simple filtered table for readiness, succession, and retention risk. No heavy charts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <NativeSelect name="readiness_filter" value={readiness} onValueChange={setReadiness} options={["all", "immediately", "1-2 years", "3-5 years"]} />
              <DataTable
                headers={["Name", "Current Role", "Expected Role", "Readiness", "Leaving Risk", "Impact", "Certification", "Manager Readiness", "Status"]}
                rows={filtered}
                render={(talent) => (
                  <TableRow key={talent.talentId}>
                    <TableCell>{talent.name}</TableCell>
                    <TableCell>{talent.currentRole}</TableCell>
                    <TableCell>{talent.expectedRole}</TableCell>
                    <TableCell><StatusBadge value={talent.readiness} /></TableCell>
                    <TableCell><StatusBadge value={talent.riskForLeaving} /></TableCell>
                    <TableCell>{talent.impact}</TableCell>
                    <TableCell>{talent.certificationRequirement || "-"}</TableCell>
                    <TableCell>{talent.managerReadiness || "-"}</TableCell>
                    <TableCell><StatusBadge value={talent.status} /></TableCell>
                  </TableRow>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="import">
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            <OpportunityFormCard title="Import Talent Excel">
              <form action={importTalentPlanningExcelAction} className="grid gap-3">
                <Input name="file" type="file" accept=".xlsx,.xls,.csv" required />
                <Button type="submit">Import Excel</Button>
              </form>
            </OpportunityFormCard>
            <OpportunityFormCard title="Add Talent Record">
              <form action={createTalentRecordAction} className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Input name="name" placeholder="Name" required />
                <Input name="age" placeholder="Age" />
                <Input name="gender" placeholder="Gender" />
                <Input name="current_role" placeholder="Current role" />
                <Input name="expected_role" placeholder="Expected role" />
                <NativeSelect name="risk_for_leaving" options={["low", "medium", "high"]} />
                <Input name="impact" placeholder="Impact" />
                <NativeSelect name="readiness" options={["immediately", "1-2 years", "3-5 years"]} />
                <Input name="certification_requirement" placeholder="Certification requirement" />
                <Input name="manager_readiness" placeholder="Manager readiness" />
                <Input name="succession_candidate_status" placeholder="Succession candidate status" />
                <Textarea name="note" placeholder="Note" />
                <Button className="sm:col-span-2" type="submit">Save Talent</Button>
              </form>
            </OpportunityFormCard>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function RatecardPanel({ data }: { data: DashboardData }) {
  const ratecard = data.ratecard || { resources: [], fxRates: [], fxUpdatedAt: "" };
  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <MetricCard label="Ratecards" value={String(ratecard.resources.length)} />
        <MetricCard label="FX Cache" value={ratecard.fxUpdatedAt ? new Date(ratecard.fxUpdatedAt).toLocaleDateString() : "-"} />
        <MetricCard label="Avg Recommended" value={money(String(avg(ratecard.resources.map((row) => Number(row.recommendedHourlyCost || 0)))))} />
        <MetricCard label="Avg Blended" value={money(String(avg(ratecard.resources.map((row) => Number(row.blendedRate || 0)))))} />
      </div>
      <Tabs defaultValue="costing">
        <TabsList><TabsTrigger value="costing">Resource Costing</TabsTrigger><TabsTrigger value="import">Import</TabsTrigger><TabsTrigger value="fx">FX Cache</TabsTrigger></TabsList>
        <TabsContent value="costing">
          <OpportunityFormCard title="Ratecard & Blended Costing">
            <form action={upsertRatecardResourceAction} className="grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Input name="resource_type" placeholder="Resource type" required />
              <NativeSelect name="currency" options={["USD", "EUR", "IDR", "SGD", "AUD", "THB"]} />
              <MoneyInput name="monthly_net_accrual_salary" placeholder="Monthly net accrual salary" />
              <Input name="monthly_working_hours" placeholder="Monthly working hours" defaultValue="160" />
              <MoneyInput name="allocated_pc_cost_per_hour" placeholder="PC cost / hour" />
              <MoneyInput name="tools_cost_per_hour" placeholder="Tools cost / hour" />
              <MoneyInput name="facility_cost_per_hour" placeholder="Facility cost / hour" />
              <MoneyInput name="training_cost_per_hour" placeholder="Training cost / hour" />
              <MoneyInput name="internet_cost_per_hour" placeholder="Internet cost / hour" />
              <Input name="markup_percent" placeholder="Markup %" defaultValue="20" />
              <Input name="onsite_percent" placeholder="Onsite %" />
              <Input name="remote_percent" placeholder="Remote %" />
              <Input name="high_cost_location_percent" placeholder="High-cost location %" />
              <Input name="low_cost_location_percent" placeholder="Low-cost location %" />
              <Input name="senior_percent" placeholder="Senior %" />
              <Input name="junior_percent" placeholder="Junior %" />
              <Button className="2xl:col-span-5" type="submit">Save Ratecard</Button>
            </form>
          </OpportunityFormCard>
          <DataTable
            headers={["Resource", "Currency", "Monthly Salary", "Hours", "Base / Hour", "Ops / Hour", "Recommended", "Blended", "Markup"]}
            rows={ratecard.resources}
            render={(row) => (
              <TableRow key={row.ratecardId}>
                <TableCell>{row.resourceType}</TableCell>
                <TableCell>{row.currency}</TableCell>
                <TableCell>{money(row.monthlyNetAccrualSalary)}</TableCell>
                <TableCell>{row.monthlyWorkingHours}</TableCell>
                <TableCell>{money(row.baseHourlyCost)}</TableCell>
                <TableCell>{money(row.operationalCostPerHour)}</TableCell>
                <TableCell>{money(row.recommendedHourlyCost)}</TableCell>
                <TableCell>{money(row.blendedRate)}</TableCell>
                <TableCell>{row.markupPercent}%</TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
        <TabsContent value="import">
          <OpportunityFormCard title="Optional Ratecard Excel Import">
            <form action={importRatecardExcelAction} className="grid gap-3">
              <Input name="file" type="file" accept=".xlsx,.xls,.csv" required />
              <Button type="submit">Import Ratecard</Button>
            </form>
          </OpportunityFormCard>
        </TabsContent>
        <TabsContent value="fx">
          <Card>
            <CardHeader>
              <CardTitle>Manual FX Cache</CardTitle>
              <CardDescription>Currency refresh is manual only and cache-valid for at least 24 hours. Fallback rates are used if no external API is configured.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form action={manualRefreshFxRatesAction}><Button type="submit">Refresh FX Cache Manually</Button></form>
              <DataTable
                headers={["Currency", "Rate to USD", "Source", "Updated"]}
                rows={ratecard.fxRates}
                render={(rate) => (
                  <TableRow key={rate.currency}>
                    <TableCell>{rate.currency}</TableCell>
                    <TableCell>{rate.rateToUsd}</TableCell>
                    <TableCell><StatusBadge value={rate.source} /></TableCell>
                    <TableCell>{rate.updatedAt || "-"}</TableCell>
                  </TableRow>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function UsersPanel({
  users,
  clients,
  projects,
}: {
  users: RecordMap[];
  clients: DashboardData["clients"];
  projects: DashboardData["projects"];
}) {
  return (
    <Tabs defaultValue="list">
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <TabsList>
          <TabsTrigger value="list">Users</TabsTrigger>
          <TabsTrigger value="create">Create user</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="list">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Super Admin controls access, role scope, and temporary password resets.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Email", "Name", "Role", "Scope", "Status", "Actions"]}
              rows={users}
              render={(user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell><Badge variant="secondary">{user.role_id}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{user.client_id || user.employee_id || "-"}</TableCell>
                  <TableCell><StatusBadge value={user.status} /></TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Edit</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit user</DialogTitle>
                          <DialogDescription>Update role, scope, status, or reset password.</DialogDescription>
                        </DialogHeader>
                        <form action={updateUserAction} className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                          <input name="user_id" type="hidden" value={user.user_id} />
                          <Input name="full_name" defaultValue={user.full_name} placeholder="Full name" />
                          <Input name="role_id" defaultValue={user.role_id} placeholder="Role ID" />
                          <NativeSelect name="client_id" defaultValue={user.client_id} options={clients} emptyLabel="No client" />
                          <NativeSelect name="project_id" defaultValue={user.project_id} options={projects} emptyLabel="No project" />
                          <Input name="employee_id" defaultValue={user.employee_id} placeholder="Employee ID" />
                          <Input name="temporary_password" placeholder="Reset password" type="password" />
                          <Input name="status" defaultValue={user.status} placeholder="Status" />
                          <Button className="sm:col-span-2" type="submit">Save changes</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="create">
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
            <CardDescription>Assign scoped access from existing client and project master data.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUserAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <Input name="email" placeholder="Email" type="email" required />
              <Input name="full_name" placeholder="Full name" required />
              <RoleSelect />
              <Input name="temporary_password" placeholder="Temporary password" type="password" required />
              <StatusSelect />
              <NativeSelect name="client_id" options={clients} emptyLabel="No client scope" />
              <NativeSelect name="project_id" options={projects} emptyLabel="No project scope" />
              <Input name="employee_id" placeholder="Employee ID" />
              <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
                <Plus className="h-4 w-4" /> Create User
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function MasterSetup({
  clients,
  projects,
  clientForProject,
  setClientForProject,
}: {
  clients: DashboardData["clients"];
  projects: DashboardData["projects"];
  clientForProject: string;
  setClientForProject: (value: string) => void;
}) {
  return (
    <section className="grid gap-5">
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>New Client</CardTitle>
            <CardDescription>Create client master data before assigning candidates or users.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createClientAction} className="grid gap-3">
              <Input name="client_id" placeholder="Client ID, optional auto-generated" />
              <Input name="client_name" placeholder="Client name" required />
              <Input name="client_code" placeholder="Client code, e.g. TECHBROS" required />
              <Input name="primary_contact_name" placeholder="Primary contact" />
              <Input name="primary_contact_email" placeholder="Primary contact email" />
              <Button type="submit"><Plus className="h-4 w-4" /> Create Client</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Project</CardTitle>
            <CardDescription>Projects are tied to a selected client and become available in intake dropdowns.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProjectAction} className="grid gap-3">
              <NativeSelect
                name="client_id"
                value={clientForProject}
                onValueChange={setClientForProject}
                options={clients}
                emptyLabel="Select client"
                required
              />
              <Input name="project_id" placeholder="Project ID, optional auto-generated" />
              <Input name="project_name" placeholder="Project name" required />
              <Input name="project_code" placeholder="Project code, e.g. TECHBROS-RFOPT" required />
              <Input name="start_date" type="date" />
              <Button type="submit"><Plus className="h-4 w-4" /> Create Project</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current Master Data</CardTitle>
          <CardDescription>IDs are shown for verification and integration checks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            <MiniList title="Clients" items={clients.map((client) => `${client.id} - ${client.label}`)} />
            <MiniList title="Projects" items={projects.map((project) => `${project.id} - ${project.label}`)} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CandidatePanel({
  candidates,
  clients,
  projects,
  clientForCandidate,
  setClientForCandidate,
  user,
}: {
  candidates: RecordMap[];
  clients: DashboardData["clients"];
  projects: DashboardData["projects"];
  clientForCandidate: string;
  setClientForCandidate: (value: string) => void;
  user: DashboardData["user"];
}) {
  const canEditCandidate = user?.role_id === "ROLE_SUPER_ADMIN" || user?.role_id === "ROLE_NEXUS_ADMIN";
  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Create Candidate</CardTitle>
          <CardDescription>Client and project selection uses database-backed dropdowns.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCandidateAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
            <Input name="full_name" placeholder="Full name" required />
            <Input name="email" placeholder="Email" type="email" required />
            <Input name="phone" placeholder="Phone" />
            <Input name="position_applied" placeholder="Position applied" required />
            <Input name="skill_category" placeholder="Skill category" />
            <Input name="experience_level" placeholder="Experience level" />
            <NativeSelect
              name="client_id"
              value={clientForCandidate}
              onValueChange={setClientForCandidate}
              options={clients}
              emptyLabel="No client yet"
            />
            <NativeSelect name="project_id" options={projects} emptyLabel="No project yet" />
            <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
              <Plus className="h-4 w-4" /> Create Candidate
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Candidates</CardTitle>
          <CardDescription>Submit candidates to a scoped client and project when ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Name", "Position", "Client", "Project", "Status", "Action"]}
            rows={candidates}
            render={(candidate) => (
              <TableRow key={candidate.candidate_id}>
                <TableCell className="font-medium">{candidate.full_name}</TableCell>
                <TableCell>{candidate.position_applied}</TableCell>
                <TableCell className="font-mono text-xs">{candidate.client_id || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{candidate.project_id || "-"}</TableCell>
                <TableCell><StatusBadge value={candidate.status} /></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                  {canEditCandidate && <EditCandidateDialog candidate={candidate} clients={clients} projects={projects} />}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Send className="h-4 w-4" /> Submit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Submit candidate</DialogTitle>
                        <DialogDescription>Choose the target client and project for client review.</DialogDescription>
                      </DialogHeader>
                      <form action={submitCandidateAction} className="grid gap-3">
                        <input name="candidate_id" type="hidden" value={candidate.candidate_id} />
                        <NativeSelect name="client_id" defaultValue={candidate.client_id} options={clients} emptyLabel="Client" required />
                        <NativeSelect name="project_id" defaultValue={candidate.project_id} options={projects} emptyLabel="Project" required />
                        <Button type="submit">Submit to Client</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  </div>
                  {candidate.status === "onboarding_in_progress" && (
                    <div className="mt-2"><StatusBadge value="Onboarding in progress" /></div>
                  )}
                  {candidate.status === "onboarded" && (
                    <div className="mt-2"><StatusBadge value="Onboarded" /></div>
                  )}
                  {candidate.decision === "PROCEED" && candidate.status !== "onboarding_in_progress" && candidate.status !== "onboarded" && (
                    <form action={startOnboardingFromCandidateAction} className="mt-2">
                      <input name="candidate_id" type="hidden" value={candidate.candidate_id} />
                      <Button variant="secondary" size="sm" type="submit">Start Onboarding</Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function EditCandidateDialog({
  candidate,
  clients,
  projects,
}: {
  candidate: RecordMap;
  clients: DashboardData["clients"];
  projects: DashboardData["projects"];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit candidate</DialogTitle>
          <DialogDescription>Clean up candidate profile, assignment target, and workflow status.</DialogDescription>
        </DialogHeader>
        <form action={updateCandidateAction} className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <input name="candidate_id" type="hidden" value={candidate.candidate_id} />
          <Input name="full_name" defaultValue={candidate.full_name} placeholder="Full name" required />
          <Input name="email" defaultValue={candidate.email} placeholder="Email" type="email" required />
          <Input name="phone" defaultValue={candidate.phone} placeholder="Phone" />
          <Input name="position_applied" defaultValue={candidate.position_applied} placeholder="Position applied" required />
          <Input name="skill_category" defaultValue={candidate.skill_category} placeholder="Skill category" />
          <Input name="experience_level" defaultValue={candidate.experience_level} placeholder="Experience level" />
          <NativeSelect name="client_id" defaultValue={candidate.client_id} options={clients} emptyLabel="No client" />
          <NativeSelect name="project_id" defaultValue={candidate.project_id} options={projects} emptyLabel="No project" />
          <Input name="interview_status" defaultValue={candidate.interview_status} placeholder="Interview status" />
          <Select name="status" defaultValue={candidate.status || "active"}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="submitted_to_client">submitted_to_client</SelectItem>
              <SelectItem value="proceed">proceed</SelectItem>
              <SelectItem value="hold">hold</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
              <SelectItem value="onboarding_in_progress">onboarding_in_progress</SelectItem>
              <SelectItem value="onboarded">onboarded</SelectItem>
            </SelectContent>
          </Select>
          <Button className="sm:col-span-2" type="submit">Save Candidate</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackPanel({
  candidates,
  selected,
  setSelected,
}: {
  candidates: RecordMap[];
  selected: RecordMap | null;
  setSelected: (value: RecordMap) => void;
}) {
  const feedbackCandidates = candidates.filter((candidate) => candidate.status === "submitted_to_client" || candidate.decision);
  return (
    <section className="grid grid-cols-[minmax(0,1.4fr)_420px] gap-5 max-xl:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Candidates Assigned To Client</CardTitle>
          <CardDescription>Open a candidate to submit proceed, hold, or rejection feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Name", "Position", "Status", "Decision", "Open"]}
            rows={feedbackCandidates}
            render={(candidate) => (
              <TableRow key={candidate.candidate_id}>
                <TableCell className="font-medium">{candidate.full_name}</TableCell>
                <TableCell>{candidate.position_applied}</TableCell>
                <TableCell><StatusBadge value={candidate.status} /></TableCell>
                <TableCell>{candidate.decision ? <StatusBadge value={candidate.decision} /> : "-"}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelected(candidate)}>Open</Button>
                </TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>{selected ? "Submit client decision and comments." : "Select a candidate from the table."}</CardDescription>
        </CardHeader>
        <CardContent>
          {selected ? (
            <form action={submitFeedbackAction} className="grid gap-3">
              <input name="candidate_id" type="hidden" value={selected.candidate_id} />
              <input name="client_id" type="hidden" value={selected.client_id} />
              <input name="project_id" type="hidden" value={selected.project_id} />
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-semibold">{selected.full_name}</div>
                <div className="text-muted-foreground">{selected.position_applied}</div>
              </div>
              <Input name="overall_rating" type="number" min="1" max="5" placeholder="Rating 1-5" required />
              <NativeDecisionSelect />
              <Textarea name="comment" placeholder="Comment" required />
              <Textarea name="rejection_reason" placeholder="Rejection reason if rejected" />
              <Button type="submit">Submit Feedback</Button>
            </form>
          ) : (
            <EmptyState title="No candidate selected" description="Open a submitted candidate to capture client feedback." />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function OnboardingPanel({
  employees,
  employeeContracts,
  onboardingDocuments,
  user,
}: {
  employees: RecordMap[];
  employeeContracts: RecordMap[];
  onboardingDocuments: RecordMap[];
  user: DashboardData["user"];
}) {
  const canMarkReady = user?.role_id === "ROLE_CLIENT_APPROVER" || user?.role_id === "ROLE_SUPER_ADMIN";
  return (
    <Tabs defaultValue="checklist">
      <TabsList>
        <TabsTrigger value="checklist">Checklist</TabsTrigger>
        <TabsTrigger value="commercial">Commercial & Contract</TabsTrigger>
      </TabsList>
      <TabsContent value="checklist">
        <Card>
          <CardHeader>
            <CardTitle>Resource Onboarding Checklist</CardTitle>
            <CardDescription>Document acknowledgement and readiness gates are enforced by the backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Employee", "Name", "NDA", "Ethics", "Privacy", "Training", "Client Ready"]}
              rows={employees}
              render={(employee) => (
                <TableRow key={employee.employee_id}>
                  <TableCell className="font-mono text-xs">{employee.employee_id}</TableCell>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell>
                    <OnboardingDocumentStep employee={employee} documents={onboardingDocuments} step="nda" documentType="NDA" completedAt={employee.nda_acknowledged_at} label="NDA" />
                  </TableCell>
                  <TableCell>
                    <OnboardingDocumentStep employee={employee} documents={onboardingDocuments} step="ethics" documentType="CODE_OF_ETHICS" completedAt={employee.code_of_ethics_acknowledged_at} label="Ethics" />
                  </TableCell>
                  <TableCell>
                    <OnboardingDocumentStep employee={employee} documents={onboardingDocuments} step="privacy" documentType="DATA_PRIVACY_CONSENT" completedAt={employee.data_privacy_consent_acknowledged_at} label="Privacy" />
                  </TableCell>
                  <TableCell>
                    <OnboardingDocumentStep employee={employee} documents={onboardingDocuments} step="training" documentType="ONBOARDING_TRAINING" completedAt={employee.onboarding_training_completed_at} label="Training" />
                  </TableCell>
                  <TableCell>
                    <ReadyGate employee={employee} canMarkReady={canMarkReady} />
                  </TableCell>
                </TableRow>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="commercial">
        <EmployeeCommercialPanel employees={employees} employeeContracts={employeeContracts} />
      </TabsContent>
    </Tabs>
  );
}

function OnboardingDocumentStep({
  employee,
  documents,
  step,
  documentType,
  completedAt,
  label,
}: {
  employee: RecordMap;
  documents: RecordMap[];
  step: string;
  documentType: string;
  completedAt: string;
  label: string;
}) {
  const doc = documents.find((item) => item.document_type === documentType);
  if (completedAt) {
    return (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge value="Done" />
        <span className="text-xs text-slate-500">{formatDateTime(completedAt)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusBadge value={doc ? "Pending" : "Missing document"} />
      {doc?.drive_file_id ? (
        <Button asChild size="sm" variant="outline">
          <a href={`/documents/${encodeURIComponent(doc.document_id)}/view`} rel="noreferrer" target="_blank">
            Open {label}
          </a>
        </Button>
      ) : null}
      <form action={markOnboardingStepAction}>
        <input name="employee_id" type="hidden" value={employee.employee_id} />
        <input name="step" type="hidden" value={step} />
        <Button disabled={!doc?.drive_file_id} size="sm" type="submit">
          Acknowledge
        </Button>
      </form>
    </div>
  );
}

function ReadyGate({ employee, canMarkReady }: { employee: RecordMap; canMarkReady: boolean }) {
  const complete = Boolean(
    employee.nda_acknowledged_at &&
    employee.code_of_ethics_acknowledged_at &&
    employee.data_privacy_consent_acknowledged_at &&
    employee.onboarding_training_completed_at,
  );
  if (employee.resource_ready_at) {
    return <StatusBadge value="Ready" />;
  }
  if (!canMarkReady) {
    return <StatusBadge value={complete ? "Awaiting client" : "Pending"} />;
  }
  return (
    <form action={markOnboardingStepAction}>
      <input name="employee_id" type="hidden" value={employee.employee_id} />
      <input name="step" type="hidden" value="ready" />
      <Button disabled={!complete} size="sm" type="submit">
        Client Confirm Ready
      </Button>
    </form>
  );
}

function EmployeeCommercialPanel({
  employees,
  employeeContracts,
}: {
  employees: RecordMap[];
  employeeContracts: RecordMap[];
}) {
  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Commercial Terms</CardTitle>
          <CardDescription>Editable remuneration, tax, BPJS, management fee, recruitment fee, and contract terms.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Employee", "Contract", "Gross", "Bill Rate", "Mgmt Fee", "Tax", "BPJS", "Invoice Est.", "Action"]}
            rows={employees}
            render={(employee) => (
              <TableRow key={employee.employee_id}>
                <TableCell>
                  <div className="font-medium">{employee.full_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{employee.employee_id}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge value={employee.contract_status || "PENDING"} />
                  <div className="mt-1 text-xs text-muted-foreground">{employee.contract_type || "-"}</div>
                </TableCell>
                <TableCell>{money(employee.gross_monthly_salary)}</TableCell>
                <TableCell>{money(employee.client_bill_rate)}</TableCell>
                <TableCell>{money(employee.management_fee_amount)} <span className="text-xs text-muted-foreground">({employee.management_fee_rate || "15"}%)</span></TableCell>
                <TableCell>
                  <div>{employee.tax_type || "PPH21"} {employee.tax_rate || "0"}%</div>
                  <div className="text-xs text-muted-foreground">21: {money(employee.pph21_amount)} / 23: {money(employee.pph23_amount)}</div>
                </TableCell>
                <TableCell>
                  <div>KES {money(employee.bpjs_kesehatan_amount)}</div>
                  <div className="text-xs text-muted-foreground">TK {money(employee.bpjs_tk_amount)}</div>
                </TableCell>
                <TableCell>{money(employee.invoice_amount_estimate)}</TableCell>
                <TableCell><EmployeeCommercialDialog employee={employee} /></TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contract Register</CardTitle>
          <CardDescription>Snapshots are created or updated when commercial terms are saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Contract", "Employee", "Type", "Period", "Gross", "Bill Rate", "Fee", "Tax", "Status"]}
            rows={employeeContracts}
            render={(contract) => (
              <TableRow key={contract.contract_id}>
                <TableCell>
                  <div className="font-mono text-xs">{contract.contract_id}</div>
                  <div className="text-xs text-muted-foreground">{contract.contract_number || "-"}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{contract.employee_id}</TableCell>
                <TableCell>{contract.contract_type || "-"}</TableCell>
                <TableCell>{contract.start_date || "-"} - {contract.end_date || "-"}</TableCell>
                <TableCell>{money(contract.gross_monthly_salary)}</TableCell>
                <TableCell>{money(contract.client_bill_rate)}</TableCell>
                <TableCell>{money(contract.management_fee_amount)}</TableCell>
                <TableCell>{contract.tax_type || "-"} {contract.tax_rate || "0"}%</TableCell>
                <TableCell><StatusBadge value={contract.status} /></TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function EmployeeCommercialDialog({ employee }: { employee: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Edit commercial terms</DialogTitle>
          <DialogDescription>Backend recalculates PPH, BPJS, 15% management fee default, net pay, and invoice estimate.</DialogDescription>
        </DialogHeader>
        <form action={updateEmployeeCommercialAction} className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
          <input name="employee_id" type="hidden" value={employee.employee_id} />
          <Input name="contract_status" defaultValue={employee.contract_status || "PENDING"} placeholder="Contract status" />
          <Input name="contract_type" defaultValue={employee.contract_type} placeholder="Contract type" />
          <Input name="contract_number" defaultValue={employee.contract_number} placeholder="Contract number" />
          <Input name="contract_start_date" defaultValue={employee.contract_start_date} type="date" />
          <Input name="contract_end_date" defaultValue={employee.contract_end_date} type="date" />
          <MoneyInput name="base_salary" value={employee.base_salary} placeholder="Base salary" />
          <MoneyInput name="allowance_amount" value={employee.allowance_amount} placeholder="Allowance" />
          <MoneyInput name="gross_monthly_salary" value={employee.gross_monthly_salary} placeholder="Gross monthly salary" />
          <MoneyInput name="daily_rate" value={employee.daily_rate} placeholder="Daily rate" />
          <MoneyInput name="hourly_rate" value={employee.hourly_rate} placeholder="Hourly rate" />
          <MoneyInput name="client_bill_rate" value={employee.client_bill_rate} placeholder="Client bill rate" />
          <Input name="management_fee_rate" defaultValue={employee.management_fee_rate || "15"} type="number" step="0.01" placeholder="Management fee %" />
          <MoneyInput name="management_fee_amount" value={employee.management_fee_amount} placeholder="Management fee amount override" />
          <MoneyInput name="recruitment_fee" value={employee.recruitment_fee} placeholder="Recruitment fee" />
          <Select name="tax_type" defaultValue={employee.tax_type || "PPH21"}>
            <SelectTrigger><SelectValue placeholder="Tax type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PPH21">PPH21</SelectItem>
              <SelectItem value="PPH23">PPH23</SelectItem>
              <SelectItem value="NONE">NONE</SelectItem>
            </SelectContent>
          </Select>
          <Input name="tax_rate" defaultValue={employee.tax_rate || "0"} type="number" step="0.01" placeholder="Tax rate %" />
          <Input name="bpjs_kesehatan_rate" defaultValue={employee.bpjs_kesehatan_rate || "1"} type="number" step="0.01" placeholder="BPJS Kesehatan %" />
          <MoneyInput name="bpjs_kesehatan_amount" value={employee.bpjs_kesehatan_amount} placeholder="BPJS Kesehatan override" />
          <Input name="bpjs_tk_rate" defaultValue={employee.bpjs_tk_rate || "2"} type="number" step="0.01" placeholder="BPJS TK %" />
          <MoneyInput name="bpjs_tk_amount" value={employee.bpjs_tk_amount} placeholder="BPJS TK override" />
          <Textarea className="xl:col-span-4" name="commercial_notes" defaultValue={employee.commercial_notes} placeholder="Commercial notes" />
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm xl:col-span-4">
            <div className="font-medium">Current stored estimates</div>
            <div className="grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <span>PPH21: {money(employee.pph21_amount)}</span>
              <span>PPH23: {money(employee.pph23_amount)}</span>
              <span>Net pay: {money(employee.net_pay_estimate)}</span>
              <span>Invoice est.: {money(employee.invoice_amount_estimate)}</span>
            </div>
          </div>
          <Button className="xl:col-span-4" type="submit">Save Commercial Terms</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoneyInput({ name, value, placeholder }: { name: string; value?: string; placeholder: string }) {
  return <Input name={name} defaultValue={value || "0"} type="number" min="0" step="0.01" placeholder={placeholder} />;
}

function DocumentsPanel({
  candidates,
  employees,
  employeeDocuments,
  candidateDocuments,
  onboardingDocuments,
  templateManagement,
}: {
  candidates: RecordMap[];
  employees: RecordMap[];
  employeeDocuments: RecordMap[];
  candidateDocuments: RecordMap[];
  onboardingDocuments: RecordMap[];
  templateManagement: NonNullable<DashboardData["template_management"]>;
}) {
  const employeeOptions = employees.map((employee) => ({
    id: employee.employee_id,
    label: employee.full_name || employee.employee_id,
    meta: employee.email,
  }));
  const candidateOptions = candidates.map((candidate) => ({
    id: candidate.candidate_id,
    label: candidate.full_name || candidate.candidate_id,
    meta: candidate.email,
  }));
  const documents = [
    ...onboardingDocuments.map((doc) => ({ ...doc, source: "Onboarding" })),
    ...employeeDocuments.map((doc) => ({ ...doc, source: "Employee" })),
    ...candidateDocuments.map((doc) => ({ ...doc, source: "Candidate" })),
  ];

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Template & Document Management</CardTitle>
          <CardDescription>Binary files stay in Google Drive through the GAS adapter. Nexus stores metadata and Drive file IDs only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="employee">Employee</TabsTrigger>
            <TabsTrigger value="candidate">Candidate</TabsTrigger>
            <TabsTrigger value="repository">Repository Map</TabsTrigger>
          </TabsList>
            <TabsContent value="templates">
              <TemplateManagementAdmin templates={templateManagement.templates} />
            </TabsContent>
            <TabsContent value="onboarding">
              <OnboardingDocumentMetadataForm />
            </TabsContent>
            <TabsContent value="employee">
              <DocumentMetadataForm entityType="EMPLOYEE" entityOptions={employeeOptions} />
            </TabsContent>
            <TabsContent value="candidate">
              <DocumentMetadataForm entityType="CANDIDATE" entityOptions={candidateOptions} />
            </TabsContent>
            <TabsContent value="repository">
              <div className="grid grid-cols-5 gap-3 max-xl:grid-cols-3 max-sm:grid-cols-1">
                {["Templates", "NDA", "Code of Ethics", "CV", "SOW", "Contract", "Acceptance Certificate", "GR", "Invoice", "Handover"].map((category) => (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium" key={category}>{category}</div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Document Register</CardTitle>
          <CardDescription>Metadata only. Sensitive files remain controlled in Drive.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Document", "Scope", "Type", "Viewer", "Uploaded", "Status", "Action"]}
            rows={documents}
            render={(doc) => (
              <TableRow key={`${doc.source}-${doc.document_id}`}>
                <TableCell className="font-medium">{doc.file_name || doc.document_id}</TableCell>
                <TableCell className="font-mono text-xs">{doc.source}: {doc.employee_id || doc.candidate_id || doc.entity_id}</TableCell>
                <TableCell>{doc.document_type}</TableCell>
                <TableCell>
                  {doc.drive_file_id ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={`/documents/${encodeURIComponent(doc.document_id)}/view`} rel="noreferrer" target="_blank">Open</a>
                    </Button>
                  ) : "-"}
                </TableCell>
                <TableCell>{formatDate(doc.uploaded_at || doc.created_at)}</TableCell>
                <TableCell><StatusBadge value={doc.status} /></TableCell>
                <TableCell><EditDocumentDialog doc={doc} /></TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

const TEMPLATE_CATEGORIES = [
  "Statement of Work",
  "Solution Description",
  "BoQ",
  "Risk Register",
  "Cashflow Analysis",
  "SDS Summary",
  "SDOA Summary",
  "Project Plan",
  "Resource Plan",
  "Site Handler Tracker",
  "Acceptance Certificate",
  "Good Receipt",
  "Invoice",
  "Purchase Request",
  "Purchase Order",
  "Handover Document",
  "Lessons Learned",
  "Governance Report",
  "MBR Report",
  "Executive Dashboard Template",
];

function TemplateManagementAdmin({ templates }: { templates: NonNullable<DashboardData["template_management"]>["templates"] }) {
  return (
    <div className="mt-4 grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Template Draft</CardTitle>
          <CardDescription>Upload sends the binary to Google Drive through GAS and stores metadata in Nexus.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadTemplateAction} className="grid grid-cols-6 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <Input name="template_name" placeholder="Template name" required />
            <Input name="template_type" placeholder="Template type, e.g. SOW" required />
            <Select name="document_category" required>
              <SelectTrigger><SelectValue placeholder="Document category" /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input name="version" placeholder="Version, e.g. 1.0" required />
            <Input name="effective_from" type="date" required />
            <Input name="file" type="file" required />
            <Button className="2xl:col-span-6" type="submit">
              <Plus className="h-4 w-4" />
              Upload Draft
            </Button>
          </form>
        </CardContent>
      </Card>
      <DataTable
        headers={["Template", "Category", "Type", "Version", "Drive", "Effective", "Uploaded", "Status", "Actions"]}
        rows={templates}
        render={(template) => (
          <TableRow key={template.templateId}>
            <TableCell>
              <div className="font-medium">{template.templateName}</div>
              <div className="font-mono text-xs text-muted-foreground">{template.templateId}</div>
            </TableCell>
            <TableCell>{template.documentCategory}</TableCell>
            <TableCell>{template.templateType}</TableCell>
            <TableCell>{template.version}</TableCell>
            <TableCell className="font-mono text-xs">{template.driveFileId}</TableCell>
            <TableCell>{template.effectiveFrom} - {template.effectiveTo || "open"}</TableCell>
            <TableCell>
              <div>{template.uploadedBy || "-"}</div>
              <div className="text-xs text-muted-foreground">{formatDateTime(template.createdAt)}</div>
            </TableCell>
            <TableCell><StatusBadge value={template.status} /></TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/templates/${encodeURIComponent(template.templateId)}/download`} target="_blank" rel="noreferrer">Download</a>
                </Button>
                <TemplateLifecycleButton templateId={template.templateId} action="review" label="Review" disabled={template.status !== "draft"} />
                <TemplateLifecycleButton templateId={template.templateId} action="approve" label="Approve" disabled={template.status !== "review"} />
                <TemplateLifecycleButton templateId={template.templateId} action="publish" label="Publish" disabled={!["approved", "draft"].includes(template.status)} />
                <TemplateLifecycleButton templateId={template.templateId} action="retire" label="Retire" disabled={template.status === "retired"} />
              </div>
            </TableCell>
          </TableRow>
        )}
      />
    </div>
  );
}

function TemplateLifecycleButton({ templateId, action, label, disabled }: { templateId: string; action: string; label: string; disabled?: boolean }) {
  return (
    <form action={transitionTemplateAction}>
      <input name="template_id" type="hidden" value={templateId} />
      <input name="template_action" type="hidden" value={action} />
      <input name="reason" type="hidden" value={`Template ${action}`} />
      <Button disabled={disabled} size="sm" type="submit" variant={action === "publish" ? "default" : "outline"}>{label}</Button>
    </form>
  );
}

function EditDocumentDialog({ doc }: { doc: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit document metadata</DialogTitle>
          <DialogDescription>Paste a Google Drive file link or raw file ID. Folder links cannot be opened as documents.</DialogDescription>
        </DialogHeader>
        <form action={updateDocumentMetadataAction} className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <input name="document_id" type="hidden" value={doc.document_id} />
          <Input name="file_name" defaultValue={doc.file_name} placeholder="File name" required />
          <Input name="document_type" defaultValue={doc.document_type} placeholder="Document type" required />
          <Input name="drive_file_id" defaultValue={doc.drive_file_id} placeholder="PDF/Doc file link or file ID, not folder link" required />
          <Input name="entity_type" defaultValue={doc.entity_type} placeholder="Entity type" required />
          <Input name="entity_id" defaultValue={doc.entity_id} placeholder="Entity ID" required />
          <Select name="status" defaultValue={doc.status || "active"}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="inactive">inactive</SelectItem>
              <SelectItem value="archived">archived</SelectItem>
            </SelectContent>
          </Select>
          <Button className="sm:col-span-2" type="submit">Save Document</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingDocumentMetadataForm() {
  return (
    <form action={createDocumentMetadataAction} className="mt-4 grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
      <input name="entity_type" type="hidden" value="ONBOARDING_TEMPLATE" />
      <input name="entity_id" type="hidden" value="GLOBAL" />
      <Select name="document_type" required>
        <SelectTrigger><SelectValue placeholder="Document type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="NDA">NDA</SelectItem>
          <SelectItem value="CODE_OF_ETHICS">Code of Ethics</SelectItem>
          <SelectItem value="DATA_PRIVACY_CONSENT">Data Privacy Consent</SelectItem>
          <SelectItem value="ONBOARDING_TRAINING">Onboarding Training</SelectItem>
        </SelectContent>
      </Select>
      <Input name="drive_file_id" placeholder="Google Drive file link or file ID, not folder link" required />
      <Input name="file_name" placeholder="File name" required />
      <input name="visibility" type="hidden" value="employee_visible" />
      <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
        <Plus className="h-4 w-4" /> Save Onboarding Document
      </Button>
    </form>
  );
}

function DocumentMetadataForm({
  entityType,
  entityOptions,
}: {
  entityType: "EMPLOYEE" | "CANDIDATE";
  entityOptions: DashboardData["clients"];
}) {
  return (
    <form action={createDocumentMetadataAction} className="mt-4 grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
      <input name="entity_type" type="hidden" value={entityType} />
      <NativeSelect name="entity_id" options={entityOptions} emptyLabel={`Select ${entityType.toLowerCase()}`} required />
      <Input name="document_type" placeholder="Document type" required />
      <Input name="drive_file_id" placeholder="Google Drive file link or file ID, not folder link" required />
      <Input name="file_name" placeholder="File name" required />
      <Select name="visibility" defaultValue="internal">
        <SelectTrigger><SelectValue placeholder="Visibility" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="internal">internal</SelectItem>
          <SelectItem value="employee_private">employee_private</SelectItem>
          <SelectItem value="employee_visible">employee_visible</SelectItem>
          <SelectItem value="client_visible">client_visible</SelectItem>
          <SelectItem value="training">training</SelectItem>
        </SelectContent>
      </Select>
      <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
        <Plus className="h-4 w-4" /> Add Metadata
      </Button>
    </form>
  );
}

function TimesheetsPanel({
  employees,
  assignments,
  timesheets,
  user,
}: {
  employees: RecordMap[];
  assignments: RecordMap[];
  timesheets: RecordMap[];
  user: DashboardData["user"];
}) {
  const employeeOptions = toOptions(employees, "employee_id", "full_name");
  const assignmentOptions = toOptions(assignments, "assignment_id", "role_title");
  const isEmployee = user?.role_id === "ROLE_EMPLOYEE";
  const selfEmployeeId = user?.employee_id || employees[0]?.employee_id || "";

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Submission</CardTitle>
          <CardDescription>Submit period totals and route approval status through Apps Script.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTimesheetAction} className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {isEmployee ? (
              <input name="employee_id" type="hidden" value={selfEmployeeId} />
            ) : (
              <NativeSelect name="employee_id" options={employeeOptions} emptyLabel="Employee" required />
            )}
            <NativeSelect name="assignment_id" options={assignmentOptions} emptyLabel="Assignment optional" />
            <Input name="period_start" type="datetime-local" required />
            <Input name="period_end" type="datetime-local" required />
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Hours are calculated automatically from start and end time.
            </div>
            <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
              <Plus className="h-4 w-4" /> Submit Timesheet
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Timesheets</CardTitle>
          <CardDescription>Nexus review and client approval can be updated by authorized roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Employee", "Period", "Hours", "Nexus", "Client", "Status", "Action"]}
            rows={timesheets}
            render={(row) => (
              <TableRow key={row.timesheet_id}>
                <TableCell className="font-mono text-xs">{row.timesheet_id}</TableCell>
                <TableCell>{findLabel(employeeOptions, row.employee_id)}</TableCell>
                <TableCell>{row.period_start} - {row.period_end}</TableCell>
                <TableCell>{row.total_hours}</TableCell>
                <TableCell><StatusBadge value={row.nexus_review_status} /></TableCell>
                <TableCell><StatusBadge value={row.client_approval_status} /></TableCell>
                <TableCell><StatusBadge value={row.status} /></TableCell>
                <TableCell>{isEmployee ? "-" : <TimesheetStatusDialog row={row} />}</TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function TimesheetStatusDialog({ row }: { row: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update timesheet</DialogTitle>
          <DialogDescription>Set Nexus and client approval status.</DialogDescription>
        </DialogHeader>
        <form action={updateTimesheetStatusAction} className="grid gap-3">
          <input name="timesheet_id" type="hidden" value={row.timesheet_id} />
          <StatusWorkflowSelect name="nexus_review_status" defaultValue={row.nexus_review_status} />
          <StatusWorkflowSelect name="client_approval_status" defaultValue={row.client_approval_status} />
          <Textarea name="rejection_reason" defaultValue={row.rejection_reason} placeholder="Rejection reason" />
          <Select name="status" defaultValue={row.status || "submitted"}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">submitted</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="locked">locked</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Save Status</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OvertimePanel({
  employees,
  assignments,
  overtimeRequests,
  user,
}: {
  employees: RecordMap[];
  assignments: RecordMap[];
  overtimeRequests: RecordMap[];
  user: DashboardData["user"];
}) {
  const employeeOptions = toOptions(employees, "employee_id", "full_name");
  const assignmentOptions = toOptions(assignments, "assignment_id", "role_title");
  const isEmployee = user?.role_id === "ROLE_EMPLOYEE";
  const selfEmployeeId = user?.employee_id || employees[0]?.employee_id || "";

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Overtime Requests</CardTitle>
          <CardDescription>Request, validate, and client-approve overtime.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOvertimeRequestAction} className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {isEmployee ? (
              <input name="employee_id" type="hidden" value={selfEmployeeId} />
            ) : (
              <NativeSelect name="employee_id" options={employeeOptions} emptyLabel="Employee" required />
            )}
            <NativeSelect name="assignment_id" options={assignmentOptions} emptyLabel="Assignment optional" />
            <Input name="start_at" type="datetime-local" required />
            <Input name="end_at" type="datetime-local" required />
            <Input name="reason" placeholder="Reason" />
            <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
              <Plus className="h-4 w-4" /> Submit Overtime
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Overtime Register</CardTitle>
          <CardDescription>Requests remain auditable through the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Employee", "Date", "Hours", "Nexus", "Client", "Status", "Action"]}
            rows={overtimeRequests}
            render={(row) => (
              <TableRow key={row.overtime_id}>
                <TableCell className="font-mono text-xs">{row.overtime_id}</TableCell>
                <TableCell>{findLabel(employeeOptions, row.employee_id)}</TableCell>
                <TableCell>{row.request_date}</TableCell>
                <TableCell>{row.hours}</TableCell>
                <TableCell><StatusBadge value={row.nexus_validation_status} /></TableCell>
                <TableCell><StatusBadge value={row.client_approval_status} /></TableCell>
                <TableCell><StatusBadge value={row.status} /></TableCell>
                <TableCell>{isEmployee ? "-" : <OvertimeStatusDialog row={row} />}</TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function OvertimeStatusDialog({ row }: { row: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm">Review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update overtime</DialogTitle>
          <DialogDescription>Validate and approve overtime request.</DialogDescription>
        </DialogHeader>
        <form action={updateOvertimeStatusAction} className="grid gap-3">
          <input name="overtime_id" type="hidden" value={row.overtime_id} />
          <StatusWorkflowSelect name="nexus_validation_status" defaultValue={row.nexus_validation_status} />
          <StatusWorkflowSelect name="client_approval_status" defaultValue={row.client_approval_status} />
          <Textarea name="rejection_reason" defaultValue={row.rejection_reason} placeholder="Rejection reason" />
          <Select name="status" defaultValue={row.status || "submitted"}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">submitted</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Save Status</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeavePanel({
  employees,
  assignments,
  leaveRequests,
  user,
}: {
  employees: RecordMap[];
  assignments: RecordMap[];
  leaveRequests: RecordMap[];
  user: DashboardData["user"];
}) {
  const employeeOptions = toOptions(employees, "employee_id", "full_name");
  const assignmentOptions = toOptions(assignments, "assignment_id", "role_title");
  const isEmployee = user?.role_id === "ROLE_EMPLOYEE";
  const selfEmployeeId = user?.employee_id || employees[0]?.employee_id || "";

  return (
    <section className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>Submit leave and capture HR/client approvals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createLeaveRequestAction} className="grid grid-cols-6 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {isEmployee ? (
              <input name="employee_id" type="hidden" value={selfEmployeeId} />
            ) : (
              <NativeSelect name="employee_id" options={employeeOptions} emptyLabel="Employee" required />
            )}
            <NativeSelect name="assignment_id" options={assignmentOptions} emptyLabel="Assignment optional" />
            <Input name="leave_type" placeholder="Leave type" required />
            <Input name="start_date" type="date" required />
            <Input name="end_date" type="date" required />
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Days are calculated automatically.
            </div>
            <Textarea className="xl:col-span-5" name="reason" placeholder="Reason" />
            <Button type="submit"><Plus className="h-4 w-4" /> Submit Leave</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Leave Register</CardTitle>
          <CardDescription>Timesheet impact is recorded for downstream payroll and billing.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Employee", "Type", "Dates", "HR", "Client", "Status", "Action"]}
            rows={leaveRequests}
            render={(row) => (
              <TableRow key={row.leave_id}>
                <TableCell className="font-mono text-xs">{row.leave_id}</TableCell>
                <TableCell>{findLabel(employeeOptions, row.employee_id)}</TableCell>
                <TableCell>{row.leave_type}</TableCell>
                <TableCell>{row.start_date} - {row.end_date}</TableCell>
                <TableCell><StatusBadge value={row.hr_review_status} /></TableCell>
                <TableCell><StatusBadge value={row.client_approval_status} /></TableCell>
                <TableCell><StatusBadge value={row.status} /></TableCell>
                <TableCell>{isEmployee ? "-" : <LeaveStatusDialog row={row} />}</TableCell>
              </TableRow>
            )}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function LeaveStatusDialog({ row }: { row: RecordMap }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm">Review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update leave</DialogTitle>
          <DialogDescription>Approve leave and record timesheet impact.</DialogDescription>
        </DialogHeader>
        <form action={updateLeaveStatusAction} className="grid gap-3">
          <input name="leave_id" type="hidden" value={row.leave_id} />
          <StatusWorkflowSelect name="hr_review_status" defaultValue={row.hr_review_status} />
          <StatusWorkflowSelect name="client_approval_status" defaultValue={row.client_approval_status} />
          <Input name="timesheet_impact" defaultValue={row.timesheet_impact} placeholder="Timesheet impact" />
          <Textarea name="rejection_reason" defaultValue={row.rejection_reason} placeholder="Rejection reason" />
          <Select name="status" defaultValue={row.status || "submitted"}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">submitted</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Save Status</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FinancePanel({
  clients,
  projects,
  grRecords,
  invoices,
}: {
  clients: DashboardData["clients"];
  projects: DashboardData["projects"];
  grRecords: RecordMap[];
  invoices: RecordMap[];
}) {
  return (
    <Tabs defaultValue="gr">
      <TabsList>
        <TabsTrigger value="gr">GR Service Acceptance</TabsTrigger>
        <TabsTrigger value="invoice">Invoices</TabsTrigger>
      </TabsList>
      <TabsContent value="gr">
        <Card>
          <CardHeader>
            <CardTitle>GR Records</CardTitle>
            <CardDescription>Create service acceptance records from approved work.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form action={createGrRecordAction} className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <NativeSelect name="client_id" options={clients} emptyLabel="Client" required />
              <NativeSelect name="project_id" options={projects} emptyLabel="Project" required />
              <Input name="period_month" placeholder="YYYY-MM" required />
              <Input name="approved_timesheet_ids" placeholder="Timesheet IDs" />
              <Select name="service_acceptance_status" defaultValue="DRAFT">
                <SelectTrigger><SelectValue placeholder="Acceptance status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                  <SelectItem value="SUBMITTED">SUBMITTED</SelectItem>
                  <SelectItem value="ACCEPTED">ACCEPTED</SelectItem>
                  <SelectItem value="REJECTED">REJECTED</SelectItem>
                </SelectContent>
              </Select>
              <Textarea className="xl:col-span-4" name="work_summary" placeholder="Work summary" />
              <Button type="submit"><Plus className="h-4 w-4" /> Create GR</Button>
            </form>
            <DataTable
              headers={["ID", "Client", "Project", "Period", "Acceptance", "Status"]}
              rows={grRecords}
              render={(row) => (
                <TableRow key={row.gr_id}>
                  <TableCell className="font-mono text-xs">{row.gr_id}</TableCell>
                  <TableCell>{row.client_id}</TableCell>
                  <TableCell>{row.project_id}</TableCell>
                  <TableCell>{row.period_month}</TableCell>
                  <TableCell><StatusBadge value={row.service_acceptance_status} /></TableCell>
                  <TableCell><StatusBadge value={row.status} /></TableCell>
                </TableRow>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="invoice">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Drafts</CardTitle>
            <CardDescription>Create draft invoices from GR records and track payment status.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form action={createInvoiceDraftAction} className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <NativeSelect name="gr_id" options={toOptions(grRecords, "gr_id", "period_month")} emptyLabel="GR record" required />
              <NativeSelect name="client_id" options={clients} emptyLabel="Client" required />
              <NativeSelect name="project_id" options={projects} emptyLabel="Project optional" />
              <Input name="invoice_number" placeholder="Invoice number" />
              <Input name="invoice_date" type="date" />
              <Input name="due_date" type="date" />
              <Input name="currency" defaultValue="IDR" placeholder="Currency" />
              <Input name="subtotal" type="number" min="0" placeholder="Subtotal" />
              <Input name="tax_amount" type="number" min="0" placeholder="Tax" />
              <Input name="management_fee_amount" type="number" min="0" placeholder="Management fee" />
              <Input name="recruitment_fee" type="number" min="0" placeholder="Recruitment fee" />
              <Input name="pph21_amount" type="number" min="0" placeholder="PPH21" />
              <Input name="pph23_amount" type="number" min="0" placeholder="PPH23" />
              <Input name="bpjs_kesehatan_amount" type="number" min="0" placeholder="BPJS Kesehatan" />
              <Input name="bpjs_tk_amount" type="number" min="0" placeholder="BPJS TK" />
              <Input name="total_amount" type="number" min="0" placeholder="Total override" />
              <Button className="max-xl:col-span-2 max-sm:col-span-1" type="submit">
                <Plus className="h-4 w-4" /> Create Invoice
              </Button>
            </form>
            <DataTable
              headers={["ID", "Invoice", "Client", "Subtotal", "Fees", "Tax/BPJS", "Total", "Status"]}
              rows={invoices}
              render={(row) => (
                <TableRow key={row.invoice_id}>
                  <TableCell className="font-mono text-xs">{row.invoice_id}</TableCell>
                  <TableCell>{row.invoice_number || "-"}</TableCell>
                  <TableCell>{row.client_id}</TableCell>
                  <TableCell>{money(row.subtotal)}</TableCell>
                  <TableCell>
                    <div>Mgmt {money(row.management_fee_amount)}</div>
                    <div className="text-xs text-muted-foreground">Recruit {money(row.recruitment_fee)}</div>
                  </TableCell>
                  <TableCell>
                    <div>Tax {money(row.tax_amount)}</div>
                    <div className="text-xs text-muted-foreground">P21 {money(row.pph21_amount)} / P23 {money(row.pph23_amount)}</div>
                    <div className="text-xs text-muted-foreground">BPJS {money(row.bpjs_kesehatan_amount)} / {money(row.bpjs_tk_amount)}</div>
                  </TableCell>
                  <TableCell>{row.currency || "IDR"} {money(row.total_amount)}</TableCell>
                  <TableCell><StatusBadge value={row.invoice_status} /></TableCell>
                </TableRow>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function DataTable({
  headers,
  rows,
  render,
}: {
  headers: string[];
  rows: RecordMap[];
  render: (row: RecordMap, index: number) => ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map(render) : (
            <TableRow>
              <TableCell className="py-10 text-center text-muted-foreground" colSpan={headers.length}>
                No records yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">{title}</div>
      <div className="max-h-60 overflow-auto p-3">
        {items.length ? items.map((item) => <div className="py-1 font-mono text-xs text-muted-foreground" key={item}>{item}</div>) : (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-2/3" />
            <div className="text-sm text-muted-foreground">No records.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed p-8 text-center">
      <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}

function StatusTile({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2"><StatusBadge value={primary} /></div>
      <div className="mt-2 text-xs text-muted-foreground">{secondary}</div>
    </div>
  );
}

function NativeSelect({
  options,
  emptyLabel,
  name,
  value,
  defaultValue,
  onValueChange,
  required,
  className,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  options: DashboardData["clients"] | DashboardData["projects"] | string[];
  emptyLabel?: string;
}) {
  const normalizedOptions = options.map((option) => typeof option === "string" ? { id: option, label: option } : option);
  return (
    <Select
      name={name}
      value={value || undefined}
      defaultValue={defaultValue || undefined}
      onValueChange={onValueChange}
      required={required}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={emptyLabel || "Select"} />
      </SelectTrigger>
      <SelectContent>
      {normalizedOptions.map((option) => (
        <SelectItem key={option.id} value={option.id}>
          {option.label}
        </SelectItem>
      ))}
      </SelectContent>
    </Select>
  );
}

function RoleSelect() {
  return (
    <Select name="role_id" required>
      <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
      <SelectContent>
      {["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_HR_ADMIN", "ROLE_CLIENT_APPROVER", "ROLE_EMPLOYEE", "ROLE_CLIENT_FINANCE_VIEWER"].map((role) => (
        <SelectItem key={role} value={role}>{role}</SelectItem>
      ))}
      </SelectContent>
    </Select>
  );
}

function NativeDecisionSelect() {
  return (
    <Select name="decision" required>
      <SelectTrigger><SelectValue placeholder="Decision" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="PROCEED">PROCEED</SelectItem>
        <SelectItem value="HOLD">HOLD</SelectItem>
        <SelectItem value="REJECTED">REJECTED</SelectItem>
      </SelectContent>
    </Select>
  );
}

function StatusWorkflowSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <Select name={name} defaultValue={defaultValue || "PENDING"}>
      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="PENDING">PENDING</SelectItem>
        <SelectItem value="APPROVED">APPROVED</SelectItem>
        <SelectItem value="REJECTED">REJECTED</SelectItem>
        <SelectItem value="HOLD">HOLD</SelectItem>
      </SelectContent>
    </Select>
  );
}

function StatusSelect() {
  return (
    <Select name="status" defaultValue="active">
      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="active">active</SelectItem>
        <SelectItem value="inactive">inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = String(value || "").toLowerCase();
  const variant = normalized.includes("reject") || normalized === "deleted"
    ? "destructive"
    : normalized.includes("pending") || normalized.includes("hold") || normalized.includes("submitted")
      ? "warning"
      : normalized.includes("ready") || normalized === "active" || normalized.includes("proceed")
        ? "success"
        : "secondary";
  return <Badge variant={variant}>{value || "-"}</Badge>;
}

function toOptions(rows: RecordMap[], idKey: string, labelKey: string): DashboardData["clients"] {
  return rows
    .filter((row) => row[idKey])
    .map((row) => ({
      id: row[idKey],
      label: row[labelKey] || row[idKey],
      meta: row.client_id || row.project_id || row.email,
    }));
}

function findLabel(options: DashboardData["clients"], id: string) {
  return options.find((option) => option.id === id)?.label || id || "-";
}

function latestByCreated(rows: RecordMap[]) {
  return rows.slice().sort((a, b) => String(b.created_at || b.submitted_at || "").localeCompare(String(a.created_at || a.submitted_at || "")))[0] || {};
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function money(value?: string) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return value || "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
}

function coerceSection(value?: string): Section {
  const allowed: Section[] = [
    "home",
    "control",
    "opportunity",
    "cashflow",
    "sales_submission",
    "order_ack",
    "execution",
    "governance",
    "talent",
    "ratecard",
    "users",
    "master",
    "candidates",
    "feedback",
    "onboarding",
    "documents",
    "timesheets",
    "overtime",
    "leave",
    "finance",
  ];
  return allowed.includes(value as Section) ? (value as Section) : "home";
}

function getNav(role: RoleId, isOwner: boolean): { id: Section; label: string; icon: ReactNode; roles: RoleId[] }[] {
  const allRoles: RoleId[] = [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_TEMPLATE_ADMIN",
    "ROLE_ACCOUNT_MANAGER",
    "ROLE_SOLUTION_ARCHITECT",
    "ROLE_COMMERCIAL_MANAGER",
    "ROLE_CONTRACT_LEGAL",
    "ROLE_SPONSOR",
    "ROLE_PROGRAM_DIRECTOR",
    "ROLE_PROJECT_MANAGER",
    "ROLE_RESOURCE_MANAGER",
    "ROLE_PROJECT_FINANCE_MANAGER",
    "ROLE_SUPPLY_MANAGER",
    "ROLE_PROCUREMENT_MANAGER",
    "ROLE_HR_ADMIN",
    "ROLE_HR_ADMINISTRATOR",
    "ROLE_FINANCE_CONTROLLER",
    "ROLE_VIEWER",
    "ROLE_AUDITOR",
    "ROLE_PAYROLL_ADMIN_OPS",
    "ROLE_CLIENT_APPROVER",
    "ROLE_CLIENT_FINANCE_VIEWER",
    "ROLE_EMPLOYEE",
  ];
  const nav: { id: Section; label: string; icon: ReactNode; roles: RoleId[] }[] = [
    { id: "home" as const, label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, roles: allRoles },
    { id: "control" as const, label: "Admin Control Plane", icon: <Settings className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_TEMPLATE_ADMIN", "ROLE_AUDITOR"] },
    { id: "opportunity" as const, label: "Opportunity Analysis", icon: <Target className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_SOLUTION_ARCHITECT", "ROLE_COMMERCIAL_MANAGER", "ROLE_SPONSOR", "ROLE_PROGRAM_DIRECTOR", "ROLE_VIEWER"] },
    { id: "cashflow" as const, label: "Cashflow Analysis", icon: <DollarSign className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_PAYROLL_ADMIN_OPS", "ROLE_SPONSOR", "ROLE_VIEWER"] },
    { id: "sales_submission" as const, label: "Sales Decision Submission", icon: <Send className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_SOLUTION_ARCHITECT", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROGRAM_DIRECTOR", "ROLE_SPONSOR"] },
    { id: "order_ack" as const, label: "Order Acknowledgement", icon: <Handshake className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_CONTRACT_LEGAL", "ROLE_PROGRAM_DIRECTOR", "ROLE_SPONSOR"] },
    { id: "execution" as const, label: "Project Governance", icon: <ClipboardCheck className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_MANAGER", "ROLE_RESOURCE_MANAGER", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_SUPPLY_MANAGER", "ROLE_PROCUREMENT_MANAGER", "ROLE_CLIENT_APPROVER", "ROLE_VIEWER"] },
    { id: "governance" as const, label: "IDBGF Governance", icon: <ShieldCheck className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_SPONSOR", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_MANAGER", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_CLIENT_APPROVER", "ROLE_AUDITOR", "ROLE_VIEWER"] },
    { id: "talent" as const, label: "Talent Planning", icon: <Users className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_RESOURCE_MANAGER", "ROLE_SUPPLY_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_PROGRAM_DIRECTOR"] },
    { id: "ratecard" as const, label: "Ratecard & Costing", icon: <ReceiptText className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_PAYROLL_ADMIN_OPS"] },
    { id: "users" as const, label: "Users", icon: <Users className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_FRAMEWORK_ADMIN"] },
    { id: "master" as const, label: "Client & Project Setup", icon: <BriefcaseBusiness className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"] },
    { id: "candidates" as const, label: "Candidate Intake", icon: <FileText className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR"] },
    { id: "feedback" as const, label: "Client Feedback", icon: <ClipboardCheck className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_CLIENT_APPROVER"] },
    { id: "onboarding" as const, label: "Resource Onboarding", icon: <CheckCircle2 className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_CLIENT_APPROVER", "ROLE_EMPLOYEE"] },
    { id: "documents" as const, label: "Documents", icon: <FolderOpen className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_TEMPLATE_ADMIN", "ROLE_AUDITOR"] },
    { id: "timesheets" as const, label: "Timesheets", icon: <Timer className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_PAYROLL_ADMIN_OPS", "ROLE_CLIENT_APPROVER", "ROLE_EMPLOYEE"] },
    { id: "overtime" as const, label: "Overtime", icon: <ClockIcon />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_PAYROLL_ADMIN_OPS", "ROLE_CLIENT_APPROVER", "ROLE_EMPLOYEE"] },
    { id: "leave" as const, label: "Leave", icon: <CalendarDays className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_CLIENT_APPROVER", "ROLE_EMPLOYEE"] },
    { id: "finance" as const, label: "GR & Invoices", icon: <ReceiptText className="h-4 w-4" />, roles: ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_PAYROLL_ADMIN_OPS", "ROLE_CLIENT_FINANCE_VIEWER"] },
  ];
  return nav.filter((item) => isOwner || item.roles.includes(role));
}

function ClockIcon() {
  return <Timer className="h-4 w-4" />;
}

function titleFor(section: Section) {
  return {
    home: "Operations Dashboard",
    control: "Administration Control Plane",
    opportunity: "Opportunity Analysis",
    cashflow: "Cashflow Analysis",
    sales_submission: "Sales Decision for Submission",
    order_ack: "Sales Decision Order Acknowledgement",
    execution: "Project Execution Governance",
    governance: "IDBGF Governance Layer",
    talent: "Talent Planning",
    ratecard: "Ratecard & Resource Costing",
    users: "User Management",
    master: "Client & Project Setup",
    candidates: "Candidate Intake",
    feedback: "Client Feedback",
    onboarding: "Resource Onboarding",
    documents: "Document Management",
    timesheets: "Timesheets",
    overtime: "Overtime",
    leave: "Leave Management",
    finance: "GR & Invoices",
  }[section];
}
