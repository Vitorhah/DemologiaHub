import test from "node:test";
import assert from "node:assert/strict";
import {
  clampAttributeForLevel,
  getAttributeLimitForLevel,
  getMaxAttributeValue,
  getMinimumLevelForAttributeValue,
  getMinimumLevelForAttributes,
  migrateSheetForLevelSystem,
  normalizeLevel,
  parseAndValidateLevelChange,
  protectPlayerLevelOnSave,
  resolveMasterLevelUpdate,
} from "./levelSystem";

test("getAttributeLimitForLevel follows 3 + 2 * (LV - 1) for LV 1..10 and beyond", () => {
  const expected: Array<[number, number]> = [
    [1, 3],
    [2, 5],
    [3, 7],
    [4, 9],
    [5, 11],
    [6, 13],
    [7, 15],
    [8, 17],
    [9, 19],
    [10, 21],
    [11, 23],
    [12, 25],
    [15, 31],
    [20, 41],
  ];

  for (const [lv, limit] of expected) {
    assert.equal(getAttributeLimitForLevel(lv), limit, `LV ${lv} should have limit ${limit}`);
  }

  // Increasing LV by 1 always increases the attribute limit by +2
  for (let lv = 1; lv <= 25; lv++) {
    assert.equal(
      getAttributeLimitForLevel(lv + 1) - getAttributeLimitForLevel(lv),
      2,
    );
  }
});

test("getMinimumLevelForAttributeValue calculates exact minimum LV for existing attributes", () => {
  assert.equal(getMinimumLevelForAttributeValue(0), 1);
  assert.equal(getMinimumLevelForAttributeValue(1), 1);
  assert.equal(getMinimumLevelForAttributeValue(3), 1);
  assert.equal(getMinimumLevelForAttributeValue(4), 2);
  assert.equal(getMinimumLevelForAttributeValue(5), 2);
  assert.equal(getMinimumLevelForAttributeValue(6), 3);
  assert.equal(getMinimumLevelForAttributeValue(7), 3);
  // Prompt example: attribute 12 requires minimum LV 6 (limit 13; LV 5 is 11)
  assert.equal(getMinimumLevelForAttributeValue(12), 6);
  assert.equal(getAttributeLimitForLevel(6), 13);
  assert.equal(getAttributeLimitForLevel(5), 11);
  assert.equal(getMinimumLevelForAttributeValue(13), 6);
  assert.equal(getMinimumLevelForAttributeValue(14), 7);
  assert.equal(getMinimumLevelForAttributeValue(21), 10);
  assert.equal(getMinimumLevelForAttributeValue(22), 11);
});

test("getMaxAttributeValue ignores legacy non-numeric formula strings safely", () => {
  assert.equal(
    getMaxAttributeValue({ FS: "1d4", MT: "1d4", SAN: 4, VIT: 6 }),
    6,
  );
  assert.equal(getMaxAttributeValue({ AGL: "5", FOR: 2 }), 5);
  assert.equal(getMaxAttributeValue({}), 0);
  assert.equal(getMaxAttributeValue(null), 0);
});

test("migrateSheetForLevelSystem adjusts LV individually per sheet without altering any attributes or data", () => {
  const highAttrSheet = {
    name: "Agente Veterano",
    ep: 75,
    hp: { current: 50, max: 92 },
    variables: { SAN: 4, AGL: 6, INT: 12, FOR: 3, VIT: 5, OCU: 8 },
    skills: [{ id: 1, name: "Ritual", cost: 2 }],
    tributo: { name: "Selo", desc: "Desc", passivo: "P", ativo: "A" },
  };

  const migratedHigh = migrateSheetForLevelSystem(highAttrSheet);
  assert.equal(migratedHigh.changed, true);
  assert.equal(migratedHigh.maxAttr, 12);
  assert.equal(migratedHigh.minRequiredLv, 6);
  assert.equal(migratedHigh.sheet.lv, 6);
  // Attributes and all other data must remain completely untouched
  assert.deepEqual(migratedHigh.sheet.variables, highAttrSheet.variables);
  assert.deepEqual(migratedHigh.sheet.skills, highAttrSheet.skills);
  assert.equal(migratedHigh.sheet.ep, 75);
  assert.equal(migratedHigh.sheet.name, "Agente Veterano");

  // Sheet already within LV 1 limits stays LV 1
  const starterSheet = {
    name: "Novato",
    variables: { SAN: 1, AGL: 3, INT: 2, FOR: 1, VIT: 3, OCU: 2 },
  };
  const migratedStarter = migrateSheetForLevelSystem(starterSheet);
  assert.equal(migratedStarter.sheet.lv, 1);
  assert.deepEqual(migratedStarter.sheet.variables, starterSheet.variables);

  // Sheet with higher LV already set is NOT lowered
  const alreadyLeveled = {
    name: "Mestre",
    lv: 8,
    variables: { SAN: 2, AGL: 2, INT: 2, FOR: 2, VIT: 2, OCU: 2 },
  };
  const migratedAlready = migrateSheetForLevelSystem(alreadyLeveled);
  assert.equal(migratedAlready.changed, false);
  assert.equal(migratedAlready.sheet.lv, 8);
});

