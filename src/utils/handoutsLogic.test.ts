import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeHandoutForPlayer,
  isSystemRecordId,
  buildSanitizedDistribution,
  mergePlayerHandouts,
  filterHandouts,
  normalizeHandoutItem,
} from "./handoutsLogic";
import type { HandoutItem, HandoutFolder } from "../types/handouts";

const sampleHandout: HandoutItem = normalizeHandoutItem({
  id: "h1",
  title: "Carta do Subsolo",
  description: "Encontrada no cofre 04",
  type: "documento",
  folderId: "f1",
  content: "Texto visível da frente",
  imageUrl: "https://example.com/front.jpg",
  hasBackSide: true,
  backText: "Anotação nas costas do papel",
  backImageUrl: "https://example.com/back.jpg",
  secretText: "O traidor é o Dr. V.",
  secretImageUrl: "https://example.com/secret.jpg",
  secretRevealed: false,
  visibility: "individual",
  sharedWith: ["player-1", "player-2"],
});

test("sanitizeHandoutForPlayer strips secret fields when secretRevealed is false", () => {
  const sanitized = sanitizeHandoutForPlayer(sampleHandout);
  assert.equal(sanitized.secretRevealed, false);
  assert.equal(sanitized.secretText, "");
  assert.equal(sanitized.secretImageUrl, "");
  assert.equal(sanitized.content, "Texto visível da frente");
  assert.equal(sanitized.backText, "Anotação nas costas do papel");
  assert.deepEqual(sanitized.sharedWith, []);
});

test("sanitizeHandoutForPlayer preserves secret fields when secretRevealed is true", () => {
  const revealed = { ...sampleHandout, secretRevealed: true };
  const sanitized = sanitizeHandoutForPlayer(revealed);
  assert.equal(sanitized.secretRevealed, true);
  assert.equal(sanitized.secretText, "O traidor é o Dr. V.");
  assert.equal(sanitized.secretImageUrl, "https://example.com/secret.jpg");
});

test("isSystemRecordId detects all system records including HANDOUTS_*", () => {
  assert.equal(isSystemRecordId("HANDOUTS_MASTER"), true);
  assert.equal(isSystemRecordId("HANDOUTS_SHARED"), true);
  assert.equal(isSystemRecordId("HANDOUTS_INDIV_1234"), true);
  assert.equal(isSystemRecordId("OST_FILE_track1"), true);
  assert.equal(isSystemRecordId("EXTRA_FICHA_999"), true);
  assert.equal(isSystemRecordId("MASTER_STATE"), true);
  assert.equal(isSystemRecordId("MASTER_EVENTS"), true);
  assert.equal(isSystemRecordId("TABLETOP_GRID"), true);
  assert.equal(isSystemRecordId("CADERNO_CAMPO_SHARED"), true);
  assert.equal(isSystemRecordId("CHAT_mesa_principal"), true);
  assert.equal(isSystemRecordId("MINIGAME_ASSIGN_p1"), true);
  assert.equal(isSystemRecordId("MINIGAME_RESULTS"), true);
  assert.equal(isSystemRecordId("MASTER_PUSH_p1"), true);
  assert.equal(isSystemRecordId("MASTER_LIBRARY"), true);
  assert.equal(isSystemRecordId("550e8400-e29b-41d4-a716-446655440000"), false);
});

test("buildSanitizedDistribution segregates private, all, and individual handouts safely", () => {
  const folders: HandoutFolder[] = [
    { id: "f1", name: "Setor 04", createdAt: 100 },
    { id: "f2", name: "Arquivos Secretos", createdAt: 200 },
  ];
  const privateItem = normalizeHandoutItem({
    ...sampleHandout,
    id: "h_priv",
    visibility: "private",
    folderId: "f2",
  });
  const allItem = normalizeHandoutItem({
    ...sampleHandout,
    id: "h_all",
    visibility: "all",
    secretRevealed: false,
    folderId: "f1",
  });
  const indivItem = normalizeHandoutItem({
    ...sampleHandout,
    id: "h_indiv",
    visibility: "individual",
    sharedWith: ["p1"],
    secretRevealed: true,
    folderId: "f1",
  });

  const dist = buildSanitizedDistribution([privateItem, allItem, indivItem], folders, ["p1", "p2"]);

  assert.equal(dist.sharedItems.length, 1);
  assert.equal(dist.sharedItems[0].id, "h_all");
  assert.equal(dist.sharedItems[0].secretText, "");

  assert.equal(dist.individualByPlayer["p1"].items.length, 1);
  assert.equal(dist.individualByPlayer["p1"].items[0].secretText, "O traidor é o Dr. V.");
  assert.equal(dist.individualByPlayer["p2"].items.length, 0);
});

test("mergePlayerHandouts deduplicates by ID and filterHandouts filters accurately", () => {
  const shared = [
    normalizeHandoutItem({ ...sampleHandout, id: "a", visibility: "all", type: "pista", updatedAt: 10 }),
  ];
  const indiv = [
    normalizeHandoutItem({ ...sampleHandout, id: "a", visibility: "individual", type: "pista", updatedAt: 20 }),
    normalizeHandoutItem({ ...sampleHandout, id: "b", title: "Foto Polaroid", visibility: "individual", type: "imagem", updatedAt: 30 }),
  ];

  const merged = mergePlayerHandouts(shared, indiv);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "b");

  const filteredByType = filterHandouts(merged, { type: "imagem" });
  assert.equal(filteredByType.length, 1);
  assert.equal(filteredByType[0].id, "b");

  const filteredBySearch = filterHandouts(merged, { search: "polaroid" });
  assert.equal(filteredBySearch.length, 1);
});
