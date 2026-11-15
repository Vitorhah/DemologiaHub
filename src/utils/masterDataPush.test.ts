import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMasterDataToSheetState,
  computeDemologiaMaxStats,
  extractDefaultSixStatuses,
  summarizeMasterPush,
} from "./masterDataPush";

test("extractDefaultSixStatuses reads only the 6 core Demologia attributes and ignores extra variables", () => {
  const extracted = extractDefaultSixStatuses({
    SAN: 4,
    AGL: 3,
    INT: 5,
    FOR: 2,
    VIT: 6,
    OCU: 7,
    SORTE: 99,
    CORAGEM: 12,
    san: 9, // exact uppercase SAN wins or fallback
  });

  assert.deepEqual(Object.keys(extracted).sort(), ["AGL", "FOR", "INT", "OCU", "SAN", "VIT"]);
  assert.equal(extracted.VIT, 6);
  assert.equal(extracted.OCU, 7);
  assert.equal((extracted as any).SORTE, undefined);
  assert.equal((extracted as any).CORAGEM, undefined);
});

test("applyMasterDataToSheetState applies Skill, Tributo, and 6 statuses atomically while preserving extra vars", () => {
  const initial = {
    name: "Arthur",
    autoMaxStats: true,
    hp: { current: 26, max: 26 },
    pe: { current: 10, max: 10 },
    sm: { current: 34, max: 34 },
    variables: { SAN: 1, AGL: 1, INT: 1, FOR: 1, VIT: 1, OCU: 1, EXTRA_SORTE: 5 },
    skills: [{ id: 1, name: "Corte", cost: 2, desc: "Básico", test: "1d20", damage: "1d6" }],
    tributo: { name: "Antigo", desc: "Velho", passivo: "P0", ativo: "A0" },
  };

  const next = applyMasterDataToSheetState(
    initial,
    {
      skill: {
        name: "Ritual Sombrio",
        cost: 3,
        desc: "Invoca lâminas",
        test: "2d6+OCU",
        damage: "2d8+OCU",
        needsTest: true,
      },
      tributo: {
        name: "Selo Carmesim",
        desc: "Marca paranormal",
        passivo: "+1 OCU em rituais",
        ativo: "Gasta 2 PE para +2 dano",
      },
      statuses: {
        SAN: 3,
        AGL: 4,
        INT: 2,
        FOR: 2,
        VIT: 3,
        OCU: 5,
      },
    },
    5000
  );

  // Skill appended cleanly
  assert.equal(next.skills.length, 2);
  assert.equal(next.skills[1].name, "Ritual Sombrio");
  assert.equal(next.skills[1].cost, 3);
  assert.equal((next.skills[1] as any).needsTest, true);
  assert.equal(next.skills[1].id, 5000);

  // Tributo updated
  assert.equal(next.tributo.name, "Selo Carmesim");
  assert.equal(next.tributo.passivo, "+1 OCU em rituais");
  assert.equal(next.tributo.ativo, "Gasta 2 PE para +2 dano");

  // 6 default statuses updated, EXTRA_SORTE preserved
  assert.equal(next.variables.OCU, 5);
  assert.equal(next.variables.VIT, 3);
  assert.equal(next.variables.EXTRA_SORTE, 5);

  // Recalculated max stats using Demologia formulas:
  // PV = 20 + 3*6 = 38; PE = 5 + 4*3 + 3*2 = 23; SM = 30 + 3*4 = 42
  const expected = computeDemologiaMaxStats(next.variables);
  assert.equal(expected.hpMax, 38);
  assert.equal(expected.peMax, 23);
  assert.equal(expected.smMax, 42);
  assert.equal(next.hp.max, 38);
  assert.equal(next.pe.max, 23);
  assert.equal(next.sm.max, 42);
});

test("applyMasterDataToSheetState clamps current stats if max decreases and supports partial push", () => {
  const initial = {
    name: "Kael",
    autoMaxStats: true,
    hp: { current: 50, max: 50 },
    pe: { current: 30, max: 30 },
    sm: { current: 50, max: 50 },
    variables: { SAN: 5, AGL: 5, INT: 2, FOR: 2, VIT: 5, OCU: 2 },
    skills: [],
    tributo: { name: "Original", desc: "Mantido", passivo: "P", ativo: "A" },
  };

  const next = applyMasterDataToSheetState(initial, {
    statuses: { SAN: 1, AGL: 1, INT: 2, FOR: 2, VIT: 1, OCU: 2 },
  });

  assert.equal(next.hp.max, 26);
  assert.equal(next.hp.current, 26);
  assert.equal(next.pe.max, 10);
  assert.equal(next.pe.current, 10);
  assert.equal(next.sm.max, 34);
  assert.equal(next.sm.current, 34);
  // Tributo & skills unchanged
  assert.equal(next.tributo.name, "Original");
  assert.equal(next.skills.length, 0);
});

test("summarizeMasterPush formats readable description", () => {
  const text = summarizeMasterPush({
    skill: { name: "Eco", cost: 1, desc: "", test: "", damage: "", needsTest: false },
    statuses: { SAN: 1, AGL: 1, INT: 1, FOR: 1, VIT: 1, OCU: 1 },
  });
  assert.equal(text, 'Skill "Eco", Status Padrões');
});
