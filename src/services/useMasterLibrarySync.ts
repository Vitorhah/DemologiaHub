import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  MasterLibraryFolder,
  MasterLibraryItem,
} from "../types/masterLibrary";
import {
  MASTER_LIBRARY_LOCAL_KEY,
  MASTER_LIBRARY_RECORD_ID,
  createLibraryFolder,
  deleteLibraryFolder,
  normalizeLibraryFolders,
  normalizeLibraryItem,
  normalizeLibraryItems,
  renameLibraryFolder,
} from "../utils/masterLibrary";
import {
  CUSTOM_AFFILIATIONS_LOCAL_KEY,
  CUSTOM_AFFILIATIONS_RECORD_ID,
  CustomAffiliationDraft,
  CustomAffiliationRecord,
  normalizeCustomAffiliations,
  removeCustomAffiliation,
  upsertCustomAffiliation,
} from "../utils/customAffiliations";
import { setCustomRitualAffiliations } from "../utils/rituals";
import { createVisibilityPoller } from "../utils/visibilityPolling";

interface UseMasterLibrarySyncOptions {
  userUid: string | null;
  isMestreAuth: boolean;
  isOnline: boolean;
}

export interface LibraryActionResult {
  ok: boolean;
  error?: string;
  movedItemsCount?: number;
  folder?: MasterLibraryFolder;
  item?: MasterLibraryItem;
  affiliation?: CustomAffiliationRecord;
}

