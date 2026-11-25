import test from "node:test";
import assert from "node:assert/strict";
import {
  findRegisteredAffiliationByName,
  isObsidianDividerLine,
  parseCreatureInlineText,
  parseCreatureRichText,
  stripCreatureRichTextForPreview,
} from "./creatureRichText";

test("parseCreatureInlineText parses **bold**, ^^italic^^, and nested combinations", () => {
  const tokens = parseCreatureInlineText(
    "A **Calamidade da Dor** nasce de ^^uma fenda na Membrana^^ e **^^eco eterno^^**.",
  );

  assert.equal(tokens[0].type, "text");
  assert.equal(tokens[1].type, "bold");
  if (tokens[1].type === "bold") {
    assert.deepEqual(tokens[1].children, [{ type: "text", value: "Calamidade da Dor" }]);
  }
  assert.equal(tokens[3].type, "italic");
  if (tokens[3].type === "italic") {
    assert.deepEqual(tokens[3].children, [
      { type: "text", value: "uma fenda na Membrana" },
    ]);
  }
  assert.equal(tokens[5].type, "bold");
  if (tokens[5].type === "bold") {
    assert.equal(tokens[5].children[0].type, "italic");
  }
});

test("findRegisteredAffiliationByName enforces exact full-name match and rejects partial or unknown names", () => {
  assert.equal(findRegisteredAffiliationByName("Dor")?.id, "dor");
  assert.equal(findRegisteredAffiliationByName("  membrana  ")?.id, "membrana");
  assert.equal(findRegisteredAffiliationByName("Intenção")?.id, "intencao");
  assert.equal(findRegisteredAffiliationByName("Intencao")?.id, "intencao");
  assert.equal(findRegisteredAffiliationByName("Caos")?.id, "caos");

  // Partial or unregistered names must NOT match
  assert.equal(findRegisteredAffiliationByName("Do"), null);
  assert.equal(findRegisteredAffiliationByName("Dores"), null);
  assert.equal(findRegisteredAffiliationByName("Mem"), null);
  assert.equal(findRegisteredAffiliationByName("Abismo Desconhecido"), null);
  assert.equal(findRegisteredAffiliationByName(""), null);
});

test("parseCreatureInlineText transforms #(RegisteredAffiliation) into visual tokens and preserves unknown #(Name) as plain text", () => {
  const tokens = parseCreatureInlineText(
    "Afiliado à #(Dor) e #(Intenção), mas não a #(Do) nem #(Sombra).",
  );

  const affTokens = tokens.filter((t) => t.type === "affiliation");
  assert.equal(affTokens.length, 2);
  assert.equal(affTokens[0].type === "affiliation" && affTokens[0].affiliationId, "dor");
  assert.equal(
    affTokens[1].type === "affiliation" && affTokens[1].affiliationId,
    "intencao",
  );

  const plainText = tokens
    .filter((t) => t.type === "text")
    .map((t) => (t.type === "text" ? t.value : ""))
    .join("");
  assert.ok(plainText.includes("#(Do)"));
  assert.ok(plainText.includes("#(Sombra)"));
});

test("parseCreatureRichText handles Obsidian-style --- horizontal dividers cleanly", () => {
  assert.equal(isObsidianDividerLine("---"), true);
  assert.equal(isObsidianDividerLine("  -----  "), true);
  assert.equal(isObsidianDividerLine("--"), false);
  assert.equal(isObsidianDividerLine("--- texto"), false);

  const blocks = parseCreatureRichText(
    "**Fase 1**\n---\n^^Fase 2^^ vinculada a #(Medo)",
  );
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[1].type, "divider");
  assert.equal(blocks[2].type, "paragraph");
});

test("stripCreatureRichTextForPreview removes markdown markers and dividers for list preview", () => {
  const preview = stripCreatureRichTextForPreview(
    "**Calamidade**\n---\n^^Nascida de #(Membrana)^^",
  );
  assert.equal(preview, "Calamidade Nascida de Membrana");
});
