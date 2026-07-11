-- Phase 0: introduce Organization (tenant) and scope existing business data to it.
-- Existing rows all belong to the original single-tenant deployment, so this migration
-- backfills every existing row onto one seeded "Nexus Sevenfold" organization before
-- tightening the new organizationId columns to NOT NULL.

-- =========================================================================
-- 1. New enums + organizations table
-- =========================================================================

CREATE TYPE "OrganizationStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE');

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'TRIAL',
    "planTier" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "seatLimit" INTEGER,
    "stripeCustomerId" TEXT,
    "driveRootFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- Seed tenant #1: the original company this app was built for. All pre-existing rows
-- backfill onto this organization below. driveRootFolderId is left NULL here and should
-- be set to the existing GOOGLE_DRIVE_ROOT_FOLDER_ID value once that config is migrated
-- off the global env var (tracked separately).
INSERT INTO "organizations" ("id", "slug", "name", "status", "planTier", "createdAt", "updatedAt")
VALUES ('org_nxs_default', 'nexus-sevenfold', 'Nexus Sevenfold', 'ACTIVE', 'ENTERPRISE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =========================================================================
-- 2. Drop the single-column unique constraints being replaced by org-scoped ones
-- =========================================================================

DROP INDEX "Client_code_key";
DROP INDEX "Client_legacySourceId_key";
DROP INDEX "CommodityCode_code_key";
DROP INDEX "CurrencySetting_code_key";
DROP INDEX "DealTypeCriterion_code_key";
DROP INDEX "Document_legacySourceId_key";
DROP INDEX "Opportunity_opportunityCode_key";
DROP INDEX "ProjectGovernance_projectCode_key";
DROP INDEX "Ratecard_ratecardCode_key";
DROP INDEX "Resource_legacySourceId_key";
DROP INDEX "RiskDomain_code_key";
DROP INDEX "SystemSetting_key_key";
DROP INDEX "SystemSetting_legacySourceId_key";
DROP INDEX "User_email_key";
DROP INDEX "User_legacySourceId_key";
DROP INDEX "approval_matrices_workflow_decision_key";
DROP INDEX "framework_settings_key_key";
DROP INDEX "framework_versions_version_key";

-- =========================================================================
-- 3. Add organizationId columns as nullable first (so existing rows can be backfilled)
-- =========================================================================

ALTER TABLE "ApprovalThreshold" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CashflowOption" ADD COLUMN "calculation" JSONB;
ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CommodityCode" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CurrencySetting" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "DealTypeCriterion" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Document" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "GovernanceBoard" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ProjectGovernance" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Ratecard" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Resource" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "RiskDomain" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "SystemSetting" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TalentProfile" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "approval_matrices" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "framework_settings" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "framework_versions" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "user_access_policies" ADD COLUMN "organizationId" TEXT;

-- =========================================================================
-- 4. Backfill every existing row onto the seeded default organization
-- =========================================================================

UPDATE "ApprovalThreshold" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "AuditLog" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "Client" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "CommodityCode" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "CurrencySetting" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "DealTypeCriterion" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "Document" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "DocumentTemplate" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "GovernanceBoard" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "Opportunity" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "ProjectGovernance" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "Ratecard" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "Resource" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "RiskDomain" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "SystemSetting" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "TalentProfile" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
-- User and AuditLog stay nullable at the schema level (platform-admin accounts and
-- system-level audit entries are not tied to one tenant), but every row that already
-- exists today belongs to the original tenant, so backfill them too.
UPDATE "User" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "approval_matrices" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "framework_settings" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "framework_versions" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;
UPDATE "user_access_policies" SET "organizationId" = 'org_nxs_default' WHERE "organizationId" IS NULL;

-- =========================================================================
-- 5. Tighten to NOT NULL where the schema requires it (User/AuditLog stay nullable)
-- =========================================================================

ALTER TABLE "ApprovalThreshold" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CommodityCode" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CurrencySetting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DealTypeCriterion" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DocumentTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "GovernanceBoard" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProjectGovernance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Ratecard" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Resource" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RiskDomain" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SystemSetting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TalentProfile" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "approval_matrices" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "framework_settings" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "framework_versions" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "user_access_policies" ALTER COLUMN "organizationId" SET NOT NULL;

-- =========================================================================
-- 6. New org-scoped indexes and unique constraints
-- =========================================================================

CREATE INDEX "ApprovalThreshold_organizationId_idx" ON "ApprovalThreshold"("organizationId");
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");
CREATE UNIQUE INDEX "Client_organizationId_code_key" ON "Client"("organizationId", "code");
CREATE UNIQUE INDEX "Client_organizationId_legacySourceId_key" ON "Client"("organizationId", "legacySourceId");
CREATE UNIQUE INDEX "CommodityCode_organizationId_code_key" ON "CommodityCode"("organizationId", "code");
CREATE UNIQUE INDEX "CurrencySetting_organizationId_code_key" ON "CurrencySetting"("organizationId", "code");
CREATE UNIQUE INDEX "DealTypeCriterion_organizationId_code_key" ON "DealTypeCriterion"("organizationId", "code");
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE UNIQUE INDEX "Document_organizationId_legacySourceId_key" ON "Document"("organizationId", "legacySourceId");
CREATE INDEX "DocumentTemplate_organizationId_idx" ON "DocumentTemplate"("organizationId");
CREATE INDEX "GovernanceBoard_organizationId_idx" ON "GovernanceBoard"("organizationId");
CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");
CREATE UNIQUE INDEX "Opportunity_organizationId_opportunityCode_key" ON "Opportunity"("organizationId", "opportunityCode");
CREATE INDEX "ProjectGovernance_organizationId_idx" ON "ProjectGovernance"("organizationId");
CREATE UNIQUE INDEX "ProjectGovernance_organizationId_projectCode_key" ON "ProjectGovernance"("organizationId", "projectCode");
CREATE INDEX "Ratecard_organizationId_idx" ON "Ratecard"("organizationId");
CREATE UNIQUE INDEX "Ratecard_organizationId_ratecardCode_key" ON "Ratecard"("organizationId", "ratecardCode");
CREATE INDEX "Resource_organizationId_idx" ON "Resource"("organizationId");
CREATE UNIQUE INDEX "Resource_organizationId_legacySourceId_key" ON "Resource"("organizationId", "legacySourceId");
CREATE UNIQUE INDEX "RiskDomain_organizationId_code_key" ON "RiskDomain"("organizationId", "code");
CREATE UNIQUE INDEX "SystemSetting_organizationId_key_key" ON "SystemSetting"("organizationId", "key");
CREATE UNIQUE INDEX "SystemSetting_organizationId_legacySourceId_key" ON "SystemSetting"("organizationId", "legacySourceId");
CREATE INDEX "TalentProfile_organizationId_idx" ON "TalentProfile"("organizationId");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");
CREATE UNIQUE INDEX "User_organizationId_legacySourceId_key" ON "User"("organizationId", "legacySourceId");
CREATE UNIQUE INDEX "approval_matrices_organizationId_workflow_decision_key" ON "approval_matrices"("organizationId", "workflow", "decision");
CREATE UNIQUE INDEX "framework_settings_organizationId_key_key" ON "framework_settings"("organizationId", "key");
CREATE UNIQUE INDEX "framework_versions_organizationId_version_key" ON "framework_versions"("organizationId", "version");
CREATE INDEX "user_access_policies_organizationId_idx" ON "user_access_policies"("organizationId");

-- =========================================================================
-- 7. Foreign keys
-- =========================================================================

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_access_policies" ADD CONSTRAINT "user_access_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_settings" ADD CONSTRAINT "framework_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealTypeCriterion" ADD CONSTRAINT "DealTypeCriterion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommodityCode" ADD CONSTRAINT "CommodityCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskDomain" ADD CONSTRAINT "RiskDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurrencySetting" ADD CONSTRAINT "CurrencySetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalThreshold" ADD CONSTRAINT "ApprovalThreshold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_matrices" ADD CONSTRAINT "approval_matrices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectGovernance" ADD CONSTRAINT "ProjectGovernance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceBoard" ADD CONSTRAINT "GovernanceBoard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ratecard" ADD CONSTRAINT "Ratecard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
