import test from "node:test";
import assert from "node:assert/strict";
import {
  PAUSE_HEARTBEAT_TTL_MS,
  POLL_MAX_DURATION_SEC,
  POLL_MIN_DURATION_SEC,
  canMasterControlPause,
  clampPollDurationSeconds,
  computePollResults,
  formatCountdownMMSS,
  getPauseFallbackRecordId,
  getPollFallbackRecordId,
  getPollRemainingSeconds,
  getPollVoteFallbackRecordId,
  hashMasterSessionToken,
  isPauseEffectivelyActive,
  isPollClosed,
  mergePollVoteList,
  normalizeSessionPauseState,
  normalizeSessionPoll,
  validateCreatePollInput,
  validatePauseInput,
} from "./sessionUtilities";
import { isSystemRecordId } from "./handoutsLogic";
import type { PollVoteRecord, SessionPoll } from "../types/sessionUtilities";

test("system record IDs for pause and polls are excluded from player lists", () => {
  assert.equal(isSystemRecordId(getPauseFallbackRecordId("default-table")), true);
  assert.equal(isSystemRecordId(getPollFallbackRecordId("mesa-alpha")), true);
  assert.equal(
    isSystemRecordId(getPollVoteFallbackRecordId("pl_abc123", "player_001")),
    true,
  );
  assert.equal(isSystemRecordId("player_abc123"), false);
  // Ensure fallback IDs respect players_id_length_safe_chk (<= 128 chars)
  const longVoteId = getPollVoteFallbackRecordId(
    "pl_" + "x".repeat(60),
    "player_" + "y".repeat(80),
  );
  assert.ok(longVoteId.length <= 128, `Expected <= 128 chars, got ${longVoteId.length}`);
});

test("validatePauseInput requires a non-empty message and sanitizes permissions", () => {
  const empty = validatePauseInput({
    message: "   ",
    allowedSettings: { audio: true, notifications: false, visual: false },
    allowedMinigames: ["timing"],
  });
  assert.equal(empty.ok, false);

  const valid = validatePauseInput({
    message: "  O mestre foi cagar.  ",
    allowedSettings: { audio: true, notifications: true, visual: false },
    allowedMinigames: ["timing", "aim", "timing", "invalid" as any],
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.clean.message, "O mestre foi cagar.");
    assert.deepEqual(valid.clean.allowedMinigames, ["timing", "aim"]);
    assert.deepEqual(valid.clean.allowedSettings, {
      audio: true,
      notifications: true,
      visual: false,
    });
  }
});

test("pause session isolation, master ownership, and heartbeat expiration", () => {
  const now = 1_700_000_000_000;
  const raw = {
    roomId: "mesa-1",
    masterId: "master-A",
    masterSessionHash: "hash_A_1234567890abcdef",
    isActive: true,
    message: "Intervalo de 5 minutos",
    allowedSettings: { audio: true, notifications: false, visual: false },
    allowedMinigames: ["timing"],
    activatedAt: now - 5_000,
    heartbeatAt: now - 5_000,
    updatedAt: now - 5_000,
  };

  // Room isolation: mesa-2 must ignore mesa-1 pause
  assert.equal(normalizeSessionPauseState(raw, "mesa-2"), null);
  const pause = normalizeSessionPauseState(raw, "mesa-1");
  assert.ok(pause);
  assert.equal(isPauseEffectivelyActive(pause, now), true);

  // Responsible Master can control; another Master cannot while heartbeat is live
  assert.equal(
    canMasterControlPause(pause, "master-A", "hash_A_1234567890abcdef", now),
    true,
  );
  assert.equal(
    canMasterControlPause(pause, "master-B", "hash_B_1234567890abcdef", now),
    false,
  );

  // After heartbeat TTL expires (Master disconnected), pause auto-releases
  const afterTimeout = now + PAUSE_HEARTBEAT_TTL_MS + 1_000;
  assert.equal(isPauseEffectivelyActive(pause, afterTimeout), false);
  assert.equal(
    canMasterControlPause(pause, "master-B", "hash_B_1234567890abcdef", afterTimeout),
    true,
  );
});

test("validateCreatePollInput enforces question, 2..8 options, and clamped duration", () => {
  assert.equal(
    validateCreatePollInput({
      question: "",
      options: ["A", "B"],
      durationSeconds: 60,
    }).ok,
    false,
  );

  assert.equal(
    validateCreatePollInput({
      question: "Qual caminho?",
      options: ["Apenas uma", "   "],
      durationSeconds: 60,
    }).ok,
    false,
  );

  assert.equal(
    validateCreatePollInput({
      question: "Muitas opções",
      options: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      durationSeconds: 60,
    }).ok,
    false,
  );

  const valid = validateCreatePollInput({
    question: "Qual será o próximo destino?",
    options: ["Igreja abandonada", "Hospital", "Floresta"],
    durationSeconds: 99999,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.clean.options.length, 3);
    assert.equal(valid.clean.durationSeconds, POLL_MAX_DURATION_SEC);
  }

  assert.equal(clampPollDurationSeconds(3), POLL_MIN_DURATION_SEC);
});

