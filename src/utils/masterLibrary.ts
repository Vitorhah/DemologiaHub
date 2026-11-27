import {
  MasterLibraryExportEnvelope,
  MasterLibraryFolder,
  MasterLibraryItem,
  MasterLibraryItemType,
  MasterLibrarySkillData,
  MasterLibraryTributoData,
} from "../types/masterLibrary";
import { MasterDataPushPayload } from "../types/masterDataPush";
import {
  DEFAULT_RITUAL_DIFFICULTY,
  RitualItem,
  createDefaultRitual,
  getRitualAffiliationDefinition,
  isRitualAffiliationId,
  normalizeRitualItem,
} from "./rituals";
import {
  DEMOLOGIA_STAT_KEYS,
  PdiItem,
  VALID_PDI_DICE,
  normalizePdis,
} from "./pdi";
import {
  createEmptySkillDraft,
  createEmptyTributoDraft,
  sanitizeSkillInput,
  sanitizeTributoInput,
} from "./masterDataPush";

export const MASTER_LIBRARY_RECORD_ID = "MASTER_LIBRARY";
export const MASTER_LIBRARY_LOCAL_KEY = "demologia_master_library_v1";
export const MASTER_LIBRARY_JSON_FORMAT = "demologia-library-item";
export const MASTER_LIBRARY_JSON_VERSION = 1;
export const MAX_LIBRARY_JSON_BYTES = 512 * 1024; // 512 KB

const VALID_ITEM_TYPES: readonly MasterLibraryItemType[] = [
  "ritual",
  "skill",
  "pdi",
  "tributo",
];

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function stripDangerousKeys<T>(value: T, depth = 0): T {
  if (depth > 12 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stripDangerousKeys(entry, depth + 1)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    clean[k] = stripDangerousKeys(v, depth + 1);
  }
  return clean as T;
}

export function isMasterLibraryItemType(val: unknown): val is MasterLibraryItemType {
  return (
    typeof val === "string" &&
    (VALID_ITEM_TYPES as readonly string[]).includes(val.trim().toLowerCase())
  );
}

export function createDefaultSkillData(id: number = Date.now()): MasterLibrarySkillData {
  const base = createEmptySkillDraft();
  return {
    id,
    name: base.name,
    cost: base.cost,
    desc: base.desc,
    test: base.test,
    damage: base.damage,
    needsTest: base.needsTest,
    testVar: "",
    damageVar: "",
    testPostVar: "",
    testPostFormula: "",
    damagePostVar: "",
    damagePostFormula: "",
  };
}

