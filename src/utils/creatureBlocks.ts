import type {
  CatalogRitualOption,
  CreatureBlockType,
  CreatureModeItem,
  CreatureRecord,
  CreatureRitualRef,
  CreatureSheetBlock,
  CreatureTableData,
  ResolvedCreatureRitual,
} from "../types/masterCreatures";
import type {
  MasterLibraryItem,
  MasterLibraryRitualItem,
} from "../types/masterLibrary";
import {
  normalizeRitualItem,
  normalizeRituals,
  type RitualItem,
} from "./rituals";
import { normalizePdis, type PdiItem } from "./pdi";

export const CURRENT_CREATURE_SHEET_VERSION = 2;

export interface CreatureBlockMeta {
  type: CreatureBlockType;
  label: string;
  description: string;
  defaultWidthPct: number;
  minWidthPct: number;
  maxWidthPct: number;
  defaultMinHeightPx: number | null;
  supportsVerticalResize: boolean;
  supportsDuplicate: boolean;
  singleton: boolean;
}

export const CREATURE_BLOCK_META: Record<CreatureBlockType, CreatureBlockMeta> = {
  profile: {
    type: "profile",
    label: "Perfil",
    description: "Nome em destaque (H2), Nível (LV), Afiliações e descrição formatada.",
    defaultWidthPct: 100,
    minWidthPct: 35,
    maxWidthPct: 100,
    defaultMinHeightPx: null,
    supportsVerticalResize: false,
    supportsDuplicate: false,
    singleton: true,
  },
  status: {
    type: "status",
    label: "Status",
    description: "Atributos oficiais (VIT, AGL, FOR, OCU, INT, SAN), PV, PE, SAN e teto de LV.",
    defaultWidthPct: 50,
    minWidthPct: 35,
    maxWidthPct: 100,
    defaultMinHeightPx: null,
    supportsVerticalResize: false,
    supportsDuplicate: false,
    singleton: true,
  },
  skills: {
    type: "skills",
    label: "Skills",
    description: "Skills vinculadas da Biblioteca ou próprias da criatura com detalhes expansíveis.",
    defaultWidthPct: 50,
    minWidthPct: 33,
    maxWidthPct: 100,
    defaultMinHeightPx: null,
    supportsVerticalResize: false,
    supportsDuplicate: false,
    singleton: true,
  },
  rituals: {
    type: "rituals",
    label: "Rituais",
    description: "Vincula Rituais cadastrados na Biblioteca e nas fichas de Players sem duplicar.",
    defaultWidthPct: 50,
    minWidthPct: 33,
    maxWidthPct: 100,
    defaultMinHeightPx: null,
    supportsVerticalResize: false,
    supportsDuplicate: false,
    singleton: true,
  },
  modes: {
    type: "modes",
    label: "Modos",
    description: "Fases e estados da criatura com Buffs/Debuffs baseados no sistema de PDI.",
    defaultWidthPct: 50,
    minWidthPct: 33,
    maxWidthPct: 100,
    defaultMinHeightPx: null,
    supportsVerticalResize: false,
    supportsDuplicate: false,
    singleton: true,
  },
  text: {
    type: "text",
    label: "Texto",
    description: "Anotações livres, lore, fases e fraquezas com **negrito**, ^^itálico^^, #(Afiliação) e ---.",
    defaultWidthPct: 50,
    minWidthPct: 25,
    maxWidthPct: 100,
    defaultMinHeightPx: 140,
    supportsVerticalResize: true,
    supportsDuplicate: true,
    singleton: false,
  },
  table: {
    type: "table",
    label: "Tabela",
    description: "Planilha estilo Excel com linhas, colunas, cabeçalho e formatação rica nas células.",
    defaultWidthPct: 100,
    minWidthPct: 35,
    maxWidthPct: 100,
    defaultMinHeightPx: 180,
    supportsVerticalResize: true,
    supportsDuplicate: true,
    singleton: false,
  },
};

export const CREATURE_BLOCK_TYPES_ORDER: readonly CreatureBlockType[] = [
  "profile",
  "status",
  "skills",
  "rituals",
  "modes",
  "text",
  "table",
];

