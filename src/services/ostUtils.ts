export interface PlaybackState {
  id?: string;
  room_id: string;
  track_url: string | null;
  started_at: string | null;
  is_playing: boolean;
  paused_position: number;
  volume: number;
  loop: boolean;
  updated_at?: string;
}

export interface ClockSample {
  offsetMs: number;
  rttMs: number;
}

export type OstHealthStatus =
  | "idle"
  | "loading"
  | "playing"
  | "buffering"
  | "paused"
  | "error";

export function normalizeTrackUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, typeof window !== "undefined" ? window.location.origin : "http://localhost").href;
  } catch {
    return raw;
  }
}

export function selectBestClockOffset(samples: ClockSample[]): number {
  const valid = samples.filter(
    (s) => Number.isFinite(s.offsetMs) && Number.isFinite(s.rttMs) && s.rttMs >= 0,
  );
  if (valid.length === 0) return 0;
  const sorted = [...valid].sort((a, b) => a.rttMs - b.rttMs);
  if (sorted.length >= 2 && sorted[1].rttMs - sorted[0].rttMs <= 40) {
    return (sorted[0].offsetMs + sorted[1].offsetMs) / 2;
  }
  return sorted[0].offsetMs;
}

export function computeSynchronizedPosition(params: {
  state: PlaybackState;
  serverNowMs: number;
  durationSeconds?: number;
}): number {
  const { state, serverNowMs, durationSeconds = 0 } = params;
  if (!state.is_playing || !state.started_at) {
    return Math.max(0, state.paused_position || 0);
  }

  const startedAtMs = new Date(state.started_at).getTime();
  if (!Number.isFinite(startedAtMs)) {
    return Math.max(0, state.paused_position || 0);
  }

  let elapsedSeconds = (serverNowMs - startedAtMs) / 1000;
  if (elapsedSeconds < 0) elapsedSeconds = 0;

  if (durationSeconds > 0 && Number.isFinite(durationSeconds)) {
    if (state.loop) {
      return elapsedSeconds % durationSeconds;
    }
    return Math.min(durationSeconds, elapsedSeconds);
  }

  return elapsedSeconds;
}

export function computeSignedDrift(params: {
  currentTime: number;
  targetTime: number;
  durationSeconds?: number;
  loop?: boolean;
}): number {
  const { currentTime, targetTime, durationSeconds = 0, loop = false } = params;
  if (!Number.isFinite(currentTime) || !Number.isFinite(targetTime)) return 0;

  let diff = targetTime - currentTime;

  if (loop && durationSeconds > 0 && Number.isFinite(durationSeconds)) {
    const half = durationSeconds / 2;
    while (diff > half) diff -= durationSeconds;
    while (diff < -half) diff += durationSeconds;
  }

  return diff;
}

export interface DriftCorrectionDecision {
  action: "none" | "rate" | "seek";
  playbackRate: number;
}

export function decideDriftCorrection(params: {
  signedDrift: number;
  isBuffering: boolean;
  isSeeking: boolean;
  lastHardSeekAtMs: number;
  nowMs: number;
  softRateThresholdSec?: number;
  hardSeekThresholdSec?: number;
  seekCooldownMs?: number;
}): DriftCorrectionDecision {
  const {
    signedDrift,
    isBuffering,
    isSeeking,
    lastHardSeekAtMs,
    nowMs,
    softRateThresholdSec = 0.35,
    hardSeekThresholdSec = 2.5,
    seekCooldownMs = 3000,
  } = params;

  if (isBuffering || isSeeking || !Number.isFinite(signedDrift)) {
    return { action: "none", playbackRate: 1.0 };
  }

  const absDrift = Math.abs(signedDrift);
  if (absDrift <= softRateThresholdSec) {
    return { action: "none", playbackRate: 1.0 };
  }

  if (absDrift > hardSeekThresholdSec && nowMs - lastHardSeekAtMs >= seekCooldownMs) {
    return { action: "seek", playbackRate: 1.0 };
  }

  // Ajuste suave de velocidade evita cortes, re-buffering e "pulos para trás"
  return {
    action: "rate",
    playbackRate: signedDrift > 0 ? 1.04 : 0.96,
  };
}

