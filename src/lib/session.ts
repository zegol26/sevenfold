import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequiredEnv } from "@/lib/env";

export type NexusSession = {
  email: string;
  username: string;
  name?: string;
  userId?: string;
  roleId?: string;
  exp: number;
};

const COOKIE_NAME = "nexus_session";
const ONE_DAY_SECONDS = 60 * 60 * 24;

export async function createSession(input: Omit<NexusSession, "exp">) {
  const session: NexusSession = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + ONE_DAY_SECONDS,
  };
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_DAY_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) {
    return null;
  }
  return verifySession(value);
}

function signSession(session: NexusSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = hmac(payload);
  return `${payload}.${signature}`;
}

function verifySession(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = hmac(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as NexusSession;
  if (session.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return session;
}

function hmac(payload: string) {
  return createHmac("sha256", getRequiredEnv("NEXUS_SESSION_SECRET")).update(payload).digest("base64url");
}
