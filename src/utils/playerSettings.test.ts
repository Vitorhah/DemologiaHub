import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_SETTINGS,
  clampAppVolume,
  clampNotificationDurationSec,
  computeLocalEffectiveOutputPercent,
  computeNotificationDurationMs,
  getEffectiveAppVolume,
  normalizePlayerSettings,
} from "./playerSettings";

test("clampAppVolume and getEffectiveAppVolume bound 0..1 and honor local mute without mutating appVolume", () => {
  assert.equal(clampAppVolume(-0.4), 0);
  assert.equal(clampAppVolume(1.8), 1);
  assert.equal(clampAppVolume(0.456), 0.46);
  assert.equal(clampAppVolume("invalid", 0.7), 0.7);

  assert.equal(getEffectiveAppVolume({ appVolume: 0.65, appMuted: false }), 0.65);
  assert.equal(getEffectiveAppVolume({ appVolume: 0.65, appMuted: true }), 0);
});

test("computeLocalEffectiveOutputPercent scales local audio output while leaving OST volume untouched", () => {
  assert.equal(
    computeLocalEffectiveOutputPercent(0.8, { appVolume: 0.5, appMuted: false }),
    40,
  );
  assert.equal(
    computeLocalEffectiveOutputPercent(0.8, { appVolume: 0.5, appMuted: true }),
    0,
  );
  assert.equal(
    computeLocalEffectiveOutputPercent(1.0, { appVolume: 1.0, appMuted: false }),
    100,
  );
});

test("clampNotificationDurationSec and computeNotificationDurationMs enforce bounds and scale by toast kind", () => {
  assert.equal(clampNotificationDurationSec(0), 2);
  assert.equal(clampNotificationDurationSec(99), 12);
  assert.equal(clampNotificationDurationSec(6.4), 6);

  assert.equal(computeNotificationDurationMs(4, "roll"), 4000);
  assert.equal(computeNotificationDurationMs(4, "ultimo_suspiro"), 5000);
  assert.equal(computeNotificationDurationMs(4, "handout"), 6000);
  assert.equal(computeNotificationDurationMs(12, "handout"), 14000);
});

test("normalizePlayerSettings recovers cleanly from partial or malformed saved objects", () => {
  assert.deepEqual(normalizePlayerSettings(null), DEFAULT_PLAYER_SETTINGS);
  assert.deepEqual(normalizePlayerSettings("broken"), DEFAULT_PLAYER_SETTINGS);

  const normalized = normalizePlayerSettings({
    appVolume: 0.35,
    appMuted: true,
    notificationDurationSec: 8,
    showRollNotifications: false,
    diceSoundEnabled: false,
    screenShakeEnabled: false,
    hapticsEnabled: false,
    reducedMotion: true,
    textScale: "large",
  });

  assert.deepEqual(normalized, {
    appVolume: 0.35,
    appMuted: true,
    notificationDurationSec: 8,
    showRollNotifications: false,
    diceSoundEnabled: false,
    screenShakeEnabled: false,
    hapticsEnabled: false,
    reducedMotion: true,
    textScale: "large",
  });

  const fallbackScale = normalizePlayerSettings({ textScale: "giant" });
  assert.equal(fallbackScale.textScale, "normal");
});
