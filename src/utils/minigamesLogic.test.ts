import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDifficultyPreset,
  formatMinigameResultSummary,
  getEmfBandHalfWidth,
  getLockpickZoneWidth,
  getTimingZoneSpanDeg,
  isAngleInTargetArc,
  isLockpickAligned,
  isPointInsideCircle,
  normalizeMinigameConfig,
  pickNextTimingArcStart,
  stepEmfSimulation,
} from "./minigamesLogic";

test("normalizeMinigameConfig clamps out-of-range parameters safely", () => {
  const cfg = normalizeMinigameConfig({
    type: "emf",
    rounds: 99,
    speed: -5,
    maxErrors: 0,
    difficulty: "custom",
  });
  assert.equal(cfg.type, "emf");
  assert.equal(cfg.rounds, 12);
  assert.equal(cfg.speed, 1);
  assert.equal(cfg.maxErrors, 1);
  assert.equal(cfg.difficulty, "custom");
});

test("applyDifficultyPreset populates rounds, speed, and maxErrors", () => {
  const hard = applyDifficultyPreset("aim", "dificil");
  assert.equal(hard.type, "aim");
  assert.equal(hard.difficulty, "dificil");
  assert.equal(hard.rounds, 7);
  assert.equal(hard.speed, 7);
  assert.equal(hard.maxErrors, 2);
});

test("isAngleInTargetArc handles wrap-around past 360 degrees accurately", () => {
  // Arc starts at 340 deg and spans 50 deg => [340..360) U [0..30]
  assert.equal(isAngleInTargetArc(350, 340, 50), true);
  assert.equal(isAngleInTargetArc(15, 340, 50), true);
  assert.equal(isAngleInTargetArc(31, 340, 50), false);
  assert.equal(isAngleInTargetArc(339, 340, 50), false);
});

test("Timing zone span shrinks across hits and next arc avoids immediate overlap", () => {
  const early = getTimingZoneSpanDeg(5, 0, 5);
  const late = getTimingZoneSpanDeg(5, 4, 5);
  assert.ok(late < early);

  const nextStart = pickNextTimingArcStart(20, 40, 34, () => 0.5);
  assert.notEqual(nextStart, 20);
});

test("Lockpick alignment detects sweet spot and scales width by speed", () => {
  const easyWidth = getLockpickZoneWidth(2);
  const hardWidth = getLockpickZoneWidth(9);
  assert.ok(hardWidth < easyWidth);

  assert.equal(isLockpickAligned(52, 50, 12), true);
  assert.equal(isLockpickAligned(56, 50, 12), true);
  assert.equal(isLockpickAligned(62, 50, 12), false);
});

test("EMF simulation rises while holding, fills progress in green band, and overloads when held out", () => {
  const half = getEmfBandHalfWidth(5);
  assert.ok(half >= 8 && half <= 18);

  const held = stepEmfSimulation({
    needle: 45,
    velocity: 0,
    holding: true,
    dt: 0.05,
    speed: 5,
    bandCenter: 50,
    bandHalfWidth: half,
    progress: 0.99,
    overload: 0.2,
    elapsed: 1,
  });
  assert.ok(held.velocity > 0);
  assert.equal(held.inBand, true);
  assert.equal(held.roundCleared, true);

  const overloaded = stepEmfSimulation({
    needle: 99,
    velocity: 20,
    holding: true,
    dt: 0.05,
    speed: 5,
    bandCenter: 50,
    bandHalfWidth: half,
    progress: 0.2,
    overload: 0.98,
    elapsed: 2,
  });
  assert.equal(overloaded.overloaded, true);
  assert.equal(overloaded.needle, 50);
});

test("Aim circle collision and result summary formatter work accurately", () => {
  assert.equal(isPointInsideCircle(110, 100, 100, 100, 20), true);
  assert.equal(isPointInsideCircle(125, 100, 100, 100, 20), false);

  const msg = formatMinigameResultSummary({
    id: "res_1",
    assignmentId: "asg_1",
    minigameType: "timing",
    playerId: "p1",
    playerName: "Arthur",
    hits: 4,
    totalRounds: 5,
    errors: 2,
    maxErrors: 3,
    success: false,
    finishedAt: 1000,
  });
  assert.equal(msg, "Arthur: 4/5 acertos (Timing)");
});
