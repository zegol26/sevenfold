import "server-only";

import { getDb } from "@/lib/db";
import { writeAudit } from "@/services/auditService";

// email is no longer globally unique (scoped per organization), so this resolves the
// first active-organization match. Disambiguating a person who belongs to more than one
// tenant (an org picker at login) is deferred to Phase 2 onboarding work.
export async function findUserByEmail(email: string) {
  return getDb().user.findFirst({
    where: { email: email.trim().toLowerCase() },
    include: { role: true, client: true, resource: true, organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listUsers() {
  return getDb().user.findMany({
    where: { status: { not: "DELETED" } },
    include: { role: true, client: true, resource: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserStatus(id: string, status: "ACTIVE" | "INACTIVE" | "DELETED", actorId?: string) {
  const before = await getDb().user.findUniqueOrThrow({ where: { id } });
  const after = await getDb().user.update({ where: { id }, data: { status } });
  await writeAudit({ actorId, action: "USER_STATUS_UPDATED", entityType: "user", entityId: id, before, after });
  return after;
}

export async function listRoles() {
  return getDb().role.findMany({ where: { status: "active" }, orderBy: { name: "asc" } });
}

/** Active (non-revoked) UserRole assignments for a user, as role IDs. */
export async function listUserRoleIds(userId: string) {
  const rows = await getDb().userRole.findMany({
    where: { userId, status: "active" },
    select: { roleId: true },
  });
  return rows.map((row) => row.roleId);
}

/**
 * Sets the full set of roles for a user. `roleIds[0]` becomes the primary role
 * (User.roleId) that the rest of the app's permission checks read from
 * (src/lib/authz.ts) - this function never removes that column, only keeps it in
 * sync with the first selected role. The full set is tracked in UserRole so a user
 * can hold more than one role; roles no longer selected are soft-revoked
 * (status: "inactive", revokedAt set) rather than deleted, preserving history.
 */
export async function setUserRoles(userId: string, roleIds: string[], actorId?: string) {
  if (!roleIds.length) {
    throw new Error("At least one role is required");
  }

  const activeAssignments = await getDb().userRole.findMany({ where: { userId, status: "active" } });
  const activeRoleIds = activeAssignments.map((row) => row.roleId);

  await getDb().user.update({ where: { id: userId }, data: { roleId: roleIds[0] } });

  const toCreate = roleIds.filter((roleId) => !activeRoleIds.includes(roleId));
  const toRevoke = activeAssignments.filter((row) => !roleIds.includes(row.roleId));

  if (toCreate.length) {
    await getDb().userRole.createMany({
      data: toCreate.map((roleId) => ({ userId, roleId, assignedBy: actorId, status: "active" })),
    });
  }
  if (toRevoke.length) {
    await getDb().userRole.updateMany({
      where: { id: { in: toRevoke.map((row) => row.id) } },
      data: { status: "inactive", revokedAt: new Date() },
    });
  }

  await writeAudit({
    actorId,
    action: "USER_ROLES_UPDATED",
    entityType: "user",
    entityId: userId,
    before: { role_ids: activeRoleIds },
    after: { role_ids: roleIds },
  });

  return roleIds;
}
