import React from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";

export const CLINICAL_EASE = [0.16, 1, 0.3, 1] as const;

export const SNAPPY_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 36,
  mass: 0.85,
};

export const SMOOTH_SPRING: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 30,
  mass: 0.9,
};

export const MotionModalBackdrop: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = "" }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.16, ease: CLINICAL_EASE }}
    onClick={onClick}
    className={`modal-backdrop-surface ${className}`}
  >
    {children}
  </motion.div>
);

export const MotionSheetPanel: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
> = ({ children, className = "", style, onClick, role, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, scale: 0.985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.985 }}
    transition={{ duration: 0.2, ease: CLINICAL_EASE }}
    onClick={onClick}
    role={role}
    aria-modal={rest["aria-modal"]}
    aria-labelledby={rest["aria-labelledby"]}
    aria-label={rest["aria-label"]}
    style={{ willChange: "transform, opacity", ...style }}
    className={className}
  >
    {children}
  </motion.div>
);

export const MotionAccordion: React.FC<{
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ isOpen, children, className = "" }) => (
  <AnimatePresence initial={false}>
    {isOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: CLINICAL_EASE }}
        style={{ overflow: "hidden", willChange: "height, opacity" }}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export const MotionTabSwitch: React.FC<{
  viewKey: string;
  children: React.ReactNode;
  className?: string;
}> = ({ viewKey, children, className = "" }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: CLINICAL_EASE }}
      style={{ willChange: "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