export const CREATURE_TABLE_MIN_ROWS = 1;
export const CREATURE_TABLE_MAX_ROWS = 20;
export const CREATURE_TABLE_MIN_COLS = 1;
export const CREATURE_TABLE_MAX_COLS = 12;
export const CREATURE_TABLE_DEFAULT_ROWS = 4;
export const CREATURE_TABLE_DEFAULT_COLS = 3;
export const CREATURE_TABLE_MAX_CELL_LENGTH = 500;

/**
 * Converte índice 0-based em letra de coluna estilo Excel (0 -> "A", 25 -> "Z", 26 -> "AA").
 */
export function getSpreadsheetColumnLabel(colIndex: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(colIndex) ? colIndex : 0));
  let n = safe;
  let label = "";
  while (true) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return label;
}

export function createDefaultCreatureTableData(
  rows = CREATURE_TABLE_DEFAULT_ROWS,
  cols = CREATURE_TABLE_DEFAULT_COLS,
): CreatureTableData {
  const safeRows = Math.max(
    CREATURE_TABLE_MIN_ROWS,
    Math.min(CREATURE_TABLE_MAX_ROWS, Math.round(rows)),
  );
  const safeCols = Math.max(
    CREATURE_TABLE_MIN_COLS,
    Math.min(CREATURE_TABLE_MAX_COLS, Math.round(cols)),
  );
  const matrix: string[][] = Array.from({ length: safeRows }, (_, r) =>
    Array.from({ length: safeCols }, (_, c) =>
      r === 0 ? `Coluna ${getSpreadsheetColumnLabel(c)}` : "",
    ),
  );
  return {
    rows: matrix,
    hasHeaderRow: true,
  };
}

export function normalizeCreatureTableData(raw: unknown): CreatureTableData {
  if (!raw || typeof raw !== "object") {
    return createDefaultCreatureTableData();
  }
  const obj = raw as Record<string, unknown>;
  const rawRows = Array.isArray(obj.rows) ? obj.rows : null;
  if (!rawRows || rawRows.length === 0) {
    return createDefaultCreatureTableData();
  }

  const slicedRows = rawRows.slice(0, CREATURE_TABLE_MAX_ROWS);
  let maxCols = CREATURE_TABLE_MIN_COLS;
  for (const r of slicedRows) {
    if (Array.isArray(r) && r.length > maxCols) {
      maxCols = r.length;
    }
  }
  const safeCols = Math.max(
    CREATURE_TABLE_MIN_COLS,
    Math.min(CREATURE_TABLE_MAX_COLS, maxCols),
  );

  const normalizedRows: string[][] = slicedRows.map((row) => {
    const arr = Array.isArray(row) ? row : [];
    return Array.from({ length: safeCols }, (_, colIdx) => {
      const cell = arr[colIdx];
      if (cell === null || cell === undefined) return "";
      return String(cell).slice(0, CREATURE_TABLE_MAX_CELL_LENGTH);
    });
  });

  return {
    rows: normalizedRows,
    hasHeaderRow:
      typeof obj.hasHeaderRow === "boolean" ? obj.hasHeaderRow : true,
  };
}

export function updateTableCell(
  data: CreatureTableData,
  rowIdx: number,
  colIdx: number,
  value: string,
): CreatureTableData {
  if (
    rowIdx < 0 ||
    rowIdx >= data.rows.length ||
    colIdx < 0 ||
    colIdx >= (data.rows[0]?.length || 0)
  ) {
    return data;
  }
  const nextVal = String(value ?? "").slice(0, CREATURE_TABLE_MAX_CELL_LENGTH);
  return {
    ...data,
    rows: data.rows.map((row, r) =>
      r !== rowIdx ? row : row.map((cell, c) => (c === colIdx ? nextVal : cell)),
    ),
  };
}

export function addTableRow(
  data: CreatureTableData,
  atIndex?: number,
): CreatureTableData {
  if (data.rows.length >= CREATURE_TABLE_MAX_ROWS) return data;
  const colCount = Math.max(CREATURE_TABLE_MIN_COLS, data.rows[0]?.length || 1);
  const newRow = Array.from({ length: colCount }, () => "");
  const nextRows = data.rows.map((r) => [...r]);
  if (
    typeof atIndex === "number" &&
    Number.isInteger(atIndex) &&
    atIndex >= 0 &&
    atIndex <= nextRows.length
  ) {
    nextRows.splice(atIndex, 0, newRow);
  } else {
    nextRows.push(newRow);
  }
  return { ...data, rows: nextRows };
}

