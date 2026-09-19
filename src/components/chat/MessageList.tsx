import React, { useEffect, useRef, useMemo } from "react";
import { ChatMessage, MessageGroupData } from "./types";
import { MessageGroup } from "./MessageGroup";
import { MessageSquare } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);

  // Agrupa mensagens consecutivas do mesmo jogador
  const messageGroups = useMemo<MessageGroupData[]>(() => {
    if (!messages.length) return [];

    const groups: MessageGroupData[] = [];
    let currentGroup: MessageGroupData | null = null;

    for (const msg of messages) {
      const isSelf = msg.senderId === currentUserId;

      if (
        currentGroup &&
        currentGroup.senderId === msg.senderId &&
        // Se a diferença de tempo for menor que 5 minutos, agrupa no mesmo bloco
        msg.timestamp - currentGroup.timestamp < 5 * 60 * 1000
      ) {
        currentGroup.messages.push(msg);
        currentGroup.timestamp = msg.timestamp; // atualiza com o timestamp mais recente do grupo
      } else {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,
          isMaster: msg.isMaster,
          isSelf,
          messages: [msg],
          timestamp: msg.timestamp,
        };
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [messages, currentUserId]);

  // Rola para a mensagem mais recente sem saltar a tela principal
  const scrollToBottom = (smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  useEffect(() => {
    if (isFirstLoadRef.current) {
      scrollToBottom(false);
      isFirstLoadRef.current = false;
    } else {
      scrollToBottom(true);
    }
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 custom-scrollbar"
      style={{ minHeight: "200px" }}
    >
      {messageGroups.length === 0 ? (
        /* ESTADO VAZIO MINIMALISTA */
        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 select-none font-mono">
          <div className="w-12 h-12 flex items-center justify-center bg-[var(--op-panel)] border border-[var(--op-border)] text-[var(--op-red-bright)] mb-4 rounded-none">
            <MessageSquare size={22} />
          </div>

          <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2">
            Chat da Mesa
          </h3>

          <p className="text-xs text-[#787a8c] leading-relaxed max-w-xs">
            Nenhuma mensagem ainda.
            <br />
            <span className="text-[#a4a7bc] text-xs">Seja o primeiro a falar.</span>
          </p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col">
          {messageGroups.map((group, idx) => (
            <MessageGroup
              key={`${group.senderId}-${group.timestamp}-${idx}`}
              group={group}
            />
          ))}
          {/* Elemento de ancoragem para auto-scroll */}
          <div ref={bottomRef} className="h-2 shrink-0" />
        </div>
      )}
    </div>
  );
}
