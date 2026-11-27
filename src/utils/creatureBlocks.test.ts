import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATURE_TABLE_MAX_COLS,
  CREATURE_TABLE_MAX_ROWS,
  CURRENT_CREATURE_SHEET_VERSION,
  addBlockToSheet,
  addTableColumn,
  addTableRow,
  buildAvailableRitualsCatalog,
  buildDefaultCreatureSheetBlocks,
  createDefaultCreatureTableData,
  duplicateBlockInSheet,
  getSpreadsheetColumnLabel,
  linkRitualToCreature,
  migrateLegacyCreatureToBlocks,
  moveCreatureMode,
  moveSheetBlockByOffset,
  needsLegacySheetBlockMigration,
  normalizeCreatureSheetBlocks,
  normalizeCreatureTableData,
  removeBlockFromSheet,
  removeCreatureMode,
  removeTableColumn,
  removeTableRow,
  reorderSheetBlocks,
  resizeSheetBlock,
  resolveCreatureRituals,
  toggleCreatureModeActive,
  toggleTableHeaderRow,
  unlinkRitualFromCreature,
  updateTableBlockData,
  updateTableCell,
  upsertCreatureMode,
} from "./creatureBlocks";
import {
  buildInvokedSessionSheetFromCreature,
  createNewCreatureDraft,
  normalizeCreatureRecord,
} from "./masterCreatures";
import type { MasterLibraryItem } from "../types/masterLibrary";

test("Legacy fixed creature migrates non-destructively to modular sheet blocks preserving all attributes, PV/PE, and skills", () => {
  const legacyRaw = {
    id: "crt_legacy_1",
    masterId: "m1",
    name: "Espectro Antigo",
    description: "Criatura legada antes dos blocos dinâmicos.",
    variables: { VIT: 5, AGL: 4, FOR: 2, OCU: 3, INT: 2, SAN: 3 },
    skills: [
      {
        id: "csk_1",
        ownership: "exclusive",
        skillData: { id: 101, name: "Toque Gélido", cost: 2, desc: "Gela o alvo." },
      },
    ],
  };

  const normalized = normalizeCreatureRecord(legacyRaw, "m1");
  assert.ok(normalized);
  assert.equal(needsLegacySheetBlockMigration(normalized), true);
  assert.equal(normalized.hpMax, 20 + 5 * 6);
  assert.equal(normalized.peMax, 5 + 4 * 3 + 3 * 2);
  // LV automatically honors existing high attribute VIT=5 -> min LV 2 (limit 5) without reducing VIT
  assert.equal(normalized.lv, 2);

  const { creature: migrated, migrated: didMigrate } =
    migrateLegacyCreatureToBlocks(normalized);
  assert.equal(didMigrate, true);
  assert.equal(migrated.sheetVersion, CURRENT_CREATURE_SHEET_VERSION);
  assert.deepEqual(
    migrated.sheetBlocks.map((b) => b.type),
    ["profile", "status", "skills"],
  );
  assert.equal(migrated.variables.VIT, 5);
  assert.equal(migrated.skills.length, 1);

  // Second migration call is idempotent
  const second = migrateLegacyCreatureToBlocks(migrated);
  assert.equal(second.migrated, false);
});

test("Modular layout operations support adding, duplicating text, reordering, resizing with bounds, and removing blocks", () => {
  let blocks = buildDefaultCreatureSheetBlocks();
  assert.equal(blocks.length, 3);

  // Singleton blocks cannot be added twice
  const dupStatus = addBlockToSheet(blocks, "status");
  assert.equal(dupStatus.ok, false);

  // Adding rituals & text blocks works
  const addedRituals = addBlockToSheet(blocks, "rituals");
  assert.equal(addedRituals.ok, true);
  if (addedRituals.ok) blocks = addedRituals.blocks;

  const addedText = addBlockToSheet(blocks, "text");
  assert.equal(addedText.ok, true);
  if (addedText.ok) blocks = addedText.blocks;
  const textBlockId = addedText.ok ? addedText.block.id : "";

  // Duplicate text block succeeds; duplicate profile fails
  const dupText = duplicateBlockInSheet(blocks, textBlockId);
  assert.equal(dupText.ok, true);
  if (dupText.ok) blocks = dupText.blocks;

  const dupProfile = duplicateBlockInSheet(blocks, blocks[0].id);
  assert.equal(dupProfile.ok, false);

  // Resize clamps to block bounds
  blocks = resizeSheetBlock(blocks, textBlockId, { widthPct: 10, minHeightPx: 260 });
  const resizedText = blocks.find((b) => b.id === textBlockId);
  assert.equal(resizedText?.widthPct, 25);
  assert.equal(resizedText?.minHeightPx, 260);

  // Reorder moves text block before status
  const statusId = blocks.find((b) => b.type === "status")!.id;
  blocks = reorderSheetBlocks(blocks, textBlockId, statusId, "before");
  assert.equal(blocks.findIndex((b) => b.id === textBlockId), 1);

  // Offset move shifts right by 1
  blocks = moveSheetBlockByOffset(blocks, textBlockId, 1);
  assert.equal(blocks.findIndex((b) => b.id === textBlockId), 2);

  // Remove deletes only target block
  const countBefore = blocks.length;
  blocks = removeBlockFromSheet(blocks, textBlockId);
  assert.equal(blocks.length, countBefore - 1);
});