export function removeTableRow(
  data: CreatureTableData,
  rowIdx: number,
): CreatureTableData {
  if (data.rows.length <= CREATURE_TABLE_MIN_ROWS) return data;
  if (rowIdx < 0 || rowIdx >= data.rows.length) return data;
  return {
    ...data,
    rows: data.rows.filter((_, idx) => idx !== rowIdx),
  };
}

export function addTableColumn(
  data: CreatureTableData,
  atIndex?: number,
): CreatureTableData {
  const currentCols = data.rows[0]?.length || 0;
  if (currentCols >= CREATURE_TABLE_MAX_COLS) return data;
  const insertAt =
    typeof atIndex === "number" &&
    Number.isInteger(atIndex) &&
    atIndex >= 0 &&
    atIndex <= currentCols
      ? atIndex
      : currentCols;
  const colLabel = getSpreadsheetColumnLabel(insertAt);
  const nextRows = data.rows.map((row, rowIdx) => {
    const copy = [...row];
    copy.splice(
      insertAt,
      0,
      rowIdx === 0 && data.hasHeaderRow ? `Coluna ${colLabel}` : "",
    );
    return copy;
  });
  return { ...data, rows: nextRows };
}

export function removeTableColumn(
  data: CreatureTableData,
  colIdx: number,
): CreatureTableData {
  const currentCols = data.rows[0]?.length || 0;
  if (currentCols <= CREATURE_TABLE_MIN_COLS) return data;
  if (colIdx < 0 || colIdx >= currentCols) return data;
  return {
    ...data,
    rows: data.rows.map((row) => row.filter((_, idx) => idx !== colIdx)),
  };
}

export function toggleTableHeaderRow(
  data: CreatureTableData,
): CreatureTableData {
  return { ...data, hasHeaderRow: !data.hasHeaderRow };
}

export const VALID_CREATURE_BLOCK_TYPES = new Set<string>(CREATURE_BLOCK_TYPES_ORDER);

