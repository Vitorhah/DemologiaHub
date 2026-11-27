import React, { useEffect } from "react";
import { FolderOpen, ShieldAlert, X, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { HandoutItem, HandoutToastNotification } from "../types/handouts";
import { SNAPPY_SPRING } from "./MotionPrimitives";
import { computeNotificationDurationMs } from "../utils/playerSettings";
import { getHandoutAccessionCode } from "../utils/handoutRichText";
import { CreatureRichInlineText } from "./CreatureRichText";

interface HandoutNotificationToastProps {
  notification: HandoutToastNotification | null;
  onOpenHandout: (handout: HandoutItem) => void;
  onDismiss: () => void;
  durationSec?: number;
}

export const HandoutNotificationToast: React.FC<
  HandoutNotificationToastProps
> = ({ notification, onOpenHandout, onDismiss, durationSec = 4 }) => {
  const durationMs = computeNotificationDurationMs(durationSec, "handout");

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [notification, durationMs, onDismiss]);

  const isSecret = notification?.reason === "secret_revealed";
  const accessionCode = notification
    ? getHandoutAccessionCode(notification.handout)
    : "";

  return (
    <AnimatePresence mode="wait">
      {notification && (
        <motion.div
          key={`${notification.handout.id}-${notification.reason}`}
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
          className="fixed right-3 sm:right-5 z-[180] w-[calc(100vw-1.5rem)] max-w-sm pointer-events-auto font-mono"
        >
          <div className="relative bg-[#0b0b10]/96 backdrop-blur-md border border-[#2c2c38] border-t-2 border-t-[var(--op-red-bright)] shadow-[0_16px_40px_rgba(0,0,0,0.92)] p-3.5">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 flex items-center justify-center border shrink-0 ${
                  isSecret
                    ? "bg-amber-950/50 border-amber-500/50 text-amber-300"
                    : "bg-[#220a0e] border-[var(--op-red)]/50 text-[var(--op-red-bright)]"
                }`}
              >
                {isSecret ? (
                  <ShieldAlert size={16} />
                ) : (
                  <FolderOpen size={16} />
                )}
              </div>

              <div className="min-w-0 flex-1 pr-6">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#ff8085] truncate">
                  <span>{accessionCode}</span>
                  <span className="mx-1.5 text-[#5a5c6c]" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    {isSecret ? "Segredo Revelado" : "Novo Handout Recebido"}
                  </span>
                </div>
                <div className="text-xs font-bold text-white line-clamp-2 mt-0.5 leading-snug">
                  <CreatureRichInlineText
                    text={notification.handout.title}
                    tone="dark"
                    interactiveAffiliations={false}
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenHandout(notification.handout);
                      onDismiss();
                    }}
                    className="min-h-[36px] px-3 py-1 bg-[#8f171c] hover:bg-[#b81d24] active:scale-95 text-white text-[11px] font-bold uppercase tracking-wider border border-[#ff8085]/35 flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <span>Inspecionar</span>
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="min-h-[36px] px-2.5 py-1 bg-[#14141c] hover:bg-[#1e1e28] active:scale-95 text-[#9ca3af] hover:text-white text-[10px] uppercase tracking-wider border border-[#242430] cursor-pointer transition-all"
                  >
                    Depois
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onDismiss}
                aria-label="Fechar notificação de handout"
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-[#787989] hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
