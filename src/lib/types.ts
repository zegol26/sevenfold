export type RoleId =
  | "ROLE_SUPER_ADMIN"
  | "ROLE_NEXUS_ADMIN"
  | "ROLE_FRAMEWORK_ADMIN"
  | "ROLE_TEMPLATE_ADMIN"
  | "ROLE_ACCOUNT_MANAGER"
  | "ROLE_SOLUTION_ARCHITECT"
  | "ROLE_COMMERCIAL_MANAGER"
  | "ROLE_CONTRACT_LEGAL"
  | "ROLE_SPONSOR"
  | "ROLE_PROGRAM_DIRECTOR"
  | "ROLE_PROJECT_MANAGER"
  | "ROLE_RESOURCE_MANAGER"
  | "ROLE_PROJECT_FINANCE_MANAGER"
  | "ROLE_SUPPLY_MANAGER"
  | "ROLE_PROCUREMENT_MANAGER"
  | "ROLE_HR_ADMIN"
  | "ROLE_HR_ADMINISTRATOR"
  | "ROLE_FINANCE_CONTROLLER"
  | "ROLE_VIEWER"
  | "ROLE_AUDITOR"
  | "ROLE_PAYROLL_ADMIN_OPS"
  | "ROLE_CANDIDATE"
  | "ROLE_EMPLOYEE"
  | "ROLE_CLIENT_APPROVER"
  | "ROLE_CLIENT_FINANCE_VIEWER";

export type RecordMap = Record<string, string>;

export type UserRecord = RecordMap & {
  user_id: string;
  email: string;
  full_name: string;
  role_id: RoleId;
  client_id?: string;
  project_id?: string;
  employee_id?: string;
  candidate_id?: string;
  status: string;
};

export type AppUser = UserRecord & {
  permissions: string;
};

export type Option = {
  id: string;
  label: string;
  meta?: string;
  currency?: string;
};

export type DealTypeCriterion = {
  id: string;
  name: string;
  criteria: string;
  minValueUsd?: string;
  maxValueUsd?: string;
  sponsorOverride?: boolean;
  status: string;
};

export type CommodityCodeSetting = {
  code: string;
  name: string;
  description: string;
  status: string;
};

export type RiskDomainSetting = {
  id: string;
  name: string;
  status: string;
};

export type CurrencySetting = {
  code: string;
  name: string;
  rateToUsd: string;
  updatedAt?: string;
  status: string;
};

export type ApprovalThresholdSetting = {
  id: string;
  decision: string;
  role: string;
  minValueUsd: string;
  maxValueUsd?: string;
  status: string;
};

export type ControlPlaneRoleSetting = {
  code: string;
  name: string;
  description: string;
  status: string;
};

export type ControlPlanePermissionSetting = {
  code: string;
  name: string;
  module: string;
  description: string;
  status: string;
};

export type RolePermissionSetting = {
  roleCode: string;
  permissionCode: string;
  status: string;
};

export type UserAccessPolicySetting = {
  id: string;
  subject: string;
  subjectType: string;
  resourceType: string;
  resourceScope: string;
  effect: string;
  status: string;
};

export type WorkflowAccessPolicySetting = {
  id: string;
  workflow: string;
  roleCode: string;
  accessLevel: string;
  status: string;
};

export type ApprovalMatrixSetting = {
  id: string;
  workflow: string;
  decision: string;
  status: string;
};

export type ApprovalRuleSetting = {
  id: string;
  matrixId: string;
  sequence: string;
  approverRole: string;
  condition: string;
  required: string;
  status: string;
};

export type DocumentTemplateSetting = {
  id: string;
  category: string;
  documentType: string;
  templateName: string;
  driveFileId?: string;
  status: string;
};

export type RiskScoringSetting = {
  id: string;
  label: string;
  minScore: string;
  maxScore: string;
  severity: string;
  actionGuidance: string;
  status: string;
};

export type GateDefinitionSetting = {
  id: string;
  gateCode: string;
  name: string;
  description: string;
  ownerRole: string;
  status: string;
};

export type GateChecklistSetting = {
  id: string;
  gateCode: string;
  item: string;
  mandatory: string;
  evidenceType: string;
  status: string;
};

export type GovernanceCadenceSetting = {
  id: string;
  forum: string;
  cadence: string;
  ownerRole: string;
  audience: string;
  status: string;
};

export type RagThresholdSetting = {
  id: string;
  metric: string;
  green: string;
  amber: string;
  red: string;
  status: string;
};

export type WorkingHoursSetting = {
  id: string;
  country: string;
  timezone: string;
  hoursPerDay: string;
  daysPerWeek: string;
  startTime: string;
  endTime: string;
  status: string;
};

export type RatecardAssumptionSetting = {
  id: string;
  name: string;
  value: string;
  unit: string;
  description: string;
  status: string;
};

export type DocumentCategorySetting = {
  id: string;
  category: string;
  description: string;
  retentionRule: string;
  status: string;
};

