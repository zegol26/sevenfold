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
