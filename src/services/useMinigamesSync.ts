import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  MinigameAssignment,
  MinigameConfig,
  MinigameResultPayload,
  MinigameToastNotification,
} from "../types/minigames";
import {
  MINIGAME_ASSIGN_PREFIX,
  MINIGAME_RESULTS_RECORD_ID,
  normalizeMinigameConfig,
} from "../utils/minigamesLogic";
import { createVisibilityPoller } from "../utils/visibilityPolling";

interface UseMinigamesSyncOptions {
  userUid: string | null;
  playerName: string;
  isMestreAuth: boolean;
  isOnline: boolean;
}

function getDoneStorageKey(uid: string | null): string {
  return `demologia_minigames_done_${uid || "local"}`;
}

function loadDoneIds(uid: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getDoneStorageKey(uid));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch {}
  return new Set();
}

function saveDoneIds(uid: string | null, set: Set<string>) {
  try {
    const trimmed = Array.from(set).slice(-80);
    localStorage.setItem(getDoneStorageKey(uid), JSON.stringify(trimmed));
  } catch {}
}

export function useMinigamesSync({
  userUid,
  playerName,
  isMestreAuth,
  isOnline,
}: UseMinigamesSyncOptions) {
  const [activeAssignment, setActiveAssignment] = useState<MinigameAssignment | null>(
    null
  );
  const [recentResults, setRecentResults] = useState<MinigameResultPayload[]>([]);
  const [toastNotification, setToastNotification] =
    useState<MinigameToastNotification | null>(null);
  const [isSending, setIsSending] = useState(false);

  const channelRef = useRef<any>(null);
  const doneAssignmentIdsRef = useRef<Set<string>>(loadDoneIds(userUid));
  const seenResultIdsRef = useRef<Set<string>>(new Set());
  const isInitialMasterResultsLoadRef = useRef<boolean>(true);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  useEffect(() => {
    doneAssignmentIdsRef.current = loadDoneIds(userUid);
  }, [userUid]);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  const handleIncomingAssignment = useCallback(
    (incoming: MinigameAssignment | null | undefined) => {
      if (!incoming || !incoming.id || !userUid) return;
      if (!Array.isArray(incoming.targetPlayerIds)) return;
      if (!incoming.targetPlayerIds.includes(userUid)) return;
      if (doneAssignmentIdsRef.current.has(incoming.id)) return;

      const normalized: MinigameAssignment = {
        ...incoming,
        config: normalizeMinigameConfig(incoming.config),
      };

      setActiveAssignment((prev) => {
        if (prev?.id === normalized.id) return prev;
        return normalized;
      });
    },
    [userUid]
  );

  const handleIncomingResult = useCallback(
    (res: MinigameResultPayload, showToast: boolean) => {
      if (!res || !res.id) return;
      if (seenResultIdsRef.current.has(res.id)) return;
      seenResultIdsRef.current.add(res.id);

      setRecentResults((prev) => {
        if (prev.some((r) => r.id === res.id)) return prev;
        return [res, ...prev].slice(0, 20);
      });

      if (showToast && isMestreAuth) {
        setToastNotification({
          id: `${res.id}_${Date.now()}`,
          result: res,
        });
      }
    },
    [isMestreAuth]
  );

  // Realtime subscription + initial fetch + fallback polling
  useEffect(() => {
    if (!userUid || !isOnline) return;

    let isMounted = true;
    const myAssignRecordId = `${MINIGAME_ASSIGN_PREFIX}${userUid}`;

    const fetchPlayerAssignment = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", myAssignRecordId)
          .maybeSingle();

        if (!isMounted || error || !data?.data) return;
        const asg = data.data as MinigameAssignment;
        if (asg?.id && !doneAssignmentIdsRef.current.has(asg.id)) {
          handleIncomingAssignment(asg);
        }
      } catch {}
    };

    const fetchMasterResults = async () => {
      if (!isMestreAuth) return;
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", MINIGAME_RESULTS_RECORD_ID)
          .maybeSingle();

        if (!isMounted || error || !data?.data) return;
        const list: MinigameResultPayload[] = Array.isArray(data.data.results)
          ? data.data.results
          : [];
        const allowToast = !isInitialMasterResultsLoadRef.current;
        list.forEach((r) => handleIncomingResult(r, allowToast));
        isInitialMasterResultsLoadRef.current = false;
      } catch {}
    };

    if (isMestreAuth) {
      isInitialMasterResultsLoadRef.current = true;
    }

    const poller = createVisibilityPoller(
      () => {
        fetchPlayerAssignment();
        if (isMestreAuth) fetchMasterResults();
      },
      {
        intervalMs: 45000,
        minWakeGapMs: 2000,
        runImmediately: true,
      }
    );

    const channel = supabase
      .channel("minigames_realtime_channel", {
        config: { broadcast: { ack: false, self: true } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          if (!isMounted) return;
          const newRec = payload.new as { id?: string; data?: any } | undefined;
          const recId = newRec?.id;
          if (!recId) return;

          if (
            recId === myAssignRecordId &&
            payload.eventType !== "DELETE" &&
            newRec?.data
          ) {
            handleIncomingAssignment(newRec.data as MinigameAssignment);
          }

          if (
            isMestreAuth &&
            recId === MINIGAME_RESULTS_RECORD_ID &&
            newRec?.data &&
            Array.isArray(newRec.data.results)
          ) {
            isInitialMasterResultsLoadRef.current = false;
            (newRec.data.results as MinigameResultPayload[]).forEach((r) =>
              handleIncomingResult(r, true)
            );
          }
        }
      )
      .on("broadcast", { event: "minigame_assign" }, ({ payload }) => {
        if (!isMounted || !payload) return;
        handleIncomingAssignment(payload as MinigameAssignment);
      })
      .on("broadcast", { event: "minigame_result" }, ({ payload }) => {
        if (!isMounted || !payload) return;
        isInitialMasterResultsLoadRef.current = false;
        handleIncomingResult(payload as MinigameResultPayload, true);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      poller.stop();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userUid, isOnline, isMestreAuth, handleIncomingAssignment, handleIncomingResult]);

  // Master sends minigame to selected player IDs
  const sendMinigame = useCallback(
    async (
      config: MinigameConfig,
      targetPlayerIds: string[]
    ): Promise<{ ok: boolean; error?: string }> => {
      const cleanTargets = Array.from(
        new Set(targetPlayerIds.filter((id) => typeof id === "string" && id.trim()))
      );
      if (cleanTargets.length === 0) {
        return { ok: false, error: "Selecione pelo menos um player para enviar." };
      }
      if (!isOnline) {
        return {
          ok: false,
          error: "Sessão offline. Conecte-se para enviar minigames aos players.",
        };
      }

      const now = Date.now();
      const normalizedConfig = normalizeMinigameConfig(config);
      const assignment: MinigameAssignment = {
        id: `mg_${now}_${Math.random().toString(36).slice(2, 7)}`,
        config: normalizedConfig,
        targetPlayerIds: cleanTargets,
        createdAt: now,
        senderName: "Mestre",
      };

      setIsSending(true);
      try {
        const upserts = cleanTargets.map((pid) => ({
          id: `${MINIGAME_ASSIGN_PREFIX}${pid}`,
          data: assignment,
          updated_at: new Date(now).toISOString(),
        }));

        const { error } = await supabase.from("players").upsert(upserts);
        if (error) {
          return {
            ok: false,
            error: `Falha ao enviar para o banco: ${error.message}`,
          };
        }

        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "minigame_assign",
            payload: assignment,
          });
        }

        return { ok: true };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || "Erro ao transmitir minigame.",
        };
      } finally {
        setIsSending(false);
      }
    },
    [isOnline]
  );

  // Player submits completed minigame outcome to Master
  const submitResult = useCallback(
    async (
      assignment: MinigameAssignment,
      hits: number,
      errors: number,
      success: boolean
    ) => {
      const now = Date.now();
      doneAssignmentIdsRef.current.add(assignment.id);
      saveDoneIds(userUid, doneAssignmentIdsRef.current);

      const cleanPlayerId = userUid || "local_player";
      const resultPayload: MinigameResultPayload = {
        id: `mgr_${assignment.id}_${cleanPlayerId}`,
        assignmentId: assignment.id,
        minigameType: assignment.config.type,
        playerId: cleanPlayerId,
        playerName: (playerNameRef.current || "Agente").trim() || "Agente",
        hits,
        totalRounds: assignment.config.rounds,
        errors,
        maxErrors: assignment.config.maxErrors,
        success,
        finishedAt: now,
      };

      try {
        if (isOnline && userUid) {
          // 1. Broadcast immediately for sub-second Master toast
          if (channelRef.current) {
            await channelRef.current.send({
              type: "broadcast",
              event: "minigame_result",
              payload: resultPayload,
            });
          }

          // 2. Clean up player's pending assignment row
          await supabase
            .from("players")
            .delete()
            .eq("id", `${MINIGAME_ASSIGN_PREFIX}${userUid}`);

          // 3. Persist result in MINIGAME_RESULTS inbox as fallback
          const { data: existingRow } = await supabase
            .from("players")
            .select("data")
            .eq("id", MINIGAME_RESULTS_RECORD_ID)
            .maybeSingle();

          const currentList: MinigameResultPayload[] = Array.isArray(
            existingRow?.data?.results
          )
            ? existingRow.data.results
            : [];

          const nextList = [
            resultPayload,
            ...currentList.filter((r) => r.id !== resultPayload.id),
          ].slice(0, 25);

          await supabase.from("players").upsert({
            id: MINIGAME_RESULTS_RECORD_ID,
            data: { results: nextList, updatedAt: now },
            updated_at: new Date(now).toISOString(),
          });
        }
      } catch (err) {
        console.warn("Falha ao enviar resultado do minigame:", err);
      }
    },
    [userUid, isOnline]
  );

  const dismissActiveMinigame = useCallback(() => {
    setActiveAssignment(null);
  }, []);

  const clearRecentResults = useCallback(async () => {
    setRecentResults([]);
    if (isOnline && isMestreAuth) {
      try {
        await supabase.from("players").upsert({
          id: MINIGAME_RESULTS_RECORD_ID,
          data: { results: [], updatedAt: Date.now() },
          updated_at: new Date().toISOString(),
        });
      } catch {}
    }
  }, [isOnline, isMestreAuth]);

  return {
    activeAssignment,
    recentResults,
    toastNotification,
    isSending,
    sendMinigame,
    submitResult,
    dismissActiveMinigame,
    dismissToast,
    clearRecentResults,
  };
}
