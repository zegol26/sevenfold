import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getDb } from "@/lib/db";
import type { CommercialProcurementRecord, ProjectExecutionGate, ProjectExecutionProject, ProjectExecutionRegistry, ProjectResourceDemandRecord, SiteHandlerRecord } from "@/lib/types";

export const PROJECT_EXECUTION_KEY = "sevenfold.project_execution";
export const PROJECT_EXECUTION_CACHE_TAG = "project-execution";

export const REQUIRED_PROJECT_GATES = [
  ["1", "Gate 1 Establishment"],
  ["2", "Gate 2 Execution Validation"],
  ["3", "Gate 3 Ready to Acceptance"],
  ["4", "Gate 4 Ready to Handover"],
  ["5", "Gate 5 Closure"],
] as const;

export const getProjectExecutionRegistry = unstable_cache(
  async (organizationId: string): Promise<ProjectExecutionRegistry> => {
    const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: PROJECT_EXECUTION_KEY } } });
    if (!setting) return emptyProjectExecutionRegistry();
    const value = setting.value as Partial<ProjectExecutionRegistry>;
    return {
      projects: Array.isArray(value.projects) ? value.projects : [],
      gates: Array.isArray(value.gates) ? value.gates : [],
      sites: Array.isArray(value.sites) ? value.sites : [],
      resourceDemands: Array.isArray(value.resourceDemands) ? value.resourceDemands : [],
      commercialFlows: Array.isArray(value.commercialFlows) ? value.commercialFlows : [],
      updatedAt: setting.updatedAt.toISOString(),
    };
  },
  [PROJECT_EXECUTION_KEY],
  { revalidate: 300, tags: [PROJECT_EXECUTION_CACHE_TAG] },
);

export async function getProjectExecutionRegistryForMutation(organizationId: string): Promise<ProjectExecutionRegistry> {
  const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: PROJECT_EXECUTION_KEY } } });
  if (!setting) return emptyProjectExecutionRegistry();
  const value = setting.value as Partial<ProjectExecutionRegistry>;
  return {
    projects: Array.isArray(value.projects) ? value.projects : [],
    gates: Array.isArray(value.gates) ? value.gates : [],
    sites: Array.isArray(value.sites) ? value.sites : [],
    resourceDemands: Array.isArray(value.resourceDemands) ? value.resourceDemands : [],
    commercialFlows: Array.isArray(value.commercialFlows) ? value.commercialFlows : [],
  };
}

export async function saveProjectExecutionRegistry(organizationId: string, value: ProjectExecutionRegistry) {
  const nextValue = { ...value, updatedAt: new Date().toISOString() };
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: PROJECT_EXECUTION_KEY } },
    create: {
      organizationId,
      key: PROJECT_EXECUTION_KEY,
      value: nextValue,
      description: "Sevenfold Project Execution, gate, and site handler registry.",
      status: "active",
    },
    update: { value: nextValue, status: "active" },
  });
  revalidateTag(PROJECT_EXECUTION_CACHE_TAG, "max");
}

export async function sdoaIsApproved(organizationId: string, sdoaId: string) {
  try {
    const sdoa = await getDb().orderAcknowledgement.findFirst({ where: { id: sdoaId, opportunity: { organizationId } } });
    return Boolean(sdoa && ["acknowledged", "approved", "accepted"].includes(sdoa.outcome));
  } catch (error) {
    if (isMissingPrismaTableError(error)) return false;
    throw error;
  }
}

export function createDefaultGates(projectId: string, actorEmail: string): ProjectExecutionGate[] {
  const now = new Date().toISOString();
  return REQUIRED_PROJECT_GATES.map(([gateNumber, gateName]) => ({
    gateId: `${projectId}-G${gateNumber}`,
    projectId,
    gateNumber,
    gateName,
    checklist: "",
    mandatoryChecklistComplete: "false",
    requiredInput: "",
    requiredOutput: "",
    requiredDocumentTemplate: "",
    ragStatus: "green",
    issues: "",
    risks: "",
    approvalStatus: "not_started",
    initiatedBy: actorEmail,
    updatedAt: now,
  }));
}

export function calculateNetSales(sites: SiteHandlerRecord[]) {
  return sites
    .filter((site) => ["accepted", "delivery_accepted", "gr_ready"].includes(site.acceptanceStatus))
    .reduce((sum, site) => sum + Number(site.acceptedScopeValue || 0), 0);
}

export function emptyProjectExecutionRegistry(): ProjectExecutionRegistry {
  return { projects: [], gates: [], sites: [], resourceDemands: [], commercialFlows: [] };
}

function isMissingPrismaTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "P2021" || Boolean(maybeError.message?.includes("does not exist in the current database"));
}

export type { CommercialProcurementRecord, ProjectExecutionGate, ProjectExecutionProject, ProjectResourceDemandRecord, SiteHandlerRecord };
