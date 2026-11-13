import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_COLOR_PALETTE,
  STATUS_PRESETS,
  createStatusEffect,
  togglePresetStatusEffect,
  splitStatusEffectsForHud,
  getStatusColorSwatch,
} from "./statusEffects";

test("STATUS_PRESETS includes all 8 required conditions and STATUS_COLOR_PALETTE has valid swatches", () => {
  const labels = STATUS_PRESETS.map((p) => p.label);
  for (const required of [
    "Envenenado",
    "Atordoado",
    "Sangrando",
    "Queimando",
    "Amedrontado",
    "Exausto",
    "Fortalecido",
    "Cego",
  ]) {
    assert.ok(labels.includes(required), `Missing preset: ${required}`);
  }
  assert.ok(STATUS_COLOR_PALETTE.length >= 6);
  for (const preset of STATUS_PRESETS) {
    const swatch = getStatusColorSwatch(preset.color);
    assert.ok(swatch.bgHex.startsWith("#"));
  }
});

test("togglePresetStatusEffect adds when missing and removes when already active", () => {
  const preset = STATUS_PRESETS[0];
  const added = togglePresetStatusEffect([], preset);
  assert.equal(added.length, 1);
  assert.equal(added[0].label, preset.label);

  const removed = togglePresetStatusEffect(added, preset);
  assert.equal(removed.length, 0);
});

test("splitStatusEffectsForHud distributes post-its between left and right sides of the HUD logo", () => {
  const list = [
    createStatusEffect("Sangrando", "crimson"),
    createStatusEffect("Envenenado", "emerald"),
    createStatusEffect("Atordoado", "amber"),
  ];
  const { leftEffects, rightEffects } = splitStatusEffectsForHud(list);
  assert.equal(leftEffects.length, 2);
  assert.equal(rightEffects.length, 1);
  assert.equal(leftEffects[0].label, "Sangrando");
  assert.equal(rightEffects[0].label, "Envenenado");
  assert.equal(leftEffects[1].label, "Atordoado");
});

test("getStatusColorSwatch maps common aliases and custom hex colors accurately", () => {
  assert.equal(getStatusColorSwatch("red").id, "crimson");
  assert.equal(getStatusColorSwatch("green").id, "emerald");
  assert.equal(getStatusColorSwatch("yellow").id, "amber");
  assert.equal(getStatusColorSwatch("blue").id, "sky");
  assert.equal(getStatusColorSwatch("roxo").id, "purple");
  assert.equal(getStatusColorSwatch("#123456").bgHex, "#123456");
});

