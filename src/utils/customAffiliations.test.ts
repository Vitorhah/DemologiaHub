import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_AFFILIATIONS_RECORD_ID,
  deriveAffiliationBorderColor,
  getHexContrastRatio,
  normalizeCustomAffiliations,
  normalizeHexColor,
  removeCustomAffiliation,
  upsertCustomAffiliation,
} from "./customAffiliations";
import {
  RITUAL_AFFILIATION_LIST,
  getAllRitualAffiliations,
  getRitualAffiliationDefinition,
  isRitualAffiliationId,
  normalizeRitualAffiliations,
  setCustomRitualAffiliations,
} from "./rituals";
import {
  findRegisteredAffiliationByName,
  parseCreatureInlineText,
} from "./creatureRichText";
import { isSystemRecordId } from "./handoutsLogic";

test("normalizeHexColor accepts 3-char and 6-char HEX codes and rejects invalid inputs", () => {
  assert.equal(normalizeHexColor("#FFF"), "#ffffff");
  assert.equal(normalizeHexColor("a1b2c3"), "#a1b2c3");
  assert.equal(normalizeHexColor("  #5C0F16 "), "#5c0f16");
  assert.equal(normalizeHexColor("#12345"), null);
  assert.equal(normalizeHexColor("red"), null);
  assert.equal(normalizeHexColor(""), null);
});

test("upsertCustomAffiliation creates, edits, validates collisions, and removes cleanly", () => {
  const created = upsertCustomAffiliation([], {
    label: "Abismo",
    background: "#14141f",
    textColor: "#f4f4f8",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.equal(created.isEdit, false);
  assert.equal(created.affiliation.id, "custom_abismo");
  assert.equal(created.affiliation.label, "Abismo");
  assert.equal(created.affiliation.background, "#14141f");
  assert.equal(created.affiliation.textColor, "#f4f4f8");
  assert.equal(created.affiliation.isCustom, true);

  // Reject collision with official Demologia affiliations (accent & case insensitive)
  const officialCollision = upsertCustomAffiliation(created.affiliations, {
    label: "Intencao",
    background: "#111111",
    textColor: "#ffffff",
  });
  assert.equal(officialCollision.ok, false);

  // Reject duplicate custom name (accent/case insensitive)
  const dupCustom = upsertCustomAffiliation(created.affiliations, {
    label: "  abismo ",
    background: "#222222",
    textColor: "#eeeeee",
  });
  assert.equal(dupCustom.ok, false);

  // Reject parentheses that could interfere with #(Nome) rich text syntax
  const invalidParens = upsertCustomAffiliation(created.affiliations, {
    label: "Eco (Vazio)",
    background: "#222222",
    textColor: "#eeeeee",
  });
  assert.equal(invalidParens.ok, false);

  // Edit existing custom affiliation colors and label
  const edited = upsertCustomAffiliation(created.affiliations, {
    id: created.affiliation.id,
    label: "Abismo Profundo",
    background: "#5c0f16",
    textColor: "#fce7ea",
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(edited.isEdit, true);
  assert.equal(edited.affiliation.id, "custom_abismo");
  assert.equal(edited.affiliation.label, "Abismo Profundo");
  assert.equal(edited.affiliation.background, "#5c0f16");
  assert.equal(edited.affiliation.textColor, "#fce7ea");

  // Remove custom affiliation
  const removed = removeCustomAffiliation(edited.affiliations, "custom_abismo");
  assert.equal(removed.removed?.id, "custom_abismo");
  assert.equal(removed.affiliations.length, 0);
});

test("dynamic affiliation registry integrates with rituals and #(Nome) rich text parser", () => {
  try {
    const res = upsertCustomAffiliation([], {
      label: "Relíquia",
      background: "#1e3a2f",
      textColor: "#d1fae5",
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;

    setCustomRitualAffiliations(res.affiliations);

    // Official list stays untouched (9 canonical)
    assert.equal(RITUAL_AFFILIATION_LIST.length, 9);
    // Combined list contains official + custom
    assert.equal(getAllRitualAffiliations().length, 10);
    assert.equal(isRitualAffiliationId("custom_reliquia"), true);
    assert.equal(
      getRitualAffiliationDefinition("custom_reliquia")?.background,
      "#1e3a2f"
    );

    // Rich text lookup works with and without accents, exact full-name only
    assert.equal(findRegisteredAffiliationByName("Relíquia")?.id, "custom_reliquia");
    assert.equal(findRegisteredAffiliationByName("reliquia")?.id, "custom_reliquia");
    assert.equal(findRegisteredAffiliationByName("Reliq"), null);

    const tokens = parseCreatureInlineText("Artefato de #(Relíquia) e #(Dor).");
    const affTokens = tokens.filter((t) => t.type === "affiliation");
    assert.equal(affTokens.length, 2);
    assert.equal(
      affTokens[0].type === "affiliation" && affTokens[0].affiliationId,
      "custom_reliquia"
    );
    assert.equal(
      affTokens[1].type === "affiliation" && affTokens[1].affiliationId,
      "dor"
    );

    // normalizeRitualAffiliations preserves valid custom_ IDs and rejects invalid ones
    assert.deepEqual(
      normalizeRitualAffiliations(["dor", "custom_reliquia", "invalida"]),
      ["dor", "custom_reliquia"]
    );
  } finally {
    // Always restore clean global registry state for other tests
    setCustomRitualAffiliations([]);
  }

  assert.equal(findRegisteredAffiliationByName("Relíquia"), null);
  assert.equal(getAllRitualAffiliations().length, 9);
});

test("normalizeCustomAffiliations sanitizes malformed rows and system record ID is protected", () => {
  assert.equal(isSystemRecordId(CUSTOM_AFFILIATIONS_RECORD_ID), true);
  assert.ok(getHexContrastRatio("#000000", "#ffffff") > 20);
  assert.match(deriveAffiliationBorderColor("#14141f", "#ffffff"), /^#[0-9a-f]{6}$/);

  const cleaned = normalizeCustomAffiliations([
    {
      id: "custom_eco",
      label: "Eco",
      background: "#222",
      textColor: "#eee",
    },
    {
      // Built-in collision must be dropped
      id: "dor",
      label: "Dor",
      background: "#000000",
      textColor: "#ffffff",
    },
    {
      // Invalid HEX must be dropped
      id: "custom_bad",
      label: "Ruim",
      background: "not-a-color",
      textColor: "#ffffff",
    },
  ]);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, "custom_eco");
  assert.equal(cleaned[0].background, "#222222");
  assert.equal(cleaned[0].textColor, "#eeeeee");
});
