import type {
  CatalogRitualOption,
  CreatureAttributeKey,
  CreatureFolder,
  CreatureRecord,
  CreatureSkillEntry,
  CreatureSummary,
  CreatureVariables,
  ResolvedCreatureSkill,
} from "../types/masterCreatures";
import type {
  MasterLibraryItem,
  MasterLibrarySkillData,
  MasterLibrarySkillItem,
} from "../types/masterLibrary";
import { DEFAULT_CHARACTER_PROFILE } from "./profiles";
import { normalizeLevel } from "./levelSystem";
import { normalizeRitualAffiliations } from "./rituals";
import { stripCreatureRichTextForPreview } from "./creatureRichText";
import {
  CURRENT_CREATURE_SHEET_VERSION,
  buildDefaultCreatureSheetBlocks,
  normalizeCreatureModes,
  normalizeCreatureRitualRefs,
  normalizeCreatureSheetBlocks,
  resolveCreatureRituals,
} from "./creatureBlocks";

export const CREATURE_RECORD_PREFIX = "CREATURE_";
export const CREATURE_FOLDERS_RECORD_PREFIX = "CREATURE_FOLDERS_";
export const CREATURES_LOCAL_CACHE_PREFIX = "demologia_master_creatures_v1_";
export const CREATURES_MIGRATION_FLAG_PREFIX = "demologia_creatures_legacy_migrated_v1_";

export const CREATURE_ATTRIBUTE_ORDER: readonly CreatureAttributeKey[] = [
  "VIT",
  "AGL",
  "FOR",
  "OCU",
  "INT",
  "SAN",
];

export const CREATURE_ATTRIBUTE_LABELS: Record<CreatureAttributeKey, string> = {
  VIT: "Vitalidade",
  AGL: "Agilidade",
  FOR: "Força",
  OCU: "Ocultismo",
  INT: "Intelecto",
  SAN: "Sanidade",
};

