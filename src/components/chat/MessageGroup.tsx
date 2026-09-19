import React from "react";
import { MessageGroupData } from "./types";
import { MessageBubble } from "./MessageBubble";
import { ShieldAlert, User } from "lucide-react";

export interface MessageGroupProps {
  key?: React.Key;
  group: MessageGroupData;
}

export function MessageGroup({ group }: MessageGroupProps) {
  const { senderName, isSelf, isMaster, messages, timestamp } = group;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const initial = (senderName || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`w-full flex flex-col my-3.5 transition-all duration-150 ${
        isSelf ? "items-end" : "items-start"
      }`}
    >
      {/* Cabeçalho do Grupo de Mensagens (Nome do autor e Avatar) */}
      <div
        className={`flex items-center gap-2 mb-1 px-1 select-none ${
          isSelf ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar com inicial ou ícone do Mestre */}
        <div
          className={`w-6 h-6 flex items-center justify-center font-mono text-[11px] font-bold shrink-0 rounded-none ${
            isSelf
              ? "bg-[rgba(181,42,48,0.3)] text-[var(--op-red-bright)] border border-[var(--op-red)]"
              : isMaster
              ? "bg-amber-950/40 text-amber-400 border border-amber-600/50"
              : "bg-[var(--op-panel)] text-[#9ca3af] border border-[var(--op-border)]"
          }`}
          title={senderName}
        >
          {isMaster ? <ShieldAlert size={12} /> : initial || <User size={12} />}
        </div>

        {/* Nome do Autor & Badges */}
        <div
          className={`flex items-center gap-1.5 ${
            isSelf ? "flex-row-reverse text-right" : "flex-row text-left"
          }`}
        >
          <span
            className={`font-mono text-xs font-bold tracking-wide uppercase ${
              isSelf
                ? "text-[#dedee8]"
                : isMaster
                ? "text-amber-400"
                : "text-[#c2c4d4]"
            }`}
          >
            {senderName}
          </span>

          {isMaster && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-none">
              Mestre
            </span>
          )}

          {isSelf && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 bg-[var(--op-red)]/15 text-[var(--op-red-bright)] border border-[var(--op-red)]/30 rounded-none">
              Você
            </span>
          )}
        </div>
      </div>

      {/* Conjunto de Balões Consecutivos */}
      <div
        className={`flex flex-col gap-1.5 w-full ${
          isSelf ? "items-end" : "items-start"
        }`}
      >
        {messages.map((msg, index) => {
          const isLast = index === messages.length - 1;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={isSelf}
              showTime={false}
            />
          );
        })}
      </div>

      {/* Horário sutil no rodapé do grupo */}
      <div
        className={`mt-1 px-1.5 text-[10px] font-mono tracking-wider text-[#636473] select-none ${
          isSelf ? "text-right" : "text-left"
        }`}
      >
        <span>{formattedTime}</span>
      </div>
    </div>
  );
}
