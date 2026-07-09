export function generateId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export function nowIso() {
  return new Date().toISOString();
}
