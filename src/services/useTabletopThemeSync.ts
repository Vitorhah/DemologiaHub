import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  TabletopCustomPreset,
  TabletopCustomizationConfig,
} from "../types/tabletopCustomization";
import {
  applyTabletopCustomizationToDom,
  areTabletopCustomizationsEqual,
  createCustomPresetFromConfig,
  createDefaultTabletopCustomization,
  deleteSavedCustomPreset,
  getTabletopPresetsLocalKey,
  getTabletopThemeLocalKey,
  getTabletopThemeRecordId,
  normalizeSavedCustomPresets,
  normalizeTabletopCustomization,
  resolveCustomizationForAppearanceAction,
  sanitizeRoomKey,
  upsertSavedCustomPreset,
} from "../utils/tabletopCustomization";
import { createVisibilityPoller } from "../utils/visibilityPolling";

export interface TabletopThemeActionResult {
  ok: boolean;
  error?: string;
  preset?: TabletopCustomPreset;
  clearSceneBackground?: boolean;
}

interface UseTabletopThemeSyncOptions {
  roomId: string;
  isMestreAuth: boolean;
  isOnline: boolean;
}

function loadCachedTheme(roomId: string): TabletopCustomizationConfig {
  try {
    const raw = localStorage.getItem(getTabletopThemeLocalKey(roomId));
    if (!raw) return createDefaultTabletopCustomization(roomId, 0);
    return normalizeTabletopCustomization(JSON.parse(raw), roomId);
  } catch {
    return createDefaultTabletopCustomization(roomId, 0);
  }
}

function saveCachedTheme(roomId: string, config: TabletopCustomizationConfig): void {
  try {
    localStorage.setItem(getTabletopThemeLocalKey(roomId), JSON.stringify(config));
  } catch {}
}

