import "server-only";

import bcrypt from "bcryptjs";
import { getOptionalEnv } from "@/lib/env";

const rounds = Number(getOptionalEnv("BCRYPT_SALT_ROUNDS") || 10);

export function hashPassword(password: string) {
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
