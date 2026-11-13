import {
  DIFFICULTY_PRESETS,
  MINIGAME_META,
  MinigameConfig,
  MinigameDifficulty,
  MinigameResultPayload,
  MinigameType,
} from "../types/minigames";

export const MINIGAME_ASSIGN_PREFIX = "MINIGAME_ASSIGN_";
export const MINIGAME_RESULTS_RECORD_ID = "MINIGAME_RESULTS";

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeMinigameConfig(
  raw: Partial<MinigameConfig> | null | undefined
): MinigameConfig {
  const validTypes: MinigameType[] = ["timing", "lockpick", "emf", "aim"];
  const validDiffs: MinigameDifficulty[] = [
    "facil",
    "normal",
    "dificil",
    "pesadelo",
    "custom",
  ];
  const type = validTypes.includes(raw?.type as MinigameType)
    ? (raw?.type as MinigameType)
    : "timing";
  const difficulty = validDiffs.includes(raw?.difficulty as MinigameDifficulty)
    ? (raw?.difficulty as MinigameDifficulty)
    : "normal";

  return {
    type,
    difficulty,
    rounds: Math.round(clampNumber(Number(raw?.rounds ?? 5), 1, 12)),
    speed: Math.round(clampNumber(Number(raw?.speed ?? 5), 1, 10)),
    maxErrors: Math.round(clampNumber(Number(raw?.maxErrors ?? 3), 1, 10)),
  };
}

export function applyDifficultyPreset(
  type: MinigameType,
  difficulty: Exclude<MinigameDifficulty, "custom">
): MinigameConfig {
  const preset = DIFFICULTY_PRESETS[difficulty];
  return {
    type,
    difficulty,
    rounds: preset.rounds,
    speed: preset.speed,
    maxErrors: preset.maxErrors,
  };
}