function loadCachedPresets(roomId: string): TabletopCustomPreset[] {
  try {
    const raw = localStorage.getItem(getTabletopPresetsLocalKey(roomId));
    if (!raw) return [];
    return normalizeSavedCustomPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveCachedPresets(roomId: string, presets: TabletopCustomPreset[]): void {
  try {
    localStorage.setItem(getTabletopPresetsLocalKey(roomId), JSON.stringify(presets));
  } catch {}
}

function arePresetListsEqual(
  a: TabletopCustomPreset[],
  b: TabletopCustomPreset[],
): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Sincroniza a identidade visual compartilhada do Tabletop e as predefinições custom
 * salvas para TODOS os usuários conectados à sala via Supabase (`players` + Realtime + Broadcast).
 * - Apenas o Mestre (`isMestreAuth === true`) pode persistir, gerenciar presets ou resetar o tema.
 * - Jogadores recebem automaticamente todas as alterações e resets sem recarregar.
 */
export function useTabletopThemeSync({
  roomId,
  isMestreAuth,
  isOnline,
}: UseTabletopThemeSyncOptions) {
  const safeRoom = sanitizeRoomKey(roomId);
  const recordId = getTabletopThemeRecordId(safeRoom);

  const [customization, setCustomization] = useState<TabletopCustomizationConfig>(() =>
    loadCachedTheme(safeRoom),
  );
  const [savedPresets, setSavedPresets] = useState<TabletopCustomPreset[]>(() =>
    loadCachedPresets(safeRoom),
  );
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const customizationRef = useRef(customization);
  customizationRef.current = customization;
  const savedPresetsRef = useRef(savedPresets);
  savedPresetsRef.current = savedPresets;
  const localMutationTsRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Recarrega cache caso a sala mude
  useEffect(() => {
    setCustomization(loadCachedTheme(safeRoom));
    setSavedPresets(loadCachedPresets(safeRoom));
  }, [safeRoom]);

  // Aplica imediatamente no DOM sempre que a configuração ativa da sala mudar
  useEffect(() => {
    applyTabletopCustomizationToDom(customization);
  }, [customization]);

  const applyIncomingState = useCallback(
    (rawTheme: unknown, rawPresets?: unknown, payloadTimestamp?: number) => {
      if (
        typeof payloadTimestamp === "number" &&
        payloadTimestamp > 0 &&
        localMutationTsRef.current > 0 &&
        payloadTimestamp < localMutationTsRef.current
      ) {
        return;
      }

      if (rawTheme && typeof rawTheme === "object") {
        const normalized = normalizeTabletopCustomization(rawTheme, safeRoom);
        const isStaleTheme =
          normalized.updatedAt > 0 &&
          localMutationTsRef.current > 0 &&
          normalized.updatedAt < localMutationTsRef.current;

        if (!isStaleTheme) {
          const prev = customizationRef.current;
          if (
            !areTabletopCustomizationsEqual(prev, normalized) ||
            prev.updatedAt !== normalized.updatedAt
          ) {
            setCustomization(normalized);
            saveCachedTheme(safeRoom, normalized);
          }
        }
      }

      if (Array.isArray(rawPresets)) {
        const normalizedPresets = normalizeSavedCustomPresets(rawPresets);
        if (!arePresetListsEqual(savedPresetsRef.current, normalizedPresets)) {
          setSavedPresets(normalizedPresets);
          saveCachedPresets(safeRoom, normalizedPresets);
        }
      }
    },
    [safeRoom],
  );

  // Busca inicial + polling calmo (60s) + Supabase Realtime (postgres_changes + broadcast)
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus("offline");
      return;
    }

    let cancelled = false;

    const fetchRemoteTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("id, data")
          .eq("id", recordId)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.warn("[TabletopTheme] Erro ao carregar customização da sala:", error.message);
          return;
        }

        const rowData = data?.data;
        if (rowData && typeof rowData === "object") {
          const remoteTs =
            typeof rowData.updated_at === "string"
              ? Date.parse(rowData.updated_at) || 0
              : 0;
          applyIncomingState(rowData.tabletopTheme, rowData.savedPresets, remoteTs);
        }
        setSyncStatus("synced");
      } catch (err: any) {
        if (!cancelled) {
          console.warn("[TabletopTheme] Falha de rede ao consultar tema:", err?.message || err);
        }
      }
    };

    const poller = createVisibilityPoller(fetchRemoteTheme, {
      intervalMs: 60000,
      minWakeGapMs: 3000,
      runImmediately: true,
    });

    const channel = supabase
      .channel(`tabletop_theme_${safeRoom}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${recordId}`,
        },
        (payload) => {
          const nextRow = payload.new as any;
          if (nextRow?.data && typeof nextRow.data === "object") {
            const remoteTs =
              typeof nextRow.data.updated_at === "string"
                ? Date.parse(nextRow.data.updated_at) || 0
                : 0;
            applyIncomingState(
              nextRow.data.tabletopTheme,
              nextRow.data.savedPresets,
              remoteTs,
            );
            setSyncStatus("synced");
          } else if (payload.eventType === "DELETE") {
            const def = createDefaultTabletopCustomization(safeRoom, Date.now());
            applyIncomingState(def, [], Date.now());
          }
        },
      )
      .on("broadcast", { event: "theme_update" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return;
        const p = payload as Record<string, any>;
        if ("tabletopTheme" in p || "savedPresets" in p) {
          applyIncomingState(
            p.tabletopTheme,
            p.savedPresets,
            typeof p.updatedAt === "number" ? p.updatedAt : undefined,
          );
        } else {
          // Retrocompatibilidade com payloads antigos enviando o objeto de tema diretamente
          applyIncomingState(p, undefined);
        }
        setSyncStatus("synced");
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      poller.stop();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [isOnline, safeRoom, recordId, applyIncomingState]);

  const persistRoomThemeRecord = useCallback(
    async (
      nextConfig: TabletopCustomizationConfig,
      nextPresets: TabletopCustomPreset[],
    ): Promise<TabletopThemeActionResult> => {
      if (!isMestreAuth) {
        return {
          ok: false,
          error: "Apenas o Mestre pode alterar a identidade visual da sala.",
        };
      }

      const now = Date.now();
      const normalized = normalizeTabletopCustomization(
        {
          ...nextConfig,
          roomId: safeRoom,
          updatedAt: now,
        },
        safeRoom,
      );
      const normalizedPresets = normalizeSavedCustomPresets(nextPresets);

      setIsSaving(true);
      setSyncStatus("syncing");
      setSyncError(null);

      try {
        const { error } = await supabase.from("players").upsert({
          id: recordId,
          data: {
            roomId: safeRoom,
            tabletopTheme: normalized,
            savedPresets: normalizedPresets,
            updated_at: new Date(now).toISOString(),
          },
        });

        if (error) {
          throw error;
        }

        localMutationTsRef.current = now;
        setCustomization(normalized);
        setSavedPresets(normalizedPresets);
        saveCachedTheme(safeRoom, normalized);
        saveCachedPresets(safeRoom, normalizedPresets);

        // Notificação instantânea via Realtime Broadcast para todos os jogadores na sala
        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "theme_update",
            payload: {
              tabletopTheme: normalized,
              savedPresets: normalizedPresets,
              updatedAt: now,
            },
          });
        } catch {
          // postgres_changes já garante entrega confiável
        }

        setSyncStatus("synced");
        return { ok: true };
      } catch (err: any) {
        const msg =
          typeof err?.message === "string" && err.message.trim()
            ? err.message.trim()
            : "Erro ao salvar customização no servidor.";
        setSyncError(msg);
        setSyncStatus(isOnline ? "synced" : "offline");
        return {
          ok: false,
          error: `Não foi possível sincronizar o tema com a sala: ${msg}`,
        };
      } finally {
        setIsSaving(false);
      }
    },
    [isMestreAuth, isOnline, recordId, safeRoom],
  );

  const persistCustomization = useCallback(
    async (
      nextConfig: TabletopCustomizationConfig,
    ): Promise<TabletopThemeActionResult> => {
      return persistRoomThemeRecord(nextConfig, savedPresetsRef.current);
    },
    [persistRoomThemeRecord],
  );

  const resetCustomization = useCallback(async (): Promise<TabletopThemeActionResult> => {
    const defaultConfig = createDefaultTabletopCustomization(safeRoom, Date.now());
    // Preserva todas as predefinições custom salvas ao resetar a aparência ativa
    return persistRoomThemeRecord(defaultConfig, savedPresetsRef.current);
  }, [persistRoomThemeRecord, safeRoom]);

  const saveCustomPreset = useCallback(
    async (
      name: string,
      sourceConfig: TabletopCustomizationConfig,
      existingId?: string,
    ): Promise<TabletopThemeActionResult> => {
      const preset = createCustomPresetFromConfig(name, sourceConfig, existingId);
      if (!preset) {
        return {
          ok: false,
          error: "Informe um nome válido para salvar a predefinição.",
        };
      }
      const nextPresets = upsertSavedCustomPreset(savedPresetsRef.current, preset);
      const res = await persistRoomThemeRecord(customizationRef.current, nextPresets);
      if (!res.ok) return res;
      return { ok: true, preset };
    },
    [persistRoomThemeRecord],
  );

  const deleteCustomPreset = useCallback(
    async (presetId: string): Promise<TabletopThemeActionResult> => {
      const nextPresets = deleteSavedCustomPreset(savedPresetsRef.current, presetId);
      return persistRoomThemeRecord(customizationRef.current, nextPresets);
    },
    [persistRoomThemeRecord],
  );

  const applyAppearancePreset = useCallback(
    async (
      action: "preset" | "reset",
      presetId?: string,
    ): Promise<TabletopThemeActionResult> => {
      const resolved = resolveCustomizationForAppearanceAction(
        action,
        presetId,
        savedPresetsRef.current,
        safeRoom,
      );
      if (!resolved) {
        return {
          ok: false,
          error: "Predefinição de aparência não encontrada na biblioteca da sala.",
        };
      }
      const res = await persistRoomThemeRecord(
        resolved.config,
        savedPresetsRef.current,
      );
      if (!res.ok) return res;
      return {
        ok: true,
        clearSceneBackground: resolved.clearSceneBackground,
      };
    },
    [persistRoomThemeRecord, safeRoom],
  );

  return {
    customization,
    savedPresets,
    syncStatus,
    syncError,
    isSaving,
    saveCustomization: persistCustomization,
    resetCustomization,
    saveCustomPreset,
    deleteCustomPreset,
    applyAppearancePreset,
  };
}