export function createCreatureId(): string {
  return `crt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCreatureFolderId(): string {
  return `cfld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createCreatureSkillEntryId(): string {
  return `csk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getFallbackCreatureRecordId(creatureId: string): string {
  return `${CREATURE_RECORD_PREFIX}${creatureId}`;
}

export function getFallbackFoldersRecordId(masterId: string): string {
  return `${CREATURE_FOLDERS_RECORD_PREFIX}${masterId}`;
}

export function buildCreatureDescriptionPreview(
  description: string | null | undefined,
  maxLen = 140,
): string {
  const clean = stripCreatureRichTextForPreview(String(description ?? ""));
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

export function normalizeCreatureName(raw: unknown): string {
  const clean = typeof raw === "string" ? raw.trim().slice(0, 140) : "";
  return clean || "Nova Criatura";
}

export function normalizeCreatureVariables(raw: unknown): CreatureVariables {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const findVal = (key: CreatureAttributeKey): number => {
    const entry = Object.entries(source).find(
      ([k]) => k.trim().toUpperCase() === key,
    );
    if (entry === undefined) return 1;
    const n = Number(entry[1]);
    if (!Number.isFinite(n)) return 1;
    return Math.max(-20, Math.min(99, Math.trunc(n)));
  };

  return {
    VIT: findVal("VIT"),
    AGL: findVal("AGL"),
    FOR: findVal("FOR"),
    OCU: findVal("OCU"),
    INT: findVal("INT"),
    SAN: findVal("SAN"),
  };
}

/**
 * Fórmulas oficiais do Demologia (idênticas a calculateMaxStats em App.tsx):
 * - PV = max(1, 20 + VIT * 6)
 * - PE = max(0, 5 + AGL * 3 + SAN * 2)
 * - Sanidade = max(1, 30 + SAN * 4)
 */
export function calculateCreatureStats(
  variables: Partial<Record<string, number>> = {},
): { hpMax: number; peMax: number; smMax: number } {
  const normalized = normalizeCreatureVariables(variables);
  const hpMax = Math.max(1, 20 + normalized.VIT * 6);
  const peMax = Math.max(0, 5 + normalized.AGL * 3 + normalized.SAN * 2);
  const smMax = Math.max(1, 30 + normalized.SAN * 4);
  return { hpMax, peMax, smMax };
}

export function createDefaultCreatureSkillData(
  overrides: Partial<MasterLibrarySkillData> = {},
): MasterLibrarySkillData {
  return {
    id:
      typeof overrides.id === "number" && Number.isFinite(overrides.id)
        ? overrides.id
        : Date.now() + Math.floor(Math.random() * 10000),
    name: typeof overrides.name === "string" ? overrides.name : "",
    cost: Math.max(0, Number(overrides.cost) || 0),
    desc: typeof overrides.desc === "string" ? overrides.desc : "",
    needsTest: Boolean(overrides.needsTest),
    test: typeof overrides.test === "string" ? overrides.test : "",
    damage: typeof overrides.damage === "string" ? overrides.damage : "",
    testVar: typeof overrides.testVar === "string" ? overrides.testVar : "",
    damageVar: typeof overrides.damageVar === "string" ? overrides.damageVar : "",
    testPostVar:
      typeof overrides.testPostVar === "string" ? overrides.testPostVar : "",
    testPostFormula:
      typeof overrides.testPostFormula === "string"
        ? overrides.testPostFormula
        : "",
    damagePostVar:
      typeof overrides.damagePostVar === "string"
        ? overrides.damagePostVar
        : "",
    damagePostFormula:
      typeof overrides.damagePostFormula === "string"
        ? overrides.damagePostFormula
        : "",
  };
}

export function normalizeCreatureSkillEntry(raw: unknown): CreatureSkillEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  const ownership = obj.ownership === "linked" ? "linked" : "exclusive";
  const librarySkillId =
    ownership === "linked" && typeof obj.librarySkillId === "string" && obj.librarySkillId.trim()
      ? obj.librarySkillId.trim()
      : null;

  const rawSkill =
    obj.skillData && typeof obj.skillData === "object" ? obj.skillData : obj;
  const skillData = createDefaultCreatureSkillData({
    id: typeof rawSkill.id === "number" ? rawSkill.id : undefined,
    name: typeof rawSkill.name === "string" ? rawSkill.name.trim() : "",
    cost: Number(rawSkill.cost) || 0,
    desc: typeof rawSkill.desc === "string" ? rawSkill.desc : "",
    needsTest: Boolean(rawSkill.needsTest),
    test: typeof rawSkill.test === "string" ? rawSkill.test : "",
    damage: typeof rawSkill.damage === "string" ? rawSkill.damage : "",
    testVar: typeof rawSkill.testVar === "string" ? rawSkill.testVar : "",
    damageVar: typeof rawSkill.damageVar === "string" ? rawSkill.damageVar : "",
    testPostVar: typeof rawSkill.testPostVar === "string" ? rawSkill.testPostVar : "",
    testPostFormula:
      typeof rawSkill.testPostFormula === "string" ? rawSkill.testPostFormula : "",
    damagePostVar:
      typeof rawSkill.damagePostVar === "string" ? rawSkill.damagePostVar : "",
    damagePostFormula:
      typeof rawSkill.damagePostFormula === "string" ? rawSkill.damagePostFormula : "",
  });

  if (ownership === "exclusive" && !skillData.name) {
    return null;
  }

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : createCreatureSkillEntryId(),
    ownership: librarySkillId ? "linked" : "exclusive",
    librarySkillId,
    skillData,
  };
}

export function normalizeCreatureSkills(raw: unknown): CreatureSkillEntry[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenLibraryIds = new Set<string>();
  const result: CreatureSkillEntry[] = [];

  for (const item of raw) {
    const entry = normalizeCreatureSkillEntry(item);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    if (entry.ownership === "linked" && entry.librarySkillId) {
      if (seenLibraryIds.has(entry.librarySkillId)) continue;
      seenLibraryIds.add(entry.librarySkillId);
    }
    seenIds.add(entry.id);
    result.push(entry);
  }
  return result;
}

export function normalizeCreatureRecord(
  raw: unknown,
  masterIdFallback: string,
): CreatureRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  const id =
    typeof obj.id === "string" && obj.id.trim()
      ? obj.id.trim()
      : createCreatureId();
  const masterId =
    typeof obj.masterId === "string" && obj.masterId.trim()
      ? obj.masterId.trim()
      : typeof obj.master_id === "string" && obj.master_id.trim()
        ? obj.master_id.trim()
        : masterIdFallback;

  const variables = normalizeCreatureVariables(obj.variables);
  const { hpMax, peMax, smMax } = calculateCreatureStats(variables);
  const description = typeof obj.description === "string" ? obj.description : "";
  const lv = normalizeLevel(obj.lv, variables);
  const affiliations = normalizeRitualAffiliations(obj.affiliations);
  const skills = normalizeCreatureSkills(obj.skills);
  const rituals = normalizeCreatureRitualRefs(obj.rituals);
  const modes = normalizeCreatureModes(obj.modes);
  const rawBlocks = obj.sheetBlocks ?? obj.sheet_blocks;
  const sheetBlocks = normalizeCreatureSheetBlocks(rawBlocks);
  const rawVersion = Number(obj.sheetVersion ?? obj.sheet_version);
  const sheetVersion =
    Number.isFinite(rawVersion) && rawVersion >= 1
      ? Math.floor(rawVersion)
      : sheetBlocks.length > 0
        ? CURRENT_CREATURE_SHEET_VERSION
        : 1;
  const now = Date.now();
  const createdAt =
    typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt)
      ? obj.createdAt
      : typeof obj.created_at === "string"
        ? Date.parse(obj.created_at) || now
        : now;
  const updatedAt =
    typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
      ? obj.updatedAt
      : typeof obj.updated_at === "string"
        ? Date.parse(obj.updated_at) || now
        : now;

  return {
    id,
    masterId,
    name: normalizeCreatureName(obj.name),
    folderId:
      typeof obj.folderId === "string" && obj.folderId.trim()
        ? obj.folderId.trim()
        : typeof obj.folder_id === "string" && obj.folder_id.trim()
          ? obj.folder_id.trim()
          : null,
    description,
    descriptionPreview: buildCreatureDescriptionPreview(description),
    lv,
    affiliations,
    variables,
    hpMax,
    peMax,
    smMax,
    skills,
    skillsCount: skills.length,
    rituals,
    modes,
    sheetBlocks,
    sheetVersion,
    legacyExtraId:
      typeof obj.legacyExtraId === "string" && obj.legacyExtraId.trim()
        ? obj.legacyExtraId.trim()
        : typeof obj.legacy_extra_id === "string" && obj.legacy_extra_id.trim()
          ? obj.legacy_extra_id.trim()
          : null,
    createdAt,
    updatedAt,
  };
}

export function createNewCreatureDraft(
  masterId: string,
  folderId: string | null = null,
  overrides: Partial<CreatureRecord> = {},
): CreatureRecord {
  const now = Date.now();
  const variables = normalizeCreatureVariables(overrides.variables);
  const { hpMax, peMax, smMax } = calculateCreatureStats(variables);
  const description = overrides.description ?? "";
  const lv = normalizeLevel(overrides.lv ?? 1, variables);
  const affiliations = normalizeRitualAffiliations(overrides.affiliations ?? []);
  const skills = normalizeCreatureSkills(overrides.skills ?? []);
  const rituals = normalizeCreatureRitualRefs(overrides.rituals ?? []);
  const modes = normalizeCreatureModes(overrides.modes ?? []);
  const sheetBlocks =
    overrides.sheetBlocks && overrides.sheetBlocks.length > 0
      ? normalizeCreatureSheetBlocks(overrides.sheetBlocks)
      : buildDefaultCreatureSheetBlocks({
          includeRituals: rituals.length > 0,
          includeModes: modes.length > 0,
        });

  return {
    id: overrides.id || createCreatureId(),
    masterId,
    name: normalizeCreatureName(overrides.name || "Nova Criatura"),
    folderId: overrides.folderId !== undefined ? overrides.folderId : folderId,
    description,
    descriptionPreview: buildCreatureDescriptionPreview(description),
    lv,
    affiliations,
    variables,
    hpMax,
    peMax,
    smMax,
    skills,
    skillsCount: skills.length,
    rituals,
    modes,
    sheetBlocks,
    sheetVersion: overrides.sheetVersion ?? CURRENT_CREATURE_SHEET_VERSION,
    legacyExtraId: overrides.legacyExtraId ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function toCreatureSummary(record: CreatureRecord): CreatureSummary {
  const { hpMax, peMax, smMax } = calculateCreatureStats(record.variables);
  return {
    id: record.id,
    masterId: record.masterId,
    name: normalizeCreatureName(record.name),
    folderId: record.folderId,
    description: typeof record.description === "string" ? record.description : "",
    descriptionPreview: buildCreatureDescriptionPreview(record.description),
    lv: normalizeLevel(record.lv, record.variables),
    affiliations: normalizeRitualAffiliations(record.affiliations),
    hpMax,
    peMax,
    smMax,
    skillsCount: record.skills.length,
    legacyExtraId: record.legacyExtraId ?? null,
    updatedAt: record.updatedAt,
  };
}

export function sortCreatureSummaries(
  list: CreatureSummary[],
): CreatureSummary[] {
  return [...list].sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

// ============================================================================
// PASTAS HIERÁRQUICAS DE CRIATURAS
// ============================================================================

export function normalizeCreatureFolders(
  raw: unknown,
  masterIdFallback: string,
): CreatureFolder[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, CreatureFolder>();
  const now = Date.now();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, any>;
    const id = typeof obj.id === "string" ? obj.id.trim() : "";
    const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 80) : "";
    if (!id || !name || byId.has(id)) continue;

    const parentRaw =
      typeof obj.parentId === "string"
        ? obj.parentId.trim()
        : typeof obj.parent_id === "string"
          ? obj.parent_id.trim()
          : "";
    const createdAt =
      typeof obj.createdAt === "number"
        ? obj.createdAt
        : typeof obj.created_at === "string"
          ? Date.parse(obj.created_at) || now
          : now;
    const updatedAt =
      typeof obj.updatedAt === "number"
        ? obj.updatedAt
        : typeof obj.updated_at === "string"
          ? Date.parse(obj.updated_at) || now
          : now;

    byId.set(id, {
      id,
      masterId:
        typeof obj.masterId === "string" && obj.masterId.trim()
          ? obj.masterId.trim()
          : typeof obj.master_id === "string" && obj.master_id.trim()
            ? obj.master_id.trim()
            : masterIdFallback,
      name,
      parentId: parentRaw && parentRaw !== id ? parentRaw : null,
      createdAt,
      updatedAt,
    });
  }

  // Prevent cycles or dangling parentIds
  const result: CreatureFolder[] = [];
  for (const folder of byId.values()) {
    let parentId = folder.parentId;
    if (parentId && !byId.has(parentId)) {
      parentId = null;
    } else if (parentId) {
      const visited = new Set<string>([folder.id]);
      let cursor: string | null = parentId;
      while (cursor) {
        if (visited.has(cursor)) {
          parentId = null;
          break;
        }
        visited.add(cursor);
        cursor = byId.get(cursor)?.parentId ?? null;
      }
    }
    result.push({ ...folder, parentId });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function createCreatureFolderEntry(
  folders: CreatureFolder[],
  masterId: string,
  name: string,
  parentId: string | null = null,
):
  | { ok: true; folder: CreatureFolder; folders: CreatureFolder[] }
  | { ok: false; error: string } {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) {
    return { ok: false, error: "Informe um nome para a pasta." };
  }
  const effectiveParent =
    parentId && folders.some((f) => f.id === parentId) ? parentId : null;
  const duplicate = folders.some(
    (f) =>
      f.parentId === effectiveParent &&
      f.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Já existe uma pasta chamada "${cleanName}" neste diretório.`,
    };
  }

  const now = Date.now();
  const folder: CreatureFolder = {
    id: createCreatureFolderId(),
    masterId,
    name: cleanName,
    parentId: effectiveParent,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ok: true,
    folder,
    folders: [...folders, folder].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    ),
  };
}