test("clampAttributeForLevel enforces LV limit strictly", () => {
  assert.equal(clampAttributeForLevel(5, 1), 3);
  assert.equal(clampAttributeForLevel(3, 1), 3);
  assert.equal(clampAttributeForLevel(5, 2), 5);
  assert.equal(clampAttributeForLevel(6, 2), 5);
  assert.equal(clampAttributeForLevel(-2, 1), 0);
  assert.equal(clampAttributeForLevel(25, 10), 21);
  assert.equal(clampAttributeForLevel(25, 12), 25);
});

test("parseAndValidateLevelChange validates integers and blocks lowering below existing attributes", () => {
  const vars = { SAN: 2, AGL: 6, INT: 1, FOR: 4, VIT: 6, OCU: 1 }; // max 6 -> min LV 3
  assert.equal(getMinimumLevelForAttributes(vars), 3);

  const tooLow = parseAndValidateLevelChange("2", vars);
  assert.equal(tooLow.ok, false);
  assert.equal(tooLow.minRequiredLv, 3);

  const decimal = parseAndValidateLevelChange("3.5", vars);
  assert.equal(decimal.ok, false);

  const text = parseAndValidateLevelChange("abc", vars);
  assert.equal(text.ok, false);

  const zero = parseAndValidateLevelChange("0", { SAN: 1 });
  assert.equal(zero.ok, false);

  const valid = parseAndValidateLevelChange("3", vars);
  assert.equal(valid.ok, true);
  assert.equal(valid.value, 3);
  assert.equal(valid.limit, 7);

  const higher = parseAndValidateLevelChange(12, vars);
  assert.equal(higher.ok, true);
  assert.equal(higher.value, 12);
  assert.equal(higher.limit, 25);
});

test("normalizeLevel defaults to 1 for new sheets and upgrades only when attributes require it", () => {
  assert.equal(normalizeLevel(undefined, { SAN: 1, VIT: 1 }), 1);
  assert.equal(normalizeLevel(null, { SAN: 1, VIT: 7 }), 3);
  assert.equal(normalizeLevel(1, { SAN: 1, VIT: 7 }), 3);
  assert.equal(normalizeLevel(5, { SAN: 1, VIT: 7 }), 5);
});

test("resolveMasterLevelUpdate rejects non-master users and enforces attribute compatibility for master", () => {
  const vars = { SAN: 4, AGL: 2, INT: 2, FOR: 2, VIT: 2, OCU: 2 }; // min LV 2

  const playerAttempt = resolveMasterLevelUpdate({
    isMaster: false,
    rawNextLv: 5,
    variables: vars,
  });
  assert.equal(playerAttempt.allowed, false);
  assert.match(playerAttempt.error || "", /Mestre/i);

  const masterTooLow = resolveMasterLevelUpdate({
    isMaster: true,
    rawNextLv: 1,
    variables: vars,
  });
  assert.equal(masterTooLow.allowed, false);
  assert.equal(masterTooLow.minRequiredLv, 2);

  const masterValid = resolveMasterLevelUpdate({
    isMaster: true,
    rawNextLv: 4,
    variables: vars,
  });
  assert.equal(masterValid.allowed, true);
  assert.equal(masterValid.value, 4);
  assert.equal(masterValid.limit, 9);
});

test("protectPlayerLevelOnSave prevents non-master users from modifying LV while allowing master updates", () => {
  const baseSheet = {
    name: "Agente",
    lv: 10,
    variables: { SAN: 1, AGL: 1, INT: 1, FOR: 1, VIT: 1, OCU: 1 },
  };

  // Non-master attempting to raise LV to 10 is locked to authoritative LV 2
  const protectedPlayer = protectPlayerLevelOnSave(baseSheet, 2, false);
  assert.equal(protectedPlayer.lv, 2);

  // Master can update LV freely
  const masterSaved = protectPlayerLevelOnSave(baseSheet, 2, true);
  assert.equal(masterSaved.lv, 10);

  // Legacy sheet with higher existing attributes still gets minimum compatible LV without reducing attributes
  const legacyPlayer = protectPlayerLevelOnSave(
    { name: "Veterano", lv: 1, variables: { INT: 12 } },
    1,
    false,
  );
  assert.equal(legacyPlayer.lv, 6);
  assert.equal(legacyPlayer.variables.INT, 12);
});

