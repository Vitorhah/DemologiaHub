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

test("applyMasterDataToSheetState clamps pushed statuses to the sheet LV attribute cap when lv is set", () => {
  const initial = {
    name: "Agente LV 1",
    lv: 1,
    autoMaxStats: true,
    hp: { current: 26, max: 26 },
    pe: { current: 10, max: 10 },
    sm: { current: 34, max: 34 },
    variables: { SAN: 1, AGL: 1, INT: 1, FOR: 1, VIT: 1, OCU: 1 },
    skills: [],
    tributo: { name: "", desc: "", passivo: "", ativo: "" },
  };

  const next = applyMasterDataToSheetState(initial, {
    statuses: { SAN: 2, AGL: 9, INT: 3, FOR: 5, VIT: 4, OCU: 12 },
  });

  // At LV 1, max limit is 3
  assert.equal(next.lv, 1);
  assert.equal(next.variables.SAN, 2);
  assert.equal(next.variables.AGL, 3);
  assert.equal(next.variables.INT, 3);
  assert.equal(next.variables.FOR, 3);
  assert.equal(next.variables.VIT, 3);
  assert.equal(next.variables.OCU, 3);
});

test("applyMasterDataToSheetState delivers Ritual, PDI, and full Skill post-var fields from Master Library", () => {
  const initial = {
    name: "Investigador",
    autoMaxStats: true,
    hp: { current: 26, max: 26 },
    pe: { current: 10, max: 10 },
    sm: { current: 34, max: 34 },
    variables: { SAN: 1, AGL: 1, INT: 2, FOR: 1, VIT: 1, OCU: 3 },
    skills: [],
    rituals: [
      {
        id: 10,
        name: "Sussurro",
        cost: 1,
        desc: "Já existente",
        damage: "",
        difficulty: 8,
        level: 1 as const,
        affiliations: ["medo" as const],
        needsTest: true,
      },
    ],
    pdis: [
      {
        id: "pdi_old",
        name: "Cicatriz",
        desc: "Antigo",
        active: true,
        modifiers: { VIT: { buffFlat: 1 } } as Record<string, any>,
      },
    ],
    tributo: { name: "", desc: "", passivo: "", ativo: "" },
  };

  const next = applyMasterDataToSheetState(
    initial,
    {
      skill: {
        name: "Lâmina Precisa",
        cost: 2,
        desc: "Skill da biblioteca",
        test: "2d6",
        damage: "1d8",
        needsTest: true,
        testVar: "AGL",
        damageVar: "FOR",
        testPostVar: "INT",
        testPostFormula: "+1",
        damagePostVar: "OCU",
        damagePostFormula: "+2",
      },
      ritual: {
        id: 99,
        name: "Ruptura",
        cost: 4,
        desc: "Ritual da biblioteca",
        damage: "3d6",
        difficulty: 12,
        level: 3,
        affiliations: ["caos", "dor"],
        needsTest: true,
      },
      pdi: {
        id: "pdi_lib_1",
        name: "Foco Paranormal",
        desc: "Concedido pelo Mestre",
        active: false,
        modifiers: { OCU: { buffFlat: 2, buffDice: "1d4" } },
      },
    },
    7777
  );

  assert.equal(next.skills.length, 1);
  assert.equal(next.skills[0].testVar, "AGL");
  assert.equal(next.skills[0].damageVar, "FOR");
  assert.equal(next.skills[0].testPostVar, "INT");
  assert.equal(next.skills[0].damagePostFormula, "+2");

  assert.equal(next.rituals.length, 2);
  assert.equal(next.rituals[1].name, "Ruptura");
  assert.equal(next.rituals[1].level, 3);
  assert.equal(next.rituals[1].difficulty, 12);
  assert.deepEqual(next.rituals[1].affiliations, ["caos", "dor"]);

  assert.equal(next.pdis.length, 2);
  assert.equal(next.pdis[1].name, "Foco Paranormal");
  assert.equal(next.pdis[1].modifiers.OCU?.buffFlat, 2);
  assert.equal(next.pdis[1].modifiers.OCU?.buffDice, "1d4");

  const summary = summarizeMasterPush({
    ritual: next.rituals[1],
    pdi: next.pdis[1],
  });
  assert.equal(summary, 'Ritual "Ruptura", PDI "Foco Paranormal"');
});

