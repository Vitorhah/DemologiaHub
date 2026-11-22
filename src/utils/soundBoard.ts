import { clampVolume, normalizeTrackUrl } from "../services/ostUtils";

export const MAX_CONCURRENT_SFX = 6;
export const DEFAULT_SFX_AUTO_FADE_SECONDS = 0.5;
export const MIN_SFX_AUTO_FADE_SECONDS = 0.08;
export const MAX_SFX_FADE_RATIO = 0.35;
export const SOUND_BOARD_RECORD_PREFIX = "SOUNDBOARD_";
export const SOUND_BOARD_LOCAL_STORAGE_PREFIX = "demologia_soundboard_v1_";
export const SOUND_BOARD_MASTER_VOLUME_STORAGE_KEY =
  "demologia_soundboard_master_volume_v1";

export type SoundBoardIconId =
  | "volume"
  | "zap"
  | "flame"
  | "skull"
  | "door"
  | "ghost"
  | "swords"
  | "wind"
  | "bell"
  | "radio"
  | "footprints"
  | "sparkles";

export interface SoundBoardIconOption {
  id: SoundBoardIconId;
  label: string;
}

export const SOUND_BOARD_ICON_OPTIONS: readonly SoundBoardIconOption[] = [
  { id: "volume", label: "Som" },
  { id: "zap", label: "Impacto" },
  { id: "flame", label: "Fogo" },
  { id: "skull", label: "Terror" },
  { id: "door", label: "Porta" },
  { id: "ghost", label: "Espectro" },
  { id: "swords", label: "Combate" },
  { id: "wind", label: "Ambiente" },
  { id: "bell", label: "Sino" },
  { id: "radio", label: "Estática" },
  { id: "footprints", label: "Passos" },
  { id: "sparkles", label: "Ritual" },
] as const;

const VALID_ICON_IDS = new Set<string>(
  SOUND_BOARD_ICON_OPTIONS.map((opt) => opt.id),
);

export interface SoundBoardEffect {
  id: string;
  room_id: string;
  name: string;
  url: string;
  source: "upload" | "link";
  volume: number;
  icon: SoundBoardIconId;
  created_at: string;
}

export interface SoundBoardActiveInfo {
  effectId: string;
  startedAtMs: number;
  durationSeconds: number;
  fadingOut: boolean;
}

export interface SoundBoardSnapshot {
  effects: SoundBoardEffect[];
  masterVolume: number;
  activeIds: string[];
  fadingOutIds: string[];
  maxConcurrent: number;
  lastError: string | null;
}

export interface SoundBoardBroadcastPlayPayload {
  room_id: string;
  effect_id: string;
  url: string;
  volume: number;
  master_volume: number;
  triggered_at: string;
  token: string;
}

export interface SoundBoardBroadcastStopPayload {
  room_id: string;
  effect_id?: string;
}

export interface SoundBoardBroadcastVolumePayload {
  room_id: string;
  master_volume: number;
}

export interface AutoFadeOutPlan {
  delayMs: number;
  fadeDurationMs: number;
  shouldFade: boolean;
}

export function getSoundBoardRecordId(roomId: string): string {
  const safeRoom = (roomId || "default-table").trim() || "default-table";
  return `${SOUND_BOARD_RECORD_PREFIX}${safeRoom}`;
}

export function normalizeSoundBoardIcon(value: unknown): SoundBoardIconId {
  if (typeof value === "string" && VALID_ICON_IDS.has(value)) {
    return value as SoundBoardIconId;
  }
  return "volume";
}

export function clampSfxVolume(value: unknown, fallback = 1): number {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) {
    return clampVolume(fallback);
  }
  return clampVolume(num);
}

export function computeEffectiveSfxVolume(
  effectVolume: number,
  masterVolume: number,
): number {
  return clampVolume(clampSfxVolume(effectVolume, 1) * clampSfxVolume(masterVolume, 1));
}

/**
 * Calcula quando iniciar e quanto deve durar o fade-out automático no final
 * de um efeito sonoro one-shot, evitando cortes abruptos sem prejudicar sons curtos.
 */
