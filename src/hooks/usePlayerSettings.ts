import { useCallback, useEffect, useState } from "react";
import { Howler } from "howler";
import {
  DEFAULT_PLAYER_SETTINGS,
  PlayerSettings,
  getEffectiveAppVolume,
  loadPlayerSettings,
  normalizePlayerSettings,
  savePlayerSettings,
} from "../utils/playerSettings";
import { setDiceAppVolume } from "../utils/diceSound";

export interface UsePlayerSettingsReturn {
  settings: PlayerSettings;
  effectiveAppVolume: number;
  updateSettings: (patch: Partial<PlayerSettings>) => void;
  resetSettings: () => void;
}

/**
 * Gerencia as preferências locais do jogador (sem afetar narrativa,
 * banco de dados compartilhado nem os níveis configurados das OSTs do Mestre).
 */
export function usePlayerSettings(): UsePlayerSettingsReturn {
  const [settings, setSettings] = useState<PlayerSettings>(() =>
    loadPlayerSettings(),
  );

  const effectiveAppVolume = getEffectiveAppVolume(settings);

  // Persiste no localStorage e aplica efeitos locais (áudio global, escala de texto e redução de movimento)
  useEffect(() => {
    savePlayerSettings(settings);

    // Escala o ganho global do Howler (OST + Sound Boards neste dispositivo)
    // SEM alterar activeHowl.volume() nem playback_state.volume.
    try {
      Howler.volume(effectiveAppVolume);
    } catch {
      // Ignora se Howler ainda não inicializou contexto
    }

    // Escala também os efeitos sintetizados via Web Audio (rolagem de dados)
    setDiceAppVolume(effectiveAppVolume);

    // Aplica acessibilidade visual no documento raiz
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("demologia-reduced-motion", settings.reducedMotion);
      if (settings.textScale === "normal") {
        root.removeAttribute("data-text-scale");
      } else {
        root.setAttribute("data-text-scale", settings.textScale);
      }
    }
  }, [settings, effectiveAppVolume]);

  const updateSettings = useCallback((patch: Partial<PlayerSettings>) => {
    setSettings((prev) => normalizePlayerSettings({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_PLAYER_SETTINGS });
  }, []);

  return {
    settings,
    effectiveAppVolume,
    updateSettings,
    resetSettings,
  };
}