export function arePlaybackStatesEqual(
  a: PlaybackState | null,
  b: PlaybackState | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.room_id === b.room_id &&
    normalizeTrackUrl(a.track_url) === normalizeTrackUrl(b.track_url) &&
    Boolean(a.is_playing) === Boolean(b.is_playing) &&
    (a.started_at || null) === (b.started_at || null) &&
    Math.abs((a.paused_position || 0) - (b.paused_position || 0)) < 0.05 &&
    Math.abs((a.volume ?? 1) - (b.volume ?? 1)) < 0.005 &&
    Boolean(a.loop) === Boolean(b.loop)
  );
}

export function isStalePlaybackState(
  current: PlaybackState | null,
  incoming: PlaybackState,
): boolean {
  if (!current) return false;
  if (arePlaybackStatesEqual(current, incoming)) return true;

  if (current.updated_at && incoming.updated_at) {
    const currMs = new Date(current.updated_at).getTime();
    const incMs = new Date(incoming.updated_at).getTime();
    if (Number.isFinite(currMs) && Number.isFinite(incMs) && incMs < currMs) {
      return true;
    }
  }

  return false;
}

export type FadeDurationSeconds = 0 | 2 | 5 | 10;
export const FADE_DURATION_CYCLE: readonly FadeDurationSeconds[] = [0, 2, 5, 10];

export type FadeDirection = "in" | "out";
export type FadeFinishAction = "none" | "pause" | "stop";

export interface ActiveVolumeFade {
  direction: FadeDirection;
  fromVolume: number;
  targetVolume: number;
  startedAtMs: number;
  durationMs: number;
  finishAction: FadeFinishAction;
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function normalizeFadeDuration(value: unknown): FadeDurationSeconds {
  const num = typeof value === "string" ? Number(value) : value;
  if (num === 2 || num === 5 || num === 10) return num;
  return 0;
}

export function getNextFadeDuration(
  current: FadeDurationSeconds,
): FadeDurationSeconds {
  const idx = FADE_DURATION_CYCLE.indexOf(current);
  if (idx === -1) return FADE_DURATION_CYCLE[0];
  return FADE_DURATION_CYCLE[(idx + 1) % FADE_DURATION_CYCLE.length];
}

/**
 * Avalia linearmente o volume atual com base no tempo decorrido (independente de FPS).
 */
export function evaluateVolumeFade(
  fade: ActiveVolumeFade,
  nowMs: number,
): { volume: number; completed: boolean } {
  const target = clampVolume(fade.targetVolume);
  const from = clampVolume(fade.fromVolume);

  if (fade.durationMs <= 0) {
    return { volume: target, completed: true };
  }

  const elapsedMs = Math.max(0, nowMs - fade.startedAtMs);
  const progress = Math.min(1, elapsedMs / fade.durationMs);
  const volume = clampVolume(from + (target - from) * progress);

  return {
    volume,
    completed: progress >= 1,
  };
}

export function createVolumeFade(params: {
  direction: FadeDirection;
  currentVolume: number;
  targetVolume: number;
  durationSeconds: FadeDurationSeconds;
  nowMs: number;
  finishAction?: FadeFinishAction;
}): ActiveVolumeFade {
  const {
    direction,
    currentVolume,
    targetVolume,
    durationSeconds,
    nowMs,
    finishAction = "none",
  } = params;

  return {
    direction,
    fromVolume: clampVolume(currentVolume),
    targetVolume: direction === "out" ? 0 : clampVolume(targetVolume),
    startedAtMs: nowMs,
    durationMs: Math.max(0, durationSeconds * 1000),
    finishAction,
  };
}

/**
 * Atualiza o volume alvo durante um fade in em andamento partindo exatamente
 * do volume interpolado no instante atual (sem saltos bruscos).
 */
export function updateVolumeFadeTarget(
  fade: ActiveVolumeFade,
  newTimelineTarget: number,
  nowMs: number,
): ActiveVolumeFade {
  if (fade.direction === "out") {
    return fade;
  }

  const { volume: currentVolume } = evaluateVolumeFade(fade, nowMs);
  const elapsedMs = Math.max(0, nowMs - fade.startedAtMs);
  const remainingMs = Math.max(16, fade.durationMs - elapsedMs);

  return {
    ...fade,
    fromVolume: currentVolume,
    targetVolume: clampVolume(newTimelineTarget),
    startedAtMs: nowMs,
    durationMs: remainingMs,
  };
}

