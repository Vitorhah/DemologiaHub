import { supabase } from "../../lib/supabase";
import { ChatMessage, ChatRoomData, SyncStatus } from "./types";

const CHAT_STORAGE_PREFIX = "demologia_chat_";
const CHAT_UPDATE_EVENT = "demologia_chat_update";

export function sanitizeRoomId(roomId: string): string {
  return (roomId || "mesa_principal")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

function getStorageKey(roomId: string): string {
  return `${CHAT_STORAGE_PREFIX}${sanitizeRoomId(roomId)}`;
}

function getRemoteRecordId(roomId: string): string {
  return `CHAT_${sanitizeRoomId(roomId)}`;
}

/**
 * Mescla duas listas de mensagens deduplicando por ID e ordenando cronologicamente.
 */
export function mergeMessages(
  listA: ChatMessage[],
  listB: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of listA) {
    if (m && m.id) map.set(m.id, m);
  }
  for (const m of listB) {
    if (m && m.id) map.set(m.id, m);
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Carrega mensagens salvas no LocalStorage da mesa.
 */
export function loadMessages(roomId: string): ChatMessage[] {
  try {
    const key = getStorageKey(roomId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: ChatRoomData = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.messages)) {
      return parsed.messages.sort((a, b) => a.timestamp - b.timestamp);
    }
  } catch (error) {
    console.error("[ChatStorage] Falha ao carregar mensagens locais:", error);
  }
  return [];
}

/**
 * Salva mensagens no LocalStorage e dispara evento local.
 */
export function saveMessages(
  roomId: string,
  messages: ChatMessage[],
  notify = true,
): void {
  try {
    const key = getStorageKey(roomId);
    const sorted = messages.sort((a, b) => a.timestamp - b.timestamp);
    const payload: ChatRoomData = {
      roomId: sanitizeRoomId(roomId),
      messages: sorted,
    };
    localStorage.setItem(key, JSON.stringify(payload));

    if (notify && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CHAT_UPDATE_EVENT, {
          detail: { roomId: sanitizeRoomId(roomId), messages: sorted },
        }),
      );
    }
  } catch (error) {
    console.error("[ChatStorage] Falha ao salvar mensagens locais:", error);
  }
}

// Controle de canais e debouncers ativos por sala
const activeChannels: Record<string, any> = {};
const pendingSaveTimers: Record<string, any> = {};

/**
 * Agenda a persistência no Supabase para a tabela 'players' (debounced para evitar sobrecarga).
 */
function scheduleRemoteSave(roomId: string, messages: ChatMessage[]): void {
  const sanitized = sanitizeRoomId(roomId);
  if (pendingSaveTimers[sanitized]) {
    clearTimeout(pendingSaveTimers[sanitized]);
  }

  pendingSaveTimers[sanitized] = setTimeout(async () => {
    delete pendingSaveTimers[sanitized];
    try {
      const recordId = getRemoteRecordId(sanitized);
      // Mantém até 250 mensagens mais recentes no banco para manter alta performance
      const boundedMessages = messages.slice(-250);

      const { error } = await supabase.from("players").upsert({
        id: recordId,
        data: {
          roomId: sanitized,
          messages: boundedMessages,
        },
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn("[ChatStorage] Erro ao sincronizar mensagens no Supabase:", error.message);
      }
    } catch (err) {
      console.warn("[ChatStorage] Exceção ao persistir no Supabase:", err);
    }
  }, 400);
}

/**
 * Busca o histórico remoto da mesa no Supabase e mescla com as mensagens locais.
 */
export async function fetchRemoteMessages(
  roomId: string,
): Promise<ChatMessage[]> {
  const sanitized = sanitizeRoomId(roomId);
  try {
    const recordId = getRemoteRecordId(sanitized);
    const { data, error } = await supabase
      .from("players")
      .select("data")
      .eq("id", recordId)
      .single();

    if (!error && data?.data?.messages && Array.isArray(data.data.messages)) {
      const remoteList: ChatMessage[] = data.data.messages;
      const localList = loadMessages(sanitized);
      const merged = mergeMessages(localList, remoteList);

      // Atualiza o cache local se houver novidades
      if (merged.length !== localList.length) {
        saveMessages(sanitized, merged, true);
      }
      return merged;
    }
  } catch (err) {
    console.warn("[ChatStorage] Falha ao buscar histórico remoto:", err);
  }
  return loadMessages(sanitized);
}

/**
 * Adiciona uma mensagem localmente, transmite via broadcast Realtime e agenda persistência no Supabase.
 */
export function addMessage(
  roomId: string,
  message: ChatMessage,
  isOnline = true,
): ChatMessage[] {
  const sanitized = sanitizeRoomId(roomId);
  const current = loadMessages(sanitized);
  const updated = mergeMessages(current, [message]);
  saveMessages(sanitized, updated, true);

  if (isOnline) {
    // 1. Transmissão imediata via Broadcast Realtime
    const channel = activeChannels[sanitized];
    if (channel) {
      channel
        .send({
          type: "broadcast",
          event: "chat_message",
          payload: message,
        })
        .catch((err: any) => {
          console.warn("[ChatStorage] Broadcast send falhou:", err);
        });
    }

    // 2. Persistência no banco Supabase
    scheduleRemoteSave(sanitized, updated);
  }

  return updated;
}

/**
 * Limpa o histórico de mensagens localmente e no Supabase.
 */
export async function clearMessages(
  roomId: string,
  isOnline = true,
): Promise<void> {
  const sanitized = sanitizeRoomId(roomId);
  const key = getStorageKey(sanitized);
  localStorage.removeItem(key);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CHAT_UPDATE_EVENT, {
        detail: { roomId: sanitized, messages: [] },
      }),
    );
  }

  if (isOnline) {
    // 1. Notifica outros clientes via broadcast
    const channel = activeChannels[sanitized];
    if (channel) {
      channel
        .send({
          type: "broadcast",
          event: "chat_clear",
          payload: { roomId: sanitized },
        })
        .catch(() => {});
    }

    // 2. Remove registro no banco Supabase
    try {
      const recordId = getRemoteRecordId(sanitized);
      await supabase.from("players").delete().eq("id", recordId);
    } catch (err) {
      console.warn("[ChatStorage] Falha ao limpar registro remoto:", err);
    }
  }
}