export function renameCreatureFolderEntry(
  folders: CreatureFolder[],
  folderId: string,
  newName: string,
): { ok: true; folders: CreatureFolder[] } | { ok: false; error: string } {
  const target = folders.find((f) => f.id === folderId);
  if (!target) {
    return { ok: false, error: "Pasta não encontrada." };
  }
  const cleanName = newName.trim().slice(0, 80);
  if (!cleanName) {
    return { ok: false, error: "Informe um nome válido para a pasta." };
  }
  const duplicate = folders.some(
    (f) =>
      f.id !== folderId &&
      f.parentId === target.parentId &&
      f.name.toLowerCase() === cleanName.toLowerCase(),
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Já existe uma pasta chamada "${cleanName}" neste diretório.`,
    };
  }
  const now = Date.now();
  const next = folders
    .map((f) =>
      f.id === folderId ? { ...f, name: cleanName, updatedAt: now } : f,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { ok: true, folders: next };
}

export function deleteCreatureFolderEntry(
  folders: CreatureFolder[],
  summaries: CreatureSummary[],
  folderId: string,
): {
  folders: CreatureFolder[];
  summaries: CreatureSummary[];
  reassignedCreatureIds: string[];
  targetParentId: string | null;
} {
  const target = folders.find((f) => f.id === folderId);
  const targetParentId = target?.parentId ?? null;
  const now = Date.now();

  const nextFolders = folders
    .filter((f) => f.id !== folderId)
    .map((f) =>
      f.parentId === folderId
        ? { ...f, parentId: targetParentId, updatedAt: now }
        : f,
    );

  const reassignedCreatureIds: string[] = [];
  const nextSummaries = summaries.map((c) => {
    if (c.folderId === folderId) {
      reassignedCreatureIds.push(c.id);
      return { ...c, folderId: targetParentId, updatedAt: now };
    }
    return c;
  });

  return {
    folders: nextFolders,
    summaries: nextSummaries,
    reassignedCreatureIds,
    targetParentId,
  };
}

export function getCreatureFolderBreadcrumb(
  folders: CreatureFolder[],
  folderId: string | null,
): CreatureFolder[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: CreatureFolder[] = [];
  const visited = new Set<string>();
  let cursor: string | null = folderId;
  while (cursor && !visited.has(cursor)) {
    const f = byId.get(cursor);
    if (!f) break;
    visited.add(cursor);
    chain.unshift(f);
    cursor = f.parentId;
  }
  return chain;
}

export function getCreatureFolderPathLabel(
  folders: CreatureFolder[],
  folderId: string | null,
): string {
  const chain = getCreatureFolderBreadcrumb(folders, folderId);
  if (chain.length === 0) return "Raiz";
  return chain.map((f) => f.name).join(" / ");
}

export function getCreatureFolderStats(
  folders: CreatureFolder[],
  summaries: CreatureSummary[],
  folderId: string,
): { directCreatures: number; directSubfolders: number; totalCreatures: number } {
  const directCreatures = summaries.filter((c) => c.folderId === folderId).length;
  const directSubfolders = folders.filter((f) => f.parentId === folderId).length;

  const descendantIds = new Set<string>([folderId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const f of folders) {
      if (f.parentId && descendantIds.has(f.parentId) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        expanded = true;
      }
    }
  }
  const totalCreatures = summaries.filter(
    (c) => c.folderId !== null && descendantIds.has(c.folderId),
  ).length;

  return { directCreatures, directSubfolders, totalCreatures };
}

export function filterCreatureSummaries(
  summaries: CreatureSummary[],
  options: {
    currentFolderId: string | null;
    search: string;
    searchAllFolders?: boolean;
  },
): CreatureSummary[] {
  const q = options.search.trim().toLowerCase();
  const inScope =
    q && options.searchAllFolders !== false
      ? summaries
      : summaries.filter((c) => c.folderId === options.currentFolderId);

  const filtered = q
    ? inScope.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.descriptionPreview.toLowerCase().includes(q),
      )
    : inScope;

  return sortCreatureSummaries(filtered);
}

// ============================================================================
// SISTEMA DE SKILLS (PRÓPRIAS vs. VINCULADAS DA BIBLIOTECA)
// ============================================================================

export function extractLibrarySkills(
  libraryItems: MasterLibraryItem[],
): MasterLibrarySkillItem[] {
  return libraryItems.filter(
    (it): it is MasterLibrarySkillItem => it.type === "skill",
  );
}

/**
 * Resolve as Skills de uma criatura combinando Skills próprias e dados vivos
 * das Skills vinculadas na Biblioteca.
 */
export function resolveCreatureSkills(
  entries: CreatureSkillEntry[],
  libraryItems: MasterLibraryItem[],
): ResolvedCreatureSkill[] {
  const libById = new Map<string, MasterLibrarySkillItem>();
  for (const item of libraryItems) {
    if (item.type === "skill") {
      libById.set(item.id, item);
    }
  }

  return entries.map((entry) => {
    if (entry.ownership === "linked" && entry.librarySkillId) {
      const libSkill = libById.get(entry.librarySkillId);
      if (libSkill) {
        return {
          entry,
          resolvedData: createDefaultCreatureSkillData(libSkill.data),
          isLibraryMissing: false,
        };
      }
      return {
        entry,
        resolvedData: createDefaultCreatureSkillData(entry.skillData),
        isLibraryMissing: true,
      };
    }

    return {
      entry,
      resolvedData: createDefaultCreatureSkillData(entry.skillData),
      isLibraryMissing: false,
    };
  });
}

export function addExclusiveSkillToCreature(
  creature: CreatureRecord,
  draft: MasterLibrarySkillData,
): { ok: true; creature: CreatureRecord; entry: CreatureSkillEntry } | { ok: false; error: string } {
  const cleanName = draft.name.trim();
  if (!cleanName) {
    return { ok: false, error: "Informe o nome da Skill." };
  }
  const entry: CreatureSkillEntry = {
    id: createCreatureSkillEntryId(),
    ownership: "exclusive",
    librarySkillId: null,
    skillData: createDefaultCreatureSkillData({ ...draft, name: cleanName }),
  };
  const nextSkills = [...creature.skills, entry];
  return {
    ok: true,
    entry,
    creature: {
      ...creature,
      skills: nextSkills,
      skillsCount: nextSkills.length,
      updatedAt: Date.now(),
    },
  };
}

export function updateExclusiveCreatureSkill(
  creature: CreatureRecord,
  entryId: string,
  draft: MasterLibrarySkillData,
): { ok: true; creature: CreatureRecord } | { ok: false; error: string } {
  const cleanName = draft.name.trim();
  if (!cleanName) {
    return { ok: false, error: "Informe o nome da Skill." };
  }
  const target = creature.skills.find((s) => s.id === entryId);
  if (!target) {
    return { ok: false, error: "Skill não encontrada nesta criatura." };
  }
  const nextSkills = creature.skills.map((s) =>
    s.id === entryId
      ? {
          ...s,
          ownership: "exclusive" as const,
          librarySkillId: null,
          skillData: createDefaultCreatureSkillData({ ...draft, name: cleanName }),
        }
      : s,
  );
  return {
    ok: true,
    creature: {
      ...creature,
      skills: nextSkills,
      skillsCount: nextSkills.length,
      updatedAt: Date.now(),
    },
  };
}

export function linkLibrarySkillToCreature(
  creature: CreatureRecord,
  librarySkill: MasterLibrarySkillItem,
): { ok: true; creature: CreatureRecord; entry: CreatureSkillEntry } | { ok: false; error: string } {
  const alreadyLinked = creature.skills.some(
    (s) => s.ownership === "linked" && s.librarySkillId === librarySkill.id,
  );
  if (alreadyLinked) {
    return {
      ok: false,
      error: `A Skill "${librarySkill.data.name}" já está vinculada a esta criatura.`,
    };
  }

  const entry: CreatureSkillEntry = {
    id: createCreatureSkillEntryId(),
    ownership: "linked",
    librarySkillId: librarySkill.id,
    skillData: createDefaultCreatureSkillData(librarySkill.data),
  };
  const nextSkills = [...creature.skills, entry];
  return {
    ok: true,
    entry,
    creature: {
      ...creature,
      skills: nextSkills,
      skillsCount: nextSkills.length,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Remove uma Skill da criatura:
 * - Se for "linked", apenas desvincula (nunca exclui a Skill original da Biblioteca).
 * - Se for "exclusive", remove a Skill exclusiva desta criatura.
 */
export function removeSkillFromCreature(
  creature: CreatureRecord,
  entryId: string,
): CreatureRecord {
  const nextSkills = creature.skills.filter((s) => s.id !== entryId);
  return {
    ...creature,
    skills: nextSkills,
    skillsCount: nextSkills.length,
    updatedAt: Date.now(),
  };
}

/**
 * Converte uma Skill vinculada em uma cópia exclusiva da criatura para edição livre
 * sem modificar a Skill compartilhada da Biblioteca.
 */
export function detachLinkedSkillToExclusive(
  creature: CreatureRecord,
  entryId: string,
  libraryItems: MasterLibraryItem[],
): CreatureRecord {
  const resolved = resolveCreatureSkills(creature.skills, libraryItems);
  const nextSkills = resolved.map((item) => {
    if (item.entry.id !== entryId) return item.entry;
    return {
      ...item.entry,
      ownership: "exclusive" as const,
      librarySkillId: null,
      skillData: createDefaultCreatureSkillData({
        ...item.resolvedData,
        id: Date.now() + Math.floor(Math.random() * 10000),
      }),
    };
  });
  return {
    ...creature,
    skills: nextSkills,
    skillsCount: nextSkills.length,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// INVOCAÇÃO NA SESSÃO ATIVA (MÚLTIPLOS EXEMPLARES INDEPENDENTES)
// ============================================================================

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildNextInvokedInstanceName(
  baseName: string,
  existingSessionNames: string[],
): string {
  const cleanBase = normalizeCreatureName(baseName);
  const pattern = new RegExp(`^${escapeRegex(cleanBase)}(?:\\s+#(\\d+))?$`, "i");

  const usedNumbers = new Set<number>();
  for (const name of existingSessionNames) {
    const match = String(name || "").trim().match(pattern);
    if (!match) continue;
    const num = match[1] ? parseInt(match[1], 10) : 1;
    if (Number.isFinite(num) && num >= 1) {
      usedNumbers.add(num);
    }
  }

  if (usedNumbers.size === 0) {
    return cleanBase;
  }

  let candidate = 2;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }
  return `${cleanBase} #${candidate}`;
}

export function buildInvokedSessionSheetFromCreature(
  creature: CreatureRecord,
  libraryItems: MasterLibraryItem[],
  existingSessionNames: string[],
  defaultSheetBase: Record<string, any> = {},
  ritualCatalog?: CatalogRitualOption[],
): Record<string, any> {
  const variables = normalizeCreatureVariables(creature.variables);
  const { hpMax, peMax, smMax } = calculateCreatureStats(variables);
  const lv = normalizeLevel(creature.lv, variables);
  const resolvedSkills = resolveCreatureSkills(creature.skills, libraryItems);
  const resolvedRituals = ritualCatalog
    ? resolveCreatureRituals(creature.rituals || [], ritualCatalog).map((item, idx) => ({
        ...item.ritual,
        id: Date.now() + idx * 31 + Math.floor(Math.random() * 100),
      }))
    : (creature.rituals || [])
        .filter((r) => Boolean(r.fallbackSnapshot))
        .map((r, idx) => ({
          ...r.fallbackSnapshot!,
          id: Date.now() + idx * 31 + Math.floor(Math.random() * 100),
        }));
  const instanceId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const instanceName = buildNextInvokedInstanceName(
    creature.name,
    existingSessionNames,
  );

  const sheetSkills = resolvedSkills.map((item, idx) => ({
    ...item.resolvedData,
    id: Date.now() + idx * 17 + Math.floor(Math.random() * 100),
  }));

  const sheetPdis = normalizeCreatureModes(creature.modes || []).map((mode) => ({
    id: mode.id,
    name: mode.name,
    desc: mode.desc,
    active: mode.active,
    modifiers: { ...mode.modifiers },
  }));

  return {
    ...defaultSheetBase,
    id: instanceId,
    name: instanceName,
    hp: { current: hpMax, max: hpMax },
    pe: { current: peMax, max: peMax },
    sm: { current: smMax, max: smMax },
    san: { current: smMax, max: smMax },
    ep: 0,
    lv,
    autoMaxStats: true,
    variables: { ...variables },
    skills: sheetSkills,
    notes: creature.description || "",
    statusEffects: [],
    customFormulas: [],
    pdis: sheetPdis,
    rituals: resolvedRituals,
    profile: DEFAULT_CHARACTER_PROFILE,
    synchronized: true,
    sourceCreatureId: creature.id,
    invokedAt: Date.now(),
    last_local_edit: Date.now(),
  };
}

export function buildInvokedSessionSheetsBatch(
  creature: CreatureRecord,
  quantity: number,
  libraryItems: MasterLibraryItem[],
  existingSessionNames: string[],
  defaultSheetBase: Record<string, any> = {},
  ritualCatalog?: CatalogRitualOption[],
): Record<string, any>[] {
  const count = Math.max(1, Math.min(10, Math.trunc(Number(quantity) || 1)));
  const namesCursor = [...existingSessionNames];
  const created: Record<string, any>[] = [];

  for (let i = 0; i < count; i += 1) {
    const sheet = buildInvokedSessionSheetFromCreature(
      creature,
      libraryItems,
      namesCursor,
      defaultSheetBase,
      ritualCatalog,
    );
    namesCursor.push(sheet.name);
    created.push(sheet);
  }
  return created;
}

// ============================================================================
// MIGRAÇÃO AUTOMÁTICA IDEMPOTENTE DE FICHAS EXTRAS LEGADAS
// ============================================================================

export function buildCreatureFromLegacyExtra(
  legacyExtra: Record<string, any>,
  masterId: string,
): CreatureRecord | null {
  if (!legacyExtra || typeof legacyExtra !== "object") return null;
  const legacyId = typeof legacyExtra.id === "string" ? legacyExtra.id.trim() : "";
  if (!legacyId) return null;

  // Não re-migra instâncias que já foram invocadas a partir da Biblioteca de Criaturas
  if (typeof legacyExtra.sourceCreatureId === "string" && legacyExtra.sourceCreatureId.trim()) {
    return null;
  }

  const variables = normalizeCreatureVariables(legacyExtra.variables);
  const { hpMax, peMax, smMax } = calculateCreatureStats(variables);
  const lv = normalizeLevel(legacyExtra.lv, variables);
  const rawSkills = Array.isArray(legacyExtra.skills) ? legacyExtra.skills : [];
  const skills: CreatureSkillEntry[] = rawSkills
    .filter((s: any) => s && typeof s === "object" && typeof s.name === "string" && s.name.trim())
    .map((s: any) => ({
      id: createCreatureSkillEntryId(),
      ownership: "exclusive" as const,
      librarySkillId: null,
      skillData: createDefaultCreatureSkillData({
        id: typeof s.id === "number" ? s.id : undefined,
        name: String(s.name).trim(),
        cost: Number(s.cost) || 0,
        desc: typeof s.desc === "string" ? s.desc : "",
        needsTest: Boolean(s.needsTest),
        test: typeof s.test === "string" ? s.test : "",
        damage: typeof s.damage === "string" ? s.damage : "",
        testVar: typeof s.testVar === "string" ? s.testVar : "",
        damageVar: typeof s.damageVar === "string" ? s.damageVar : "",
        testPostVar: typeof s.testPostVar === "string" ? s.testPostVar : "",
        testPostFormula: typeof s.testPostFormula === "string" ? s.testPostFormula : "",
        damagePostVar: typeof s.damagePostVar === "string" ? s.damagePostVar : "",
        damagePostFormula:
          typeof s.damagePostFormula === "string" ? s.damagePostFormula : "",
      }),
    }));

  const modes = normalizeCreatureModes(legacyExtra.pdis);
  const description = typeof legacyExtra.notes === "string" ? legacyExtra.notes : "";
  const now = Date.now();

  return {
    id: createCreatureId(),
    masterId,
    name: normalizeCreatureName(legacyExtra.name || "Criatura Migrada"),
    folderId: null,
    description,
    descriptionPreview: buildCreatureDescriptionPreview(description),
    lv,
    affiliations: [],
    variables,
    hpMax,
    peMax,
    smMax,
    skills,
    skillsCount: skills.length,
    rituals: [],
    modes,
    sheetBlocks: buildDefaultCreatureSheetBlocks({
      includeModes: modes.length > 0,
    }),
    sheetVersion: CURRENT_CREATURE_SHEET_VERSION,
    legacyExtraId: legacyId,
    createdAt: now,
    updatedAt: now,
  };
}

export function findUnmigratedLegacyExtras(
  extraFichas: Record<string, any>[],
  existingSummaries: CreatureSummary[],
): Record<string, any>[] {
  const alreadyMigratedIds = new Set<string>();
  for (const summary of existingSummaries) {
    if (summary.legacyExtraId) {
      alreadyMigratedIds.add(summary.legacyExtraId);
    }
  }

  return extraFichas.filter((extra) => {
    if (!extra || typeof extra !== "object") return false;
    const id = typeof extra.id === "string" ? extra.id.trim() : "";
    if (!id) return false;
    if (typeof extra.sourceCreatureId === "string" && extra.sourceCreatureId.trim()) {
      return false;
    }
    return !alreadyMigratedIds.has(id);
  });
}
