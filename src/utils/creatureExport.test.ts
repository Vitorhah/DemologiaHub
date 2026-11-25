import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATURE_EXPORT_LAYOUTS,
  DEFAULT_EXPORT_OVERLAY_OPACITY,
  MAX_EXPORT_BG_FILE_BYTES,
  buildCreatureExportFilename,
  clampExportOverlayOpacity,
  resolveExportBlockContainerStyle,
  validateExportBackgroundFile,
} from "./creatureExport";

test("buildCreatureExportFilename sanitizes Portuguese accents and appends layout", () => {
  assert.equal(
    buildCreatureExportFilename("Cão da Névoa — Nível III", "pc"),
    "ficha_cao_da_nevoa_nivel_iii_pc.jpg",
  );
  assert.equal(
    buildCreatureExportFilename("   ", "mobile"),
    "ficha_criatura_mobile.jpg",
  );
  assert.equal(
    buildCreatureExportFilename("Entidade@#$%Alpha", "mobile"),
    "ficha_entidade_alpha_mobile.jpg",
  );
});

test("validateExportBackgroundFile accepts valid images and rejects invalid/oversized files", () => {
  assert.deepEqual(
    validateExportBackgroundFile({
      type: "image/jpeg",
      name: "bg.jpg",
      size: 256_000,
    }),
    { ok: true },
  );
  assert.deepEqual(
    validateExportBackgroundFile({
      type: "",
      name: "fundo.PNG",
      size: 1024,
    }),
    { ok: true },
  );

  const empty = validateExportBackgroundFile({
    type: "image/png",
    name: "empty.png",
    size: 0,
  });
  assert.equal(empty.ok, false);

  const huge = validateExportBackgroundFile({
    type: "image/png",
    name: "huge.png",
    size: MAX_EXPORT_BG_FILE_BYTES + 1,
  });
  assert.equal(huge.ok, false);

  const pdf = validateExportBackgroundFile({
    type: "application/pdf",
    name: "doc.pdf",
    size: 4096,
  });
  assert.equal(pdf.ok, false);
});

test("clampExportOverlayOpacity clamps values safely within [0, 0.92]", () => {
  assert.equal(clampExportOverlayOpacity(-0.4), 0);
  assert.equal(clampExportOverlayOpacity(0.684), 0.68);
  assert.equal(clampExportOverlayOpacity(1.5), 0.92);
  assert.equal(
    clampExportOverlayOpacity(Number.NaN),
    DEFAULT_EXPORT_OVERLAY_OPACITY,
  );
});

test("resolveExportBlockContainerStyle forces full width in mobile and preserves columns in pc", () => {
  const pcHalf = resolveExportBlockContainerStyle(
    { widthPct: 50, minHeightPx: 220 },
    "pc",
  );
  assert.equal(pcHalf.flex, "1 1 calc(50% - 12px)");
  assert.equal(pcHalf.minHeight, "220px");

  const pcFull = resolveExportBlockContainerStyle(
    { widthPct: 100, minHeightPx: null },
    "pc",
  );
  assert.equal(pcFull.width, "100%");
  assert.equal(pcFull.flex, "1 1 100%");

  const mobileHalf = resolveExportBlockContainerStyle(
    { widthPct: 50, minHeightPx: 180 },
    "mobile",
  );
  assert.equal(mobileHalf.width, "100%");
  assert.equal(mobileHalf.flex, "1 1 100%");
  assert.equal(mobileHalf.minHeight, "180px");

  assert.ok(
    CREATURE_EXPORT_LAYOUTS.pc.widthPx > CREATURE_EXPORT_LAYOUTS.mobile.widthPx,
  );
});
