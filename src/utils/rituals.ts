import { CharacterProfileId, normalizeCharacterProfile } from "./profiles";

export type RitualAffiliationId =
  | "dor"
  | "nirvana"
  | "alma"
  | "corpo"
  | "cura"
  | "medo"
  | "membrana"
  | "intencao"
  | "caos";

export type RitualLevel = 1 | 2 | 3 | 4;

export interface RitualAffiliationDefinition {
  id: RitualAffiliationId;
  label: string;
  background: string;
  textColor: string;
  borderColor: string;
  textShadow?: string;
  isDualSplit?: boolean;
}

export interface RitualItem {
  id: number;
  name: string;
  level: RitualLevel;
  difficulty: number;
  cost: number;
  desc: string;
  affiliations: RitualAffiliationId[];
  damage: string;
  needsTest: boolean;
}

export const MIN_RITUAL_LEVEL: RitualLevel = 1;
export const MAX_RITUAL_LEVEL: RitualLevel = 4;
export const DEFAULT_RITUAL_DIFFICULTY = 8;
export const RITUAL_TEST_FORMULA = "2d6+OCU";

export const RITUAL_AFFILIATIONS: Record<
  RitualAffiliationId,
  RitualAffiliationDefinition
> = {
  dor: {
    id: "dor",
    label: "Dor",
    background: "#b91c1c",
    textColor: "#ffffff",
    borderColor: "#ef4444",
  },
  nirvana: {
    id: "nirvana",
    label: "Nirvana",
    background: "#d4a017",
    textColor: "#140d02",
    borderColor: "#facc15",
  },
  alma: {
    id: "alma",
    label: "Alma",
    background: "#06b6d4",
    textColor: "#04161e",
    borderColor: "#22d3ee",
  },
  corpo: {
    id: "corpo",
    label: "Corpo",
    background: "#6b1028",
    textColor: "#fde8ee",
    borderColor: "#9f1d3d",
  },
  cura: {
    id: "cura",
    label: "Cura",
    background: "#15803d",
    textColor: "#f0fdf4",
    borderColor: "#22c55e",
  },
  medo: {
    id: "medo",
    label: "Medo",
    background: "#6b21a8",
    textColor: "#f3e8ff",
    borderColor: "#a855f7",
  },
  membrana: {
    id: "membrana",
    label: "Membrana",
    background: "#f4f4f5",
    textColor: "#09090b",
    borderColor: "#71717a",
  },
  intencao: {
    id: "intencao",
    label: "Intenção",
    background:
      "linear-gradient(110deg, #06b6d4 0%, #06b6d4 50%, #6b1028 50%, #6b1028 100%)",
    textColor: "#ffffff",
    borderColor: "#22d3ee",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.85)",
    isDualSplit: true,
  },
  caos: {
    id: "caos",
    label: "Caos",
    background:
      "linear-gradient(110deg, #b91c1c 0%, #b91c1c 50%, #d4a017 50%, #d4a017 100%)",
    textColor: "#ffffff",
    borderColor: "#f59e0b",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.85)",
    isDualSplit: true,
  },
};

export const RITUAL_AFFILIATION_LIST: readonly RitualAffiliationDefinition[] = [
  RITUAL_AFFILIATIONS.dor,
  RITUAL_AFFILIATIONS.nirvana,
  RITUAL_AFFILIATIONS.alma,
  RITUAL_AFFILIATIONS.corpo,
  RITUAL_AFFILIATIONS.cura,
  RITUAL_AFFILIATIONS.medo,
  RITUAL_AFFILIATIONS.membrana,
  RITUAL_AFFILIATIONS.intencao,
  RITUAL_AFFILIATIONS.caos,
];

export function isRitualAffiliationId(val: unknown): val is RitualAffiliationId {
  return (
    typeof val === "string" &&
    Object.prototype.hasOwnProperty.call(RITUAL_AFFILIATIONS, val)
  );
}

export function normalizeRitualLevel(raw: unknown): RitualLevel {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 1;
  const rounded = Math.round(num);
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  if (rounded === 3) return 3;
  return 4;
}

export function normalizeRitualDifficulty(
  raw: unknown,
  fallback: number = DEFAULT_RITUAL_DIFFICULTY
): number {
  if (raw === "" || raw === null || raw === undefined) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(99, Math.round(num)));
}

