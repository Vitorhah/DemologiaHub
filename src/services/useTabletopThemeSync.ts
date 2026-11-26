import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { TabletopCustomizationConfig } from "../types/tabletopCustomization";
import {
  applyTabletopCustomizationToDom,
  areTabletopCustomizationsEqual,
  createDefaultTabletopCustomization,
  getTabletopThemeLocalKey,
  getTabletopThemeRecordId,
  normalizeTabletopCustomization,
  sanitizeRoomKey,
} from "../utils/tabletopCustomization";
import { createVisibilityPoller } from "../utils/visibilityPolling";

export interface TabletopThemeActionResult {
  ok: boolean;
  error?: string;
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

/**
 * Sincroniza a identidade visual compartilhada do Tabletop para TODOS os usuários
 * conectados à sala via Supabase (`players` + Realtime + Broadcast).
 * - Apenas o Mestre (`isMestreAuth === true`) pode persistir ou resetar o tema.
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
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const customizationRef = useRef(customization);
  customizationRef.current = customization;
  const localMutationTsRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Recarrega cache caso a sala mude
  useEffect(() => {
    const cached = loadCachedTheme(safeRoom);
    setCustomization(cached);
  }, [safeRoom]);

  // Aplica imediatamente no DOM sempre que a configuração ativa da sala mudar
  useEffect(() => {
    applyTabletopCustomizationToDom(customization);
  }, [customization]);

  const applyIncomingConfig = useCallback(
    (rawPayload: unknown) => {
      const normalized = normalizeTabletopCustomization(rawPayload, safeRoom);
      if (
        normalized.updatedAt > 0 &&
        localMutationTsRef.current > 0 &&
        normalized.updatedAt < localMutationTsRef.current
      ) {
        return;
      }

      const prev = customizationRef.current;
      if (
        areTabletopCustomizationsEqual(prev, normalized) &&
        prev.updatedAt === normalized.updatedAt
      ) {
        return;
      }

      setCustomization(normalized);
      saveCachedTheme(safeRoom, normalized);
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

        if (data?.data?.tabletopTheme) {
          applyIncomingConfig(data.data.tabletopTheme);
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
          if (nextRow?.data?.tabletopTheme) {
            applyIncomingConfig(nextRow.data.tabletopTheme);
            setSyncStatus("synced");
          } else if (payload.eventType === "DELETE") {
            const def = createDefaultTabletopCustomization(safeRoom, Date.now());
            applyIncomingConfig(def);
          }
        },
      )
      .on("broadcast", { event: "theme_update" }, ({ payload }) => {
        if (payload && typeof payload === "object") {
          applyIncomingConfig(payload);
          setSyncStatus("synced");
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      poller.stop();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [isOnline, safeRoom, recordId, applyIncomingConfig]);

  const persistCustomization = useCallback(
    async (
      nextConfig: TabletopCustomizationConfig,
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

      setIsSaving(true);
      setSyncStatus("syncing");
      setSyncError(null);

      try {
        const { error } = await supabase.from("players").upsert({
          id: recordId,
          data: {
            roomId: safeRoom,
            tabletopTheme: normalized,
            updated_at: new Date(now).toISOString(),
          },
        });

        if (error) {
          throw error;
        }

        localMutationTsRef.current = now;
        setCustomization(normalized);
        saveCachedTheme(safeRoom, normalized);

        // Notificação instantânea via Realtime Broadcast para todos os jogadores na sala
        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "theme_update",
            payload: normalized,
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

  const resetCustomization = useCallback(async (): Promise<TabletopThemeActionResult> => {
    const defaultConfig = createDefaultTabletopCustomization(safeRoom, Date.now());
    return persistCustomization(defaultConfig);
  }, [persistCustomization, safeRoom]);

  return {
    customization,
    syncStatus,
    syncError,
    isSaving,
    saveCustomization: persistCustomization,
    resetCustomization,
  };
}
