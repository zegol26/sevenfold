import "server-only";

import { getDb } from "@/lib/db";

export async function listClientsWithProjects() {
  return getDb().client.findMany({
    where: { status: "active" },
    include: { contacts: true, projects: { where: { status: "active" } } },
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return getDb().client.findUniqueOrThrow({
    where: { id },
    include: { contacts: true, projects: true },
  });
}
