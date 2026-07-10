-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "grRecordId" TEXT;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "allowanceAmount" DECIMAL(18,2),
ADD COLUMN     "assignedClientLegacyId" TEXT,
ADD COLUMN     "assignedProjectLegacyId" TEXT,
ADD COLUMN     "baseSalary" DECIMAL(18,2),
ADD COLUMN     "bpjsKesehatanAmount" DECIMAL(18,2),
ADD COLUMN     "bpjsKesehatanRate" DECIMAL(7,4),
ADD COLUMN     "bpjsTkAmount" DECIMAL(18,2),
ADD COLUMN     "bpjsTkRate" DECIMAL(7,4),
ADD COLUMN     "clientBillRate" DECIMAL(18,2),
ADD COLUMN     "codeOfEthicsAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "commercialNotes" TEXT,
ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "contractStatus" TEXT,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "dailyRate" DECIMAL(18,2),
ADD COLUMN     "dataPrivacyConsentAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "grossMonthlySalary" DECIMAL(18,2),
ADD COLUMN     "hourlyRate" DECIMAL(18,2),
ADD COLUMN     "invoiceAmountEstimate" DECIMAL(18,2),
ADD COLUMN     "managementFeeAmount" DECIMAL(18,2),
ADD COLUMN     "managementFeeRate" DECIMAL(7,4),
ADD COLUMN     "ndaAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "netPayEstimate" DECIMAL(18,2),
ADD COLUMN     "onboardingTrainingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "pph21Amount" DECIMAL(18,2),
ADD COLUMN     "pph23Amount" DECIMAL(18,2),
ADD COLUMN     "recruitmentFee" DECIMAL(18,2),
ADD COLUMN     "resourceReadyAt" TIMESTAMP(3),
ADD COLUMN     "sourceCandidateLegacyId" TEXT,
ADD COLUMN     "taxRate" DECIMAL(7,4),
ADD COLUMN     "taxType" TEXT;

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_access_policies" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceScope" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "workflow" TEXT,
    "condition" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "approvalReference" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFeedback" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "reviewerUserId" TEXT,
    "rating" INTEGER,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "legacySourceId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nexusReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "clientApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "legacySourceId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "requestDate" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "hours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "nexusValidationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "clientApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "linkedTimesheetId" TEXT,
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "legacySourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "hrReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "clientApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "timesheetImpact" TEXT,
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "legacySourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "periodMonth" TEXT NOT NULL,
    "workSummary" TEXT,
    "approvedTimesheetIds" TEXT,
    "serviceAcceptanceStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "driveFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "legacySourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "ownerRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "framework_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "framework_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "framework_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealTypeCriterion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "minValueUsd" DECIMAL(18,2),
    "maxValueUsd" DECIMAL(18,2),
    "sponsorOverride" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealTypeCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommodityCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDomain" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencySetting" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateToUsd" DECIMAL(18,8),
    "refreshedAt" TIMESTAMP(3),
    "refreshSource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalThreshold" (
    "id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "minValueUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxValueUsd" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_matrices" (
    "id" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_rules" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approverRole" TEXT NOT NULL,
    "condition" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "escalationRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "approvalReference" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "opportunityCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerSegment" TEXT,
    "accountManager" TEXT,
    "solutionArchitect" TEXT,
    "dealType" TEXT,
    "targetSubmissionDate" TIMESTAMP(3),
    "expectedContractStart" TIMESTAMP(3),
    "expectedContractEnd" TIMESTAMP(3),
    "scopeSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pricingApprovedAt" TIMESTAMP(3),
    "pricingApprovedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalScenario" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "scenarioCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL(7,4),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalCommodityLine" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "commodityCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "resourceCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "partnerCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "procurementCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "projectCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalCommodityLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRegister" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "riskCode" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "commodityCode" TEXT,
    "description" TEXT NOT NULL,
    "probabilityScore" DECIMAL(8,4),
    "impactCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "mitigationPlan" TEXT,
    "mitigationCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "residualExposure" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "riskCostAfterMitigation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "predictedOccurrenceDate" TIMESTAMP(3),
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingDecision" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "decision" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowOption" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "optionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dsoDays" INTEGER NOT NULL DEFAULT 30,
    "grossInvoice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashGap" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "marginAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "npv" DECIMAL(18,2),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDecisionSubmission" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "customerValue" TEXT,
    "companyValue" TEXT,
    "upsellOpportunity" TEXT,
    "growthAspect" TEXT,
    "selectedScenario" TEXT,
    "selectedCashflow" TEXT,
    "deliveryCapability" TEXT,
    "pptDocumentId" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "sponsor" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDecisionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAcknowledgement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "receivedPoNumber" TEXT,
    "contractDocumentId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "sponsor" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDeviation" (
    "id" TEXT NOT NULL,
    "orderAcknowledgementId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baselineValue" TEXT,
    "receivedValue" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'requires_clarification',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractDeviation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGovernance" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "opportunityCode" TEXT,
    "orderAcknowledgementId" TEXT,
    "sponsor" TEXT,
    "projectManager" TEXT,
    "programDirector" TEXT,
    "projectFinanceManager" TEXT,
    "resourceManager" TEXT,
    "supplyManager" TEXT,
    "procurementManager" TEXT,
    "scheduleStatus" TEXT NOT NULL DEFAULT 'green',
    "scopeStatus" TEXT NOT NULL DEFAULT 'green',
    "costStatus" TEXT NOT NULL DEFAULT 'green',
    "qualityStatus" TEXT NOT NULL DEFAULT 'green',
    "riskStatus" TEXT NOT NULL DEFAULT 'green',
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'pending',
    "grStatus" TEXT NOT NULL DEFAULT 'pending',
    "invoiceStatus" TEXT NOT NULL DEFAULT 'pending',
    "netSalesEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGovernance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGate" (
    "id" TEXT NOT NULL,
    "projectGovernanceId" TEXT NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "gateName" TEXT NOT NULL,
    "entryCriteria" TEXT,
    "outputEvidence" TEXT,
    "initiatedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourcePlan" (
    "id" TEXT NOT NULL,
    "projectGovernanceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "skill" TEXT,
    "location" TEXT,
    "source" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "allocationPercent" DECIMAL(7,2) NOT NULL DEFAULT 100,
    "ratecardReference" TEXT,
    "blendedCostReference" TEXT,
    "availability" TEXT,
    "onboardingStatus" TEXT,
    "resourceRisk" TEXT,
    "replacementPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourcePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceBoard" (
    "id" TEXT NOT NULL,
    "projectGovernanceId" TEXT,
    "boardType" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "chair" TEXT,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "agenda" TEXT,
    "decisions" TEXT,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "escalationStatus" TEXT NOT NULL DEFAULT 'none',
    "evidenceDocumentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "currentRole" TEXT,
    "expectedRole" TEXT,
    "riskForLeaving" TEXT,
    "impact" TEXT,
    "note" TEXT,
    "readiness" TEXT,
    "successorCandidateForRole" TEXT,
    "certificationRequirement" TEXT,
    "developmentAction" TEXT,
    "retentionRiskMitigation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ratecard" (
    "id" TEXT NOT NULL,
    "ratecardCode" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "location" TEXT,
    "source" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "netAccrualSalaryMonthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "productiveHoursMonthly" DECIMAL(8,2) NOT NULL DEFAULT 160,
    "absorbedMonthlyCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "absorbedHourlyCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "operationalMarkupPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "recommendedHourlyCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ratecard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_status_idx" ON "permissions"("module", "status");

-- CreateIndex
CREATE INDEX "user_roles_userId_status_idx" ON "user_roles"("userId", "status");

-- CreateIndex
CREATE INDEX "user_roles_roleId_status_idx" ON "user_roles"("roleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_scopeType_scopeId_key" ON "user_roles"("userId", "roleId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_status_idx" ON "role_permissions"("roleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_access_policies_subjectType_subject_idx" ON "user_access_policies"("subjectType", "subject");

-- CreateIndex
CREATE INDEX "user_access_policies_resourceType_status_idx" ON "user_access_policies"("resourceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFeedback_legacySourceId_key" ON "ClientFeedback"("legacySourceId");

-- CreateIndex
CREATE INDEX "ClientFeedback_candidateId_idx" ON "ClientFeedback"("candidateId");

-- CreateIndex
CREATE INDEX "ClientFeedback_clientId_idx" ON "ClientFeedback"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_legacySourceId_key" ON "Timesheet"("legacySourceId");

-- CreateIndex
CREATE INDEX "Timesheet_resourceId_idx" ON "Timesheet"("resourceId");

-- CreateIndex
CREATE INDEX "Timesheet_assignmentId_idx" ON "Timesheet"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_legacySourceId_key" ON "OvertimeRequest"("legacySourceId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_resourceId_idx" ON "OvertimeRequest"("resourceId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_assignmentId_idx" ON "OvertimeRequest"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_legacySourceId_key" ON "LeaveRequest"("legacySourceId");

-- CreateIndex
CREATE INDEX "LeaveRequest_resourceId_idx" ON "LeaveRequest"("resourceId");

-- CreateIndex
CREATE INDEX "LeaveRequest_assignmentId_idx" ON "LeaveRequest"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GrRecord_legacySourceId_key" ON "GrRecord"("legacySourceId");

-- CreateIndex
CREATE INDEX "GrRecord_clientId_idx" ON "GrRecord"("clientId");

-- CreateIndex
CREATE INDEX "GrRecord_projectId_idx" ON "GrRecord"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "framework_settings_key_key" ON "framework_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "framework_versions_version_key" ON "framework_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "DealTypeCriterion_code_key" ON "DealTypeCriterion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CommodityCode_code_key" ON "CommodityCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RiskDomain_code_key" ON "RiskDomain"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencySetting_code_key" ON "CurrencySetting"("code");

-- CreateIndex
CREATE INDEX "ApprovalThreshold_decision_status_idx" ON "ApprovalThreshold"("decision", "status");

-- CreateIndex
CREATE INDEX "approval_matrices_workflow_status_idx" ON "approval_matrices"("workflow", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_matrices_workflow_decision_key" ON "approval_matrices"("workflow", "decision");

-- CreateIndex
CREATE INDEX "approval_rules_matrixId_status_idx" ON "approval_rules"("matrixId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_rules_matrixId_sequence_approverRole_key" ON "approval_rules"("matrixId", "sequence", "approverRole");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_opportunityCode_key" ON "Opportunity"("opportunityCode");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE INDEX "Opportunity_dealType_idx" ON "Opportunity"("dealType");

-- CreateIndex
CREATE INDEX "ProposalScenario_opportunityId_idx" ON "ProposalScenario"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalScenario_opportunityId_scenarioCode_key" ON "ProposalScenario"("opportunityId", "scenarioCode");

-- CreateIndex
CREATE INDEX "ProposalCommodityLine_scenarioId_idx" ON "ProposalCommodityLine"("scenarioId");

-- CreateIndex
CREATE INDEX "ProposalCommodityLine_commodityCode_idx" ON "ProposalCommodityLine"("commodityCode");

-- CreateIndex
CREATE INDEX "RiskRegister_opportunityId_idx" ON "RiskRegister"("opportunityId");

-- CreateIndex
CREATE INDEX "RiskRegister_domain_idx" ON "RiskRegister"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRegister_opportunityId_riskCode_key" ON "RiskRegister"("opportunityId", "riskCode");

-- CreateIndex
CREATE INDEX "PricingDecision_opportunityId_idx" ON "PricingDecision"("opportunityId");

-- CreateIndex
CREATE INDEX "CashflowOption_opportunityId_idx" ON "CashflowOption"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "CashflowOption_opportunityId_optionCode_key" ON "CashflowOption"("opportunityId", "optionCode");

-- CreateIndex
CREATE INDEX "SalesDecisionSubmission_opportunityId_idx" ON "SalesDecisionSubmission"("opportunityId");

-- CreateIndex
CREATE INDEX "OrderAcknowledgement_opportunityId_idx" ON "OrderAcknowledgement"("opportunityId");

-- CreateIndex
CREATE INDEX "ContractDeviation_orderAcknowledgementId_idx" ON "ContractDeviation"("orderAcknowledgementId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGovernance_projectCode_key" ON "ProjectGovernance"("projectCode");

-- CreateIndex
CREATE INDEX "ProjectGovernance_opportunityCode_idx" ON "ProjectGovernance"("opportunityCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGate_projectGovernanceId_gateNumber_key" ON "ProjectGate"("projectGovernanceId", "gateNumber");

-- CreateIndex
CREATE INDEX "ResourcePlan_projectGovernanceId_idx" ON "ResourcePlan"("projectGovernanceId");

-- CreateIndex
CREATE INDEX "GovernanceBoard_boardType_meetingDate_idx" ON "GovernanceBoard"("boardType", "meetingDate");

-- CreateIndex
CREATE INDEX "GovernanceBoard_projectGovernanceId_idx" ON "GovernanceBoard"("projectGovernanceId");

-- CreateIndex
CREATE INDEX "TalentProfile_currentRole_idx" ON "TalentProfile"("currentRole");

-- CreateIndex
CREATE INDEX "TalentProfile_expectedRole_idx" ON "TalentProfile"("expectedRole");

-- CreateIndex
CREATE UNIQUE INDEX "Ratecard_ratecardCode_key" ON "Ratecard"("ratecardCode");

-- CreateIndex
CREATE INDEX "Ratecard_resourceType_location_idx" ON "Ratecard"("resourceType", "location");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrRecord" ADD CONSTRAINT "GrRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrRecord" ADD CONSTRAINT "GrRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_grRecordId_fkey" FOREIGN KEY ("grRecordId") REFERENCES "GrRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "approval_matrices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalScenario" ADD CONSTRAINT "ProposalScenario_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalCommodityLine" ADD CONSTRAINT "ProposalCommodityLine_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ProposalScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegister" ADD CONSTRAINT "RiskRegister_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingDecision" ADD CONSTRAINT "PricingDecision_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingDecision" ADD CONSTRAINT "PricingDecision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ProposalScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowOption" ADD CONSTRAINT "CashflowOption_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDecisionSubmission" ADD CONSTRAINT "SalesDecisionSubmission_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAcknowledgement" ADD CONSTRAINT "OrderAcknowledgement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDeviation" ADD CONSTRAINT "ContractDeviation_orderAcknowledgementId_fkey" FOREIGN KEY ("orderAcknowledgementId") REFERENCES "OrderAcknowledgement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGate" ADD CONSTRAINT "ProjectGate_projectGovernanceId_fkey" FOREIGN KEY ("projectGovernanceId") REFERENCES "ProjectGovernance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePlan" ADD CONSTRAINT "ResourcePlan_projectGovernanceId_fkey" FOREIGN KEY ("projectGovernanceId") REFERENCES "ProjectGovernance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceBoard" ADD CONSTRAINT "GovernanceBoard_projectGovernanceId_fkey" FOREIGN KEY ("projectGovernanceId") REFERENCES "ProjectGovernance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

