import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultFrameworkControlPlane, SEVENFOLD_ACCESS_ROLES } from "../src/lib/framework-defaults";

const prisma = new PrismaClient();

const LEGACY_WORKFLOW_ROLES = [
  ["ROLE_NEXUS_ADMIN", "Nexus Admin", "Operational platform administrator."],
  ["ROLE_HR_ADMIN", "HR Admin", "HR and resource onboarding administrator."],
  ["ROLE_PAYROLL_ADMIN_OPS", "Payroll Admin Ops", "Payroll and operational compensation reviewer."],
  ["ROLE_CANDIDATE", "Candidate", "Candidate portal access."],
  ["ROLE_EMPLOYEE", "Employee", "Employee/resource self-service access."],
  ["ROLE_CLIENT_APPROVER", "Client Approver", "Client-side approval and feedback access."],
  ["ROLE_CLIENT_FINANCE_VIEWER", "Client Finance Viewer", "Client-side finance visibility."],
] as const;

// Seeds one tenant organization plus its framework defaults. Role/Permission catalogs
// are global (shared Sevenfold vocabulary across all tenants); everything else seeded
// here is scoped to organizationId. This same shape is the template Phase 2's
// provisioning flow will reuse when a new organization signs up.
async function main() {
  const controlPlane = defaultFrameworkControlPlane();
  const roleRows = [...SEVENFOLD_ACCESS_ROLES, ...LEGACY_WORKFLOW_ROLES];
  const permissionRows = [
    { code: "super:all", name: "Super All", module: "administration", description: "Unrestricted system owner permission.", status: "active" },
    { code: "platform:all", name: "Platform All", module: "platform", description: "Unrestricted cross-tenant platform staff permission.", status: "active" },
    ...controlPlane.permissions,
    { code: "users:manage", name: "Manage Workflow Users", module: "administration", description: "Create and maintain workflow users.", status: "active" },
    { code: "workflow:operate", name: "Operate Workflow", module: "workflow", description: "Operate assigned workflow modules.", status: "active" },
  ];

  for (const [code, name, description] of roleRows) {
    await prisma.role.upsert({
      where: { code },
      update: { name, description, status: "active" },
      create: { code, name, description, permissions: code === "ROLE_SUPER_ADMIN" ? ["super:all"] : code === "ROLE_PLATFORM_ADMIN" ? ["platform:all"] : [], status: "active" },
    });
  }

  for (const permission of permissionRows) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }

  for (const item of controlPlane.rolePermissions) {
    const role = await prisma.role.findUnique({ where: { code: item.roleCode } });
    const permission = await prisma.permission.findUnique({ where: { code: item.permissionCode } });
    if (role && permission) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { status: item.status },
        create: { roleId: role.id, permissionId: permission.id, status: item.status, reason: "Sevenfold seed" },
      });
    }
  }

  // Tenant #1: the original company this app was built for. New tenants provisioned
  // later get their own Organization row and their own copy of everything below.
  const organization = await prisma.organization.upsert({
    where: { slug: "nexus-sevenfold" },
    update: {},
    create: {
      id: "org_nxs_default",
      slug: "nexus-sevenfold",
      name: "Nexus Sevenfold",
      status: "ACTIVE",
      planTier: "ENTERPRISE",
    },
  });
  const orgId = organization.id;

  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: "ROLE_SUPER_ADMIN" } });
  const superAdminPassword = process.env.SEVENFOLD_SUPER_ADMIN_PASSWORD;
  if (!superAdminPassword) {
    throw new Error("SEVENFOLD_SUPER_ADMIN_PASSWORD must be set before seeding (no hardcoded fallback).");
  }
  const superAdminEmails = (process.env.SEVENFOLD_SUPER_ADMIN_EMAILS || "").split(",").map((email) => email.trim()).filter(Boolean);
  if (superAdminEmails.length === 0) {
    throw new Error("SEVENFOLD_SUPER_ADMIN_EMAILS must be set to a comma-separated list before seeding.");
  }
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);
  for (const [index, email] of superAdminEmails.entries()) {
    const localPart = email.split("@")[0];
    await prisma.user.upsert({
      where: { organizationId_email: { organizationId: orgId, email } },
      update: { roleId: superRole.id, status: "ACTIVE", passwordHash },
      create: {
        organizationId: orgId,
        email,
        fullName: `${localPart} Super Admin`,
        roleId: superRole.id,
        status: "ACTIVE",
        passwordHash,
        legacySourceId: `USR-SUPER-ADMIN-${String(index + 1).padStart(3, "0")}`,
      },
    });
  }

  const controlPlaneValue = { ...controlPlane, updatedAt: new Date().toISOString() };
  await prisma.systemSetting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: "sevenfold.control_plane" } },
    update: { value: controlPlaneValue, status: "active" },
    create: {
      organizationId: orgId,
      key: "sevenfold.control_plane",
      value: controlPlaneValue,
      description: "Sevenfold Administration Control Plane defaults from business_plan rev2.",
      status: "active",
    },
  });

  await prisma.systemSetting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: "sevenfold.template_management" } },
    update: { status: "active" },
    create: {
      organizationId: orgId,
      key: "sevenfold.template_management",
      value: { templates: [] },
      description: "Sevenfold template metadata registry. Files remain in Google Drive through the GAS adapter.",
      status: "active",
    },
  });

  await prisma.frameworkVersion.upsert({
    where: { organizationId_version: { organizationId: orgId, version: "rev2.0" } },
    update: { snapshot: controlPlaneValue, status: "active", effectiveAt: new Date("2026-07-10T00:00:00.000Z") },
    create: {
      organizationId: orgId,
      version: "rev2.0",
      description: "Business plan Rev2 baseline.",
      snapshot: controlPlaneValue,
      status: "active",
      effectiveAt: new Date("2026-07-10T00:00:00.000Z"),
    },
  });

  for (const deal of controlPlane.dealTypes) {
    await prisma.dealTypeCriterion.upsert({
      where: { organizationId_code: { organizationId: orgId, code: deal.id } },
      update: { name: deal.name, criteria: deal.criteria, status: deal.status },
      create: {
        organizationId: orgId,
        code: deal.id,
        name: deal.name,
        criteria: deal.criteria,
        minValueUsd: deal.minValueUsd ? Number(deal.minValueUsd) : null,
        maxValueUsd: deal.maxValueUsd ? Number(deal.maxValueUsd) : null,
        sponsorOverride: Boolean(deal.sponsorOverride),
        status: deal.status,
      },
    });
  }

  for (const commodity of controlPlane.commodityCodes) {
    await prisma.commodityCode.upsert({
      where: { organizationId_code: { organizationId: orgId, code: commodity.code } },
      update: { name: commodity.name, description: commodity.description, status: commodity.status },
      create: { ...commodity, organizationId: orgId },
    });
  }

  for (const risk of controlPlane.riskDomains) {
    await prisma.riskDomain.upsert({
      where: { organizationId_code: { organizationId: orgId, code: risk.id } },
      update: { name: risk.name, status: risk.status },
      create: { organizationId: orgId, code: risk.id, name: risk.name, status: risk.status },
    });
  }

  for (const currency of controlPlane.currencies) {
    await prisma.currencySetting.upsert({
      where: { organizationId_code: { organizationId: orgId, code: currency.code } },
      update: { name: currency.name, status: currency.status },
      create: {
        organizationId: orgId,
        code: currency.code,
        name: currency.name,
        rateToUsd: currency.rateToUsd ? Number(currency.rateToUsd) : null,
        status: currency.status,
      },
    });
  }

  for (const matrix of controlPlane.approvalMatrices) {
    const savedMatrix = await prisma.approvalMatrix.upsert({
      where: { organizationId_workflow_decision: { organizationId: orgId, workflow: matrix.workflow, decision: matrix.decision } },
      update: { status: matrix.status },
      create: { organizationId: orgId, workflow: matrix.workflow, decision: matrix.decision, status: matrix.status },
    });
    for (const rule of controlPlane.approvalRules.filter((entry) => entry.matrixId === matrix.id)) {
      await prisma.approvalRule.upsert({
        where: { matrixId_sequence_approverRole: { matrixId: savedMatrix.id, sequence: Number(rule.sequence), approverRole: rule.approverRole } },
        update: { required: rule.required === "true", status: rule.status },
        create: {
          matrixId: savedMatrix.id,
          sequence: Number(rule.sequence),
          approverRole: rule.approverRole,
          condition: { expression: rule.condition },
          required: rule.required === "true",
          status: rule.status,
        },
      });
    }
  }

  const client = await prisma.client.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CLT-TECHBROS-001" } },
    update: { name: "TechBros Indonesia", status: "active" },
    create: { organizationId: orgId, code: "CLT-TECHBROS-001", name: "TechBros Indonesia", status: "active", legacySourceId: "CLT-TECHBROS-001" },
  });
  const project = await prisma.project.upsert({
    where: { clientId_code: { clientId: client.id, code: "PRJ-TECHBROS-RFOPT-001" } },
    update: { name: "RF Optimization Program", currency: "IDR", status: "active" },
    create: {
      clientId: client.id,
      code: "PRJ-TECHBROS-RFOPT-001",
      name: "RF Optimization Program",
      currency: "IDR",
      status: "active",
      legacySourceId: "PRJ-TECHBROS-RFOPT-001",
    },
  });
  const employee = await prisma.resource.upsert({
    where: { organizationId_legacySourceId: { organizationId: orgId, legacySourceId: "EMP-SEED-001" } },
    update: { kind: "EMPLOYEE", status: "ready_for_assignment", assignedClientLegacyId: client.code, assignedProjectLegacyId: project.code },
    create: {
      organizationId: orgId,
      kind: "EMPLOYEE",
      fullName: "Febry Test Resource",
      email: "resource.seed@example.com",
      position: "RF Optimization Engineer",
      status: "ready_for_assignment",
      contractStatus: "active",
      assignedClientLegacyId: client.code,
      assignedProjectLegacyId: project.code,
      legacySourceId: "EMP-SEED-001",
      resourceReadyAt: new Date(),
    },
  });
  await prisma.assignment.upsert({
    where: { legacySourceId: "ASN-SEED-001" },
    update: { status: "active" },
    create: {
      resourceId: employee.id,
      clientId: client.id,
      projectId: project.id,
      roleTitle: "RF Optimization Engineer",
      status: "active",
      legacySourceId: "ASN-SEED-001",
    },
  });

  console.log("Sevenfold seed completed.");
}

main()
  .finally(() => prisma.$disconnect());
