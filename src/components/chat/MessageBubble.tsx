import React from "react";
import { ChatMessage } from "./types";

export interface MessageBubbleProps {
  key?: React.Key;
  message: ChatMessage;
  isSelf: boolean;
  showTime?: boolean;
}

export function MessageBubble({ message, isSelf, showTime = true }: MessageBubbleProps) {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex flex-col group ${
        isSelf ? "items-end" : "items-start"
      } w-full`}
    >
      {/* Balão com bordas no padrão Demologia e cantos angulares */}
      <div
        className={`relative px-3.5 py-2.5 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] font-mono text-xs sm:text-[13px] leading-relaxed select-text transition-colors duration-150 rounded-none ${
          isSelf
            ? "bg-[rgba(181,42,48,0.22)] hover:bg-[rgba(181,42,48,0.28)] text-[#f5f5f7] border border-[var(--op-red)] shadow-[0_2px_8px_rgba(181,42,48,0.15)]"
            : "bg-[var(--op-panel)] hover:bg-[var(--op-panel-light)] text-[#dedee8] border border-[var(--op-border)]"
        }`}
      >
        {/* Conteúdo textual seguro (sem XSS) */}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>

        {/* Timestamp discreto no canto inferior */}
        {showTime && (
          <div
            className={`flex items-center gap-1 mt-1 text-[10px] font-mono tracking-wider ${
              isSelf ? "justify-end text-[var(--op-red-bright)]/80" : "justify-start text-[#717282]"
            }`}
          >
            <span>{formattedTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}
