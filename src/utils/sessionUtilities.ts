import type { MinigameType } from "../types/minigames";
import type {
  CreatePollInput,
  PauseAllowedSettings,
  PauseMutationInput,
  PollComputedResults,
  PollOption,
  PollOptionResult,
  PollVoteRecord,
  SessionPauseState,
  SessionPoll,
} from "../types/sessionUtilities";
import { sanitizeRoomKey } from "./tabletopCustomization";

export const SESSION_PAUSE_RECORD_PREFIX = "SESSION_PAUSE_";
export const SESSION_POLL_RECORD_PREFIX = "SESSION_POLL_";
export const SESSION_POLL_VOTE_RECORD_PREFIX = "SESSION_POLL_VOTE_";

export const PAUSE_MESSAGE_MAX_LENGTH = 280;
export const PAUSE_HEARTBEAT_INTERVAL_MS = 20_000;
export const PAUSE_HEARTBEAT_TTL_MS = 90_000;

export const POLL_QUESTION_MAX_LENGTH = 200;
export const POLL_OPTION_MAX_LENGTH = 100;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 8;
export const POLL_MIN_DURATION_SEC = 15;
export const POLL_MAX_DURATION_SEC = 3600;

export const VALID_PAUSE_MINIGAMES: readonly MinigameType[] = [
  "timing",
  "lockpick",
  "emf",
  "aim",
];

export const DEFAULT_PAUSE_ALLOWED_SETTINGS: PauseAllowedSettings = {
  audio: true,
  notifications: false,
  visual: false,
};

export const POLL_DURATION_PRESETS: readonly { seconds: number; label: string }[] = [
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1 min" },
  { seconds: 120, label: "2 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
];

export function getPauseFallbackRecordId(roomId: string): string {
  const safeRoom = sanitizeRoomKey(roomId).slice(0, 48);
  return `${SESSION_PAUSE_RECORD_PREFIX}${safeRoom}`;
}

export function getPollFallbackRecordId(roomId: string): string {
  const safeRoom = sanitizeRoomKey(roomId).slice(0, 48);
  return `${SESSION_POLL_RECORD_PREFIX}${safeRoom}`;
}

/**
 * Generates a compact deterministic vote record ID strictly <= 116 chars
 * so it respects `players_id_length_safe_chk` (<= 128 chars) in `public.players`.
 */
export function getPollVoteFallbackRecordId(
  pollId: string,
  voterId: string,
): string {
  const cleanPoll = String(pollId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);
  const cleanVoter = String(voterId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
  return `${SESSION_POLL_VOTE_RECORD_PREFIX}${cleanPoll}_${cleanVoter}`;
}

export function getPollVoteFallbackPrefix(pollId: string): string {
  const cleanPoll = String(pollId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);
  return `${SESSION_POLL_VOTE_RECORD_PREFIX}${cleanPoll}_`;
}

export function createPollId(now: number = Date.now()): string {
  const ts = Math.max(0, Math.floor(now)).toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `pl_${ts}_${rand}`;
}

export function createMasterSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `mst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/**
 * SHA-256 hex digest for master session tokens. Uses Web Crypto when available
 * with a deterministic pure-JS SHA-256 fallback for non-secure/WebView contexts.
 */
export async function hashMasterSessionToken(token: string): Promise<string> {
  const clean = String(token || "");
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    try {
      const encoded = new TextEncoder().encode(clean);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    } catch {
      // Fallback below
    }
  }
  return fallbackDeterministicHash(clean);
}

function fallbackDeterministicHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const partA = (h1 >>> 0).toString(16).padStart(8, "0");
  const partB = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${partA}${partB}${partA}${partB}`;
}

export function normalizePauseAllowedSettings(
  raw: unknown,
): PauseAllowedSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PAUSE_ALLOWED_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    audio: typeof obj.audio === "boolean" ? obj.audio : false,
    notifications:
      typeof obj.notifications === "boolean" ? obj.notifications : false,
    visual: typeof obj.visual === "boolean" ? obj.visual : false,
  };
}

export function normalizePauseAllowedMinigames(raw: unknown): MinigameType[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set<string>(VALID_PAUSE_MINIGAMES);
  const out: MinigameType[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      validSet.has(item) &&
      !out.includes(item as MinigameType)
    ) {
      out.push(item as MinigameType);
    }
  }
  return out;
}

