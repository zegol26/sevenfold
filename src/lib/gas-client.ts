import "server-only";

import { getRequiredEnv } from "@/lib/env";
import { getSession } from "@/lib/session";

type GasResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string | { code?: string; message?: string; details?: unknown } };

export async function callGas<T>(action: string, payload: Record<string, unknown> = {}, actorEmail?: string) {
  const session = await getSession();
  const response = await fetch(getRequiredEnv("NEXUS_GAS_WEB_APP_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      secret: getRequiredEnv("NEXUS_GAS_API_SECRET"),
      actorEmail: actorEmail || session?.email || "",
      action,
      payload,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GAS API HTTP ${response.status}`);
  }

  const text = await response.text();
  let result: GasResponse<T>;
  try {
    result = JSON.parse(text) as GasResponse<T>;
  } catch {
    const cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(cleanText || "GAS API returned a non-JSON response");
  }
  if (!result.ok) {
    const error = result.error;
    throw new Error(typeof error === "string" ? error : error?.message || "GAS API error");
  }
  return result.data;
}
