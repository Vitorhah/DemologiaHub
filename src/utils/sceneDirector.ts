import {
  ClockCategory,
  ClockSegmentCount,
  CombatTurnState,
  NarrativeScene,
  PublicClockSnapshot,
  PublicSceneDirectorState,
  PublicSceneSnapshot,
  SceneDirectorMasterState,
  SceneEscalationLevel,
  SceneModeAction,
  TensionClock,
} from "../types/sceneDirector";
import { normalizeSceneBuilderNodes } from "./sceneBuilder";

export const SCENE_DIRECTOR_MASTER_RECORD_ID = "SCENE_DIRECTOR_MASTER";
export const SCENE_DIRECTOR_SHARED_RECORD_ID = "SCENE_DIRECTOR_SHARED";
export const SCENE_DIRECTOR_LOCAL_KEY = "demologia_scene_director_master_v1";

export const CLOCK_SEGMENT_OPTIONS: readonly ClockSegmentCount[] = [4, 6, 8, 12];

export const SCENE_ESCALATION_META: Record<
  SceneEscalationLevel,
  {
    label: string;
    shortLabel: string;
    borderClass: string;
    accentTextClass: string;
    bgTintClass: string;
  }
> = {
  investigacao: {
    label: "Investigação",
    shortLabel: "Nível 1 · Investigação",
    borderClass: "border-emerald-500/45",
    accentTextClass: "text-emerald-300",
    bgTintClass: "bg-emerald-950/25",
  },
  opressao: {
    label: "Opressão",
    shortLabel: "Nível 2 · Opressão",
    borderClass: "border-amber-500/50",
    accentTextClass: "text-amber-300",
    bgTintClass: "bg-amber-950/25",
  },
  ameaca: {
    label: "Ameaça",
    shortLabel: "Nível 3 · Ameaça",
    borderClass: "border-[var(--op-red)]/65",
    accentTextClass: "text-[#ff8a90]",
    bgTintClass: "bg-[#220a0e]/60",
  },
  horror: {
    label: "Horror Crítico",
    shortLabel: "Nível 4 · Horror Crítico",
    borderClass: "border-red-500/80",
    accentTextClass: "text-red-300",
    bgTintClass: "bg-[#2c080c]/75",
  },
};

export const CLOCK_CATEGORY_META: Record<
  ClockCategory,
  {
    label: string;
    fillClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  ameaca: {
    label: "Ameaça",
    fillClass: "bg-[var(--op-red-bright)]",
    textClass: "text-[#ff8a90]",
    borderClass: "border-[#8f171c]/65",
  },
  investigacao: {
    label: "Investigação",
    fillClass: "bg-emerald-500",
    textClass: "text-emerald-300",
    borderClass: "border-emerald-600/55",
  },
  ritual: {
    label: "Ritual",
    fillClass: "bg-purple-500",
    textClass: "text-purple-300",
    borderClass: "border-purple-500/55",
  },
  evento: {
    label: "Evento",
    fillClass: "bg-amber-500",
    textClass: "text-amber-300",
    borderClass: "border-amber-500/55",
  },
};

const VALID_ESCALATIONS: readonly SceneEscalationLevel[] = [
  "investigacao",
  "opressao",
  "ameaca",
  "horror",
];

const VALID_MODES: readonly SceneModeAction[] = ["keep", "demologia", "rl"];

const VALID_CATEGORIES: readonly ClockCategory[] = [
  "ameaca",
  "investigacao",
  "ritual",
  "evento",
];

export function normalizeClockSegments(raw: unknown): ClockSegmentCount {
  const num = Number(raw);
  if (num === 4 || num === 6 || num === 8 || num === 12) return num;
  if (num <= 4) return 4;
  if (num <= 6) return 6;
  if (num <= 8) return 8;
  return 12;
}

export function normalizeNarrativeScene(
  raw: Partial<NarrativeScene> & { id?: unknown },
): NarrativeScene {
  const now = Date.now();
  const title =
    typeof raw?.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : "Cena Sem Título";

  return {
    id:
      typeof raw?.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `scene_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    atmosphere:
      typeof raw?.atmosphere === "string"
        ? raw.atmosphere.trim().slice(0, 280)
        : "",
    escalation: VALID_ESCALATIONS.includes(raw?.escalation as SceneEscalationLevel)
      ? (raw.escalation as SceneEscalationLevel)
      : "investigacao",
    linkedTrackUrl:
      typeof raw?.linkedTrackUrl === "string" && raw.linkedTrackUrl.trim()
        ? raw.linkedTrackUrl.trim()
        : "keep",
    targetGameMode: VALID_MODES.includes(raw?.targetGameMode as SceneModeAction)
      ? (raw.targetGameMode as SceneModeAction)
      : "keep",
    privateNotes:
      typeof raw?.privateNotes === "string"
        ? raw.privateNotes.slice(0, 4000)
        : "",
    visibleToPlayers: raw?.visibleToPlayers !== false,
    timelineNodes: normalizeSceneBuilderNodes(raw?.timelineNodes),
    createdAt:
      typeof raw?.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw?.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : now,
  };
}

export function normalizeTensionClock(
  raw: Partial<TensionClock> & { id?: unknown },
): TensionClock {
  const now = Date.now();
  const segments = normalizeClockSegments(raw?.segments ?? 6);
  const rawFilled = Number(raw?.filled ?? 0);
  const filled = Number.isFinite(rawFilled)
    ? Math.max(0, Math.min(segments, Math.round(rawFilled)))
    : 0;

  return {
    id:
      typeof raw?.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `clock_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title:
      typeof raw?.title === "string" && raw.title.trim()
        ? raw.title.trim().slice(0, 90)
        : "Relógio de Tensão",
    category: VALID_CATEGORIES.includes(raw?.category as ClockCategory)
      ? (raw.category as ClockCategory)
      : "ameaca",
    segments,
    filled,
    visibleToPlayers: Boolean(raw?.visibleToPlayers),
    privateNote:
      typeof raw?.privateNote === "string"
        ? raw.privateNote.slice(0, 500)
        : "",
    createdAt:
      typeof raw?.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw?.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : now,
  };
}

