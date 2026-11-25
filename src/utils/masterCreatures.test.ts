import test from "node:test";
import assert from "node:assert/strict";
import {
  addExclusiveSkillToCreature,
  buildCreatureFromLegacyExtra,
  buildInvokedSessionSheetFromCreature,
  buildInvokedSessionSheetsBatch,
  buildNextInvokedInstanceName,
  calculateCreatureStats,
  createCreatureFolderEntry,
  createDefaultCreatureSkillData,
  createNewCreatureDraft,
  deleteCreatureFolderEntry,
  detachLinkedSkillToExclusive,
  filterCreatureSummaries,
  findUnmigratedLegacyExtras,
  getCreatureFolderBreadcrumb,
  getCreatureFolderPathLabel,
  getCreatureFolderStats,
  linkLibrarySkillToCreature,
  removeSkillFromCreature,
  renameCreatureFolderEntry,
  resolveCreatureSkills,
  toCreatureSummary,
  updateExclusiveCreatureSkill,
} from "./masterCreatures";
import { isSystemRecordId } from "./handoutsLogic";
import type { MasterLibrarySkillItem } from "../types/masterLibrary";

const MOCK_LIBRARY_SKILL: MasterLibrarySkillItem = {
  id: "lib_skill_1",
  type: "skill",
  folderId: null,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  data: {
    id: 101,
    name: "Mordida Abissal",
    cost: 3,
    desc: "Investida voraz que drena vigor.",
    needsTest: true,
    test: "2D6+FOR",
    damage: "2D8+OCU",
    testVar: "",
    damageVar: "",
    testPostVar: "",
    testPostFormula: "",
    damagePostVar: "",
    damagePostFormula: "",
  },
};

test("Demologia creature formulas strictly follow PV=20+VIT*6, PE=5+AGL*3+SAN*2, SAN=30+SAN*4", () => {
  assert.deepEqual(
    calculateCreatureStats({ VIT: 1, AGL: 1, FOR: 1, OCU: 1, INT: 1, SAN: 1 }),
    { hpMax: 26, peMax: 10, smMax: 34 },
  );
  assert.deepEqual(
    calculateCreatureStats({ VIT: 4, AGL: 3, FOR: 5, OCU: 4, INT: 2, SAN: 2 }),
    { hpMax: 44, peMax: 18, smMax: 38 },
  );
  assert.deepEqual(
    calculateCreatureStats({ VIT: 0, AGL: 0, FOR: 0, OCU: 0, INT: 0, SAN: 0 }),
    { hpMax: 20, peMax: 5, smMax: 30 },
  );
  // Clamping floors for negative attributes
  assert.deepEqual(
    calculateCreatureStats({ VIT: -10, AGL: -5, FOR: 0, OCU: 0, INT: 0, SAN: -10 }),
    { hpMax: 1, peMax: 0, smMax: 1 },
  );
});

test("isSystemRecordId excludes CREATURE_ and CREATURE_FOLDERS_ records from player cards", () => {
  assert.equal(isSystemRecordId("CREATURE_crt_123"), true);
  assert.equal(isSystemRecordId("CREATURE_FOLDERS_master_1"), true);
});

test("Hierarchical creature folders support create, rename, duplicate rejection, breadcrumb, and safe deletion", () => {
  const r1 = createCreatureFolderEntry([], "m1", "Entidades", null);
  assert.equal(r1.ok, true);
  if (!r1.ok) return;

  // Duplicate in same parent rejected
  const dup = createCreatureFolderEntry(r1.folders, "m1", "entidades", null);
  assert.equal(dup.ok, false);

  // Nested subfolder allowed
  const r2 = createCreatureFolderEntry(r1.folders, "m1", "Abissais", r1.folder.id);
  assert.equal(r2.ok, true);
  if (!r2.ok) return;

  assert.equal(
    getCreatureFolderPathLabel(r2.folders, r2.folder.id),
    "Entidades / Abissais",
  );
  assert.equal(getCreatureFolderBreadcrumb(r2.folders, r2.folder.id).length, 2);

  // Rename subfolder
  const renamed = renameCreatureFolderEntry(r2.folders, r2.folder.id, "Sombras");
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(
    getCreatureFolderPathLabel(renamed.folders, r2.folder.id),
    "Entidades / Sombras",
  );

  const c1 = toCreatureSummary(
    createNewCreatureDraft("m1", r2.folder.id, { name: "Espectro" }),
  );
  const stats = getCreatureFolderStats(renamed.folders, [c1], r1.folder.id);
  assert.equal(stats.directSubfolders, 1);
  assert.equal(stats.directCreatures, 0);
  assert.equal(stats.totalCreatures, 1);

  // Delete child folder -> creature moves safely to parent folder
  const del = deleteCreatureFolderEntry(renamed.folders, [c1], r2.folder.id);
  assert.equal(del.targetParentId, r1.folder.id);
  assert.deepEqual(del.reassignedCreatureIds, [c1.id]);
  assert.equal(del.summaries[0].folderId, r1.folder.id);
});

