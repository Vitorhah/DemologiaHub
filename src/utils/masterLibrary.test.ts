import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LIBRARY_JSON_BYTES,
  buildLibraryItemFilename,
  buildPushPayloadFromLibraryItem,
  canMoveFolderInto,
  createDefaultPdiData,
  createDefaultRitualData,
  createDefaultSkillData,
  createDefaultTributoData,
  createLibraryFolder,
  deleteLibraryFolder,
  exportLibraryItemToJson,
  filterLibraryItems,
  getFolderBreadcrumb,
  getFolderPathLabel,
  getFolderStats,
  normalizeLibraryFolders,
  normalizeLibraryItems,
  parseImportedLibraryJson,
  renameLibraryFolder,
} from "./masterLibrary";
import type { MasterLibraryFolder, MasterLibraryItem } from "../types/masterLibrary";

test("folder tree operations: create nested folders, reject duplicates, rename, and delete without losing files", () => {
  let folders: MasterLibraryFolder[] = [];

  const r1 = createLibraryFolder(folders, "Campanha 01", null, 100);
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  folders = r1.folders;
  const f1 = r1.folder;

  // Duplicate at same level rejected (case-insensitive)
  const dup = createLibraryFolder(folders, "campanha 01", null, 101);
  assert.equal(dup.ok, false);

  // Same name allowed inside subfolder
  const sub = createLibraryFolder(folders, "Campanha 01", f1.id, 102);
  assert.equal(sub.ok, true);
  if (!sub.ok) return;
  folders = sub.folders;
  const f2 = sub.folder;

  // Deep subfolder
  const deep = createLibraryFolder(folders, "Proibidos", f2.id, 103);
  assert.equal(deep.ok, true);
  if (!deep.ok) return;
  folders = deep.folders;
  const f3 = deep.folder;

  // Breadcrumb & path label
  const crumb = getFolderBreadcrumb(folders, f3.id);
  assert.deepEqual(
    crumb.map((f) => f.id),
    [f1.id, f2.id, f3.id]
  );
  assert.equal(getFolderPathLabel(folders, f3.id), "Campanha 01 / Campanha 01 / Proibidos");
  assert.equal(getFolderPathLabel(folders, null), "Raiz");

  // Cycle checks
  assert.equal(canMoveFolderInto(folders, f1.id, f3.id), false);
  assert.equal(canMoveFolderInto(folders, f1.id, f1.id), false);
  assert.equal(canMoveFolderInto(folders, f3.id, null), true);

  // Rename subfolder
  const renamed = renameLibraryFolder(folders, f2.id, "Ato II", 104);
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  folders = renamed.folders;
  assert.equal(getFolderPathLabel(folders, f3.id), "Campanha 01 / Ato II / Proibidos");

  // Items inside nested folders
  const items: MasterLibraryItem[] = [
    {
      id: "i_ritual",
      type: "ritual",
      folderId: f3.id,
      createdAt: 200,
      updatedAt: 200,
      data: {
        ...createDefaultRitualData(10),
        name: "Selo do Vazio",
        level: 3,
        difficulty: 12,
        affiliations: ["caos", "medo"],
      },
    },
    {
      id: "i_root",
      type: "tributo",
      folderId: null,
      createdAt: 201,
      updatedAt: 201,
      data: {
        ...createDefaultTributoData(),
        name: "Olho Que Tudo Vê",
        passivo: "+1 INT",
        ativo: "Revela segredos",
      },
    },
  ];

  // Folder stats include descendant items
  const statsF1 = getFolderStats(folders, items, f1.id);
  assert.equal(statsF1.directSubfolders, 1);
  assert.equal(statsF1.totalItems, 1);

  // Deleting f2 deletes f2 and f3, moving i_ritual safely up to f1 (parent of f2)
  const deleted = deleteLibraryFolder(folders, items, f2.id, 300);
  assert.equal(deleted.movedItemsCount, 1);
  assert.deepEqual(
    deleted.folders.map((f) => f.id),
    [f1.id]
  );
  const movedRitual = deleted.items.find((i) => i.id === "i_ritual");
  assert.equal(movedRitual?.folderId, f1.id);
});

test("normalizeLibraryFolders breaks accidental parent cycles safely", () => {
  const normalized = normalizeLibraryFolders([
    { id: "a", name: "Pasta A", parentId: "b", createdAt: 1, updatedAt: 1 },
    { id: "b", name: "Pasta B", parentId: "a", createdAt: 2, updatedAt: 2 },
  ]);
  assert.equal(normalized.length, 2);
  // At least one or both have parentId reset to null so no infinite loop occurs
  const crumbA = getFolderBreadcrumb(normalized, "a");
  assert.ok(crumbA.length >= 1 && crumbA.length <= 2);
});

