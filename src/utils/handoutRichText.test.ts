import test from "node:test";
import assert from "node:assert/strict";
import {
  applyHandoutInlineFormat,
  getDefaultHandoutReadingSurface,
  getHandoutAccessionCode,
  stripHandoutRichTextForPreview,
} from "./handoutRichText";

test("getHandoutAccessionCode produces deterministic archival codes by handout type and ID", () => {
  const codeA = getHandoutAccessionCode({ id: "ho_170000_abc", type: "documento" });
  const codeB = getHandoutAccessionCode({ id: "ho_170000_abc", type: "documento" });
  const codeImg = getHandoutAccessionCode({ id: "ho_170000_abc", type: "imagem" });
  const codePista = getHandoutAccessionCode({ id: "ho_170000_xyz", type: "pista" });

  assert.equal(codeA, codeB);
  assert.match(codeA, /^DOC-[0-9A-F]{4}$/);
  assert.match(codeImg, /^IMG-[0-9A-F]{4}$/);
  assert.match(codePista, /^PST-[0-9A-F]{4}$/);
  assert.notEqual(codeA.slice(4), codePista.slice(4));
});

test("getDefaultHandoutReadingSurface selects paper for documents/texts and dark for images/clues", () => {
  assert.equal(getDefaultHandoutReadingSurface("documento"), "paper");
  assert.equal(getDefaultHandoutReadingSurface("texto"), "paper");
  assert.equal(getDefaultHandoutReadingSurface("imagem"), "dark");
  assert.equal(getDefaultHandoutReadingSurface("pista"), "dark");
  assert.equal(getDefaultHandoutReadingSurface("outro"), "dark");
});

test("stripHandoutRichTextForPreview removes headings, bold, italic, dividers, and affiliation syntax", () => {
  const raw = "#h1 Relatório Confidencial\n---\n**Paciente 04** apresentou sinais de ^^#h2 eco^^ ligados à #(Membrana).";
  const preview = stripHandoutRichTextForPreview(raw);
  assert.equal(
    preview,
    "Relatório Confidencial Paciente 04 apresentou sinais de #h2 eco ligados à Membrana."
  );

  const truncated = stripHandoutRichTextForPreview(raw, 24);
  assert.ok(truncated.length <= 24);
  assert.ok(truncated.endsWith("…"));
});

test("applyHandoutInlineFormat wraps selection for bold/italic, inserts affiliations, dividers, and toggles headings", () => {
  // Wrap selection with bold
  const bold = applyHandoutInlineFormat("Carta do Subsolo", 9, 16, { kind: "bold" });
  assert.equal(bold.content, "Carta do **Subsolo**");
  assert.equal(bold.content.slice(bold.nextSelectionStart, bold.nextSelectionEnd), "Subsolo");

  // Insert italic placeholder when collapsed
  const italic = applyHandoutInlineFormat("Nota: ", 6, 6, { kind: "italic" });
  assert.equal(italic.content, "Nota: ^^itálico^^");

  // Insert affiliation mention
  const aff = applyHandoutInlineFormat("Rastro de ", 10, 10, {
    kind: "affiliation",
    label: "Dor",
  });
  assert.equal(aff.content, "Rastro de #(Dor)");

  // Toggle heading prefix on current line
  const h1 = applyHandoutInlineFormat("Linha 1\nCabeçalho\nLinha 3", 10, 10, {
    kind: "heading",
    level: 1,
  });
  assert.equal(h1.content, "Linha 1\n#h1 Cabeçalho\nLinha 3");

  // Insert Obsidian divider on new line
  const div = applyHandoutInlineFormat("Parte 1", 7, 7, { kind: "divider" });
  assert.equal(div.content, "Parte 1\n---\n");
});