export function normalizeSceneDirectorMasterState(
  raw: unknown,
): SceneDirectorMasterState {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const scenesMap = new Map<string, NarrativeScene>();
  if (Array.isArray(obj.scenes)) {
    for (const s of obj.scenes) {
      if (!s || typeof s !== "object") continue;
      const norm = normalizeNarrativeScene(s);
      scenesMap.set(norm.id, norm);
    }
  }
  const scenes = Array.from(scenesMap.values());

  const rawActiveId =
    typeof obj.activeSceneId === "string" && obj.activeSceneId.trim()
      ? obj.activeSceneId.trim()
      : null;
  const activeSceneId =
    rawActiveId && scenesMap.has(rawActiveId) ? rawActiveId : null;

  const clocksMap = new Map<string, TensionClock>();
  if (Array.isArray(obj.clocks)) {
    for (const c of obj.clocks) {
      if (!c || typeof c !== "object") continue;
      const norm = normalizeTensionClock(c);
      clocksMap.set(norm.id, norm);
    }
  }
  const clocks = Array.from(clocksMap.values());

  return {
    scenes,
    activeSceneId,
    clocks,
    updatedAt:
      typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
        ? obj.updatedAt
        : 0,
  };
}

export function normalizePublicSceneDirectorState(
  raw: unknown,
): PublicSceneDirectorState {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  let activeScene: PublicSceneSnapshot | null = null;

  if (obj.activeScene && typeof obj.activeScene === "object") {
    const rawScene = obj.activeScene as Record<string, any>;
    const title =
      typeof rawScene.title === "string" ? rawScene.title.trim().slice(0, 120) : "";
    if (title) {
      activeScene = {
        id: typeof rawScene.id === "string" ? rawScene.id : "active_scene",
        title,
        atmosphere:
          typeof rawScene.atmosphere === "string"
            ? rawScene.atmosphere.trim().slice(0, 280)
            : "",
        escalation: VALID_ESCALATIONS.includes(
          rawScene.escalation as SceneEscalationLevel,
        )
          ? (rawScene.escalation as SceneEscalationLevel)
          : "investigacao",
        activatedAt:
          typeof rawScene.activatedAt === "number" &&
          Number.isFinite(rawScene.activatedAt)
            ? rawScene.activatedAt
            : Date.now(),
      };
    }
  }

  const clocksMap = new Map<string, PublicClockSnapshot>();
  if (Array.isArray(obj.visibleClocks)) {
    for (const c of obj.visibleClocks) {
      if (!c || typeof c !== "object") continue;
      const segments = normalizeClockSegments((c as any).segments ?? 6);
      const rawFilled = Number((c as any).filled ?? 0);
      const filled = Number.isFinite(rawFilled)
        ? Math.max(0, Math.min(segments, Math.round(rawFilled)))
        : 0;
      const id =
        typeof (c as any).id === "string" && (c as any).id.trim()
          ? (c as any).id.trim()
          : "";
      const title =
        typeof (c as any).title === "string" && (c as any).title.trim()
          ? (c as any).title.trim().slice(0, 90)
          : "";
      if (!id || !title) continue;
      clocksMap.set(id, {
        id,
        title,
        category: VALID_CATEGORIES.includes((c as any).category as ClockCategory)
          ? ((c as any).category as ClockCategory)
          : "ameaca",
        segments,
        filled,
      });
    }
  }

  return {
    activeScene,
    visibleClocks: Array.from(clocksMap.values()),
    updatedAt:
      typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
        ? obj.updatedAt
        : 0,
  };
}

/**
 * Produces the strictly sanitized public payload shared with players.
 * Never includes private Master notes, inactive scenes, hidden scenes, or hidden clocks.
 */
