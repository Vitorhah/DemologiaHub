import type { GameMode, GameModeConfig } from "../types";

/**
 * Constantes idênticas à animação de Fade do "Enviar Dados"
 * (PlayerDataPushFadeOverlay + useMasterDataPushSync).
 */
export const MODE_FADE_IN_DURATION_SEC = 0.5;
export const MODE_FADE_OUT_DURATION_SEC = 0.7;
export const MODE_FADE_PEAK_OPACITY = 0.94;
export const MODE_FADE_SWAP_DELAY_MS = 520;
export const MODE_FADE_HOLD_AFTER_SWAP_MS = 220;
export const MODE_FADE_OUT_CLEANUP_MS = 720;

export type ModeTransitionAction = "none" | "instant" | "fade";

export function resolveActiveGameMode(
  config: GameModeConfig | null | undefined,
  userUid: string | null | undefined,
): GameMode {
  if (userUid && config?.playerModes && config.playerModes[userUid]) {
    return config.playerModes[userUid];
  }
  return config?.globalMode || "demologia";
}

export function resolveModeTransitionAction(params: {
  previousMode: GameMode;
  nextMode: GameMode;
  skipTransition?: boolean;
  isInitialMount?: boolean;
  isAuthHydration?: boolean;
}): ModeTransitionAction {
  const {
    previousMode,
    nextMode,
    skipTransition = false,
    isInitialMount = false,
    isAuthHydration = false,
  } = params;

  if (previousMode === nextMode) {
    return "none";
  }

  if (isInitialMount || isAuthHydration || skipTransition) {
    return "instant";
  }

  return "fade";
}
