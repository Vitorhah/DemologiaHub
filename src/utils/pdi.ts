export type DemologiaStatKey = "VIT" | "AGL" | "FOR" | "OCU" | "INT" | "SAN";

export const DEMOLOGIA_STAT_KEYS: DemologiaStatKey[] = [
  "VIT",
  "AGL",
  "FOR",
  "OCU",
  "INT",
  "SAN",
];

export const DEMOLOGIA_STAT_LABELS: Record<DemologiaStatKey, string> = {
  VIT: "Vitalidade",
  AGL: "Agilidade",
  FOR: "Força",
  OCU: "Ocultismo",
  INT: "Intelecto",
  SAN: "Sanidade",
};

export const VALID_PDI_DICE = [
  "",
  "1d4",
  "1d6",
  "1d8",
  "1d10",
  "1d12",
  "1d20",
] as const;

export type PdiDiceValue = (typeof VALID_PDI_DICE)[number];

export interface PdiStatModifier {
  buffDice?: PdiDiceValue;
  debuffDice?: PdiDiceValue;
  buffFlat?: number;
  debuffFlat?: number;
}

export interface PdiItem {
  id: string;
  name: string;
  desc: string;
  active: boolean;
  modifiers: Partial<Record<DemologiaStatKey, PdiStatModifier>>;
}

export interface ActivePdiStatBadge {
  key: string;
  pdiId: string;
  pdiName: string;
  type: "buff" | "debuff";
  label: string;
}

export interface PdiModifierChip {
  stat: DemologiaStatKey;
  type: "buff" | "debuff";
  label: string;
}

export const DEFAULT_PDIS: PdiItem[] = [
  {
    id: "pdi_ladino",
    name: "Ladino",
    desc: "Quando nas sombras, recebe bônus de movimentação e furtividade.",
    active: false,
    modifiers: {
      AGL: { buffDice: "1d4" },
    },
  },
];

export function isDemologiaStatKey(key: string): key is DemologiaStatKey {
  const upper = String(key || "").trim().toUpperCase();
  return (DEMOLOGIA_STAT_KEYS as string[]).includes(upper);
}

export function normalizePdis(
  raw: unknown,
  fallback: PdiItem[] = [],
): PdiItem[] {
  if (!Array.isArray(raw)) {
    return fallback.map((item) => ({
      ...item,
      modifiers: clonePdiModifiers(item.modifiers),
    }));
  }

  const validDiceSet = new Set<string>(VALID_PDI_DICE);
  const sanitizeDie = (val: unknown): PdiDiceValue => {
    if (typeof val !== "string") return "";
    const clean = val.trim().toLowerCase().replace(/^[+-]/, "");
    return validDiceSet.has(clean) ? (clean as PdiDiceValue) : "";
  };

  const sanitizeFlat = (val: unknown): number => {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? Math.min(99, Math.floor(n)) : 0;
  };

  const seenIds = new Set<string>();

  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, idx) => {
      const normalizedMods: Partial<Record<DemologiaStatKey, PdiStatModifier>> = {};
      const rawMods =
        item.modifiers && typeof item.modifiers === "object"
          ? (item.modifiers as Record<string, unknown>)
          : {};

      for (const stat of DEMOLOGIA_STAT_KEYS) {
        const m = rawMods[stat];
        if (!m || typeof m !== "object") continue;
        const modObj = m as Record<string, unknown>;

        const buffDice = sanitizeDie(modObj.buffDice);
        const debuffDice = sanitizeDie(modObj.debuffDice);
        const buffFlat = sanitizeFlat(modObj.buffFlat);
        const debuffFlat = sanitizeFlat(modObj.debuffFlat);

        if (buffDice || debuffDice || buffFlat > 0 || debuffFlat > 0) {
          normalizedMods[stat] = {
            ...(buffDice ? { buffDice } : {}),
            ...(debuffDice ? { debuffDice } : {}),
            ...(buffFlat > 0 ? { buffFlat } : {}),
            ...(debuffFlat > 0 ? { debuffFlat } : {}),
          };
        }
      }

      let id =
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim().slice(0, 80)
          : `pdi_${idx}_${Date.now()}`;
      if (seenIds.has(id)) {
        id = `${id}_${idx}`;
      }
      seenIds.add(id);

      const cleanName =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim().slice(0, 80)
          : "Novo PDI";
      const cleanDesc =
        typeof item.desc === "string" ? item.desc.trim().slice(0, 400) : "";

      return {
        id,
        name: cleanName,
        desc: cleanDesc,
        active: Boolean(item.active),
        modifiers: normalizedMods,
      };
    });
}

function clonePdiModifiers(
  modifiers?: Partial<Record<DemologiaStatKey, PdiStatModifier>>,
): Partial<Record<DemologiaStatKey, PdiStatModifier>> {
  const out: Partial<Record<DemologiaStatKey, PdiStatModifier>> = {};
  if (!modifiers) return out;
  for (const stat of DEMOLOGIA_STAT_KEYS) {
    const m = modifiers[stat];
    if (m) out[stat] = { ...m };
  }
  return out;
}

