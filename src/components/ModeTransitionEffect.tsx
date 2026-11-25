import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { DataPushFadePhase } from "../services/useMasterDataPushSync";
import { CLINICAL_EASE } from "./MotionPrimitives";
import {
  MODE_FADE_IN_DURATION_SEC,
  MODE_FADE_OUT_DURATION_SEC,
  MODE_FADE_PEAK_OPACITY,
} from "../utils/modeTransition";

interface ModeTransitionEffectProps {
  phase: DataPushFadePhase;
}

/**
 * Sobreposição de transição de modo usando exatamente a mesma animação
 * de Fade preto do envio de dados (PlayerDataPushFadeOverlay), sem tela de cores.
 */
export const ModeTransitionEffect: React.FC<ModeTransitionEffectProps> = ({
  phase,
}) => {
  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          key="mode-transition-fade"
          data-testid="mode-transition-fade"
          data-phase={phase}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "in" ? MODE_FADE_PEAK_OPACITY : 0 }}
          exit={{ opacity: 0 }}
          transition={{
            duration:
              phase === "in"
                ? MODE_FADE_IN_DURATION_SEC
                : MODE_FADE_OUT_DURATION_SEC,
            ease: CLINICAL_EASE,
          }}
          className="fixed inset-0 z-[9999] bg-black pointer-events-none"
          style={{ willChange: "opacity" }}
        />
      )}
    </AnimatePresence>
  );
};