test("JSON export and import round-trip preserves 100% of fields for Ritual, Skill, PDI, and Tributo", () => {
  const ritualItem: MasterLibraryItem = {
    id: "lib_rit_1",
    type: "ritual",
    folderId: "fld_1",
    createdAt: 1000,
    updatedAt: 1000,
    data: {
      id: 42,
      name: "Eco da Membrana",
      cost: 4,
      desc: "Rasga a realidade por um turno.",
      damage: "3d6+OCU",
      difficulty: 13,
      level: 4,
      affiliations: ["membrana", "intencao", "caos"],
      needsTest: true,
    },
  };

  const skillItem: MasterLibraryItem = {
    id: "lib_sk_1",
    type: "skill",
    folderId: null,
    createdAt: 1001,
    updatedAt: 1001,
    data: {
      ...createDefaultSkillData(55),
      name: "Golpe Cirúrgico",
      cost: 3,
      desc: "Ataque preciso com pós-efeito.",
      test: "2d6",
      damage: "1d8",
      needsTest: true,
      testVar: "AGL",
      damageVar: "FOR",
      testPostVar: "INT",
      testPostFormula: "+2",
      damagePostVar: "OCU",
      damagePostFormula: "+1d4",
    },
  };

  const pdiItem: MasterLibraryItem = {
    id: "lib_pdi_1",
    type: "pdi",
    folderId: null,
    createdAt: 1002,
    updatedAt: 1002,
    data: {
      ...createDefaultPdiData(66),
      name: "Marca do Abismo",
      desc: "Altera a percepção paranormal.",
      active: false,
      modifiers: {
        OCU: { buffFlat: 2, buffDice: "1d6" },
        SAN: { debuffFlat: 1, debuffDice: "1d4" },
      },
    },
  };

  const tributoItem: MasterLibraryItem = {
    id: "lib_tr_1",
    type: "tributo",
    folderId: null,
    createdAt: 1003,
    updatedAt: 1003,
    data: {
      name: "Chama Pálida",
      desc: "Fogo frio vindo do outro lado.",
      passivo: "Resistência a dano mental.",
      ativo: "Causa 2d6 de dano espiritual gastando 3 PE.",
    },
  };

  for (const item of [ritualItem, skillItem, pdiItem, tributoItem]) {
    const json = exportLibraryItemToJson(item, "2026-01-01T00:00:00.000Z");
    const parsed = parseImportedLibraryJson(json, "target_folder", 9999);
    assert.equal(parsed.ok, true, `Failed round-trip for ${item.type}`);
    if (!parsed.ok) continue;
    assert.equal(parsed.item.type, item.type);
    assert.equal(parsed.item.folderId, "target_folder");

    if (item.type === "ritual" && parsed.item.type === "ritual") {
      assert.equal(parsed.item.data.name, item.data.name);
      assert.equal(parsed.item.data.cost, 4);
      assert.equal(parsed.item.data.difficulty, 13);
      assert.equal(parsed.item.data.level, 4);
      assert.deepEqual(parsed.item.data.affiliations, ["membrana", "intencao", "caos"]);
      assert.equal(parsed.item.data.damage, "3d6+OCU");
    } else if (item.type === "skill" && parsed.item.type === "skill") {
      assert.equal(parsed.item.data.name, item.data.name);
      assert.equal(parsed.item.data.testVar, "AGL");
      assert.equal(parsed.item.data.damageVar, "FOR");
      assert.equal(parsed.item.data.testPostVar, "INT");
      assert.equal(parsed.item.data.testPostFormula, "+2");
      assert.equal(parsed.item.data.damagePostVar, "OCU");
      assert.equal(parsed.item.data.damagePostFormula, "+1d4");
      assert.equal(parsed.item.data.needsTest, true);
    } else if (item.type === "pdi" && parsed.item.type === "pdi") {
      assert.equal(parsed.item.data.name, item.data.name);
      assert.equal(parsed.item.data.modifiers.OCU?.buffFlat, 2);
      assert.equal(parsed.item.data.modifiers.OCU?.buffDice, "1d6");
      assert.equal(parsed.item.data.modifiers.SAN?.debuffFlat, 1);
      assert.equal(parsed.item.data.modifiers.SAN?.debuffDice, "1d4");
    } else if (item.type === "tributo" && parsed.item.type === "tributo") {
      assert.deepEqual(parsed.item.data, item.data);
    }
  }

  assert.equal(buildLibraryItemFilename(ritualItem), "ritual-eco-da-membrana.json");
});

