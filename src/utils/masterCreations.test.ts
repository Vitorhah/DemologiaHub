import test from "node:test";
import assert from "node:assert/strict";
import {
  A4_ASPECT_RATIO,
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  CREATION_ELEMENT_ORDER,
  MAX_CREATION_HISTORY,
  addElementToDocument,
  bringElementToFront,
  buildCreationExportFilename,
  cloneElementForInsert,
  computeResizedElementBox,
  createCreationElement,
  createCreationHistory,
  createEmptyCreationDocument,
  duplicateElementInDocument,
  moveElementLayerStep,
  normalizeCreationDocument,
  normalizeHexOrTransparent,
  pushCreationHistory,
  redoCreationHistory,
  removeElementFromDocument,
  reorderElementLayerById,
  sendElementToBack,
  undoCreationHistory,
  updateElementInDocument,
  validateCreationImageFile,
} from "./masterCreations";
import { isSystemRecordId } from "./handoutsLogic";

test("A4 page dimensions respect exact 210x297mm proportion and CREATION_DOC_ is a system record ID", () => {
  assert.equal(A4_WIDTH_PX, 794);
  assert.equal(A4_HEIGHT_PX, 1123);
  assert.ok(Math.abs(A4_ASPECT_RATIO - 210 / 297) < 0.002);
  assert.equal(isSystemRecordId("CREATION_DOC_abc123"), true);
});

test("all 8 document block types create valid independent elements without RPG mechanics", () => {
  assert.deepEqual(CREATION_ELEMENT_ORDER, [
    "text",
    "image",
    "profile",
    "description",
    "info",
    "rect",
    "divider",
    "line",
  ]);
  for (const type of CREATION_ELEMENT_ORDER) {
    const el = createCreationElement(type);
    assert.equal(el.type, type);
    assert.equal(el.visible, true);
    assert.equal(el.locked, false);
    assert.ok(el.width >= 24);
    assert.ok(el.height >= 12);
    // Ensure strictly document-only fields (no RPG stats/skills/rituals)
    assert.equal("skills" in el, false);
    assert.equal("rituals" in el, false);
    assert.equal("variables" in el, false);
    assert.equal("level" in el, false);
  }
});

test("add, update, duplicate, clone-for-paste, and remove elements keep layer zIndex normalized", () => {
  let doc = createEmptyCreationDocument("master_1", "Dossiê 01");
  const r1 = addElementToDocument(doc, "text");
  doc = r1.doc;
  const r2 = addElementToDocument(doc, "rect");
  doc = r2.doc;

  assert.equal(doc.elements.length, 2);
  assert.deepEqual(
    doc.elements.map((e) => e.zIndex),
    [0, 1],
  );

  doc = updateElementInDocument(doc, r1.element.id, {
    textColor: "#FF0000",
    fontWeight: "bold",
    fontStyle: "italic",
    textDecoration: "underline",
    textAlign: "center",
    name: "Título Principal",
  });
  const updated = doc.elements.find((e) => e.id === r1.element.id)!;
  assert.equal(updated.textColor, "#ff0000");
  assert.equal(updated.name, "Título Principal");
  assert.equal(updated.textDecoration, "underline");

  const dup = duplicateElementInDocument(doc, r1.element.id);
  doc = dup.doc;
  assert.ok(dup.element);
  assert.equal(doc.elements.length, 3);
  assert.equal(dup.element!.zIndex, 2);
  assert.notEqual(dup.element!.id, r1.element.id);
  assert.ok(dup.element!.x > updated.x);

  const pasted = cloneElementForInsert(updated, doc.elements.length, 30);
  assert.notEqual(pasted.id, updated.id);
  assert.equal(pasted.locked, false);

  doc = removeElementFromDocument(doc, r2.element.id);
  assert.equal(doc.elements.length, 2);
  assert.deepEqual(
    doc.elements.map((e) => e.zIndex),
    [0, 1],
  );
});

