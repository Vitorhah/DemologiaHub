import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  NarrativeScene,
  PublicSceneDirectorState,
  SceneBuilderNode,
  SceneDirectorMasterState,
  TensionClock,
} from "../types/sceneDirector";
import { normalizeSceneBuilderNodes } from "../utils/sceneBuilder";
import {
  SCENE_DIRECTOR_LOCAL_KEY,
  SCENE_DIRECTOR_MASTER_RECORD_ID,
  SCENE_DIRECTOR_SHARED_RECORD_ID,
  advanceTensionClock,
  buildPublicSceneDirectorPayload,
  normalizeNarrativeScene,
  normalizePublicSceneDirectorState,
  normalizeSceneDirectorMasterState,
  normalizeTensionClock,
  resetTensionClock,
  setTensionClockFilled,
} from "../utils/sceneDirector";
import { createVisibilityPoller } from "../utils/visibilityPolling";

export interface SceneDirectorActionResult {
  ok: boolean;
  error?: string;
}

interface UseSceneDirectorSyncOptions {
  isMestreAuth: boolean;
  isOnline: boolean;
  onPublicSceneActivated?: (sceneTitle: string, atmosphere: string) => void;
  onPublicClockCompleted?: (clockTitle: string) => void;
}

function loadLocalMasterState(): SceneDirectorMasterState {
  try {
    const raw = localStorage.getItem(SCENE_DIRECTOR_LOCAL_KEY);
    if (!raw) {
      return { scenes: [], activeSceneId: null, clocks: [], updatedAt: 0 };
    }
    return normalizeSceneDirectorMasterState(JSON.parse(raw));
  } catch {
    return { scenes: [], activeSceneId: null, clocks: [], updatedAt: 0 };
  }
}

function saveLocalMasterState(state: SceneDirectorMasterState) {
  try {
    localStorage.setItem(SCENE_DIRECTOR_LOCAL_KEY, JSON.stringify(state));
  } catch {}
}