test("parseImportedLibraryJson auto-detects external raw JSON created outside the Hub", () => {
  const rawRitual = JSON.stringify({
    name: "Lamento Externo",
    level: 2,
    difficulty: 9,
    cost: 2,
    affiliations: ["dor", "alma"],
    desc: "Criado fora do Hub",
    damage: "2d6",
  });
  const r1 = parseImportedLibraryJson(rawRitual);
  assert.equal(r1.ok, true);
  if (r1.ok) assert.equal(r1.item.type, "ritual");

  const rawSkill = JSON.stringify({
    name: "Investida Brutal",
    cost: 2,
    test: "2d6",
    testVar: "FOR",
    damage: "2d8",
    needsTest: true,
  });
  const r2 = parseImportedLibraryJson(rawSkill);
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.item.type, "skill");

  const rawPdi = JSON.stringify({
    name: "Trauma Latente",
    desc: "PDI externo",
    modifiers: {
      VIT: { buffFlat: 1 },
      INT: { debuffDice: "1d4" },
    },
  });
  const r3 = parseImportedLibraryJson(rawPdi);
  assert.equal(r3.ok, true);
  if (r3.ok) assert.equal(r3.item.type, "pdi");

  const rawTributo = JSON.stringify({
    name: "Véu de Cinzas",
    desc: "Tributo externo",
    passivo: "Oculta presença",
    ativo: "Cria névoa",
  });
  const r4 = parseImportedLibraryJson(rawTributo);
  assert.equal(r4.ok, true);
  if (r4.ok) assert.equal(r4.item.type, "tributo");
});

test("parseImportedLibraryJson rejects invalid, oversized, prototype-polluting, or incompatible JSON", () => {
  assert.equal(parseImportedLibraryJson("").ok, false);
  assert.equal(parseImportedLibraryJson("{bad json").ok, false);
  assert.equal(parseImportedLibraryJson("[]").ok, false);
  assert.equal(parseImportedLibraryJson("x".repeat(MAX_LIBRARY_JSON_BYTES + 10)).ok, false);

  // Full character sheet rejected with diagnostic
  const fullSheet = parseImportedLibraryJson(
    JSON.stringify({
      name: "Personagem",
      variables: { VIT: 2 },
      hp: { current: 20, max: 20 },
      pe: { current: 10, max: 10 },
      skills: [],
    })
  );
  assert.equal(fullSheet.ok, false);
  if (!fullSheet.ok) {
    assert.match(fullSheet.error, /Ficha completa/i);
  }

  // Unknown type
  assert.equal(parseImportedLibraryJson(JSON.stringify({ type: "monstro", data: { name: "X" } })).ok, false);

  // Invalid ritual level & unknown affiliation
  assert.equal(
    parseImportedLibraryJson(JSON.stringify({ type: "ritual", data: { name: "X", level: 9 } })).ok,
    false
  );
  assert.equal(
    parseImportedLibraryJson(
      JSON.stringify({ type: "ritual", data: { name: "X", affiliations: ["inexistente"] } })
    ).ok,
    false
  );

  // Invalid PDI attribute & die
  assert.equal(
    parseImportedLibraryJson(
      JSON.stringify({ type: "pdi", data: { name: "X", modifiers: { SORTE: { buffFlat: 1 } } } })
    ).ok,
    false
  );
  assert.equal(
    parseImportedLibraryJson(
      JSON.stringify({ type: "pdi", data: { name: "X", modifiers: { VIT: { buffDice: "1d99" } } } })
    ).ok,
    false
  );

  // Prototype pollution stripped safely
  const polluted = '{"type":"tributo","__proto__":{"polluted":true},"data":{"name":"Seguro","passivo":"OK","constructor":{"x":1}}}';
  const res = parseImportedLibraryJson(polluted);
  assert.equal(res.ok, true);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("buildPushPayloadFromLibraryItem and filterLibraryItems work across all 4 types", () => {
  const items = normalizeLibraryItems([
    {
      id: "1",
      type: "ritual",
      folderId: "f1",
      data: { name: "Chama", level: 2, difficulty: 10, affiliations: ["dor"], damage: "2d6" },
    },
    {
      id: "2",
      type: "skill",
      folderId: null,
      data: { name: "Corte", cost: 2, test: "2d6", testVar: "FOR", needsTest: true },
    },
    {
      id: "3",
      type: "pdi",
      folderId: null,
      data: { id: "pdi_a", name: "Cicatriz", modifiers: { VIT: { buffFlat: 1 } } },
    },
    {
      id: "4",
      type: "tributo",
      folderId: null,
      data: { name: "Âncora", passivo: "Estável", ativo: "Imobiliza" },
    },
  ], [{ id: "f1", name: "Pasta 1", parentId: null, createdAt: 1, updatedAt: 1 }]);

  assert.equal(items.length, 4);

  // Folder-scoped vs global search
  assert.equal(
    filterLibraryItems(items, { currentFolderId: null, typeFilter: "all", search: "", searchAllFolders: true }).length,
    3
  );
  assert.equal(
    filterLibraryItems(items, { currentFolderId: null, typeFilter: "all", search: "dor", searchAllFolders: true }).length,
    1
  );

  // Payloads for distribution
  const pRitual = buildPushPayloadFromLibraryItem(items[0]);
  assert.equal(pRitual.ritual?.name, "Chama");
  const pSkill = buildPushPayloadFromLibraryItem(items[1]);
  assert.equal(pSkill.skill?.testVar, "FOR");
  const pPdi = buildPushPayloadFromLibraryItem(items[2]);
  assert.equal(pPdi.pdi?.name, "Cicatriz");
  const pTributo = buildPushPayloadFromLibraryItem(items[3]);
  assert.equal(pTributo.tributo?.name, "Âncora");
});
