import "server-only";

import { getSession } from "@/lib/session";
import type { AppUser, RoleId } from "@/lib/types";
import { findUserByEmail } from "@/services/userService";

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.email) {
    return null;
  }

  const user = await findUserByEmail(session.email);
  if (!user || user.status !== "ACTIVE") {
    return null;
  }
  // Platform admins are intentionally not tied to one organization; every other role
  // must belong to an active tenant, or the login is rejected.
  const isPlatformRole = user.role.code === "ROLE_PLATFORM_ADMIN";
  if (!isPlatformRole) {
    if (!user.organization || user.organization.status === "SUSPENDED" || user.organization.status === "CANCELLED") {
      return null;
    }
  }
  return {
    user_id: user.legacySourceId || user.id,
    email: user.email,
    full_name: user.fullName,
    role_id: user.role.code as RoleId,
    organization_id: user.organizationId || "",
    client_id: user.client?.legacySourceId || user.client?.code || "",
    project_id: "",
    employee_id: user.resource?.legacySourceId || "",
    candidate_id: "",
    status: String(user.status).toLowerCase(),
    permissions: Array.isArray(user.role.permissions) ? user.role.permissions.join(",") : String(user.role.permissions || ""),
  };
}

export function isSuperAdmin(user: AppUser | null) {
  return Boolean(user?.role_id === "ROLE_SUPER_ADMIN" || user?.permissions?.includes("super:all"));
}

// Platform admins are Nexus Sevenfold's own staff (not a tenant's staff) — they can
// provision/support any organization but should not be conflated with a tenant's own
// ROLE_SUPER_ADMIN, which stays scoped to that one organization.
export function isPlatformAdmin(user: AppUser | null) {
  return Boolean(user?.role_id === "ROLE_PLATFORM_ADMIN" || user?.permissions?.includes("platform:all"));
}

export function requireAnyRole(user: AppUser | null, roles: RoleId[]) {
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isSuperAdmin(user) || isPlatformAdmin(user)) {
    return;
  }
  if (!roles.includes(user.role_id)) {
    throw new Error("Forbidden");
  }
}

// Every organization-scoped query/mutation must go through this instead of reading
// user.organization_id directly, so a platform admin (who has none) can't silently
// fall through into an unscoped query.
export function requireOrganizationId(user: AppUser | null): string {
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (!user.organization_id) {
    throw new Error("This action requires a tenant-scoped user, not a platform admin.");
  }
  return user.organization_id;
}
