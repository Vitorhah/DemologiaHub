import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChatUser, ChatMessage, SyncStatus } from "./types";
import {
  loadMessages,
  addMessage,
  clearMessages,
  subscribeToChat,
} from "./chatStorage";
import {
  areMessagesEqual,
  INITIAL_VISIBLE_MESSAGES,
  OLDER_MESSAGES_BATCH,
  sanitizeRoomId,
  sliceVisibleMessages,
} from "./chatUtils";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ChatContainerProps {
  currentUser: ChatUser;
  onlineCount?: number;
  isOnline?: boolean;
  initialRoomId?: string;
  onBackToFicha?: () => void;
}

export function ChatContainer({
  currentUser,
  onlineCount = 1,
  isOnline = true,
  initialRoomId,
  onBackToFicha,
}: ChatContainerProps) {
  const [roomId, setRoomId] = useState<string>(() => {
    if (initialRoomId) return initialRoomId;
    try {
      const saved = localStorage.getItem("demologia_current_room_id");
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return "mesa_principal";
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessages(roomId),
  );
  const [visibleLimit, setVisibleLimit] = useState<number>(
    INITIAL_VISIBLE_MESSAGES,
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isOnline ? "connecting" : "offline",
  );
  const loadOlderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza ao montar ou ao trocar de sala ou alterar estado online
  useEffect(() => {
    setVisibleLimit(INITIAL_VISIBLE_MESSAGES);
    const loaded = loadMessages(roomId);
    setMessages((prev) => (areMessagesEqual(prev, loaded) ? prev : loaded));

    const unsubscribe = subscribeToChat(roomId, {
      isOnline,
      onMessagesUpdate: (updatedMessages) => {
        setMessages((prev) =>
          areMessagesEqual(prev, updatedMessages) ? prev : updatedMessages,
        );
      },
      onStatusChange: (status) => {
        setSyncStatus(status);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, isOnline]);

  useEffect(() => {
    return () => {
      if (loadOlderDebounceRef.current) {
        clearTimeout(loadOlderDebounceRef.current);
      }
    };
  }, []);

  const { visibleMessages, hasOlderMessages, olderMessagesCount } = useMemo(
    () => sliceVisibleMessages(messages, visibleLimit),
    [messages, visibleLimit],
  );

  // Carregamento debounced de mensagens antigas acionado via IntersectionObserver no topo
  const handleLoadOlderMessages = useCallback(() => {
    if (!hasOlderMessages || loadOlderDebounceRef.current) return;

    loadOlderDebounceRef.current = setTimeout(() => {
      loadOlderDebounceRef.current = null;
      setVisibleLimit((prev) =>
        Math.min(messages.length, prev + OLDER_MESSAGES_BATCH),
      );
    }, 120);
  }, [hasOlderMessages, messages.length]);

  const handleSendMessage = useCallback(
    (text: string) => {
      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        senderId: currentUser.id,
        senderName: (currentUser.name || "Agente").trim(),
        senderAvatar: currentUser.avatar,
        isMaster: currentUser.isMaster,
        text,
        timestamp: Date.now(),
      };

      const updated = addMessage(roomId, newMsg, isOnline);
      setMessages((prev) => (areMessagesEqual(prev, updated) ? prev : updated));
    },
    [roomId, currentUser, isOnline],
  );

  const handleClearHistory = useCallback(async () => {
    await clearMessages(roomId, isOnline);
    setMessages([]);
    setVisibleLimit(INITIAL_VISIBLE_MESSAGES);
  }, [roomId, isOnline]);

  const handleSwitchRoom = useCallback((newRoomId: string) => {
    const sanitized = sanitizeRoomId(newRoomId);
    if (!sanitized) return;
    setRoomId(sanitized);
    try {
      localStorage.setItem("demologia_current_room_id", sanitized);
    } catch {}
  }, []);

  return (
    <section
      aria-label="Chat Coletivo da Mesa"
      className="chat-container w-full flex-1 min-h-0 h-full overflow-hidden flex flex-col bg-[var(--op-bg)] text-[#f1f1f4] border border-[var(--op-border)] rounded-none shadow-2xl relative [contain:content] will-change-transform"
    >
      {/* 1. Header do Chat limpo e minimalista */}
      <ChatHeader
        roomId={roomId}
        onlineCount={onlineCount}
        syncStatus={syncStatus}
      />

      {/* 2. Área Central: Lista de Mensagens com Rolagem Independente */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[#0a0a0f] [contain:content]">
        <MessageList
          messages={visibleMessages}
          currentUserId={currentUser.id}
          hasOlderMessages={hasOlderMessages}
          olderMessagesCount={olderMessagesCount}
          onLoadOlderMessages={handleLoadOlderMessages}
        />
      </div>

      {/* 3. Rodapé: Campo de Entrada Fixo */}
      <MessageInput onSendMessage={handleSendMessage} />
    </section>
  );
}


