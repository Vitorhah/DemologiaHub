import {
  DefaultSixStatuses,
  DefaultStatusKey,
  MasterDataPushPayload,
  MasterPushSkillInput,
  MasterPushTributoInput,
} from "../types/masterDataPush";
import { DEFAULT_STATUS_KEYS } from "./statusVariables";
import { clampAttributeForLevel, normalizeLevel } from "./levelSystem";
import { normalizeRitualItem, normalizeRituals } from "./rituals";
import { normalizePdis, upsertPdiItem } from "./pdi";

export const MASTER_PUSH_PREFIX = "MASTER_PUSH_";

export function computeDemologiaMaxStats(variables: Record<string, number> = {}) {
  const findVal = (name: string): number => {
    const entry = Object.entries(variables).find(
      ([k]) => k.trim().toUpperCase() === name.toUpperCase()
    );
    if (entry !== undefined) {
      const parsed = Number(entry[1]);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const vit = findVal("VIT");
  const agl = findVal("AGL");
  const san = findVal("SAN");

  return {
    hpMax: Math.max(1, 20 + vit * 6),
    peMax: Math.max(0, 5 + agl * 3 + san * 2),
    smMax: Math.max(1, 30 + san * 4),
  };
}

/**
 * Extracts strictly the 6 default Demologia status attributes,
 * ignoring any custom extra variables.
 */
export function extractDefaultSixStatuses(
  variables?: Record<string, any> | null
): DefaultSixStatuses {
  const out: DefaultSixStatuses = {
    SAN: 1,
    AGL: 1,
    INT: 1,
    FOR: 1,
    VIT: 1,
    OCU: 1,
  };
  if (!variables || typeof variables !== "object") return out;

  for (const key of DEFAULT_STATUS_KEYS) {
    const match = Object.entries(variables).find(
      ([k]) => k.trim().toUpperCase() === key
    );
    if (match !== undefined) {
      const parsed = Number(match[1]);
      out[key as DefaultStatusKey] = Number.isFinite(parsed) ? Math.round(parsed) : 1;
    }
  }
  return out;
}

export function createEmptySkillDraft(): MasterPushSkillInput {
  return {
    name: "",
    cost: 0,
    desc: "",
    test: "",
    damage: "",
    needsTest: false,
    testVar: "",
    damageVar: "",
    testPostVar: "",
    testPostFormula: "",
    damagePostVar: "",
    damagePostFormula: "",
  };
}

export function createEmptyTributoDraft(): MasterPushTributoInput {
  return {
    name: "",
    desc: "",
    passivo: "",
    ativo: "",
  };
}

export function sanitizeSkillInput(input: MasterPushSkillInput): MasterPushSkillInput {
  const parsedCost = Number(input.cost);
  return {
    name: String(input.name || "").trim(),
    cost: Number.isFinite(parsedCost) ? Math.max(0, Math.round(parsedCost)) : 0,
    desc: String(input.desc || "").trim(),
    test: String(input.test || "").trim(),
    damage: String(input.damage || "").trim(),
    needsTest: Boolean(input.needsTest),
    testVar: String(input.testVar || "").trim(),
    damageVar: String(input.damageVar || "").trim(),
    testPostVar: String(input.testPostVar || "").trim(),
    testPostFormula: String(input.testPostFormula || "").trim(),
    damagePostVar: String(input.damagePostVar || "").trim(),
    damagePostFormula: String(input.damagePostFormula || "").trim(),
  };
}

export function sanitizeTributoInput(input: MasterPushTributoInput): MasterPushTributoInput {
  return {
    name: String(input.name || "").trim(),
    desc: String(input.desc || "").trim(),
    passivo: String(input.passivo || "").trim(),
    ativo: String(input.ativo || "").trim(),
  };
}

export function sanitizeSixStatuses(input: Partial<DefaultSixStatuses>): DefaultSixStatuses {
  return extractDefaultSixStatuses(input as Record<string, any>);
}

export function applyMasterDataToSheetState<T extends Record<string, any>>(
  prevState: T,
  payload: MasterDataPushPayload,
  nowTs: number = Date.now()
): T {
  let next: Record<string, any> = { ...prevState };

  // 1. Append Skill if provided (preserving all Tabletop skill fields)
  if (payload.skill) {
    const existingSkills = Array.isArray(next.skills) ? next.skills : [];
    const maxExistingId = existingSkills.reduce(
      (max: number, s: any) => Math.max(max, Number(s?.id) || 0),
      0
    );
    const newSkillId = Math.max(nowTs, maxExistingId + 1);
    const cleanSkill = sanitizeSkillInput(payload.skill);
    next.skills = [
      ...existingSkills,
      {
        id: newSkillId,
        name: cleanSkill.name || "Nova Skill",
        cost: cleanSkill.cost,
        desc: cleanSkill.desc,
        test: cleanSkill.test,
        damage: cleanSkill.damage,
        needsTest: cleanSkill.needsTest,
        testVar: cleanSkill.testVar || "",
        damageVar: cleanSkill.damageVar || "",
        testPostVar: cleanSkill.testPostVar || "",
        testPostFormula: cleanSkill.testPostFormula || "",
        damagePostVar: cleanSkill.damagePostVar || "",
        damagePostFormula: cleanSkill.damagePostFormula || "",
      },
    ];
  }

  // 2. Replace/set Tributo if provided
  if (payload.tributo) {
    const cleanTrib = sanitizeTributoInput(payload.tributo);
    next.tributo = {
      ...(next.tributo || {}),
      name: cleanTrib.name,
      desc: cleanTrib.desc,
      passivo: cleanTrib.passivo,
      ativo: cleanTrib.ativo,
    };
  }

  // 3. Append Ritual if provided (preserving all existing rituals & full ritual properties)
  if (payload.ritual) {
    const existingRituals = normalizeRituals(next.rituals);
    const maxExistingId = existingRituals.reduce(
      (max: number, r) => Math.max(max, Number(r?.id) || 0),
      0
    );
    const newRitualId = Math.max(nowTs, maxExistingId + 1);
    const cleanRitual = normalizeRitualItem(
      { ...payload.ritual, id: newRitualId },
      newRitualId
    );
    if (cleanRitual) {
      next.rituals = [
        ...existingRituals,
        {
          ...cleanRitual,
          id: newRitualId,
          name: cleanRitual.name.trim() || "Novo Ritual",
        },
      ];
    }
  }

  // 4. Add/upsert PDI if provided (preserving existing PDIs and full modifiers)
  if (payload.pdi) {
    const existingPdis = normalizePdis(next.pdis, []);
    const existingIds = new Set(existingPdis.map((p) => p.id));
    const baseId =
      typeof payload.pdi.id === "string" && payload.pdi.id.trim()
        ? payload.pdi.id.trim()
        : `pdi_${nowTs}`;
    const uniqueId = existingIds.has(baseId)
      ? `${baseId}_${nowTs}`
      : baseId;
    const [cleanPdi] = normalizePdis([{ ...payload.pdi, id: uniqueId }], []);
    if (cleanPdi) {
      next.pdis = upsertPdiItem(existingPdis, cleanPdi);
    }
  }

  // 5. Update ONLY the 6 default statuses, preserving any extra custom variables untouched
  if (payload.statuses) {
    const cleanStatuses = sanitizeSixStatuses(payload.statuses);
    const prevVars: Record<string, number> =
      next.variables && typeof next.variables === "object" ? { ...next.variables } : {};
    const hasExplicitLv = typeof prevState.lv === "number" && Number.isFinite(prevState.lv);
    const activeProfile =
      typeof prevState.profile === "string" ? prevState.profile : undefined;
    const effectiveLv = hasExplicitLv
      ? normalizeLevel(prevState.lv, prevVars, activeProfile)
      : undefined;

    // Remove case-variants of the 6 default keys before writing canonical keys
    for (const existingKey of Object.keys(prevVars)) {
      const upper = existingKey.trim().toUpperCase();
      if ((DEFAULT_STATUS_KEYS as readonly string[]).includes(upper) && existingKey !== upper) {
        delete prevVars[existingKey];
      }
    }
    for (const key of DEFAULT_STATUS_KEYS) {
      prevVars[key] =
        effectiveLv !== undefined
          ? clampAttributeForLevel(cleanStatuses[key], effectiveLv, {
              min: 0,
              statKey: key,
              profile: activeProfile,
            })
          : cleanStatuses[key];
    }

    next.variables = prevVars;
    next.lv =
      effectiveLv !== undefined
        ? effectiveLv
        : normalizeLevel(next.lv, prevVars, activeProfile);

    if (next.autoMaxStats !== false) {
      const { hpMax, peMax, smMax } = computeDemologiaMaxStats(prevVars);
      next.hp = {
        ...(next.hp || {}),
        max: hpMax,
        current: Math.min(Number(next.hp?.current ?? hpMax), hpMax),
      };
      next.pe = {
        ...(next.pe || {}),
        max: peMax,
        current: Math.min(Number(next.pe?.current ?? peMax), peMax),
      };
      next.sm = {
        ...(next.sm || {}),
        max: smMax,
        current: Math.min(Number(next.sm?.current ?? smMax), smMax),
      };
    }
  }

  return next as T;
}

export function summarizeMasterPush(payload: MasterDataPushPayload): string {
  const parts: string[] = [];
  if (payload.ritual) parts.push(`Ritual "${payload.ritual.name}"`);
  if (payload.skill) parts.push(`Skill "${payload.skill.name}"`);
  if (payload.pdi) parts.push(`PDI "${payload.pdi.name}"`);
  if (payload.tributo) parts.push(`Tributo "${payload.tributo.name}"`);
  if (payload.statuses) parts.push("Status Padrões");
  return parts.join(", ");
}
