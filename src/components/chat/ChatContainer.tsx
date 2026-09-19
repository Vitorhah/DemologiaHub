import React, { useState, useEffect, useCallback } from "react";
import { ChatUser, ChatMessage, SyncStatus } from "./types";
import {
  loadMessages,
  addMessage,
  clearMessages,
  subscribeToChat,
} from "./chatStorage";
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isOnline ? "connecting" : "offline",
  );

  // Sincroniza ao montar ou ao trocar de sala ou alterar estado online
  useEffect(() => {
    const loaded = loadMessages(roomId);
    setMessages(loaded);

    const unsubscribe = subscribeToChat(roomId, {
      isOnline,
      onMessagesUpdate: (updatedMessages) => {
        setMessages(updatedMessages);
      },
      onStatusChange: (status) => {
        setSyncStatus(status);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, isOnline]);

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
      setMessages(updated);
    },
    [roomId, currentUser, isOnline],
  );

  const handleClearHistory = useCallback(async () => {
    await clearMessages(roomId, isOnline);
    setMessages([]);
  }, [roomId, isOnline]);

  const handleSwitchRoom = useCallback((newRoomId: string) => {
    const sanitized = newRoomId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    if (!sanitized) return;
    setRoomId(sanitized);
    try {
      localStorage.setItem("demologia_current_room_id", sanitized);
    } catch {}
  }, []);

  return (
    <section
      aria-label="Chat Coletivo da Mesa"
      className="chat-container w-full flex flex-col bg-[var(--op-bg)] text-[#f1f1f4] min-h-[calc(100vh-16px)] sm:min-h-screen border border-[var(--op-border)] rounded-none shadow-2xl relative"
    >
      {/* 1. Header do Chat limpo e minimalista */}
      <ChatHeader
        roomId={roomId}
        onlineCount={onlineCount}
        syncStatus={syncStatus}
      />

      {/* 2. Área Central: Lista de Mensagens com Rolagem Independente */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0f]">
        <MessageList messages={messages} currentUserId={currentUser.id} />
      </div>

      {/* 3. Rodapé: Campo de Entrada Fixo */}
      <MessageInput onSendMessage={handleSendMessage} />
    </section>
  );
}