export function createCreatureBlockId(type: CreatureBlockType): string {
  return `blk_${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function clampBlockWidthPct(
  type: CreatureBlockType,
  rawWidth: unknown,
): number {
  const meta = CREATURE_BLOCK_META[type];
  const parsed = Number(rawWidth);
  if (!Number.isFinite(parsed)) return meta.defaultWidthPct;
  const rounded = Math.round(parsed);
  return Math.max(meta.minWidthPct, Math.min(meta.maxWidthPct, rounded));
}

export function clampBlockMinHeightPx(
  type: CreatureBlockType,
  rawHeight: unknown,
): number | null {
  const meta = CREATURE_BLOCK_META[type];
  if (rawHeight === null || rawHeight === undefined || rawHeight === "") {
    return meta.defaultMinHeightPx;
  }
  const parsed = Number(rawHeight);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return meta.defaultMinHeightPx;
  }
  return Math.max(96, Math.min(900, Math.round(parsed)));
}

export function createCreatureBlock(
  type: CreatureBlockType,
  overrides: Partial<CreatureSheetBlock> = {},
): CreatureSheetBlock {
  const meta = CREATURE_BLOCK_META[type];
  return {
    id:
      typeof overrides.id === "string" && overrides.id.trim()
        ? overrides.id.trim()
        : createCreatureBlockId(type),
    type,
    widthPct: clampBlockWidthPct(type, overrides.widthPct ?? meta.defaultWidthPct),
    minHeightPx: clampBlockMinHeightPx(
      type,
      overrides.minHeightPx !== undefined ? overrides.minHeightPx : meta.defaultMinHeightPx,
    ),
    ...(type === "text"
      ? {
          title: typeof overrides.title === "string" ? overrides.title : "Anotações",
          content: typeof overrides.content === "string" ? overrides.content : "",
        }
      : type === "table"
        ? {
            title: typeof overrides.title === "string" ? overrides.title : "Tabela",
            tableData: normalizeCreatureTableData(overrides.tableData),
          }
        : overrides.title
          ? { title: overrides.title }
          : {}),
  };
}

/**
 * Gera a composição inicial compatível com o layout tradicional da ficha de criatura.
 */
export function buildDefaultCreatureSheetBlocks(options?: {
  includeRituals?: boolean;
  includeModes?: boolean;
}): CreatureSheetBlock[] {
  const blocks: CreatureSheetBlock[] = [
    createCreatureBlock("profile", { id: "blk_profile_default", widthPct: 100 }),
    createCreatureBlock("status", { id: "blk_status_default", widthPct: 50 }),
    createCreatureBlock("skills", { id: "blk_skills_default", widthPct: 50 }),
  ];

  if (options?.includeRituals) {
    blocks.push(
      createCreatureBlock("rituals", { id: "blk_rituals_default", widthPct: 50 }),
    );
  }
  if (options?.includeModes) {
    blocks.push(
      createCreatureBlock("modes", { id: "blk_modes_default", widthPct: 50 }),
    );
  }

  return blocks;
}

export function normalizeCreatureSheetBlocks(raw: unknown): CreatureSheetBlock[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenSingletons = new Set<CreatureBlockType>();
  const out: CreatureSheetBlock[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawType = typeof obj.type === "string" ? obj.type.trim() : "";
    if (!VALID_CREATURE_BLOCK_TYPES.has(rawType)) continue;
    const type = rawType as CreatureBlockType;

    if (CREATURE_BLOCK_META[type].singleton) {
      if (seenSingletons.has(type)) continue;
      seenSingletons.add(type);
    }

    let id =
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim().slice(0, 120)
        : createCreatureBlockId(type);
    if (seenIds.has(id)) {
      id = createCreatureBlockId(type);
    }
    seenIds.add(id);

    out.push(
      createCreatureBlock(type, {
        id,
        widthPct: Number(obj.widthPct),
        minHeightPx:
          obj.minHeightPx === null || obj.minHeightPx === undefined
            ? undefined
            : Number(obj.minHeightPx),
        title: typeof obj.title === "string" ? obj.title : undefined,
        content: typeof obj.content === "string" ? obj.content : undefined,
        tableData:
          type === "table" ? normalizeCreatureTableData(obj.tableData) : undefined,
      }),
    );
  }

  return out;
}

/**
 * Detecta se uma criatura ainda utiliza a estrutura fixa antiga (sem blocos dinâmicos)
 * e migra de forma segura e não-destrutiva para a versão 2.
 */
export function needsLegacySheetBlockMigration(creature: CreatureRecord): boolean {
  return (
    !Array.isArray(creature.sheetBlocks) ||
    creature.sheetBlocks.length === 0 ||
    (creature.sheetVersion ?? 1) < CURRENT_CREATURE_SHEET_VERSION
  );
}

export function migrateLegacyCreatureToBlocks(creature: CreatureRecord): {
  creature: CreatureRecord;
  migrated: boolean;
} {
  const existingBlocks = normalizeCreatureSheetBlocks(creature.sheetBlocks);
  if (
    existingBlocks.length > 0 &&
    (creature.sheetVersion ?? 1) >= CURRENT_CREATURE_SHEET_VERSION
  ) {
    return { creature, migrated: false };
  }

  const nextBlocks =
    existingBlocks.length > 0
      ? existingBlocks
      : buildDefaultCreatureSheetBlocks({
          includeRituals: (creature.rituals?.length ?? 0) > 0,
          includeModes: (creature.modes?.length ?? 0) > 0,
        });

  return {
    migrated: true,
    creature: {
      ...creature,
      sheetBlocks: nextBlocks,
      sheetVersion: CURRENT_CREATURE_SHEET_VERSION,
    },
  };
}

// ============================================================================
// OPERAÇÕES DE LAYOUT MODULAR (ADD, REMOVE, DUPLICATE, REORDER, RESIZE)
// ============================================================================

export function addBlockToSheet(
  blocks: CreatureSheetBlock[],
  type: CreatureBlockType,
  insertIndex?: number,
): { ok: true; block: CreatureSheetBlock; blocks: CreatureSheetBlock[] } | { ok: false; error: string } {
  const meta = CREATURE_BLOCK_META[type];
  if (meta.singleton && blocks.some((b) => b.type === type)) {
    return {
      ok: false,
      error: `O bloco "${meta.label}" já está presente nesta ficha.`,
    };
  }

  const block = createCreatureBlock(type);
  const next = [...blocks];
  if (
    typeof insertIndex === "number" &&
    Number.isInteger(insertIndex) &&
    insertIndex >= 0 &&
    insertIndex <= next.length
  ) {
    next.splice(insertIndex, 0, block);
  } else {
    next.push(block);
  }

  return { ok: true, block, blocks: next };
}

export function removeBlockFromSheet(
  blocks: CreatureSheetBlock[],
  blockId: string,
): CreatureSheetBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

export function duplicateBlockInSheet(
  blocks: CreatureSheetBlock[],
  blockId: string,
): { ok: true; block: CreatureSheetBlock; blocks: CreatureSheetBlock[] } | { ok: false; error: string } {
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) {
    return { ok: false, error: "Bloco não encontrado." };
  }
  const source = blocks[idx];
  const meta = CREATURE_BLOCK_META[source.type];
  if (!meta.supportsDuplicate) {
    return {
      ok: false,
      error: `O bloco "${meta.label}" é único e não pode ser duplicado.`,
    };
  }

  const defaultCopyTitle = source.type === "table" ? "Tabela (Cópia)" : "Anotações (Cópia)";
  const clone: CreatureSheetBlock = {
    ...source,
    id: createCreatureBlockId(source.type),
    title: source.title ? `${source.title} (Cópia)` : defaultCopyTitle,
    ...(source.type === "table"
      ? {
          tableData: {
            hasHeaderRow: source.tableData?.hasHeaderRow ?? true,
            rows: normalizeCreatureTableData(source.tableData).rows.map((r) => [
              ...r,
            ]),
          },
        }
      : {}),
  };

  const next = [...blocks];
  next.splice(idx + 1, 0, clone);
  return { ok: true, block: clone, blocks: next };
}

export function reorderSheetBlocks(
  blocks: CreatureSheetBlock[],
  draggedId: string,
  targetId: string,
  position: "before" | "after" = "before",
): CreatureSheetBlock[] {
  if (!draggedId || !targetId || draggedId === targetId) return blocks;
  const fromIdx = blocks.findIndex((b) => b.id === draggedId);
  const toIdx = blocks.findIndex((b) => b.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return blocks;

  const next = [...blocks];
  const [moved] = next.splice(fromIdx, 1);
  const updatedTargetIdx = next.findIndex((b) => b.id === targetId);
  if (updatedTargetIdx === -1) return blocks;

  const insertIdx = position === "after" ? updatedTargetIdx + 1 : updatedTargetIdx;
  next.splice(insertIdx, 0, moved);
  return next;
}

export function moveSheetBlockByOffset(
  blocks: CreatureSheetBlock[],
  blockId: string,
  delta: -1 | 1,
): CreatureSheetBlock[] {
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return blocks;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= blocks.length) return blocks;

  const next = [...blocks];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export function resizeSheetBlock(
  blocks: CreatureSheetBlock[],
  blockId: string,
  patch: { widthPct?: number; minHeightPx?: number | null },
): CreatureSheetBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    return {
      ...b,
      widthPct:
        patch.widthPct !== undefined
          ? clampBlockWidthPct(b.type, patch.widthPct)
          : b.widthPct,
      minHeightPx:
        patch.minHeightPx !== undefined
          ? clampBlockMinHeightPx(b.type, patch.minHeightPx)
          : b.minHeightPx,
    };
  });
}

export function updateTextBlockContent(
  blocks: CreatureSheetBlock[],
  blockId: string,
  patch: { title?: string; content?: string },
): CreatureSheetBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId || b.type !== "text") return b;
    return {
      ...b,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
    };
  });
}

export function updateTableBlockData(
  blocks: CreatureSheetBlock[],
  blockId: string,
  patch: { title?: string; tableData?: CreatureTableData },
): CreatureSheetBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId || b.type !== "table") return b;
    return {
      ...b,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.tableData !== undefined
        ? { tableData: normalizeCreatureTableData(patch.tableData) }
        : {}),
    };
  });
}

// ============================================================================
// RITUAIS VINCULADOS (BIBLIOTECA + FICHAS DE PLAYERS, SEM DUPLICAÇÃO)
// ============================================================================

export function normalizeCreatureRitualRefs(raw: unknown): CreatureRitualRef[] {
  if (!Array.isArray(raw)) return [];
  const seenKeys = new Set<string>();
  const out: CreatureRitualRef[] = [];

  raw.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, any>;
    const source: "library" | "player" =
      obj.source === "player" ? "player" : "library";
    const sourceId = typeof obj.sourceId === "string" ? obj.sourceId.trim() : "";
    if (!sourceId) return;

    const ritualId =
      source === "player" && Number.isFinite(Number(obj.ritualId))
        ? Number(obj.ritualId)
        : null;

    const dedupKey = `${source}:${sourceId}:${ritualId ?? ""}`;
    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);

    const snapshot = obj.fallbackSnapshot
      ? normalizeRitualItem(obj.fallbackSnapshot, ritualId || idx + 1) ?? undefined
      : undefined;

    out.push({
      id:
        typeof obj.id === "string" && obj.id.trim()
          ? obj.id.trim()
          : `cr_rit_${Date.now().toString(36)}_${idx}`,
      source,
      sourceId,
      ritualId,
      sourceLabel:
        typeof obj.sourceLabel === "string" && obj.sourceLabel.trim()
          ? obj.sourceLabel.trim()
          : source === "library"
            ? "Biblioteca"
            : "Ficha de Jogador",
      ...(snapshot ? { fallbackSnapshot: snapshot } : {}),
    });
  });

  return out;
}

/**
 * Reúne todos os Rituais já cadastrados (Biblioteca + fichas de Players + ficha local)
 * para seleção no Bloco de Rituais sem duplicar registros no banco.
 */
export function buildAvailableRitualsCatalog(params: {
  libraryItems: MasterLibraryItem[];
  players?: Array<{ id: string; name?: string; rituals?: unknown }>;
  localPlayerRituals?: RitualItem[];
  localPlayerName?: string;
}): CatalogRitualOption[] {
  const options: CatalogRitualOption[] = [];
  const seenKeys = new Set<string>();

  // 1. Rituais da Biblioteca do Mestre
  for (const item of params.libraryItems) {
    if (item.type !== "ritual") continue;
    const ritualItem = item as MasterLibraryRitualItem;
    const clean = normalizeRitualItem(ritualItem.data, ritualItem.data.id || 1);
    if (!clean) continue;
    const key = `library:${ritualItem.id}:`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    options.push({
      key,
      source: "library",
      sourceId: ritualItem.id,
      ritualId: null,
      sourceLabel: "Biblioteca",
      ritual: clean,
    });
  }

  // 2. Rituais das fichas de Jogadores conectados (aba Player)
  if (Array.isArray(params.players)) {
    for (const player of params.players) {
      if (!player || !player.id) continue;
      const pRituals = normalizeRituals(player.rituals);
      const pName = (player.name || "Jogador").trim();
      for (const ritual of pRituals) {
        const key = `player:${player.id}:${ritual.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        options.push({
          key,
          source: "player",
          sourceId: player.id,
          ritualId: ritual.id,
          sourceLabel: `Player: ${pName}`,
          ritual,
        });
      }
    }
  }

  // 3. Rituais da ficha local atual (caso ainda não esteja na lista de conectados)
  if (Array.isArray(params.localPlayerRituals) && params.localPlayerRituals.length > 0) {
    const localLabel = `Player: ${(params.localPlayerName || "Ficha Local").trim()}`;
    for (const ritual of normalizeRituals(params.localPlayerRituals)) {
      const key = `player:local_sheet:${ritual.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      options.push({
        key,
        source: "player",
        sourceId: "local_sheet",
        ritualId: ritual.id,
        sourceLabel: localLabel,
        ritual,
      });
    }
  }

  return options.sort((a, b) =>
    (a.ritual.name || "").localeCompare(b.ritual.name || "", "pt-BR"),
  );
}

/**
 * Resolve as referências de Rituais da criatura buscando sempre os dados vivos originais.
 */
export function resolveCreatureRituals(
  refs: CreatureRitualRef[],
  catalog: CatalogRitualOption[],
): ResolvedCreatureRitual[] {
  const byKey = new Map<string, CatalogRitualOption>();
  for (const opt of catalog) {
    byKey.set(opt.key, opt);
  }

  const resolved: ResolvedCreatureRitual[] = [];
  for (const ref of refs) {
    const key = `${ref.source}:${ref.sourceId}:${ref.ritualId ?? ""}`;
    const live = byKey.get(key);
    if (live) {
      resolved.push({
        ref,
        ritual: live.ritual,
        isSourceMissing: false,
        sourceLabel: live.sourceLabel,
      });
      continue;
    }

    if (ref.fallbackSnapshot) {
      resolved.push({
        ref,
        ritual: ref.fallbackSnapshot,
        isSourceMissing: true,
        sourceLabel: ref.sourceLabel || "Origem indisponível",
      });
    }
  }

  return resolved;
}

export function linkRitualToCreature(
  creature: CreatureRecord,
  option: CatalogRitualOption,
): { ok: true; creature: CreatureRecord; ref: CreatureRitualRef } | { ok: false; error: string } {
  const alreadyLinked = (creature.rituals || []).some(
    (r) =>
      r.source === option.source &&
      r.sourceId === option.sourceId &&
      (r.ritualId ?? null) === (option.ritualId ?? null),
  );
  if (alreadyLinked) {
    return {
      ok: false,
      error: `O ritual "${option.ritual.name || "Sem nome"}" já está vinculado a esta criatura.`,
    };
  }

  const ref: CreatureRitualRef = {
    id: `cr_rit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source: option.source,
    sourceId: option.sourceId,
    ritualId: option.ritualId ?? null,
    sourceLabel: option.sourceLabel,
    fallbackSnapshot: option.ritual,
  };

  return {
    ok: true,
    ref,
    creature: {
      ...creature,
      rituals: [...(creature.rituals || []), ref],
      updatedAt: Date.now(),
    },
  };
}

