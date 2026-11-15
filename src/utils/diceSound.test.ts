import test from "node:test";
import assert from "node:assert/strict";
import {
  getDiceRollSoundPreset,
  playDiceRollSound,
  shouldPlayDiceRollSound,
} from "./diceSound";

test("shouldPlayDiceRollSound strictly enforces ostAudioAccepted lock and Web Audio support", () => {
  assert.equal(
    shouldPlayDiceRollSound({ ostAudioAccepted: false, hasWebAudio: true }),
    false,
  );
  assert.equal(
    shouldPlayDiceRollSound({ ostAudioAccepted: true, hasWebAudio: false }),
    false,
  );
  assert.equal(
    shouldPlayDiceRollSound({ ostAudioAccepted: true, hasWebAudio: true }),
    true,
  );
});

test("getDiceRollSoundPreset returns clatter taps and appropriate critical/fumble accents", () => {
  const normal = getDiceRollSoundPreset("normal");
  assert.equal(normal.taps.length, 3);
  assert.equal(normal.accentFreqStartHz, undefined);

  const crit = getDiceRollSoundPreset("crit");
  assert.equal(crit.taps.length, 3);
  assert.ok((crit.accentFreqEndHz || 0) > (crit.accentFreqStartHz || 0));

  const fumble = getDiceRollSoundPreset("fumble");
  assert.equal(fumble.taps.length, 3);
  assert.ok((fumble.accentFreqEndHz || 999) < (fumble.accentFreqStartHz || 0));
});

test("playDiceRollSound returns false safely when locked or when window/AudioContext is absent", () => {
  assert.equal(
    playDiceRollSound({ ostAudioAccepted: false, critical: "normal" }),
    false,
  );
  assert.equal(
    playDiceRollSound({ ostAudioAccepted: true, critical: "crit" }),
    false,
  );
});