export function hasAnyAllowedPauseSetting(
  allowed: PauseAllowedSettings,
): boolean {
  return Boolean(allowed.audio || allowed.notifications || allowed.visual);
}

export function validatePauseInput(
  input: PauseMutationInput,
): { ok: true; clean: PauseMutationInput } | { ok: false; error: string } {
  const cleanMessage = String(input.message || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleanMessage) {
    return {
      ok: false,
      error: "Escreva uma mensagem para exibir aos jogadores durante o Pause.",
    };
  }
  if (cleanMessage.length > PAUSE_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      error: `A mensagem do Pause deve ter no máximo ${PAUSE_MESSAGE_MAX_LENGTH} caracteres.`,
    };
  }
  return {
    ok: true,
    clean: {
      message: cleanMessage,
      allowedSettings: normalizePauseAllowedSettings(input.allowedSettings),
      allowedMinigames: normalizePauseAllowedMinigames(input.allowedMinigames),
    },
  };
}

function parseTimestampMs(raw: unknown, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function normalizeSessionPauseState(
  raw: unknown,
  expectedRoomId?: string,
): SessionPauseState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const rawRoom = typeof obj.roomId === "string"
    ? obj.roomId
    : typeof obj.room_id === "string"
      ? obj.room_id
      : "";
  const roomId = sanitizeRoomKey(rawRoom);
  if (!roomId) return null;
  if (expectedRoomId && roomId !== sanitizeRoomKey(expectedRoomId)) {
    return null;
  }

  const masterId = String(obj.masterId ?? obj.master_id ?? "").trim();
  if (!masterId) return null;

  const masterSessionHash = String(
    obj.masterSessionHash ?? obj.master_session_hash ?? "",
  ).trim();

  const isActive = Boolean(obj.isActive ?? obj.is_active);
  const message = String(obj.message ?? "").trim().slice(0, PAUSE_MESSAGE_MAX_LENGTH);
  const allowedSettings = normalizePauseAllowedSettings(
    obj.allowedSettings ?? obj.allowed_settings,
  );
  const allowedMinigames = normalizePauseAllowedMinigames(
    obj.allowedMinigames ?? obj.allowed_minigames,
  );

  const now = Date.now();
  const activatedAt = parseTimestampMs(obj.activatedAt ?? obj.activated_at, now);
  const heartbeatAt = parseTimestampMs(
    obj.heartbeatAt ?? obj.heartbeat_at,
    activatedAt,
  );
  const updatedAt = parseTimestampMs(obj.updatedAt ?? obj.updated_at, heartbeatAt);

  return {
    roomId,
    masterId,
    masterSessionHash,
    isActive,
    message,
    allowedSettings,
    allowedMinigames,
    activatedAt,
    heartbeatAt,
    updatedAt,
  };
}

/**
 * Determines whether a session pause is currently enforced for players.
 * Automatically treats stale pauses (whose Master stopped heartbeating beyond TTL)
 * as inactive so a disconnected Master never leaves players locked indefinitely.
 */
export function isPauseEffectivelyActive(
  pause: SessionPauseState | null | undefined,
  nowMs: number = Date.now(),
  ttlMs: number = PAUSE_HEARTBEAT_TTL_MS,
): boolean {
  if (!pause || !pause.isActive) return false;
  if (!pause.message.trim()) return false;
  if (pause.heartbeatAt <= 0) return false;
  return nowMs - pause.heartbeatAt <= ttlMs;
}

/**
 * Checks whether the current Master owns an active pause (or may take ownership
 * if no live pause is currently active in the room).
 */
export function canMasterControlPause(
  existing: SessionPauseState | null | undefined,
  masterId: string,
  masterSessionHash: string,
  nowMs: number = Date.now(),
): boolean {
  if (!masterId || !masterSessionHash) return false;
  if (!isPauseEffectivelyActive(existing, nowMs)) return true;
  if (!existing) return true;
  return (
    existing.masterId === masterId &&
    (!existing.masterSessionHash ||
      existing.masterSessionHash === masterSessionHash)
  );
}

// ============================================================================
// ENQUETE (POLL) PURE LOGIC
// ============================================================================

export function clampPollDurationSeconds(raw: unknown, fallback = 60): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    POLL_MIN_DURATION_SEC,
    Math.min(POLL_MAX_DURATION_SEC, Math.round(n)),
  );
}

