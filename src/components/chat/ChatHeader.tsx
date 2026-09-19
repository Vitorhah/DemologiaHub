import React from "react";
import { MessageSquare, Users } from "lucide-react";
import { SyncStatus } from "./types";

interface ChatHeaderProps {
  roomId: string;
  onlineCount?: number;
  syncStatus?: SyncStatus;
}

export function ChatHeader({
  roomId,
  onlineCount = 1,
  syncStatus = "connected",
}: ChatHeaderProps) {
  return (
    <header className="relative w-full bg-[var(--op-bg-secondary)] border-b border-[var(--op-border)] px-4 py-3 select-none z-20 rounded-none">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Lado Esquerdo: Ícone e Nome da Sala */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícone de Chat com badge sutil de conexão */}
          <div className="relative w-9 h-9 flex items-center justify-center bg-[rgba(181,42,48,0.15)] text-[var(--op-red-bright)] border border-[var(--op-border)] shrink-0 rounded-none">
            <MessageSquare size={17} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-[#0d0d12] rounded-none ${
                syncStatus === "connected"
                  ? "bg-emerald-500"
                  : syncStatus === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : syncStatus === "error"
                  ? "bg-red-500"
                  : "bg-gray-500"
              }`}
              title={
                syncStatus === "connected"
                  ? "Sincronização ativa"
                  : syncStatus === "connecting"
                  ? "Sincronizando..."
                  : syncStatus === "error"
                  ? "Erro de conexão"
                  : "Offline"
              }
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-white truncate">
                Chat da Mesa
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#161620] text-[#828392] border border-[var(--op-border)] rounded-none">
                {roomId}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#828392]">
              <Users size={11} className="text-[#9ca3af]" />
              <span>
                {onlineCount} {onlineCount === 1 ? "jogador na sessão" : "jogadores na sessão"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
