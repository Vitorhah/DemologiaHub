import React, { useEffect, useState } from "react";
import { AlertCircle, BarChart3, Check, Clock, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type {
  PollComputedResults,
  SessionPoll,
  SessionUtilityActionResult,
} from "../../types/sessionUtilities";
import { formatCountdownMMSS } from "../../utils/sessionUtilities";
import {
  CLINICAL_EASE,
  MotionModalBackdrop,
  MotionSheetPanel,
} from "../MotionPrimitives";

export interface PlayerPollModalProps {
  isOpen: boolean;
  poll: SessionPoll | null;
  results: PollComputedResults | null;
  isClosed: boolean;
  remainingSeconds: number;
  isSubmitting: boolean;
  onVote: (optionId: string) => Promise<SessionUtilityActionResult>;
  onClose: () => void;
}

/**
 * Pop-up de Enquete para jogadores seguindo exatamente o mesmo padrão visual,
 * estrutura e interações do PasswordAuthModal (acesso do Mestre).
 */
export const PlayerPollModal: React.FC<PlayerPollModalProps> = ({
  isOpen,
  poll,
  results,
  isClosed,
  remainingSeconds,
  isSubmitting,
  onVote,
  onClose,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Reseta seleção quando uma nova enquete é iniciada
  useEffect(() => {
    setSelectedOptionId(null);
    setVoteError(null);
  }, [poll?.id]);

  const userVotedOptionId = results?.userVotedOptionId ?? null;
  const hasVoted = Boolean(userVotedOptionId);
  const showResultsView = hasVoted || isClosed;
  const totalVotes = results?.totalVotes ?? 0;

  const handleConfirmVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId || isSubmitting || hasVoted || isClosed) return;
    setVoteError(null);
    const res = await onVote(selectedOptionId);
    if (!res.ok) {
      setVoteError(res.error || "Não foi possível registrar seu voto.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && poll && results && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[360] flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
          onClick={showResultsView ? onClose : undefined}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-modal-title"
            data-testid="player-poll-modal"
            className="w-full sm:max-w-md max-h-[90dvh] bg-[#0c0c10]/95 border-t sm:border border-[#282834] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.9)] relative overflow-hidden flex flex-col"
            style={{
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-[var(--op-red)] absolute top-0 left-0" />
            <div
              className="w-10 h-1 rounded-none bg-[#32323e] mx-auto mt-3 sm:hidden shrink-0"
              aria-hidden="true"
            />

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={onClose}
              data-testid="player-poll-close-x"
              className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white active:scale-95 hover:bg-white/[0.06] rounded-none transition-all cursor-pointer touch-manipulation"
              aria-label="Fechar enquete"
            >
              <X size={18} />
            </button>

            <div className="p-6 overflow-y-auto overscroll-contain">
              {/* Cabeçalho idêntico ao PasswordAuthModal */}
              <div className="flex items-center gap-3.5 mb-2 pr-10">
                <div className="w-11 h-11 rounded-none bg-[#1c090c] border border-[#6e1318] flex items-center justify-center text-[var(--op-red-bright)] shrink-0">
                  <BarChart3 size={18} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="poll-modal-title"
                    className="text-base font-bold text-white uppercase tracking-wider font-mono"
                  >
                    Enquete da Mesa
                  </h2>
                  <p className="text-xs text-[#8a8a98] mt-0.5 font-mono flex items-center gap-1.5 tabular-nums">
                    <Clock size={12} className="text-[var(--op-red-bright)] shrink-0" />
                    <span data-testid="player-poll-status-text">
                      {isClosed
                        ? "Votação encerrada"
                        : `Restam ${formatCountdownMMSS(remainingSeconds)}`}
                    </span>
                  </p>
                </div>
              </div>

              {/* Pergunta principal */}
              <div className="mt-4 pb-3 border-b border-[#1d1d26]">
                <p
                  data-testid="player-poll-question"
                  className="text-sm font-bold text-white leading-snug break-words"
                >
                  {poll.question}
                </p>
              </div>

              {/* Corpo: Votação vs Resultados em tempo real */}
              {!showResultsView ? (
                <form onSubmit={handleConfirmVote} className="mt-4 space-y-4">
                  <div
                    role="radiogroup"
                    aria-label={poll.question}
                    className="flex flex-col gap-2"
                  >
                    {poll.options.map((opt) => {
                      const isSelected = selectedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={`player-poll-option-${opt.id}`}
                          onClick={() => {
                            setSelectedOptionId(opt.id);
                            if (voteError) setVoteError(null);
                          }}
                          className={`w-full min-h-[46px] px-3.5 py-2.5 text-left border rounded-none flex items-center gap-3 transition-colors cursor-pointer touch-manipulation font-mono text-xs ${
                            isSelected
                              ? "bg-[#1c090c] border-[var(--op-red-bright)] text-white font-bold"
                              : "bg-[#08080b] border-[#262632] hover:border-[#3c3c4c] text-[#d4d4dc]"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-[var(--op-red-bright)] bg-[var(--op-red)] text-white"
                                : "border-[#454556]"
                            }`}
                          >
                            {isSelected && <Check size={11} />}
                          </span>
                          <span className="break-words min-w-0 leading-snug">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {voteError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: CLINICAL_EASE }}
                        role="alert"
                        className="p-3 bg-red-950/40 border border-red-800/60 rounded-none flex items-center gap-2 text-red-300 text-xs font-mono"
                      >
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{voteError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-2 flex items-center justify-end gap-2.5 font-mono">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider text-[#9ca3af] hover:text-white bg-[#14141c] hover:bg-[#1e1e28] active:scale-95 border border-[#282834] transition-all cursor-pointer touch-manipulation"
                    >
                      Fechar
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedOptionId || isSubmitting}
                      data-testid="player-poll-submit-btn"
                      className="flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 rounded-none bg-gradient-to-r from-[#b52a30] to-[#7a1015] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white border border-[#ff8085]/40 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer touch-manipulation flex items-center justify-center gap-2"
                    >
                      {isSubmitting && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      <span>
                        {isSubmitting ? "Registrando..." : "Confirmar Voto"}
                      </span>
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  data-testid="player-poll-results"
                  className="mt-4 space-y-4 font-mono"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-[#8a8a98]">
                    <span>
                      {isClosed ? "Resultados Finais" : "Resultados Parciais"}
                    </span>
                    {hasVoted && (
                      <span className="text-emerald-400 font-bold">
                        Voto registrado
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {results.options.map((opt) => {
                      const isUserChoice = userVotedOptionId === opt.id;
                      return (
                        <div
                          key={opt.id}
                          data-testid={`player-poll-result-${opt.id}`}
                          className={`p-2.5 border ${
                            isUserChoice
                              ? "bg-[#19090c] border-[var(--op-red-bright)]/70"
                              : "bg-[#08080b] border-[#22222c]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-white font-bold break-words">
                                {opt.label}
                              </span>
                              {isUserChoice && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-[#2a0c11] border border-[var(--op-red-bright)]/60 text-[#ff9ca0] uppercase tracking-wider shrink-0">
                                  Seu voto
                                </span>
                              )}
                            </div>
                            <span className="text-[#c4c5d2] tabular-nums shrink-0">
                              <strong className="text-white">
                                {opt.percentage}%
                              </strong>{" "}
                              <span className="text-[#8a8b9a]">
                                ({opt.votes}{" "}
                                {opt.votes === 1 ? "voto" : "votos"})
                              </span>
                            </span>
                          </div>
                          <div className="mt-2 h-2 w-full bg-[#14141c] border border-[#242430] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#8f171c] to-[#d93840] transition-[width] duration-300 ease-out"
                              style={{ width: `${opt.percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-[#1d1d26] flex items-center justify-between gap-3">
                    <span
                      data-testid="player-poll-total"
                      className="text-xs text-[#9ca3af] tabular-nums"
                    >
                      Total:{" "}
                      <strong className="text-white">{totalVotes}</strong>{" "}
                      {totalVotes === 1 ? "voto" : "votos"}.
                    </span>

                    <button
                      type="button"
                      onClick={onClose}
                      data-testid="player-poll-done-close-btn"
                      className="min-h-[44px] px-5 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-white bg-[#14141c] hover:bg-[#1e1e28] active:scale-95 border border-[#2c2c38] transition-all cursor-pointer touch-manipulation"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