function loadLocalCustomAffiliations(): CustomAffiliationRecord[] {
  try {
    const raw = localStorage.getItem(CUSTOM_AFFILIATIONS_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeCustomAffiliations(parsed?.affiliations ?? parsed);
  } catch {
    return [];
  }
}

function saveLocalCustomAffiliations(affiliations: CustomAffiliationRecord[]) {
  try {
    localStorage.setItem(
      CUSTOM_AFFILIATIONS_LOCAL_KEY,
      JSON.stringify({ affiliations, updatedAt: Date.now() })
    );
  } catch {}
}

function loadLocalLibrary(): {
  folders: MasterLibraryFolder[];
  items: MasterLibraryItem[];
  customAffiliations: CustomAffiliationRecord[];
} {
  try {
    const raw = localStorage.getItem(MASTER_LIBRARY_LOCAL_KEY);
    const sharedAffs = loadLocalCustomAffiliations();
    if (!raw) {
      return { folders: [], items: [], customAffiliations: sharedAffs };
    }
    const parsed = JSON.parse(raw);
    const folders = normalizeLibraryFolders(parsed?.folders);
    const items = normalizeLibraryItems(parsed?.items, folders);
    const fromLibrary = normalizeCustomAffiliations(parsed?.customAffiliations);
    const customAffiliations =
      fromLibrary.length > 0 ? fromLibrary : sharedAffs;
    return { folders, items, customAffiliations };
  } catch {
    return {
      folders: [],
      items: [],
      customAffiliations: loadLocalCustomAffiliations(),
    };
  }
}

function saveLocalLibrary(
  folders: MasterLibraryFolder[],
  items: MasterLibraryItem[],
  customAffiliations: CustomAffiliationRecord[]
) {
  try {
    localStorage.setItem(
      MASTER_LIBRARY_LOCAL_KEY,
      JSON.stringify({
        folders,
        items,
        customAffiliations,
        updatedAt: Date.now(),
      })
    );
  } catch {}
  saveLocalCustomAffiliations(customAffiliations);
}

export function useMasterLibrarySync({
  userUid,
  isMestreAuth,
  isOnline,
}: UseMasterLibrarySyncOptions) {
  const initialRef = useRef<{
    folders: MasterLibraryFolder[];
    items: MasterLibraryItem[];
    customAffiliations: CustomAffiliationRecord[];
  } | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadLocalLibrary();
    setCustomRitualAffiliations(initialRef.current.customAffiliations);
  }

  const [folders, setFolders] = useState<MasterLibraryFolder[]>(
    initialRef.current.folders
  );
  const [items, setItems] = useState<MasterLibraryItem[]>(
    initialRef.current.items
  );
  const [customAffiliations, setCustomAffiliations] = useState<
    CustomAffiliationRecord[]
  >(initialRef.current.customAffiliations);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline"
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const customAffiliationsRef = useRef(customAffiliations);
  customAffiliationsRef.current = customAffiliations;

  const localMutationTsRef = useRef<number>(0);
  const lastAppliedSigRef = useRef<string>("");
  const lastSharedAffSigRef = useRef<string>("");
  const hasMountedRef = useRef<boolean>(false);

  // Keep global runtime affiliation registry synchronized for every component
  useEffect(() => {
    setCustomRitualAffiliations(customAffiliations);
  }, [customAffiliations]);

  // Persist local cache only when Master actually modifies library after initial hydration
  useEffect(() => {
    if (!isMestreAuth) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    saveLocalLibrary(folders, items, customAffiliations);
  }, [folders, items, customAffiliations, isMestreAuth]);

  // Load and subscribe to MASTER_LIBRARY in Supabase (Master only)
  useEffect(() => {
    if (!isMestreAuth || !userUid || !isOnline) {
      if (isMestreAuth) {
        setSyncStatus("offline");
      }
      return;
    }

    let isMounted = true;

    const applyRemoteData = (rawData: any) => {
      if (!rawData || typeof rawData !== "object") return;
      const remoteUpdatedAt = Number(rawData.updatedAt) || 0;
      if (remoteUpdatedAt > 0 && remoteUpdatedAt < localMutationTsRef.current) {
        return;
      }
      const rawFoldersLen = Array.isArray(rawData.folders) ? rawData.folders.length : 0;
      const rawItemsLen = Array.isArray(rawData.items) ? rawData.items.length : 0;
      const rawAffsLen = Array.isArray(rawData.customAffiliations)
        ? rawData.customAffiliations.length
        : 0;
      const sig = `${remoteUpdatedAt}|${rawFoldersLen}|${rawItemsLen}|${rawAffsLen}`;
      if (remoteUpdatedAt > 0 && sig === lastAppliedSigRef.current) {
        return;
      }
      lastAppliedSigRef.current = sig;
      const nextFolders = normalizeLibraryFolders(rawData.folders);
      const nextItems = normalizeLibraryItems(rawData.items, nextFolders);
      const nextAffs =
        rawData.customAffiliations !== undefined
          ? normalizeCustomAffiliations(rawData.customAffiliations)
          : customAffiliationsRef.current;

      setFolders(nextFolders);
      setItems(nextItems);
      if (rawData.customAffiliations !== undefined) {
        setCustomAffiliations(nextAffs);
      }
    };

    const fetchMasterLibrary = async () => {
      try {
        const [{ data, error }, { data: sharedData }] = await Promise.all([
          supabase
            .from("players")
            .select("data")
            .eq("id", MASTER_LIBRARY_RECORD_ID)
            .maybeSingle(),
          supabase
            .from("players")
            .select("data")
            .eq("id", CUSTOM_AFFILIATIONS_RECORD_ID)
            .maybeSingle(),
        ]);

        if (!isMounted) return;
        if (error) {
          setSyncStatus("offline");
          setSyncError(`Erro ao sincronizar Biblioteca: ${error.message}`);
          return;
        }
        if (data?.data) {
          applyRemoteData(data.data);
          // Fallback: if older MASTER_LIBRARY row has no customAffiliations yet, hydrate from shared row
          if (
            data.data.customAffiliations === undefined &&
            sharedData?.data?.affiliations
          ) {
            const hydrated = normalizeCustomAffiliations(
              sharedData.data.affiliations
            );
            setCustomAffiliations(hydrated);
            saveLocalCustomAffiliations(hydrated);
          }
        } else if (sharedData?.data?.affiliations) {
          const hydrated = normalizeCustomAffiliations(
            sharedData.data.affiliations
          );
          setCustomAffiliations(hydrated);
          saveLocalCustomAffiliations(hydrated);
        }
        setSyncError(null);
        setSyncStatus("synced");
      } catch {
        if (isMounted) {
          setSyncStatus("offline");
        }
      }
    };

    const poller = createVisibilityPoller(fetchMasterLibrary, {
      intervalMs: 60000,
      minWakeGapMs: 2500,
      runImmediately: true,
    });

    const channel = supabase
      .channel("master_library_realtime_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${MASTER_LIBRARY_RECORD_ID}`,
        },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === "DELETE") {
            setFolders([]);
            setItems([]);
            setCustomAffiliations([]);
            return;
          }
          const newRec = payload.new as { data?: any } | undefined;
          if (newRec?.data) {
            applyRemoteData(newRec.data);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      poller.stop();
      supabase.removeChannel(channel);
    };
  }, [isMestreAuth, userUid, isOnline]);

  // Public lightweight subscription for Players so custom affiliations render in Rituals & Rich Text
  useEffect(() => {
    if (isMestreAuth || !isOnline) return;

    let isMounted = true;

    const applySharedAffiliations = (rawData: any) => {
      if (!rawData || typeof rawData !== "object") return;
      const remoteUpdatedAt = Number(rawData.updatedAt) || 0;
      const rawList = Array.isArray(rawData.affiliations)
        ? rawData.affiliations
        : [];
      const sig = `${remoteUpdatedAt}|${rawList.length}`;
      if (remoteUpdatedAt > 0 && sig === lastSharedAffSigRef.current) {
        return;
      }
      lastSharedAffSigRef.current = sig;
      const nextAffs = normalizeCustomAffiliations(rawList);
      setCustomAffiliations(nextAffs);
      saveLocalCustomAffiliations(nextAffs);
    };

    const fetchSharedAffiliations = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", CUSTOM_AFFILIATIONS_RECORD_ID)
          .maybeSingle();

        if (!isMounted || error) return;
        if (data?.data) {
          applySharedAffiliations(data.data);
        }
      } catch {
        // Keep last known local cache silently on transient offline state
      }
    };

    const poller = createVisibilityPoller(fetchSharedAffiliations, {
      intervalMs: 60000,
      minWakeGapMs: 3000,
      runImmediately: true,
    });

    const channel = supabase
      .channel("custom_affiliations_shared_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${CUSTOM_AFFILIATIONS_RECORD_ID}`,
        },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === "DELETE") {
            setCustomAffiliations([]);
            saveLocalCustomAffiliations([]);
            return;
          }
          const newRec = payload.new as { data?: any } | undefined;
          if (newRec?.data) {
            applySharedAffiliations(newRec.data);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      poller.stop();
      supabase.removeChannel(channel);
    };
  }, [isMestreAuth, isOnline]);

  const persistLibrary = useCallback(
    async (
      nextFolders: MasterLibraryFolder[],
      nextItems: MasterLibraryItem[],
      nextCustomAffiliations: CustomAffiliationRecord[] = customAffiliationsRef.current,
      syncSharedAffiliations: boolean = false
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isMestreAuth) {
        return {
          ok: false,
          error: "Apenas o Mestre pode alterar a Biblioteca.",
        };
      }

      const prevFolders = foldersRef.current;
      const prevItems = itemsRef.current;
      const prevAffs = customAffiliationsRef.current;

      const now = Date.now();
      localMutationTsRef.current = now;
      setFolders(nextFolders);
      setItems(nextItems);
      setCustomAffiliations(nextCustomAffiliations);
      saveLocalLibrary(nextFolders, nextItems, nextCustomAffiliations);

      if (!isOnline || !userUid) {
        setSyncStatus("offline");
        return { ok: true };
      }

      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const isoNow = new Date(now).toISOString();
        const rows: Array<{ id: string; data: Record<string, unknown>; updated_at: string }> = [
          {
            id: MASTER_LIBRARY_RECORD_ID,
            data: {
              type: "master_library_v1",
              folders: nextFolders,
              items: nextItems,
              customAffiliations: nextCustomAffiliations,
              updatedAt: now,
            },
            updated_at: isoNow,
          },
        ];

        if (syncSharedAffiliations) {
          rows.push({
            id: CUSTOM_AFFILIATIONS_RECORD_ID,
            data: {
              type: "custom_affiliations_v1",
              affiliations: nextCustomAffiliations,
              updatedAt: now,
            },
            updated_at: isoNow,
          });
        }

        const { error } = await supabase.from("players").upsert(rows);

        if (error) {
          // Revert state if database persistence failed while online
          setFolders(prevFolders);
          setItems(prevItems);
          setCustomAffiliations(prevAffs);
          saveLocalLibrary(prevFolders, prevItems, prevAffs);
          const msg = `Falha ao salvar Biblioteca no Supabase: ${error.message}`;
          setSyncError(msg);
          setSyncStatus("offline");
          return { ok: false, error: msg };
        }

        setSyncStatus("synced");
        return { ok: true };
      } catch (err: any) {
        setFolders(prevFolders);
        setItems(prevItems);
        setCustomAffiliations(prevAffs);
        saveLocalLibrary(prevFolders, prevItems, prevAffs);
        const msg = err?.message || "Erro inesperado ao sincronizar a Biblioteca.";
        setSyncError(msg);
        setSyncStatus("offline");
        return { ok: false, error: msg };
      }
    },
    [isMestreAuth, isOnline, userUid]
  );

  const createFolder = useCallback(
    async (
      name: string,
      parentId: string | null = null
    ): Promise<LibraryActionResult> => {
      const res = createLibraryFolder(foldersRef.current, name, parentId);
      if (!res.ok) return res;
      const saved = await persistLibrary(res.folders, itemsRef.current);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true, folder: res.folder };
    },
    [persistLibrary]
  );

  const renameFolder = useCallback(
    async (folderId: string, newName: string): Promise<LibraryActionResult> => {
      const res = renameLibraryFolder(foldersRef.current, folderId, newName);
      if (!res.ok) return res;
      const saved = await persistLibrary(res.folders, itemsRef.current);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true };
    },
    [persistLibrary]
  );

  const deleteFolder = useCallback(
    async (folderId: string): Promise<LibraryActionResult> => {
      const res = deleteLibraryFolder(
        foldersRef.current,
        itemsRef.current,
        folderId
      );
      const saved = await persistLibrary(res.folders, res.items);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true, movedItemsCount: res.movedItemsCount };
    },
    [persistLibrary]
  );

  const saveItem = useCallback(
    async (draft: MasterLibraryItem): Promise<LibraryActionResult> => {
      const validFolders = new Set<string>(foldersRef.current.map((f) => f.id));
      const normalized = normalizeLibraryItem(
        { ...draft, updatedAt: Date.now() },
        validFolders
      );
      if (!normalized) {
        return { ok: false, error: "Dados do arquivo inválidos." };
      }

      const exists = itemsRef.current.some((it) => it.id === normalized.id);
      const nextItems = exists
        ? itemsRef.current.map((it) => (it.id === normalized.id ? normalized : it))
        : [normalized, ...itemsRef.current];

      const saved = await persistLibrary(foldersRef.current, nextItems);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true, item: normalized };
    },
    [persistLibrary]
  );

  const deleteItem = useCallback(
    async (itemId: string): Promise<LibraryActionResult> => {
      const nextItems = itemsRef.current.filter((it) => it.id !== itemId);
      const saved = await persistLibrary(foldersRef.current, nextItems);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true };
    },
    [persistLibrary]
  );

  const moveItemToFolder = useCallback(
    async (
      itemId: string,
      targetFolderId: string | null
    ): Promise<LibraryActionResult> => {
      if (
        targetFolderId !== null &&
        !foldersRef.current.some((f) => f.id === targetFolderId)
      ) {
        return { ok: false, error: "Pasta de destino não encontrada." };
      }
      const nextItems = itemsRef.current.map((it) =>
        it.id === itemId
          ? { ...it, folderId: targetFolderId, updatedAt: Date.now() }
          : it
      );
      const saved = await persistLibrary(foldersRef.current, nextItems);
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true };
    },
    [persistLibrary]
  );

  const saveCustomAffiliation = useCallback(
    async (draft: CustomAffiliationDraft): Promise<LibraryActionResult> => {
      const res = upsertCustomAffiliation(customAffiliationsRef.current, draft);
      if ("error" in res) return { ok: false, error: res.error };

      const saved = await persistLibrary(
        foldersRef.current,
        itemsRef.current,
        res.affiliations,
        true
      );
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true, affiliation: res.affiliation };
    },
    [persistLibrary]
  );

  const deleteCustomAffiliation = useCallback(
    async (affiliationId: string): Promise<LibraryActionResult> => {
      const res = removeCustomAffiliation(
        customAffiliationsRef.current,
        affiliationId
      );
      if (!res.removed) {
        return { ok: false, error: "Afiliação personalizada não encontrada." };
      }
      const saved = await persistLibrary(
        foldersRef.current,
        itemsRef.current,
        res.affiliations,
        true
      );
      if (!saved.ok) return { ok: false, error: saved.error };
      return { ok: true, affiliation: res.removed };
    },
    [persistLibrary]
  );

  return {
    folders,
    items,
    customAffiliations,
    syncStatus,
    syncError,
    createFolder,
    renameFolder,
    deleteFolder,
    saveItem,
    deleteItem,
    moveItemToFolder,
    saveCustomAffiliation,
    deleteCustomAffiliation,
  };
}

