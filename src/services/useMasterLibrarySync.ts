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
}

function loadLocalLibrary(): {
  folders: MasterLibraryFolder[];
  items: MasterLibraryItem[];
} {
  try {
    const raw = localStorage.getItem(MASTER_LIBRARY_LOCAL_KEY);
    if (!raw) return { folders: [], items: [] };
    const parsed = JSON.parse(raw);
    const folders = normalizeLibraryFolders(parsed?.folders);
    const items = normalizeLibraryItems(parsed?.items, folders);
    return { folders, items };
  } catch {
    return { folders: [], items: [] };
  }
}

function saveLocalLibrary(
  folders: MasterLibraryFolder[],
  items: MasterLibraryItem[]
) {
  try {
    localStorage.setItem(
      MASTER_LIBRARY_LOCAL_KEY,
      JSON.stringify({ folders, items, updatedAt: Date.now() })
    );
  } catch {}
}

export function useMasterLibrarySync({
  userUid,
  isMestreAuth,
  isOnline,
}: UseMasterLibrarySyncOptions) {
  const initialRef = useRef<{
    folders: MasterLibraryFolder[];
    items: MasterLibraryItem[];
  } | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadLocalLibrary();
  }

  const [folders, setFolders] = useState<MasterLibraryFolder[]>(
    initialRef.current.folders
  );
  const [items, setItems] = useState<MasterLibraryItem[]>(
    initialRef.current.items
  );
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">(
    isOnline ? "synced" : "offline"
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const localMutationTsRef = useRef<number>(0);

  // Persist local cache whenever Master modifies library
  useEffect(() => {
    if (!isMestreAuth) return;
    saveLocalLibrary(folders, items);
  }, [folders, items, isMestreAuth]);

  // Load and subscribe to MASTER_LIBRARY in Supabase (Master only)
  useEffect(() => {
    if (!isMestreAuth || !userUid || !isOnline) {
      setSyncStatus("offline");
      return;
    }

    let isMounted = true;

    const applyRemoteData = (rawData: any) => {
      if (!rawData || typeof rawData !== "object") return;
      const remoteUpdatedAt = Number(rawData.updatedAt) || 0;
      if (remoteUpdatedAt > 0 && remoteUpdatedAt < localMutationTsRef.current) {
        return;
      }
      const nextFolders = normalizeLibraryFolders(rawData.folders);
      const nextItems = normalizeLibraryItems(rawData.items, nextFolders);
      setFolders(nextFolders);
      setItems(nextItems);
    };

    const fetchMasterLibrary = async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("data")
          .eq("id", MASTER_LIBRARY_RECORD_ID)
          .maybeSingle();

        if (!isMounted) return;
        if (error) {
          setSyncStatus("offline");
          setSyncError(`Erro ao sincronizar Biblioteca: ${error.message}`);
          return;
        }
        if (data?.data) {
          applyRemoteData(data.data);
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
      intervalMs: 25000,
      minWakeGapMs: 2000,
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

  const persistLibrary = useCallback(
    async (
      nextFolders: MasterLibraryFolder[],
      nextItems: MasterLibraryItem[]
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isMestreAuth) {
        return {
          ok: false,
          error: "Apenas o Mestre pode alterar a Biblioteca.",
        };
      }

      const now = Date.now();
      localMutationTsRef.current = now;
      setFolders(nextFolders);
      setItems(nextItems);
      saveLocalLibrary(nextFolders, nextItems);

      if (!isOnline || !userUid) {
        setSyncStatus("offline");
        return { ok: true };
      }

      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const { error } = await supabase.from("players").upsert([
          {
            id: MASTER_LIBRARY_RECORD_ID,
            data: {
              type: "master_library_v1",
              folders: nextFolders,
              items: nextItems,
              updatedAt: now,
            },
            updated_at: new Date(now).toISOString(),
          },
        ]);

        if (error) {
          const msg = `Falha ao salvar Biblioteca no Supabase: ${error.message}`;
          setSyncError(msg);
          setSyncStatus("offline");
          return { ok: false, error: msg };
        }

        setSyncStatus("synced");
        return { ok: true };
      } catch (err: any) {
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

  return {
    folders,
    items,
    syncStatus,
    syncError,
    createFolder,
    renameFolder,
    deleteFolder,
    saveItem,
    deleteItem,
    moveItemToFolder,
  };
}
