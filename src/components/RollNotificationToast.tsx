import React, { useEffect } from "react";
import { Dices, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { CLINICAL_EASE, SNAPPY_SPRING } from "./MotionPrimitives";

export interface RollToastData {
  id: number;
  formula: string;
  result: number;
  details: string;
  critical?: "crit" | "fumble" | "normal";
}

interface RollNotificationToastProps {
  roll: RollToastData | null;
  onDismiss: () => void;
  isRlMode?: boolean;
}

export const RollNotificationToast: React.FC<RollNotificationToastProps> = ({
  roll,
  onDismiss,
  isRlMode = false,
}) => {
  useEffect(() => {
    if (!roll) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [roll, onDismiss]);

  const isCrit = roll?.critical === "crit";
  const isFumble = roll?.critical === "fumble";

  return (
    <AnimatePresence mode="wait">
      {roll && (
        <motion.div
          key={roll.id}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, x: 24, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, y: -6, scale: 0.96 }}
          transition={SNAPPY_SPRING}
          style={{
            top: "max(0.85rem, env(safe-area-inset-top, 0.85rem))",
            willChange: "transform, opacity",
          }}
          className="fixed right-3 sm:right-5 z-[170] w-[calc(100vw-4.5rem)] sm:w-[calc(100vw-1.5rem)] max-w-xs pointer-events-auto font-mono"
        >
          <div
            className={`relative bg-[#0d0d13]/95 backdrop-blur-md border shadow-[0_14px_34px_rgba(0,0,0,0.85)] p-3 pr-10 flex items-center gap-3 ${
              isCrit
                ? "border-emerald-500/70"
                : isFumble
                  ? "border-red-600/80"
                  : isRlMode
                    ? "border-purple-500/50"
                    : "border-[var(--op-red)]/60"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] ${
                isCrit
                  ? "bg-emerald-400"
                  : isFumble
                    ? "bg-red-500"
                    : isRlMode
                      ? "bg-purple-500"
                      : "bg-[var(--op-red-bright)]"
              }`}
            />

            <motion.div
              initial={{ rotate: -18, scale: 0.85 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: CLINICAL_EASE }}
              className={`w-10 h-10 flex items-center justify-center border shrink-0 ${
                isCrit
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                  : isFumble
                    ? "bg-red-950/70 border-red-500/50 text-red-400"
                    : isRlMode
                      ? "bg-purple-950/50 border-purple-500/40 text-purple-300"
                      : "bg-[#1d090b] border-[var(--op-red)]/40 text-[var(--op-red-bright)]"
              }`}
            >
              <Dices size={18} />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
                  {roll.formula}
                </span>
                {isCrit && (
                  <span className="text-[9px] uppercase font-bold text-emerald-400 shrink-0">
                    CRÍTICO
                  </span>
                )}
                {isFumble && (
                  <span className="text-[9px] uppercase font-bold text-red-400 shrink-0">
                    DESASTRE
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#9a9aa8] truncate mt-0.5">
                {roll.details}
              </div>
            </div>

            <div className="text-right shrink-0">
              <motion.div
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.22, ease: CLINICAL_EASE }}
                className={`text-2xl font-black tabular-nums leading-none ${
                  isCrit
                    ? "text-emerald-300"
                    : isFumble
                      ? "text-red-400"
                      : "text-white"
                }`}
              >
                {roll.result}
              </motion.div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar notificação de rolagem"
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-[#787989] hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