export function useSceneDirectorSync({
  isMestreAuth,
  isOnline,
  onPublicSceneActivated,
  onPublicClockCompleted,
}: UseSceneDirectorSyncOptions) {
  const initialRef = useRef<SceneDirectorMasterState | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadLocalMasterState();
  }

  const [masterState, setMasterState] = useState<SceneDirectorMasterState>(
    initialRef.current,
  );
  const [publicState, setPublicState] = useState<PublicSceneDirectorState>(() =>
    buildPublicSceneDirectorPayload(
      initialRef.current!,
      initialRef.current!.updatedAt,
    ),
  );
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline",
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const masterStateRef = useRef(masterState);
  masterStateRef.current = masterState;
  const publicStateRef = useRef(publicState);
  publicStateRef.current = publicState;
  const localMutationTsRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const onSceneActivatedRef = useRef(onPublicSceneActivated);
  onSceneActivatedRef.current = onPublicSceneActivated;
  const onClockCompletedRef = useRef(onPublicClockCompleted);
  onClockCompletedRef.current = onPublicClockCompleted;

  // Keep local backup for Master
  useEffect(() => {
    if (!isMestreAuth) return;
    saveLocalMasterState(masterState);
  }, [masterState, isMestreAuth]);

  const applyIncomingPublicState = useCallback(
    (rawPayload: unknown, notifyTransitions: boolean) => {
      const next = normalizePublicSceneDirectorState(rawPayload);
      if (next.updatedAt > 0 && next.updatedAt < localMutationTsRef.current) {
        return;
      }
      const prev = publicStateRef.current;

      if (notifyTransitions) {
        if (
          next.activeScene &&
          (!prev.activeScene ||
            prev.activeScene.id !== next.activeScene.id ||
            prev.activeScene.activatedAt !== next.activeScene.activatedAt)
        ) {
          onSceneActivatedRef.current?.(
            next.activeScene.title,
            next.activeScene.atmosphere,
          );
        }

        const prevClockMap = new Map<
          string,
          PublicSceneDirectorState["visibleClocks"][number]
        >(prev.visibleClocks.map((c) => [c.id, c]));
        for (const clock of next.visibleClocks) {
          const prevClock = prevClockMap.get(clock.id);
          const wasComplete =
            prevClock && prevClock.filled >= prevClock.segments;
          const isNowComplete = clock.filled >= clock.segments;
          if (!wasComplete && isNowComplete) {
            onClockCompletedRef.current?.(clock.title);
          }
        }
      }

      setPublicState(next);
    },
    [],
  );

  // Subscribe to Realtime broadcast + Supabase table sync
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus("offline");
      return;
    }

    let isMounted = true;

    const fetchInitial = async () => {
      try {
        if (isMestreAuth) {
          const { data, error } = await supabase
            .from("players")
            .select("data")
            .eq("id", SCENE_DIRECTOR_MASTER_RECORD_ID)
            .maybeSingle();

          if (!isMounted) return;
          if (!error && data?.data) {
            const remote = normalizeSceneDirectorMasterState(data.data);
            if (remote.updatedAt >= localMutationTsRef.current) {
              setMasterState(remote);
              setPublicState(
                buildPublicSceneDirectorPayload(remote, remote.updatedAt),
              );
            }
          }
          setSyncStatus("synced");
          setSyncError(null);
        } else {
          const { data, error } = await supabase
            .from("players")
            .select("data")
            .eq("id", SCENE_DIRECTOR_SHARED_RECORD_ID)
            .maybeSingle();

          if (!isMounted) return;
          if (!error && data?.data) {
            applyIncomingPublicState(data.data, false);
          }
          setSyncStatus("synced");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setSyncStatus("offline");
        if (isMestreAuth) {
          setSyncError(err?.message || "Falha ao sincronizar Direção de Cena.");
        }
      }
    };

    void fetchInitial();

    const broadcastChannel = supabase
      .channel("demologia_scene_director_v1")
      .on("broadcast", { event: "scene_director_update" }, (msg: any) => {
        if (!isMounted || !msg?.payload) return;
        if (!isMestreAuth) {
          applyIncomingPublicState(msg.payload, true);
        }
      })
      .subscribe();

    const pgChannelName = `demologia_scene_director_pg_${isMestreAuth ? "m" : "p"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pgChannel = supabase
      .channel(pgChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: isMestreAuth
            ? `id=eq.${SCENE_DIRECTOR_MASTER_RECORD_ID}`
            : `id=eq.${SCENE_DIRECTOR_SHARED_RECORD_ID}`,
        },
        (payload: any) => {
          if (!isMounted) return;
          const recordData = payload?.new?.data;
          if (!recordData) return;
          if (isMestreAuth) {
            const remote = normalizeSceneDirectorMasterState(recordData);
            if (remote.updatedAt > localMutationTsRef.current) {
              setMasterState(remote);
              setPublicState(
                buildPublicSceneDirectorPayload(remote, remote.updatedAt),
              );
            }
          } else {
            applyIncomingPublicState(recordData, true);
          }
        },
      )
      .subscribe();

    channelRef.current = broadcastChannel;

    const poller = createVisibilityPoller(
      () => {
        if (isMounted) void fetchInitial();
      },
      {
        intervalMs: isMestreAuth ? 45000 : 25000,
        runImmediately: false,
      },
    );

    return () => {
      isMounted = false;
      poller.stop();
      channelRef.current = null;
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(pgChannel);
    };
  }, [isMestreAuth, isOnline, applyIncomingPublicState]);

  const persistMasterAndPublic = useCallback(
    async (
      nextMaster: SceneDirectorMasterState,
    ): Promise<SceneDirectorActionResult> => {
      const now = Date.now();
      const stampedMaster: SceneDirectorMasterState = {
        ...nextMaster,
        updatedAt: now,
      };
      const nextPublic = buildPublicSceneDirectorPayload(stampedMaster, now);

      localMutationTsRef.current = now;
      setMasterState(stampedMaster);
      setPublicState(nextPublic);
      saveLocalMasterState(stampedMaster);

      if (!isOnline) {
        setSyncStatus("offline");
        return { ok: true };
      }

      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const isoNow = new Date(now).toISOString();
        const [masterRes, sharedRes] = await Promise.all([
          supabase.from("players").upsert({
            id: SCENE_DIRECTOR_MASTER_RECORD_ID,
            data: stampedMaster,
            updated_at: isoNow,
          }),
          supabase.from("players").upsert({
            id: SCENE_DIRECTOR_SHARED_RECORD_ID,
            data: nextPublic,
            updated_at: isoNow,
          }),
        ]);

        const err = masterRes.error || sharedRes.error;
        if (err) {
          setSyncStatus("offline");
          setSyncError(err.message || "Erro ao salvar Direção no Supabase.");
          return { ok: false, error: err.message };
        }

        try {
          channelRef.current?.send({
            type: "broadcast",
            event: "scene_director_update",
            payload: nextPublic,
          });
        } catch {}

        setSyncStatus("synced");
        return { ok: true };
      } catch (err: any) {
        setSyncStatus("offline");
        const msg = err?.message || "Erro de rede ao sincronizar Direção.";
        setSyncError(msg);
        return { ok: false, error: msg };
      }
    },
    [isOnline],
  );

  // --- SCENE CRUD ---
  const saveScene = useCallback(
    async (
      draft: Partial<NarrativeScene> & { title: string },
    ): Promise<SceneDirectorActionResult> => {
      const now = Date.now();
      const current = masterStateRef.current;
      const existing = draft.id
        ? current.scenes.find((s) => s.id === draft.id)
        : undefined;
      const normalized = normalizeNarrativeScene({
        ...existing,
        ...draft,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      const nextScenes = existing
        ? current.scenes.map((s) => (s.id === normalized.id ? normalized : s))
        : [normalized, ...current.scenes];

      return persistMasterAndPublic({
        ...current,
        scenes: nextScenes,
      });
    },
    [persistMasterAndPublic],
  );

  const saveSceneNodes = useCallback(
    async (
      sceneId: string,
      nodes: SceneBuilderNode[],
    ): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const target = current.scenes.find((s) => s.id === sceneId);
      if (!target) return { ok: false, error: "Cena não encontrada." };
      const now = Date.now();
      const normalizedNodes = normalizeSceneBuilderNodes(nodes);
      return persistMasterAndPublic({
        ...current,
        scenes: current.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, timelineNodes: normalizedNodes, updatedAt: now }
            : s,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const duplicateScene = useCallback(
    async (sceneId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const source = current.scenes.find((s) => s.id === sceneId);
      if (!source) return { ok: false, error: "Cena não encontrada." };
      const now = Date.now();
      const copy = normalizeNarrativeScene({
        ...source,
        id: `scene_${now}_${Math.random().toString(36).slice(2, 7)}`,
        title: `${source.title} (Cópia)`,
        createdAt: now,
        updatedAt: now,
      });
      return persistMasterAndPublic({
        ...current,
        scenes: [copy, ...current.scenes],
      });
    },
    [persistMasterAndPublic],
  );

  const deleteScene = useCallback(
    async (sceneId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      return persistMasterAndPublic({
        ...current,
        scenes: current.scenes.filter((s) => s.id !== sceneId),
        activeSceneId:
          current.activeSceneId === sceneId ? null : current.activeSceneId,
      });
    },
    [persistMasterAndPublic],
  );

  const activateScene = useCallback(
    async (sceneId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const exists = current.scenes.some((s) => s.id === sceneId);
      if (!exists) return { ok: false, error: "Cena não encontrada." };
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        activeSceneId: sceneId,
        scenes: current.scenes.map((s) =>
          s.id === sceneId ? { ...s, updatedAt: now } : s,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const deactivateScene = useCallback(async (): Promise<SceneDirectorActionResult> => {
    const current = masterStateRef.current;
    return persistMasterAndPublic({
      ...current,
      activeSceneId: null,
    });
  }, [persistMasterAndPublic]);

  const toggleSceneVisibility = useCallback(
    async (sceneId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        scenes: current.scenes.map((s) =>
          s.id === sceneId
            ? { ...s, visibleToPlayers: !s.visibleToPlayers, updatedAt: now }
            : s,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  // --- TENSION CLOCKS CRUD ---
  const saveClock = useCallback(
    async (
      draft: Partial<TensionClock> & { title: string },
    ): Promise<SceneDirectorActionResult> => {
      const now = Date.now();
      const current = masterStateRef.current;
      const existing = draft.id
        ? current.clocks.find((c) => c.id === draft.id)
        : undefined;
      const normalized = normalizeTensionClock({
        ...existing,
        ...draft,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      const nextClocks = existing
        ? current.clocks.map((c) => (c.id === normalized.id ? normalized : c))
        : [normalized, ...current.clocks];

      return persistMasterAndPublic({
        ...current,
        clocks: nextClocks,
      });
    },
    [persistMasterAndPublic],
  );

  const stepClock = useCallback(
    async (clockId: string, delta: number): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        clocks: current.clocks.map((c) =>
          c.id === clockId ? advanceTensionClock(c, delta, now) : c,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const setClockSegmentsFilled = useCallback(
    async (
      clockId: string,
      filled: number,
    ): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        clocks: current.clocks.map((c) =>
          c.id === clockId ? setTensionClockFilled(c, filled, now) : c,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const clearClockProgress = useCallback(
    async (clockId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        clocks: current.clocks.map((c) =>
          c.id === clockId ? resetTensionClock(c, now) : c,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const toggleClockVisibility = useCallback(
    async (clockId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      const now = Date.now();
      return persistMasterAndPublic({
        ...current,
        clocks: current.clocks.map((c) =>
          c.id === clockId
            ? { ...c, visibleToPlayers: !c.visibleToPlayers, updatedAt: now }
            : c,
        ),
      });
    },
    [persistMasterAndPublic],
  );

  const deleteClock = useCallback(
    async (clockId: string): Promise<SceneDirectorActionResult> => {
      const current = masterStateRef.current;
      return persistMasterAndPublic({
        ...current,
        clocks: current.clocks.filter((c) => c.id !== clockId),
      });
    },
    [persistMasterAndPublic],
  );

  return {
    masterState,
    publicState,
    syncStatus,
    syncError,
    saveScene,
    saveSceneNodes,
    duplicateScene,
    deleteScene,
    activateScene,
    deactivateScene,
    toggleSceneVisibility,
    saveClock,
    stepClock,
    setClockSegmentsFilled,
    clearClockProgress,
    toggleClockVisibility,
    deleteClock,
  };
}