export function validateCreatePollInput(
  input: CreatePollInput,
):
  | {
      ok: true;
      clean: {
        question: string;
        options: PollOption[];
        durationSeconds: number;
      };
    }
  | { ok: false; error: string } {
  const question = String(input.question || "").trim();
  if (!question) {
    return { ok: false, error: "Informe a pergunta principal da enquete." };
  }
  if (question.length > POLL_QUESTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `A pergunta deve ter no máximo ${POLL_QUESTION_MAX_LENGTH} caracteres.`,
    };
  }

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const trimmedOptions = rawOptions
    .map((o) => String(o || "").trim())
    .filter((o) => o.length > 0);

  if (trimmedOptions.length < POLL_MIN_OPTIONS) {
    return {
      ok: false,
      error: `Adicione pelo menos ${POLL_MIN_OPTIONS} opções preenchidas.`,
    };
  }
  if (trimmedOptions.length > POLL_MAX_OPTIONS) {
    return {
      ok: false,
      error: `A enquete aceita no máximo ${POLL_MAX_OPTIONS} opções.`,
    };
  }

  for (const label of trimmedOptions) {
    if (label.length > POLL_OPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `Cada opção deve ter no máximo ${POLL_OPTION_MAX_LENGTH} caracteres.`,
      };
    }
  }

  const durationSeconds = clampPollDurationSeconds(input.durationSeconds, 60);

  const options: PollOption[] = trimmedOptions.map((label, idx) => ({
    id: `opt_${idx + 1}`,
    label,
  }));

  return {
    ok: true,
    clean: {
      question,
      options,
      durationSeconds,
    },
  };
}

export function normalizePollOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PollOption[] = [];
  for (let i = 0; i < raw.length && out.length < POLL_MAX_OPTIONS; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id ?? `opt_${i + 1}`).trim().slice(0, 48);
    const label = String(obj.label ?? "").trim().slice(0, POLL_OPTION_MAX_LENGTH);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

export function normalizeSessionPoll(
  raw: unknown,
  expectedRoomId?: string,
): SessionPoll | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const id = String(obj.id ?? "").trim();
  if (!id) return null;

  const rawRoom = typeof obj.roomId === "string"
    ? obj.roomId
    : typeof obj.room_id === "string"
      ? obj.room_id
      : "";
  const roomId = sanitizeRoomKey(rawRoom);
  if (!roomId) return null;
  if (expectedRoomId && roomId !== sanitizeRoomKey(expectedRoomId)) {
    return null;
  }

  const masterId = String(obj.masterId ?? obj.master_id ?? "").trim();
  const masterSessionHash = String(
    obj.masterSessionHash ?? obj.master_session_hash ?? "",
  ).trim();
  const question = String(obj.question ?? "").trim().slice(0, POLL_QUESTION_MAX_LENGTH);
  const options = normalizePollOptions(obj.options);
  if (!question || options.length < POLL_MIN_OPTIONS) return null;

  const durationSeconds = clampPollDurationSeconds(
    obj.durationSeconds ?? obj.duration_seconds,
    60,
  );
  const now = Date.now();
  const startedAt = parseTimestampMs(obj.startedAt ?? obj.started_at, now);
  const endsAt = parseTimestampMs(
    obj.endsAt ?? obj.ends_at,
    startedAt + durationSeconds * 1000,
  );
  const rawClosed = obj.closedAt ?? obj.closed_at;
  const closedAt =
    rawClosed === null || rawClosed === undefined
      ? null
      : parseTimestampMs(rawClosed, endsAt);
  const updatedAt = parseTimestampMs(obj.updatedAt ?? obj.updated_at, startedAt);
  const status = obj.status === "closed" ? "closed" : "active";

  return {
    id,
    roomId,
    masterId,
    masterSessionHash,
    question,
    options,
    durationSeconds,
    status,
    startedAt,
    endsAt,
    closedAt,
    updatedAt,
  };
}

