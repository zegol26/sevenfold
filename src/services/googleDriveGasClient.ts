import "server-only";

import { getRequiredEnv } from "@/lib/env";

type GasEnvelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } | string };

export async function callDocumentGas<T>(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(getRequiredEnv("GAS_WEB_APP_URL"), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      secret: getRequiredEnv("GAS_API_SECRET"),
      action,
      payload,
    }),
    cache: "no-store",
  });
  const body = await response.json() as GasEnvelope<T>;
  if (!response.ok || !body.ok) {
    const error = body.ok ? `GAS HTTP ${response.status}` : typeof body.error === "string" ? body.error : body.error.message;
    throw new Error(error);
  }
  return body.data;
}
