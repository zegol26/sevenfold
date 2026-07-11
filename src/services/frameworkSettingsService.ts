import { unstable_cache } from "next/cache";

import { defaultFrameworkControlPlane } from "@/lib/framework-defaults";
import type { FrameworkControlPlane } from "@/lib/types";
import { getDb } from "@/lib/db";

const CONTROL_PLANE_KEY = "sevenfold.control_plane";
export const FRAMEWORK_SETTINGS_CACHE_TAG = "framework-settings";

function mergeFrameworkSettings(value?: Partial<FrameworkControlPlane> | null, updatedAt?: Date): FrameworkControlPlane {
  const defaults = defaultFrameworkControlPlane();
  const merged = {
    ...defaults,
    ...(value || {}),
    roles: value?.roles || defaults.roles,
    permissions: value?.permissions || defaults.permissions,
    rolePermissions: value?.rolePermissions || defaults.rolePermissions,
    userAccessPolicies: value?.userAccessPolicies || defaults.userAccessPolicies,
    workflowAccessPolicies: value?.workflowAccessPolicies || defaults.workflowAccessPolicies,
    approvalMatrices: value?.approvalMatrices || defaults.approvalMatrices,
    approvalRules: value?.approvalRules || defaults.approvalRules,
    dealTypes: value?.dealTypes || defaults.dealTypes,
    commodityCodes: value?.commodityCodes || defaults.commodityCodes,
    riskDomains: value?.riskDomains || defaults.riskDomains,
    riskScoring: value?.riskScoring || defaults.riskScoring,
    gateDefinitions: value?.gateDefinitions || defaults.gateDefinitions,
    gateChecklist: value?.gateChecklist || defaults.gateChecklist,
    governanceCadence: value?.governanceCadence || defaults.governanceCadence,
    ragThresholds: value?.ragThresholds || defaults.ragThresholds,
    currencies: value?.currencies || defaults.currencies,
    workingHours: value?.workingHours || defaults.workingHours,
    defaultRatecardAssumptions: value?.defaultRatecardAssumptions || defaults.defaultRatecardAssumptions,
    documentCategories: value?.documentCategories || defaults.documentCategories,
    workflowStatuses: value?.workflowStatuses || defaults.workflowStatuses,
    approvalThresholds: value?.approvalThresholds || defaults.approvalThresholds,
    documentTemplateSettings: value?.documentTemplateSettings || defaults.documentTemplateSettings,
    frameworkVersions: value?.frameworkVersions || defaults.frameworkVersions,
    manualNotes: value?.manualNotes || defaults.manualNotes,
  };

  return {
    ...merged,
    updatedAt: updatedAt?.toISOString() || merged.updatedAt,
  };
}

// organizationId is part of the cache key (unstable_cache keys on its arguments), so each
// tenant's settings are cached independently. The revalidation tag stays shared across
// tenants for simplicity: a save in one org causes a cache miss (not a leak) for others.
export const getActiveFrameworkSettings = unstable_cache(
  async (organizationId: string): Promise<FrameworkControlPlane> => {
    const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: CONTROL_PLANE_KEY } } });
    return mergeFrameworkSettings(setting?.value as Partial<FrameworkControlPlane> | undefined, setting?.updatedAt);
  },
  [CONTROL_PLANE_KEY],
  { revalidate: 300, tags: [FRAMEWORK_SETTINGS_CACHE_TAG] },
);

export async function getLatestActiveFrameworkVersion(organizationId: string) {
  const settings = await getActiveFrameworkSettings(organizationId);
  const activeVersions = settings.frameworkVersions
    .filter((item) => item.status === "active")
    .sort((a, b) => String(b.effectiveAt || b.version).localeCompare(String(a.effectiveAt || a.version)));

  return activeVersions[0]?.version || settings.frameworkVersions[0]?.version || "unversioned";
}