test("Ritual catalog aggregates Library and Player rituals without duplication and resolves live updates", () => {
  const libraryItems: MasterLibraryItem[] = [
    {
      id: "lib_rit_1",
      type: "ritual",
      folderId: null,
      createdAt: 1,
      updatedAt: 1,
      data: {
        id: 1,
        name: "Sussurro da Membrana",
        level: 2,
        difficulty: 9,
        cost: 4,
        desc: "Descrição original",
        affiliations: ["membrana", "medo"],
        damage: "2D6+OCU",
        needsTest: true,
      },
    },
  ];
  const players = [
    {
      id: "player_1",
      name: "Vitor",
      rituals: [
        {
          id: 77,
          name: "Chama da Dor",
          level: 1,
          difficulty: 8,
          cost: 2,
          desc: "Ritual do jogador",
          affiliations: ["dor"],
          damage: "1D8",
          needsTest: true,
        },
      ],
    },
  ];

  const catalog = buildAvailableRitualsCatalog({ libraryItems, players });
  assert.equal(catalog.length, 2);

  let creature = createNewCreatureDraft("m1", null, { name: "Arauto" });
  const linkLib = linkRitualToCreature(creature, catalog[1]);
  assert.equal(linkLib.ok, true);
  if (linkLib.ok) creature = linkLib.creature;

  const linkPlayer = linkRitualToCreature(creature, catalog[0]);
  assert.equal(linkPlayer.ok, true);
  if (linkPlayer.ok) creature = linkPlayer.creature;

  // Duplicate link is rejected
  const dupLink = linkRitualToCreature(creature, catalog[0]);
  assert.equal(dupLink.ok, false);

  // Updating the original Library ritual updates resolution live without modifying creature
  const updatedLib: MasterLibraryItem[] = [
    {
      ...libraryItems[0],
      data: { ...libraryItems[0].data, desc: "Descrição atualizada na Biblioteca" },
    } as MasterLibraryItem,
  ];
  const updatedCatalog = buildAvailableRitualsCatalog({
    libraryItems: updatedLib,
    players,
  });
  const resolved = resolveCreatureRituals(creature.rituals, updatedCatalog);
  const libResolved = resolved.find((r) => r.ref.source === "library");
  assert.equal(libResolved?.ritual.desc, "Descrição atualizada na Biblioteca");
  assert.equal(libResolved?.isSourceMissing, false);

  // Unlinking removes from creature only
  creature = unlinkRitualFromCreature(creature, creature.rituals[0].id);
  assert.equal(creature.rituals.length, 1);
});

test("Creature Modes reuse PDI modifiers and transfer into invoked session sheets alongside LV and Rituals", () => {
  let modes = upsertCreatureMode([], {
    id: "mode_frenesi",
    name: "Frenesi Abissal",
    desc: "Quando abaixo de 50% de PV.",
    active: true,
    modifiers: { FOR: { buffDice: "1d6" }, SAN: { debuffFlat: 1 } },
    notes: "Ataca duas vezes por rodada.",
  });
  modes = upsertCreatureMode(modes, {
    id: "mode_sombra",
    name: "Forma Etérea",
    desc: "Imune a dano físico comum.",
    active: false,
    modifiers: { AGL: { buffFlat: 2 } },
  });

  assert.equal(modes.length, 2);
  modes = toggleCreatureModeActive(modes, "mode_sombra");
  assert.equal(modes[1].active, true);

  modes = moveCreatureMode(modes, "mode_sombra", -1);
  assert.equal(modes[0].id, "mode_sombra");

  const creature = createNewCreatureDraft("m1", null, {
    name: "Aberração",
    lv: 3,
    variables: { VIT: 4, AGL: 3, FOR: 4, OCU: 2, INT: 2, SAN: 2 },
    modes,
  });

  const invoked = buildInvokedSessionSheetFromCreature(creature, [], []);
  assert.equal(invoked.lv, 3);
  assert.equal(invoked.pdis.length, 2);
  assert.equal(invoked.pdis[0].name, "Forma Etérea");
  assert.equal(invoked.pdis[1].modifiers.FOR.buffDice, "1d6");

  const afterRemove = removeCreatureMode(modes, "mode_sombra");
  assert.equal(afterRemove.length, 1);
});