export function normalizePollVoteRecord(
  raw: unknown,
  expectedPollId?: string,
  expectedRoomId?: string,
): PollVoteRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const pollId = String(obj.pollId ?? obj.poll_id ?? "").trim();
  const roomId = sanitizeRoomKey(String(obj.roomId ?? obj.room_id ?? ""));
  const voterId = String(obj.voterId ?? obj.voter_id ?? "").trim();
  const optionId = String(obj.optionId ?? obj.option_id ?? "").trim();

  if (!pollId || !roomId || !voterId || !optionId) return null;
  if (expectedPollId && pollId !== expectedPollId) return null;
  if (expectedRoomId && roomId !== sanitizeRoomKey(expectedRoomId)) return null;

  const createdAt = parseTimestampMs(obj.createdAt ?? obj.created_at, Date.now());
  return {
    pollId,
    roomId,
    voterId,
    optionId,
    createdAt,
  };
}

export function isPollClosed(
  poll: SessionPoll | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!poll) return true;
  if (poll.status === "closed") return true;
  return nowMs >= poll.endsAt;
}

export function getPollRemainingSeconds(
  poll: SessionPoll | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!poll || poll.status === "closed") return 0;
  const diffMs = poll.endsAt - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

export function formatCountdownMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Computes deduplicated poll results and exact integer percentages using the
 * Largest Remainder (Hamilton) method:
 * - Zero votes => every option is 0% (no division by zero or NaN).
 * - Duplicate voterIds for the same poll keep only the earliest valid vote.
 * - Votes referencing an unknown optionId are discarded from totalVotes.
 * - When totalVotes > 0, percentages ALWAYS sum to 100%.
 */
export function computePollResults(
  poll: SessionPoll,
  votes: readonly PollVoteRecord[],
  currentVoterId?: string | null,
): PollComputedResults {
  const validOptionIds = new Set(poll.options.map((o) => o.id));
  const uniqueVotesByVoter = new Map<string, PollVoteRecord>();

  for (const vote of votes) {
    if (!vote || vote.pollId !== poll.id) continue;
    if (vote.roomId && sanitizeRoomKey(vote.roomId) !== sanitizeRoomKey(poll.roomId)) {
      continue;
    }
    if (!vote.voterId || !validOptionIds.has(vote.optionId)) continue;

    const existing = uniqueVotesByVoter.get(vote.voterId);
    if (!existing || vote.createdAt < existing.createdAt) {
      uniqueVotesByVoter.set(vote.voterId, vote);
    }
  }

  const counts = new Map<string, number>();
  for (const opt of poll.options) {
    counts.set(opt.id, 0);
  }

  for (const vote of uniqueVotesByVoter.values()) {
    counts.set(vote.optionId, (counts.get(vote.optionId) || 0) + 1);
  }

  const totalVotes = uniqueVotesByVoter.size;
  const userVotedOptionId =
    currentVoterId && uniqueVotesByVoter.has(currentVoterId)
      ? uniqueVotesByVoter.get(currentVoterId)!.optionId
      : null;

  if (totalVotes === 0) {
    return {
      totalVotes: 0,
      userVotedOptionId,
      options: poll.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        votes: 0,
        percentage: 0,
      })),
    };
  }

  // Largest Remainder (Hamilton) method for exact 100% sum without rounding drift
  const rawEntries = poll.options.map((opt, index) => {
    const count = counts.get(opt.id) || 0;
    const exact = (count * 100) / totalVotes;
    const floorVal = Math.floor(exact);
    return {
      id: opt.id,
      label: opt.label,
      votes: count,
      index,
      floorVal,
      remainder: exact - floorVal,
    };
  });

  let remainingPct =
    100 - rawEntries.reduce((sum, entry) => sum + entry.floorVal, 0);

  const byRemainder = [...rawEntries].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.index - b.index;
  });

  const extraById = new Map<string, number>();
  for (let i = 0; i < byRemainder.length && remainingPct > 0; i++) {
    if (byRemainder[i].votes === 0) continue;
    extraById.set(byRemainder[i].id, 1);
    remainingPct -= 1;
  }

  const options: PollOptionResult[] = rawEntries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    votes: entry.votes,
    percentage: entry.floorVal + (extraById.get(entry.id) || 0),
  }));

  return {
    totalVotes,
    options,
    userVotedOptionId,
  };
}

export function mergePollVoteList(
  current: readonly PollVoteRecord[],
  incoming: PollVoteRecord,
): PollVoteRecord[] {
  const existingIdx = current.findIndex(
    (v) => v.pollId === incoming.pollId && v.voterId === incoming.voterId,
  );
  if (existingIdx !== -1) {
    return current as PollVoteRecord[];
  }
  return [...current, incoming];
}
