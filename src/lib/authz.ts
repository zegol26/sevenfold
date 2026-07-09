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
  return {
    user_id: user.legacySourceId || user.id,
    email: user.email,
    full_name: user.fullName,
    role_id: user.role.code as RoleId,
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

export function requireAnyRole(user: AppUser | null, roles: RoleId[]) {
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (isSuperAdmin(user)) {
    return;
  }
  if (!roles.includes(user.role_id)) {
    throw new Error("Forbidden");
  }
}
