import "server-only";

import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";

export async function writeAudit(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  reason?: string;
  approvalReference?: string;
}) {
  const metadata = {
    ...(typeof input.metadata === "object" && input.metadata !== null && !Array.isArray(input.metadata) ? input.metadata : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.approvalReference ? { approval_reference: input.approvalReference } : {}),
  } as Prisma.InputJsonValue;

  return getDb().auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      metadata,
    },
  });
}
