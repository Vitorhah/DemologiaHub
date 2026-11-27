import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseAnonKey, supabaseUrl } from "../lib/supabase";
import type {
  CreatePollInput,
  PauseMutationInput,
  PollComputedResults,
  PollVoteRecord,
  SessionPauseState,
  SessionPoll,
  SessionUtilityActionResult,
} from "../types/sessionUtilities";
import {
  PAUSE_HEARTBEAT_INTERVAL_MS,
  canMasterControlPause,
  computePollResults,
  createMasterSessionToken,
  createPollId,
  getPauseFallbackRecordId,
  getPollFallbackRecordId,
  getPollRemainingSeconds,
  getPollVoteFallbackPrefix,
  getPollVoteFallbackRecordId,
  hashMasterSessionToken,
  isPauseEffectivelyActive,
  isPollClosed,
  mergePollVoteList,
  normalizePollVoteRecord,
  normalizeSessionPauseState,
  normalizeSessionPoll,
  validateCreatePollInput,
  validatePauseInput,
} from "../utils/sessionUtilities";
import { isTableMissingError } from "../utils/masterNotes";
import { sanitizeRoomKey } from "../utils/tabletopCustomization";
import { createVisibilityPoller } from "../utils/visibilityPolling";

type UtilitiesBackendMode = "unknown" | "dedicated" | "players_fallback";

let cachedBackendMode: UtilitiesBackendMode = "unknown";

