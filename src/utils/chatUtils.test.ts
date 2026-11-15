import test from "node:test";
import assert from "node:assert/strict";
import {
  areMessagesEqual,
  classifyMessageListTransition,
  groupChatMessages,
  isScrollNearBottom,
  MAX_CHAT_MESSAGES,
  mergeMessages,
  sanitizeRoomId,
  sliceVisibleMessages,
} from "../components/chat/chatUtils";
import type { ChatMessage } from "../components/chat/types";

const makeMsg = (
  id: string,
  senderId = "u1",
  timestamp = 1000,
  text = `msg ${id}`,
): ChatMessage => ({
  id,
  senderId,
  senderName: senderId === "m1" ? "Mestre" : "Agente",
  isMaster: senderId === "m1",
  text,
  timestamp,
});

test("sanitizeRoomId normalizes room identifiers safely", () => {
  assert.equal(sanitizeRoomId(" Mesa Principal! "), "mesa_principal_");
  assert.equal(sanitizeRoomId(""), "mesa_principal");
});

test("mergeMessages deduplicates, sorts chronologically, and caps at MAX_CHAT_MESSAGES", () => {
  const batchA = Array.from({ length: MAX_CHAT_MESSAGES + 10 }, (_, idx) =>
    makeMsg(`id_${idx}`, "u1", 1000 + idx),
  );
  const batchB = [
    makeMsg("id_0", "u1", 1000), // duplicate
    makeMsg("id_newest", "u2", 5000),
  ];

  const merged = mergeMessages(batchA, batchB);
  assert.equal(merged.length, MAX_CHAT_MESSAGES);
  assert.equal(merged[merged.length - 1].id, "id_newest");
});

test("areMessagesEqual avoids unnecessary state updates for identical message lists", () => {
  const listA = [makeMsg("1", "u1", 100), makeMsg("2", "u2", 200)];
  const listB = [makeMsg("1", "u1", 100), makeMsg("2", "u2", 200)];
  const listC = [makeMsg("1", "u1", 100), makeMsg("3", "u2", 300)];

  assert.equal(areMessagesEqual(listA, listB), true);
  assert.equal(areMessagesEqual(listA, listC), false);
});

test("groupChatMessages groups consecutive messages within 5 minutes and splits across senders", () => {
  const messages = [
    makeMsg("1", "u1", 10_000),
    makeMsg("2", "u1", 60_000),
    makeMsg("3", "m1", 90_000),
    makeMsg("4", "u1", 500_000),
  ];
  const groups = groupChatMessages(messages, "u1");
  assert.equal(groups.length, 3);
  assert.equal(groups[0].messages.length, 2);
  assert.equal(groups[0].isSelf, true);
  assert.equal(groups[1].isMaster, true);
  assert.equal(groups[2].messages[0].id, "4");
});

test("isScrollNearBottom detects whether chat scroll is anchored at bottom", () => {
  assert.equal(
    isScrollNearBottom({ scrollHeight: 1200, scrollTop: 700, clientHeight: 500 }),
    true,
  );
  assert.equal(
    isScrollNearBottom({ scrollHeight: 1200, scrollTop: 650, clientHeight: 500 }),
    true,
  );
  assert.equal(
    isScrollNearBottom({ scrollHeight: 1200, scrollTop: 400, clientHeight: 500 }),
    false,
  );
});

test("sliceVisibleMessages returns latest window and reports remaining older messages", () => {
  const msgs = Array.from({ length: 65 }, (_, i) => makeMsg(`m_${i}`, "u1", 1000 + i));
  const initial = sliceVisibleMessages(msgs, 40);
  assert.equal(initial.visibleMessages.length, 40);
  assert.equal(initial.visibleMessages[0].id, "m_25");
  assert.equal(initial.hasOlderMessages, true);
  assert.equal(initial.olderMessagesCount, 25);

  const allLoaded = sliceVisibleMessages(msgs, 70);
  assert.equal(allLoaded.visibleMessages.length, 65);
  assert.equal(allLoaded.hasOlderMessages, false);
  assert.equal(allLoaded.olderMessagesCount, 0);
});

test("classifyMessageListTransition distinguishes prepended older history from appended messages", () => {
  const m1 = makeMsg("m1", "u1", 100);
  const m2 = makeMsg("m2", "u1", 200);
  const m3 = makeMsg("m3", "u2", 300);

  assert.equal(classifyMessageListTransition(null, null, 0, [m2, m3]), "initial");
  assert.equal(classifyMessageListTransition("m2", "m3", 2, [m1, m2, m3]), "prepended");
  assert.equal(classifyMessageListTransition("m1", "m2", 2, [m1, m2, m3]), "appended");
  assert.equal(classifyMessageListTransition("m1", "m3", 3, [m1, m2, m3]), "unchanged");
  assert.equal(classifyMessageListTransition("m1", "m3", 3, []), "empty");
});

