export type PlayerTextScale = "compact" | "normal" | "large";

export interface PlayerSettings {
  /** Volume geral local da página (0.0 a 1.0). Escala a saída local sem alterar o volume das OSTs. */
  appVolume: number;
  /** Silenciamento rápido local da página (preserva appVolume para restaurar depois). */
  appMuted: boolean;
  /** Duração base (em segundos) das notificações toast (2s a 12s). */
  notificationDurationSec: number;
  /** Exibir notificações pop-up ao rolar dados (alertas críticos de Último Suspiro continuam visíveis). */
  showRollNotifications: boolean;
  /** Reproduzir efeito sonoro sintetizado ao rolar dados. */
  diceSoundEnabled: boolean;
  /** Ativar tremor de tela durante rolagens de dados. */
  screenShakeEnabled: boolean;
  /** Ativar vibração tátil em dispositivos móveis compatíveis. */
  hapticsEnabled: boolean;
  /** Reduzir animações e transições de interface. */
  reducedMotion: boolean;
  /** Escala local do tamanho de texto da interface. */
  textScale: PlayerTextScale;
}

export const PLAYER_SETTINGS_STORAGE_KEY = "demologia_player_settings_v1";

export const MIN_NOTIFICATION_DURATION_SEC = 2;
export const MAX_NOTIFICATION_DURATION_SEC = 12;

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  appVolume: 1.0,
  appMuted: false,
  notificationDurationSec: 4,
  showRollNotifications: true,
  diceSoundEnabled: true,
  screenShakeEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  textScale: "normal",
};

export function clampAppVolume(value: unknown, fallback = 1.0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

export function clampNotificationDurationSec(value: unknown, fallback = 4): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    MIN_NOTIFICATION_DURATION_SEC,
    Math.min(MAX_NOTIFICATION_DURATION_SEC, Math.round(n)),
  );
}

export function normalizeTextScale(value: unknown): PlayerTextScale {
  if (value === "compact" || value === "normal" || value === "large") {
    return value;
  }
  return "normal";
}

export function normalizePlayerSettings(raw: unknown): PlayerSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    appVolume: clampAppVolume(obj.appVolume, DEFAULT_PLAYER_SETTINGS.appVolume),
    appMuted:
      typeof obj.appMuted === "boolean"
        ? obj.appMuted
        : DEFAULT_PLAYER_SETTINGS.appMuted,
    notificationDurationSec: clampNotificationDurationSec(
      obj.notificationDurationSec,
      DEFAULT_PLAYER_SETTINGS.notificationDurationSec,
    ),
    showRollNotifications:
      typeof obj.showRollNotifications === "boolean"
        ? obj.showRollNotifications
        : DEFAULT_PLAYER_SETTINGS.showRollNotifications,
    diceSoundEnabled:
      typeof obj.diceSoundEnabled === "boolean"
        ? obj.diceSoundEnabled
        : DEFAULT_PLAYER_SETTINGS.diceSoundEnabled,
    screenShakeEnabled:
      typeof obj.screenShakeEnabled === "boolean"
        ? obj.screenShakeEnabled
        : DEFAULT_PLAYER_SETTINGS.screenShakeEnabled,
    hapticsEnabled:
      typeof obj.hapticsEnabled === "boolean"
        ? obj.hapticsEnabled
        : DEFAULT_PLAYER_SETTINGS.hapticsEnabled,
    reducedMotion:
      typeof obj.reducedMotion === "boolean"
        ? obj.reducedMotion
        : DEFAULT_PLAYER_SETTINGS.reducedMotion,
    textScale: normalizeTextScale(obj.textScale),
  };
}

/**
 * Retorna o multiplicador efetivo de áudio local da página (0.0 a 1.0).
 * Aplicado no estágio de saída global do dispositivo, sem modificar o volume
 * configurado pelo Mestre nas OSTs ou Sound Boards.
 */
export function getEffectiveAppVolume(
  settings: Pick<PlayerSettings, "appVolume" | "appMuted">,
): number {
  if (settings.appMuted) return 0;
  return clampAppVolume(settings.appVolume, 1.0);
}

/**
 * Calcula a porcentagem aproximada de saída local ao combinar o volume da OST
 * com o Volume Geral do Aplicativo, apenas para exibição informativa.
 */
export function computeLocalEffectiveOutputPercent(
  ostVolume: number,
  settings: Pick<PlayerSettings, "appVolume" | "appMuted">,
): number {
  const safeOst = clampAppVolume(ostVolume, 1.0);
  const appMult = getEffectiveAppVolume(settings);
  return Math.round(safeOst * appMult * 100);
}

export type NotificationToastKind = "roll" | "ultimo_suspiro" | "handout";

/**
 * Converte a duração base escolhida pelo jogador (2s–12s) para milissegundos,
 * dando uma margem extra discreta para alertas críticos ou handouts com ação.
 */
export function computeNotificationDurationMs(
  baseDurationSec: number,
  kind: NotificationToastKind = "roll",
): number {
  const safeSec = clampNotificationDurationSec(baseDurationSec, 4);
  if (kind === "ultimo_suspiro") {
    return Math.min(15000, (safeSec + 1) * 1000);
  }
  if (kind === "handout") {
    return Math.min(16000, Math.max(3000, (safeSec + 2) * 1000));
  }
  return safeSec * 1000;
}

export function loadPlayerSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(PLAYER_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_SETTINGS };
    return normalizePlayerSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
}

export function savePlayerSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(
      PLAYER_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizePlayerSettings(settings)),
    );
  } catch {
    // Ignora falha caso storage local esteja indisponível
  }
}
