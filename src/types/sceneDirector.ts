import type { GameMode } from "../types";

export type SceneEscalationLevel =
  | "investigacao"
  | "opressao"
  | "ameaca"
  | "horror";

export type SceneModeAction = "keep" | GameMode;

export type SceneOstAction = "keep" | "stop" | string;

export type SceneNodeType =
  | "ost"
  | "sfx"
  | "mode"
  | "clock"
  | "handout"
  | "delay"
  | "fade"
  | "blackout"
  | "background";

export type BlackoutEasingStyle = "linear" | "quad" | "exponential";

export type BlackoutEasingDirection = "in" | "out" | "inout";

export type BackgroundActionMode = "custom" | "default";
export type BackgroundSourceType = "link" | "upload";
export type BackgroundMediaType = "image" | "gif" | "video";

export interface SceneBackgroundPayload {
  mode: BackgroundActionMode;
  url: string | null;
  mediaType: BackgroundMediaType | null;
  name?: string;
  updatedAt: number;
}

export interface SceneBuilderNodeParams {
  // OST
  ostAction?: "play" | "stop";
  trackUrl?: string;
  trackName?: string;
  fadeSeconds?: number;
  ostFadeOutSeconds?: number;
  // Sound Board SFX
  effectId?: string;
  effectName?: string;
  volume?: number;
  // Game Mode
  targetMode?: GameMode;
  // Tension Clock
  clockId?: string;
  clockTitle?: string;
  clockAction?: "advance" | "regress" | "reveal" | "hide" | "reset";
  amount?: number;
  // Handout
  handoutId?: string;
  handoutTitle?: string;
  handoutAction?: "reveal_all" | "reveal_secret";
  // Delay / Wait
  waitSeconds?: number;
  note?: string;
  // Fade (Penumbra) & Blackout
  fadeStyle?: "dim";
  opacity?: number;
  holdSeconds?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  easingStyle?: BlackoutEasingStyle;
  easingDirection?: BlackoutEasingDirection;
  caption?: string;
  // Background ("Mudar fundo")
  backgroundAction?: BackgroundActionMode;
  backgroundSource?: BackgroundSourceType;
  backgroundUrl?: string;
  backgroundMediaType?: BackgroundMediaType;
  backgroundName?: string;
}

export interface SceneBuilderNode {
  id: string;
  type: SceneNodeType;
  startTimeSec: number;
  durationSec: number;
  enabled: boolean;
  label?: string;
  params: SceneBuilderNodeParams;
}

export interface NarrativeScene {
  id: string;
  title: string;
  atmosphere: string;
  escalation: SceneEscalationLevel;
  linkedTrackUrl: SceneOstAction;
  targetGameMode: SceneModeAction;
  privateNotes: string;
  visibleToPlayers: boolean;
  timelineNodes?: SceneBuilderNode[];
  createdAt: number;
  updatedAt: number;
}

export type ClockCategory = "ameaca" | "investigacao" | "ritual" | "evento";

export type ClockSegmentCount = 4 | 6 | 8 | 12;

export interface TensionClock {
  id: string;
  title: string;
  category: ClockCategory;
  segments: ClockSegmentCount;
  filled: number;
  visibleToPlayers: boolean;
  privateNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface SceneDirectorMasterState {
  scenes: NarrativeScene[];
  activeSceneId: string | null;
  clocks: TensionClock[];
  updatedAt: number;
}

export interface PublicSceneSnapshot {
  id: string;
  title: string;
  atmosphere: string;
  escalation: SceneEscalationLevel;
  activatedAt: number;
}

export interface PublicClockSnapshot {
  id: string;
  title: string;
  category: ClockCategory;
  segments: ClockSegmentCount;
  filled: number;
}

export interface PublicSceneDirectorState {
  activeScene: PublicSceneSnapshot | null;
  visibleClocks: PublicClockSnapshot[];
  updatedAt: number;
}

export interface CombatTurnState {
  active: boolean;
  round: number;
  activeParticipantId: string | null;
  notifyTurnToPlayers: boolean;
}

export type BatchStatTarget = "hp" | "pe" | "sm";