export function unlinkRitualFromCreature(
  creature: CreatureRecord,
  refId: string,
): CreatureRecord {
  return {
    ...creature,
    rituals: (creature.rituals || []).filter((r) => r.id !== refId),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// MODOS DA CRIATURA (BASEADO NO SISTEMA OFICIAL DE PDI)
// ============================================================================

export function normalizeCreatureModes(raw: unknown): CreatureModeItem[] {
  if (!Array.isArray(raw)) return [];
  const normalizedBase = normalizePdis(raw, []);
  const notesById = new Map<string, string>();
  raw.forEach((entry: any) => {
    if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.notes === "string") {
      notesById.set(entry.id.trim(), entry.notes.trim().slice(0, 1000));
    }
  });

  return normalizedBase.map((pdi) => {
    const notes = notesById.get(pdi.id);
    return notes ? { ...pdi, notes } : { ...pdi };
  });
}

export function upsertCreatureMode(
  modes: CreatureModeItem[],
  draft: PdiItem & { notes?: string },
): CreatureModeItem[] {
  const [clean] = normalizeCreatureModes([draft]);
  if (!clean) return modes;
  const exists = modes.some((m) => m.id === clean.id);
  if (exists) {
    return modes.map((m) => (m.id === clean.id ? clean : m));
  }
  return [...modes, clean];
}

export function removeCreatureMode(
  modes: CreatureModeItem[],
  modeId: string,
): CreatureModeItem[] {
  return modes.filter((m) => m.id !== modeId);
}

export function toggleCreatureModeActive(
  modes: CreatureModeItem[],
  modeId: string,
): CreatureModeItem[] {
  return modes.map((m) => (m.id === modeId ? { ...m, active: !m.active } : m));
}

export function moveCreatureMode(
  modes: CreatureModeItem[],
  modeId: string,
  delta: -1 | 1,
): CreatureModeItem[] {
  const idx = modes.findIndex((m) => m.id === modeId);
  if (idx === -1) return modes;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= modes.length) return modes;
  const next = [...modes];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}