export function createDefaultPdiData(now: number = Date.now()): PdiItem {
  return {
    id: `pdi_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    desc: "",
    active: false,
    modifiers: {},
  };
}

export function createDefaultTributoData(): MasterLibraryTributoData {
  return createEmptyTributoDraft();
}

export function createDefaultRitualData(id: number = Date.now()): RitualItem {
  return createDefaultRitual(id);
}

export function normalizeLibrarySkillData(
  raw: unknown,
  fallbackId: number = Date.now()
): MasterLibrarySkillData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const parsedId = Number(r.id);
  const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : fallbackId;
  const sanitized = sanitizeSkillInput({
    name: typeof r.name === "string" ? r.name : "",
    cost: Number(r.cost ?? 0),
    desc: typeof r.desc === "string" ? r.desc : "",
    test: typeof r.test === "string" ? r.test : "",
    damage: typeof r.damage === "string" ? r.damage : "",
    needsTest: Boolean(r.needsTest),
    testVar: typeof r.testVar === "string" ? r.testVar : "",
    damageVar: typeof r.damageVar === "string" ? r.damageVar : "",
    testPostVar: typeof r.testPostVar === "string" ? r.testPostVar : "",
    testPostFormula: typeof r.testPostFormula === "string" ? r.testPostFormula : "",
    damagePostVar: typeof r.damagePostVar === "string" ? r.damagePostVar : "",
    damagePostFormula: typeof r.damagePostFormula === "string" ? r.damagePostFormula : "",
  });
  return {
    id,
    name: sanitized.name,
    cost: sanitized.cost,
    desc: sanitized.desc,
    test: sanitized.test,
    damage: sanitized.damage,
    needsTest: sanitized.needsTest,
    testVar: sanitized.testVar || "",
    damageVar: sanitized.damageVar || "",
    testPostVar: sanitized.testPostVar || "",
    testPostFormula: sanitized.testPostFormula || "",
    damagePostVar: sanitized.damagePostVar || "",
    damagePostFormula: sanitized.damagePostFormula || "",
  };
}

export function normalizeLibraryTributoData(raw: unknown): MasterLibraryTributoData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return sanitizeTributoInput({
    name: typeof r.name === "string" ? r.name : "",
    desc: typeof r.desc === "string" ? r.desc : "",
    passivo: typeof r.passivo === "string" ? r.passivo : "",
    ativo: typeof r.ativo === "string" ? r.ativo : "",
  });
}

export function normalizeLibraryFolder(
  raw: unknown,
  now: number = Date.now()
): MasterLibraryFolder | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  const id = typeof f.id === "string" && f.id.trim() ? f.id.trim().slice(0, 80) : "";
  const name = typeof f.name === "string" ? f.name.trim().slice(0, 80) : "";
  if (!id || !name) return null;
  const parentId =
    typeof f.parentId === "string" && f.parentId.trim() && f.parentId.trim() !== id
      ? f.parentId.trim().slice(0, 80)
      : null;
  return {
    id,
    name,
    parentId,
    createdAt: typeof f.createdAt === "number" && Number.isFinite(f.createdAt) ? f.createdAt : now,
    updatedAt: typeof f.updatedAt === "number" && Number.isFinite(f.updatedAt) ? f.updatedAt : now,
  };
}

export function normalizeLibraryFolders(raw: unknown): MasterLibraryFolder[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: MasterLibraryFolder[] = [];
  for (const entry of raw) {
    const normalized = normalizeLibraryFolder(entry);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    list.push(normalized);
  }
  // Ensure parentId points to an existing folder and contains no cycle
  const idSet = new Set(list.map((f) => f.id));
  const cleaned = list.map((f) => ({
    ...f,
    parentId: f.parentId && idSet.has(f.parentId) ? f.parentId : null,
  }));
  // Break any accidental cycles
  const byId = new Map(cleaned.map((f) => [f.id, f]));
  return cleaned.map((folder) => {
    const visited = new Set<string>([folder.id]);
    let curr = folder.parentId;
    while (curr) {
      if (visited.has(curr)) {
        return { ...folder, parentId: null };
      }
      visited.add(curr);
      curr = byId.get(curr)?.parentId ?? null;
    }
    return folder;
  });
}

export function normalizeLibraryItem(
  raw: unknown,
  validFolderIds?: Set<string>,
  now: number = Date.now()
): MasterLibraryItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const rawType = typeof r.type === "string" ? r.type.trim().toLowerCase() : "";
  if (!isMasterLibraryItemType(rawType)) return null;

  const id =
    typeof r.id === "string" && r.id.trim()
      ? r.id.trim().slice(0, 80)
      : `lib_${rawType}_${now}_${Math.random().toString(36).slice(2, 6)}`;
  const rawFolderId =
    typeof r.folderId === "string" && r.folderId.trim() ? r.folderId.trim().slice(0, 80) : null;
  const folderId =
    rawFolderId && (!validFolderIds || validFolderIds.has(rawFolderId))
      ? rawFolderId
      : null;
  const createdAt =
    typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : now;
  const updatedAt =
    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : now;

  if (rawType === "ritual") {
    const data = normalizeRitualItem(r.data, now);
    if (!data) return null;
    return { id, type: "ritual", folderId, createdAt, updatedAt, data };
  }
  if (rawType === "skill") {
    const data = normalizeLibrarySkillData(r.data, now);
    if (!data) return null;
    return { id, type: "skill", folderId, createdAt, updatedAt, data };
  }
  if (rawType === "pdi") {
    if (!r.data || typeof r.data !== "object" || Array.isArray(r.data)) return null;
    const [data] = normalizePdis([r.data], []);
    if (!data) return null;
    return { id, type: "pdi", folderId, createdAt, updatedAt, data };
  }
  if (rawType === "tributo") {
    const data = normalizeLibraryTributoData(r.data);
    if (!data) return null;
    return { id, type: "tributo", folderId, createdAt, updatedAt, data };
  }
  return null;
}

export function normalizeLibraryItems(
  raw: unknown,
  folders: MasterLibraryFolder[] = []
): MasterLibraryItem[] {
  if (!Array.isArray(raw)) return [];
  const validFolderIds = new Set(folders.map((f) => f.id));
  const seen = new Set<string>();
  const out: MasterLibraryItem[] = [];
  raw.forEach((entry, idx) => {
    const item = normalizeLibraryItem(entry, validFolderIds, Date.now() + idx);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  });
  return out;
}

export function getLibraryItemName(item: MasterLibraryItem): string {
  return (item.data?.name || "").trim() || "Sem Nome";
}

export function getLibraryItemDescription(item: MasterLibraryItem): string {
  return (item.data?.desc || "").trim();
}

// ============================================================================
// FOLDER TREE OPERATIONS
// ============================================================================

export function createLibraryFolder(
  folders: MasterLibraryFolder[],
  name: string,
  parentId: string | null = null,
  now: number = Date.now()
): { ok: true; folder: MasterLibraryFolder; folders: MasterLibraryFolder[] } | { ok: false; error: string } {
  const cleanName = String(name || "").trim().slice(0, 80);
  if (!cleanName) {
    return { ok: false, error: "Informe um nome para a pasta." };
  }
  const resolvedParent =
    parentId && folders.some((f) => f.id === parentId) ? parentId : null;

  const duplicate = folders.some(
    (f) =>
      f.parentId === resolvedParent &&
      f.name.trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Já existe uma pasta chamada "${cleanName}" neste diretório.`,
    };
  }

  const folder: MasterLibraryFolder = {
    id: `libfld_${now}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    parentId: resolvedParent,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, folder, folders: [...folders, folder] };
}

export function renameLibraryFolder(
  folders: MasterLibraryFolder[],
  folderId: string,
  newName: string,
  now: number = Date.now()
): { ok: true; folders: MasterLibraryFolder[] } | { ok: false; error: string } {
  const target = folders.find((f) => f.id === folderId);
  if (!target) {
    return { ok: false, error: "Pasta não encontrada." };
  }
  const cleanName = String(newName || "").trim().slice(0, 80);
  if (!cleanName) {
    return { ok: false, error: "O nome da pasta não pode ficar vazio." };
  }
  const duplicate = folders.some(
    (f) =>
      f.id !== folderId &&
      f.parentId === target.parentId &&
      f.name.trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Já existe outra pasta chamada "${cleanName}" neste diretório.`,
    };
  }
  return {
    ok: true,
    folders: folders.map((f) =>
      f.id === folderId ? { ...f, name: cleanName, updatedAt: now } : f
    ),
  };
}

