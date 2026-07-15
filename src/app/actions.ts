"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { InvoiceStatus, Prisma, ResourceKind, UserStatus } from "@prisma/client";
import * as XLSX from "xlsx";
import { calculateCashflow } from "@/lib/cashflowEngine";
import { OPPORTUNITY_WORKFLOW_TRANSITIONS } from "@/lib/opportunityWorkflow";
import { getDb } from "@/lib/db";
import { defaultFrameworkControlPlane } from "@/lib/framework-defaults";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSession } from "@/lib/session";
import type { FrameworkControlPlane } from "@/lib/types";
import { getDeliveryGovernanceRegistryForMutation, saveDeliveryGovernanceRegistry } from "@/services/deliveryGovernanceService";
import { writeAudit } from "@/services/auditService";
import { FRAMEWORK_SETTINGS_CACHE_TAG, getLatestActiveFrameworkVersion } from "@/services/frameworkSettingsService";
import { createDefaultGates, getProjectExecutionRegistryForMutation, saveProjectExecutionRegistry } from "@/services/projectExecutionService";
import { calculateRatecardRecord, fallbackFxRates, fxCacheIsFresh, getRatecardRegistryForMutation, saveRatecardRegistry } from "@/services/ratecardService";
import { getTalentPlanningRegistryForMutation, saveTalentPlanningRegistry } from "@/services/talentPlanningService";
import { getActiveTemplateSnapshot, transitionTemplate, uploadTemplate } from "@/services/templateManagementService";
import { findUserByEmail, setUserRoles } from "@/services/userService";

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

/**
 * Next.js redacts thrown Error messages from Server Actions in production
 * (client only sees a generic "Server Components render..." message + digest).
 * Actions that want their validation message to actually reach the user must
 * catch it here and return `{ error }` instead of throwing - see ActionForm's
 * ActionResult union, which already knows how to render this as the error banner.
 * `redirect()`/`notFound()` throw a special digest-tagged error that must keep
 * propagating unchanged, so those are excluded and rethrown.
 */
function isNextControlFlowSignal(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") || (error as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR"))
  );
}

function toActionError(error: unknown): { error: string } {
  if (isNextControlFlowSignal(error)) throw error;
  return { error: error instanceof Error && error.message ? error.message : "The request could not be completed. Please try again." };
}

function requireValue(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} is required`);
  }
}

function shortId() {
  return Date.now().toString(36).toUpperCase().slice(-6);
}

function generatedLegacyId(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${shortId()}`;
}