function isMissingRpcOrTableError(error: any): boolean {
  if (!error) return false;
  if (isTableMissingError(error)) return true;
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

interface UseSessionUtilitiesSyncOptions {
  roomId: string;
  userUid: string | null;
  isMestreAuth: boolean;
  isOnline: boolean;
}

export interface UseSessionUtilitiesSyncReturn {
  roomId: string;
  pauseState: SessionPauseState | null;
  isPauseActiveForPlayers: boolean;
  isPauseActiveForSession: boolean;
  isCurrentMasterPauseOwner: boolean;
  isSavingPause: boolean;
  pauseError: string | null;
  activateOrUpdatePause: (
    input: PauseMutationInput,
  ) => Promise<SessionUtilityActionResult>;
  endPause: () => Promise<SessionUtilityActionResult>;
  releaseOwnedPauseOnLogout: () => Promise<void>;

  activePoll: SessionPoll | null;
  pollVotes: PollVoteRecord[];
  pollResults: PollComputedResults | null;
  isPollClosedNow: boolean;
  pollRemainingSeconds: number;
  isPollPopupOpen: boolean;
  isSavingPoll: boolean;
  isSubmittingVote: boolean;
  pollError: string | null;
  createPoll: (input: CreatePollInput) => Promise<SessionUtilityActionResult>;
  closePoll: () => Promise<SessionUtilityActionResult>;
  castVote: (optionId: string) => Promise<SessionUtilityActionResult>;
  dismissPollPopup: () => void;
  reopenPollPopup: () => void;
  clearMasterPollView: () => void;
}

/**
 * Sincronização em tempo real (Supabase Realtime + Broadcast + Fallback seguro)
 * para as funcionalidades administrativas Pause e Enquete na aba Utilidades.
 *
 * Garantias:
 * - Isolamento rigoroso por `roomId` e `masterId`.
 * - Apenas o Mestre autenticado (e responsável pela sessão) pode ativar, alterar ou encerrar.
 * - Heartbeat automático + liberação no logout/desconexão impedem Pause travado indefinidamente.
 * - Voto único por jogador por enquete validado no backend/banco e deduplicado no cliente.
 * - Reconexão e restauração de aba sincronizam integralmente o estado atual.
 */
export function useSessionUtilitiesSync({
  roomId,
  userUid,
  isMestreAuth,
  isOnline,
}: UseSessionUtilitiesSyncOptions): UseSessionUtilitiesSyncReturn {
  const safeRoom = sanitizeRoomKey(roomId);
  const pauseRecordId = getPauseFallbackRecordId(safeRoom);
  const pollRecordId = getPollFallbackRecordId(safeRoom);

  const [pauseState, setPauseState] = useState<SessionPauseState | null>(null);
  const [isSavingPause, setIsSavingPause] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const [activePoll, setActivePoll] = useState<SessionPoll | null>(null);
  const [pollVotes, setPollVotes] = useState<PollVoteRecord[]>([]);
  const [dismissedPollId, setDismissedPollId] = useState<string | null>(null);
  const [clearedMasterPollId, setClearedMasterPollId] = useState<string | null>(
    null,
  );
  const [isSavingPoll, setIsSavingPoll] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const [clockNow, setClockNow] = useState<number>(() => Date.now());

  // Ephemeral in-memory Master session token & its SHA-256 hash (never stored in localStorage)
  const masterTokenRef = useRef<string>("");
  const masterTokenHashRef = useRef<string>("");
  const [masterTokenHash, setMasterTokenHash] = useState<string>("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pauseStateRef = useRef<SessionPauseState | null>(pauseState);
  pauseStateRef.current = pauseState;
  const activePollRef = useRef<SessionPoll | null>(activePoll);
  activePollRef.current = activePoll;
  const pollVotesRef = useRef<PollVoteRecord[]>(pollVotes);
  pollVotesRef.current = pollVotes;
  const autoClosedPollIdRef = useRef<string | null>(null);
  const hasHydratedInitialPollRef = useRef<boolean>(false);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);

  // Gera token efêmero de sessão do Mestre ao autenticar; limpa ao sair
  useEffect(() => {
    let cancelled = false;
    if (isMestreAuth && userUid) {
      if (!masterTokenRef.current) {
        masterTokenRef.current = createMasterSessionToken();
      }
      hashMasterSessionToken(masterTokenRef.current).then((hash) => {
        if (!cancelled) {
          masterTokenHashRef.current = hash;
          setMasterTokenHash(hash);
        }
      });
    } else {
      masterTokenRef.current = "";
      masterTokenHashRef.current = "";
      setMasterTokenHash("");
    }
    return () => {
      cancelled = true;
    };
  }, [isMestreAuth, userUid]);

  const ensureMasterCredentials = useCallback(async (): Promise<{
    masterId: string;
    token: string;
    hash: string;
  } | null> => {
    if (!isMestreAuth || !userUid) return null;
    if (!masterTokenRef.current) {
      masterTokenRef.current = createMasterSessionToken();
    }
    if (!masterTokenHashRef.current) {
      const h = await hashMasterSessionToken(masterTokenRef.current);
      masterTokenHashRef.current = h;
      setMasterTokenHash(h);
    }
    return {
      masterId: userUid,
      token: masterTokenRef.current,
      hash: masterTokenHashRef.current,
    };
  }, [isMestreAuth, userUid]);

  const applyIncomingPause = useCallback(
    (raw: unknown) => {
      if (!raw) {
        pauseStateRef.current = null;
        setPauseState(null);
        return;
      }
      const normalized = normalizeSessionPauseState(raw, safeRoom);
      if (!normalized) return;
      const prev = pauseStateRef.current;
      if (prev && normalized.updatedAt < prev.updatedAt) {
        return;
      }
      pauseStateRef.current = normalized;
      setPauseState(normalized);
    },
    [safeRoom],
  );

  const fetchVotesForPoll = useCallback(
    async (pollId: string): Promise<PollVoteRecord[]> => {
      if (!pollId) return [];
      if (cachedBackendMode !== "players_fallback") {
        const { data, error } = await supabase
          .from("tabletop_poll_votes")
          .select("poll_id, room_id, voter_id, option_id, created_at")
          .eq("poll_id", pollId)
          .eq("room_id", safeRoom);

        if (!error) {
          cachedBackendMode = "dedicated";
          const list: PollVoteRecord[] = [];
          for (const row of data || []) {
            const norm = normalizePollVoteRecord(row, pollId, safeRoom);
            if (norm) list.push(norm);
          }
          return list;
        }
        if (!isMissingRpcOrTableError(error)) {
          return [];
        }
        cachedBackendMode = "players_fallback";
      }

      const prefix = getPollVoteFallbackPrefix(pollId);
      const { data, error } = await supabase
        .from("players")
        .select("id, data")
        .like("id", `${prefix}%`);

      if (error || !Array.isArray(data)) return [];
      const list: PollVoteRecord[] = [];
      for (const row of data) {
        const norm = normalizePollVoteRecord(row?.data, pollId, safeRoom);
        if (norm) list.push(norm);
      }
      return list;
    },
    [safeRoom],
  );

  const applyIncomingPoll = useCallback(
    (
      raw: unknown,
      isInitialHydration = false,
      options?: { skipAutoVoteFetch?: boolean },
    ) => {
      const normalized = normalizeSessionPoll(raw, safeRoom);
      if (!normalized) return;

      const prev = activePollRef.current;
      const isNewPoll = !prev || prev.id !== normalized.id;

      if (prev && prev.id === normalized.id && normalized.updatedAt < prev.updatedAt) {
        return;
      }

      activePollRef.current = normalized;
      setActivePoll(normalized);
      setClockNow(Date.now());

      if (isNewPoll) {
        setClearedMasterPollId((curr) => (curr === normalized.id ? curr : null));
        // Em hidratação inicial, evita reabrir popup de uma enquete encerrada há >2 minutos
        const now = Date.now();
        const closedRef = normalized.closedAt ?? normalized.endsAt;
        if (
          isInitialHydration &&
          isPollClosed(normalized, now) &&
          now - closedRef > 120_000
        ) {
          setDismissedPollId(normalized.id);
        } else {
          setDismissedPollId(null);
        }

        // Busca votos existentes da nova enquete quando não será buscada imediatamente pelo chamador
        if (!options?.skipAutoVoteFetch) {
          setPollVotes([]);
          void fetchVotesForPoll(normalized.id).then((votes) => {
            if (activePollRef.current?.id === normalized.id) {
              setPollVotes(votes);
            }
          });
        }
      }
    },
    [safeRoom, fetchVotesForPoll],
  );

  const applyIncomingVote = useCallback(
    (raw: unknown) => {
      const currentPoll = activePollRef.current;
      if (!currentPoll) return;
      const normalized = normalizePollVoteRecord(raw, currentPoll.id, safeRoom);
      if (!normalized) return;
      setPollVotes((prev) => mergePollVoteList(prev, normalized));
    },
    [safeRoom],
  );

  // Busca completa (usada no mount, reconexão e polling de salvaguarda) com coalescência de chamadas concorrentes
  const syncFullStateFromServer = useCallback(async () => {
    if (!isOnline) return;
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    const runSync = async () => {
      const isInitial = !hasHydratedInitialPollRef.current;

      try {
        if (cachedBackendMode !== "players_fallback") {
          const [pauseRes, pollRes] = await Promise.all([
            supabase
              .from("tabletop_session_pauses")
              .select(
                "room_id, master_id, master_session_hash, is_active, message, allowed_settings, allowed_minigames, activated_at, heartbeat_at, updated_at",
              )
              .eq("room_id", safeRoom)
              .maybeSingle(),
            supabase
              .from("tabletop_session_polls")
              .select(
                "id, room_id, master_id, master_session_hash, question, options, duration_seconds, status, started_at, ends_at, closed_at, updated_at",
              )
              .eq("room_id", safeRoom)
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          if (!pauseRes.error && !pollRes.error) {
            cachedBackendMode = "dedicated";
            if (pauseRes.data) {
              applyIncomingPause(pauseRes.data);
            } else {
              pauseStateRef.current = null;
              setPauseState(null);
            }
            if (pollRes.data) {
              applyIncomingPoll(pollRes.data, isInitial, {
                skipAutoVoteFetch: true,
              });
              const pollId = String((pollRes.data as any).id || "");
              if (pollId) {
                const votes = await fetchVotesForPoll(pollId);
                if (activePollRef.current?.id === pollId) {
                  setPollVotes(votes);
                }
              }
            }
            hasHydratedInitialPollRef.current = true;
            return;
          }

          if (
            !isMissingRpcOrTableError(pauseRes.error) &&
            !isMissingRpcOrTableError(pollRes.error)
          ) {
            return;
          }
          cachedBackendMode = "players_fallback";
        }

        // Fallback transparente usando registros isolados por sala em `public.players`
        const { data: rows, error } = await supabase
          .from("players")
          .select("id, data")
          .in("id", [pauseRecordId, pollRecordId]);

        if (error || !Array.isArray(rows)) return;

        const pauseRow = rows.find((r) => r.id === pauseRecordId);
        const pollRow = rows.find((r) => r.id === pollRecordId);

        if (pauseRow?.data) {
          applyIncomingPause(pauseRow.data);
        } else {
          pauseStateRef.current = null;
          setPauseState(null);
        }

        if (pollRow?.data) {
          applyIncomingPoll(pollRow.data, isInitial, {
            skipAutoVoteFetch: true,
          });
          const pollId = String((pollRow.data as any).id || "");
          if (pollId) {
            const votes = await fetchVotesForPoll(pollId);
            if (activePollRef.current?.id === pollId) {
              setPollVotes(votes);
            }
          }
        }
        hasHydratedInitialPollRef.current = true;
      } catch {
        // Falha transitória de rede; o visibilityPoller tentará novamente ao reconectar
      }
    };

    const promise = runSync().finally(() => {
      if (inFlightSyncRef.current === promise) {
        inFlightSyncRef.current = null;
      }
    });
    inFlightSyncRef.current = promise;
    return promise;
  }, [
    isOnline,
    safeRoom,
    pauseRecordId,
    pollRecordId,
    applyIncomingPause,
    applyIncomingPoll,
    fetchVotesForPoll,
  ]);

  // Canal Realtime por sala (Broadcast instantâneo + postgres_changes + reconexão)
  useEffect(() => {
    hasHydratedInitialPollRef.current = false;
    pauseStateRef.current = null;
    activePollRef.current = null;
    setPauseState(null);
    setActivePoll(null);
    setPollVotes([]);
    setDismissedPollId(null);
    setClearedMasterPollId(null);

    if (!isOnline) return;

    let cancelled = false;
    let hasSubscribedOnce = false;

    // Sempre hidrata o estado inicial na montagem (inclusive se a aba abrir/recarregar em segundo plano)
    void syncFullStateFromServer();

    const poller = createVisibilityPoller(syncFullStateFromServer, {
      intervalMs: 45_000,
      minWakeGapMs: 2_000,
      runImmediately: false,
    });

    const channel = supabase
      .channel(`tabletop_utilities_${safeRoom}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on("broadcast", { event: "pause_update" }, ({ payload }) => {
        if (cancelled) return;
        applyIncomingPause(payload);
      })
      .on("broadcast", { event: "poll_update" }, ({ payload }) => {
        if (cancelled) return;
        applyIncomingPoll(payload, false);
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }) => {
        if (cancelled) return;
        applyIncomingVote(payload);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${pauseRecordId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            pauseStateRef.current = null;
            setPauseState(null);
            return;
          }
          const nextRow = payload.new as { data?: unknown } | undefined;
          if (nextRow?.data) applyIncomingPause(nextRow.data);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${pollRecordId}`,
        },
        (payload) => {
          if (cancelled) return;
          const nextRow = payload.new as { data?: unknown } | undefined;
          if (nextRow?.data) applyIncomingPoll(nextRow.data, false);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
        },
        (payload) => {
          if (cancelled) return;
          const nextRow = payload.new as { id?: string; data?: unknown } | undefined;
          const currPoll = activePollRef.current;
          if (!currPoll || !nextRow?.id) return;
          const expectedPrefix = getPollVoteFallbackPrefix(currPoll.id);
          if (nextRow.id.startsWith(expectedPrefix) && nextRow.data) {
            applyIncomingVote(nextRow.data);
          }
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          if (hasSubscribedOnce) {
            // Apenas em reconexões (o poller já hidrata imediatamente no mount)
            void syncFullStateFromServer();
          } else {
            hasSubscribedOnce = true;
          }
        }
      });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      poller.stop();
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [
    isOnline,
    safeRoom,
    pauseRecordId,
    pollRecordId,
    syncFullStateFromServer,
    applyIncomingPause,
    applyIncomingPoll,
    applyIncomingVote,
  ]);

  // Derivados de estado em tempo real
  const isPauseActiveForSession = isPauseEffectivelyActive(pauseState, clockNow);
  const isPauseActiveForPlayers = !isMestreAuth && isPauseActiveForSession;
  const isCurrentMasterPauseOwner = Boolean(
    isMestreAuth &&
      userUid &&
      pauseState &&
      isPauseActiveForSession &&
      pauseState.masterId === userUid &&
      (!pauseState.masterSessionHash ||
        !masterTokenHash ||
        pauseState.masterSessionHash === masterTokenHash),
  );

  const isPollClosedNow = isPollClosed(activePoll, clockNow);
  const pollRemainingSeconds = getPollRemainingSeconds(activePoll, clockNow);

  const pollResults = useMemo(() => {
    if (!activePoll) return null;
    return computePollResults(activePoll, pollVotes, userUid);
  }, [activePoll, pollVotes, userUid]);

  // Tick de 1s apenas enquanto houver Pause ativo ou Enquete ativa em contagem
  const needsTick =
    Boolean(pauseState?.isActive) ||
    Boolean(activePoll && activePoll.status === "active" && !isPollClosedNow);

  useEffect(() => {
    if (!needsTick) return;
    setClockNow(Date.now());
    const id = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [needsTick]);

  // ============================================================================
  // AÇÕES DO PAUSE (EXCLUSIVAS DO MESTRE)
  // ============================================================================

  const activateOrUpdatePause = useCallback(
    async (input: PauseMutationInput): Promise<SessionUtilityActionResult> => {
      setPauseError(null);
      const creds = await ensureMasterCredentials();
      if (!creds) {
        const msg = "Apenas o Mestre autenticado pode ativar ou alterar o Pause.";
        setPauseError(msg);
        return { ok: false, error: msg };
      }
      if (!isOnline) {
        const msg = "Conecte-se à sessão online para ativar o Pause para os jogadores.";
        setPauseError(msg);
        return { ok: false, error: msg };
      }

      const validated = validatePauseInput(input);
      if ("error" in validated) {
        setPauseError(validated.error);
        return { ok: false, error: validated.error };
      }

      const currentPause = pauseStateRef.current;
      if (!canMasterControlPause(currentPause, creds.masterId, creds.hash)) {
        const msg = "Outro Mestre está controlando um Pause ativo nesta sala.";
        setPauseError(msg);
        return { ok: false, error: msg };
      }

      setIsSavingPause(true);
      try {
        const now = Date.now();
        let nextState: SessionPauseState | null = null;

        if (cachedBackendMode !== "players_fallback") {
          const { data, error } = await supabase.rpc("set_tabletop_pause", {
            p_room_id: safeRoom,
            p_master_id: creds.masterId,
            p_master_token: creds.token,
            p_message: validated.clean.message,
            p_allowed_settings: validated.clean.allowedSettings,
            p_allowed_minigames: validated.clean.allowedMinigames,
          });

          if (!error && data) {
            cachedBackendMode = "dedicated";
            nextState = normalizeSessionPauseState(data, safeRoom);
          } else if (!isMissingRpcOrTableError(error)) {
            throw new Error(error?.message || "Erro ao ativar Pause no servidor.");
          } else {
            cachedBackendMode = "players_fallback";
          }
        }

        if (!nextState) {
          // Verifica ownership atual no banco antes de gravar no fallback
          const { data: existingRow } = await supabase
            .from("players")
            .select("data")
            .eq("id", pauseRecordId)
            .maybeSingle();

          const existingRemote = existingRow?.data
            ? normalizeSessionPauseState(existingRow.data, safeRoom)
            : null;
          if (!canMasterControlPause(existingRemote, creds.masterId, creds.hash, now)) {
            throw new Error(
              "Apenas o Mestre que ativou este Pause pode modificá-lo.",
            );
          }

          nextState = {
            roomId: safeRoom,
            masterId: creds.masterId,
            masterSessionHash: creds.hash,
            isActive: true,
            message: validated.clean.message,
            allowedSettings: validated.clean.allowedSettings,
            allowedMinigames: validated.clean.allowedMinigames,
            activatedAt:
              existingRemote && existingRemote.isActive
                ? existingRemote.activatedAt
                : now,
            heartbeatAt: now,
            updatedAt: now,
          };

          const { error: upsertErr } = await supabase.from("players").upsert({
            id: pauseRecordId,
            data: nextState,
            updated_at: new Date(now).toISOString(),
          });

          if (upsertErr) {
            throw new Error(upsertErr.message || "Falha ao salvar Pause no banco.");
          }
        }

        pauseStateRef.current = nextState;
        setPauseState(nextState);
        setClockNow(Date.now());

        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "pause_update",
            payload: nextState,
          });
        } catch {
          // postgres_changes / polling garante sincronização
        }

        return { ok: true };
      } catch (err: any) {
        const msg = err?.message || "Não foi possível ativar o Pause.";
        setPauseError(msg);
        return { ok: false, error: msg };
      } finally {
        setIsSavingPause(false);
      }
    },
    [ensureMasterCredentials, isOnline, safeRoom, pauseRecordId],
  );

  const endPause = useCallback(async (): Promise<SessionUtilityActionResult> => {
    setPauseError(null);
    const creds = await ensureMasterCredentials();
    if (!creds) {
      const msg = "Apenas o Mestre autenticado pode encerrar o Pause.";
      setPauseError(msg);
      return { ok: false, error: msg };
    }

    const currentPause = pauseStateRef.current;
    if (
      currentPause &&
      !canMasterControlPause(currentPause, creds.masterId, creds.hash)
    ) {
      const msg = "Apenas o Mestre responsável pode encerrar este Pause.";
      setPauseError(msg);
      return { ok: false, error: msg };
    }

    setIsSavingPause(true);
    try {
      const now = Date.now();
      let nextState: SessionPauseState | null = null;

      if (isOnline && cachedBackendMode !== "players_fallback") {
        const { data, error } = await supabase.rpc("end_tabletop_pause", {
          p_room_id: safeRoom,
          p_master_id: creds.masterId,
          p_master_token: creds.token,
        });
        if (!error && data) {
          cachedBackendMode = "dedicated";
          nextState = normalizeSessionPauseState(data, safeRoom);
        } else if (error && !isMissingRpcOrTableError(error)) {
          throw new Error(error.message || "Falha ao encerrar Pause no servidor.");
        } else if (error) {
          cachedBackendMode = "players_fallback";
        }
      }

      if (!nextState) {
        nextState = {
          roomId: safeRoom,
          masterId: creds.masterId,
          masterSessionHash: creds.hash,
          isActive: false,
          message: currentPause?.message || "",
          allowedSettings: currentPause?.allowedSettings || {
            audio: true,
            notifications: false,
            visual: false,
          },
          allowedMinigames: currentPause?.allowedMinigames || [],
          activatedAt: currentPause?.activatedAt || now,
          heartbeatAt: now,
          updatedAt: now,
        };

        if (isOnline) {
          const { error: upsertErr } = await supabase.from("players").upsert({
            id: pauseRecordId,
            data: nextState,
            updated_at: new Date(now).toISOString(),
          });
          if (upsertErr) {
            throw new Error(upsertErr.message || "Falha ao encerrar Pause.");
          }
        }
      }

      pauseStateRef.current = nextState;
      setPauseState(nextState);
      setClockNow(Date.now());

      try {
        await channelRef.current?.send({
          type: "broadcast",
          event: "pause_update",
          payload: nextState,
        });
      } catch {}

      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || "Erro ao encerrar o Pause.";
      setPauseError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsSavingPause(false);
    }
  }, [ensureMasterCredentials, isOnline, safeRoom, pauseRecordId]);

  const releaseOwnedPauseOnLogout = useCallback(async () => {
    const current = pauseStateRef.current;
    const token = masterTokenRef.current;
    const hash = masterTokenHashRef.current;
    if (
      !current ||
      !current.isActive ||
      !isMestreAuth ||
      !userUid ||
      current.masterId !== userUid
    ) {
      return;
    }

    const now = Date.now();
    const nextState: SessionPauseState = {
      ...current,
      isActive: false,
      heartbeatAt: now,
      updatedAt: now,
    };
    pauseStateRef.current = nextState;
    setPauseState(nextState);

    try {
      if (isOnline) {
        if (cachedBackendMode === "dedicated" && token) {
          await supabase.rpc("end_tabletop_pause", {
            p_room_id: safeRoom,
            p_master_id: userUid,
            p_master_token: token,
          });
        } else {
          await supabase.from("players").upsert({
            id: pauseRecordId,
            data: {
              ...nextState,
              masterSessionHash: hash || current.masterSessionHash,
            },
            updated_at: new Date(now).toISOString(),
          });
        }
        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "pause_update",
            payload: nextState,
          });
        } catch {}
      }
    } catch {
      // Heartbeat TTL (90s) também garante liberação caso a rede falhe durante logout
    }
  }, [isMestreAuth, userUid, isOnline, safeRoom, pauseRecordId]);

  // Heartbeat periódico enquanto este Mestre mantém o Pause ativo
  useEffect(() => {
    if (!isOnline || !isCurrentMasterPauseOwner || !userUid) return;

    const sendHeartbeat = async () => {
      const curr = pauseStateRef.current;
      const token = masterTokenRef.current;
      const hash = masterTokenHashRef.current;
      if (!curr || !curr.isActive || !token || !hash) return;

      const now = Date.now();
      try {
        if (cachedBackendMode === "dedicated") {
          await supabase.rpc("heartbeat_tabletop_pause", {
            p_room_id: safeRoom,
            p_master_id: userUid,
            p_master_token: token,
          });
        } else {
          const refreshed: SessionPauseState = {
            ...curr,
            heartbeatAt: now,
            updatedAt: now,
          };
          await supabase.from("players").upsert({
            id: pauseRecordId,
            data: refreshed,
            updated_at: new Date(now).toISOString(),
          });
          setPauseState(refreshed);
        }
      } catch {}
    };

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, PAUSE_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOnline, isCurrentMasterPauseOwner, userUid, safeRoom, pauseRecordId]);

  // Liberação best-effort caso o Mestre feche a aba/janela com Pause ativo
  useEffect(() => {
    if (!isCurrentMasterPauseOwner || !userUid) return;

    const handlePageExit = () => {
      const curr = pauseStateRef.current;
      const token = masterTokenRef.current;
      const hash = masterTokenHashRef.current;
      if (!curr || !curr.isActive || !token || !supabaseUrl || !supabaseAnonKey) {
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      };

      if (cachedBackendMode === "dedicated") {
        void fetch(`${supabaseUrl}/rest/v1/rpc/end_tabletop_pause`, {
          method: "POST",
          headers,
          keepalive: true,
          body: JSON.stringify({
            p_room_id: safeRoom,
            p_master_id: userUid,
            p_master_token: token,
          }),
        }).catch(() => {});
      } else {
        const now = Date.now();
        const released: SessionPauseState = {
          ...curr,
          masterSessionHash: hash,
          isActive: false,
          heartbeatAt: now,
          updatedAt: now,
        };
        void fetch(`${supabaseUrl}/rest/v1/players?on_conflict=id`, {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "resolution=merge-duplicates",
          },
          keepalive: true,
          body: JSON.stringify({
            id: pauseRecordId,
            data: released,
            updated_at: new Date(now).toISOString(),
          }),
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, [isCurrentMasterPauseOwner, userUid, safeRoom, pauseRecordId]);

  // ============================================================================
  // AÇÕES DA ENQUETE (CRIAÇÃO/ENCERRAMENTO DO MESTRE + VOTO DOS JOGADORES)
  // ============================================================================

  const createPoll = useCallback(
    async (input: CreatePollInput): Promise<SessionUtilityActionResult> => {
      setPollError(null);
      const creds = await ensureMasterCredentials();
      if (!creds) {
        const msg = "Apenas o Mestre autenticado pode iniciar enquetes.";
        setPollError(msg);
        return { ok: false, error: msg };
      }
      if (!isOnline) {
        const msg = "Conecte-se à sessão online para enviar uma enquete aos jogadores.";
        setPollError(msg);
        return { ok: false, error: msg };
      }

      const validated = validateCreatePollInput(input);
      if ("error" in validated) {
        setPollError(validated.error);
        return { ok: false, error: validated.error };
      }

      setIsSavingPoll(true);
      try {
        const now = Date.now();
        const pollId = createPollId(now);
        let createdPoll: SessionPoll | null = null;

        if (cachedBackendMode !== "players_fallback") {
          const { data, error } = await supabase.rpc("create_tabletop_poll", {
            p_poll_id: pollId,
            p_room_id: safeRoom,
            p_master_id: creds.masterId,
            p_master_token: creds.token,
            p_question: validated.clean.question,
            p_options: validated.clean.options,
            p_duration_seconds: validated.clean.durationSeconds,
          });

          if (!error && data) {
            cachedBackendMode = "dedicated";
            createdPoll = normalizeSessionPoll(data, safeRoom);
          } else if (!isMissingRpcOrTableError(error)) {
            throw new Error(error?.message || "Erro ao criar enquete no servidor.");
          } else {
            cachedBackendMode = "players_fallback";
          }
        }

        if (!createdPoll) {
          createdPoll = {
            id: pollId,
            roomId: safeRoom,
            masterId: creds.masterId,
            masterSessionHash: creds.hash,
            question: validated.clean.question,
            options: validated.clean.options,
            durationSeconds: validated.clean.durationSeconds,
            status: "active",
            startedAt: now,
            endsAt: now + validated.clean.durationSeconds * 1000,
            closedAt: null,
            updatedAt: now,
          };

          const { error: upsertErr } = await supabase.from("players").upsert({
            id: pollRecordId,
            data: createdPoll,
            updated_at: new Date(now).toISOString(),
          });

          if (upsertErr) {
            throw new Error(upsertErr.message || "Falha ao salvar enquete.");
          }
        }

        autoClosedPollIdRef.current = null;
        activePollRef.current = createdPoll;
        setActivePoll(createdPoll);
        setPollVotes([]);
        setDismissedPollId(null);
        setClearedMasterPollId(null);
        setClockNow(Date.now());

        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "poll_update",
            payload: createdPoll,
          });
        } catch {}

        return { ok: true };
      } catch (err: any) {
        const msg = err?.message || "Não foi possível iniciar a enquete.";
        setPollError(msg);
        return { ok: false, error: msg };
      } finally {
        setIsSavingPoll(false);
      }
    },
    [ensureMasterCredentials, isOnline, safeRoom, pollRecordId],
  );

  const closePoll = useCallback(async (): Promise<SessionUtilityActionResult> => {
    setPollError(null);
    const creds = await ensureMasterCredentials();
    const current = activePollRef.current;
    if (!creds || !current) {
      const msg = "Nenhuma enquete ativa disponível para encerramento.";
      setPollError(msg);
      return { ok: false, error: msg };
    }

    if (
      current.masterId &&
      current.masterId !== creds.masterId &&
      !isPollClosed(current)
    ) {
      const msg = "Apenas o Mestre que criou esta enquete pode encerrá-la.";
      setPollError(msg);
      return { ok: false, error: msg };
    }

    setIsSavingPoll(true);
    try {
      const now = Date.now();
      let closedPoll: SessionPoll | null = null;

      if (isOnline && cachedBackendMode !== "players_fallback") {
        const { data, error } = await supabase.rpc("close_tabletop_poll", {
          p_poll_id: current.id,
          p_room_id: safeRoom,
          p_master_id: creds.masterId,
          p_master_token: creds.token,
        });

        if (!error && data) {
          cachedBackendMode = "dedicated";
          closedPoll = normalizeSessionPoll(data, safeRoom);
        } else if (error && !isMissingRpcOrTableError(error)) {
          throw new Error(error.message || "Falha ao encerrar enquete.");
        } else if (error) {
          cachedBackendMode = "players_fallback";
        }
      }

      if (!closedPoll) {
        closedPoll = {
          ...current,
          status: "closed",
          closedAt: current.closedAt ?? now,
          updatedAt: now,
        };

        if (isOnline) {
          const { error: upsertErr } = await supabase.from("players").upsert({
            id: pollRecordId,
            data: closedPoll,
            updated_at: new Date(now).toISOString(),
          });
          if (upsertErr) {
            throw new Error(upsertErr.message || "Falha ao encerrar enquete.");
          }
        }
      }

      activePollRef.current = closedPoll;
      setActivePoll(closedPoll);
      setClockNow(Date.now());

      try {
        await channelRef.current?.send({
          type: "broadcast",
          event: "poll_update",
          payload: closedPoll,
        });
      } catch {}

      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || "Erro ao encerrar enquete.";
      setPollError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsSavingPoll(false);
    }
  }, [ensureMasterCredentials, isOnline, safeRoom, pollRecordId]);

  // Quando o cronômetro da enquete expira, o Mestre responsável persiste status 'closed' 1 única vez
  useEffect(() => {
    if (
      !activePoll ||
      activePoll.status !== "active" ||
      !isPollClosedNow ||
      !isMestreAuth ||
      !userUid ||
      activePoll.masterId !== userUid
    ) {
      return;
    }
    if (autoClosedPollIdRef.current === activePoll.id) return;
    autoClosedPollIdRef.current = activePoll.id;
    void closePoll();
  }, [activePoll, isPollClosedNow, isMestreAuth, userUid, closePoll]);

  // Re-sincronização leve de votos apenas enquanto uma enquete estiver ativa (salvaguarda para WebView)
  useEffect(() => {
    if (!isOnline || !activePoll || isPollClosedNow) return;
    const pollId = activePoll.id;
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchVotesForPoll(pollId).then((votes) => {
        if (activePollRef.current?.id === pollId) {
          setPollVotes((prev) => {
            if (prev.length === votes.length) {
              const prevIds = new Set(prev.map((v) => `${v.voterId}:${v.optionId}`));
              if (votes.every((v) => prevIds.has(`${v.voterId}:${v.optionId}`))) {
                return prev;
              }
            }
            return votes;
          });
        }
      });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [isOnline, activePoll, isPollClosedNow, fetchVotesForPoll]);

  const castVote = useCallback(
    async (optionId: string): Promise<SessionUtilityActionResult> => {
      const poll = activePollRef.current;
      if (!poll) {
        return { ok: false, error: "Nenhuma enquete ativa no momento." };
      }
      if (!userUid) {
        return { ok: false, error: "Identificador do jogador indisponível." };
      }
      if (!isOnline) {
        return {
          ok: false,
          error: "Sessão offline. Reconecte-se para registrar seu voto.",
        };
      }
      if (isPollClosed(poll, Date.now())) {
        return {
          ok: false,
          error: "Esta enquete já foi encerrada. Não é mais possível votar.",
        };
      }
      if (!poll.options.some((o) => o.id === optionId)) {
        return { ok: false, error: "Opção de voto inválida." };
      }
      if (
        pollVotesRef.current.some(
          (v) => v.pollId === poll.id && v.voterId === userUid,
        )
      ) {
        return { ok: false, error: "Você já registrou seu voto nesta enquete." };
      }

      setIsSubmittingVote(true);
      try {
        const now = Date.now();
        const voteRecord: PollVoteRecord = {
          pollId: poll.id,
          roomId: safeRoom,
          voterId: userUid,
          optionId,
          createdAt: now,
        };

        let savedViaDedicated = false;
        if (cachedBackendMode !== "players_fallback") {
          const { data, error } = await supabase.rpc("cast_tabletop_poll_vote", {
            p_poll_id: poll.id,
            p_room_id: safeRoom,
            p_voter_id: userUid,
            p_option_id: optionId,
          });

          if (!error && data && typeof data === "object") {
            cachedBackendMode = "dedicated";
            const resObj = data as { ok?: boolean; reason?: string };
            if (!resObj.ok) {
              if (resObj.reason === "already_voted") {
                return {
                  ok: false,
                  error: "Você já votou nesta enquete.",
                };
              }
              if (resObj.reason === "closed") {
                setClockNow(Date.now());
                return {
                  ok: false,
                  error: "Esta enquete foi encerrada.",
                };
              }
              return {
                ok: false,
                error: "Não foi possível validar o voto nesta enquete.",
              };
            }
            savedViaDedicated = true;
          } else if (!isMissingRpcOrTableError(error)) {
            throw new Error(error?.message || "Erro ao registrar voto.");
          } else {
            cachedBackendMode = "players_fallback";
          }
        }

        if (!savedViaDedicated) {
          // Valida estado atual da enquete e evita duplicata antes de gravar linha única do votante
          const voteRowId = getPollVoteFallbackRecordId(poll.id, userUid);
          const [{ data: pollRow }, { data: existingVoteRow }] = await Promise.all([
            supabase
              .from("players")
              .select("data")
              .eq("id", pollRecordId)
              .maybeSingle(),
            supabase
              .from("players")
              .select("id, data")
              .eq("id", voteRowId)
              .maybeSingle(),
          ]);

          const remotePoll = pollRow?.data
            ? normalizeSessionPoll(pollRow.data, safeRoom)
            : poll;
          if (!remotePoll || remotePoll.id !== poll.id || isPollClosed(remotePoll, now)) {
            if (remotePoll) applyIncomingPoll(remotePoll, false);
            return {
              ok: false,
              error: "Esta enquete já foi encerrada.",
            };
          }

          if (existingVoteRow?.data) {
            applyIncomingVote(existingVoteRow.data);
            return {
              ok: false,
              error: "Você já registrou seu voto nesta enquete.",
            };
          }

          const { error: insertErr } = await supabase.from("players").insert({
            id: voteRowId,
            data: voteRecord,
            updated_at: new Date(now).toISOString(),
          });

          if (insertErr) {
            // 23505 = unique_violation (voto duplicado concorrente bloqueado pelo banco)
            if (String(insertErr.code || "") === "23505") {
              return {
                ok: false,
                error: "Você já registrou seu voto nesta enquete.",
              };
            }
            throw new Error(insertErr.message || "Falha ao salvar voto.");
          }
        }

        setPollVotes((prev) => mergePollVoteList(prev, voteRecord));

        try {
          await channelRef.current?.send({
            type: "broadcast",
            event: "poll_vote",
            payload: voteRecord,
          });
        } catch {}

        return { ok: true };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || "Falha ao enviar voto. Tente novamente.",
        };
      } finally {
        setIsSubmittingVote(false);
      }
    },
    [userUid, isOnline, safeRoom, pollRecordId, applyIncomingPoll, applyIncomingVote],
  );

  const dismissPollPopup = useCallback(() => {
    if (activePollRef.current) {
      setDismissedPollId(activePollRef.current.id);
    }
  }, []);

  const reopenPollPopup = useCallback(() => {
    setDismissedPollId(null);
  }, []);

  const clearMasterPollView = useCallback(() => {
    if (activePollRef.current && isPollClosed(activePollRef.current, Date.now())) {
      setClearedMasterPollId(activePollRef.current.id);
    }
  }, []);

  const visiblePollForMaster =
    activePoll && clearedMasterPollId === activePoll.id ? null : activePoll;

  const isPollPopupOpen = Boolean(
    !isMestreAuth && activePoll && dismissedPollId !== activePoll.id,
  );

  return {
    roomId: safeRoom,
    pauseState,
    isPauseActiveForPlayers,
    isPauseActiveForSession,
    isCurrentMasterPauseOwner,
    isSavingPause,
    pauseError,
    activateOrUpdatePause,
    endPause,
    releaseOwnedPauseOnLogout,

    activePoll: isMestreAuth ? visiblePollForMaster : activePoll,
    pollVotes,
    pollResults:
      isMestreAuth && !visiblePollForMaster ? null : pollResults,
    isPollClosedNow,
    pollRemainingSeconds,
    isPollPopupOpen,
    isSavingPoll,
    isSubmittingVote,
    pollError,
    createPoll,
    closePoll,
    castVote,
    dismissPollPopup,
    reopenPollPopup,
    clearMasterPollView,
  };
}
