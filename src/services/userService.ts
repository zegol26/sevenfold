import "server-only";

import { getDb } from "@/lib/db";
import { writeAudit } from "@/services/auditService";

export async function findUserByEmail(email: string) {
  return getDb().user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { role: true, client: true, resource: true },
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