/** Normalizes any angle in degrees into [0, 360). */
export function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/** Shortest signed or unsigned angular distance on a circle [0, 180]. */
export function angularDistance(aDeg: number, bDeg: number): number {
  const diff = Math.abs(normalizeAngle(aDeg) - normalizeAngle(bDeg));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Checks whether a pointer angle (degrees) falls inside a target arc
 * defined by its start angle and clockwise span width (both in degrees).
 */
export function isAngleInTargetArc(
  pointerDeg: number,
  arcStartDeg: number,
  arcSpanDeg: number
): boolean {
  if (arcSpanDeg <= 0) return false;
  if (arcSpanDeg >= 360) return true;
  const p = normalizeAngle(pointerDeg);
  const start = normalizeAngle(arcStartDeg);
  const delta = normalizeAngle(p - start);
  return delta <= arcSpanDeg;
}

/**
 * Computes the Timing minigame target zone arc width (degrees) for the current round
 * and hit count, narrowing slightly with each hit and higher speed.
 */
export function getTimingZoneSpanDeg(
  speed: number,
  hitsSoFar: number,
  totalRounds: number
): number {
  const base = 74 - clampNumber(speed, 1, 10) * 4.2; // speed 1 => ~70deg, speed 10 => ~32deg
  const progress = totalRounds > 1 ? clampNumber(hitsSoFar / totalRounds, 0, 1) : 0;
  const narrowed = base * (1 - progress * 0.34);
  return clampNumber(Math.round(narrowed), 18, 80);
}

/** Picks a new timing target arc start angle well separated from the previous center. */
export function pickNextTimingArcStart(
  prevStartDeg: number,
  prevSpanDeg: number,
  nextSpanDeg: number,
  randomFn: () => number = Math.random
): number {
  const prevCenter = normalizeAngle(prevStartDeg + prevSpanDeg / 2);
  const offset = 110 + randomFn() * 140; // [110, 250] deg away
  const nextCenter = normalizeAngle(prevCenter + offset);
  return normalizeAngle(nextCenter - nextSpanDeg / 2);
}

/** Checks whether a lockpick position [0..100] is inside [zoneCenter - halfWidth, zoneCenter + halfWidth]. */
export function isLockpickAligned(
  position: number,
  zoneCenter: number,
  zoneWidth: number
): boolean {
  const half = Math.max(2, zoneWidth / 2);
  return Math.abs(position - zoneCenter) <= half;
}

export function getLockpickZoneWidth(speed: number): number {
  // speed 1 => 22, speed 10 => 9
  return clampNumber(Math.round(23 - clampNumber(speed, 1, 10) * 1.4), 8, 24);
}

export interface EmfStepInput {
  needle: number;       // [0..100]
  velocity: number;     // units per second
  holding: boolean;
  dt: number;           // seconds (clamped)
  speed: number;        // 1..10
  bandCenter: number;   // [20..80]
  bandHalfWidth: number;// [8..18]
  progress: number;     // [0..1]
  overload: number;     // [0..1]
  elapsed: number;      // seconds
}

export interface EmfStepOutput {
  needle: number;
  velocity: number;
  inBand: boolean;
  progress: number;
  overload: number;
  roundCleared: boolean;
  overloaded: boolean;
}

export function getEmfBandHalfWidth(speed: number): number {
  // speed 1 => 17, speed 10 => 8
  return clampNumber(Math.round(18 - clampNumber(speed, 1, 10)), 8, 18);
}

export function stepEmfSimulation(input: EmfStepInput): EmfStepOutput {
  const dt = clampNumber(input.dt, 0, 0.05);
  const spd = clampNumber(input.speed, 1, 10);

  const riseAccel = 115 + spd * 18;
  const gravityAccel = 95 + spd * 14;
  // Subtle harmonic paranormal interference so the player has to actively Feather/Hold
  const interference = Math.sin(input.elapsed * (2.2 + spd * 0.45)) * (8 + spd * 2.4);

  let nextVel = input.velocity + (input.holding ? riseAccel : -gravityAccel) * dt + interference * dt;
  nextVel = clampNumber(nextVel, -110, 110);

  let nextNeedle = input.needle + nextVel * dt;
  if (nextNeedle <= 0) {
    nextNeedle = 0;
    nextVel = Math.max(0, nextVel * -0.2);
  } else if (nextNeedle >= 100) {
    nextNeedle = 100;
    nextVel = Math.min(0, nextVel * -0.2);
  }

  const inBand = Math.abs(nextNeedle - input.bandCenter) <= input.bandHalfWidth;

  const fillRate = 0.48 - spd * 0.015; // ~2.1s..3.0s inside green band clears 1 round
  const decayRate = 0.12;
  const overloadRise = nextNeedle <= 3 || nextNeedle >= 97 ? 0.50 : 0.24 + spd * 0.02;
  const overloadCool = 0.42;

  let nextProgress = inBand
    ? input.progress + fillRate * dt
    : Math.max(0, input.progress - decayRate * dt);

  let nextOverload = inBand
    ? Math.max(0, input.overload - overloadCool * dt)
    : input.overload + overloadRise * dt;

  const roundCleared = nextProgress >= 1;
  const overloaded = nextOverload >= 1;

  if (roundCleared) nextProgress = 0;
  if (overloaded) {
    nextOverload = 0;
    nextNeedle = 50;
    nextVel = 0;
  }

  return {
    needle: nextNeedle,
    velocity: nextVel,
    inBand,
    progress: clampNumber(nextProgress, 0, 1),
    overload: clampNumber(nextOverload, 0, 1),
    roundCleared,
    overloaded,
  };
}

export function isPointInsideCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

export function formatMinigameResultSummary(result: MinigameResultPayload): string {
  const meta = MINIGAME_META[result.minigameType];
  const label = meta ? meta.label : result.minigameType;
  return `${result.playerName}: ${result.hits}/${result.totalRounds} acertos (${label})`;
}
