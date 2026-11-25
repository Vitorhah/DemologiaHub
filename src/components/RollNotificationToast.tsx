import React, { useEffect } from "react";
import { Dices, HeartPulse, Skull, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { CLINICAL_EASE } from "./MotionPrimitives";
import type { UltimoSuspiroNotification } from "../utils/ultimoSuspiro";
import { computeNotificationDurationMs } from "../utils/playerSettings";

export interface RollToastData {
  id: number;
  formula: string;
  result: number | string;
  details: string;
  critical?: "crit" | "fumble" | "normal";
  kind?: "roll" | "ultimo_suspiro";
  eventSeverity?: UltimoSuspiroNotification["severity"];
}

interface RollNotificationToastProps {
  roll: RollToastData | null;
  onDismiss: () => void;
  isRlMode?: boolean;
  durationSec?: number;
}

const TOAST_TRANSITION = {
  duration: 0.16,
  ease: CLINICAL_EASE,
} as const;

const TOAST_EXIT_TRANSITION = {
  duration: 0.11,
  ease: "easeOut",
} as const;

export const RollNotificationToast: React.FC<RollNotificationToastProps> = React.memo(
  function RollNotificationToast({
    roll,
    onDismiss,
    isRlMode = false,
    durationSec = 4,
  }) {
    const duration = computeNotificationDurationMs(
      durationSec,
      roll?.kind === "ultimo_suspiro" ? "ultimo_suspiro" : "roll",
    );

    useEffect(() => {
      if (!roll) return;
      const timer = window.setTimeout(() => {
        onDismiss();
      }, duration);
      return () => window.clearTimeout(timer);
    }, [roll, duration, onDismiss]);

    const isUltimoSuspiro = roll?.kind === "ultimo_suspiro";
    const severity = roll?.eventSeverity;
    const isCrit =
      roll?.critical === "crit" ||
      severity === "critical" ||
      severity === "resurrection";
    const isDead = severity === "dead";
    const isFumble =
      roll?.critical === "fumble" ||
      severity === "danger" ||
      severity === "warning";

    const borderClass = isDead
      ? "border-[#52525b]"
      : isCrit
        ? "border-emerald-500/70"
        : isFumble
          ? "border-red-600/80"
          : isRlMode
            ? "border-purple-500/50"
            : "border-[var(--op-red)]/60";

    const topLineClass = isDead
      ? "bg-[#71717a]"
      : isCrit
        ? "bg-emerald-400"
        : isFumble
          ? "bg-red-500"
          : isRlMode
            ? "bg-purple-500"
            : "bg-[var(--op-red-bright)]";

    const iconBoxClass = isDead
      ? "bg-[#18181d] border-[#52525b]/70 text-[#a1a1aa]"
      : isCrit
        ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
        : isFumble
          ? "bg-red-950/70 border-red-500/50 text-red-400"
          : isRlMode
            ? "bg-purple-950/50 border-purple-500/40 text-purple-300"
            : "bg-[#1d090b] border-[var(--op-red)]/40 text-[var(--op-red-bright)]";

    return (
      <AnimatePresence mode="popLayout" initial={false}>
        {roll && (
          <motion.div
            key={roll.id}
            role="status"
            aria-live="polite"
            data-testid={
              isUltimoSuspiro ? "ultimo-suspiro-toast" : "roll-notification-toast"
            }
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
              transition: TOAST_TRANSITION,
            }}
            exit={{
              opacity: 0,
              x: 14,
              scale: 0.985,
              transition: TOAST_EXIT_TRANSITION,
            }}
            style={{
              top: "max(0.85rem, env(safe-area-inset-top, 0.85rem))",
              willChange: "transform, opacity",
              contain: "layout style paint",
            }}
            className="fixed right-3 sm:right-5 z-[380] w-[calc(100vw-4.5rem)] sm:w-[calc(100vw-1.5rem)] max-w-xs pointer-events-auto font-mono"
          >
            <div
              className={`relative bg-[#0c0c12] border shadow-[0_12px_28px_rgba(0,0,0,0.82)] p-3 pr-10 flex items-center gap-3 overflow-hidden ${borderClass}`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] origin-left toast-progress-bar ${topLineClass}`}
                style={{ animationDuration: `${duration}ms` }}
              />

              <div
                className={`w-10 h-10 flex items-center justify-center border shrink-0 ${iconBoxClass}`}
              >
                {isUltimoSuspiro ? (
                  severity === "resurrection" ? (
                    <HeartPulse size={18} />
                  ) : (
                    <Skull size={18} />
                  )
                ) : (
                  <Dices size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
                    {roll.formula}
                  </span>
                  {!isUltimoSuspiro && isCrit && (
                    <span className="text-[9px] uppercase font-bold text-emerald-400 shrink-0">
                      CRÍTICO
                    </span>
                  )}
                  {!isUltimoSuspiro && isFumble && (
                    <span className="text-[9px] uppercase font-bold text-red-400 shrink-0">
                      DESASTRE
                    </span>
                  )}
                </div>
                <div
                  className={`text-[10px] text-[#b4b5c2] mt-0.5 ${
                    isUltimoSuspiro ? "leading-snug line-clamp-2" : "truncate"
                  }`}
                >
                  {roll.details}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className={`${
                    isUltimoSuspiro ? "text-sm tracking-wider" : "text-2xl"
                  } font-black tabular-nums leading-none ${
                    isDead
                      ? "text-[#a1a1aa]"
                      : isCrit
                        ? "text-emerald-300"
                        : isFumble
                          ? "text-red-400"
                          : "text-white"
                  }`}
                >
                  {roll.result}
                </div>
              </div>

              <button
                type="button"
                onClick={onDismiss}
                aria-label="Fechar notificação"
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-[#787989] hover:text-white hover:bg-white/5 cursor-pointer transition-colors touch-manipulation"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