export function computeAutoFadeOutPlan(
  durationSeconds: number,
  preferredFadeSeconds: number = DEFAULT_SFX_AUTO_FADE_SECONDS,
): AutoFadeOutPlan {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0.05) {
    return { delayMs: 0, fadeDurationMs: 0, shouldFade: false };
  }

  const maxAllowedFade = durationSeconds * MAX_SFX_FADE_RATIO;
  const preferred = Math.max(MIN_SFX_AUTO_FADE_SECONDS, preferredFadeSeconds);
  const fadeSeconds = Math.min(preferred, maxAllowedFade);

  if (fadeSeconds < 0.03) {
    return { delayMs: 0, fadeDurationMs: 0, shouldFade: false };
  }

  const delaySeconds = Math.max(0, durationSeconds - fadeSeconds);
  return {
    delayMs: Math.round(delaySeconds * 1000),
    fadeDurationMs: Math.round(fadeSeconds * 1000),
    shouldFade: true,
  };
}

/**
 * Resolve o controle de concorrência dos Sound Boards:
 * - Se o efeito já estiver ativo, reinicia sem criar duplicata e atualiza sua ordem.
 * - Se for um novo efeito e o limite de sons simultâneos estiver cheio, remove os mais antigos.
 */
export function resolveConcurrentSfxActivation(
  activeOrder: string[],
  incomingId: string,
  maxConcurrent: number = MAX_CONCURRENT_SFX,
): {
  action: "restart" | "start";
  evictedIds: string[];
  nextOrder: string[];
} {
  const safeLimit = Math.max(1, Math.floor(maxConcurrent));
  const cleanOrder = activeOrder.filter((id) => typeof id === "string" && id.length > 0);
  const alreadyActive = cleanOrder.includes(incomingId);

  if (alreadyActive) {
    const withoutIncoming = cleanOrder.filter((id) => id !== incomingId);
    const nextOrder = [...withoutIncoming, incomingId];
    return {
      action: "restart",
      evictedIds: [],
      nextOrder,
    };
  }

  const evictedIds: string[] = [];
  const remaining = [...cleanOrder];
  while (remaining.length >= safeLimit) {
    const oldest = remaining.shift();
    if (oldest) evictedIds.push(oldest);
  }

  remaining.push(incomingId);
  return {
    action: "start",
    evictedIds,
    nextOrder: remaining,
  };
}

export function normalizeSoundBoardEffect(
  raw: Partial<SoundBoardEffect> | null | undefined,
  roomId: string,
): SoundBoardEffect | null {
  if (!raw || typeof raw !== "object") return null;
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!rawUrl) return null;

  const id =
    typeof raw.id === "string" && raw.id.trim().length > 0
      ? raw.id.trim()
      : `sfx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim()
      : "Efeito Sem Nome";

  return {
    id,
    room_id:
      typeof raw.room_id === "string" && raw.room_id.trim().length > 0
        ? raw.room_id.trim()
        : roomId,
    name,
    url: rawUrl,
    source: raw.source === "upload" ? "upload" : "link",
    volume: clampSfxVolume(raw.volume, 1),
    icon: normalizeSoundBoardIcon(raw.icon),
    created_at:
      typeof raw.created_at === "string" && raw.created_at.trim().length > 0
        ? raw.created_at
        : new Date().toISOString(),
  };
}

export function normalizeSoundBoardEffects(
  rawList: unknown,
  roomId: string,
): SoundBoardEffect[] {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set<string>();
  const result: SoundBoardEffect[] = [];

  for (const item of rawList) {
    const normalized = normalizeSoundBoardEffect(
      item as Partial<SoundBoardEffect>,
      roomId,
    );
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    result.push(normalized);
  }

  return result;
}

export function validateSoundBoardLink(
  name: string,
  url: string,
): { ok: true; name: string; url: string } | { ok: false; error: string } {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) {
    return { ok: false, error: "Informe a URL direta do efeito sonoro." };
  }

  const lower = cleanUrl.toLowerCase();
  const isHttp = lower.startsWith("http://") || lower.startsWith("https://");
  const isDataAudio = lower.startsWith("data:audio/");
  const isBlob = lower.startsWith("blob:");

  if (!isHttp && !isDataAudio && !isBlob) {
    return {
      ok: false,
      error: "Use um link direto http(s):// válido para o arquivo de áudio.",
    };
  }

  const cleanName = (name || "").trim() || "Efeito Sonoro";
  return {
    ok: true,
    name: cleanName,
    url: isHttp ? normalizeTrackUrl(cleanUrl) : cleanUrl,
  };
}

export function isSoundBoardPlayPayloadValid(
  payload: unknown,
  expectedRoomId: string,
): payload is SoundBoardBroadcastPlayPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.room_id !== expectedRoomId) return false;
  if (typeof p.effect_id !== "string" || !p.effect_id.trim()) return false;
  if (typeof p.url !== "string" || !p.url.trim()) return false;
  return true;
}
