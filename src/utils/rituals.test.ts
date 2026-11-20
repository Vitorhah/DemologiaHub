import test from "node:test";
import assert from "node:assert/strict";
import {
  RITUAL_AFFILIATIONS,
  RITUAL_AFFILIATION_LIST,
  RITUAL_TEST_FORMULA,
  createDefaultRitual,
  evaluateRitualTestOutcome,
  extractIntAttribute,
  getRitualCapacityState,
  getRitualLimit,
  normalizeRitualLevel,
  normalizeRituals,
  toggleRitualAffiliation,
} from "./rituals";

test("RITUAL_AFFILIATION_LIST includes all 9 official affiliations with expected dual splits", () => {
  assert.equal(RITUAL_AFFILIATION_LIST.length, 9);
  const labels = RITUAL_AFFILIATION_LIST.map((a) => a.label);
  assert.deepEqual(labels, [
    "Dor",
    "Nirvana",
    "Alma",
    "Corpo",
    "Cura",
    "Medo",
    "Membrana",
    "Intenção",
    "Caos",
  ]);
  assert.equal(RITUAL_AFFILIATIONS.intencao.isDualSplit, true);
  assert.equal(RITUAL_AFFILIATIONS.caos.isDualSplit, true);
  assert.match(RITUAL_AFFILIATIONS.intencao.background, /linear-gradient/i);
  assert.match(RITUAL_AFFILIATIONS.caos.background, /linear-gradient/i);
  assert.equal(RITUAL_TEST_FORMULA, "2d6+OCU");
});

test("getRitualLimit calculates INT × 1 normally and INT × 2 for Oculto", () => {
  assert.equal(getRitualLimit({ INT: 2 }, "executivo"), 2);
  assert.equal(getRitualLimit({ INT: 3 }, "pensativo"), 3);
  assert.equal(getRitualLimit({ INT: 3 }, "oculto"), 6);
  assert.equal(getRitualLimit({ INT: 5 }, "oculto"), 10);
  assert.equal(getRitualLimit({ INT: 0 }, "oculto"), 0);
  assert.equal(getRitualLimit({ int: 4 }, "oculto"), 8);
  assert.equal(extractIntAttribute({ INT: -2 }), 0);
});

test("getRitualCapacityState blocks adding at/over limit without deleting existing rituals", () => {
  const fourRituals = [1, 2, 3, 4].map((id) => createDefaultRitual(id));

  // INT 3 + Oculto => limit 6, 4 stored => canAdd true
  const underLimit = getRitualCapacityState(fourRituals, { INT: 3 }, "oculto");
  assert.equal(underLimit.count, 4);
  assert.equal(underLimit.limit, 6);
  assert.equal(underLimit.canAdd, true);
  assert.equal(underLimit.isOverLimit, false);

  // Switch away from Oculto (INT 3 => limit 3), 4 stored => over limit, cannot add, count preserved
  const overAfterProfileSwitch = getRitualCapacityState(
    fourRituals,
    { INT: 3 },
    "executivo"
  );
  assert.equal(overAfterProfileSwitch.count, 4);
  assert.equal(overAfterProfileSwitch.limit, 3);
  assert.equal(overAfterProfileSwitch.canAdd, false);
  assert.equal(overAfterProfileSwitch.isOverLimit, true);

  // Lower INT to 2 while still Oculto => limit 4, 4 stored => at limit, cannot add
  const atLimit = getRitualCapacityState(fourRituals, { INT: 2 }, "oculto");
  assert.equal(atLimit.count, 4);
  assert.equal(atLimit.limit, 4);
  assert.equal(atLimit.canAdd, false);
  assert.equal(atLimit.isAtLimit, true);
  assert.equal(atLimit.isOverLimit, false);
});

test("evaluateRitualTestOutcome requires roll result strictly greater than difficulty", () => {
  assert.deepEqual(evaluateRitualTestOutcome(11, 8), {
    success: true,
    result: 11,
    difficulty: 8,
    margin: 3,
  });
  // Tie must fail ("tem que ser maior que o parâmetro dificuldade")
  assert.equal(evaluateRitualTestOutcome(8, 8).success, false);
  assert.equal(evaluateRitualTestOutcome(7, 8).success, false);
  assert.equal(evaluateRitualTestOutcome(9, 8).success, true);
});

test("normalizeRituals handles legacy undefined, clamps level 1..4, and deduplicates affiliations", () => {
  assert.deepEqual(normalizeRituals(undefined), []);
  assert.equal(normalizeRitualLevel(0), 1);
  assert.equal(normalizeRitualLevel(2), 2);
  assert.equal(normalizeRitualLevel(4), 4);
  assert.equal(normalizeRitualLevel(9), 4);

  const normalized = normalizeRituals([
    {
      id: 10,
      name: "Eco da Membrana",
      level: 7,
      difficulty: 10,
      cost: 3,
      desc: "Abre uma fenda breve.",
      affiliations: ["membrana", "caos", "membrana", "invalida"],
      damage: "2d6",
      needsTest: true,
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].level, 4);
  assert.equal(normalized[0].difficulty, 10);
  assert.deepEqual(normalized[0].affiliations, ["membrana", "caos"]);

  const toggledOn = toggleRitualAffiliation(["dor"], "intencao");
  assert.deepEqual(toggledOn, ["dor", "intencao"]);
  const toggledOff = toggleRitualAffiliation(toggledOn, "dor");
  assert.deepEqual(toggledOff, ["intencao"]);
});