export function getDescendantFolderIds(
  folders: MasterLibraryFolder[],
  rootFolderId: string
): Set<string> {
  const result = new Set<string>([rootFolderId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const f of folders) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        expanded = true;
      }
    }
  }
  return result;
}

/**
 * Exclui uma pasta e suas subpastas, preservando todos os arquivos contidos nelas
 * movendo-os para a pasta pai (ou Raiz) sem perda de dados.
 */
export function deleteLibraryFolder(
  folders: MasterLibraryFolder[],
  items: MasterLibraryItem[],
  folderId: string,
  now: number = Date.now()
): {
  folders: MasterLibraryFolder[];
  items: MasterLibraryItem[];
  movedItemsCount: number;
} {
  const target = folders.find((f) => f.id === folderId);
  if (!target) {
    return { folders, items, movedItemsCount: 0 };
  }
  const toRemove = getDescendantFolderIds(folders, folderId);
  const fallbackParent =
    target.parentId && !toRemove.has(target.parentId) ? target.parentId : null;

  const nextFolders = folders.filter((f) => !toRemove.has(f.id));
  let movedItemsCount = 0;
  const nextItems = items.map((item) => {
    if (item.folderId && toRemove.has(item.folderId)) {
      movedItemsCount += 1;
      return { ...item, folderId: fallbackParent, updatedAt: now };
    }
    return item;
  });

  return { folders: nextFolders, items: nextItems, movedItemsCount };
}

