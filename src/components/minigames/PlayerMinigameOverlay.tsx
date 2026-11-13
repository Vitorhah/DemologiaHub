import React, { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MINIGAME_META, MinigameAssignment } from "../../types/minigames";
import { CLINICAL_EASE, SNAPPY_SPRING } from "../MotionPrimitives";
import { TimingMinigame } from "./TimingMinigame";
import { LockpickMinigame } from "./LockpickMinigame";
import { EmfMinigame } from "./EmfMinigame";
import { AimMinigame } from "./AimMinigame";

interface PlayerMinigameOverlayProps {
  assignment: MinigameAssignment | null;
  onFinish: (
    assignment: MinigameAssignment,
    hits: number,
    errors: number,
    success: boolean
  ) => Promise<void> | void;
  onDismiss: () => void;
}

export const PlayerMinigameOverlay: React.FC<PlayerMinigameOverlayProps> = ({
  assignment,
  onFinish,
  onDismiss,
}) => {
  const [hits, setHits] = useState(0);
  const [errors, setErrors] = useState(0);
  const [outcome, setOutcome] = useState<"playing" | "win" | "lose">("playing");
  const submittedAssignmentRef = useRef<string | null>(null);

  // Reset state whenever a new assignment arrives
  useEffect(() => {
    if (!assignment) {
      setHits(0);
      setErrors(0);
      setOutcome("playing");
      return;
    }
    setHits(0);
    setErrors(0);
    setOutcome("playing");
    submittedAssignmentRef.current = null;
  }, [assignment?.id]);

  // Lock background page interaction and scroll while minigame is active
  useEffect(() => {
    if (!assignment) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Block Tab navigation from escaping to underlying sheet/chat/sidebar
    const trapEvents = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", trapEvents, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", trapEvents, true);
    };
  }, [assignment]);

  const completeMinigame = useCallback(
    (finalHits: number, finalErrors: number, success: boolean) => {
      if (!assignment) return;
      if (submittedAssignmentRef.current === assignment.id) return;
      submittedAssignmentRef.current = assignment.id;
      setOutcome(success ? "win" : "lose");
      onFinish(assignment, finalHits, finalErrors, success);
    },
    [assignment, onFinish]
  );

  const handleHit = useCallback(
    (nextHits: number) => {
      if (!assignment || outcome !== "playing") return;
      setHits(nextHits);
      if (nextHits >= assignment.config.rounds) {
        completeMinigame(nextHits, errors, true);
      }
    },
    [assignment, outcome, errors, completeMinigame]
  );

  const handleMiss = useCallback(
    (nextErrors: number) => {
      if (!assignment || outcome !== "playing") return;
      setErrors(nextErrors);
      if (nextErrors >= assignment.config.maxErrors) {
        completeMinigame(hits, nextErrors, false);
      }
    },
    [assignment, outcome, hits, completeMinigame]
  );

  const meta = assignment ? MINIGAME_META[assignment.config.type] : null;
  const remainingChances = assignment
    ? Math.max(0, assignment.config.maxErrors - errors)
    : 0;

  return (
    <AnimatePresence>
      {assignment && meta && (
        <motion.div
          key={assignment.id}
          data-testid="player-minigame-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Minigame ${meta.label}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: CLINICAL_EASE }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          // Overlay preto de tela cheia com baixa opacidade cobrindo e bloqueando a ficha
          className="fixed inset-0 z-[450] bg-black/50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: CLINICAL_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#09090b] border border-[#2e2e36] shadow-[0_24px_70px_rgba(0,0,0,0.95)] relative overflow-hidden font-mono"
          >
            {/* Top geometric accent strip (green on win, red on lose, gray while active) */}
            <div
              className={`h-[3px] w-full transition-colors ${
                outcome === "win"
                  ? "bg-[#22c55e]"
                  : outcome === "lose"
                    ? "bg-[#dc2626]"
                    : "bg-[#71717a]"
              }`}
            />

            {/* Header */}
            <div className="px-4 py-3 bg-[#101014] border-b border-[#222229] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#71717a]">
                  PROTOCOLO DO MESTRE
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white truncate">
                  {meta.label}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Score pips */}
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-[#71717a]">
                    ACERTOS
                  </div>
                  <div className="text-xs font-bold text-[#22c55e] tabular-nums">
                    {hits} / {assignment.config.rounds}
                  </div>
                </div>

                {/* Remaining chances squares */}
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-[#71717a]">
                    CHANCES
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {Array.from({ length: assignment.config.maxErrors }, (_, idx) => {
                      const alive = idx < remainingChances;
                      return (
                        <span
                          key={idx}
                          className={`w-2.5 h-2.5 border ${
                            alive
                              ? "bg-[#e4e4e7] border-[#a1a1aa]"
                              : "bg-[#dc2626]/30 border-[#dc2626]"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5">
              <p className="text-[11px] text-[#a1a1aa] text-center mb-4 leading-relaxed">
                {meta.playerInstruction}
              </p>

              {outcome === "playing" ? (
                <>
                  {assignment.config.type === "timing" && (
                    <TimingMinigame
                      config={assignment.config}
                      hits={hits}
                      errors={errors}
                      finished={false}
                      onHit={handleHit}
                      onMiss={handleMiss}
                    />
                  )}
                  {assignment.config.type === "lockpick" && (
                    <LockpickMinigame
                      config={assignment.config}
                      hits={hits}
                      errors={errors}
                      finished={false}
                      onHit={handleHit}
                      onMiss={handleMiss}
                    />
                  )}
                  {assignment.config.type === "emf" && (
                    <EmfMinigame
                      config={assignment.config}
                      hits={hits}
                      errors={errors}
                      finished={false}
                      onHit={handleHit}
                      onMiss={handleMiss}
                    />
                  )}
                  {assignment.config.type === "aim" && (
                    <AimMinigame
                      config={assignment.config}
                      hits={hits}
                      errors={errors}
                      finished={false}
                      onHit={handleHit}
                      onMiss={handleMiss}
                    />
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SNAPPY_SPRING}
                  className={`border p-6 text-center space-y-4 ${
                    outcome === "win"
                      ? "bg-[#0a140d] border-[#22c55e]/60"
                      : "bg-[#160a0a] border-[#dc2626]/60"
                  }`}
                >
                  {/* Clean geometric outcome emblem */}
                  <div className="flex justify-center">
                    <div
                      className={`w-12 h-12 border-2 flex items-center justify-center ${
                        outcome === "win"
                          ? "border-[#22c55e] bg-[#22c55e]/15"
                          : "border-[#dc2626] bg-[#dc2626]/15"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" strokeWidth="2.2">
                        {outcome === "win" ? (
                          <polyline points="5,13 10,18 19,7" stroke="#22c55e" />
                        ) : (
                          <>
                            <line x1="6" y1="6" x2="18" y2="18" stroke="#ef4444" />
                            <line x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" />
                          </>
                        )}
                      </svg>
                    </div>
                  </div>

                  <div>
                    <h3
                      className={`text-base font-bold uppercase tracking-[0.2em] ${
                        outcome === "win" ? "text-[#22c55e]" : "text-[#ef4444]"
                      }`}
                    >
                      {outcome === "win" ? "SUCESSO" : "FALHA"}
                    </h3>
                    <p className="text-xs text-[#d4d4d8] mt-1 tabular-nums">
                      Total de acertos:{" "}
                      <strong className="text-white">
                        {hits} / {assignment.config.rounds}
                      </strong>
                    </p>
                    <p className="text-[10px] text-[#71717a] uppercase tracking-wider mt-1">
                      Resultado transmitido ao Mestre
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onDismiss}
                    className="w-full min-h-[44px] bg-[#18181d] hover:bg-[#25252d] border border-[#3f3f46] text-white text-xs font-bold uppercase tracking-[0.2em] cursor-pointer touch-manipulation transition-colors"
                  >
                    Fechar e Voltar à Ficha
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
