import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getDb } from "@/lib/db";
import type { TalentPlanningRegistry } from "@/lib/types";

export const TALENT_PLANNING_KEY = "sevenfold.talent_planning";
export const TALENT_PLANNING_CACHE_TAG = "talent-planning";

export const getTalentPlanningRegistry = unstable_cache(
  async (): Promise<TalentPlanningRegistry> => {
    const setting = await getDb().systemSetting.findUnique({ where: { key: TALENT_PLANNING_KEY } });
    if (!setting) return emptyTalentPlanningRegistry();
    const value = setting.value as Partial<TalentPlanningRegistry>;
    return {
      talents: Array.isArray(value.talents) ? value.talents : [],
      updatedAt: setting.updatedAt.toISOString(),
    };
  },
  [TALENT_PLANNING_KEY],
  { revalidate: 300, tags: [TALENT_PLANNING_CACHE_TAG] },
);

export async function getTalentPlanningRegistryForMutation(): Promise<TalentPlanningRegistry> {
  const setting = await getDb().systemSetting.findUnique({ where: { key: TALENT_PLANNING_KEY } });
  if (!setting) return emptyTalentPlanningRegistry();
  const value = setting.value as Partial<TalentPlanningRegistry>;
  return { talents: Array.isArray(value.talents) ? value.talents : [] };
}

export async function saveTalentPlanningRegistry(value: TalentPlanningRegistry) {
  const nextValue = { ...value, updatedAt: new Date().toISOString() };
  await getDb().systemSetting.upsert({
    where: { key: TALENT_PLANNING_KEY },
    create: {
      key: TALENT_PLANNING_KEY,
      value: nextValue,
      description: "Sevenfold talent planning import and succession registry.",
      status: "active",
    },
    update: { value: nextValue, status: "active" },
  });
  revalidateTag(TALENT_PLANNING_CACHE_TAG, "max");
}

export function emptyTalentPlanningRegistry(): TalentPlanningRegistry {
  return { talents: [] };
}