test("Excel-style table block supports column letters, cell edits, add/remove rows & cols, deep-clone duplication, and bounds", () => {
  assert.equal(getSpreadsheetColumnLabel(0), "A");
  assert.equal(getSpreadsheetColumnLabel(25), "Z");
  assert.equal(getSpreadsheetColumnLabel(26), "AA");
  assert.equal(getSpreadsheetColumnLabel(27), "AB");

  let blocks = buildDefaultCreatureSheetBlocks();
  const added = addBlockToSheet(blocks, "table");
  assert.equal(added.ok, true);
  if (!added.ok) return;
  blocks = added.blocks;

  const tableBlock = added.block;
  assert.equal(tableBlock.type, "table");
  assert.equal(tableBlock.tableData?.rows.length, 4);
  assert.equal(tableBlock.tableData?.rows[0].length, 3);
  assert.equal(tableBlock.tableData?.hasHeaderRow, true);

  // Edit cells, add row & col, toggle header
  let td = createDefaultCreatureTableData(2, 2);
  td = updateTableCell(td, 0, 0, "**Ataque**");
  td = updateTableCell(td, 1, 1, "2d6 #(Dor)");
  td = addTableRow(td);
  assert.equal(td.rows.length, 3);
  td = addTableColumn(td);
  assert.equal(td.rows[0].length, 3);
  assert.equal(td.rows[0][2], "Coluna C");

  blocks = updateTableBlockData(blocks, tableBlock.id, {
    title: "Tabela de Combate",
    tableData: td,
  });

  // Duplicate deep-clones rows so mutating original never mutates clone
  const dup = duplicateBlockInSheet(blocks, tableBlock.id);
  assert.equal(dup.ok, true);
  if (!dup.ok) return;
  blocks = dup.blocks;
  assert.equal(dup.block.title, "Tabela de Combate (Cópia)");
  assert.equal(dup.block.tableData?.rows[0][0], "**Ataque**");

  const mutatedOrig = updateTableCell(td, 0, 0, "Alterado");
  blocks = updateTableBlockData(blocks, tableBlock.id, {
    tableData: mutatedOrig,
  });
  const clonedAfter = blocks.find((b) => b.id === dup.block.id);
  assert.equal(clonedAfter?.tableData?.rows[0][0], "**Ataque**");

  // Minimum bounds: never removes last remaining row or col
  let tiny = createDefaultCreatureTableData(1, 1);
  tiny = removeTableRow(tiny, 0);
  tiny = removeTableColumn(tiny, 0);
  assert.equal(tiny.rows.length, 1);
  assert.equal(tiny.rows[0].length, 1);

  // Toggle header row
  const toggled = toggleTableHeaderRow(tiny);
  assert.equal(toggled.hasHeaderRow, false);

  // Normalization pads jagged rows and clamps max dimensions
  const jagged = normalizeCreatureTableData({
    rows: Array.from({ length: CREATURE_TABLE_MAX_ROWS + 5 }, (_, i) =>
      i === 0
        ? Array.from({ length: CREATURE_TABLE_MAX_COLS + 4 }, (__, c) => `C${c}`)
        : ["only-one"],
    ),
    hasHeaderRow: false,
  });
  assert.equal(jagged.rows.length, CREATURE_TABLE_MAX_ROWS);
  assert.equal(jagged.rows[0].length, CREATURE_TABLE_MAX_COLS);
  assert.equal(jagged.rows[1].length, CREATURE_TABLE_MAX_COLS);
  assert.equal(jagged.rows[1][1], "");
  assert.equal(jagged.hasHeaderRow, false);

  // Round-trip through normalizeCreatureSheetBlocks preserves tableData
  const normalizedBlocks = normalizeCreatureSheetBlocks(blocks);
  const restored = normalizedBlocks.find((b) => b.id === dup.block.id);
  assert.equal(restored?.tableData?.rows[1][1], "2d6 #(Dor)");
});
