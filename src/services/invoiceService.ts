import "server-only";

import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/services/auditService";

export async function createInvoice(
  data: Prisma.InvoiceCreateInput,
  actorId?: string,
) {
  const invoice = await getDb().invoice.create({ data, include: { items: true } });
  await writeAudit({
    actorId,
    action: "INVOICE_CREATED",
    entityType: "invoice",
    entityId: invoice.id,
    after: { invoiceNumber: invoice.invoiceNumber, totalAmount: String(invoice.totalAmount) },
  });
  return invoice;
}

export async function getInvoice(id: string) {
  return getDb().invoice.findUniqueOrThrow({
    where: { id },
    include: { items: true, payments: true, generatedDocument: true, client: true, project: true },
  });
}