function normalizeDriveFileId(input: string) {
  const value = input.trim();
  if (!value) return "";
  if (/\/drive\/folders\//.test(value)) {
    throw new Error("Please paste a Google Drive file link, not a folder link. Open the PDF/Doc inside the folder, then copy that file link.");
  }
  const filePathMatch = value.match(/\/file\/d\/([^/?#]+)/);
  if (filePathMatch?.[1]) return filePathMatch[1];
  const queryMatch = value.match(/[?&]id=([^&#]+)/);
  if (queryMatch?.[1]) return queryMatch[1];
  const foldersMatch = value.match(/\/document\/d\/([^/?#]+)|\/presentation\/d\/([^/?#]+)|\/spreadsheets\/d\/([^/?#]+)/);
  if (foldersMatch) return foldersMatch.slice(1).find(Boolean) || value;
  return value;
}

function dateOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function moneyOrZero(value: string) {
  const parsed = Number(String(value || "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalMoney(value: string) {
  return value ? moneyOrZero(value) : null;
}

function enumUserStatus(value: string) {
  if (value === "inactive") return UserStatus.INACTIVE;
  if (value === "deleted") return UserStatus.DELETED;
  return UserStatus.ACTIVE;
}

function hoursBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100);
}

function daysBetweenInclusive(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

async function currentActor() {
  const session = await requireSignedInSession();
  const user = await findUserByEmail(session.email);
  return { session, user };
}

// Every organization-scoped service call must be given this instead of assuming an org
// context. Throws for platform-admin-only sessions, which aren't tied to one tenant.
function requireOrganizationId(actor: { organizationId: string | null } | null | undefined): string {
  if (!actor?.organizationId) {
    throw new Error("This action requires a tenant-scoped user, not a platform admin.");
  }
  return actor.organizationId;
}

async function findResourceByLegacyId(organizationId: string, legacySourceId: string, kind?: ResourceKind) {
  return getDb().resource.findFirst({ where: { organizationId, legacySourceId, ...(kind ? { kind } : {}) } });
}

async function findClientByLegacyId(organizationId: string, id: string) {
  return getDb().client.findFirst({ where: { organizationId, OR: [{ legacySourceId: id }, { code: id }] } });
}

async function findProjectByLegacyId(organizationId: string, id: string) {
  return getDb().project.findFirst({ where: { client: { organizationId }, OR: [{ legacySourceId: id }, { code: id }] } });
}

function actorRole(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  return actor?.role.code || "";
}

function actorIsSuperAdmin(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  return actorRole(actor) === "ROLE_SUPER_ADMIN";
}

function requireActorRole(actor: Awaited<ReturnType<typeof currentActor>>["user"], roles: string[]) {
  if (!actor) {
    throw new Error("Unauthorized");
  }
  if (actorIsSuperAdmin(actor)) {
    return;
  }
  if (!roles.includes(actor.role.code)) {
    throw new Error("Forbidden");
  }
}

function requireTemplateAdmin(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_TEMPLATE_ADMIN"]);
}

function requireOpportunityManager(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_SOLUTION_ARCHITECT", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
}

function requireSponsor(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_SPONSOR", "ROLE_PROGRAM_DIRECTOR"]);
}

function requireDeliveryGovernanceRole(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, [
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_PROGRAM_DIRECTOR",
    "ROLE_PROJECT_MANAGER",
    "ROLE_PROJECT_FINANCE_MANAGER",
    "ROLE_RESOURCE_MANAGER",
    "ROLE_COMMERCIAL_MANAGER",
    "ROLE_FINANCE_CONTROLLER",
    "ROLE_SPONSOR",
  ]);
}

function requireTalentPlanningRole(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_RESOURCE_MANAGER", "ROLE_SUPPLY_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_PROGRAM_DIRECTOR"]);
}

function requireRatecardRole(actor: Awaited<ReturnType<typeof currentActor>>["user"]) {
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER"]);
}

function requireEmployeeOwnershipOrRole(
  actor: Awaited<ReturnType<typeof currentActor>>["user"],
  employee: { id: string; email: string | null; assignedClientLegacyId: string | null },
  roles: string[],
) {
  if (!actor) {
    throw new Error("Unauthorized");
  }
  const ownsEmployee = actor.resourceId === employee.id || Boolean(employee.email && employee.email.toLowerCase() === actor.email.toLowerCase());
  if (actor.role.code === "ROLE_EMPLOYEE" && !ownsEmployee) {
    throw new Error("Employees can only access their own employee profile.");
  }
  if (actor.role.code === "ROLE_CLIENT_APPROVER") {
    const actorClientId = actor.client?.legacySourceId || actor.client?.code || "";
    if (!actorClientId || actorClientId !== employee.assignedClientLegacyId) {
      throw new Error("Client approver cannot access this employee.");
    }
  }
  if (actor.role.code !== "ROLE_EMPLOYEE") {
    requireActorRole(actor, roles);
  }
}

async function requireSignedInSession() {
  const session = await getSession();
  if (!session?.email) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function loginAction(formData: FormData) {
 try {
  const email = getValue(formData, "email").toLowerCase();
  const password = getValue(formData, "password");
  requireValue(email, "Email");
  requireValue(password, "Password");

  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") {
    throw new Error("Invalid email or password");
  }
  if (!user.passwordHash) {
    throw new Error("This Nexus user has no password configured. Ask Super Admin to reset the password.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new Error("Invalid email or password");
  }

  await createSession({
    email: user.email,
    username: user.email,
    name: user.fullName,
    userId: user.legacySourceId || user.id,
    roleId: user.role.code,
  });
  redirect("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function logoutAction() {
 try {
  await destroySession();
  redirect("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createUserAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);

  const tempPassword = getValue(formData, "temporary_password");
  requireValue(tempPassword, "Temporary password");
  const email = getValue(formData, "email").toLowerCase();
  const role = await getDb().role.findUnique({ where: { code: getValue(formData, "role_id") } });
  if (!role) throw new Error("Role not found");
  const clientId = getValue(formData, "client_id");
  const employeeId = getValue(formData, "employee_id");
  const client = clientId ? await findClientByLegacyId(organizationId, clientId) : null;
  const employee = employeeId ? await findResourceByLegacyId(organizationId, employeeId) : null;
  const created = await getDb().user.create({
    data: {
      organizationId,
      legacySourceId: generatedLegacyId("USR"),
      email,
      fullName: getValue(formData, "full_name"),
      roleId: role.id,
      passwordHash: await hashPassword(tempPassword),
      clientId: client?.id,
      resourceId: employee?.id,
      status: enumUserStatus(getValue(formData, "status")),
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "CREATE_USER",
    entityType: "user",
    entityId: created.legacySourceId || created.id,
    after: { email: created.email, role_id: role.code, status: created.status },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateUserAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);

  const password = getValue(formData, "temporary_password");
  const userId = getValue(formData, "user_id");
  const target = await getDb().user.findFirst({ where: { OR: [{ legacySourceId: userId }, { id: userId }] } });
  if (!target) throw new Error("User not found");
  const role = await getDb().role.findUnique({ where: { code: getValue(formData, "role_id") } });
  if (!role) throw new Error("Role not found");
  const clientId = getValue(formData, "client_id");
  const employeeId = getValue(formData, "employee_id");
  const client = clientId ? await findClientByLegacyId(organizationId, clientId) : null;
  const employee = employeeId ? await findResourceByLegacyId(organizationId, employeeId) : null;
  const updated = await getDb().user.update({
    where: { id: target.id },
    data: {
      fullName: getValue(formData, "full_name"),
      roleId: role.id,
      clientId: client?.id || null,
      resourceId: employee?.id || null,
      status: enumUserStatus(getValue(formData, "status")),
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "UPDATE_USER",
    entityType: "user",
    entityId: updated.legacySourceId || updated.id,
    before: { status: target.status },
    after: { status: updated.status, role_id: role.code },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

/**
 * Server-side gate for multi-role assignment: the "role_ids" checkbox UI in
 * UsersPanel is already hidden from other viewers, but the mutation itself must not
 * trust that - anyone who can hit this action directly must independently be
 * Super Admin / Nexus Admin / Framework Admin (or Super Admin/platform-admin bypass
 * via requireActorRole).
 */
export async function updateUserRolesAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN"]);

  const userId = getValue(formData, "user_id");
  requireValue(userId, "User");
  const target = await getDb().user.findFirst({ where: { OR: [{ legacySourceId: userId }, { id: userId }] } });
  if (!target) throw new Error("User not found");

  // Repeated `role_ids` checkbox entries (preferred) or a comma-separated fallback.
  const repeated = formData.getAll("role_ids").map((entry) => String(entry).trim()).filter(Boolean);
  const roleCodes = repeated.length ? repeated : getValue(formData, "role_ids").split(",").map((code) => code.trim()).filter(Boolean);
  if (!roleCodes.length) throw new Error("At least one role is required");

  const roles = await getDb().role.findMany({ where: { code: { in: roleCodes } } });
  const codeToId = new Map(roles.map((role) => [role.code, role.id]));
  const roleIds = roleCodes.map((code) => codeToId.get(code)).filter((id): id is string => Boolean(id));
  if (!roleIds.length) throw new Error("None of the selected roles were found");

  await setUserRoles(target.id, roleIds, actor?.id);
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function seedFrameworkControlPlaneAction() {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN"]);
  const organizationId = requireOrganizationId(actor);
  const value = { ...defaultFrameworkControlPlane(), updatedAt: new Date().toISOString() };
  const setting = await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: "sevenfold.control_plane" } },
    create: {
      organizationId,
      key: "sevenfold.control_plane",
      value,
      description: "Sevenfold Administration Control Plane defaults from business_plan rev2.",
      status: "active",
    },
    update: { value, status: "active" },
  });
  await writeAudit({ actorId: actor?.id, action: "SEED_FRAMEWORK_CONTROL_PLANE", entityType: "system_setting", entityId: setting.key, after: value, reason: "Seed defaults from business plan Rev2" });
  revalidateTag(FRAMEWORK_SETTINGS_CACHE_TAG, "max");
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function addFrameworkItemAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN"]);
  const organizationId = requireOrganizationId(actor);
  const group = getValue(formData, "group") as keyof FrameworkControlPlane;
  const current = await getFrameworkControlPlaneForAction(organizationId);
  const reason = getValue(formData, "reason") || "Admin Control Plane update";
  const approvalReference = getValue(formData, "approval_reference");
  const before = JSON.parse(JSON.stringify(current)) as FrameworkControlPlane;
  if (group === "dealTypes") {
    current.dealTypes.push({
      id: getValue(formData, "id") || getValue(formData, "name").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      name: getValue(formData, "name"),
      criteria: getValue(formData, "criteria"),
      minValueUsd: getValue(formData, "min_value_usd"),
      maxValueUsd: getValue(formData, "max_value_usd"),
      sponsorOverride: getValue(formData, "sponsor_override") === "true",
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "commodityCodes") {
    current.commodityCodes.push({
      code: getValue(formData, "code").toUpperCase(),
      name: getValue(formData, "name"),
      description: getValue(formData, "description"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "riskDomains") {
    current.riskDomains.push({
      id: getValue(formData, "id") || getValue(formData, "name").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      name: getValue(formData, "name"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "riskScoring") {
    current.riskScoring.push({
      id: getValue(formData, "id") || `${getValue(formData, "label")}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      label: getValue(formData, "label"),
      minScore: getValue(formData, "min_score"),
      maxScore: getValue(formData, "max_score"),
      severity: getValue(formData, "severity"),
      actionGuidance: getValue(formData, "action_guidance"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "gateDefinitions") {
    current.gateDefinitions.push({
      id: getValue(formData, "id") || getValue(formData, "gate_code").toLowerCase(),
      gateCode: getValue(formData, "gate_code").toUpperCase(),
      name: getValue(formData, "name"),
      description: getValue(formData, "description"),
      ownerRole: getValue(formData, "owner_role").toUpperCase(),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "gateChecklist") {
    current.gateChecklist.push({
      id: getValue(formData, "id") || `gate-check-${Date.now()}`,
      gateCode: getValue(formData, "gate_code").toUpperCase(),
      item: getValue(formData, "item"),
      mandatory: getValue(formData, "mandatory") || "true",
      evidenceType: getValue(formData, "evidence_type"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "governanceCadence") {
    current.governanceCadence.push({
      id: getValue(formData, "id") || getValue(formData, "forum").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      forum: getValue(formData, "forum"),
      cadence: getValue(formData, "cadence"),
      ownerRole: getValue(formData, "owner_role").toUpperCase(),
      audience: getValue(formData, "audience"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "ragThresholds") {
    current.ragThresholds.push({
      id: getValue(formData, "id") || getValue(formData, "metric").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      metric: getValue(formData, "metric"),
      green: getValue(formData, "green"),
      amber: getValue(formData, "amber"),
      red: getValue(formData, "red"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "currencies") {
    current.currencies.push({
      code: getValue(formData, "code").toUpperCase(),
      name: getValue(formData, "name"),
      rateToUsd: getValue(formData, "rate_to_usd"),
      updatedAt: new Date().toISOString(),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "workingHours") {
    current.workingHours.push({
      id: getValue(formData, "id") || `${getValue(formData, "country")}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      country: getValue(formData, "country"),
      timezone: getValue(formData, "timezone"),
      hoursPerDay: getValue(formData, "hours_per_day"),
      daysPerWeek: getValue(formData, "days_per_week"),
      startTime: getValue(formData, "start_time"),
      endTime: getValue(formData, "end_time"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "defaultRatecardAssumptions") {
    current.defaultRatecardAssumptions.push({
      id: getValue(formData, "id") || getValue(formData, "name").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      name: getValue(formData, "name"),
      value: getValue(formData, "value"),
      unit: getValue(formData, "unit"),
      description: getValue(formData, "description"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "documentCategories") {
    current.documentCategories.push({
      id: getValue(formData, "id") || getValue(formData, "category").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      category: getValue(formData, "category"),
      description: getValue(formData, "description"),
      retentionRule: getValue(formData, "retention_rule"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "workflowStatuses") {
    current.workflowStatuses.push({
      id: getValue(formData, "id") || `${getValue(formData, "workflow")}-${getValue(formData, "status_code")}`.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      workflow: getValue(formData, "workflow"),
      statusCode: getValue(formData, "status_code"),
      label: getValue(formData, "label"),
      terminal: getValue(formData, "terminal") || "false",
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "approvalThresholds") {
    current.approvalThresholds.push({
      id: getValue(formData, "id") || `${getValue(formData, "decision")}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      decision: getValue(formData, "decision"),
      role: getValue(formData, "role"),
      minValueUsd: getValue(formData, "min_value_usd") || "0",
      maxValueUsd: getValue(formData, "max_value_usd"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "roles") {
    current.roles.push({
      code: getValue(formData, "code").toUpperCase(),
      name: getValue(formData, "name"),
      description: getValue(formData, "description"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "permissions") {
    current.permissions.push({
      code: getValue(formData, "code"),
      name: getValue(formData, "name"),
      module: getValue(formData, "module"),
      description: getValue(formData, "description"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "rolePermissions") {
    current.rolePermissions.push({
      roleCode: getValue(formData, "role_code").toUpperCase(),
      permissionCode: getValue(formData, "permission_code"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "userAccessPolicies") {
    current.userAccessPolicies.push({
      id: getValue(formData, "id") || `access-${Date.now()}`,
      subject: getValue(formData, "subject"),
      subjectType: getValue(formData, "subject_type") || "role",
      resourceType: getValue(formData, "resource_type"),
      resourceScope: getValue(formData, "resource_scope") || "*",
      effect: getValue(formData, "effect") || "allow",
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "workflowAccessPolicies") {
    current.workflowAccessPolicies.push({
      id: getValue(formData, "id") || `workflow-access-${Date.now()}`,
      workflow: getValue(formData, "workflow"),
      roleCode: getValue(formData, "role_code").toUpperCase(),
      accessLevel: getValue(formData, "access_level"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "approvalMatrices") {
    current.approvalMatrices.push({
      id: getValue(formData, "id") || `matrix-${Date.now()}`,
      workflow: getValue(formData, "workflow"),
      decision: getValue(formData, "decision"),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "approvalRules") {
    current.approvalRules.push({
      id: getValue(formData, "id") || `rule-${Date.now()}`,
      matrixId: getValue(formData, "matrix_id"),
      sequence: getValue(formData, "sequence") || "1",
      approverRole: getValue(formData, "approver_role").toUpperCase(),
      condition: getValue(formData, "condition") || "always",
      required: getValue(formData, "required") || "true",
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "documentTemplateSettings") {
    current.documentTemplateSettings.push({
      id: getValue(formData, "id") || `template-${Date.now()}`,
      category: getValue(formData, "category"),
      documentType: getValue(formData, "document_type"),
      templateName: getValue(formData, "template_name"),
      driveFileId: normalizeDriveFileId(getValue(formData, "drive_file_id")),
      status: getValue(formData, "status") || "active",
    });
  } else if (group === "frameworkVersions") {
    current.frameworkVersions.push({
      version: getValue(formData, "version"),
      description: getValue(formData, "description"),
      effectiveAt: getValue(formData, "effective_at"),
      status: getValue(formData, "status") || "draft",
    });
  } else {
    throw new Error("Unsupported framework setting group.");
  }
  await saveFrameworkControlPlaneForAction(organizationId, current, actor?.id, `ADD_FRAMEWORK_${String(group).toUpperCase()}`, before, reason, approvalReference);
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateFrameworkControlPlaneJsonAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN"]);
  const organizationId = requireOrganizationId(actor);
  const raw = getValue(formData, "framework_json");
  const parsed = JSON.parse(raw) as FrameworkControlPlane;
  const before = await getFrameworkControlPlaneForAction(organizationId);
  await saveFrameworkControlPlaneForAction(
    organizationId,
    { ...defaultFrameworkControlPlane(), ...parsed },
    actor?.id,
    "UPDATE_FRAMEWORK_CONTROL_PLANE_JSON",
    before,
    getValue(formData, "reason") || "Advanced JSON edit",
    getValue(formData, "approval_reference"),
  );
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

async function getFrameworkControlPlaneForAction(organizationId: string) {
  const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: "sevenfold.control_plane" } } });
  return setting ? ({ ...defaultFrameworkControlPlane(), ...(setting.value as Partial<FrameworkControlPlane>) } as FrameworkControlPlane) : defaultFrameworkControlPlane();
}

async function saveFrameworkControlPlaneForAction(
  organizationId: string,
  value: FrameworkControlPlane,
  actorId: string | undefined,
  action: string,
  before?: FrameworkControlPlane,
  reason?: string,
  approvalReference?: string,
) {
  value.updatedAt = new Date().toISOString();
  const setting = await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: "sevenfold.control_plane" } },
    create: {
      organizationId,
      key: "sevenfold.control_plane",
      value,
      description: "Sevenfold Administration Control Plane configuration.",
      status: "active",
    },
    update: { value, status: "active" },
  });
  await writeAudit({ actorId, action, entityType: "system_setting", entityId: setting.key, before, after: value, reason, approvalReference });
  revalidateTag(FRAMEWORK_SETTINGS_CACHE_TAG, "max");
}

export async function createClientAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const code = getValue(formData, "client_code").toUpperCase();
  const client = await getDb().client.create({
    data: {
      organizationId,
      legacySourceId: getValue(formData, "client_id") || `CLT-${code}-${shortId()}`,
      code,
      name: getValue(formData, "client_name"),
      status: "active",
      contacts: getValue(formData, "primary_contact_name") || getValue(formData, "primary_contact_email") ? {
        create: {
          name: getValue(formData, "primary_contact_name") || "Primary Contact",
          email: getValue(formData, "primary_contact_email") || null,
          isPrimary: true,
        },
      } : undefined,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_CLIENT", entityType: "client", entityId: client.legacySourceId || client.id, after: { code, name: client.name } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createProjectAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const client = await findClientByLegacyId(organizationId, getValue(formData, "client_id"));
  if (!client) throw new Error("Client not found");
  const code = getValue(formData, "project_code").toUpperCase();
  const currency = normalizeCurrency(getValue(formData, "currency_manual") || getValue(formData, "currency") || "USD");
  const frameworkVersion = await getLatestActiveFrameworkVersion(organizationId);
  const activeTemplateSnapshot = await getActiveTemplateSnapshot(organizationId);
  const project = await getDb().project.create({
    data: {
      legacySourceId: getValue(formData, "project_id") || `PRJ-${code}-${shortId()}`,
      clientId: client.id,
      code,
      name: getValue(formData, "project_name"),
      currency,
      startDate: dateOrNull(getValue(formData, "start_date")),
      endDate: dateOrNull(getValue(formData, "end_date")),
      status: "active",
    },
  });
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.entity_framework_version.project.${project.id}` } },
    create: {
      organizationId,
      key: `sevenfold.entity_framework_version.project.${project.id}`,
      value: {
        entityType: "project",
        entityId: project.id,
        legacySourceId: project.legacySourceId,
        frameworkVersion,
        templates: activeTemplateSnapshot,
        assignedAt: new Date().toISOString(),
      },
      description: "Framework version assigned when project was created.",
      status: "active",
    },
    update: {
      value: {
        entityType: "project",
        entityId: project.id,
        legacySourceId: project.legacySourceId,
        frameworkVersion,
        templates: activeTemplateSnapshot,
        assignedAt: new Date().toISOString(),
      },
      status: "active",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_PROJECT", entityType: "project", entityId: project.legacySourceId || project.id, after: { code, name: project.name, currency, framework_version: frameworkVersion, template_versions: activeTemplateSnapshot } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function uploadTemplateAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireTemplateAdmin(actor);
  const organizationId = requireOrganizationId(actor);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Template file is required");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadTemplate({
    organizationId,
    templateName: getValue(formData, "template_name") || file.name,
    templateType: getValue(formData, "template_type"),
    documentCategory: getValue(formData, "document_category"),
    version: getValue(formData, "version") || "1.0",
    effectiveFrom: getValue(formData, "effective_from") || new Date().toISOString().slice(0, 10),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    base64: buffer.toString("base64"),
    actorEmail: session.email,
    actorId: actor?.id,
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function transitionTemplateAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireTemplateAdmin(actor);
  const organizationId = requireOrganizationId(actor);
  const action = getValue(formData, "template_action") as "review" | "approve" | "publish" | "retire";
  if (!["review", "approve", "publish", "retire"].includes(action)) {
    throw new Error("Unsupported template action");
  }
  await transitionTemplate({
    organizationId,
    templateId: getValue(formData, "template_id"),
    action,
    actorEmail: session.email,
    actorId: actor?.id,
    reason: getValue(formData, "reason") || `Template ${action}`,
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createOpportunityAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const frameworkVersion = await getLatestActiveFrameworkVersion(organizationId);
  const opportunityCode = getValue(formData, "opportunity_id") || generatedLegacyId("OPP");
  const opportunity = await getDb().opportunity.create({
    data: {
      organizationId,
      opportunityCode,
      customerName: getValue(formData, "customer_name"),
      customerSegment: getValue(formData, "customer_segment") || null,
      accountManager: getValue(formData, "owner") || actor?.email || null,
      solutionArchitect: getValue(formData, "solution_architect") || null,
      dealType: getValue(formData, "deal_type"),
      scopeSummary: getValue(formData, "scope_summary") || null,
      status: getValue(formData, "opportunity_status") || "draft",
      createdBy: actor?.email || null,
      updatedBy: actor?.email || null,
    },
  });
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.entity_framework_version.opportunity.${opportunity.id}` } },
    create: {
      organizationId,
      key: `sevenfold.entity_framework_version.opportunity.${opportunity.id}`,
      value: {
        entityType: "opportunity",
        entityId: opportunity.id,
        opportunityCode: opportunity.opportunityCode,
        frameworkVersion,
        assignedAt: new Date().toISOString(),
      },
      description: "Framework version assigned when opportunity was created.",
      status: "active",
    },
    update: {
      value: {
        entityType: "opportunity",
        entityId: opportunity.id,
        opportunityCode: opportunity.opportunityCode,
        frameworkVersion,
        assignedAt: new Date().toISOString(),
      },
      status: "active",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_OPPORTUNITY", entityType: "opportunity", entityId: opportunity.opportunityCode, after: { opportunityCode, frameworkVersion } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateOpportunityAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const opportunityCode = getValue(formData, "opportunity_id");
  const existing = await getDb().opportunity.findUnique({ where: { organizationId_opportunityCode: { organizationId, opportunityCode } } });
  if (!existing) throw new Error("Opportunity not found");
  const updated = await getDb().opportunity.update({
    where: { id: existing.id },
    data: {
      customerName: getValue(formData, "customer_name"),
      customerSegment: getValue(formData, "customer_segment") || null,
      accountManager: getValue(formData, "owner") || existing.accountManager,
      solutionArchitect: getValue(formData, "solution_architect") || null,
      dealType: getValue(formData, "deal_type"),
      scopeSummary: getValue(formData, "scope_summary") || null,
      status: getValue(formData, "opportunity_status") || existing.status,
      updatedBy: actor?.email || null,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_OPPORTUNITY", entityType: "opportunity", entityId: updated.opportunityCode, before: existing, after: updated });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function transitionOpportunityStatusAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const opportunityCode = getValue(formData, "opportunity_id");
  const workflowAction = getValue(formData, "workflow_action");
  requireValue(opportunityCode, "Opportunity ID");
  requireValue(workflowAction, "Workflow action");

  const opportunity = await getDb().opportunity.findUnique({
    where: { organizationId_opportunityCode: { organizationId, opportunityCode } },
    include: { scenarios: true, pricingDecisions: true, cashflowOptions: true },
  });
  if (!opportunity) throw new Error("Opportunity not found");

  const transition = (OPPORTUNITY_WORKFLOW_TRANSITIONS[opportunity.status] || []).find((item) => item.action === workflowAction);
  if (!transition) {
    throw new Error(`This action is not available while the opportunity is in "${opportunity.status.replaceAll("_", " ")}" status.`);
  }
  requireActorRole(actor, transition.roles);

  // Entry criteria per target status.
  if (transition.to === "submitted" && opportunity.scenarios.length === 0) {
    throw new Error("Add at least one proposal scenario before submitting the opportunity for review.");
  }
  if (transition.to === "pricing_approved" && !opportunity.pricingDecisions.some((decision) => decision.status === "approved")) {
    throw new Error("An approved Pricing Structure Decision is required before pricing can be approved. Record it under Pricing Decision first.");
  }
  if (transition.to === "approved" && !opportunity.cashflowOptions.some((option) => option.status === "approved")) {
    throw new Error("An approved cashflow option is required before final opportunity approval. Approve one under Cashflow Analysis first.");
  }

  const updated = await getDb().opportunity.update({
    where: { id: opportunity.id },
    data: { status: transition.to, updatedBy: actor?.email || null },
  });
  await writeAudit({
    actorId: actor?.id,
    action: `OPPORTUNITY_${workflowAction.toUpperCase()}`,
    entityType: "opportunity",
    entityId: updated.opportunityCode,
    before: { status: opportunity.status },
    after: { status: updated.status, comment: getValue(formData, "comment") || undefined },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function cloneOpportunityAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const sourceCode = getValue(formData, "source_opportunity_id");
  const source = await getDb().opportunity.findUnique({
    where: { organizationId_opportunityCode: { organizationId, opportunityCode: sourceCode } },
    include: { scenarios: { include: { commodityLines: true } }, risks: true, pricingDecisions: true },
  });
  if (!source) throw new Error("Source opportunity not found");
  const frameworkVersion = await getLatestActiveFrameworkVersion(organizationId);
  const cloneCode = getValue(formData, "new_opportunity_id") || generatedLegacyId("OPP");
  const clone = await getDb().opportunity.create({
    data: {
      organizationId,
      opportunityCode: cloneCode,
      customerName: getValue(formData, "customer_name") || source.customerName,
      customerSegment: source.customerSegment,
      accountManager: actor?.email || source.accountManager,
      solutionArchitect: source.solutionArchitect,
      dealType: source.dealType,
      scopeSummary: source.scopeSummary,
      status: "draft",
      createdBy: actor?.email || null,
      updatedBy: actor?.email || null,
    },
  });
  for (const scenario of source.scenarios) {
    const clonedScenario = await getDb().proposalScenario.create({
      data: {
        opportunityId: clone.id,
        scenarioCode: `${scenario.scenarioCode}-CLONE`.slice(0, 64),
        name: scenario.name,
        description: scenario.description,
        currency: scenario.currency,
        totalCost: scenario.totalCost,
        totalPrice: scenario.totalPrice,
        grossMargin: scenario.grossMargin,
        status: "draft",
      },
    });
    for (const line of scenario.commodityLines) {
      await getDb().proposalCommodityLine.create({
        data: {
          scenarioId: clonedScenario.id,
          commodityCode: line.commodityCode,
          description: line.description,
          quantity: line.quantity,
          unitCost: line.unitCost,
          unitPrice: line.unitPrice,
          resourceCost: line.resourceCost,
          partnerCost: line.partnerCost,
          procurementCost: line.procurementCost,
          projectCost: line.projectCost,
        },
      });
    }
  }
  for (const risk of source.risks) {
    await getDb().riskRegister.create({
      data: {
        opportunityId: clone.id,
        riskCode: `${risk.riskCode}-CLONE`.slice(0, 64),
        domain: risk.domain,
        commodityCode: risk.commodityCode,
        description: risk.description,
        probabilityScore: risk.probabilityScore,
        impactCost: risk.impactCost,
        mitigationPlan: risk.mitigationPlan,
        mitigationCost: risk.mitigationCost,
        residualExposure: risk.residualExposure,
        riskCostAfterMitigation: risk.riskCostAfterMitigation,
        predictedOccurrenceDate: risk.predictedOccurrenceDate,
        severity: risk.severity,
        status: "open",
      },
    });
  }
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.entity_framework_version.opportunity.${clone.id}` } },
    create: {
      organizationId,
      key: `sevenfold.entity_framework_version.opportunity.${clone.id}`,
      value: { entityType: "opportunity", entityId: clone.id, opportunityCode: clone.opportunityCode, frameworkVersion, clonedFrom: source.opportunityCode, assignedAt: new Date().toISOString() },
      description: "Framework version assigned when opportunity was cloned.",
      status: "active",
    },
    update: { value: { entityType: "opportunity", entityId: clone.id, opportunityCode: clone.opportunityCode, frameworkVersion, clonedFrom: source.opportunityCode, assignedAt: new Date().toISOString() }, status: "active" },
  });
  await writeAudit({ actorId: actor?.id, action: "CLONE_OPPORTUNITY", entityType: "opportunity", entityId: clone.opportunityCode, before: { source: source.opportunityCode }, after: { clone: clone.opportunityCode, frameworkVersion } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createProposalScenarioAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_SOLUTION_ARCHITECT", "ROLE_ACCOUNT_MANAGER", "ROLE_COMMERCIAL_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getDb().opportunity.findUnique({ where: { organizationId_opportunityCode: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } } });
  if (!opportunity) throw new Error("Opportunity not found");
  const scenario = await getDb().proposalScenario.create({
    data: {
      opportunityId: opportunity.id,
      scenarioCode: getValue(formData, "scenario_id") || `SCN-${shortId()}`,
      name: getValue(formData, "scenario_name"),
      description: getValue(formData, "description") || null,
      currency: getValue(formData, "currency") || "USD",
      status: getValue(formData, "status") || "draft",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_PROPOSAL_SCENARIO", entityType: "proposal_scenario", entityId: scenario.scenarioCode, after: { opportunity: opportunity.opportunityCode } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateProposalScenarioAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_SOLUTION_ARCHITECT", "ROLE_ACCOUNT_MANAGER", "ROLE_COMMERCIAL_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const scenarioCode = getValue(formData, "scenario_id");
  const opportunityCode = getValue(formData, "opportunity_id");
  const scenario = await getDb().proposalScenario.findFirst({
    where: { scenarioCode, opportunity: { organizationId, opportunityCode } },
  });
  if (!scenario) throw new Error(`Scenario not found: "${scenarioCode}" under opportunity "${opportunityCode}". Check the scenario ID belongs to this opportunity and organization.`);
  // Status intentionally not editable here - "selected" is only ever set via
  // createPricingDecisionAction's commercial-scenario flow; letting a plain edit
  // override that would silently break pricing decisions tied to the scenario.
  const updated = await getDb().proposalScenario.update({
    where: { id: scenario.id },
    data: {
      name: getValue(formData, "scenario_name"),
      description: getValue(formData, "description") || null,
      currency: getValue(formData, "currency") || scenario.currency,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_PROPOSAL_SCENARIO", entityType: "proposal_scenario", entityId: updated.scenarioCode, before: scenario, after: updated });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createCommodityCostLineAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireOpportunityManager(actor);
  const organizationId = requireOrganizationId(actor);
  const scenarioCode = getValue(formData, "scenario_id");
  const opportunityCode = getValue(formData, "opportunity_id");
  const scenario = await getDb().proposalScenario.findFirst({
    where: { scenarioCode, opportunity: { organizationId, opportunityCode } },
    include: { commodityLines: true },
  });
  if (!scenario) throw new Error(`Scenario not found: "${scenarioCode}" under opportunity "${opportunityCode}". Check the scenario ID belongs to this opportunity and organization.`);
  await getDb().proposalCommodityLine.create({
    data: {
      scenarioId: scenario.id,
      commodityCode: getValue(formData, "commodity_code"),
      description: getValue(formData, "description") || null,
      quantity: moneyOrZero(getValue(formData, "quantity") || "1"),
      unitCost: moneyOrZero(getValue(formData, "unit_cost")),
      unitPrice: moneyOrZero(getValue(formData, "unit_price")),
      resourceCost: moneyOrZero(getValue(formData, "resource_cost")),
      partnerCost: moneyOrZero(getValue(formData, "partner_cost")),
      procurementCost: moneyOrZero(getValue(formData, "procurement_cost")),
      projectCost: moneyOrZero(getValue(formData, "project_cost")),
    },
  });
  const lines = await getDb().proposalCommodityLine.findMany({ where: { scenarioId: scenario.id } });
  const totalCost = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost) + Number(line.resourceCost) + Number(line.partnerCost) + Number(line.procurementCost) + Number(line.projectCost), 0);
  const totalPrice = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
  await getDb().proposalScenario.update({
    where: { id: scenario.id },
    data: {
      totalCost,
      totalPrice,
      grossMargin: totalPrice ? (totalPrice - totalCost) / totalPrice : null,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "ADD_COMMODITY_COST_LINE", entityType: "proposal_scenario", entityId: scenario.scenarioCode, after: { totalCost, totalPrice } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createOpportunityRiskAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireOpportunityManager(actor);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getDb().opportunity.findUnique({ where: { organizationId_opportunityCode: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } } });
  if (!opportunity) throw new Error("Opportunity not found");
  const exposureBefore = moneyOrZero(getValue(formData, "exposure_before_mitigation"));
  const mitigationCost = moneyOrZero(getValue(formData, "mitigation_cost"));
  const exposureAfter = getValue(formData, "exposure_after_mitigation") ? moneyOrZero(getValue(formData, "exposure_after_mitigation")) : Math.max(0, exposureBefore - mitigationCost);
  const risk = await getDb().riskRegister.create({
    data: {
      opportunityId: opportunity.id,
      riskCode: getValue(formData, "risk_id") || `RSK-${shortId()}`,
      domain: getValue(formData, "risk_domain"),
      commodityCode: getValue(formData, "linked_commodity") || null,
      description: getValue(formData, "risk_title"),
      probabilityScore: moneyOrZero(getValue(formData, "probability")),
      impactCost: moneyOrZero(getValue(formData, "impact") || getValue(formData, "exposure_before_mitigation")),
      mitigationPlan: getValue(formData, "mitigation_plan") || null,
      mitigationCost,
      residualExposure: exposureAfter,
      riskCostAfterMitigation: exposureAfter,
      predictedOccurrenceDate: dateOrNull(getValue(formData, "predicted_occurrence_date")),
      severity: getValue(formData, "severity") || null,
      status: getValue(formData, "status") || "open",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_OPPORTUNITY_RISK", entityType: "risk_register", entityId: risk.riskCode, after: { opportunity: opportunity.opportunityCode, exposureAfter } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createPricingDecisionAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getDb().opportunity.findUnique({ where: { organizationId_opportunityCode: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } } });
  if (!opportunity) throw new Error("Opportunity not found");
  const scenario = getValue(formData, "scenario_id")
    ? await getDb().proposalScenario.findFirst({ where: { opportunityId: opportunity.id, scenarioCode: getValue(formData, "scenario_id") } })
    : null;
  const decision = await getDb().pricingDecision.create({
    data: {
      opportunityId: opportunity.id,
      scenarioId: scenario?.id || null,
      decision: getValue(formData, "decision"),
      comment: getValue(formData, "comment") || null,
      status: getValue(formData, "status") || "draft",
    },
  });
  if (scenario && getValue(formData, "mark_commercial_scenario") === "true") {
    await getDb().proposalScenario.updateMany({ where: { opportunityId: opportunity.id }, data: { status: "draft" } });
    await getDb().proposalScenario.update({ where: { id: scenario.id }, data: { status: "selected" } });
  }
  await writeAudit({ actorId: actor?.id, action: "CREATE_PRICING_DECISION", entityType: "pricing_decision", entityId: decision.id, after: { opportunity: opportunity.opportunityCode, decision: decision.decision } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createCashflowOptionAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  // Account Manager can submit a cashflow option for approval (owns the deal),
  // but approval itself stays with Commercial Manager/admin roles + Sponsor -
  // see approveCashflowOptionAction. Keeps creation and sign-off separated.
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER", "ROLE_ACCOUNT_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getApprovedOpportunityForCashflow(organizationId, getValue(formData, "opportunity_id"));
  const grossInvoice = moneyOrZero(getValue(formData, "gross_invoice"));
  const discountAmount = moneyOrZero(getValue(formData, "incentive_discount"));
  const withholdingTax = moneyOrZero(getValue(formData, "withholding_tax"));
  const costAmount = moneyOrZero(getValue(formData, "cost_timing_amount"));
  const dsoDays = Number(getValue(formData, "dso_days") || 30);
  const invoiceDate = dateOrNull(getValue(formData, "invoice_date")) || new Date();
  const costDate = dateOrNull(getValue(formData, "cost_date")) || undefined;
  const discountRatePercent = getValue(formData, "discount_rate_percent") ? moneyOrZero(getValue(formData, "discount_rate_percent")) : undefined;
  const calculation = calculateCashflow({
    invoiceDate,
    dsoDays,
    grossInvoice,
    discountAmount,
    withholdingTax,
    costAmount,
    costDate,
    discountRatePercent,
  });
  const option = await getDb().cashflowOption.create({
    data: {
      opportunityId: opportunity.id,
      optionCode: getValue(formData, "option_id") || `CFO-${shortId()}`,
      name: getValue(formData, "option_name"),
      currency: getValue(formData, "currency") || "USD",
      dsoDays,
      grossInvoice,
      discountAmount,
      withholdingTax,
      cashGap: calculation.cashGap,
      marginAmount: calculation.marginAmount,
      npv: calculation.npv,
      calculation: calculation as unknown as Prisma.InputJsonValue,
      status: "draft",
    },
  });
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.cashflow_option_detail.${option.id}` } },
    create: {
      organizationId,
      key: `sevenfold.cashflow_option_detail.${option.id}`,
      value: cashflowDetailFromForm(formData, option.id),
      description: "Cashflow milestone, invoice schedule, timing, and formula metadata.",
      status: "active",
    },
    update: { value: cashflowDetailFromForm(formData, option.id), status: "active" },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_CASHFLOW_OPTION", entityType: "cashflow_option", entityId: option.optionCode, after: { opportunity: opportunity.opportunityCode, cashGap: calculation.cashGap, marginAmount: calculation.marginAmount, npv: calculation.npv } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateCashflowOptionAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  // Matches createCashflowOptionAction's allowed roles - the Account Manager who
  // creates an unapproved option must also be able to edit it before sign-off.
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_FINANCE_CONTROLLER", "ROLE_ACCOUNT_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const option = await getDb().cashflowOption.findFirst({
    where: { optionCode: getValue(formData, "option_id"), opportunity: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } },
  });
  if (!option) throw new Error("Cashflow option not found");
  if (option.status === "approved") {
    throw new Error("This cashflow option is already approved. Create a new option instead of editing an approved one.");
  }
  const grossInvoice = moneyOrZero(getValue(formData, "gross_invoice"));
  const discountAmount = moneyOrZero(getValue(formData, "incentive_discount"));
  const withholdingTax = moneyOrZero(getValue(formData, "withholding_tax"));
  const costAmount = moneyOrZero(getValue(formData, "cost_timing_amount"));
  const dsoDays = Number(getValue(formData, "dso_days") || option.dsoDays);
  const invoiceDate = dateOrNull(getValue(formData, "invoice_date")) || new Date();
  const costDate = dateOrNull(getValue(formData, "cost_date")) || undefined;
  const discountRatePercent = getValue(formData, "discount_rate_percent") ? moneyOrZero(getValue(formData, "discount_rate_percent")) : undefined;
  const calculation = calculateCashflow({
    invoiceDate,
    dsoDays,
    grossInvoice,
    discountAmount,
    withholdingTax,
    costAmount,
    costDate,
    discountRatePercent,
  });
  const updated = await getDb().cashflowOption.update({
    where: { id: option.id },
    data: {
      name: getValue(formData, "option_name") || option.name,
      currency: getValue(formData, "currency") || option.currency,
      dsoDays,
      grossInvoice,
      discountAmount,
      withholdingTax,
      cashGap: calculation.cashGap,
      marginAmount: calculation.marginAmount,
      npv: calculation.npv,
      calculation: calculation as unknown as Prisma.InputJsonValue,
    },
  });
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.cashflow_option_detail.${option.id}` } },
    create: {
      organizationId,
      key: `sevenfold.cashflow_option_detail.${option.id}`,
      value: cashflowDetailFromForm(formData, option.id),
      description: "Cashflow milestone, invoice schedule, timing, and formula metadata.",
      status: "active",
    },
    update: { value: cashflowDetailFromForm(formData, option.id), status: "active" },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_CASHFLOW_OPTION", entityType: "cashflow_option", entityId: updated.optionCode, before: option, after: { cashGap: calculation.cashGap, marginAmount: calculation.marginAmount, npv: calculation.npv } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function approveCashflowOptionAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  // Sponsor added alongside the existing Commercial Manager/admin approvers so
  // Account Manager's newly-created cashflow options (see createCashflowOptionAction)
  // have a real approval path without Account Manager approving their own submission.
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_COMMERCIAL_MANAGER", "ROLE_SPONSOR"]);
  const organizationId = requireOrganizationId(actor);
  const option = await getDb().cashflowOption.findFirst({
    where: { optionCode: getValue(formData, "option_id"), opportunity: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } },
    include: { opportunity: true },
  });
  if (!option) throw new Error("Cashflow option not found");
  const updated = await getDb().cashflowOption.update({
    where: { id: option.id },
    data: { status: getValue(formData, "decision") || "approved", approvedBy: actor?.email || getValue(formData, "approver"), approvedAt: new Date() },
  });
  await writeAudit({ actorId: actor?.id, action: "APPROVE_CASHFLOW_OPTION", entityType: "cashflow_option", entityId: option.optionCode, before: option, after: updated, reason: getValue(formData, "comments") || `${actor?.role.code || "Approver"} approval` });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createSdsAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getDb().opportunity.findUnique({
    where: { organizationId_opportunityCode: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } },
    include: {
      cashflowOptions: true,
      pricingDecisions: true,
      scenarios: { include: { commodityLines: true } },
      risks: true,
    },
  });
  if (!opportunity) throw new Error("Opportunity not found");
  if (!opportunity.cashflowOptions.some((option) => option.status === "approved")) {
    const statuses = opportunity.cashflowOptions.map((option) => `${option.optionCode} (${option.status})`).join(", ") || "none created yet";
    throw new Error(`Approved cashflow option is required before SDS. Opportunity ${opportunity.opportunityCode} has: ${statuses}. Approve one under Cashflow Analysis first.`);
  }
  const dealType = String(opportunity.dealType || "").toLowerCase();
  const presenterRole = getValue(formData, "presenter_role");
  if (["high", "very high"].includes(dealType) && presenterRole !== "Program Director") {
    throw new Error("High/Very High deals require Program Director as presenter.");
  }
  // Everything derivable from the opportunity/scenario/risk/cashflow/pricing records is
  // computed here, not typed by hand — see business_plan.md's complaint that SDS forced
  // re-entering information that already existed on the opportunity.
  const derived = deriveSdsSummary(opportunity);
  const sds = await getDb().salesDecisionSubmission.create({
    data: {
      opportunityId: opportunity.id,
      customerValue: getValue(formData, "business_value_notes") || null,
      companyValue: getValue(formData, "company_value") || null,
      upsellOpportunity: getValue(formData, "upsell_opportunity") || null,
      growthAspect: getValue(formData, "growth_aspect") || null,
      selectedScenario: derived.selectedScenarioCode,
      selectedCashflow: derived.selectedCashflowCode,
      deliveryCapability: getValue(formData, "delivery_capability_notes") || null,
      decision: "pending",
      comment: getValue(formData, "comments") || null,
    },
  });
  const summaryValue = {
    sdsId: sds.id,
    ...derived,
    presenterRole,
    presenterName: getValue(formData, "presenter_name"),
    pptExplanation: "Offline only. PPT is not generated automatically.",
    updatedAt: new Date().toISOString(),
  };
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: `sevenfold.sds_summary.${sds.id}` } },
    create: { organizationId, key: `sevenfold.sds_summary.${sds.id}`, value: summaryValue, description: "SDS summary and presenter metadata.", status: "active" },
    update: { value: summaryValue, status: "active" },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_SDS", entityType: "sds", entityId: sds.id, after: { opportunity: opportunity.opportunityCode, presenterRole } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

type OpportunityForSdsDerivation = Prisma.OpportunityGetPayload<{
  include: { cashflowOptions: true; pricingDecisions: true; scenarios: { include: { commodityLines: true } }; risks: true };
}>;

function deriveSdsSummary(opportunity: OpportunityForSdsDerivation) {
  const selectedScenario = opportunity.scenarios.find((scenario) => scenario.status === "selected") || opportunity.scenarios[0];
  const approvedCashflow = [...opportunity.cashflowOptions]
    .filter((option) => option.status === "approved")
    .sort((a, b) => (b.approvedAt?.getTime() || 0) - (a.approvedAt?.getTime() || 0))[0];
  const approvedPricing = [...opportunity.pricingDecisions]
    .filter((decision) => decision.status === "approved")
    .sort((a, b) => (b.approvedAt?.getTime() || 0) - (a.approvedAt?.getTime() || 0))[0];

  const opportunityOutcome = `Customer: ${opportunity.customerName}${opportunity.customerSegment ? ` (${opportunity.customerSegment})` : ""}. `
    + `Deal type: ${opportunity.dealType || "unspecified"}. Opportunity status: ${opportunity.status}. `
    + `Scope: ${opportunity.scopeSummary || "not recorded"}.`;

  const commodityBreakdown = selectedScenario
    ? (selectedScenario.commodityLines.length
        ? `Scenario ${selectedScenario.scenarioCode}: ${selectedScenario.commodityLines
            .map((line) => `${line.commodityCode} x${line.quantity} (cost ${line.unitCost}, price ${line.unitPrice})`)
            .join("; ")}. Total cost ${selectedScenario.totalCost}, total price ${selectedScenario.totalPrice}, gross margin ${selectedScenario.grossMargin ?? "n/a"}.`
        : `Scenario ${selectedScenario.scenarioCode} has no commodity lines recorded.`)
    : "No proposal scenario selected on this opportunity.";

  const sortedRisks = [...opportunity.risks].sort((a, b) => Number(b.riskCostAfterMitigation) - Number(a.riskCostAfterMitigation));
  const riskSummary = sortedRisks.length
    ? `${sortedRisks.length} risk(s) registered. Top exposure: "${sortedRisks[0].description}" (${sortedRisks[0].domain}, residual exposure ${sortedRisks[0].riskCostAfterMitigation} after mitigation).`
    : "No risks registered on this opportunity.";

  const cashflowCalc = approvedCashflow?.calculation as { discountRatePercent?: number; breakEvenDate?: string | null; workingCapitalDays?: number } | null;
  const cashflowOutcome = approvedCashflow
    ? `Option ${approvedCashflow.optionCode} approved: cash gap ${approvedCashflow.cashGap}, margin ${approvedCashflow.marginAmount}, NPV ${approvedCashflow.npv ?? "n/a"}`
      + (cashflowCalc?.discountRatePercent !== undefined ? ` at ${cashflowCalc.discountRatePercent}% discount rate` : "")
      + `, break-even ${cashflowCalc?.breakEvenDate || "not reached"}, working capital ${cashflowCalc?.workingCapitalDays ?? "n/a"} days.`
    : "No approved cashflow option.";

  const pricingStructureDecision = approvedPricing
    ? `${approvedPricing.decision}${approvedPricing.comment ? ` — ${approvedPricing.comment}` : ""}`
    : "No approved pricing decision.";

  return {
    opportunityOutcome,
    commodityBreakdown,
    riskSummary,
    cashflowOutcome,
    pricingStructureDecision,
    selectedScenarioCode: selectedScenario?.scenarioCode || "",
    selectedCashflowCode: approvedCashflow?.optionCode || "",
  };
}

export async function decideSdsAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireSponsor(actor);
  const organizationId = requireOrganizationId(actor);
  const sds = await getDb().salesDecisionSubmission.findFirst({ where: { id: getValue(formData, "sds_id"), opportunity: { organizationId } } });
  if (!sds) throw new Error("SDS not found");
  const updated = await getDb().salesDecisionSubmission.update({
    where: { id: sds.id },
    data: { decision: getValue(formData, "decision"), sponsor: actor?.email || getValue(formData, "approver"), decidedAt: new Date(), comment: getValue(formData, "comments") || null },
  });
  await writeAudit({ actorId: actor?.id, action: "DECIDE_SDS", entityType: "sds", entityId: sds.id, before: sds, after: updated, reason: getValue(formData, "comments") });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createSdoaAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_CONTRACT_LEGAL", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const opportunity = await getDb().opportunity.findUnique({
    where: { organizationId_opportunityCode: { organizationId, opportunityCode: getValue(formData, "opportunity_id") } },
    include: { sdsApprovals: true },
  });
  if (!opportunity) throw new Error("Opportunity not found");
  if (!opportunity.sdsApprovals.some((sds) => sds.decision === "approved")) throw new Error("Approved SDS is required before SDOA.");
  const sdoa = await getDb().orderAcknowledgement.create({
    data: {
      opportunityId: opportunity.id,
      receivedPoNumber: getValue(formData, "received_po_number") || null,
      contractDocumentId: normalizeDriveFileId(getValue(formData, "contract_document_id")) || null,
      outcome: "pending",
      comment: getValue(formData, "comments") || null,
    },
  });
  const categories = ["value", "scope", "timeline", "payment_terms", "delivery_obligations", "legal_commercial", "customer_requirements", "price_delta", "scope_delta", "schedule_delta", "cashflow_delta", "risk_delta", "contract_legal_delta"];
  for (const category of categories) {
    const baseline = getValue(formData, `${category}_baseline`);
    const received = getValue(formData, `${category}_received`);
    const decision = getValue(formData, `${category}_decision`) || "aligned";
    if (baseline || received || decision !== "aligned") {
      await getDb().contractDeviation.create({
        data: {
          orderAcknowledgementId: sdoa.id,
          category,
          baselineValue: baseline || null,
          receivedValue: received || null,
          decision,
          comment: getValue(formData, `${category}_comment`) || null,
        },
      });
    }
  }
  await writeAudit({ actorId: actor?.id, action: "CREATE_SDOA", entityType: "sdoa", entityId: sdoa.id, after: { opportunity: opportunity.opportunityCode, po: sdoa.receivedPoNumber } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function decideSdoaAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireSponsor(actor);
  const organizationId = requireOrganizationId(actor);
  const sdoa = await getDb().orderAcknowledgement.findFirst({ where: { id: getValue(formData, "sdoa_id"), opportunity: { organizationId } }, include: { deviations: true } });
  if (!sdoa) throw new Error("SDOA not found");
  const decision = getValue(formData, "decision");
  if (["rejected", "returned"].includes(decision) && !getValue(formData, "comments")) {
    throw new Error("Reject/return requires reason.");
  }
  const updated = await getDb().orderAcknowledgement.update({
    where: { id: sdoa.id },
    data: { outcome: decision, sponsor: actor?.email || getValue(formData, "approver"), decidedAt: new Date(), comment: getValue(formData, "comments") || null },
  });
  await writeAudit({ actorId: actor?.id, action: "DECIDE_SDOA", entityType: "sdoa", entityId: sdoa.id, before: sdoa, after: updated, reason: getValue(formData, "comments") });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createExecutionProjectFromSdoaAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const sdoaId = getValue(formData, "linked_sdoa_id");
  // Opportunity, customer, and the approved SDS are all determined by the SDOA the user
  // picked - derived here instead of asking the user to retype IDs the system already knows.
  const sdoaRecord = await getDb().orderAcknowledgement.findFirst({
    where: { id: sdoaId, opportunity: { organizationId } },
    include: { opportunity: { include: { sdsApprovals: true } } },
  });
  if (!sdoaRecord || !["acknowledged", "approved", "accepted"].includes(sdoaRecord.outcome)) {
    throw new Error("Project can only be created from an approved or acknowledged SDOA.");
  }
  const approvedSds = [...sdoaRecord.opportunity.sdsApprovals]
    .filter((sds) => sds.decision === "approved")
    .sort((a, b) => (b.decidedAt?.getTime() || 0) - (a.decidedAt?.getTime() || 0))[0];
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const projectId = getValue(formData, "project_id") || generatedLegacyId("PRJ");
  if (registry.projects.some((project) => project.projectId === projectId)) {
    throw new Error("Project ID already exists.");
  }
  const frameworkVersion = await getLatestActiveFrameworkVersion(organizationId);
  const currency = normalizeCurrency(getValue(formData, "currency_manual") || getValue(formData, "currency") || "USD");
  const templateSnapshot = await getActiveTemplateSnapshot(organizationId);
  const now = new Date().toISOString();
  const project = {
    projectId,
    linkedOpportunityId: sdoaRecord.opportunity.opportunityCode,
    linkedSdsId: approvedSds?.id || "",
    linkedSdoaId: sdoaId,
    customer: sdoaRecord.opportunity.customerName,
    sponsor: getValue(formData, "sponsor"),
    projectLeader: getValue(formData, "project_leader"),
    projectFinanceManager: getValue(formData, "project_finance_manager"),
    resourceManager: getValue(formData, "resource_manager"),
    contractLegalOwner: getValue(formData, "contract_legal_owner"),
    commercialOwner: getValue(formData, "commercial_owner"),
    currency,
    frameworkVersion,
    templateVersionSet: JSON.stringify(templateSnapshot.map((template) => ({ id: template.templateId, type: template.templateType, version: template.version }))),
    milestonePlan: getValue(formData, "milestone_plan"),
    siteClusterConfiguration: getValue(formData, "site_cluster_configuration"),
    deliveryBaseline: getValue(formData, "delivery_baseline"),
    financialBaseline: getValue(formData, "financial_baseline"),
    governanceCadence: getValue(formData, "governance_cadence"),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await saveProjectExecutionRegistry(organizationId, {
    ...registry,
    projects: [project, ...registry.projects],
    gates: [...createDefaultGates(projectId, actor?.email || ""), ...registry.gates],
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_PROJECT_FROM_APPROVED_SDOA", entityType: "project_execution", entityId: projectId, after: project });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateProjectGateAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR"]);
  const organizationId = requireOrganizationId(actor);
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const gateId = getValue(formData, "gate_id");
  const nextGates = registry.gates.map((gate) => gate.gateId === gateId ? {
    ...gate,
    checklist: getValue(formData, "checklist"),
    mandatoryChecklistComplete: getValue(formData, "mandatory_checklist_complete") || "false",
    requiredInput: getValue(formData, "required_input"),
    requiredOutput: getValue(formData, "required_output"),
    requiredDocumentTemplate: getValue(formData, "required_document_template"),
    ragStatus: getValue(formData, "rag_status") || "green",
    issues: getValue(formData, "issues"),
    risks: getValue(formData, "risks"),
    approvalStatus: "requested",
    initiatedBy: actor?.email || "",
    updatedAt: new Date().toISOString(),
  } : gate);
  const updatedGate = nextGates.find((gate) => gate.gateId === gateId);
  if (!updatedGate) throw new Error("Gate not found.");
  await saveProjectExecutionRegistry(organizationId, { ...registry, gates: nextGates });
  await writeAudit({ actorId: actor?.id, action: "REQUEST_PROJECT_GATE_APPROVAL", entityType: "project_gate", entityId: gateId, after: updatedGate });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function decideProjectGateAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireSponsor(actor);
  const organizationId = requireOrganizationId(actor);
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const gateId = getValue(formData, "gate_id");
  const decision = getValue(formData, "decision");
  const nextGates = registry.gates.map((gate) => {
    if (gate.gateId !== gateId) return gate;
    if (decision === "approved" && gate.mandatoryChecklistComplete !== "true" && getValue(formData, "sponsor_exception") !== "true") {
      throw new Error("Gate cannot move forward while mandatory checklist is missing unless Sponsor approves exception.");
    }
    return {
      ...gate,
      approvalStatus: decision,
      approvedBy: actor?.email || "",
      approvedAt: new Date().toISOString(),
      decision,
      comments: getValue(formData, "comments"),
      sponsorException: getValue(formData, "sponsor_exception") || "false",
      updatedAt: new Date().toISOString(),
    };
  });
  const updatedGate = nextGates.find((gate) => gate.gateId === gateId);
  if (!updatedGate) throw new Error("Gate not found.");
  await saveProjectExecutionRegistry(organizationId, { ...registry, gates: nextGates });
  await writeAudit({ actorId: actor?.id, action: "DECIDE_PROJECT_GATE", entityType: "project_gate", entityId: gateId, after: updatedGate, reason: getValue(formData, "comments") });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function upsertSiteHandlerAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_FINANCE_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const siteClusterId = getValue(formData, "site_cluster_id");
  const site = {
    siteClusterId,
    projectId: getValue(formData, "project_id"),
    scopePackage: getValue(formData, "scope_package"),
    plannedDate: getValue(formData, "planned_date"),
    actualDate: getValue(formData, "actual_date"),
    progressStatus: getValue(formData, "progress_status") || "planned",
    acceptanceStatus: getValue(formData, "acceptance_status") || "pending",
    acceptanceCertificateDocument: normalizeDriveFileId(getValue(formData, "acceptance_certificate_document")),
    goodReceiptDocument: normalizeDriveFileId(getValue(formData, "good_receipt_document")),
    invoiceStatus: getValue(formData, "invoice_status") || "not_invoiced",
    invoiceDocument: normalizeDriveFileId(getValue(formData, "invoice_document")),
    handoverStatus: getValue(formData, "handover_status") || "pending",
    acceptedScopeValue: getValue(formData, "accepted_scope_value") || "0",
    updatedAt: new Date().toISOString(),
  };
  const sites = [site, ...registry.sites.filter((item) => !(item.projectId === site.projectId && item.siteClusterId === site.siteClusterId))];
  await saveProjectExecutionRegistry(organizationId, { ...registry, sites });
  await writeAudit({ actorId: actor?.id, action: "UPSERT_SITE_HANDLER", entityType: "site_handler", entityId: `${site.projectId}:${site.siteClusterId}`, after: site });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function upsertProjectResourceDemandAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR", "ROLE_RESOURCE_MANAGER", "ROLE_HR_ADMIN", "ROLE_HR_ADMINISTRATOR"]);
  const organizationId = requireOrganizationId(actor);
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const demandId = getValue(formData, "demand_id") || generatedLegacyId("RDEM");
  const demand = {
    demandId,
    projectId: getValue(formData, "project_id"),
    projectDemand: getValue(formData, "project_demand"),
    requiredRole: getValue(formData, "required_role"),
    requiredSkill: getValue(formData, "required_skill"),
    location: getValue(formData, "location"),
    startDate: getValue(formData, "start_date"),
    endDate: getValue(formData, "end_date"),
    allocationPercent: getValue(formData, "allocation_percent") || "100",
    assignedResource: getValue(formData, "assigned_resource"),
    gapStatus: getValue(formData, "gap_status") || "open_gap",
    onboardingStatus: getValue(formData, "onboarding_status") || "not_started",
    timesheetReadiness: getValue(formData, "timesheet_readiness") || "not_ready",
    resourceRisk: getValue(formData, "resource_risk"),
    replacementPlan: getValue(formData, "replacement_plan"),
    status: getValue(formData, "status") || "active",
    updatedAt: new Date().toISOString(),
  };
  requireValue(demand.projectId, "Project");
  requireValue(demand.requiredRole, "Required role");
  const resourceDemands = [demand, ...registry.resourceDemands.filter((item) => item.demandId !== demandId)];
  await saveProjectExecutionRegistry(organizationId, { ...registry, resourceDemands });
  await writeAudit({ actorId: actor?.id, action: "UPSERT_PROJECT_RESOURCE_DEMAND", entityType: "project_resource_demand", entityId: demandId, after: demand });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function upsertCommercialProcurementFlowAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROCUREMENT_MANAGER", "ROLE_FINANCE_CONTROLLER"]);
  const organizationId = requireOrganizationId(actor);
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const flowId = getValue(formData, "flow_id") || generatedLegacyId("CPF");
  const flow = {
    flowId,
    projectId: getValue(formData, "project_id"),
    siteClusterId: getValue(formData, "site_cluster_id"),
    acceptedMilestone: getValue(formData, "accepted_milestone"),
    purchaseRequest: getValue(formData, "purchase_request"),
    purchaseOrder: getValue(formData, "purchase_order"),
    supplierVendor: getValue(formData, "supplier_vendor"),
    customerPo: getValue(formData, "customer_po"),
    invoice: getValue(formData, "invoice"),
    invoiceItem: getValue(formData, "invoice_item"),
    invoiceStatus: getValue(formData, "invoice_status") || "draft",
    paymentStatus: getValue(formData, "payment_status") || "unpaid",
    grStatus: getValue(formData, "gr_status") || "pending",
    grDocument: normalizeDriveFileId(getValue(formData, "gr_document")),
    customerPoDocument: normalizeDriveFileId(getValue(formData, "customer_po_document")),
    invoiceDocument: normalizeDriveFileId(getValue(formData, "invoice_document")),
    documentAttachment: normalizeDriveFileId(getValue(formData, "document_attachment")),
    approvalStatus: getValue(formData, "approval_status") || "draft",
    status: getValue(formData, "status") || "active",
    updatedAt: new Date().toISOString(),
  };
  requireValue(flow.projectId, "Project");
  const commercialFlows = [flow, ...registry.commercialFlows.filter((item) => item.flowId !== flowId)];
  await saveProjectExecutionRegistry(organizationId, { ...registry, commercialFlows });
  await writeAudit({ actorId: actor?.id, action: "UPSERT_COMMERCIAL_PROCUREMENT_FLOW", entityType: "commercial_procurement_flow", entityId: flowId, after: flow });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function decideCommercialProcurementFlowAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_SPONSOR", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_FINANCE_MANAGER", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROCUREMENT_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const flowId = getValue(formData, "flow_id");
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const before = registry.commercialFlows.find((item) => item.flowId === flowId);
  if (!before) throw new Error("Commercial/procurement flow not found");
  const updated = { ...before, approvalStatus: getValue(formData, "approval_status") || "approved", approvedBy: session.email, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveProjectExecutionRegistry(organizationId, { ...registry, commercialFlows: registry.commercialFlows.map((item) => item.flowId === flowId ? updated : item) });
  await writeAudit({ actorId: actor?.id, action: "DECIDE_COMMERCIAL_PROCUREMENT_FLOW", entityType: "commercial_procurement_flow", entityId: flowId, before, after: updated, reason: getValue(formData, "comments") });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function importSiteListExcelAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_PROGRAM_DIRECTOR", "ROLE_PROJECT_FINANCE_MANAGER"]);
  const organizationId = requireOrganizationId(actor);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Site list Excel file is required");
  const registry = await getProjectExecutionRegistryForMutation(organizationId);
  const rows = workbookRows(await file.arrayBuffer());
  const sites = rows.map((row) => ({
    siteClusterId: cell(row, "site/cluster id") || cell(row, "site_cluster_id"),
    projectId: cell(row, "project id") || cell(row, "project_id"),
    scopePackage: cell(row, "scope package") || cell(row, "scope_package"),
    plannedDate: cell(row, "planned date") || cell(row, "planned_date"),
    actualDate: cell(row, "actual date") || cell(row, "actual_date"),
    progressStatus: cell(row, "progress status") || cell(row, "progress_status") || "planned",
    acceptanceStatus: cell(row, "acceptance status") || cell(row, "acceptance_status") || "pending",
    acceptanceCertificateDocument: normalizeDriveFileId(cell(row, "acceptance certificate document") || cell(row, "acceptance_certificate_document")),
    goodReceiptDocument: normalizeDriveFileId(cell(row, "good receipt document") || cell(row, "good_receipt_document")),
    invoiceStatus: cell(row, "invoice status") || cell(row, "invoice_status") || "not_invoiced",
    invoiceDocument: normalizeDriveFileId(cell(row, "invoice document") || cell(row, "invoice_document")),
    handoverStatus: cell(row, "handover status") || cell(row, "handover_status") || "pending",
    acceptedScopeValue: cell(row, "accepted scope value") || cell(row, "accepted_scope_value") || "0",
    updatedAt: new Date().toISOString(),
  })).filter((row) => row.projectId && row.siteClusterId);
  const existing = registry.sites.filter((site) => !sites.some((row) => row.projectId === site.projectId && row.siteClusterId === site.siteClusterId));
  await saveProjectExecutionRegistry(organizationId, { ...registry, sites: [...sites, ...existing] });
  await writeAudit({ actorId: actor?.id, action: "IMPORT_SITE_LIST_EXCEL", entityType: "site_handler", entityId: file.name, after: { imported: sites.length } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

async function getApprovedOpportunityForCashflow(organizationId: string, opportunityCode: string) {
  const opportunity = await getDb().opportunity.findUnique({
    where: { organizationId_opportunityCode: { organizationId, opportunityCode } },
    include: { pricingDecisions: true },
  });
  if (!opportunity) throw new Error("Opportunity not found");
  const allowedStatus = ["approved", "ready_for_cashflow", "pricing_approved", "submitted"].includes(opportunity.status);
  const approvedPricing = opportunity.pricingDecisions.some((decision) => decision.status === "approved");
  if (!allowedStatus && !approvedPricing) {
    throw new Error("Only approved Opportunity IDs can enter Cashflow Analysis.");
  }
  return opportunity;
}

function cashflowDetailFromForm(formData: FormData, optionId: string) {
  return {
    optionId,
    formula: "cashImpact = revenueTimingAmount - incentiveDiscount - withholdingTax - costTimingAmount; marginImpact = grossInvoice - incentiveDiscount - withholdingTax - costTimingAmount",
    milestoneDefinition: getValue(formData, "milestone_definition"),
    invoiceSchedule: getValue(formData, "invoice_schedule"),
    paymentTerms: getValue(formData, "payment_terms"),
    revenueTiming: getValue(formData, "revenue_timing"),
    revenueTimingAmount: getValue(formData, "revenue_timing_amount"),
    costTiming: getValue(formData, "cost_timing"),
    costTimingAmount: getValue(formData, "cost_timing_amount"),
    updatedAt: new Date().toISOString(),
  };
}

export async function createCandidateAction(formData: FormData) {
 try {
  const session = await requireSignedInSession();
  const actor = await findUserByEmail(session.email);
  const organizationId = requireOrganizationId(actor);
  const fullName = getValue(formData, "full_name");
  const email = getValue(formData, "email").toLowerCase();
  const position = getValue(formData, "position_applied");
  requireValue(fullName, "Full name");
  requireValue(email, "Email");
  requireValue(position, "Position applied");

  const candidate = await getDb().resource.create({
    data: {
      organizationId,
      legacySourceId: generatedLegacyId("CAND"),
      kind: ResourceKind.CANDIDATE,
      fullName,
      email,
      phone: getValue(formData, "phone") || null,
      assignedClientLegacyId: getValue(formData, "client_id") || null,
      assignedProjectLegacyId: getValue(formData, "project_id") || null,
      position,
      candidateStage: "CREATED",
      status: "active",
      cvDriveLink: getValue(formData, "cv_drive_link") || null,
      commercialNotes: [
        getValue(formData, "skill_category") ? `Skill: ${getValue(formData, "skill_category")}` : "",
        getValue(formData, "experience_level") ? `Experience: ${getValue(formData, "experience_level")}` : "",
      ].filter(Boolean).join("; ") || null,
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "CREATE_CANDIDATE",
    entityType: "candidate",
    entityId: candidate.legacySourceId || candidate.id,
    after: {
      candidate_id: candidate.legacySourceId,
      full_name: candidate.fullName,
      email: candidate.email,
      position_applied: candidate.position,
      status: candidate.status,
    },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function submitCandidateAction(formData: FormData) {
 try {
  const session = await requireSignedInSession();
  const actor = await findUserByEmail(session.email);
  const candidateId = getValue(formData, "candidate_id");
  const clientId = getValue(formData, "client_id");
  const projectId = getValue(formData, "project_id");
  requireValue(candidateId, "Candidate");
  requireValue(clientId, "Client");
  requireValue(projectId, "Project");

  const db = getDb();
  const [candidate, client, project] = await Promise.all([
    db.resource.findFirst({ where: { legacySourceId: candidateId, kind: ResourceKind.CANDIDATE } }),
    db.client.findFirst({ where: { OR: [{ legacySourceId: clientId }, { code: clientId }] } }),
    db.project.findFirst({ where: { OR: [{ legacySourceId: projectId }, { code: projectId }] } }),
  ]);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);
  if (!client) throw new Error(`Client not found: ${clientId}`);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const updated = await db.resource.update({
    where: { id: candidate.id },
    data: {
      assignedClientLegacyId: client.legacySourceId || client.code,
      assignedProjectLegacyId: project.legacySourceId || project.code,
      candidateStage: "SUBMITTED_TO_CLIENT",
      status: "submitted_to_client",
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "SUBMIT_CANDIDATE_TO_CLIENT",
    entityType: "candidate",
    entityId: updated.legacySourceId || updated.id,
    before: {
      candidate_id: candidate.legacySourceId,
      client_id: candidate.assignedClientLegacyId,
      project_id: candidate.assignedProjectLegacyId,
      status: candidate.status,
      interview_status: candidate.candidateStage,
    },
    after: {
      candidate_id: updated.legacySourceId,
      client_id: updated.assignedClientLegacyId,
      project_id: updated.assignedProjectLegacyId,
      status: updated.status,
      interview_status: updated.candidateStage,
    },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateCandidateAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  if (!["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN"].includes(actor?.role.code || "")) {
    throw new Error("Only admin roles can edit candidates.");
  }
  const organizationId = requireOrganizationId(actor);
  const candidateId = getValue(formData, "candidate_id");
  const candidate = await findResourceByLegacyId(organizationId, candidateId, ResourceKind.CANDIDATE);
  if (!candidate) throw new Error("Candidate not found");
  const updated = await getDb().resource.update({
    where: { id: candidate.id },
    data: {
      fullName: getValue(formData, "full_name"),
      email: getValue(formData, "email").toLowerCase(),
      phone: getValue(formData, "phone") || null,
      position: getValue(formData, "position_applied"),
      assignedClientLegacyId: getValue(formData, "client_id") || null,
      assignedProjectLegacyId: getValue(formData, "project_id") || null,
      candidateStage: getValue(formData, "interview_status") || candidate.candidateStage,
      status: getValue(formData, "status") || candidate.status,
      commercialNotes: [
        getValue(formData, "skill_category") ? `Skill: ${getValue(formData, "skill_category")}` : "",
        getValue(formData, "experience_level") ? `Experience: ${getValue(formData, "experience_level")}` : "",
      ].filter(Boolean).join("; ") || candidate.commercialNotes,
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "UPDATE_CANDIDATE",
    entityType: "candidate",
    entityId: updated.legacySourceId || updated.id,
    before: { full_name: candidate.fullName, status: candidate.status },
    after: { full_name: updated.fullName, status: updated.status },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function submitFeedbackAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const decision = getValue(formData, "decision");
  const candidateId = getValue(formData, "candidate_id");
  const clientId = getValue(formData, "client_id");
  const projectId = getValue(formData, "project_id");
  const candidate = await findResourceByLegacyId(organizationId, candidateId, ResourceKind.CANDIDATE);
  const client = await findClientByLegacyId(organizationId, clientId);
  const project = projectId ? await findProjectByLegacyId(organizationId, projectId) : null;
  if (!candidate || !client) throw new Error("Candidate or client not found");
  if (decision === "REJECTED") requireValue(getValue(formData, "rejection_reason"), "Rejection reason");
  const feedback = await getDb().clientFeedback.create({
    data: {
      legacySourceId: generatedLegacyId("FDB"),
      candidateId: candidate.id,
      clientId: client.id,
      projectId: project?.id,
      reviewerUserId: actor?.legacySourceId || actor?.id,
      rating: Number(getValue(formData, "overall_rating") || 0) || null,
      decision,
      comment: getValue(formData, "comment"),
      rejectionReason: getValue(formData, "rejection_reason") || null,
      status: "active",
    },
  });
  await getDb().resource.update({
    where: { id: candidate.id },
    data: {
      candidateStage: decision === "PROCEED" ? "PROCEED" : decision,
      status: decision === "PROCEED" ? "proceed" : decision.toLowerCase(),
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "SUBMIT_CLIENT_FEEDBACK",
    entityType: "candidate",
    entityId: candidate.legacySourceId || candidate.id,
    after: { feedback_id: feedback.legacySourceId, decision },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function startOnboardingFromCandidateAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const candidateId = getValue(formData, "candidate_id");
  const candidate = await findResourceByLegacyId(organizationId, candidateId, ResourceKind.CANDIDATE);
  if (!candidate) throw new Error("Candidate not found");
  if (!["proceed", "onboarding_in_progress", "onboarded"].includes(candidate.status)) {
    throw new Error("Candidate must be PROCEED before onboarding");
  }
  const existing = await getDb().resource.findFirst({
    where: { organizationId, kind: ResourceKind.EMPLOYEE, OR: [{ sourceCandidateLegacyId: candidate.legacySourceId }, { email: candidate.email }] },
  });
  const employee = existing || await getDb().resource.create({
    data: {
      organizationId,
      legacySourceId: generatedLegacyId("EMP"),
      kind: ResourceKind.EMPLOYEE,
      sourceCandidateLegacyId: candidate.legacySourceId,
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      position: candidate.position,
      assignedClientLegacyId: candidate.assignedClientLegacyId,
      assignedProjectLegacyId: candidate.assignedProjectLegacyId,
      contractStatus: "PENDING",
      status: "onboarding_in_progress",
    },
  });
  await getDb().resource.updateMany({
    where: { id: { in: [candidate.id, employee.id] } },
    data: { status: "onboarding_in_progress" },
  });
  await writeAudit({ actorId: actor?.id, action: "START_RESOURCE_ONBOARDING", entityType: "employee", entityId: employee.legacySourceId || employee.id, after: { candidate_id: candidateId } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function markOnboardingStepAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employeeId = getValue(formData, "employee_id");
  const step = getValue(formData, "step");
  const employee = await findResourceByLegacyId(organizationId, employeeId, ResourceKind.EMPLOYEE);
  if (!employee) throw new Error("Employee not found");
  const now = new Date();
  const data: Record<string, Date | string> = {};
  if (["nda", "ethics", "privacy", "training"].includes(step)) {
    requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_HR_ADMIN"]);
  }
  if (step === "nda") {
    data.ndaAcknowledgedAt = now;
  }
  if (step === "ethics") {
    data.codeOfEthicsAcknowledgedAt = now;
  }
  if (step === "privacy") {
    data.dataPrivacyConsentAcknowledgedAt = now;
  }
  if (step === "training") {
    data.onboardingTrainingCompletedAt = now;
  }
  if (step === "ready") {
    requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_CLIENT_APPROVER"]);
    if (!["ROLE_CLIENT_APPROVER", "ROLE_SUPER_ADMIN"].includes(actor?.role.code || "")) {
      throw new Error("Only client approver can confirm resource ready.");
    }
    if (!employee.ndaAcknowledgedAt || !employee.codeOfEthicsAcknowledgedAt || !employee.dataPrivacyConsentAcknowledgedAt || !employee.onboardingTrainingCompletedAt) {
      throw new Error("Complete NDA, Code of Ethics, Data Privacy Consent, and training first.");
    }
    data.resourceReadyAt = now;
    data.status = "ready_for_assignment";
  }
  const updated = await getDb().resource.update({ where: { id: employee.id }, data });
  if (step === "ready" && employee.sourceCandidateLegacyId) {
    await getDb().resource.updateMany({ where: { legacySourceId: employee.sourceCandidateLegacyId }, data: { status: "onboarded" } });
  }
  await writeAudit({
    actorId: actor?.id,
    action: `ONBOARDING_${step.toUpperCase()}`,
    entityType: "employee",
    entityId: updated.legacySourceId || updated.id,
    metadata: {
      acknowledged_at: now.toISOString(),
      acknowledged_by_email: session.email,
      employee_id: updated.legacySourceId || updated.id,
      step,
    },
  });

  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateEmployeeCommercialAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employee = await findResourceByLegacyId(organizationId, getValue(formData, "employee_id"), ResourceKind.EMPLOYEE);
  if (!employee) throw new Error("Employee not found");
  const clientBillRate = moneyOrZero(getValue(formData, "client_bill_rate"));
  const managementFeeRate = moneyOrZero(getValue(formData, "management_fee_rate") || "15");
  const baseSalary = moneyOrZero(getValue(formData, "base_salary"));
  const allowance = moneyOrZero(getValue(formData, "allowance_amount"));
  const gross = moneyOrZero(getValue(formData, "gross_monthly_salary")) || baseSalary + allowance;
  const pph21 = getValue(formData, "tax_type") !== "PPH23" ? optionalMoney(getValue(formData, "pph21_amount")) : null;
  const pph23 = getValue(formData, "tax_type") === "PPH23" ? optionalMoney(getValue(formData, "pph23_amount")) : null;
  const updated = await getDb().resource.update({
    where: { id: employee.id },
    data: {
      contractStatus: getValue(formData, "contract_status"),
      contractType: getValue(formData, "contract_type"),
      contractNumber: getValue(formData, "contract_number"),
      contractStartDate: dateOrNull(getValue(formData, "contract_start_date")),
      contractEndDate: dateOrNull(getValue(formData, "contract_end_date")),
      baseSalary,
      allowanceAmount: allowance,
      grossMonthlySalary: gross,
      dailyRate: optionalMoney(getValue(formData, "daily_rate")),
      hourlyRate: optionalMoney(getValue(formData, "hourly_rate")),
      clientBillRate,
      managementFeeRate,
      managementFeeAmount: optionalMoney(getValue(formData, "management_fee_amount")) ?? clientBillRate * (managementFeeRate / 100),
      recruitmentFee: optionalMoney(getValue(formData, "recruitment_fee")),
      taxType: getValue(formData, "tax_type") || "PPH21",
      taxRate: optionalMoney(getValue(formData, "tax_rate")),
      pph21Amount: pph21,
      pph23Amount: pph23,
      bpjsKesehatanRate: optionalMoney(getValue(formData, "bpjs_kesehatan_rate")),
      bpjsKesehatanAmount: optionalMoney(getValue(formData, "bpjs_kesehatan_amount")),
      bpjsTkRate: optionalMoney(getValue(formData, "bpjs_tk_rate")),
      bpjsTkAmount: optionalMoney(getValue(formData, "bpjs_tk_amount")),
      netPayEstimate: gross - (pph21 || 0) - (pph23 || 0) - moneyOrZero(getValue(formData, "bpjs_kesehatan_amount")) - moneyOrZero(getValue(formData, "bpjs_tk_amount")),
      invoiceAmountEstimate: clientBillRate + (clientBillRate * (managementFeeRate / 100)) + moneyOrZero(getValue(formData, "recruitment_fee")),
      commercialNotes: getValue(formData, "commercial_notes"),
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_EMPLOYEE_COMMERCIAL", entityType: "employee", entityId: updated.legacySourceId || updated.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createDocumentMetadataAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  if (!["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN"].includes(actor?.role.code || "")) {
    throw new Error("Only Super Admin or Nexus Admin can manage document metadata.");
  }
  const organizationId = requireOrganizationId(actor);
  const driveFileId = normalizeDriveFileId(getValue(formData, "drive_file_id"));
  requireValue(driveFileId, "Drive file ID");
  const doc = await getDb().document.upsert({
    where: { driveFileId },
    update: {
      entityType: getValue(formData, "entity_type"),
      entityId: getValue(formData, "entity_id"),
      documentType: getValue(formData, "document_type"),
      fileName: getValue(formData, "file_name"),
      updatedBy: actor?.email,
      status: "active",
    },
    create: {
      organizationId,
      legacySourceId: generatedLegacyId("DOC"),
      driveFileId,
      entityType: getValue(formData, "entity_type"),
      entityId: getValue(formData, "entity_id"),
      documentType: getValue(formData, "document_type"),
      fileName: getValue(formData, "file_name"),
      mimeType: "application/octet-stream",
      createdBy: actor?.email,
      status: "active",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_DOCUMENT_METADATA", entityType: "document", entityId: doc.legacySourceId || doc.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateDocumentMetadataAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  if (!["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN"].includes(actor?.role.code || "")) {
    throw new Error("Only Super Admin or Nexus Admin can manage document metadata.");
  }
  const documentId = getValue(formData, "document_id");
  const existing = await getDb().document.findFirst({
    where: { OR: [{ legacySourceId: documentId }, { id: documentId }] },
  });
  if (!existing) throw new Error("Document not found");
  const driveFileId = normalizeDriveFileId(getValue(formData, "drive_file_id"));
  requireValue(driveFileId, "Drive file ID");
  const updated = await getDb().document.update({
    where: { id: existing.id },
    data: {
      driveFileId,
      entityType: getValue(formData, "entity_type"),
      entityId: getValue(formData, "entity_id"),
      documentType: getValue(formData, "document_type"),
      fileName: getValue(formData, "file_name"),
      updatedBy: actor?.email,
      status: getValue(formData, "status") || "active",
    },
  });
  await writeAudit({
    actorId: actor?.id,
    action: "UPDATE_DOCUMENT_METADATA",
    entityType: "document",
    entityId: updated.legacySourceId || updated.id,
    before: { file_name: existing.fileName, drive_file_id: existing.driveFileId },
    after: { file_name: updated.fileName, drive_file_id: updated.driveFileId },
  });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createTimesheetAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employee = await findResourceByLegacyId(organizationId, getValue(formData, "employee_id"), ResourceKind.EMPLOYEE);
  if (!employee) throw new Error("Employee not found");
  requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_HR_ADMIN", "ROLE_PAYROLL_ADMIN_OPS"]);
  const assignmentId = getValue(formData, "assignment_id");
  const assignment = assignmentId ? await getDb().assignment.findFirst({ where: { OR: [{ legacySourceId: assignmentId }, { id: assignmentId }] } }) : null;
  const start = dateOrNull(getValue(formData, "period_start"));
  const end = dateOrNull(getValue(formData, "period_end"));
  const timesheet = await getDb().timesheet.create({
    data: {
      legacySourceId: generatedLegacyId("TS"),
      resourceId: employee.id,
      assignmentId: assignment?.id,
      periodStart: start,
      periodEnd: end,
      totalHours: hoursBetween(start, end),
      submittedAt: new Date(),
      status: "submitted",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_TIMESHEET", entityType: "timesheet", entityId: timesheet.legacySourceId || timesheet.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateTimesheetStatusAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const id = getValue(formData, "timesheet_id");
  const existing = await getDb().timesheet.findFirst({ where: { OR: [{ legacySourceId: id }, { id }] } });
  if (!existing) throw new Error("Timesheet not found");
  const updated = await getDb().timesheet.update({
    where: { id: existing.id },
    data: {
      nexusReviewStatus: getValue(formData, "nexus_review_status"),
      clientApprovalStatus: getValue(formData, "client_approval_status"),
      rejectionReason: getValue(formData, "rejection_reason") || null,
      status: getValue(formData, "status"),
      lockedAt: getValue(formData, "status") === "approved" ? new Date() : null,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_TIMESHEET_STATUS", entityType: "timesheet", entityId: updated.legacySourceId || updated.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createOvertimeRequestAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employee = await findResourceByLegacyId(organizationId, getValue(formData, "employee_id"), ResourceKind.EMPLOYEE);
  if (!employee) throw new Error("Employee not found");
  requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_HR_ADMIN", "ROLE_PAYROLL_ADMIN_OPS"]);
  const assignmentId = getValue(formData, "assignment_id");
  const assignment = assignmentId ? await getDb().assignment.findFirst({ where: { OR: [{ legacySourceId: assignmentId }, { id: assignmentId }] } }) : null;
  const start = dateOrNull(getValue(formData, "start_at"));
  const end = dateOrNull(getValue(formData, "end_at"));
  const overtime = await getDb().overtimeRequest.create({
    data: {
      legacySourceId: generatedLegacyId("OT"),
      resourceId: employee.id,
      assignmentId: assignment?.id,
      requestDate: start,
      startAt: start,
      endAt: end,
      hours: hoursBetween(start, end),
      reason: getValue(formData, "reason"),
      status: "submitted",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_OVERTIME_REQUEST", entityType: "overtime", entityId: overtime.legacySourceId || overtime.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateOvertimeStatusAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const id = getValue(formData, "overtime_id");
  const existing = await getDb().overtimeRequest.findFirst({ where: { OR: [{ legacySourceId: id }, { id }] } });
  if (!existing) throw new Error("Overtime request not found");
  const updated = await getDb().overtimeRequest.update({
    where: { id: existing.id },
    data: {
      nexusValidationStatus: getValue(formData, "nexus_validation_status"),
      clientApprovalStatus: getValue(formData, "client_approval_status"),
      rejectionReason: getValue(formData, "rejection_reason") || null,
      status: getValue(formData, "status"),
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_OVERTIME_STATUS", entityType: "overtime", entityId: updated.legacySourceId || updated.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createLeaveRequestAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employee = await findResourceByLegacyId(organizationId, getValue(formData, "employee_id"), ResourceKind.EMPLOYEE);
  if (!employee) throw new Error("Employee not found");
  requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_HR_ADMIN"]);
  const assignmentId = getValue(formData, "assignment_id");
  const assignment = assignmentId ? await getDb().assignment.findFirst({ where: { OR: [{ legacySourceId: assignmentId }, { id: assignmentId }] } }) : null;
  const start = dateOrNull(getValue(formData, "start_date"));
  const end = dateOrNull(getValue(formData, "end_date"));
  const leave = await getDb().leaveRequest.create({
    data: {
      legacySourceId: generatedLegacyId("LV"),
      resourceId: employee.id,
      assignmentId: assignment?.id,
      leaveType: getValue(formData, "leave_type"),
      startDate: start,
      endDate: end,
      totalDays: moneyOrZero(getValue(formData, "total_days")) || daysBetweenInclusive(start, end),
      reason: getValue(formData, "reason"),
      status: "submitted",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_LEAVE_REQUEST", entityType: "leave", entityId: leave.legacySourceId || leave.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createProjectApplicationAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const employee = await findResourceByLegacyId(organizationId, getValue(formData, "employee_id"), ResourceKind.EMPLOYEE);
  const project = await findProjectByLegacyId(organizationId, getValue(formData, "project_id"));
  if (!employee || !project) throw new Error("Employee or project not found");
  requireEmployeeOwnershipOrRole(actor, employee, ["ROLE_HR_ADMIN"]);
  const application = await getDb().projectApplication.create({
    data: {
      legacySourceId: generatedLegacyId("APP"),
      resourceId: employee.id,
      projectId: project.id,
      roleInterest: getValue(formData, "role_interest"),
      availabilityDate: dateOrNull(getValue(formData, "availability_date")),
      notes: getValue(formData, "notes"),
      status: "submitted",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_PROJECT_APPLICATION", entityType: "project_application", entityId: application.legacySourceId || application.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function updateLeaveStatusAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const id = getValue(formData, "leave_id");
  const existing = await getDb().leaveRequest.findFirst({ where: { OR: [{ legacySourceId: id }, { id }] } });
  if (!existing) throw new Error("Leave request not found");
  const updated = await getDb().leaveRequest.update({
    where: { id: existing.id },
    data: {
      hrReviewStatus: getValue(formData, "hr_review_status"),
      clientApprovalStatus: getValue(formData, "client_approval_status"),
      timesheetImpact: getValue(formData, "timesheet_impact") || null,
      rejectionReason: getValue(formData, "rejection_reason") || null,
      status: getValue(formData, "status"),
    },
  });
  await writeAudit({ actorId: actor?.id, action: "UPDATE_LEAVE_STATUS", entityType: "leave", entityId: updated.legacySourceId || updated.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createGrRecordAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const client = await findClientByLegacyId(organizationId, getValue(formData, "client_id"));
  const project = getValue(formData, "project_id") ? await findProjectByLegacyId(organizationId, getValue(formData, "project_id")) : null;
  if (!client) throw new Error("Client not found");
  const gr = await getDb().grRecord.create({
    data: {
      legacySourceId: generatedLegacyId("GR"),
      clientId: client.id,
      projectId: project?.id,
      periodMonth: getValue(formData, "period_month"),
      workSummary: getValue(formData, "work_summary"),
      approvedTimesheetIds: getValue(formData, "approved_timesheet_ids"),
      serviceAcceptanceStatus: getValue(formData, "service_acceptance_status") || "DRAFT",
      status: "active",
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_GR_RECORD", entityType: "gr_record", entityId: gr.legacySourceId || gr.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createInvoiceDraftAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  const organizationId = requireOrganizationId(actor);
  const client = await findClientByLegacyId(organizationId, getValue(formData, "client_id"));
  const project = getValue(formData, "project_id") ? await findProjectByLegacyId(organizationId, getValue(formData, "project_id")) : null;
  const grId = getValue(formData, "gr_id");
  const gr = grId ? await getDb().grRecord.findFirst({ where: { OR: [{ legacySourceId: grId }, { id: grId }] } }) : null;
  if (!client) throw new Error("Client not found");
  const subtotal = moneyOrZero(getValue(formData, "subtotal"));
  const tax = moneyOrZero(getValue(formData, "tax_amount"));
  const management = moneyOrZero(getValue(formData, "management_fee_amount"));
  const recruitment = moneyOrZero(getValue(formData, "recruitment_fee"));
  const total = moneyOrZero(getValue(formData, "total_amount")) || subtotal + tax + management + recruitment;
  const invoice = await getDb().invoice.create({
    data: {
      legacySourceId: generatedLegacyId("INV"),
      grRecordId: gr?.id,
      clientId: client.id,
      projectId: project?.id,
      invoiceNumber: getValue(formData, "invoice_number") || `INV-${shortId()}`,
      invoiceDate: dateOrNull(getValue(formData, "invoice_date")),
      dueDate: dateOrNull(getValue(formData, "due_date")),
      currency: normalizeCurrency(getValue(formData, "currency_manual") || getValue(formData, "currency") || project?.currency || "USD"),
      subtotal,
      taxAmount: tax,
      managementFeeAmount: management,
      recruitmentFeeAmount: recruitment,
      totalAmount: total,
      status: InvoiceStatus.DRAFT,
    },
  });
  await writeAudit({ actorId: actor?.id, action: "CREATE_INVOICE_DRAFT", entityType: "invoice", entityId: invoice.legacySourceId || invoice.id });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createChangeRequestAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireDeliveryGovernanceRole(actor);
  const organizationId = requireOrganizationId(actor);
  const projectId = getValue(formData, "project_id");
  requireValue(projectId, "Project");
  const now = new Date().toISOString();
  const registry = await getDeliveryGovernanceRegistryForMutation(organizationId);
  const record = {
    crId: getValue(formData, "cr_id") || generatedLegacyId("CR"),
    projectId,
    title: getValue(formData, "cr_title"),
    description: getValue(formData, "description"),
    reason: getValue(formData, "reason"),
    scopeImpact: getValue(formData, "scope_impact"),
    scheduleImpact: getValue(formData, "schedule_impact"),
    costImpact: getValue(formData, "cost_impact"),
    revenueImpact: getValue(formData, "revenue_impact"),
    additionalBudget: String(moneyOrZero(getValue(formData, "additional_budget"))),
    addOnSalesValue: String(moneyOrZero(getValue(formData, "add_on_sales_value"))),
    riskImpact: getValue(formData, "risk_impact"),
    documentAttachment: normalizeDriveFileId(getValue(formData, "document_attachment")),
    approvalStatus: getValue(formData, "approval_status") || "pending_sponsor",
    createdBy: session.email,
    createdAt: now,
    updatedAt: now,
  };
  requireValue(record.title, "CR title");
  registry.changeRequests = [record, ...registry.changeRequests.filter((cr) => cr.crId !== record.crId)];
  await saveDeliveryGovernanceRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "CREATE_CHANGE_REQUEST", entityType: "change_request", entityId: record.crId, after: record });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function decideChangeRequestAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireSponsor(actor);
  const organizationId = requireOrganizationId(actor);
  const crId = getValue(formData, "cr_id");
  const decision = getValue(formData, "decision");
  if (!["approved", "rejected", "returned"].includes(decision)) throw new Error("Unsupported CR decision");
  const governanceRegistry = await getDeliveryGovernanceRegistryForMutation(organizationId);
  const before = governanceRegistry.changeRequests.find((cr) => cr.crId === crId);
  if (!before) throw new Error("Change request not found");
  const updated = {
    ...before,
    approvalStatus: decision,
    approvedBy: session.email,
    approvedAt: new Date().toISOString(),
    decisionComments: getValue(formData, "comments"),
    updatedAt: new Date().toISOString(),
  };
  governanceRegistry.changeRequests = governanceRegistry.changeRequests.map((cr) => (cr.crId === crId ? updated : cr));
  await saveDeliveryGovernanceRegistry(organizationId, governanceRegistry);
  if (decision === "approved") {
    const executionRegistry = await getProjectExecutionRegistryForMutation(organizationId);
    executionRegistry.projects = executionRegistry.projects.map((project) => project.projectId === updated.projectId ? {
      ...project,
      deliveryBaseline: [project.deliveryBaseline, updated.scopeImpact, updated.scheduleImpact].filter(Boolean).join("\n"),
      financialBaseline: [project.financialBaseline, updated.costImpact, updated.revenueImpact].filter(Boolean).join("\n"),
      additionalBudget: String(Number(project.additionalBudget || 0) + Number(updated.additionalBudget || 0)),
      additionalRevenue: String(Number(project.additionalRevenue || 0) + Number(updated.addOnSalesValue || 0)),
      updatedAt: new Date().toISOString(),
    } : project);
    await saveProjectExecutionRegistry(organizationId, executionRegistry);
  }
  await writeAudit({ actorId: actor?.id, action: "DECIDE_CHANGE_REQUEST", entityType: "change_request", entityId: crId, before, after: updated, reason: getValue(formData, "comments") });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createQualityIncidentAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireDeliveryGovernanceRole(actor);
  const organizationId = requireOrganizationId(actor);
  const now = new Date().toISOString();
  const registry = await getDeliveryGovernanceRegistryForMutation(organizationId);
  const record = {
    incidentId: getValue(formData, "incident_id") || generatedLegacyId("INC"),
    projectId: getValue(formData, "project_id"),
    gateId: getValue(formData, "gate_id"),
    siteClusterId: getValue(formData, "site_cluster_id"),
    incidentType: getValue(formData, "incident_type"),
    severity: getValue(formData, "severity") || "medium",
    source: getValue(formData, "source") || "delivery",
    incidentOwner: getValue(formData, "incident_owner"),
    actionOwner: getValue(formData, "action_owner"),
    rca: getValue(formData, "rca"),
    correctiveAction: getValue(formData, "corrective_action"),
    preventiveAction: getValue(formData, "preventive_action"),
    dueDate: getValue(formData, "due_date"),
    status: getValue(formData, "status") || "open",
    ragImpact: getValue(formData, "rag_impact") || "amber",
    createdBy: session.email,
    createdAt: now,
    updatedAt: now,
  };
  requireValue(record.incidentType, "Incident type");
  registry.incidents = [record, ...registry.incidents.filter((incident) => incident.incidentId !== record.incidentId)];
  await saveDeliveryGovernanceRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "CREATE_QUALITY_INCIDENT", entityType: "quality_incident", entityId: record.incidentId, after: record });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createGovernanceRecordAction(formData: FormData) {
 try {
  const { session, user: actor } = await currentActor();
  requireDeliveryGovernanceRole(actor);
  const organizationId = requireOrganizationId(actor);
  const registry = await getDeliveryGovernanceRegistryForMutation(organizationId);
  const record = {
    governanceId: getValue(formData, "governance_id") || generatedLegacyId("GOV"),
    level: getValue(formData, "level"),
    workstream: getValue(formData, "workstream"),
    projectId: getValue(formData, "project_id"),
    period: getValue(formData, "period"),
    schedule: getValue(formData, "schedule"),
    scope: getValue(formData, "scope"),
    costFinance: getValue(formData, "cost_finance"),
    revenue: getValue(formData, "revenue"),
    margin: getValue(formData, "margin"),
    invoicing: getValue(formData, "invoicing"),
    cashCollection: getValue(formData, "cash_collection"),
    resources: getValue(formData, "resources"),
    quality: getValue(formData, "quality"),
    risks: getValue(formData, "risks"),
    issues: getValue(formData, "issues"),
    changeRequests: getValue(formData, "change_requests"),
    escalations: getValue(formData, "escalations"),
    decisions: getValue(formData, "decisions"),
    actionOwner: getValue(formData, "action_owner"),
    dueDate: getValue(formData, "due_date"),
    status: getValue(formData, "status") || "open",
    createdBy: session.email,
    createdAt: new Date().toISOString(),
  };
  requireValue(record.level, "Governance level");
  requireValue(record.workstream, "Workstream");
  registry.governanceRecords = [record, ...registry.governanceRecords.filter((item) => item.governanceId !== record.governanceId)];
  await saveDeliveryGovernanceRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "CREATE_GOVERNANCE_RECORD", entityType: "governance_record", entityId: record.governanceId, after: record });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function createTalentRecordAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireTalentPlanningRole(actor);
  const organizationId = requireOrganizationId(actor);
  const registry = await getTalentPlanningRegistryForMutation(organizationId);
  const now = new Date().toISOString();
  const record = {
    talentId: getValue(formData, "talent_id") || generatedLegacyId("TAL"),
    name: getValue(formData, "name"),
    age: getValue(formData, "age"),
    gender: getValue(formData, "gender"),
    currentRole: getValue(formData, "current_role"),
    expectedRole: getValue(formData, "expected_role"),
    riskForLeaving: getValue(formData, "risk_for_leaving"),
    impact: getValue(formData, "impact"),
    note: getValue(formData, "note"),
    readiness: getValue(formData, "readiness"),
    certificationRequirement: getValue(formData, "certification_requirement"),
    managerReadiness: getValue(formData, "manager_readiness"),
    successionCandidateStatus: getValue(formData, "succession_candidate_status"),
    status: getValue(formData, "status") || "active",
    createdAt: now,
    updatedAt: now,
  };
  requireValue(record.name, "Name");
  registry.talents = [record, ...registry.talents.filter((talent) => talent.talentId !== record.talentId)];
  await saveTalentPlanningRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "UPSERT_TALENT_RECORD", entityType: "talent_planning", entityId: record.talentId, after: record });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function importTalentPlanningExcelAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireTalentPlanningRole(actor);
  const organizationId = requireOrganizationId(actor);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Talent Excel file is required");
  const rows = workbookRows(await file.arrayBuffer());
  const registry = await getTalentPlanningRegistryForMutation(organizationId);
  const now = new Date().toISOString();
  const imported = rows.map((row) => ({
    talentId: generatedLegacyId("TAL"),
    name: cell(row, "name"),
    age: cell(row, "age"),
    gender: cell(row, "gender"),
    currentRole: cell(row, "current role"),
    expectedRole: cell(row, "expected role"),
    riskForLeaving: cell(row, "risk for leaving"),
    impact: cell(row, "impact"),
    note: cell(row, "note"),
    readiness: cell(row, "readiness") || "immediately",
    certificationRequirement: cell(row, "certification requirement"),
    managerReadiness: cell(row, "manager readiness"),
    successionCandidateStatus: cell(row, "succession candidate status"),
    status: "active",
    createdAt: now,
    updatedAt: now,
  })).filter((row) => row.name);
  registry.talents = [...imported, ...registry.talents];
  await saveTalentPlanningRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "IMPORT_TALENT_PLANNING_EXCEL", entityType: "talent_planning", entityId: file.name, after: { imported: imported.length } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function upsertRatecardResourceAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireRatecardRole(actor);
  const organizationId = requireOrganizationId(actor);
  const now = new Date().toISOString();
  const registry = await getRatecardRegistryForMutation(organizationId);
  const record = calculateRatecardRecord({
    ratecardId: getValue(formData, "ratecard_id") || generatedLegacyId("RATE"),
    resourceType: getValue(formData, "resource_type"),
    currency: getValue(formData, "currency") || "USD",
    monthlyNetAccrualSalary: String(moneyOrZero(getValue(formData, "monthly_net_accrual_salary"))),
    monthlyWorkingHours: getValue(formData, "monthly_working_hours") || "160",
    allocatedPcCostPerHour: String(moneyOrZero(getValue(formData, "allocated_pc_cost_per_hour"))),
    toolsCostPerHour: String(moneyOrZero(getValue(formData, "tools_cost_per_hour"))),
    facilityCostPerHour: String(moneyOrZero(getValue(formData, "facility_cost_per_hour"))),
    trainingCostPerHour: String(moneyOrZero(getValue(formData, "training_cost_per_hour"))),
    internetCostPerHour: String(moneyOrZero(getValue(formData, "internet_cost_per_hour"))),
    markupPercent: getValue(formData, "markup_percent") || "20",
    onsitePercent: getValue(formData, "onsite_percent") || "0",
    remotePercent: getValue(formData, "remote_percent") || "0",
    highCostLocationPercent: getValue(formData, "high_cost_location_percent") || "0",
    lowCostLocationPercent: getValue(formData, "low_cost_location_percent") || "0",
    seniorPercent: getValue(formData, "senior_percent") || "0",
    juniorPercent: getValue(formData, "junior_percent") || "0",
    status: getValue(formData, "status") || "active",
    createdAt: now,
    updatedAt: now,
  });
  requireValue(record.resourceType, "Resource type");
  registry.resources = [record, ...registry.resources.filter((item) => item.ratecardId !== record.ratecardId)];
  await saveRatecardRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "UPSERT_RATECARD_RESOURCE", entityType: "ratecard", entityId: record.ratecardId, after: record });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function importRatecardExcelAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireRatecardRole(actor);
  const organizationId = requireOrganizationId(actor);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Ratecard Excel file is required");
  const registry = await getRatecardRegistryForMutation(organizationId);
  const now = new Date().toISOString();
  const imported = workbookRows(await file.arrayBuffer()).map((row) => calculateRatecardRecord({
    ratecardId: cell(row, "ratecard id") || cell(row, "ratecard_id") || generatedLegacyId("RATE"),
    resourceType: cell(row, "resource type") || cell(row, "resource_type"),
    currency: cell(row, "currency") || "USD",
    monthlyNetAccrualSalary: cell(row, "monthly net accrual salary") || cell(row, "monthly_net_accrual_salary") || "0",
    monthlyWorkingHours: cell(row, "monthly working hours") || cell(row, "monthly_working_hours") || "160",
    allocatedPcCostPerHour: cell(row, "allocated pc cost per hour") || cell(row, "allocated_pc_cost_per_hour") || "0",
    toolsCostPerHour: cell(row, "tools cost per hour") || cell(row, "tools_cost_per_hour") || "0",
    facilityCostPerHour: cell(row, "facility cost per hour") || cell(row, "facility_cost_per_hour") || "0",
    trainingCostPerHour: cell(row, "training cost per hour") || cell(row, "training_cost_per_hour") || "0",
    internetCostPerHour: cell(row, "internet cost per hour") || cell(row, "internet_cost_per_hour") || "0",
    markupPercent: cell(row, "markup percent") || cell(row, "markup_percent") || "20",
    onsitePercent: cell(row, "onsite percent") || cell(row, "onsite_percent") || "0",
    remotePercent: cell(row, "remote percent") || cell(row, "remote_percent") || "0",
    highCostLocationPercent: cell(row, "high-cost location percent") || cell(row, "high_cost_location_percent") || "0",
    lowCostLocationPercent: cell(row, "low-cost location percent") || cell(row, "low_cost_location_percent") || "0",
    seniorPercent: cell(row, "senior percent") || cell(row, "senior_percent") || "0",
    juniorPercent: cell(row, "junior percent") || cell(row, "junior_percent") || "0",
    status: "active",
    createdAt: now,
    updatedAt: now,
  })).filter((row) => row.resourceType);
  await saveRatecardRegistry(organizationId, { ...registry, resources: [...imported, ...registry.resources.filter((item) => !imported.some((row) => row.ratecardId === item.ratecardId))] });
  await writeAudit({ actorId: actor?.id, action: "IMPORT_RATECARD_EXCEL", entityType: "ratecard", entityId: file.name, after: { imported: imported.length } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function importFrameworkSettingsExcelAction(formData: FormData) {
 try {
  const { user: actor } = await currentActor();
  requireActorRole(actor, ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN"]);
  const organizationId = requireOrganizationId(actor);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Framework settings Excel file is required");
  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const current = await getFrameworkControlPlaneForAction(organizationId);
  const before = structuredClone(current);
  const settingMap: Record<string, keyof FrameworkControlPlane> = {
    dealTypes: "dealTypes",
    commodityCodes: "commodityCodes",
    riskDomains: "riskDomains",
    currencies: "currencies",
    workflowStatuses: "workflowStatuses",
    documentCategories: "documentCategories",
  };
  for (const [sheetName, key] of Object.entries(settingMap)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length) {
      (current[key] as unknown[]) = rows.map((row) => Object.fromEntries(Object.entries(row).map(([field, value]) => [toCamel(field), String(value || "")])));
    }
  }
  await saveFrameworkControlPlaneForAction(organizationId, current, actor?.id, "IMPORT_FRAMEWORK_SETTINGS_EXCEL", before, getValue(formData, "reason") || "Admin optional framework settings import", getValue(formData, "approval_reference"));
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

export async function manualRefreshFxRatesAction() {
 try {
  const { user: actor } = await currentActor();
  requireRatecardRole(actor);
  const organizationId = requireOrganizationId(actor);
  const registry = await getRatecardRegistryForMutation(organizationId);
  if (fxCacheIsFresh(registry)) {
    await writeAudit({ actorId: actor?.id, action: "FX_REFRESH_SKIPPED_CACHE_VALID", entityType: "ratecard", entityId: "fx_rates", after: { fxUpdatedAt: registry.fxUpdatedAt } });
    revalidatePath("/");
    return;
  }
  const now = new Date().toISOString();
  registry.fxRates = fallbackFxRates(now);
  registry.fxUpdatedAt = now;
  await saveRatecardRegistry(organizationId, registry);
  await writeAudit({ actorId: actor?.id, action: "MANUAL_REFRESH_FX_RATES", entityType: "ratecard", entityId: "fx_rates", after: { source: "fallback", fxUpdatedAt: now } });
  revalidatePath("/");
 } catch (error) {
  return toActionError(error);
 }
}

function workbookRows(arrayBuffer: ArrayBuffer) {
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
}

function cell(row: Record<string, unknown>, name: string) {
  const match = Object.entries(row).find(([key]) => key.trim().toLowerCase() === name);
  return match ? String(match[1] || "").trim() : "";
}

function toCamel(value: string) {
  return value.trim().replace(/[_\s-]+([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase()).replace(/^[A-Z]/, (char) => char.toLowerCase());
}

function normalizeCurrency(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!normalized) return "USD";
  if (normalized.length !== 3) {
    throw new Error("Currency must be a 3-letter ISO code, e.g. USD, IDR, SGD.");
  }
  return normalized;
}
