import {
  DefaultSixStatuses,
  DefaultStatusKey,
  MasterDataPushPayload,
  MasterPushSkillInput,
  MasterPushTributoInput,
} from "../types/masterDataPush";
import { DEFAULT_STATUS_KEYS } from "./statusVariables";

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

  // 1. Append Skill if provided
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
        testVar: "",
        damageVar: "",
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

  // 3. Update ONLY the 6 default statuses, preserving any extra custom variables untouched
  if (payload.statuses) {
    const cleanStatuses = sanitizeSixStatuses(payload.statuses);
    const prevVars: Record<string, number> =
      next.variables && typeof next.variables === "object" ? { ...next.variables } : {};

    // Remove case-variants of the 6 default keys before writing canonical keys
    for (const existingKey of Object.keys(prevVars)) {
      const upper = existingKey.trim().toUpperCase();
      if ((DEFAULT_STATUS_KEYS as readonly string[]).includes(upper) && existingKey !== upper) {
        delete prevVars[existingKey];
      }
    }
    for (const key of DEFAULT_STATUS_KEYS) {
      prevVars[key] = cleanStatuses[key];
    }

    next.variables = prevVars;

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
  if (payload.skill) parts.push(`Skill "${payload.skill.name}"`);
  if (payload.tributo) parts.push(`Tributo "${payload.tributo.name}"`);
  if (payload.statuses) parts.push("Status Padrões");
  return parts.join(", ");
}
