import React, { useState } from "react";
import { Wrench, UserX, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { MinigameConfig, MinigameResultPayload } from "../types/minigames";
import { MasterMinigamesPanel } from "./minigames/MasterMinigamesPanel";

export interface MasterUtilitiesViewProps {
  ocultistaCount: number;
  onDisconnectDefaultSheets: () => Promise<{
    removedCount: number;
    error?: string;
  }>;
  players: { id: string; name?: string }[];
  minigameResults: MinigameResultPayload[];
  isSendingMinigame: boolean;
  onSendMinigame: (
    config: MinigameConfig,
    targetPlayerIds: string[]
  ) => Promise<{ ok: boolean; error?: string }>;
  onClearMinigameResults: () => void;
}

export function MasterUtilitiesView({
  ocultistaCount,
  onDisconnectDefaultSheets,
  players,
  minigameResults,
  isSendingMinigame,
  onSendMinigame,
  onClearMinigameResults,
}: MasterUtilitiesViewProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  const handleDisconnectClick = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setFeedback(null);
    try {
      const res = await onDisconnectDefaultSheets();
      if (res.error) {
        setFeedback({
          type: "error",
          text: res.error,
        });
      } else if (res.removedCount === 0) {
        setFeedback({
          type: "info",
          text: 'Nenhuma ficha com o nome "Ocultista" encontrada para desconectar.',
        });
      } else {
        setFeedback({
          type: "success",
          text: `${res.removedCount} ficha${res.removedCount === 1 ? "" : "s"} "Ocultista" desconectada${res.removedCount === 1 ? "" : "s"} com sucesso.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || 'Erro ao limpar fichas "Ocultista".',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 px-3 sm:px-4 font-mono my-4">
      <div className="bg-[#0c0c10] border border-[#202028] rounded-none p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 bg-[#160a0d] border border-[#8f171c]/50 flex items-center justify-center text-[var(--op-red-bright)] shrink-0">
            <Wrench size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider truncate">
              Utilities do Mestre
            </h2>
            <p className="text-xs text-[#828392] truncate">
              Ferramentas administrativas de limpeza e manutenção da mesa.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#0c0c10] border border-[#202028] rounded-none p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Desconectar Fichas Padrões
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 border tabular-nums uppercase tracking-wider ${
                  ocultistaCount > 0
                    ? "bg-[#220a0d] border-[#8f171c]/60 text-[#ff8a90]"
                    : "bg-[#121218] border-[#262632] text-[#787989]"
                }`}
              >
                {ocultistaCount} detectada{ocultistaCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-[#8c8d9c] mt-1">
              Eliminar pragas..
            </p>
          </div>

          <button
            type="button"
            onClick={handleDisconnectClick}
            disabled={isCleaning}
            className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-[#8f171c] to-[#5c0e12] hover:from-[#b52a30] hover:to-[#7a1319] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer touch-manipulation flex items-center justify-center gap-2 shrink-0"
          >
            {isCleaning ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <UserX size={15} />
            )}
            <span>
              {isCleaning ? "Limpando..." : "Desconectar Fichas Padrões"}
            </span>
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            className={`px-3 py-2.5 text-xs border flex items-center gap-2 ${
              feedback.type === "error"
                ? "bg-red-950/45 border-red-700/60 text-red-300"
                : feedback.type === "success"
                  ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
                  : "bg-[#13131b] border-[#282834] text-[#b4b5c2]"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertTriangle size={14} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2
                size={14}
                className={`shrink-0 ${
                  feedback.type === "success" ? "text-emerald-400" : "text-[#8a8b99]"
                }`}
              />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      <MasterMinigamesPanel
        players={players}
        recentResults={minigameResults}
        isSending={isSendingMinigame}
        onSendMinigame={onSendMinigame}
        onClearResults={onClearMinigameResults}
      />
    </div>
  );
}