test("Creature skills maintain exclusive vs linked ownership without mutating Library skills", () => {
  let creature = createNewCreatureDraft("m1", null, { name: "Vulto" });

  // Add exclusive skill
  const added = addExclusiveSkillToCreature(
    creature,
    createDefaultCreatureSkillData({
      name: "Toque Gélido",
      cost: 2,
      test: "2D6+OCU",
      damage: "1D6+OCU",
      needsTest: true,
    }),
  );
  assert.equal(added.ok, true);
  if (!added.ok) return;
  creature = added.creature;
  assert.equal(creature.skills.length, 1);
  assert.equal(creature.skills[0].ownership, "exclusive");

  // Link existing Library skill
  const linked = linkLibrarySkillToCreature(creature, MOCK_LIBRARY_SKILL);
  assert.equal(linked.ok, true);
  if (!linked.ok) return;
  creature = linked.creature;
  assert.equal(creature.skills.length, 2);
  assert.equal(creature.skills[1].ownership, "linked");
  assert.equal(creature.skills[1].librarySkillId, "lib_skill_1");

  // Linking the same Library skill twice is prevented
  const dupLink = linkLibrarySkillToCreature(creature, MOCK_LIBRARY_SKILL);
  assert.equal(dupLink.ok, false);

  // Live resolution reflects updated Library skill data
  const updatedLibSkill: MasterLibrarySkillItem = {
    ...MOCK_LIBRARY_SKILL,
    data: { ...MOCK_LIBRARY_SKILL.data, cost: 5, name: "Mordida Abissal II" },
  };
  const resolved = resolveCreatureSkills(creature.skills, [updatedLibSkill]);
  assert.equal(resolved[1].resolvedData.name, "Mordida Abissal II");
  assert.equal(resolved[1].resolvedData.cost, 5);
  assert.equal(resolved[1].isLibraryMissing, false);

  // Detaching linked skill creates an independent exclusive copy
  const detached = detachLinkedSkillToExclusive(
    creature,
    linked.entry.id,
    [updatedLibSkill],
  );
  assert.equal(detached.skills[1].ownership, "exclusive");
  assert.equal(detached.skills[1].librarySkillId, null);
  assert.equal(detached.skills[1].skillData.name, "Mordida Abissal II");

  // Update exclusive skill
  const edited = updateExclusiveCreatureSkill(
    creature,
    added.entry.id,
    createDefaultCreatureSkillData({ name: "Toque Abissal", cost: 4 }),
  );
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(edited.creature.skills[0].skillData.name, "Toque Abissal");

  // Removing linked skill leaves Library object completely untouched
  const afterRemove = removeSkillFromCreature(creature, linked.entry.id);
  assert.equal(afterRemove.skills.length, 1);
  assert.equal(MOCK_LIBRARY_SKILL.data.name, "Mordida Abissal");
});

test("Invoking creatures creates independent multi-instance session sheets without modifying the original", () => {
  let creature = createNewCreatureDraft("m1", null, {
    name: "Aberração",
    description: "Criatura das fendas.",
    variables: { VIT: 5, AGL: 2, FOR: 4, OCU: 3, INT: 1, SAN: 2 },
  });
  const linked = linkLibrarySkillToCreature(creature, MOCK_LIBRARY_SKILL);
  assert.equal(linked.ok, true);
  if (linked.ok) creature = linked.creature;

  assert.equal(buildNextInvokedInstanceName("Aberração", []), "Aberração");
  assert.equal(
    buildNextInvokedInstanceName("Aberração", ["Aberração"]),
    "Aberração #2",
  );
  assert.equal(
    buildNextInvokedInstanceName("Aberração", ["Aberração", "Aberração #2"]),
    "Aberração #3",
  );

  const batch = buildInvokedSessionSheetsBatch(
    creature,
    3,
    [MOCK_LIBRARY_SKILL],
    ["Investigador"],
  );
  assert.equal(batch.length, 3);
  assert.equal(batch[0].name, "Aberração");
  assert.equal(batch[1].name, "Aberração #2");
  assert.equal(batch[2].name, "Aberração #3");
  assert.equal(batch[0].hp.max, 50); // 20 + 5*6
  assert.equal(batch[0].pe.max, 15); // 5 + 2*3 + 2*2
  assert.equal(batch[0].sm.max, 38); // 30 + 2*4
  assert.equal(batch[0].synchronized, true);
  assert.equal(batch[0].sourceCreatureId, creature.id);
  assert.equal(batch[0].skills.length, 1);
  assert.equal(batch[0].skills[0].name, "Mordida Abissal");

  // Mutating invoked session sheet never mutates original creature
  batch[0].hp.current = 12;
  batch[0].variables.VIT = 9;
  batch[0].skills[0].name = "Alterada em Combate";
  assert.equal(creature.hpMax, 50);
  assert.equal(creature.variables.VIT, 5);
  assert.equal(creature.skills[0].skillData.name, "Mordida Abissal");

  // Single invocation after batch continues numbering cleanly
  const fourth = buildInvokedSessionSheetFromCreature(
    creature,
    [MOCK_LIBRARY_SKILL],
    batch.map((s) => s.name),
  );
  assert.equal(fourth.name, "Aberração #4");
});