test("computePollResults handles 0 votes, exact percentages, 3-way ties, and duplicate votes", () => {
  const now = 1_700_000_000_000;
  const poll: SessionPoll = {
    id: "pl_dest_1",
    roomId: "mesa-1",
    masterId: "master-A",
    masterSessionHash: "hash_A_1234567890abcdef",
    question: "Qual será o próximo destino?",
    options: [
      { id: "opt_1", label: "Igreja abandonada" },
      { id: "opt_2", label: "Hospital" },
      { id: "opt_3", label: "Floresta" },
    ],
    durationSeconds: 120,
    status: "active",
    startedAt: now,
    endsAt: now + 120_000,
    closedAt: null,
    updatedAt: now,
  };

  // 0 votes: no division by zero
  const emptyRes = computePollResults(poll, [], "p1");
  assert.equal(emptyRes.totalVotes, 0);
  assert.equal(emptyRes.userVotedOptionId, null);
  assert.deepEqual(
    emptyRes.options.map((o) => o.percentage),
    [0, 0, 0],
  );

  // User prompt example: 6 / 3 / 1 => 60% / 30% / 10%, total 10
  const votes: PollVoteRecord[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      pollId: poll.id,
      roomId: "mesa-1",
      voterId: `v_ig_${i}`,
      optionId: "opt_1",
      createdAt: now + i,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      pollId: poll.id,
      roomId: "mesa-1",
      voterId: `v_ho_${i}`,
      optionId: "opt_2",
      createdAt: now + 10 + i,
    })),
    {
      pollId: poll.id,
      roomId: "mesa-1",
      voterId: "v_fl_0",
      optionId: "opt_3",
      createdAt: now + 20,
    },
    // Duplicate voter attempt (should be ignored; original vote kept)
    {
      pollId: poll.id,
      roomId: "mesa-1",
      voterId: "v_fl_0",
      optionId: "opt_1",
      createdAt: now + 50,
    },
    // Invalid option ID (should be ignored)
    {
      pollId: poll.id,
      roomId: "mesa-1",
      voterId: "v_bad_opt",
      optionId: "opt_999",
      createdAt: now + 60,
    },
    // Wrong room vote (should be ignored)
    {
      pollId: poll.id,
      roomId: "mesa-outra",
      voterId: "v_other_room",
      optionId: "opt_1",
      createdAt: now + 70,
    },
  ];

  const res = computePollResults(poll, votes, "v_fl_0");
  assert.equal(res.totalVotes, 10);
  assert.equal(res.userVotedOptionId, "opt_3");
  assert.deepEqual(
    res.options.map((o) => ({ votes: o.votes, pct: o.percentage })),
    [
      { votes: 6, pct: 60 },
      { votes: 3, pct: 30 },
      { votes: 1, pct: 10 },
    ],
  );

  // 3-way tie (1/1/1) must sum to 100% cleanly via Largest Remainder
  const tieVotes: PollVoteRecord[] = [
    { pollId: poll.id, roomId: "mesa-1", voterId: "a", optionId: "opt_1", createdAt: now + 1 },
    { pollId: poll.id, roomId: "mesa-1", voterId: "b", optionId: "opt_2", createdAt: now + 2 },
    { pollId: poll.id, roomId: "mesa-1", voterId: "c", optionId: "opt_3", createdAt: now + 3 },
  ];
  const tieRes = computePollResults(poll, tieVotes);
  assert.equal(
    tieRes.options.reduce((s, o) => s + o.percentage, 0),
    100,
  );
});

test("poll expiration, countdown formatting, vote list deduplication, and token hashing", async () => {
  const now = 1_700_000_000_000;
  const poll = normalizeSessionPoll(
    {
      id: "pl_1",
      roomId: "mesa-1",
      masterId: "m1",
      question: "Abrir a porta?",
      options: [
        { id: "opt_1", label: "Sim" },
        { id: "opt_2", label: "Não" },
      ],
      durationSeconds: 90,
      status: "active",
      startedAt: now,
      endsAt: now + 90_000,
    },
    "mesa-1",
  );
  assert.ok(poll);
  assert.equal(isPollClosed(poll, now + 30_000), false);
  assert.equal(getPollRemainingSeconds(poll, now + 30_000), 60);
  assert.equal(formatCountdownMMSS(65), "01:05");
  assert.equal(isPollClosed(poll, now + 90_000), true);
  assert.equal(getPollRemainingSeconds(poll, now + 90_000), 0);
  assert.equal(normalizeSessionPoll(poll, "mesa-2"), null);

  const v1: PollVoteRecord = {
    pollId: "pl_1",
    roomId: "mesa-1",
    voterId: "u1",
    optionId: "opt_1",
    createdAt: now + 1,
  };
  const list1 = mergePollVoteList([], v1);
  const list2 = mergePollVoteList(list1, { ...v1, optionId: "opt_2" });
  assert.equal(list2.length, 1);
  assert.equal(list2[0].optionId, "opt_1");

  const hash1 = await hashMasterSessionToken("token_secret_1234567890");
  const hash2 = await hashMasterSessionToken("token_secret_1234567890");
  assert.equal(hash1, hash2);
  assert.ok(hash1.length >= 32);
});
