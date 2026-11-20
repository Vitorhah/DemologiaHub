import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_PROFILES,
  CHARACTER_PROFILE_LIST,
  DEFAULT_CHARACTER_PROFILE,
  getProfileBonusEntries,
  getProfileBonusForStat,
  getProfileDefinition,
  normalizeCharacterProfile,
} from "./profiles";
import {
  getAttributeLimitForStat,
  isAttributeOverLimit,
  normalizeLevel,
  protectPlayerLevelOnSave,
  resolveAttributeUpdateWithProfile,
} from "./levelSystem";

test("all 3 official Demologia profiles have exact symbols, colors, descriptions, and bonuses", () => {
  assert.equal(CHARACTER_PROFILE_LIST.length, 3);

  assert.equal(CHARACTER_PROFILES.executivo.symbol, "sword");
  assert.equal(CHARACTER_PROFILES.executivo.colorName, "red");
  assert.deepEqual(CHARACTER_PROFILES.executivo.bonuses, { AGL: 1, FOR: 2 });

  assert.equal(CHARACTER_PROFILES.pensativo.symbol, "brain");
  assert.equal(CHARACTER_PROFILES.pensativo.colorName, "green");
  assert.deepEqual(CHARACTER_PROFILES.pensativo.bonuses, { SAN: 1, INT: 2 });

  assert.equal(CHARACTER_PROFILES.oculto.symbol, "eye");
  assert.equal(CHARACTER_PROFILES.oculto.colorName, "blue");
  assert.deepEqual(CHARACTER_PROFILES.oculto.bonuses, { INT: 1, OCU: 3 });
});

test("normalizeCharacterProfile assigns default profile for legacy or invalid sheets", () => {
  assert.equal(normalizeCharacterProfile(undefined), DEFAULT_CHARACTER_PROFILE);
  assert.equal(normalizeCharacterProfile(null), DEFAULT_CHARACTER_PROFILE);
  assert.equal(normalizeCharacterProfile("invalido"), DEFAULT_CHARACTER_PROFILE);
  assert.equal(normalizeCharacterProfile("  OCULTO "), "oculto");
  assert.equal(normalizeCharacterProfile("Pensativo"), "pensativo");
  assert.equal(getProfileDefinition("pensativo").name, "Pensativo");
  assert.deepEqual(getProfileBonusEntries("oculto"), [
    { stat: "INT", bonus: 1 },
    { stat: "OCU", bonus: 3 },
  ]);
});

test("getAttributeLimitForStat applies 3 + ((LV - 1) * 2) + profile bonus accurately", () => {
  // Prompt example: Executivo LV 3 -> AGL 8, FOR 9, others 7
  assert.equal(getAttributeLimitForStat(3, "AGL", "executivo"), 8);
  assert.equal(getAttributeLimitForStat(3, "FOR", "executivo"), 9);
  assert.equal(getAttributeLimitForStat(3, "VIT", "executivo"), 7);
  assert.equal(getAttributeLimitForStat(3, "INT", "executivo"), 7);
  assert.equal(getAttributeLimitForStat(3, "OCU", "executivo"), 7);
  assert.equal(getAttributeLimitForStat(3, "SAN", "executivo"), 7);

  // Pensativo LV 1 -> SAN 4, INT 5, others 3
  assert.equal(getAttributeLimitForStat(1, "SAN", "pensativo"), 4);
  assert.equal(getAttributeLimitForStat(1, "INT", "pensativo"), 5);
  assert.equal(getAttributeLimitForStat(1, "FOR", "pensativo"), 3);

  // Oculto LV 4 (base 9) -> INT 10, OCU 12, others 9
  assert.equal(getAttributeLimitForStat(4, "INT", "oculto"), 10);
  assert.equal(getAttributeLimitForStat(4, "OCU", "oculto"), 12);
  assert.equal(getAttributeLimitForStat(4, "AGL", "oculto"), 9);

  // Case-insensitive stat key and bonus helper
  assert.equal(getProfileBonusForStat("ocu", "oculto"), 3);
  assert.equal(getProfileBonusForStat("CUSTOM", "oculto"), 0);
});

test("switching profiles preserves high stats, detects over-limit, and blocks increases without bumping LV", () => {
  // Oculto LV 1 raises OCU to 6 (valid: base 3 + 3 = 6)
  assert.equal(isAttributeOverLimit(6, 1, "OCU", "oculto"), false);
  assert.equal(normalizeLevel(1, { OCU: 6, VIT: 1 }, "oculto"), 1);

  // Switch to Executivo at LV 1 -> OCU limit drops to 3, LV MUST remain 1, OCU stays 6 and is over-limit
  assert.equal(normalizeLevel(1, { OCU: 6, VIT: 1 }, "executivo"), 1);
  assert.equal(isAttributeOverLimit(6, 1, "OCU", "executivo"), true);

  // Attempting to increase OCU (6 -> 7) while over-limit is blocked (stays 6)
  assert.equal(
    resolveAttributeUpdateWithProfile({
      currentVal: 6,
      requestedVal: 7,
      lv: 1,
      statKey: "OCU",
      profile: "executivo",
    }),
    6,
  );

  // Keeping same value on focus/blur (6 -> 6) preserves 6 (non-destructive)
  assert.equal(
    resolveAttributeUpdateWithProfile({
      currentVal: 6,
      requestedVal: 6,
      lv: 1,
      statKey: "OCU",
      profile: "executivo",
    }),
    6,
  );

  // Decreasing an over-limit stat (6 -> 5) is allowed step by step
  assert.equal(
    resolveAttributeUpdateWithProfile({
      currentVal: 6,
      requestedVal: 5,
      lv: 1,
      statKey: "OCU",
      profile: "executivo",
    }),
    5,
  );

  // Normal stat below limit clamps to new profile limit (FOR 1 -> 9 at LV 1 Executivo clamps to 5)
  assert.equal(
    resolveAttributeUpdateWithProfile({
      currentVal: 1,
      requestedVal: 9,
      lv: 1,
      statKey: "FOR",
      profile: "executivo",
    }),
    5,
  );

  // protectPlayerLevelOnSave preserves LV 1 when player has OCU 6 after switching profiles
  const saved = protectPlayerLevelOnSave(
    { lv: 1, profile: "executivo", variables: { OCU: 6, VIT: 1 } },
    1,
    false,
  );
  assert.equal(saved.lv, 1);
  assert.equal(saved.variables.OCU, 6);
});