test("Legacy extraFichas migrate automatically once without duplicates and ignore already-invoked sheets", () => {
  const legacyExtras = [
    {
      id: "old_1",
      name: "Cultista Veterano",
      notes: "Usa adaga cerimonial.",
      variables: { VIT: 2, AGL: 3, FOR: 2, OCU: 3, INT: 2, SAN: 1 },
      skills: [{ id: 1, name: "Corte Ritual", cost: 2, test: "2D6+FOR", damage: "1D6+FOR", needsTest: true }],
    },
    {
      id: "invoked_session_1",
      name: "Aberração",
      sourceCreatureId: "crt_existing",
      variables: { VIT: 5, AGL: 2, FOR: 4, OCU: 3, INT: 1, SAN: 2 },
    },
  ];

  const unmigrated = findUnmigratedLegacyExtras(legacyExtras, []);
  assert.equal(unmigrated.length, 1);
  assert.equal(unmigrated[0].id, "old_1");

  const migrated = buildCreatureFromLegacyExtra(unmigrated[0], "m1");
  assert.ok(migrated);
  assert.equal(migrated.name, "Cultista Veterano");
  assert.equal(migrated.hpMax, 32); // 20 + 2*6
  assert.equal(migrated.peMax, 16); // 5 + 3*3 + 1*2
  assert.equal(migrated.skills.length, 1);
  assert.equal(migrated.skills[0].ownership, "exclusive");
  assert.equal(migrated.legacyExtraId, "old_1");

  // Re-running migration check sees it's already migrated -> returns []
  const secondPass = findUnmigratedLegacyExtras(legacyExtras, [
    toCreatureSummary(migrated),
  ]);
  assert.equal(secondPass.length, 0);
});

test("filterCreatureSummaries filters by folder and searches globally by name/description", () => {
  const c1 = toCreatureSummary(
    createNewCreatureDraft("m1", "f1", { name: "Cão das Sombras", description: "Rápido" }),
  );
  const c2 = toCreatureSummary(
    createNewCreatureDraft("m1", null, { name: "Sacerdote", description: "Ocultista" }),
  );

  assert.equal(
    filterCreatureSummaries([c1, c2], { currentFolderId: null, search: "" }).length,
    1,
  );
  assert.equal(
    filterCreatureSummaries([c1, c2], { currentFolderId: null, search: "sombras", searchAllFolders: true }).length,
    1,
  );
});

test("toCreatureSummary preserves Profile block fields (lv, affiliations, rich description) and HP/PE/SM stats", () => {
  const draft = createNewCreatureDraft("m1", "fld_1", {
    name: "Devorador da Membrana",
    lv: 3,
    affiliations: ["dor", "membrana"],
    description: "**Entidade** ligada a #(Membrana)\n---\n^^Feroz^^",
    variables: { VIT: 5, AGL: 2, FOR: 4, OCU: 3, INT: 1, SAN: 2 },
  });

  const summary = toCreatureSummary(draft);
  assert.equal(summary.lv, 3);
  assert.deepEqual(summary.affiliations, ["dor", "membrana"]);
  assert.equal(summary.description, "**Entidade** ligada a #(Membrana)\n---\n^^Feroz^^");
  assert.equal(summary.hpMax, 50); // 20 + 5*6
  assert.equal(summary.peMax, 15); // 5 + 2*3 + 2*2
  assert.equal(summary.smMax, 38); // 30 + 2*4
});