test("layer ordering: front, back, step up/down, and drag reorder update zIndex cleanly", () => {
  let doc = createEmptyCreationDocument("master_1");
  const a = addElementToDocument(doc, "text", { name: "A" });
  doc = a.doc;
  const b = addElementToDocument(doc, "rect", { name: "B" });
  doc = b.doc;
  const c = addElementToDocument(doc, "image", { name: "C" });
  doc = c.doc;

  // Initial order bottom -> top: A, B, C
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["A", "B", "C"],
  );

  doc = bringElementToFront(doc, a.element.id);
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["B", "C", "A"],
  );

  doc = sendElementToBack(doc, a.element.id);
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["A", "B", "C"],
  );

  doc = moveElementLayerStep(doc, a.element.id, "up");
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["B", "A", "C"],
  );

  doc = moveElementLayerStep(doc, a.element.id, "down");
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["A", "B", "C"],
  );

  doc = reorderElementLayerById(doc, c.element.id, a.element.id);
  assert.deepEqual(
    doc.elements.map((e) => e.name),
    ["C", "A", "B"],
  );
});

test("computeResizedElementBox enforces minimums and preserves image aspect ratio when locked", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 }; // ratio 2:1

  const freeResize = computeResizedElementBox(start, "se", 50, 80, {
    lockAspectRatio: false,
  });
  assert.deepEqual(freeResize, { x: 100, y: 100, width: 250, height: 180 });

  const lockedCorner = computeResizedElementBox(start, "se", 100, 10, {
    lockAspectRatio: true,
    aspectRatio: 2,
  });
  assert.equal(lockedCorner.width, 300);
  assert.equal(lockedCorner.height, 150);

  const lockedWest = computeResizedElementBox(start, "w", -40, 0, {
    lockAspectRatio: true,
    aspectRatio: 2,
  });
  assert.equal(lockedWest.x, 60);
  assert.equal(lockedWest.width, 240);
  assert.equal(lockedWest.height, 120);

  const minClamp = computeResizedElementBox(start, "se", -500, -500, {
    lockAspectRatio: false,
  });
  assert.equal(minClamp.width, 24);
  assert.equal(minClamp.height, 12);
});

test("undo/redo history stack works reliably and caps snapshots at MAX_CREATION_HISTORY", () => {
  const d0 = createEmptyCreationDocument("m1", "V0");
  let history = createCreationHistory(d0);

  const d1 = { ...d0, title: "V1" };
  const d2 = { ...d0, title: "V2" };
  history = pushCreationHistory(history, d1);
  history = pushCreationHistory(history, d2);
  assert.equal(history.present.title, "V2");
  assert.equal(history.past.length, 2);

  history = undoCreationHistory(history);
  assert.equal(history.present.title, "V1");
  assert.equal(history.future.length, 1);

  history = redoCreationHistory(history);
  assert.equal(history.present.title, "V2");

  // Push beyond cap
  for (let i = 0; i < MAX_CREATION_HISTORY + 10; i++) {
    history = pushCreationHistory(history, { ...d0, title: `Step ${i}` });
  }
  assert.equal(history.past.length, MAX_CREATION_HISTORY);
});

test("hex normalization, document sanitization, image validation, and export filenames", () => {
  assert.equal(normalizeHexOrTransparent("#abc", "#000000"), "#aabbcc");
  assert.equal(normalizeHexOrTransparent("transparent", "#000000"), "transparent");
  assert.equal(normalizeHexOrTransparent("javascript:alert(1)", "#111111"), "#111111");

  const doc = normalizeCreationDocument(
    {
      title: "  Relatório   Confidencial  ",
      elements: [
        {
          id: "img1",
          type: "image",
          imageUrl: "javascript:alert(1)",
        } as any,
      ],
    },
    "m1",
  );
  assert.equal(doc.title, "Relatório Confidencial");
  assert.equal(doc.elements[0].imageUrl, "");

  assert.equal(
    validateCreationImageFile({ type: "image/png", name: "selos.png", size: 2048 }).ok,
    true,
  );
  assert.equal(
    validateCreationImageFile({ type: "image/svg+xml", name: "x.svg", size: 100 }).ok,
    false,
  );
  assert.equal(
    validateCreationImageFile({ type: "image/png", name: "big.png", size: 12 * 1024 * 1024 }).ok,
    false,
  );

  assert.equal(
    buildCreationExportFilename("Relatório: Setor 04!", "jpg"),
    "criacao_relatorio_setor_04.jpg",
  );
  assert.equal(
    buildCreationExportFilename("Cartaz Oficial", "png"),
    "criacao_cartaz_oficial.png",
  );
});