export function canMoveFolderInto(
  folders: MasterLibraryFolder[],
  folderId: string,
  targetParentId: string | null
): boolean {
  if (targetParentId === null) return true;
  if (folderId === targetParentId) return false;
  const descendants = getDescendantFolderIds(folders, folderId);
  return !descendants.has(targetParentId);
}

export function getFolderBreadcrumb(
  folders: MasterLibraryFolder[],
  currentFolderId: string | null
): MasterLibraryFolder[] {
  if (!currentFolderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: MasterLibraryFolder[] = [];
  const visited = new Set<string>();
  let curr: string | null = currentFolderId;

  while (curr && !visited.has(curr)) {
    const folder = byId.get(curr);
    if (!folder) break;
    visited.add(curr);
    chain.unshift(folder);
    curr = folder.parentId;
  }
  return chain;
}

export function getFolderPathLabel(
  folders: MasterLibraryFolder[],
  folderId: string | null
): string {
  if (!folderId) return "Raiz";
  const chain = getFolderBreadcrumb(folders, folderId);
  if (chain.length === 0) return "Raiz";
  return chain.map((f) => f.name).join(" / ");
}

export function getFolderStats(
  folders: MasterLibraryFolder[],
  items: MasterLibraryItem[],
  folderId: string
): { directSubfolders: number; totalItems: number } {
  const directSubfolders = folders.filter((f) => f.parentId === folderId).length;
  const scope = getDescendantFolderIds(folders, folderId);
  const totalItems = items.filter((it) => it.folderId && scope.has(it.folderId)).length;
  return { directSubfolders, totalItems };
}

// ============================================================================
// FILTERING & SEARCH
// ============================================================================

export function filterLibraryItems(
  items: MasterLibraryItem[],
  options: {
    currentFolderId: string | null;
    typeFilter: MasterLibraryItemType | "all";
    search: string;
    searchAllFolders?: boolean;
  }
): MasterLibraryItem[] {
  const q = options.search.trim().toLowerCase();
  const useGlobalSearch = Boolean(options.searchAllFolders && q.length > 0);

  return items.filter((item) => {
    if (!useGlobalSearch && item.folderId !== options.currentFolderId) {
      return false;
    }
    if (options.typeFilter !== "all" && item.type !== options.typeFilter) {
      return false;
    }
    if (!q) return true;

    const name = getLibraryItemName(item).toLowerCase();
    const desc = getLibraryItemDescription(item).toLowerCase();
    if (name.includes(q) || desc.includes(q)) return true;

    if (item.type === "ritual") {
      const affMatch = item.data.affiliations.some((affId) => {
        const def = getRitualAffiliationDefinition(affId);
        return affId.includes(q) || (def?.label || "").toLowerCase().includes(q);
      });
      if (affMatch || item.data.damage.toLowerCase().includes(q)) return true;
    } else if (item.type === "skill") {
      if (
        item.data.test.toLowerCase().includes(q) ||
        item.data.damage.toLowerCase().includes(q)
      ) {
        return true;
      }
    } else if (item.type === "tributo") {
      if (
        item.data.passivo.toLowerCase().includes(q) ||
        item.data.ativo.toLowerCase().includes(q)
      ) {
        return true;
      }
    } else if (item.type === "pdi") {
      const modMatch = Object.keys(item.data.modifiers || {}).some((stat) =>
        stat.toLowerCase().includes(q)
      );
      if (modMatch) return true;
    }

    return false;
  });
}

// ============================================================================
// JSON EXPORT & IMPORT (STANDALONE + EXTERNAL COMPATIBLE)
// ============================================================================

export function buildLibraryItemFilename(item: MasterLibraryItem): string {
  const rawName = getLibraryItemName(item)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const slug = rawName || "arquivo";
  return `${item.type}-${slug}.json`;
}

export function exportLibraryItemToJson(
  item: MasterLibraryItem,
  exportedAt: string = new Date().toISOString()
): string {
  const envelope: MasterLibraryExportEnvelope = {
    format: MASTER_LIBRARY_JSON_FORMAT,
    version: MASTER_LIBRARY_JSON_VERSION,
    type: item.type,
    exportedAt,
    data: stripDangerousKeys(item.data),
  };
  return JSON.stringify(envelope, null, 2);
}

const VALID_PDI_DICE_SET = new Set<string>(VALID_PDI_DICE);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function validateRitualCandidate(raw: Record<string, unknown>): { ok: true; data: RitualItem } | { ok: false; error: string } {
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { ok: false, error: 'Ritual inválido: o campo obrigatório "name" está vazio ou ausente.' };
  }
  if (raw.level !== undefined) {
    const lvl = Number(raw.level);
    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 4) {
      return { ok: false, error: 'Ritual inválido: o campo "level" deve ser um número entre 1 e 4.' };
    }
  }
  if (raw.difficulty !== undefined && raw.difficulty !== "") {
    const dif = Number(raw.difficulty);
    if (!Number.isFinite(dif) || dif < 0 || dif > 99) {
      return { ok: false, error: 'Ritual inválido: o campo "difficulty" deve ser um número entre 0 e 99.' };
    }
  }
  if (raw.cost !== undefined && raw.cost !== "") {
    const cost = Number(raw.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return { ok: false, error: 'Ritual inválido: o campo "cost" deve ser um número maior ou igual a 0.' };
    }
  }
  if (raw.affiliations !== undefined && !Array.isArray(raw.affiliations)) {
    return { ok: false, error: 'Ritual inválido: o campo "affiliations" deve ser uma lista.' };
  }
  if (Array.isArray(raw.affiliations)) {
    for (const aff of raw.affiliations) {
      const norm = typeof aff === "string" ? aff.trim().toLowerCase() : "";
      if (!isRitualAffiliationId(norm)) {
        return {
          ok: false,
          error: `Ritual inválido: afiliação desconhecida "${String(aff)}".`,
        };
      }
    }
  }

  const normalized = normalizeRitualItem(
    {
      ...raw,
      difficulty: raw.difficulty ?? DEFAULT_RITUAL_DIFFICULTY,
    },
    Date.now()
  );
  if (!normalized) {
    return { ok: false, error: "Não foi possível reconstruir os dados do Ritual." };
  }
  return { ok: true, data: { ...normalized, name: normalized.name.trim() } };
}