/**
 * Inscreve-se nas mensagens do chat via LocalStorage e canal Realtime do Supabase.
 */
export function subscribeToChat(
  roomId: string,
  options: {
    isOnline?: boolean;
    onMessagesUpdate: (messages: ChatMessage[]) => void;
    onStatusChange?: (status: SyncStatus) => void;
  },
): () => void {
  const sanitized = sanitizeRoomId(roomId);
  const { isOnline = true, onMessagesUpdate, onStatusChange } = options;

  if (typeof window === "undefined") return () => {};

  onStatusChange?.(isOnline ? "connecting" : "offline");

  // 1. Listener de eventos locais (mesma janela ou abas locais)
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<{ roomId: string; messages: ChatMessage[] }>;
    if (custom.detail?.roomId === sanitized && Array.isArray(custom.detail?.messages)) {
      onMessagesUpdate(custom.detail.messages);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    const key = getStorageKey(sanitized);
    if (e.key === key) {
      if (e.newValue) {
        try {
          const data: ChatRoomData = JSON.parse(e.newValue);
          if (data && Array.isArray(data.messages)) {
            onMessagesUpdate(data.messages.sort((a, b) => a.timestamp - b.timestamp));
          }
        } catch {
          onMessagesUpdate([]);
        }
      } else {
        onMessagesUpdate([]);
      }
    }
  };

  window.addEventListener(CHAT_UPDATE_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  let remoteInterval: any = null;
  let channel: any = null;

  if (isOnline) {
    // 2. Busca inicial no Supabase
    fetchRemoteMessages(sanitized).then((merged) => {
      onMessagesUpdate(merged);
    });

    // 3. Fallback periódico a cada 15 segundos para reconexão suave
    remoteInterval = setInterval(() => {
      fetchRemoteMessages(sanitized).then((merged) => {
        onMessagesUpdate(merged);
      });
    }, 15000);

    // 4. Criação do canal Supabase Realtime
    const channelName = `chat_channel_${sanitized}`;
    channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false, self: false } },
    });

    activeChannels[sanitized] = channel;

    channel
      // Mensagens via broadcast instantâneo (sub-segundo)
      .on("broadcast", { event: "chat_message" }, ({ payload }: { payload: ChatMessage }) => {
        if (payload && payload.id) {
          const local = loadMessages(sanitized);
          const merged = mergeMessages(local, [payload]);
          saveMessages(sanitized, merged, true);
          onMessagesUpdate(merged);
        }
      })
      // Limpeza de histórico via broadcast
      .on("broadcast", { event: "chat_clear" }, () => {
        saveMessages(sanitized, [], true);
        onMessagesUpdate([]);
      })
      // Mudanças na tabela 'players' (persistência compartilhada)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${getRemoteRecordId(sanitized)}`,
        },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            saveMessages(sanitized, [], true);
            onMessagesUpdate([]);
          } else if (payload.new?.data?.messages && Array.isArray(payload.new.data.messages)) {
            const remote: ChatMessage[] = payload.new.data.messages;
            const local = loadMessages(sanitized);
            const merged = mergeMessages(local, remote);
            saveMessages(sanitized, merged, true);
            onMessagesUpdate(merged);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          onStatusChange?.("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onStatusChange?.("error");
        } else if (status === "CLOSED") {
          onStatusChange?.("offline");
        }
      });
  } else {
    onStatusChange?.("offline");
  }

  return () => {
    window.removeEventListener(CHAT_UPDATE_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);

    if (remoteInterval) {
      clearInterval(remoteInterval);
    }

    if (channel) {
      if (activeChannels[sanitized] === channel) {
        delete activeChannels[sanitized];
      }
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn("[ChatStorage] Erro ao remover canal do chat:", err);
      }
    }
  };
}
