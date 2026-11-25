import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  MasterDataPushEnvelope,
  MasterDataPushPayload,
} from "../types/masterDataPush";
import {
  MASTER_PUSH_PREFIX,
  applyMasterDataToSheetState,
} from "../utils/masterDataPush";
import { createVisibilityPoller } from "../utils/visibilityPolling";

export type DataPushFadePhase = "idle" | "in" | "out";

interface UseMasterDataPushSyncOptions {
  userUid: string | null;
  isMestreAuth: boolean;
  isOnline: boolean;
  onApplyPush: (payload: MasterDataPushPayload, pushId: string) => void;
  onPlayersUpdatedLocally?: (updatedRows: Record<string, any>) => void;
}

function getSeenStorageKey(uid: string | null): string {
  return `demologia_master_push_seen_${uid || "local"}`;
}

function loadSeenPushIds(uid: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getSeenStorageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    }
  } catch {}
  return new Set();
}

function saveSeenPushIds(uid: string | null, set: Set<string>) {
  try {
    const trimmed = Array.from(set).slice(-80);
    localStorage.setItem(getSeenStorageKey(uid), JSON.stringify(trimmed));
  } catch {}
}

export function useMasterDataPushSync({
  userUid,
  isMestreAuth,
  isOnline,
  onApplyPush,
  onPlayersUpdatedLocally,
}: UseMasterDataPushSyncOptions) {
  const [fadePhase, setFadePhase] = useState<DataPushFadePhase>("idle");
  const [isSending, setIsSending] = useState(false);

  const channelRef = useRef<any>(null);
  const seenPushIdsRef = useRef<Set<string>>(loadSeenPushIds(userUid));
  const onApplyPushRef = useRef(onApplyPush);
  onApplyPushRef.current = onApplyPush;
  const onPlayersUpdatedRef = useRef(onPlayersUpdatedLocally);
  onPlayersUpdatedRef.current = onPlayersUpdatedLocally;

  const timersRef = useRef<number[]>([]);

  const clearFadeTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    seenPushIdsRef.current = loadSeenPushIds(userUid);
  }, [userUid]);

  useEffect(() => {
    return () => clearFadeTimers();
  }, [clearFadeTimers]);

  const handleIncomingEnvelope = useCallback(
    (envelope: MasterDataPushEnvelope | null | undefined) => {
      if (!envelope || !envelope.id || !userUid) return;
      if (!Array.isArray(envelope.targetPlayerIds)) return;
      if (!envelope.targetPlayerIds.includes(userUid)) return;
      if (seenPushIdsRef.current.has(envelope.id)) return;

      seenPushIdsRef.current.add(envelope.id);
      saveSeenPushIds(userUid, seenPushIdsRef.current);

      clearFadeTimers();
      setFadePhase("in");

      // Apply updates once the screen has darkened (~520ms), then fade back out
      const applyTimer = window.setTimeout(() => {
        onApplyPushRef.current(envelope.payload, envelope.id);

        if (isOnline && userUid) {
          supabase
            .from("players")
            .delete()
            .eq("id", `${MASTER_PUSH_PREFIX}${userUid}`)
            .then(() => {}, () => {});
        }

        const outTimer = window.setTimeout(() => {
          setFadePhase("out");
          const idleTimer = window.setTimeout(() => {
            setFadePhase("idle");
          }, 720);
          timersRef.current.push(idleTimer);
        }, 220);

        timersRef.current.push(outTimer);
      }, 520);

      timersRef.current.push(applyTimer);
    },
    [userUid, isOnline, clearFadeTimers]
  );

  useEffect(() => {
    if (!userUid || !isOnline) return;

    let isMounted = true;
    const myPushRecordId = `${MASTER_PUSH_PREFIX}${userUid}`;

    const fetchPendingPush = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", myPushRecordId)
          .maybeSingle();

        if (!isMounted || error || !data?.data) return;
        handleIncomingEnvelope(data.data as MasterDataPushEnvelope);
      } catch {}
    };

    const poller = createVisibilityPoller(fetchPendingPush, {
      intervalMs: 45000,
      minWakeGapMs: 2000,
      runImmediately: true,
    });

    const channel = supabase
      .channel("master_data_push_channel", {
        config: { broadcast: { ack: false, self: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${myPushRecordId}`,
        },
        (payload) => {
          if (!isMounted || payload.eventType === "DELETE") return;
          const newRec = payload.new as { id?: string; data?: any } | undefined;
          if (newRec?.data) {
            handleIncomingEnvelope(newRec.data as MasterDataPushEnvelope);
          }
        }
      )
      .on("broadcast", { event: "master_data_push" }, ({ payload }) => {
        if (!isMounted || !payload) return;
        handleIncomingEnvelope(payload as MasterDataPushEnvelope);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      poller.stop();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userUid, isOnline, handleIncomingEnvelope]);

  const sendDataToPlayers = useCallback(
    async (
      targetPlayerIds: string[],
      payload: MasterDataPushPayload
    ): Promise<{ ok: boolean; updatedCount: number; error?: string }> => {
      const cleanTargets = Array.from(
        new Set(targetPlayerIds.filter((id) => typeof id === "string" && id.trim()))
      );
      if (cleanTargets.length === 0) {
        return {
          ok: false,
          updatedCount: 0,
          error: "Selecione pelo menos um player para enviar os dados.",
        };
      }
      if (
        !payload.skill &&
        !payload.tributo &&
        !payload.ritual &&
        !payload.pdi &&
        !payload.statuses
      ) {
        return {
          ok: false,
          updatedCount: 0,
          error: "Nenhum conteúdo válido selecionado para enviar aos players.",
        };
      }
      if (!isOnline) {
        return {
          ok: false,
          updatedCount: 0,
          error: "Sessão offline. Conecte-se ao Supabase para enviar dados aos players.",
        };
      }
      if (!isMestreAuth) {
        return {
          ok: false,
          updatedCount: 0,
          error: "Apenas o Mestre pode enviar alterações para os players.",
        };
      }

      setIsSending(true);
      const now = Date.now();
      const isoNow = new Date(now).toISOString();

      try {
        // 1. Fetch latest sheet state for all target players so nothing unrelated is lost
        const { data: existingRows, error: fetchError } = await supabase
          .from("players")
          .select("id, data")
          .in("id", cleanTargets);

        if (fetchError) {
          return {
            ok: false,
            updatedCount: 0,
            error: `Erro ao consultar fichas no banco: ${fetchError.message}`,
          };
        }

        const existingMap = new Map<string, any>();
        (existingRows || []).forEach((row: any) => {
          existingMap.set(row.id, row.data || {});
        });

        const envelope: MasterDataPushEnvelope = {
          id: `mdp_${now}_${Math.random().toString(36).slice(2, 7)}`,
          targetPlayerIds: cleanTargets,
          payload,
          sentAt: now,
        };

        const upserts: { id: string; data: any; updated_at: string }[] = [];
        const localPatched: Record<string, any> = {};

        cleanTargets.forEach((pid, idx) => {
          const baseData = existingMap.get(pid) || {};
          const nextData = applyMasterDataToSheetState(baseData, payload, now + idx);
          localPatched[pid] = nextData;

          upserts.push({
            id: pid,
            data: nextData,
            updated_at: isoNow,
          });
          upserts.push({
            id: `${MASTER_PUSH_PREFIX}${pid}`,
            data: envelope,
            updated_at: isoNow,
          });
        });

        // 2. Single batch upsert to persist both updated sheets and pending fade-push envelopes
        const { error: upsertError } = await supabase.from("players").upsert(upserts);
        if (upsertError) {
          return {
            ok: false,
            updatedCount: 0,
            error: `Falha ao salvar alterações no banco: ${upsertError.message}`,
          };
        }

        // 3. Real-time broadcast for immediate fade-in/out on online players
        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "master_data_push",
            payload: envelope,
          });
        }

        onPlayersUpdatedRef.current?.(localPatched);

        return { ok: true, updatedCount: cleanTargets.length };
      } catch (err: any) {
        return {
          ok: false,
          updatedCount: 0,
          error: err?.message || "Erro inesperado ao enviar dados.",
        };
      } finally {
        setIsSending(false);
      }
    },
    [isOnline, isMestreAuth]
  );

  return {
    fadePhase,
    isSending,
    sendDataToPlayers,
  };
}