export function buildStatFormulaWithPdis(
  statKey: string,
  baseVal: number | string,
  pdis?: PdiItem[],
): string {
  const upper = String(statKey || "").trim().toUpperCase();
  if (!isDemologiaStatKey(upper)) return String(baseVal);

  const activePdis = normalizePdis(pdis, []).filter((p) => p.active);
  const parts: string[] = [String(baseVal)];

  for (const pdi of activePdis) {
    const mod = pdi.modifiers?.[upper];
    if (!mod) continue;
    if (mod.buffFlat && mod.buffFlat > 0) parts.push(`+${mod.buffFlat}`);
    if (mod.debuffFlat && mod.debuffFlat > 0) parts.push(`-${mod.debuffFlat}`);
    if (mod.buffDice) parts.push(`+${mod.buffDice.toUpperCase()}`);
    if (mod.debuffDice) parts.push(`-${mod.debuffDice.toUpperCase()}`);
  }

  return parts.length > 1 ? `(${parts.join("")})` : parts[0];
}

export function getActivePdiBadgesForStat(
  statKey: string,
  pdis?: PdiItem[],
): ActivePdiStatBadge[] {
  const upper = String(statKey || "").trim().toUpperCase();
  if (!isDemologiaStatKey(upper)) return [];

  const activePdis = normalizePdis(pdis, []).filter((p) => p.active);
  const badges: ActivePdiStatBadge[] = [];

  for (const pdi of activePdis) {
    const mod = pdi.modifiers?.[upper];
    if (!mod) continue;
    if (mod.buffFlat && mod.buffFlat > 0) {
      badges.push({
        key: `${pdi.id}_${upper}_bf`,
        pdiId: pdi.id,
        pdiName: pdi.name,
        type: "buff",
        label: `+${mod.buffFlat}`,
      });
    }
    if (mod.buffDice) {
      badges.push({
        key: `${pdi.id}_${upper}_bd`,
        pdiId: pdi.id,
        pdiName: pdi.name,
        type: "buff",
        label: `+${mod.buffDice.toUpperCase()}`,
      });
    }
    if (mod.debuffFlat && mod.debuffFlat > 0) {
      badges.push({
        key: `${pdi.id}_${upper}_df`,
        pdiId: pdi.id,
        pdiName: pdi.name,
        type: "debuff",
        label: `-${mod.debuffFlat}`,
      });
    }
    if (mod.debuffDice) {
      badges.push({
        key: `${pdi.id}_${upper}_dd`,
        pdiId: pdi.id,
        pdiName: pdi.name,
        type: "debuff",
        label: `-${mod.debuffDice.toUpperCase()}`,
      });
    }
  }

  return badges;
}

export function formatPdiModifierChips(
  modifiers?: Partial<Record<DemologiaStatKey, PdiStatModifier>>,
): PdiModifierChip[] {
  if (!modifiers) return [];
  const chips: PdiModifierChip[] = [];

  for (const stat of DEMOLOGIA_STAT_KEYS) {
    const mod = modifiers[stat];
    if (!mod) continue;
    if (mod.buffFlat && mod.buffFlat > 0) {
      chips.push({ stat, type: "buff", label: `${stat} +${mod.buffFlat}` });
    }
    if (mod.buffDice) {
      chips.push({
        stat,
        type: "buff",
        label: `${stat} +${mod.buffDice.toUpperCase()}`,
      });
    }
    if (mod.debuffFlat && mod.debuffFlat > 0) {
      chips.push({ stat, type: "debuff", label: `${stat} -${mod.debuffFlat}` });
    }
    if (mod.debuffDice) {
      chips.push({
        stat,
        type: "debuff",
        label: `${stat} -${mod.debuffDice.toUpperCase()}`,
      });
    }
  }

  return chips;
}

export function togglePdiActive(pdis: PdiItem[], pdiId: string): PdiItem[] {
  return normalizePdis(pdis, []).map((p) =>
    p.id === pdiId ? { ...p, active: !p.active } : p,
  );
}

export function upsertPdiItem(pdis: PdiItem[], draft: PdiItem): PdiItem[] {
  const normalizedList = normalizePdis(pdis, []);
  const [cleanDraft] = normalizePdis([draft], []);
  if (!cleanDraft) return normalizedList;

  const exists = normalizedList.some((p) => p.id === cleanDraft.id);
  if (exists) {
    return normalizedList.map((p) => (p.id === cleanDraft.id ? cleanDraft : p));
  }
  return [...normalizedList, cleanDraft];
}

export function removePdiItem(pdis: PdiItem[], pdiId: string): PdiItem[] {
  return normalizePdis(pdis, []).filter((p) => p.id !== pdiId);
}

/**
 * Protege a integridade dos PDIs quando um jogador (não-Mestre) salva a ficha:
 * - O jogador PODE alternar `active` (Ligar/Desligar) em PDIs já autorizados pelo Mestre.
 * - O jogador NÃO pode criar, apagar ou alterar nome/descrição/modificadores dos PDIs.
 */
export function protectPlayerPdisOnSave<T extends Record<string, any>>(
  candidateState: T,
  authoritativePdis: PdiItem[] | undefined,
  isMaster: boolean,
): T {
  if (isMaster) {
    return {
      ...candidateState,
      pdis: normalizePdis(candidateState?.pdis, []),
    };
  }

  const authList = normalizePdis(authoritativePdis, []);
  const candidateList = normalizePdis(candidateState?.pdis, []);
  const candidateActiveById = new Map<string, boolean>(
    candidateList.map((p) => [p.id, p.active]),
  );

  const mergedPdis = authList.map((authItem) => ({
    ...authItem,
    active: candidateActiveById.has(authItem.id)
      ? Boolean(candidateActiveById.get(authItem.id))
      : authItem.active,
  }));

  return {
    ...candidateState,
    pdis: mergedPdis,
  };
}
