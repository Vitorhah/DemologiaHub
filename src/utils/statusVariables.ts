export const DEFAULT_STATUS_KEYS = [
  "SAN",
  "AGL",
  "INT",
  "FOR",
  "VIT",
  "OCU",
] as const;

export function isDefaultStatusKey(key: string): boolean {
  const normalized = String(key || "").trim().toUpperCase();
  return (DEFAULT_STATUS_KEYS as readonly string[]).includes(normalized);
}

export function canRemoveStatusVariable(key: string): boolean {
  return !isDefaultStatusKey(key);
}

export function canRenameStatusVariable(key: string): boolean {
  return !isDefaultStatusKey(key);
}