function validateSkillCandidate(raw: Record<string, unknown>): { ok: true; data: MasterLibrarySkillData } | { ok: false; error: string } {
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { ok: false, error: 'Skill inválida: o campo obrigatório "name" está vazio ou ausente.' };
  }
  if (raw.cost !== undefined && raw.cost !== "") {
    const cost = Number(raw.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return { ok: false, error: 'Skill inválida: o campo "cost" deve ser um número maior ou igual a 0.' };
    }
  }
  const normalized = normalizeLibrarySkillData(raw, Date.now());
  if (!normalized || !normalized.name) {
    return { ok: false, error: "Não foi possível reconstruir os dados da Skill." };
  }
  return { ok: true, data: normalized };
}

function validatePdiCandidate(raw: Record<string, unknown>): { ok: true; data: PdiItem } | { ok: false; error: string } {
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { ok: false, error: 'PDI inválido: o campo obrigatório "name" está vazio ou ausente.' };
  }
  if (raw.modifiers !== undefined && !isPlainObject(raw.modifiers)) {
    return { ok: false, error: 'PDI inválido: o campo "modifiers" deve ser um objeto por atributo.' };
  }
  if (isPlainObject(raw.modifiers)) {
    for (const [statKey, modVal] of Object.entries(raw.modifiers)) {
      if (!(DEMOLOGIA_STAT_KEYS as readonly string[]).includes(statKey)) {
        return {
          ok: false,
          error: `PDI inválido: atributo desconhecido "${statKey}" em modifiers (use VIT, AGL, FOR, OCU, INT ou SAN).`,
        };
      }
      if (!isPlainObject(modVal)) {
        return {
          ok: false,
          error: `PDI inválido: modificador de "${statKey}" deve ser um objeto.`,
        };
      }
      for (const dieField of ["buffDice", "debuffDice"] as const) {
        const dv = modVal[dieField];
        if (dv !== undefined && dv !== "") {
          const clean = typeof dv === "string" ? dv.trim().toLowerCase().replace(/^[+-]/, "") : "";
          if (!VALID_PDI_DICE_SET.has(clean)) {
            return {
              ok: false,
              error: `PDI inválido: dado "${String(dv)}" em ${statKey}.${dieField} não é suportado.`,
            };
          }
        }
      }
    }
  }

  const [normalized] = normalizePdis([raw], []);
  if (!normalized) {
    return { ok: false, error: "Não foi possível reconstruir os dados do PDI." };
  }
  return { ok: true, data: normalized };
}