export type WorkflowStatusSetting = {
  id: string;
  workflow: string;
  statusCode: string;
  label: string;
  terminal: string;
  status: string;
};

export type TemplateMetadata = {
  templateId: string;
  templateName: string;
  templateType: string;
  documentCategory: string;
  driveFileId: string;
  mimeType: string;
  fileSize: string;
  version: string;
  status: "draft" | "review" | "approved" | "active" | "retired";
  effectiveFrom: string;
  effectiveTo?: string;
  uploadedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateManagementRegistry = {
  templates: TemplateMetadata[];
  updatedAt?: string;
};

export type ProjectExecutionProject = {
  projectId: string;
  linkedOpportunityId: string;
  linkedSdsId: string;
  linkedSdoaId: string;
  customer: string;
  sponsor: string;
  projectLeader: string;
  projectFinanceManager: string;
  resourceManager: string;
  contractLegalOwner: string;
  commercialOwner: string;
  currency?: string;
  frameworkVersion: string;
  templateVersionSet: string;
  milestonePlan: string;
  siteClusterConfiguration: string;
  deliveryBaseline: string;
  financialBaseline: string;
  governanceCadence: string;
  netSalesEstimate?: string;
  additionalBudget?: string;
  additionalRevenue?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectExecutionGate = {
  gateId: string;
  projectId: string;
  gateNumber: string;
  gateName: string;
  checklist: string;
  mandatoryChecklistComplete: string;
  requiredInput: string;
  requiredOutput: string;
  requiredDocumentTemplate: string;
  ragStatus: string;
  issues: string;
  risks: string;
  approvalStatus: string;
  initiatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  decision?: string;
  comments?: string;
  sponsorException?: string;
  updatedAt: string;
};

export type SiteHandlerRecord = {
  siteClusterId: string;
  projectId: string;
  scopePackage: string;
  plannedDate: string;
  actualDate: string;
  progressStatus: string;
  acceptanceStatus: string;
  acceptanceCertificateDocument: string;
  goodReceiptDocument: string;
  invoiceStatus: string;
  invoiceDocument: string;
  handoverStatus: string;
  acceptedScopeValue: string;
  updatedAt: string;
};

export type ProjectResourceDemandRecord = {
  demandId: string;
  projectId: string;
  projectDemand: string;
  requiredRole: string;
  requiredSkill: string;
  location: string;
  startDate: string;
  endDate: string;
  allocationPercent: string;
  assignedResource: string;
  gapStatus: string;
  onboardingStatus: string;
  timesheetReadiness: string;
  resourceRisk: string;
  replacementPlan: string;
  status: string;
  updatedAt: string;
};

export type CommercialProcurementRecord = {
  flowId: string;
  projectId: string;
  siteClusterId: string;
  acceptedMilestone: string;
  purchaseRequest: string;
  purchaseOrder: string;
  supplierVendor: string;
  customerPo: string;
  invoice: string;
  invoiceItem: string;
  invoiceStatus: string;
  paymentStatus: string;
  grStatus: string;
  grDocument: string;
  customerPoDocument: string;
  invoiceDocument: string;
  documentAttachment: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: string;
  status: string;
  updatedAt: string;
};

export type ProjectExecutionRegistry = {
  projects: ProjectExecutionProject[];
  gates: ProjectExecutionGate[];
  sites: SiteHandlerRecord[];
  resourceDemands: ProjectResourceDemandRecord[];
  commercialFlows: CommercialProcurementRecord[];
  updatedAt?: string;
};

export type ChangeRequestRecord = {
  crId: string;
  projectId: string;
  title: string;
  description: string;
  reason: string;
  scopeImpact: string;
  scheduleImpact: string;
  costImpact: string;
  revenueImpact: string;
  additionalBudget: string;
  addOnSalesValue: string;
  riskImpact: string;
  documentAttachment: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: string;
  decisionComments?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type QualityIncidentRecord = {
  incidentId: string;
  projectId: string;
  gateId?: string;
  siteClusterId?: string;
  incidentType: string;
  severity: string;
  source: string;
  incidentOwner: string;
  actionOwner: string;
  rca: string;
  correctiveAction: string;
  preventiveAction: string;
  dueDate: string;
  status: string;
  ragImpact: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GovernanceRecord = {
  governanceId: string;
  level: string;
  workstream: string;
  projectId?: string;
  period: string;
  schedule: string;
  scope: string;
  costFinance: string;
  revenue: string;
  margin: string;
  invoicing: string;
  cashCollection: string;
  resources: string;
  quality: string;
  risks: string;
  issues: string;
  changeRequests: string;
  escalations: string;
  decisions: string;
  actionOwner: string;
  dueDate: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type GovernanceSummary = {
  openChangeRequests: number;
  approvedChangeRequests: number;
  additionalBudget: string;
  addOnSalesValue: string;
  openIncidents: number;
  redIncidents: number;
  overdueActions: number;
  netSalesEstimate: string;
  resourceGaps: number;
  timesheetNotReady: number;
  latestEscalations: GovernanceRecord[];
};

export type DeliveryGovernanceRegistry = {
  changeRequests: ChangeRequestRecord[];
  incidents: QualityIncidentRecord[];
  governanceRecords: GovernanceRecord[];
  updatedAt?: string;
};

export type TalentPlanningRecord = {
  talentId: string;
  name: string;
  age: string;
  gender: string;
  currentRole: string;
  expectedRole: string;
  riskForLeaving: string;
  impact: string;
  note: string;
  readiness: string;
  certificationRequirement: string;
  managerReadiness: string;
  successionCandidateStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TalentPlanningRegistry = {
  talents: TalentPlanningRecord[];
  updatedAt?: string;
};

export type FxRateRecord = {
  currency: "USD" | "EUR" | "IDR" | "SGD" | "AUD" | "THB";
  rateToUsd: string;
  source: string;
  updatedAt: string;
};

export type RatecardResourceCostRecord = {
  ratecardId: string;
  resourceType: string;
  currency: string;
  monthlyNetAccrualSalary: string;
  monthlyWorkingHours: string;
  allocatedPcCostPerHour: string;
  toolsCostPerHour: string;
  facilityCostPerHour: string;
  trainingCostPerHour: string;
  internetCostPerHour: string;
  markupPercent: string;
  onsitePercent: string;
  remotePercent: string;
  highCostLocationPercent: string;
  lowCostLocationPercent: string;
  seniorPercent: string;
  juniorPercent: string;
  baseHourlyCost: string;
  operationalCostPerHour: string;
  recommendedHourlyCost: string;
  blendedRate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RatecardRegistry = {
  resources: RatecardResourceCostRecord[];
  fxRates: FxRateRecord[];
  fxUpdatedAt?: string;
  updatedAt?: string;
};

export type FrameworkVersionSetting = {
  version: string;
  description: string;
  effectiveAt?: string;
  status: string;
};

export type FrameworkControlPlane = {
  roles: ControlPlaneRoleSetting[];
  permissions: ControlPlanePermissionSetting[];
  rolePermissions: RolePermissionSetting[];
  userAccessPolicies: UserAccessPolicySetting[];
  workflowAccessPolicies: WorkflowAccessPolicySetting[];
  approvalMatrices: ApprovalMatrixSetting[];
  approvalRules: ApprovalRuleSetting[];
  dealTypes: DealTypeCriterion[];
  commodityCodes: CommodityCodeSetting[];
  riskDomains: RiskDomainSetting[];
  riskScoring: RiskScoringSetting[];
  gateDefinitions: GateDefinitionSetting[];
  gateChecklist: GateChecklistSetting[];
  governanceCadence: GovernanceCadenceSetting[];
  ragThresholds: RagThresholdSetting[];
  currencies: CurrencySetting[];
  workingHours: WorkingHoursSetting[];
  defaultRatecardAssumptions: RatecardAssumptionSetting[];
  documentCategories: DocumentCategorySetting[];
  workflowStatuses: WorkflowStatusSetting[];
  approvalThresholds: ApprovalThresholdSetting[];
  documentTemplateSettings: DocumentTemplateSetting[];
  frameworkVersions: FrameworkVersionSetting[];
  manualNotes: string[];
  updatedAt?: string;
};

export type DashboardData = {
  setupError?: string;
  sessionEmail?: string;
  user: AppUser | null;
  metrics: {
    candidates: number;
    employees: number;
    pendingFeedback: number;
    readyResources: number;
    timesheets?: number;
    pendingApprovals?: number;
    overtimeRequests?: number;
    leaveRequests?: number;
    invoices?: number;
  };
  users: RecordMap[];
  candidates: RecordMap[];
  employees: RecordMap[];
  clients: Option[];
  projects: Option[];
  employee_documents?: RecordMap[];
  onboarding_documents?: RecordMap[];
  employee_contracts?: RecordMap[];
  candidate_documents?: RecordMap[];
  assignments?: RecordMap[];
  timesheets?: RecordMap[];
  overtime_requests?: RecordMap[];
  leave_requests?: RecordMap[];
  gr_records?: RecordMap[];
  invoices?: RecordMap[];
  invoice_lines?: RecordMap[];
  project_applications?: RecordMap[];
  opportunity_analysis?: {
    opportunities: RecordMap[];
    scenarios: RecordMap[];
    commodityLines: RecordMap[];
    risks: RecordMap[];
    pricingDecisions: RecordMap[];
    cashflowOptions: RecordMap[];
    sdsRecords: RecordMap[];
    sdoaRecords: RecordMap[];
    sdoaDeviations: RecordMap[];
    urgentRisks: RecordMap[];
    topExposureRisks: RecordMap[];
  };
  framework_settings?: FrameworkControlPlane;
  template_management?: TemplateManagementRegistry;
  project_execution?: ProjectExecutionRegistry;
  delivery_governance?: DeliveryGovernanceRegistry;
  governance_summary?: GovernanceSummary;
  talent_planning?: TalentPlanningRegistry;
  ratecard?: RatecardRegistry;
  audit_logs?: RecordMap[];
};
