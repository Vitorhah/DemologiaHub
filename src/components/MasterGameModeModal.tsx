import React, { useState } from "react";
import {
  X,
  Flame,
  EyeOff,
  Check,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { GameMode } from "../types";

export interface MasterGameModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGlobalMode: GameMode;
  playerModes: Record<string, GameMode>;
  players: any[];
  onApplyMode: (target: "all" | string, mode: GameMode) => Promise<void>;
}

export const MasterGameModeModal: React.FC<MasterGameModeModalProps> = ({
  isOpen,
  onClose,
  currentGlobalMode,
  playerModes,
  players,
  onApplyMode,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPlayersList, setShowPlayersList] = useState(false);

  if (!isOpen) return null;

  const handleSelectModeForAll = async (mode: GameMode) => {
    setIsSubmitting(true);
    try {
      await onApplyMode("all", mode);
      setSuccessMessage(
        `Modo "${mode === "rl" ? "Real L" : "Demologia"}" ativado com sucesso!`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Erro ao aplicar modo:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePlayer = async (playerId: string) => {
    const current = playerModes[playerId] || currentGlobalMode;
    const next: GameMode = current === "rl" ? "demologia" : "rl";
    try {
      await onApplyMode(playerId, next);
    } catch (err) {
      console.error("Erro ao alterar modo do jogador:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-lg max-h-[90dvh] bg-[#0c0c10]/95 border-t sm:border border-[#282834] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden font-mono animate-sheet-up"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-none bg-[#32323e] mx-auto mt-2.5 mb-1 sm:hidden shrink-0" aria-hidden="true" />

        {/* CABEÇALHO */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#101016] border-b border-[#20202a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-none flex items-center justify-center bg-[#181822] border border-[#2a2a38] text-white shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Trocar Tema // Modo de Jogo
              </h3>
              <p className="text-[11px] text-[#8a8a98]">
                Atualmente em:{" "}
                <span className="font-bold text-white uppercase">
                  {currentGlobalMode === "rl" ? "Real L (Mundano)" : "Demologia (Paranormal)"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white active:scale-95 bg-[#16161e] border border-[#262632] rounded-none transition-all cursor-pointer touch-manipulation"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* MENSAGEM DE SUCESSO */}
        {successMessage && (
          <div className="px-5 py-2.5 bg-emerald-950/50 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
            <Check size={14} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* OPÇÃO 1: DEMOLOGIA */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectModeForAll("demologia")}
              className={`p-4 border text-left rounded-none transition-all cursor-pointer flex flex-col justify-between group relative active:scale-[0.98] touch-manipulation ${
                currentGlobalMode === "demologia"
                  ? "bg-[#180b0e] border-[#b52a30] ring-1 ring-[#b52a30]"
                  : "bg-[#111117] border-[#22222e] hover:border-[#363646]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-[var(--op-red-bright)]">
                    <Flame size={18} />
                    <span className="font-bold text-sm uppercase tracking-wider text-white">
                      Demologia
                    </span>
                  </div>
                  {currentGlobalMode === "demologia" && (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-[var(--op-red)]/25 text-[#ff8085] px-2 py-0.5 rounded-none border border-[var(--op-red)]/50">
                      <Check size={10} /> Ativo
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#9d9ea9] leading-relaxed mb-3">
                  <strong>Paranormal Ativo</strong>. Rituais e habilidades liberados. Exibe <strong>PE</strong> (Pontos de Esforço) e tema carmesim.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#26181b] flex items-center justify-between text-[11px] text-[#787a8b] transition-colors">
                <span>Ativar para Todos</span>
                <span className="text-[var(--op-red-bright)] font-bold">→</span>
              </div>
            </button>

            {/* OPÇÃO 2: REAL L */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectModeForAll("rl")}
              className={`p-4 border text-left rounded-none transition-all cursor-pointer flex flex-col justify-between group relative active:scale-[0.98] touch-manipulation ${
                currentGlobalMode === "rl"
                  ? "bg-[#140b20] border-purple-400 ring-1 ring-purple-400"
                  : "bg-[#111117] border-[#22222e] hover:border-[#363646]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-purple-300">
                    <EyeOff size={18} />
                    <span className="font-bold text-sm uppercase tracking-wider text-white">
                      Real L
                    </span>
                  </div>
                  {currentGlobalMode === "rl" && (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-purple-950/60 text-purple-200 px-2 py-0.5 rounded-none border border-purple-400/50">
                      <Check size={10} /> Ativo
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#9d9ea9] leading-relaxed mb-3">
                  <strong>Mundano / Sem Paranormal</strong>. Skills ocultas, logo discreta e <strong>SN</strong> (Sanidade) no lugar do PE com tema roxo/branco.
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#231733] flex items-center justify-between text-[11px] text-[#787a8b] transition-colors">
                <span>Ativar para Todos</span>
                <span className="text-purple-300 font-bold">→</span>
              </div>
            </button>
          </div>

          {/* CONTROLE INDIVIDUAL DE JOGADORES */}
          {players.length > 0 && (
            <div className="pt-2 border-t border-[#20202a]">
              <button
                type="button"
                onClick={() => setShowPlayersList(!showPlayersList)}
                className="w-full min-h-[44px] flex items-center justify-between py-2 text-xs text-[#9ca3af] hover:text-white transition-colors cursor-pointer touch-manipulation"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span>Ajustar jogadores individualmente ({players.length})</span>
                </span>
                {showPlayersList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showPlayersList && (
                <div className="mt-2 bg-[#101016] border border-[#22222e] rounded-none divide-y divide-[#1a1a24] max-h-44 overflow-y-auto">
                  {players.map((p) => {
                    const pMode = playerModes[p.id] || currentGlobalMode;
                    const isPlayerRl = pMode === "rl";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs min-h-[44px]"
                      >
                        <span className="text-white font-bold truncate max-w-[150px] sm:max-w-[180px]">
                          {p.name || "Agente"}
                        </span>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-none border ${
                              isPlayerRl
                                ? "bg-purple-950/40 text-purple-200 border-purple-400/50"
                                : "bg-[var(--op-red)]/20 text-[#ff8085] border-[var(--op-red)]/40"
                            }`}
                          >
                            {isPlayerRl ? "Real L" : "Demologia"}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleTogglePlayer(p.id)}
                            disabled={isSubmitting}
                            className="min-h-[38px] px-3.5 py-1.5 bg-[#181822] hover:bg-[#222230] active:scale-95 text-white border border-[#2c2c3a] rounded-none text-[10px] uppercase font-bold cursor-pointer transition-all touch-manipulation"
                          >
                            Alternar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="px-5 py-3 bg-[#101016] border-t border-[#20202a] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2 bg-[#181822] hover:bg-[#222230] active:scale-95 text-white border border-[#2c2c3a] text-xs uppercase tracking-wider font-bold rounded-none cursor-pointer transition-all touch-manipulation"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
