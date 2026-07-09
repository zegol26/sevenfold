import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export type DatabaseClient = ReturnType<typeof getDb>;
