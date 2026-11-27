import type { MinigameType } from "./minigames";

export type PauseSettingsSectionId = "audio" | "notifications" | "visual";

export interface PauseAllowedSettings {
  audio: boolean;
  notifications: boolean;
  visual: boolean;
}

export interface SessionPauseState {
  roomId: string;
  masterId: string;
  masterSessionHash: string;
  isActive: boolean;
  message: string;
  allowedSettings: PauseAllowedSettings;
  allowedMinigames: MinigameType[];
  activatedAt: number;
  heartbeatAt: number;
  updatedAt: number;
}

export interface PauseMutationInput {
  message: string;
  allowedSettings: PauseAllowedSettings;
  allowedMinigames: MinigameType[];
}

export interface PollOption {
  id: string;
  label: string;
}

export type SessionPollStatus = "active" | "closed";

export interface SessionPoll {
  id: string;
  roomId: string;
  masterId: string;
  masterSessionHash: string;
  question: string;
  options: PollOption[];
  durationSeconds: number;
  status: SessionPollStatus;
  startedAt: number;
  endsAt: number;
  closedAt: number | null;
  updatedAt: number;
}

export interface PollVoteRecord {
  pollId: string;
  roomId: string;
  voterId: string;
  optionId: string;
  createdAt: number;
}

export interface PollOptionResult {
  id: string;
  label: string;
  votes: number;
  percentage: number;
}

export interface PollComputedResults {
  totalVotes: number;
  options: PollOptionResult[];
  userVotedOptionId: string | null;
}

export interface CreatePollInput {
  question: string;
  options: string[];
  durationSeconds: number;
}

export interface SessionUtilityActionResult {
  ok: boolean;
  error?: string;
}
