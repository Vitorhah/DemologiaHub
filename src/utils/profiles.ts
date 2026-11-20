import { DemologiaStatKey } from "./pdi";

export type CharacterProfileId = "executivo" | "pensativo" | "oculto";
export type CharacterProfileSymbol = "sword" | "brain" | "eye";

export interface CharacterProfileDefinition {
  id: CharacterProfileId;
  name: string;
  description: string;
  symbol: CharacterProfileSymbol;
  colorName: "red" | "green" | "blue";
  accentHex: string;
  bonuses: Partial<Record<DemologiaStatKey, number>>;
}

export const DEFAULT_CHARACTER_PROFILE: CharacterProfileId = "executivo";

export const CHARACTER_PROFILES: Record<
  CharacterProfileId,
  CharacterProfileDefinition
> = {
  executivo: {
    id: "executivo",
    name: "Executivo",
    description: "Pessoas que agem antes de pensar.",
    symbol: "sword",
    colorName: "red",
    accentHex: "#dc2626",
    bonuses: {
      AGL: 1,
      FOR: 2,
    },
  },
  pensativo: {
    id: "pensativo",
    name: "Pensativo",
    description: "Pessoas que pensam antes de agir.",
    symbol: "brain",
    colorName: "green",
    accentHex: "#16a34a",
    bonuses: {
      SAN: 1,
      INT: 2,
    },
  },
  oculto: {
    id: "oculto",
    name: "Oculto",
    description: "Pessoas que usam o paranormal para benefício próprio.",
    symbol: "eye",
    colorName: "blue",
    accentHex: "#2563eb",
    bonuses: {
      INT: 1,
      OCU: 3,
    },
  },
};

export const CHARACTER_PROFILE_LIST: CharacterProfileDefinition[] = [
  CHARACTER_PROFILES.executivo,
  CHARACTER_PROFILES.pensativo,
  CHARACTER_PROFILES.oculto,
];

export function isCharacterProfileId(val: unknown): val is CharacterProfileId {
  return (
    typeof val === "string" &&
    (val === "executivo" || val === "pensativo" || val === "oculto")
  );
}

export function normalizeCharacterProfile(raw: unknown): CharacterProfileId {
  if (typeof raw === "string") {
    const clean = raw.trim().toLowerCase();
    if (isCharacterProfileId(clean)) {
      return clean;
    }
  }
  return DEFAULT_CHARACTER_PROFILE;
}

export function getProfileDefinition(
  rawProfile?: unknown,
): CharacterProfileDefinition {
  return CHARACTER_PROFILES[normalizeCharacterProfile(rawProfile)];
}

export function getProfileBonusForStat(
  statKey: string,
  rawProfile?: unknown,
): number {
  const upper = String(statKey || "").trim().toUpperCase() as DemologiaStatKey;
  const def = getProfileDefinition(rawProfile);
  const bonus = def.bonuses[upper];
  return typeof bonus === "number" && Number.isFinite(bonus) && bonus > 0
    ? bonus
    : 0;
}

/**
 * Retorna o maior bônus que qualquer perfil do sistema pode conceder a um atributo.
 * Usado para garantir que trocar de perfil jamais eleve o LV automaticamente
 * quando um atributo fica temporariamente acima do limite do novo perfil.
 */
export function getMaxPossibleProfileBonusForStat(statKey: string): number {
  const upper = String(statKey || "").trim().toUpperCase() as DemologiaStatKey;
  let maxBonus = 0;
  for (const def of CHARACTER_PROFILE_LIST) {
    const b = def.bonuses[upper];
    if (typeof b === "number" && b > maxBonus) {
      maxBonus = b;
    }
  }
  return maxBonus;
}

export function getProfileBonusEntries(
  rawProfile?: unknown,
): Array<{ stat: DemologiaStatKey; bonus: number }> {
  const def = getProfileDefinition(rawProfile);
  return (Object.entries(def.bonuses) as Array<[DemologiaStatKey, number]>)
    .filter(([, bonus]) => typeof bonus === "number" && bonus > 0)
    .map(([stat, bonus]) => ({ stat, bonus }));
}
