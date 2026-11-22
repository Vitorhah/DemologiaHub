import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SFX_AUTO_FADE_SECONDS,
  MAX_CONCURRENT_SFX,
  clampSfxVolume,
  computeAutoFadeOutPlan,
  computeEffectiveSfxVolume,
  getSoundBoardRecordId,
  isSoundBoardPlayPayloadValid,
  normalizeSoundBoardEffects,
  resolveConcurrentSfxActivation,
  validateSoundBoardLink,
} from "./soundBoard";

test("computeAutoFadeOutPlan schedules smooth automatic fade-out near audio end without clipping short sounds", () => {
  // Standard 4s sound -> fade over last 0.5s starting at 3.5s
  const normal = computeAutoFadeOutPlan(4.0, DEFAULT_SFX_AUTO_FADE_SECONDS);
  assert.equal(normal.shouldFade, true);
  assert.equal(normal.delayMs, 3500);
  assert.equal(normal.fadeDurationMs, 500);

  // Short 0.6s punchy impact -> clamped to 35% of duration (210ms fade, 390ms delay)
  const shortSound = computeAutoFadeOutPlan(0.6, DEFAULT_SFX_AUTO_FADE_SECONDS);
  assert.equal(shortSound.shouldFade, true);
  assert.equal(shortSound.fadeDurationMs, 210);
  assert.equal(shortSound.delayMs, 390);

  // Invalid or ultra-tiny duration -> no fade scheduled
  assert.equal(computeAutoFadeOutPlan(0).shouldFade, false);
  assert.equal(computeAutoFadeOutPlan(-2).shouldFade, false);
  assert.equal(computeAutoFadeOutPlan(NaN).shouldFade, false);
});

test("resolveConcurrentSfxActivation restarts already-playing effect without duplicating and evicts oldest at concurrency cap", () => {
  // Start new sound under limit
  const first = resolveConcurrentSfxActivation(["s1", "s2"], "s3", 4);
  assert.equal(first.action, "start");
  assert.deepEqual(first.evictedIds, []);
  assert.deepEqual(first.nextOrder, ["s1", "s2", "s3"]);

  // Retriggering s1 restarts it without creating a second instance and moves it to most recent
  const retrigger = resolveConcurrentSfxActivation(["s1", "s2", "s3"], "s1", 4);
  assert.equal(retrigger.action, "restart");
  assert.deepEqual(retrigger.evictedIds, []);
  assert.deepEqual(retrigger.nextOrder, ["s2", "s3", "s1"]);

  // Exceeding concurrency limit evicts oldest active effect(s)
  const capped = resolveConcurrentSfxActivation(
    ["s1", "s2", "s3", "s4", "s5", "s6"],
    "s7",
    MAX_CONCURRENT_SFX,
  );
  assert.equal(capped.action, "start");
  assert.deepEqual(capped.evictedIds, ["s1"]);
  assert.deepEqual(capped.nextOrder, ["s2", "s3", "s4", "s5", "s6", "s7"]);
});

test("computeEffectiveSfxVolume multiplies individual and general Sound Board volumes cleanly and clamps 0..1", () => {
  assert.equal(computeEffectiveSfxVolume(0.5, 0.8), 0.4);
  assert.equal(computeEffectiveSfxVolume(1.5, 1.2), 1);
  assert.equal(computeEffectiveSfxVolume(-0.3, 0.8), 0);
  assert.equal(clampSfxVolume("0.75"), 0.75);
  assert.equal(clampSfxVolume(undefined, 0.9), 0.9);
});

test("normalizeSoundBoardEffects deduplicates, clamps volumes, and validates icons & URLs", () => {
  const normalized = normalizeSoundBoardEffects(
    [
      {
        id: "sfx_1",
        name: "Trovão",
        url: "https://example.com/thunder.mp3",
        source: "link",
        volume: 1.4,
        icon: "zap",
      },
      {
        id: "sfx_1", // duplicate id ignored
        name: "Duplicado",
        url: "https://example.com/dup.mp3",
      },
      {
        id: "sfx_invalid",
        name: "Sem URL",
        url: "   ",
      },
      {
        id: "sfx_2",
        name: "",
        url: "https://example.com/door.wav",
        source: "upload",
        volume: -0.2,
        icon: "unknown_icon" as any,
      },
    ],
    "mesa-1",
  );

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, "sfx_1");
  assert.equal(normalized[0].volume, 1);
  assert.equal(normalized[0].icon, "zap");
  assert.equal(normalized[1].id, "sfx_2");
  assert.equal(normalized[1].name, "Efeito Sem Nome");
  assert.equal(normalized[1].volume, 0);
  assert.equal(normalized[1].icon, "volume");
  assert.equal(normalized[1].source, "upload");
});

test("validateSoundBoardLink and broadcast payload validator enforce safe links and room matching", () => {
  assert.equal(validateSoundBoardLink("Teste", "").ok, false);
  assert.equal(validateSoundBoardLink("XSS", "javascript:alert(1)").ok, false);

  const validHttp = validateSoundBoardLink("  Sino  ", "https://cdn.example.com/bell.mp3");
  assert.equal(validHttp.ok, true);
  if (validHttp.ok) {
    assert.equal(validHttp.name, "Sino");
    assert.equal(validHttp.url, "https://cdn.example.com/bell.mp3");
  }

  assert.equal(getSoundBoardRecordId("sala-a"), "SOUNDBOARD_sala-a");
  assert.equal(
    isSoundBoardPlayPayloadValid(
      {
        room_id: "sala-a",
        effect_id: "sfx_1",
        url: "https://cdn.example.com/bell.mp3",
        volume: 0.8,
        master_volume: 1,
        triggered_at: new Date().toISOString(),
        token: "tok1",
      },
      "sala-a",
    ),
    true,
  );
  assert.equal(
    isSoundBoardPlayPayloadValid(
      {
        room_id: "outra-sala",
        effect_id: "sfx_1",
        url: "https://cdn.example.com/bell.mp3",
      },
      "sala-a",
    ),
    false,
  );
});
