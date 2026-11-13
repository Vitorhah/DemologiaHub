import test from "node:test";
import assert from "node:assert/strict";
import {
  isOcultistaSheetName,
  shouldAutoSyncMainSheet,
  shouldAutoSyncExtraSheet,
  findOcultistaPlayerRecordIds,
} from "./sheetSync";
import { isSystemRecordId } from "./handoutsLogic";

test("isOcultistaSheetName identifies Ocultista case-insensitively and ignores other names", () => {
  assert.equal(isOcultistaSheetName("Ocultista"), true);
  assert.equal(isOcultistaSheetName("  ocultista "), true);
  assert.equal(isOcultistaSheetName("OCULTISTA"), true);
  assert.equal(isOcultistaSheetName("Agente Kael"), false);
  assert.equal(isOcultistaSheetName("Ocultista Novo"), false);
  assert.equal(isOcultistaSheetName(""), false);
});

test("shouldAutoSyncMainSheet blocks auto-sync for Ocultista until manually enabled", () => {
  assert.equal(
    shouldAutoSyncMainSheet({
      name: "Ocultista",
      userUid: "user-1",
      isOnline: true,
      currentPage: "ficha",
      manualOcultistaSync: false,
    }),
    false
  );

  assert.equal(
    shouldAutoSyncMainSheet({
      name: "Ocultista",
      userUid: "user-1",
      isOnline: true,
      currentPage: "ficha",
      manualOcultistaSync: true,
    }),
    true
  );

  assert.equal(
    shouldAutoSyncMainSheet({
      name: "Dante",
      userUid: "user-1",
      isOnline: true,
      currentPage: "ficha",
      manualOcultistaSync: false,
    }),
    true
  );

  assert.equal(
    shouldAutoSyncMainSheet({
      name: "Dante",
      userUid: "user-1",
      isOnline: false,
      currentPage: "ficha",
      manualOcultistaSync: true,
    }),
    false
  );
});

test("shouldAutoSyncExtraSheet prevents auto-sync for Ocultista extra sheets unless explicitly enabled", () => {
  assert.equal(
    shouldAutoSyncExtraSheet({
      name: "Ocultista",
      synchronized: true,
      last_local_edit: Date.now(),
      manualOcultistaSync: false,
    }),
    false
  );

  assert.equal(
    shouldAutoSyncExtraSheet({
      name: "Ocultista",
      synchronized: true,
      last_local_edit: Date.now(),
      manualOcultistaSync: true,
    }),
    true
  );

  assert.equal(
    shouldAutoSyncExtraSheet({
      name: "Criatura",
      synchronized: true,
      last_local_edit: Date.now(),
    }),
    true
  );
});

test("findOcultistaPlayerRecordIds finds all Ocultista sheets and skips system records and named agents", () => {
  const rows = [
    { id: "uid-1", data: { name: "Ocultista" } },
    { id: "uid-2", data: { name: "  ocultista " } },
    { id: "uid-3", data: { name: "Kael" } },
    { id: "EXTRA_FICHA_99", data: { name: "Ocultista" } },
    { id: "MASTER_STATE", data: { name: "Ocultista" } },
    { id: "HANDOUTS_MASTER", data: { name: "Ocultista" } },
  ];

  const ids = findOcultistaPlayerRecordIds(rows, isSystemRecordId);
  assert.deepEqual(ids, ["uid-1", "uid-2", "EXTRA_FICHA_99"]);
});
