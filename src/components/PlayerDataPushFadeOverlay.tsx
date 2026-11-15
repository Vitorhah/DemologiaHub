import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { DataPushFadePhase } from "../services/useMasterDataPushSync";
import { CLINICAL_EASE } from "./MotionPrimitives";

interface PlayerDataPushFadeOverlayProps {
  phase: DataPushFadePhase;
}

export const PlayerDataPushFadeOverlay: React.FC<
  PlayerDataPushFadeOverlayProps
> = ({ phase }) => {
  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="player-data-push-fade"
          data-testid="player-data-push-fade"
          data-phase={phase}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "in" ? 0.94 : 0 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: phase === "in" ? 0.5 : 0.7,
            ease: CLINICAL_EASE,
          }}
          className="fixed inset-0 z-[480] bg-black pointer-events-none"
          style={{ willChange: "opacity" }}
        />
      )}
    </AnimatePresence>
  );
};