function validateTributoCandidate(raw: Record<string, unknown>): { ok: true; data: MasterLibraryTributoData } | { ok: false; error: string } {
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { ok: false, error: 'Tributo inválido: o campo obrigatório "name" está vazio ou ausente.' };
  }
  for (const field of ["desc", "passivo", "ativo"] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== "string") {
      return { ok: false, error: `Tributo inválido: o campo "${field}" deve ser texto.` };
    }
  }
  const normalized = normalizeLibraryTributoData(raw);
  if (!normalized || !normalized.name) {
    return { ok: false, error: "Não foi possível reconstruir os dados do Tributo." };
  }
  return { ok: true, data: normalized };
}

function detectLibraryItemType(
  root: Record<string, unknown>
): { type: MasterLibraryItemType; payload: Record<string, unknown> } | { error: string } {
  // 1. Explicit type property (official envelope or external JSON with `type`)
  if (root.type !== undefined) {
    if (!isMasterLibraryItemType(root.type)) {
      return {
        error: `Tipo de conteúdo não suportado: "${String(root.type)}". Tipos válidos: ritual, skill, pdi ou tributo.`,
      };
    }
    const detectedType = root.type.trim().toLowerCase() as MasterLibraryItemType;
    if (root.data !== undefined) {
      if (!isPlainObject(root.data)) {
        return { error: 'Estrutura JSON inválida: o campo "data" deve ser um objeto.' };
      }
      return { type: detectedType, payload: root.data };
    }
    return { type: detectedType, payload: root };
  }

  // 2. Unwrapped raw JSON created outside the Hub -> structural auto-detection
  const hasRitualKeys =
    "difficulty" in root || "affiliations" in root || "level" in root;
  const hasPdiKeys = "modifiers" in root;
  const hasTributoKeys = "passivo" in root || "ativo" in root;
  const hasSkillKeys =
    "test" in root ||
    "testVar" in root ||
    "damageVar" in root ||
    "testPostVar" in root ||
    "damagePostVar" in root ||
    ("cost" in root && !hasRitualKeys);

  const matched: MasterLibraryItemType[] = [];
  if (hasRitualKeys) matched.push("ritual");
  if (hasPdiKeys) matched.push("pdi");
  if (hasTributoKeys) matched.push("tributo");
  if (hasSkillKeys && !hasRitualKeys) matched.push("skill");

  if (matched.length === 1) {
    return { type: matched[0], payload: root };
  }
  if (matched.length > 1) {
    return {
      error:
        'JSON ambíguo: contém campos de múltiplos tipos. Adicione o campo "type" ("ritual", "skill", "pdi" ou "tributo").',
    };
  }
  return {
    error:
      'Não foi possível identificar automaticamente o tipo do arquivo JSON. Inclua "type" ("ritual", "skill", "pdi" ou "tributo") ou os campos característicos do sistema Demologia.',
  };
}

