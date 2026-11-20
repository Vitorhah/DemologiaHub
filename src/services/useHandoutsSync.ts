import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import {
  HandoutBroadcastEvent,
  HandoutFolder,
  HandoutItem,
  HandoutToastNotification,
  HandoutVisibility,
} from "../types/handouts";
import {
  HANDOUTS_INDIV_PREFIX,
  HANDOUTS_LOCAL_MASTER_KEY,
  HANDOUTS_MASTER_RECORD_ID,
  HANDOUTS_SHARED_RECORD_ID,
  buildSanitizedDistribution,
  mergePlayerHandouts,
  normalizeHandoutItem,
  sanitizeHandoutForPlayer,
} from "../utils/handoutsLogic";
import { createVisibilityPoller } from "../utils/visibilityPolling";

interface UseHandoutsSyncOptions {
  userUid: string | null;
  isMestreAuth: boolean;
  isOnline: boolean;
  players: { id: string; name?: string }[];
}

function getSeenStorageKey(uid: string | null): string {
  return `demologia_handouts_seen_${uid || "local"}`;
}

function loadSeenMap(uid: string | null): Record<string, { updatedAt: number; secretRevealed: boolean }> {
  try {
    const raw = localStorage.getItem(getSeenStorageKey(uid));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSeenMap(
  uid: string | null,
  map: Record<string, { updatedAt: number; secretRevealed: boolean }>
) {
  try {
    localStorage.setItem(getSeenStorageKey(uid), JSON.stringify(map));
  } catch {}
}

export function useHandoutsSync({
  userUid,
  isMestreAuth,
  isOnline,
  players,
}: UseHandoutsSyncOptions) {
  const [masterItems, setMasterItems] = useState<HandoutItem[]>(() => {
    try {
      const saved = localStorage.getItem(HANDOUTS_LOCAL_MASTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.items)) {
          return parsed.items.map(normalizeHandoutItem);
        }
      }
    } catch {}
    return [];
  });

  const [masterFolders, setMasterFolders] = useState<HandoutFolder[]>(() => {
    try {
      const saved = localStorage.getItem(HANDOUTS_LOCAL_MASTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.folders)) {
          return parsed.folders;
        }
      }
    } catch {}
    return [];
  });

  const [sharedItems, setSharedItems] = useState<HandoutItem[]>([]);
  const [sharedFolders, setSharedFolders] = useState<HandoutFolder[]>([]);
  const [indivItems, setIndivItems] = useState<HandoutItem[]>([]);
  const [indivFolders, setIndivFolders] = useState<HandoutFolder[]>([]);

  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline"
  );
  const [seenMap, setSeenMap] = useState<
    Record<string, { updatedAt: number; secretRevealed: boolean }>
  >(() => loadSeenMap(userUid));

  const [toastNotification, setToastNotification] =
    useState<HandoutToastNotification | null>(null);

  const channelRef = useRef<any>(null);
  const sessionNonceRef = useRef<string>(
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const previousPlayerHandoutsRef = useRef<Map<string, HandoutItem>>(new Map());
  const isInitialPlayerLoadRef = useRef<boolean>(true);
  const knownIndividualTargetsRef = useRef<Set<string>>(new Set());

  // Keep seenMap synced when userUid changes
  useEffect(() => {
    setSeenMap(loadSeenMap(userUid));
    isInitialPlayerLoadRef.current = true;
    previousPlayerHandoutsRef.current = new Map();
  }, [userUid]);

  // Persist Master vault backup locally
  useEffect(() => {
    if (!isMestreAuth) return;
    try {
      localStorage.setItem(
        HANDOUTS_LOCAL_MASTER_KEY,
        JSON.stringify({ items: masterItems, folders: masterFolders })
      );
    } catch {}
  }, [masterItems, masterFolders, isMestreAuth]);

  const playerHandouts = useMemo(
    () => mergePlayerHandouts(sharedItems, indivItems),
    [sharedItems, indivItems]
  );

  const playerFolders = useMemo(() => {
    const map = new Map<string, HandoutFolder>();
    [...sharedFolders, ...indivFolders].forEach((f) => {
      if (f && f.id) map.set(f.id, f);
    });
    return Array.from(map.values());
  }, [sharedFolders, indivFolders]);

  const handouts = isMestreAuth ? masterItems : playerHandouts;
  const folders = isMestreAuth ? masterFolders : playerFolders;

  const unreadIds = useMemo(() => {
    if (isMestreAuth) return new Set<string>();
    const set = new Set<string>();
    for (const h of playerHandouts) {
      const seen = seenMap[h.id];
      if (!seen || (h.secretRevealed && !seen.secretRevealed)) {
        set.add(h.id);
      }
    }
    return set;
  }, [isMestreAuth, playerHandouts, seenMap]);

  const unreadCount = unreadIds.size;

  const triggerToast = useCallback(
    (handout: HandoutItem, reason: "shared" | "secret_revealed") => {
      setToastNotification({
        id: `${handout.id}_${reason}_${Date.now()}`,
        handout,
        reason,
        timestamp: Date.now(),
      });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  const markAsRead = useCallback(
    (handoutId: string) => {
      const target = playerHandouts.find((h) => h.id === handoutId);
      setSeenMap((prev) => {
        const next = {
          ...prev,
          [handoutId]: {
            updatedAt: target?.updatedAt ?? Date.now(),
            secretRevealed: Boolean(target?.secretRevealed),
          },
        };
        saveSeenMap(userUid, next);
        return next;
      });
    },
    [playerHandouts, userUid]
  );

  const markAllAsRead = useCallback(() => {
    setSeenMap((prev) => {
      const next = { ...prev };
      playerHandouts.forEach((h) => {
        next[h.id] = {
          updatedAt: h.updatedAt,
          secretRevealed: Boolean(h.secretRevealed),
        };
      });
      saveSeenMap(userUid, next);
      return next;
    });
  }, [playerHandouts, userUid]);

  // Detect newly arrived or secret-revealed handouts for players from DB updates
  useEffect(() => {
    if (isMestreAuth) return;
    if (isInitialPlayerLoadRef.current) {
      const initMap = new Map<string, HandoutItem>();
      playerHandouts.forEach((h) => initMap.set(h.id, h));
      previousPlayerHandoutsRef.current = initMap;
      if (playerHandouts.length > 0) {
        isInitialPlayerLoadRef.current = false;
      }
      return;
    }

    const prevMap = previousPlayerHandoutsRef.current;
    for (const h of playerHandouts) {
      const old = prevMap.get(h.id);
      if (!old) {
        triggerToast(h, "shared");
        break;
      } else if (!old.secretRevealed && h.secretRevealed) {
        triggerToast(h, "secret_revealed");
        break;
      }
    }

    const nextMap = new Map<string, HandoutItem>();
    playerHandouts.forEach((h) => nextMap.set(h.id, h));
    previousPlayerHandoutsRef.current = nextMap;
  }, [playerHandouts, isMestreAuth, triggerToast]);

  // Fetch initial data & subscribe to realtime updates
  useEffect(() => {
    if (!userUid || !isOnline) {
      setSyncStatus("offline");
      return;
    }

    let isMounted = true;

    const fetchMasterVault = async () => {
      if (!isMestreAuth) return;
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", HANDOUTS_MASTER_RECORD_ID)
          .maybeSingle();

        if (!isMounted || error) return;
        if (data?.data) {
          const items = Array.isArray(data.data.items)
            ? data.data.items.map(normalizeHandoutItem)
            : [];
          const flds = Array.isArray(data.data.folders) ? data.data.folders : [];
          setMasterItems(items);
          setMasterFolders(flds);
          items.forEach((it: HandoutItem) => {
            it.sharedWith.forEach((pid) => knownIndividualTargetsRef.current.add(pid));
          });
        }
        setSyncStatus("synced");
      } catch {
        if (isMounted) setSyncStatus("offline");
      }
    };

    const fetchPlayerVisibleHandouts = async () => {
      try {
        const indivId = `${HANDOUTS_INDIV_PREFIX}${userUid}`;
        const { data, error } = await supabase
          .from("players")
          .select("id, data")
          .in("id", [HANDOUTS_SHARED_RECORD_ID, indivId]);

        if (!isMounted || error) return;

        let nextShared: HandoutItem[] = [];
        let nextSharedFolders: HandoutFolder[] = [];
        let nextIndiv: HandoutItem[] = [];
        let nextIndivFolders: HandoutFolder[] = [];

        (data || []).forEach((row: any) => {
          if (row.id === HANDOUTS_SHARED_RECORD_ID && row.data) {
            nextShared = Array.isArray(row.data.items)
              ? row.data.items.map(normalizeHandoutItem)
              : [];
            nextSharedFolders = Array.isArray(row.data.folders)
              ? row.data.folders
              : [];
          } else if (row.id === indivId && row.data) {
            nextIndiv = Array.isArray(row.data.items)
              ? row.data.items.map(normalizeHandoutItem)
              : [];
            nextIndivFolders = Array.isArray(row.data.folders)
              ? row.data.folders
              : [];
          }
        });

        setSharedItems(nextShared);
        setSharedFolders(nextSharedFolders);
        setIndivItems(nextIndiv);
        setIndivFolders(nextIndivFolders);
        setSyncStatus("synced");
      } catch {
        if (isMounted) setSyncStatus("offline");
      }
    };

    const poller = createVisibilityPoller(
      () => {
        if (isMestreAuth) fetchMasterVault();
        else fetchPlayerVisibleHandouts();
      },
      {
        intervalMs: 20000,
        minWakeGapMs: 1500,
        runImmediately: true,
      }
    );

    const indivRecordId = `${HANDOUTS_INDIV_PREFIX}${userUid}`;

    const channel = supabase
      .channel("handouts_realtime_channel", {
        config: { broadcast: { ack: false, self: false } },
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          if (!isMounted) return;
          const newRec = payload.new as { id?: string; data?: any } | undefined;
          const oldRec = payload.old as { id?: string } | undefined;
          const recId = newRec?.id || oldRec?.id;
          if (!recId) return;

          if (isMestreAuth && recId === HANDOUTS_MASTER_RECORD_ID) {
            if (newRec?.data) {
              setMasterItems(
                Array.isArray(newRec.data.items)
                  ? newRec.data.items.map(normalizeHandoutItem)
                  : []
              );
              setMasterFolders(
                Array.isArray(newRec.data.folders) ? newRec.data.folders : []
              );
            }
          }

          if (!isMestreAuth && recId === HANDOUTS_SHARED_RECORD_ID) {
            isInitialPlayerLoadRef.current = false;
            if (payload.eventType === "DELETE") {
              setSharedItems([]);
              setSharedFolders([]);
            } else if (newRec?.data) {
              setSharedItems(
                Array.isArray(newRec.data.items)
                  ? newRec.data.items.map(normalizeHandoutItem)
                  : []
              );
              setSharedFolders(
                Array.isArray(newRec.data.folders) ? newRec.data.folders : []
              );
            }
          }

          if (!isMestreAuth && recId === indivRecordId) {
            isInitialPlayerLoadRef.current = false;
            if (payload.eventType === "DELETE") {
              setIndivItems([]);
              setIndivFolders([]);
            } else if (newRec?.data) {
              setIndivItems(
                Array.isArray(newRec.data.items)
                  ? newRec.data.items.map(normalizeHandoutItem)
                  : []
              );
              setIndivFolders(
                Array.isArray(newRec.data.folders) ? newRec.data.folders : []
              );
            }
          }
        }
      )
      .on("broadcast", { event: "handout_event" }, ({ payload }) => {
        if (!isMounted || !payload) return;
        const ev = payload as HandoutBroadcastEvent;
        if (ev.senderNonce && ev.senderNonce === sessionNonceRef.current) return;
        if (isMestreAuth) return;

        isInitialPlayerLoadRef.current = false;
        const appliesToMe =
          ev.visibility === "all" ||
          (ev.visibility === "individual" &&
            Array.isArray(ev.sharedWith) &&
            ev.sharedWith.includes(userUid));

        if (ev.type === "deleted" || !appliesToMe) {
          setSharedItems((prev) => prev.filter((h) => h.id !== ev.handoutId));
          setIndivItems((prev) => prev.filter((h) => h.id !== ev.handoutId));
          fetchPlayerVisibleHandouts();
          return;
        }

        if (ev.handout && appliesToMe) {
          const safeHandout = sanitizeHandoutForPlayer(ev.handout);
          if (ev.visibility === "all") {
            setSharedItems((prev) => {
              const exists = prev.some((h) => h.id === safeHandout.id);
              return exists
                ? prev.map((h) => (h.id === safeHandout.id ? safeHandout : h))
                : [safeHandout, ...prev];
            });
            setIndivItems((prev) => prev.filter((h) => h.id !== safeHandout.id));
          } else {
            setIndivItems((prev) => {
              const exists = prev.some((h) => h.id === safeHandout.id);
              return exists
                ? prev.map((h) => (h.id === safeHandout.id ? safeHandout : h))
                : [safeHandout, ...prev];
            });
            setSharedItems((prev) => prev.filter((h) => h.id !== safeHandout.id));
          }

          if (ev.type === "shared" || ev.type === "secret_revealed") {
            triggerToast(safeHandout, ev.type);
          }
        }

        fetchPlayerVisibleHandouts();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      poller.stop();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userUid, isMestreAuth, isOnline, triggerToast]);

  // Persist complete vault + sanitized player views to Supabase (Master only)
  const syncVaultToSupabase = useCallback(
    async (
      nextItems: HandoutItem[],
      nextFolders: HandoutFolder[],
      broadcastEvent?: Omit<HandoutBroadcastEvent, "timestamp" | "senderNonce">
    ) => {
      if (!isMestreAuth) return;
      const now = Date.now();
      const normalizedItems = nextItems.map(normalizeHandoutItem);

      if (!isOnline || !userUid) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("syncing");
      try {
        const knownSet = new Set<string>();
        players.forEach((p) => {
          if (p.id) knownSet.add(p.id);
        });
        knownIndividualTargetsRef.current.forEach((id) => knownSet.add(id));
        const knownIds = Array.from(knownSet);
        normalizedItems.forEach((it) =>
          it.sharedWith.forEach((pid) => knownIndividualTargetsRef.current.add(pid))
        );

        const dist = buildSanitizedDistribution(
          normalizedItems,
          nextFolders,
          knownIds
        );

        const upserts = [
          {
            id: HANDOUTS_MASTER_RECORD_ID,
            data: {
              type: "handouts_master_v1",
              items: normalizedItems,
              folders: nextFolders,
              updatedAt: now,
            },
            updated_at: new Date(now).toISOString(),
          },
          {
            id: HANDOUTS_SHARED_RECORD_ID,
            data: {
              type: "handouts_shared_v1",
              items: dist.sharedItems,
              folders: dist.sharedFolders,
              updatedAt: now,
            },
            updated_at: new Date(now).toISOString(),
          },
          ...Object.entries(dist.individualByPlayer).map(([playerId, payload]) => ({
            id: `${HANDOUTS_INDIV_PREFIX}${playerId}`,
            data: {
              type: "handouts_individual_v1",
              playerId,
              items: payload.items,
              folders: payload.folders,
              updatedAt: now,
            },
            updated_at: new Date(now).toISOString(),
          })),
        ];

        const { error } = await supabase.from("players").upsert(upserts);
        if (error) {
          console.warn("Erro ao sincronizar Handouts com Supabase:", error.message);
          setSyncStatus("offline");
        } else {
          setSyncStatus("synced");
        }

        if (broadcastEvent && channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "handout_event",
            payload: {
              ...broadcastEvent,
              handout: broadcastEvent.handout
                ? sanitizeHandoutForPlayer(broadcastEvent.handout)
                : undefined,
              timestamp: now,
              senderNonce: sessionNonceRef.current,
            } satisfies HandoutBroadcastEvent,
          });
        }
      } catch (err) {
        console.warn("Falha ao sincronizar Handouts:", err);
        setSyncStatus("offline");
      }
    },
    [isMestreAuth, isOnline, userUid, players]
  );

  // Master Actions
  const saveHandout = useCallback(
    async (draft: HandoutItem) => {
      const normalized = normalizeHandoutItem({
        ...draft,
        updatedAt: Date.now(),
      });

      const existing = masterItems.find((h) => h.id === normalized.id);
      const nextItems = existing
        ? masterItems.map((h) => (h.id === normalized.id ? normalized : h))
        : [normalized, ...masterItems];

      setMasterItems(nextItems);

      let eventType: HandoutBroadcastEvent["type"] = "updated";
      if (normalized.visibility !== "private") {
        if (!existing || existing.visibility === "private") {
          eventType = "shared";
        } else if (!existing.secretRevealed && normalized.secretRevealed) {
          eventType = "secret_revealed";
        }
      }

      await syncVaultToSupabase(nextItems, masterFolders, {
        type: eventType,
        handoutId: normalized.id,
        visibility: normalized.visibility,
        sharedWith: normalized.sharedWith,
        handout: normalized,
      });
    },
    [masterItems, masterFolders, syncVaultToSupabase]
  );

  const deleteHandout = useCallback(
    async (handoutId: string) => {
      const nextItems = masterItems.filter((h) => h.id !== handoutId);
      setMasterItems(nextItems);
      await syncVaultToSupabase(nextItems, masterFolders, {
        type: "deleted",
        handoutId,
      });
    },
    [masterItems, masterFolders, syncVaultToSupabase]
  );

  const updateHandoutVisibility = useCallback(
    async (
      handoutId: string,
      visibility: HandoutVisibility,
      sharedWith?: string[]
    ) => {
      const existing = masterItems.find((h) => h.id === handoutId);
      if (!existing) return;
      const updated: HandoutItem = {
        ...existing,
        visibility,
        sharedWith:
          visibility === "individual"
            ? sharedWith ?? existing.sharedWith
            : existing.sharedWith,
        updatedAt: Date.now(),
      };
      const nextItems = masterItems.map((h) => (h.id === handoutId ? updated : h));
      setMasterItems(nextItems);

      await syncVaultToSupabase(nextItems, masterFolders, {
        type: visibility === "private" ? "deleted" : "shared",
        handoutId,
        visibility,
        sharedWith: updated.sharedWith,
        handout: updated,
      });
    },
    [masterItems, masterFolders, syncVaultToSupabase]
  );

  const toggleHandoutSecret = useCallback(
    async (handoutId: string) => {
      const existing = masterItems.find((h) => h.id === handoutId);
      if (!existing) return;
      const nextRevealed = !existing.secretRevealed;
      const updated: HandoutItem = {
        ...existing,
        secretRevealed: nextRevealed,
        updatedAt: Date.now(),
      };
      const nextItems = masterItems.map((h) => (h.id === handoutId ? updated : h));
      setMasterItems(nextItems);

      await syncVaultToSupabase(
        nextItems,
        masterFolders,
        updated.visibility !== "private"
          ? {
              type: nextRevealed ? "secret_revealed" : "updated",
              handoutId,
              visibility: updated.visibility,
              sharedWith: updated.sharedWith,
              handout: updated,
            }
          : undefined
      );
    },
    [masterItems, masterFolders, syncVaultToSupabase]
  );

  const createFolder = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      const newFolder: HandoutFolder = {
        id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: clean,
        createdAt: Date.now(),
      };
      const nextFolders = [...masterFolders, newFolder];
      setMasterFolders(nextFolders);
      await syncVaultToSupabase(masterItems, nextFolders);
    },
    [masterFolders, masterItems, syncVaultToSupabase]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const nextFolders = masterFolders.filter((f) => f.id !== folderId);
      const nextItems = masterItems.map((h) =>
        h.folderId === folderId ? { ...h, folderId: null } : h
      );
      setMasterFolders(nextFolders);
      setMasterItems(nextItems);
      await syncVaultToSupabase(nextItems, nextFolders);
    },
    [masterFolders, masterItems, syncVaultToSupabase]
  );

  return {
    handouts,
    folders,
    unreadIds,
    unreadCount,
    syncStatus,
    toastNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
    saveHandout,
    deleteHandout,
    updateHandoutVisibility,
    toggleHandoutSecret,
    createFolder,
    deleteFolder,
  };
}
