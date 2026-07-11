import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getDb } from "@/lib/db";
import type { FxRateRecord, RatecardRegistry, RatecardResourceCostRecord } from "@/lib/types";

export const RATECARD_KEY = "sevenfold.ratecard";
export const RATECARD_CACHE_TAG = "ratecard";
export const FX_CACHE_MS = 24 * 60 * 60 * 1000;

export const FALLBACK_FX_RATES: FxRateRecord[] = [
  { currency: "USD", rateToUsd: "1", source: "fallback", updatedAt: "" },
  { currency: "EUR", rateToUsd: "1.08", source: "fallback", updatedAt: "" },
  { currency: "IDR", rateToUsd: "0.000061", source: "fallback", updatedAt: "" },
  { currency: "SGD", rateToUsd: "0.74", source: "fallback", updatedAt: "" },
  { currency: "AUD", rateToUsd: "0.66", source: "fallback", updatedAt: "" },
  { currency: "THB", rateToUsd: "0.027", source: "fallback", updatedAt: "" },
];

export const getRatecardRegistry = unstable_cache(
  async (organizationId: string): Promise<RatecardRegistry> => {
    const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: RATECARD_KEY } } });
    if (!setting) return emptyRatecardRegistry();
    const value = setting.value as Partial<RatecardRegistry>;
    return {
      resources: Array.isArray(value.resources) ? value.resources : [],
      fxRates: Array.isArray(value.fxRates) ? value.fxRates : fallbackFxRates(value.fxUpdatedAt),
      fxUpdatedAt: value.fxUpdatedAt,
      updatedAt: setting.updatedAt.toISOString(),
    };
  },
  [RATECARD_KEY],
  { revalidate: 300, tags: [RATECARD_CACHE_TAG] },
);

export async function getRatecardRegistryForMutation(organizationId: string): Promise<RatecardRegistry> {
  const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: RATECARD_KEY } } });
  if (!setting) return emptyRatecardRegistry();
  const value = setting.value as Partial<RatecardRegistry>;
  return {
    resources: Array.isArray(value.resources) ? value.resources : [],
    fxRates: Array.isArray(value.fxRates) ? value.fxRates : fallbackFxRates(value.fxUpdatedAt),
    fxUpdatedAt: value.fxUpdatedAt,
  };
}

export async function saveRatecardRegistry(organizationId: string, value: RatecardRegistry) {
  const nextValue = { ...value, updatedAt: new Date().toISOString() };
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: RATECARD_KEY } },
    create: {
      organizationId,
      key: RATECARD_KEY,
      value: nextValue,
      description: "Sevenfold ratecard, FX cache, and blended costing registry.",
      status: "active",
    },
    update: { value: nextValue, status: "active" },
  });
  revalidateTag(RATECARD_CACHE_TAG, "max");
}

export function calculateRatecardRecord(input: Omit<RatecardResourceCostRecord, "baseHourlyCost" | "operationalCostPerHour" | "recommendedHourlyCost" | "blendedRate">): RatecardResourceCostRecord {
  const salary = num(input.monthlyNetAccrualSalary);
  const hours = Math.max(1, num(input.monthlyWorkingHours) || 160);
  const baseHourlyCost = salary / hours;
  const operationalCostPerHour =
    num(input.allocatedPcCostPerHour) +
    num(input.toolsCostPerHour) +
    num(input.facilityCostPerHour) +
    num(input.trainingCostPerHour) +
    num(input.internetCostPerHour);
  const recommendedHourlyCost = baseHourlyCost * (1 + num(input.markupPercent) / 100) + operationalCostPerHour;
  const compositionFactor =
    percent(input.onsitePercent) * 1.05 +
    percent(input.remotePercent) * 0.95 +
    percent(input.highCostLocationPercent) * 1.2 +
    percent(input.lowCostLocationPercent) * 0.9 +
    percent(input.seniorPercent) * 1.25 +
    percent(input.juniorPercent) * 0.75;
  const normalizedFactor = compositionFactor > 0 ? compositionFactor : 1;
  return {
    ...input,
    baseHourlyCost: fixed(baseHourlyCost),
    operationalCostPerHour: fixed(operationalCostPerHour),
    recommendedHourlyCost: fixed(recommendedHourlyCost),
    blendedRate: fixed(recommendedHourlyCost * normalizedFactor),
  };
}

export function fxCacheIsFresh(registry: RatecardRegistry) {
  if (!registry.fxUpdatedAt) return false;
  return Date.now() - new Date(registry.fxUpdatedAt).getTime() < FX_CACHE_MS;
}

export function fallbackFxRates(updatedAt = new Date().toISOString()): FxRateRecord[] {
  return FALLBACK_FX_RATES.map((rate) => ({ ...rate, updatedAt }));
}

export function emptyRatecardRegistry(): RatecardRegistry {
  const now = new Date().toISOString();
  return { resources: [], fxRates: fallbackFxRates(now), fxUpdatedAt: now };
}

function num(value: string) {
  const parsed = Number(String(value || "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: string) {
  return num(value) / 100;
}

function fixed(value: number) {
  return String(Math.round(value * 100) / 100);
}
