import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { MINIGAME_META, MinigameToastNotification } from "../../types/minigames";
import { SNAPPY_SPRING } from "../MotionPrimitives";

interface MasterMinigameNotificationToastProps {
  notification: MinigameToastNotification | null;
  onDismiss: () => void;
}

export const MasterMinigameNotificationToast: React.FC<
  MasterMinigameNotificationToastProps
> = ({ notification, onDismiss }) => {
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  const res = notification?.result;
  const meta = res ? MINIGAME_META[res.minigameType] : null;

  return (
    <AnimatePresence mode="wait">
      {notification && res && (
        <motion.div
          key={notification.id}
          role="status"
          aria-live="polite"
          data-testid="master-minigame-toast"
          initial={{ opacity: 0, x: 24, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, y: -6, scale: 0.96 }}
          transition={SNAPPY_SPRING}
          style={{
            top: "max(0.85rem, env(safe-area-inset-top, 0.85rem))",
            willChange: "transform, opacity",
          }}
          className="fixed right-3 sm:right-5 z-[185] w-[calc(100vw-1.5rem)] max-w-xs pointer-events-auto font-mono"
        >
          <div
            className={`relative bg-[#0b0b0e]/95 backdrop-blur-md border p-3.5 pr-10 shadow-[0_16px_40px_rgba(0,0,0,0.9)] flex items-center gap-3 ${
              res.success ? "border-[#22c55e]/60" : "border-[#dc2626]/65"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] ${
                res.success ? "bg-[#22c55e]" : "bg-[#dc2626]"
              }`}
            />

            {/* Geometric status mark */}
            <div
              className={`w-10 h-10 border flex items-center justify-center shrink-0 ${
                res.success
                  ? "bg-[#0a140d] border-[#22c55e]/60"
                  : "bg-[#160a0a] border-[#dc2626]/60"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" strokeWidth="2.2">
                {res.success ? (
                  <polyline points="5,13 10,18 19,7" stroke="#22c55e" />
                ) : (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="#ef4444" />
                    <line x1="18" y1="6" x2="6" y2="18" stroke="#ef4444" />
                  </>
                )}
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-[#a1a1aa]">
                Minigame • {meta?.label || res.minigameType}
              </div>
              <div className="text-xs font-bold text-white truncate mt-0.5">
                {res.playerName}
              </div>
              <div
                className={`text-[11px] font-bold mt-0.5 tabular-nums ${
                  res.success ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {res.hits}/{res.totalRounds} acertos
              </div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar notificação de minigame"
              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center text-[#71717a] hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
