export function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}