export function normalizeRitualCost(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

export function normalizeRitualAffiliations(raw: unknown): RitualAffiliationId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<RitualAffiliationId>();
  const out: RitualAffiliationId[] = [];
  for (const item of raw) {
    const normalized = typeof item === "string" ? item.trim().toLowerCase() : "";
    if (isRitualAffiliationId(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function normalizeRitualItem(raw: unknown, fallbackId: number): RitualItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parsedId = Number(r.id);
  const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : fallbackId;
  return {
    id,
    name: typeof r.name === "string" ? r.name : "",
    level: normalizeRitualLevel(r.level),
    difficulty: normalizeRitualDifficulty(r.difficulty, DEFAULT_RITUAL_DIFFICULTY),
    cost: normalizeRitualCost(r.cost),
    desc: typeof r.desc === "string" ? r.desc : "",
    affiliations: normalizeRitualAffiliations(r.affiliations),
    damage: typeof r.damage === "string" ? r.damage : "",
    needsTest: r.needsTest !== false,
  };
}

export function normalizeRituals(raw: unknown): RitualItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RitualItem[] = [];
  const seenIds = new Set<number>();
  raw.forEach((entry, idx) => {
    const item = normalizeRitualItem(entry, idx + 1);
    if (!item) return;
    let uniqueId = item.id;
    while (seenIds.has(uniqueId)) {
      uniqueId += 1;
    }
    seenIds.add(uniqueId);
    out.push(uniqueId === item.id ? item : { ...item, id: uniqueId });
  });
  return out;
}

export function createDefaultRitual(id: number = Date.now()): RitualItem {
  return {
    id,
    name: "",
    level: 1,
    difficulty: DEFAULT_RITUAL_DIFFICULTY,
    cost: 0,
    desc: "",
    affiliations: [],
    damage: "",
    needsTest: true,
  };
}

export function toggleRitualAffiliation(
  current: RitualAffiliationId[],
  affiliationId: RitualAffiliationId
): RitualAffiliationId[] {
  if (current.includes(affiliationId)) {
    return current.filter((a) => a !== affiliationId);
  }
  return [...current, affiliationId];
}

export function extractIntAttribute(
  variables?: Record<string, number> | null
): number {
  if (!variables || typeof variables !== "object") return 0;
  for (const [k, v] of Object.entries(variables)) {
    if (k.trim().toUpperCase() === "INT") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    }
  }
  return 0;
}

/**
 * Limite máximo de Rituais armazenáveis:
 * - Padrão: INT × 1
 * - Perfil Oculto: INT × 2
 */
export function getRitualLimit(
  variables?: Record<string, number> | null,
  profile?: CharacterProfileId | string | null
): number {
  const intValue = extractIntAttribute(variables);
  const normalizedProfile = normalizeCharacterProfile(profile);
  const multiplier = normalizedProfile === "oculto" ? 2 : 1;
  return Math.max(0, intValue * multiplier);
}

export interface RitualCapacityState {
  count: number;
  limit: number;
  intValue: number;
  multiplier: 1 | 2;
  isOculto: boolean;
  canAdd: boolean;
  isAtLimit: boolean;
  isOverLimit: boolean;
}

export function getRitualCapacityState(
  rituals: unknown,
  variables?: Record<string, number> | null,
  profile?: CharacterProfileId | string | null
): RitualCapacityState {
  const count = Array.isArray(rituals) ? rituals.length : 0;
  const intValue = extractIntAttribute(variables);
  const normalizedProfile = normalizeCharacterProfile(profile);
  const isOculto = normalizedProfile === "oculto";
  const multiplier: 1 | 2 = isOculto ? 2 : 1;
  const limit = Math.max(0, intValue * multiplier);
  return {
    count,
    limit,
    intValue,
    multiplier,
    isOculto,
    canAdd: count < limit,
    isAtLimit: count === limit,
    isOverLimit: count > limit,
  };
}

export interface RitualTestOutcome {
  success: boolean;
  result: number;
  difficulty: number;
  margin: number;
}

/**
 * Regra de conjuração de Ritual:
 * O resultado de 2d6+OCU deve ser estritamente MAIOR que a dificuldade.
 */
export function evaluateRitualTestOutcome(
  rollResult: number,
  difficulty: number
): RitualTestOutcome {
  const safeDiff = normalizeRitualDifficulty(difficulty, 0);
  const safeRes = Number.isFinite(rollResult) ? rollResult : 0;
  return {
    success: safeRes > safeDiff,
    result: safeRes,
    difficulty: safeDiff,
    margin: safeRes - safeDiff,
  };
}
