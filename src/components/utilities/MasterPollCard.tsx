import React, { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Send,
  StopCircle,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type {
  CreatePollInput,
  PollComputedResults,
  SessionPoll,
  SessionUtilityActionResult,
} from "../../types/sessionUtilities";
import {
  POLL_DURATION_PRESETS,
  POLL_MAX_DURATION_SEC,
  POLL_MAX_OPTIONS,
  POLL_MIN_DURATION_SEC,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_QUESTION_MAX_LENGTH,
  formatCountdownMMSS,
} from "../../utils/sessionUtilities";
import { CLINICAL_EASE } from "../MotionPrimitives";

export interface MasterPollCardProps {
  activePoll: SessionPoll | null;
  pollResults: PollComputedResults | null;
  isPollClosedNow: boolean;
  pollRemainingSeconds: number;
  isSaving: boolean;
  syncError: string | null;
  onCreatePoll: (input: CreatePollInput) => Promise<SessionUtilityActionResult>;
  onClosePoll: () => Promise<SessionUtilityActionResult>;
  onClearClosedPoll: () => void;
}

export const MasterPollCard: React.FC<MasterPollCardProps> = ({
  activePoll,
  pollResults,
  isPollClosedNow,
  pollRemainingSeconds,
  isSaving,
  syncError,
  onCreatePoll,
  onClosePoll,
  onClearClosedPoll,
}) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isRunningPoll = Boolean(activePoll && !isPollClosedNow);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
    if (feedback) setFeedback(null);
  };

  const handleAddOption = () => {
    if (options.length >= POLL_MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= POLL_MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await onCreatePoll({
      question,
      options,
      durationSeconds,
    });
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível iniciar a enquete.",
      });
    } else {
      setQuestion("");
      setOptions(["", ""]);
      setFeedback({
        type: "success",
        text: "Enquete iniciada e transmitida automaticamente para todos os jogadores da sessão.",
      });
    }
  };

  const handleClosePoll = async () => {
    setFeedback(null);
    const res = await onClosePoll();
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Falha ao encerrar a enquete.",
      });
    } else {
      setFeedback({
        type: "success",
        text: "Enquete encerrada. Resultados finais sincronizados com os jogadores.",
      });
    }
  };

  const totalVotes = pollResults?.totalVotes ?? 0;

  return (
    <section
      aria-label="Enquete em Tempo Real"
      data-testid="master-poll-card"
      className={`bg-[#0c0c10] border rounded-none p-4 sm:p-5 flex flex-col gap-4 font-mono relative overflow-hidden ${
        isRunningPoll ? "border-[#8f171c]/80" : "border-[#202028]"
      }`}
    >
      {isRunningPoll && (
        <div
          className="h-[2px] w-full bg-[var(--op-red-bright)] absolute top-0 left-0"
          aria-hidden="true"
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1c1c24] pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-[#160a0d] border border-[#8f171c]/50 flex items-center justify-center text-[var(--op-red-bright)] shrink-0">
            <BarChart3 size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Enquete da Mesa
              </h3>
              {activePoll && (
                <span
                  data-testid="master-poll-status-badge"
                  className={`text-[10px] px-2 py-0.5 border uppercase tracking-widest font-bold tabular-nums ${
                    isRunningPoll
                      ? "bg-[#220a0d] border-[var(--op-red-bright)] text-[#ff9ca0]"
                      : "bg-[#121218] border-[#2c2c38] text-[#b4b5c2]"
                  }`}
                >
                  {isRunningPoll
                    ? `Ativa · ${formatCountdownMMSS(pollRemainingSeconds)}`
                    : "Encerrada"}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8c8d9c] mt-1">
              Inicie votações coletivas em pop-up com atualização de resultados em tempo real.
            </p>
          </div>
        </div>

        {activePoll && isRunningPoll && (
          <button
            type="button"
            onClick={handleClosePoll}
            disabled={isSaving}
            data-testid="master-poll-close-btn"
            className="min-h-[44px] px-4 py-2 bg-[#1a0a0d] hover:bg-[#2a0f14] border border-[#8f171c] text-[#ff9ca0] hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-colors shrink-0 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <StopCircle size={14} />
            )}
            <span>Encerrar Enquete</span>
          </button>
        )}

        {activePoll && !isRunningPoll && (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              onClearClosedPoll();
            }}
            data-testid="master-poll-new-btn"
            className="min-h-[44px] px-4 py-2 bg-[#14141c] hover:bg-[#1e1e2b] border border-[#2c2c3a] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-colors shrink-0"
          >
            <Plus size={14} />
            <span>Nova Enquete</span>
          </button>
        )}
      </div>

      {/* Resultados ao vivo / finais quando existe enquete */}
      {activePoll && pollResults ? (
        <div
          data-testid="master-poll-results"
          className="bg-[#09090d] border border-[#22222c] p-4 flex flex-col gap-3.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1c1c25] pb-2.5">
            <h4 className="text-sm font-bold text-white leading-snug">
              {activePoll.question}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] tabular-nums shrink-0">
              <Clock size={12} className="text-[var(--op-red-bright)]" />
              <span>
                {isRunningPoll
                  ? `Restam ${formatCountdownMMSS(pollRemainingSeconds)}`
                  : "Votação finalizada"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {pollResults.options.map((opt) => (
              <div
                key={opt.id}
                data-testid={`master-poll-option-result-${opt.id}`}
                className="flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-zinc-100 font-bold break-words min-w-0">
                    {opt.label}
                  </span>
                  <span className="text-[#c4c5d2] tabular-nums shrink-0">
                    <strong className="text-white">{opt.percentage}%</strong>{" "}
                    <span className="text-[#8a8b9a]">
                      ({opt.votes} {opt.votes === 1 ? "voto" : "votos"})
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full bg-[#14141c] border border-[#22222c] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8f171c] to-[#d93840] transition-[width] duration-300 ease-out"
                    style={{ width: `${opt.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#1c1c25] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9ca3af] tabular-nums">
            <span data-testid="master-poll-total-votes">
              Total: <strong className="text-white">{totalVotes}</strong>{" "}
              {totalVotes === 1 ? "voto" : "votos"}.
            </span>
            <span>
              {isRunningPoll
                ? "Resultados atualizados automaticamente em tempo real."
                : "Resultados finais visíveis até o jogador fechar ou nova enquete iniciar."}
            </span>
          </div>
        </div>
      ) : (
        /* Formulário de Criação da Enquete */
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Pergunta */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="master-poll-question-input"
                className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold"
              >
                1. Pergunta Principal
              </label>
              <span className="text-[10px] text-[#787989] tabular-nums">
                {question.length}/{POLL_QUESTION_MAX_LENGTH}
              </span>
            </div>
            <input
              id="master-poll-question-input"
              data-testid="master-poll-question-input"
              type="text"
              maxLength={POLL_QUESTION_MAX_LENGTH}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder="Ex: Qual será o próximo destino?"
              className="w-full min-h-[44px] bg-[#08080b] border border-[#262632] focus:border-[var(--op-red-bright)] text-white text-sm sm:text-xs font-mono px-3.5 py-2.5 rounded-none outline-none placeholder:text-[#52525b]"
            />
          </div>

          {/* Opções */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold">
                2. Opções de Resposta ({options.length}/{POLL_MAX_OPTIONS})
              </span>
              <button
                type="button"
                onClick={handleAddOption}
                disabled={options.length >= POLL_MAX_OPTIONS}
                data-testid="master-poll-add-option-btn"
                className="min-h-[36px] px-2.5 bg-[#14141c] hover:bg-[#1e1e2b] disabled:opacity-40 border border-[#2c2c38] text-zinc-200 hover:text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer touch-manipulation"
              >
                <Plus size={12} />
                <span>Adicionar Opção</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-7 text-center text-[11px] text-[#787989] tabular-nums shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    maxLength={POLL_OPTION_MAX_LENGTH}
                    value={opt}
                    data-testid={`master-poll-option-input-${idx}`}
                    aria-label={`Opção ${idx + 1}`}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Opção ${idx + 1}`}
                    className="flex-1 min-w-0 min-h-[44px] bg-[#08080b] border border-[#262632] focus:border-[var(--op-red-bright)] text-white text-sm sm:text-xs font-mono px-3.5 py-2 rounded-none outline-none placeholder:text-[#52525b]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    disabled={options.length <= POLL_MIN_OPTIONS}
                    aria-label={`Remover opção ${idx + 1}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#121218] hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed border border-[#262632] hover:border-red-800/60 text-[#8a8b9a] hover:text-red-300 cursor-pointer touch-manipulation transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Duração */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold">
              3. Duração da Enquete
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {POLL_DURATION_PRESETS.map((preset) => {
                const selected = durationSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setDurationSeconds(preset.seconds)}
                    aria-pressed={selected}
                    data-testid={`master-poll-duration-${preset.seconds}`}
                    className={`min-h-[40px] px-3 border text-xs font-bold uppercase tracking-wider cursor-pointer touch-manipulation transition-colors tabular-nums ${
                      selected
                        ? "bg-[#220a0d] border-[var(--op-red-bright)] text-white"
                        : "bg-[#101016] border-[#262632] text-[#9ca3af] hover:text-white hover:border-[#3c3c4c]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5 ml-auto bg-[#08080b] border border-[#262632] px-2.5 min-h-[40px]">
                <label
                  htmlFor="master-poll-custom-duration"
                  className="text-[10px] uppercase tracking-wider text-[#828392]"
                >
                  Segundos:
                </label>
                <input
                  id="master-poll-custom-duration"
                  data-testid="master-poll-custom-duration"
                  type="number"
                  min={POLL_MIN_DURATION_SEC}
                  max={POLL_MAX_DURATION_SEC}
                  value={durationSeconds}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isFinite(parsed)) {
                      setDurationSeconds(parsed);
                    }
                  }}
                  className="w-16 bg-transparent text-white text-xs font-bold tabular-nums outline-none text-right"
                />
              </div>
            </div>
          </div>

          {/* Ação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1c1c24]">
            <div className="text-[11px] text-[#787989]">
              A enquete abrirá automaticamente em pop-up para todos os jogadores desta mesa.
            </div>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="master-poll-start-btn"
              className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#b52a30] to-[#7a1015] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 border border-[#ff8085]/40 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-all shrink-0"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>{isSaving ? "Iniciando..." : "Iniciar Enquete"}</span>
            </button>
          </div>
        </form>
      )}

      <AnimatePresence initial={false}>
        {(feedback || syncError) && (
          <motion.div
            key={feedback?.text || syncError}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: CLINICAL_EASE }}
            role="status"
            className={`px-3 py-2.5 text-xs border flex items-center gap-2 ${
              feedback?.type === "error" || (!feedback && syncError)
                ? "bg-red-950/45 border-red-700/60 text-red-300"
                : "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
            }`}
          >
            {feedback?.type === "error" || (!feedback && syncError) ? (
              <AlertTriangle size={14} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            )}
            <span>{feedback?.text || syncError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
