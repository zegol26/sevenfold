import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integration test against the real dev database (no test DB is configured yet).
// All rows are created with an unmistakable test prefix and removed in afterAll,
// regardless of pass/fail, so it never leaves data behind.
const prisma = new PrismaClient();
const RUN_ID = `test_${Date.now().toString(36)}`;
const orgAId = `${RUN_ID}_org_a`;
const orgBId = `${RUN_ID}_org_b`;

beforeAll(async () => {
  await prisma.organization.create({
    data: { id: orgAId, slug: `${RUN_ID}-org-a`, name: "Isolation Test Org A" },
  });
  await prisma.organization.create({
    data: { id: orgBId, slug: `${RUN_ID}-org-b`, name: "Isolation Test Org B" },
  });

  // Both orgs deliberately reuse the same business code, which used to be enforced
  // as a single globally-unique column before the organizationId scoping was added.
  await prisma.opportunity.create({
    data: { organizationId: orgAId, opportunityCode: "OPP-COLLIDE-001", customerName: "Org A Customer", status: "draft" },
  });
  await prisma.opportunity.create({
    data: { organizationId: orgBId, opportunityCode: "OPP-COLLIDE-001", customerName: "Org B Customer", status: "draft" },
  });

  await prisma.client.create({
    data: { organizationId: orgAId, code: "CLT-COLLIDE", name: "Org A Client" },
  });
  await prisma.client.create({
    data: { organizationId: orgBId, code: "CLT-COLLIDE", name: "Org B Client" },
  });
});

afterAll(async () => {
  await prisma.opportunity.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
  await prisma.client.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

describe("organization isolation", () => {
  it("allows two organizations to independently use the same opportunityCode", async () => {
    const opportunityA = await prisma.opportunity.findUnique({
      where: { organizationId_opportunityCode: { organizationId: orgAId, opportunityCode: "OPP-COLLIDE-001" } },
    });
    const opportunityB = await prisma.opportunity.findUnique({
      where: { organizationId_opportunityCode: { organizationId: orgBId, opportunityCode: "OPP-COLLIDE-001" } },
    });
    expect(opportunityA?.customerName).toBe("Org A Customer");
    expect(opportunityB?.customerName).toBe("Org B Customer");
    expect(opportunityA?.id).not.toBe(opportunityB?.id);
  });

  it("never returns another organization's opportunity when scoped by organizationId", async () => {
    const rowsVisibleToOrgA = await prisma.opportunity.findMany({ where: { organizationId: orgAId, opportunityCode: "OPP-COLLIDE-001" } });
    expect(rowsVisibleToOrgA).toHaveLength(1);
    expect(rowsVisibleToOrgA[0].organizationId).toBe(orgAId);
  });

  it("never returns another organization's client when scoped by organizationId", async () => {
    const rowsVisibleToOrgB = await prisma.client.findMany({ where: { organizationId: orgBId, code: "CLT-COLLIDE" } });
    expect(rowsVisibleToOrgB).toHaveLength(1);
    expect(rowsVisibleToOrgB[0].name).toBe("Org B Client");
  });
});
