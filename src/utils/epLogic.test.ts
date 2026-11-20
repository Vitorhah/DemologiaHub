import test from "node:test";
import assert from "node:assert/strict";
import {
  EP_MAX,
  EP_MIN,
  formatEpDisplay,
  normalizeEpValue,
  parseEpInput,
  protectPlayerEpOnSave,
  resolveMasterEpUpdate,
  stepEpValue,
} from "./epLogic";

test("normalizeEpValue clamps integer bounds [0, 1000] and rejects decimals or text", () => {
  assert.equal(normalizeEpValue(0), 0);
  assert.equal(normalizeEpValue(125), 125);
  assert.equal(normalizeEpValue(1000), 1000);
  assert.equal(normalizeEpValue(-50), EP_MIN);
  assert.equal(normalizeEpValue(1500), EP_MAX);
  assert.equal(normalizeEpValue("250"), 250);
  assert.equal(normalizeEpValue("-10"), 0);
  assert.equal(normalizeEpValue("9999"), 1000);

  // Decimals and non-numeric strings fall back safely
  assert.equal(normalizeEpValue(12.5, 40), 40);
  assert.equal(normalizeEpValue("12.5", 40), 40);
  assert.equal(normalizeEpValue("12,5", 40), 40);
  assert.equal(normalizeEpValue("abc", 40), 40);
  assert.equal(normalizeEpValue("125%", 40), 40);
  assert.equal(normalizeEpValue(null, 15), 15);
  assert.equal(normalizeEpValue(undefined, 0), 0);
});

test("parseEpInput accepts integers with clamping and strictly rejects decimals, text, and empty", () => {
  assert.deepEqual(parseEpInput("0"), { valid: true, value: 0 });
  assert.deepEqual(parseEpInput("125"), { valid: true, value: 125 });
  assert.deepEqual(parseEpInput("1000"), { valid: true, value: 1000 });
  assert.deepEqual(parseEpInput("-25"), { valid: true, value: 0 });
  assert.deepEqual(parseEpInput("1200"), { valid: true, value: 1000 });

  assert.equal(parseEpInput("12.5").valid, false);
  assert.equal(parseEpInput("12,5").valid, false);
  assert.equal(parseEpInput("abc").valid, false);
  assert.equal(parseEpInput("125%").valid, false);
  assert.equal(parseEpInput("12 5").valid, false);
  assert.equal(parseEpInput("").valid, false);
  assert.equal(parseEpInput("   ").valid, false);
  assert.equal(parseEpInput(45.2).valid, false);
});

test("stepEpValue increments/decrements cleanly within [0, 1000] and formatEpDisplay outputs EP X%", () => {
  assert.equal(stepEpValue(0, -1), 0);
  assert.equal(stepEpValue(125, -1), 124);
  assert.equal(stepEpValue(125, 1), 126);
  assert.equal(stepEpValue(1000, 1), 1000);
  assert.equal(stepEpValue(995, 20), 1000);

  assert.equal(formatEpDisplay(125), "EP 125%");
  assert.equal(formatEpDisplay(-5), "EP 0%");
  assert.equal(formatEpDisplay(2000), "EP 1000%");
});

test("resolveMasterEpUpdate blocks non-masters and validates master inputs", () => {
  const blocked = resolveMasterEpUpdate({ isMaster: false, rawNextEp: "125" });
  assert.equal(blocked.allowed, false);

  const allowed = resolveMasterEpUpdate({ isMaster: true, rawNextEp: "125" });
  assert.deepEqual(allowed, { allowed: true, value: 125 });

  const clamped = resolveMasterEpUpdate({ isMaster: true, rawNextEp: "1500" });
  assert.deepEqual(clamped, { allowed: true, value: 1000 });

  const invalid = resolveMasterEpUpdate({ isMaster: true, rawNextEp: "12.5" });
  assert.equal(invalid.allowed, false);
});

test("protectPlayerEpOnSave prevents players from altering EP via state save or JSON import", () => {
  const tamperedPlayerSave = protectPlayerEpOnSave(
    { name: "Agente", hp: { current: 20, max: 20 }, ep: 999 },
    125,
    false,
  );
  assert.equal(tamperedPlayerSave.ep, 125);
  assert.equal(tamperedPlayerSave.name, "Agente");

  const masterSave = protectPlayerEpOnSave(
    { name: "NPC", ep: 350 },
    125,
    true,
  );
  assert.equal(masterSave.ep, 350);

  const masterOutOfRangeSave = protectPlayerEpOnSave(
    { name: "NPC", ep: 2500 },
    125,
    true,
  );
  assert.equal(masterOutOfRangeSave.ep, 1000);
});
