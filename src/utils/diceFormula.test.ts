import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDiceFormula,
  getDefaultAttributeRollFormula,
  normalizeCustomFormulas,
  upsertCustomFormula,
  removeCustomFormula,
} from "./diceFormula";

test("getDefaultAttributeRollFormula returns 1d4+FOR for FOR and 2d6+ATTR for others", () => {
  assert.equal(getDefaultAttributeRollFormula("FOR"), "1d4+FOR");
  assert.equal(getDefaultAttributeRollFormula("for"), "1d4+FOR");
  assert.equal(getDefaultAttributeRollFormula("VIT"), "2d6+VIT");
  assert.equal(getDefaultAttributeRollFormula("AGL"), "2d6+AGL");
  assert.equal(getDefaultAttributeRollFormula("OCU"), "2d6+OCU");
  assert.equal(getDefaultAttributeRollFormula("INT"), "2d6+INT");
  assert.equal(getDefaultAttributeRollFormula("SAN"), "2d6+SAN");
});

test("evaluateDiceFormula evaluates dice, attributes, math precedence, and shorthand dN", () => {
  // rng always returning 0.5 -> d20 rolls 11, d6 rolls 4
  const fixedRng = () => 0.5;
  const res = evaluateDiceFormula("d20 + OCU*2 + 3", { OCU: 4 }, fixedRng);
  assert.ok(res);
  assert.equal(res.formula, "1d20 + OCU*2 + 3");
  assert.equal(res.result, 11 + 4 * 2 + 3);
  assert.equal(res.critical, "normal");
  assert.ok(res.details.includes("OCU(4)"));
  assert.ok(res.details.includes("1D20[11]"));
});

test("evaluateDiceFormula detects 2d6 doubles critical with +5 buff and non-doubles normal", () => {
  // Both dice roll 3 (Math.floor(0.4 * 6) + 1 = 3) -> 3 + 3 + OCU(2) + 5 = 13
  const crit2d6 = evaluateDiceFormula("2d6+OCU", { OCU: 2 }, () => 0.4);
  assert.ok(crit2d6);
  assert.equal(crit2d6.critical, "crit");
  assert.equal(crit2d6.critBonus, 5);
  assert.equal(crit2d6.result, 3 + 3 + 2 + 5);
  assert.ok(crit2d6.details.includes("Crítico(+5)"));

  // Dice roll 2 and 5 -> normal (no +5 buff)
  const seq = [0.2, 0.75];
  let idx = 0;
  const normal2d6 = evaluateDiceFormula("2d6+OCU", { OCU: 2 }, () => seq[idx++]);
  assert.ok(normal2d6);
  assert.equal(normal2d6.critical, "normal");
  assert.equal(normal2d6.critBonus, 0);
  assert.equal(normal2d6.result, 2 + 5 + 2);
});

test("evaluateDiceFormula detects 1d4 rolling 4 critical with +5 buff and 1-3 normal", () => {
  // Die rolls 4 (Math.floor(0.8 * 4) + 1 = 4) -> 4 + FOR(3) + 5 = 12
  const crit1d4 = evaluateDiceFormula("1d4+FOR", { FOR: 3 }, () => 0.8);
  assert.ok(crit1d4);
  assert.equal(crit1d4.critical, "crit");
  assert.equal(crit1d4.critBonus, 5);
  assert.equal(crit1d4.result, 4 + 3 + 5);
  assert.ok(crit1d4.details.includes("Crítico(+5)"));

  // Die rolls 2 -> 2 + FOR(3) = 5, normal
  const normal1d4 = evaluateDiceFormula("d4+FOR", { FOR: 3 }, () => 0.3);
  assert.ok(normal1d4);
  assert.equal(normal1d4.critical, "normal");
  assert.equal(normal1d4.critBonus, 0);
  assert.equal(normal1d4.result, 2 + 3);
});

test("evaluateDiceFormula detects critical (20) and fumble (1) on 1d20", () => {
  const crit = evaluateDiceFormula("1d20+AGL", { AGL: 2 }, () => 0.99);
  assert.ok(crit);
  assert.equal(crit.result, 22);
  assert.equal(crit.critical, "crit");

  const fumble = evaluateDiceFormula("1d20+AGL", { AGL: 2 }, () => 0.0);
  assert.ok(fumble);
  assert.equal(fumble.result, 3);
  assert.equal(fumble.critical, "fumble");
});

test("evaluateDiceFormula rejects invalid or unknown variable formulas cleanly", () => {
  assert.equal(evaluateDiceFormula("", { OCU: 2 }), null);
  assert.equal(evaluateDiceFormula("1d20+UNKNOWN_ATTR", { OCU: 2 }), null);
  assert.equal(evaluateDiceFormula("10/0", {}), null);
  assert.equal(evaluateDiceFormula("999d20", {}), null);
});

test("custom formula CRUD helpers normalize, add, update, and remove per-sheet formulas", () => {
  const initial = normalizeCustomFormulas([
    { id: "1", name: "Ataque", formula: "2d6+FOR" },
    { id: "bad", name: "Vazia", formula: "   " },
  ]);
  assert.equal(initial.length, 1);
  assert.equal(initial[0].name, "Ataque");

  const added = upsertCustomFormula(initial, { name: "Ritual", formula: "2d8+OCU" });
  assert.equal(added.length, 2);
  assert.equal(added[1].formula, "2d8+OCU");

  const updated = upsertCustomFormula(added, {
    id: "1",
    name: "Ataque Brutal",
    formula: "1d4+FOR",
  });
  assert.equal(updated.length, 2);
  assert.equal(updated[0].name, "Ataque Brutal");
  assert.equal(updated[0].formula, "1d4+FOR");

  const removed = removeCustomFormula(updated, "1");
  assert.equal(removed.length, 1);
  assert.equal(removed[0].name, "Ritual");
});