export function parseImportedLibraryJson(
  rawText: string,
  folderId: string | null = null,
  now: number = Date.now()
): { ok: true; item: MasterLibraryItem } | { ok: false; error: string } {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return { ok: false, error: "O arquivo JSON está vazio." };
  }
  if (rawText.length > MAX_LIBRARY_JSON_BYTES) {
    return {
      ok: false,
      error: "Arquivo JSON excede o limite máximo permitido (512 KB).",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: "Arquivo inválido: não foi possível ler a sintaxe JSON.",
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: "Estrutura JSON incompatível: o arquivo deve conter um objeto JSON válido.",
    };
  }

  const cleanRoot = stripDangerousKeys(parsed);

  // Reject full character sheets so the Master gets a clear diagnostic
  if (
    "variables" in cleanRoot &&
    ("hp" in cleanRoot || "pe" in cleanRoot) &&
    "skills" in cleanRoot &&
    !("type" in cleanRoot)
  ) {
    return {
      ok: false,
      error:
        "Este JSON parece ser uma Ficha completa de personagem, não um item individual (Ritual, Skill, PDI ou Tributo).",
    };
  }

  const detected = detectLibraryItemType(cleanRoot);
  if ("error" in detected) {
    return { ok: false, error: detected.error };
  }

  const newId = `lib_${detected.type}_${now}_${Math.random().toString(36).slice(2, 6)}`;

  if (detected.type === "ritual") {
    const res = validateRitualCandidate(detected.payload);
    if ("error" in res) return { ok: false, error: res.error };
    return {
      ok: true,
      item: {
        id: newId,
        type: "ritual",
        folderId,
        createdAt: now,
        updatedAt: now,
        data: res.data,
      },
    };
  }

  if (detected.type === "skill") {
    const res = validateSkillCandidate(detected.payload);
    if ("error" in res) return { ok: false, error: res.error };
    return {
      ok: true,
      item: {
        id: newId,
        type: "skill",
        folderId,
        createdAt: now,
        updatedAt: now,
        data: res.data,
      },
    };
  }

  if (detected.type === "pdi") {
    const res = validatePdiCandidate(detected.payload);
    if ("error" in res) return { ok: false, error: res.error };
    return {
      ok: true,
      item: {
        id: newId,
        type: "pdi",
        folderId,
        createdAt: now,
        updatedAt: now,
        data: res.data,
      },
    };
  }

  const res = validateTributoCandidate(detected.payload);
  if ("error" in res) return { ok: false, error: res.error };
  return {
    ok: true,
    item: {
      id: newId,
      type: "tributo",
      folderId,
      createdAt: now,
      updatedAt: now,
      data: res.data,
    },
  };
}

/**
 * Converte um arquivo da Biblioteca do Mestre em um MasterDataPushPayload
 * pronto para o sistema existente de distribuição aos jogadores.
 */
export function buildPushPayloadFromLibraryItem(
  item: MasterLibraryItem
): MasterDataPushPayload {
  switch (item.type) {
    case "ritual":
      return { ritual: { ...item.data, affiliations: [...item.data.affiliations] } };
    case "skill":
      return { skill: sanitizeSkillInput(item.data) };
    case "pdi":
      return { pdi: { ...item.data } };
    case "tributo":
      return { tributo: sanitizeTributoInput(item.data) };
  }
}
