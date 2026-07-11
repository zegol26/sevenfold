import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getDb } from "@/lib/db";
import type { DeliveryGovernanceRegistry, GovernanceSummary, ProjectExecutionRegistry } from "@/lib/types";
import { calculateNetSales } from "@/services/projectExecutionService";

export const DELIVERY_GOVERNANCE_KEY = "sevenfold.delivery_governance";
export const DELIVERY_GOVERNANCE_CACHE_TAG = "delivery-governance";

export const getDeliveryGovernanceRegistry = unstable_cache(
  async (organizationId: string): Promise<DeliveryGovernanceRegistry> => {
    const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: DELIVERY_GOVERNANCE_KEY } } });
    if (!setting) return emptyDeliveryGovernanceRegistry();
    const value = setting.value as Partial<DeliveryGovernanceRegistry>;
    return {
      changeRequests: Array.isArray(value.changeRequests) ? value.changeRequests : [],
      incidents: Array.isArray(value.incidents) ? value.incidents : [],
      governanceRecords: Array.isArray(value.governanceRecords) ? value.governanceRecords : [],
      updatedAt: setting.updatedAt.toISOString(),
    };
  },
  [DELIVERY_GOVERNANCE_KEY],
  { revalidate: 300, tags: [DELIVERY_GOVERNANCE_CACHE_TAG] },
);

export async function getDeliveryGovernanceRegistryForMutation(organizationId: string): Promise<DeliveryGovernanceRegistry> {
  const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: DELIVERY_GOVERNANCE_KEY } } });
  if (!setting) return emptyDeliveryGovernanceRegistry();
  const value = setting.value as Partial<DeliveryGovernanceRegistry>;
  return {
    changeRequests: Array.isArray(value.changeRequests) ? value.changeRequests : [],
    incidents: Array.isArray(value.incidents) ? value.incidents : [],
    governanceRecords: Array.isArray(value.governanceRecords) ? value.governanceRecords : [],
  };
}

export async function saveDeliveryGovernanceRegistry(organizationId: string, value: DeliveryGovernanceRegistry) {
  const nextValue = { ...value, updatedAt: new Date().toISOString() };
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: DELIVERY_GOVERNANCE_KEY } },
    create: {
      organizationId,
      key: DELIVERY_GOVERNANCE_KEY,
      value: nextValue,
      description: "Sevenfold change request, quality incident, and governance registry.",
      status: "active",
    },
    update: { value: nextValue, status: "active" },
  });
  revalidateTag(DELIVERY_GOVERNANCE_CACHE_TAG, "max");
}

export function computeGovernanceSummary(
  governance: DeliveryGovernanceRegistry,
  execution: ProjectExecutionRegistry,
): GovernanceSummary {
  const today = new Date().toISOString().slice(0, 10);
  const approvedCrs = governance.changeRequests.filter((cr) => cr.approvalStatus === "approved");
  const openIncidents = governance.incidents.filter((incident) => !["closed", "resolved"].includes(incident.status));
  return {
    openChangeRequests: governance.changeRequests.filter((cr) => !["approved", "rejected", "closed"].includes(cr.approvalStatus)).length,
    approvedChangeRequests: approvedCrs.length,
    additionalBudget: String(approvedCrs.reduce((sum, cr) => sum + Number(cr.additionalBudget || 0), 0)),
    addOnSalesValue: String(approvedCrs.reduce((sum, cr) => sum + Number(cr.addOnSalesValue || 0), 0)),
    openIncidents: openIncidents.length,
    redIncidents: openIncidents.filter((incident) => incident.ragImpact === "red" || incident.severity === "critical").length,
    overdueActions: openIncidents.filter((incident) => incident.dueDate && incident.dueDate < today).length,
    netSalesEstimate: String(calculateNetSales(execution.sites)),
    resourceGaps: execution.resourceDemands.filter((demand) => demand.gapStatus !== "filled").length,
    timesheetNotReady: execution.resourceDemands.filter((demand) => demand.timesheetReadiness !== "ready").length,
    latestEscalations: governance.governanceRecords
      .filter((record) => record.escalations)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}

export function emptyDeliveryGovernanceRegistry(): DeliveryGovernanceRegistry {
  return { changeRequests: [], incidents: [], governanceRecords: [] };
}
