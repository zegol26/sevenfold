import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.role.upsert({
    where: { code: "ROLE_SUPER_ADMIN" },
    update: {},
    create: {
      code: "ROLE_SUPER_ADMIN",
      name: "Super Admin",
      description: "System owner",
      permissions: ["super:all"],
    },
  });
}

main()
  .finally(() => prisma.$disconnect());