export function buildPublicSceneDirectorPayload(
  masterState: SceneDirectorMasterState,
  now: number = Date.now(),
): PublicSceneDirectorState {
  const active = masterState.activeSceneId
    ? masterState.scenes.find((s) => s.id === masterState.activeSceneId) || null
    : null;

  const activeScene: PublicSceneSnapshot | null =
    active && active.visibleToPlayers
      ? {
          id: active.id,
          title: active.title,
          atmosphere: active.atmosphere,
          escalation: active.escalation,
          activatedAt: active.updatedAt || now,
        }
      : null;

  const visibleClocks: PublicClockSnapshot[] = masterState.clocks
    .filter((c) => c.visibleToPlayers)
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      segments: c.segments,
      filled: Math.max(0, Math.min(c.segments, c.filled)),
    }));

  return {
    activeScene,
    visibleClocks,
    updatedAt: now,
  };
}

export function advanceTensionClock(
  clock: TensionClock,
  delta: number,
  now: number = Date.now(),
): TensionClock {
  const nextFilled = Math.max(
    0,
    Math.min(clock.segments, clock.filled + Math.trunc(delta)),
  );
  if (nextFilled === clock.filled) return clock;
  return {
    ...clock,
    filled: nextFilled,
    updatedAt: now,
  };
}

export function setTensionClockFilled(
  clock: TensionClock,
  targetFilled: number,
  now: number = Date.now(),
): TensionClock {
  const clamped = Math.max(
    0,
    Math.min(clock.segments, Math.round(targetFilled)),
  );
  if (clamped === clock.filled) return clock;
  return {
    ...clock,
    filled: clamped,
    updatedAt: now,
  };
}

export function resetTensionClock(
  clock: TensionClock,
  now: number = Date.now(),
): TensionClock {
  return setTensionClockFilled(clock, 0, now);
}

export function isTensionClockComplete(
  clock: Pick<TensionClock, "filled" | "segments">,
): boolean {
  return clock.segments > 0 && clock.filled >= clock.segments;
}

// --- COMBAT ROUND & ACTIVE TURN TRACKER ---

export function createInitialCombatTurnState(): CombatTurnState {
  return {
    active: false,
    round: 1,
    activeParticipantId: null,
    notifyTurnToPlayers: true,
  };
}

export function startCombatRounds(
  orderedParticipantIds: readonly string[],
  notifyTurnToPlayers = true,
): CombatTurnState {
  if (orderedParticipantIds.length === 0) {
    return {
      active: false,
      round: 1,
      activeParticipantId: null,
      notifyTurnToPlayers,
    };
  }
  return {
    active: true,
    round: 1,
    activeParticipantId: orderedParticipantIds[0],
    notifyTurnToPlayers,
  };
}

export function stopCombatRounds(
  prev?: CombatTurnState,
): CombatTurnState {
  return {
    active: false,
    round: 1,
    activeParticipantId: null,
    notifyTurnToPlayers: prev ? prev.notifyTurnToPlayers : true,
  };
}

export function reconcileCombatTurnState(
  state: CombatTurnState,
  orderedParticipantIds: readonly string[],
): CombatTurnState {
  if (!state.active) return state;
  if (orderedParticipantIds.length === 0) {
    return {
      ...state,
      active: false,
      activeParticipantId: null,
    };
  }
  if (
    state.activeParticipantId &&
    orderedParticipantIds.includes(state.activeParticipantId)
  ) {
    return state;
  }
  return {
    ...state,
    activeParticipantId: orderedParticipantIds[0],
  };
}

export function advanceCombatTurn(
  state: CombatTurnState,
  orderedParticipantIds: readonly string[],
  direction: 1 | -1,
): CombatTurnState {
  if (orderedParticipantIds.length === 0) {
    return stopCombatRounds(state);
  }
  if (!state.active || !state.activeParticipantId) {
    return startCombatRounds(orderedParticipantIds, state.notifyTurnToPlayers);
  }

  const currentIdx = orderedParticipantIds.indexOf(state.activeParticipantId);
  if (currentIdx === -1) {
    return {
      ...state,
      activeParticipantId: orderedParticipantIds[0],
    };
  }

  const len = orderedParticipantIds.length;
  if (direction === 1) {
    const nextIdx = (currentIdx + 1) % len;
    const wrappedToNextRound = nextIdx === 0;
    return {
      ...state,
      round: wrappedToNextRound ? state.round + 1 : state.round,
      activeParticipantId: orderedParticipantIds[nextIdx],
    };
  }

  // direction === -1
  if (currentIdx === 0) {
    if (state.round <= 1) {
      return state;
    }
    return {
      ...state,
      round: state.round - 1,
      activeParticipantId: orderedParticipantIds[len - 1],
    };
  }

  return {
    ...state,
    activeParticipantId: orderedParticipantIds[currentIdx - 1],
  };
}

/**
 * Computes the next clamped stat value when applying a batch delta (e.g. -5 PV or +4 PE).
 */
export function computeBatchStatValue(
  current: number,
  max: number | undefined,
  delta: number,
): number {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeDelta = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const rawNext = safeCurrent + safeDelta;
  if (rawNext <= 0) return 0;
  if (typeof max === "number" && Number.isFinite(max) && max > 0) {
    return Math.min(max, rawNext);
  }
  return rawNext;
}
