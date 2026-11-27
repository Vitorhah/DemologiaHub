import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NOTE_TITLE,
  MAX_NOTE_PREVIEW_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
  applyHeadingPrefixToLine,
  buildNotePreview,
  filterNoteSummaries,
  formatNoteTimestamp,
  hasNoteContentChanged,
  isTableMissingError,
  normalizeNoteTitle,
  parseMasterNoteContent,
  sortNoteSummaries,
} from "./masterNotes";

test("normalizeNoteTitle falls back to Nova anotação for blank values and caps length", () => {
  assert.equal(normalizeNoteTitle(""), DEFAULT_NOTE_TITLE);
  assert.equal(normalizeNoteTitle("   \t\n "), DEFAULT_NOTE_TITLE);
  assert.equal(normalizeNoteTitle(null), DEFAULT_NOTE_TITLE);
  assert.equal(normalizeNoteTitle("  Pistas da Mansão  "), "Pistas da Mansão");

  const huge = "A".repeat(MAX_NOTE_TITLE_LENGTH + 40);
  assert.equal(normalizeNoteTitle(huge).length, MAX_NOTE_TITLE_LENGTH);
});

test("buildNotePreview flattens line breaks and truncates cleanly", () => {
  assert.equal(buildNotePreview(""), "");
  assert.equal(
    buildNotePreview("Linha 1\n\nLinha 2\t\tLinha 3"),
    "Linha 1 Linha 2 Linha 3"
  );

  const longText = "Palavra ".repeat(40);
  const preview = buildNotePreview(longText);
  assert.ok(preview.length <= MAX_NOTE_PREVIEW_LENGTH);
  assert.ok(preview.endsWith("…"));
});

test("hasNoteContentChanged prevents redundant saves when title and content are unchanged", () => {
  const saved = { title: "Nova anotação", content: "NPC: Dr. Arnaldo" };

  assert.equal(
    hasNoteContentChanged(saved, { title: "", content: "NPC: Dr. Arnaldo" }),
    false
  );
  assert.equal(
    hasNoteContentChanged(saved, { title: "  Nova anotação  ", content: "NPC: Dr. Arnaldo" }),
    false
  );
  assert.equal(
    hasNoteContentChanged(saved, { title: "NPCs", content: "NPC: Dr. Arnaldo" }),
    true
  );
  assert.equal(
    hasNoteContentChanged(saved, { title: "Nova anotação", content: "NPC: Dr. Arnaldo (ferido)" }),
    true
  );
});

test("sortNoteSummaries orders notes by newest updated_at first and filters by title or preview", () => {
  const notes = [
    {
      id: "1",
      master_id: "m1",
      title: "Antiga",
      preview: "Primeiro encontro",
      updated_at: "2026-11-20T10:00:00.000Z",
    },
    {
      id: "2",
      master_id: "m1",
      title: "Recente",
      preview: "Pista secreta na igreja",
      updated_at: "2026-11-22T15:30:00.000Z",
    },
    {
      id: "3",
      master_id: "m1",
      title: "Intermediária",
      preview: "Anotação neutra",
      updated_at: "2026-11-21T12:00:00.000Z",
    },
  ];

  const sorted = sortNoteSummaries(notes);
  assert.deepEqual(
    sorted.map((n) => n.id),
    ["2", "3", "1"]
  );

  assert.deepEqual(
    filterNoteSummaries(sorted, "igreja").map((n) => n.id),
    ["2"]
  );
  assert.deepEqual(
    filterNoteSummaries(sorted, "antiga").map((n) => n.id),
    ["1"]
  );
});

test("isTableMissingError distinguishes missing master_notes table from transient failures", () => {
  assert.equal(isTableMissingError({ code: "42P01", message: 'relation "public.master_notes" does not exist' }), true);
  assert.equal(isTableMissingError({ code: "PGRST205", message: "Could not find the table 'public.master_notes' in the schema cache" }), true);
  assert.equal(isTableMissingError({ status: 404, message: "Not found" }), true);
  assert.equal(isTableMissingError({ code: "57014", message: "statement timeout" }), false);
  assert.equal(isTableMissingError(new Error("Failed to fetch")), false);

  const sameDay = formatNoteTimestamp("2026-11-22T14:05:00.000Z", Date.parse("2026-11-22T16:00:00.000Z"));
  assert.ok(/^\d{2}:\d{2}$/.test(sameDay));
});

test("parseMasterNoteContent parses #h1-#h6 headings (case-insensitive), dividers, inline rich tokens, and keeps raw HTML inert", () => {
  const raw = [
    "#h1 Dossiê **Confidencial**",
    "#H2 Suspeitos de #(Dor)",
    "#h3: Pistas ^^Iniciais^^",
    "#h4 Detalhe menor",
    "#h5 Nota de rodapé",
    "#h6 Classificação <script>alert(1)</script>",
    "---",
    "Parágrafo comum com **negrito** e #h7 literal.",
    "",
  ].join("\n");

  const blocks = parseMasterNoteContent(raw);
  assert.equal(blocks.length, 9);

  assert.equal(blocks[0].type, "heading");
  if (blocks[0].type === "heading") {
    assert.equal(blocks[0].level, 1);
    assert.equal(blocks[0].text, "Dossiê **Confidencial**");
    assert.equal(blocks[0].tokens.some((t) => t.type === "bold"), true);
  }

  assert.equal(blocks[1].type, "heading");
  if (blocks[1].type === "heading") {
    assert.equal(blocks[1].level, 2);
    assert.equal(
      blocks[1].tokens.some(
        (t) => t.type === "affiliation" && t.affiliationId === "dor",
      ),
      true,
    );
  }

  assert.equal(blocks[2].type, "heading");
  if (blocks[2].type === "heading") {
    assert.equal(blocks[2].level, 3);
    assert.equal(blocks[2].tokens.some((t) => t.type === "italic"), true);
  }

  assert.equal(blocks[3].type === "heading" && blocks[3].level, 4);
  assert.equal(blocks[4].type === "heading" && blocks[4].level, 5);
  assert.equal(blocks[5].type === "heading" && blocks[5].level, 6);
  assert.equal(blocks[6].type, "divider");

  // #h7 is not a valid HTML heading level, stays regular paragraph
  assert.equal(blocks[7].type, "paragraph");
  assert.equal(blocks[8].type, "empty");
});

test("applyHeadingPrefixToLine adds, switches, and toggles #h1-#h6 prefixes cleanly on the active line", () => {
  const first = applyHeadingPrefixToLine("Introdução\nPistas", 13, 2);
  assert.equal(first.content, "Introdução\n#h2 Pistas");

  const switched = applyHeadingPrefixToLine(first.content, first.nextCursor, 1);
  assert.equal(switched.content, "Introdução\n#h1 Pistas");

  const toggledOff = applyHeadingPrefixToLine(switched.content, switched.nextCursor, 1);
  assert.equal(toggledOff.content, "Introdução\nPistas");
});

test("buildNotePreview strips #h1-#h6 prefixes and rich markers cleanly for sidebar summaries", () => {
  assert.equal(
    buildNotePreview("#h1 **Caso 04**\n#h2 Pistas de #(Dor)"),
    "Caso 04 Pistas de Dor",
  );
});
