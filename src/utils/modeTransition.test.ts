import test from "node:test";
import assert from "node:assert/strict";
import {
  MODE_FADE_HOLD_AFTER_SWAP_MS,
  MODE_FADE_IN_DURATION_SEC,
  MODE_FADE_OUT_CLEANUP_MS,
  MODE_FADE_OUT_DURATION_SEC,
  MODE_FADE_PEAK_OPACITY,
  MODE_FADE_SWAP_DELAY_MS,
  resolveActiveGameMode,
  resolveModeTransitionAction,
} from "./modeTransition";

test("mode transition timing constants match Enviar Dados fade overlay exactly", () => {
  assert.equal(MODE_FADE_IN_DURATION_SEC, 0.5);
  assert.equal(MODE_FADE_OUT_DURATION_SEC, 0.7);
  assert.equal(MODE_FADE_PEAK_OPACITY, 0.94);
  assert.equal(MODE_FADE_SWAP_DELAY_MS, 520);
  assert.equal(MODE_FADE_HOLD_AFTER_SWAP_MS, 220);
  assert.equal(MODE_FADE_OUT_CLEANUP_MS, 720);
});

test("resolveActiveGameMode prioritizes individual player override over globalMode", () => {
  assert.equal(
    resolveActiveGameMode({ globalMode: "demologia", playerModes: { p1: "rl" } }, "p1"),
    "rl",
  );
  assert.equal(
    resolveActiveGameMode({ globalMode: "demologia", playerModes: { p1: "rl" } }, "p2"),
    "demologia",
  );
  assert.equal(resolveActiveGameMode({ globalMode: "rl" }, null), "rl");
});

test("resolveModeTransitionAction returns fade for normal mode changes and instant for Scene Builder mode block", () => {
  assert.equal(
    resolveModeTransitionAction({
      previousMode: "demologia",
      nextMode: "rl",
      skipTransition: false,
    }),
    "fade",
  );

  assert.equal(
    resolveModeTransitionAction({
      previousMode: "rl",
      nextMode: "demologia",
      skipTransition: true,
    }),
    "instant",
  );

  assert.equal(
    resolveModeTransitionAction({
      previousMode: "demologia",
      nextMode: "demologia",
      skipTransition: false,
    }),
    "none",
  );

  assert.equal(
    resolveModeTransitionAction({
      previousMode: "demologia",
      nextMode: "rl",
      isInitialMount: true,
    }),
    "instant",
  );

  assert.equal(
    resolveModeTransitionAction({
      previousMode: "demologia",
      nextMode: "rl",
      isAuthHydration: true,
    }),
    "instant",
  );
});
