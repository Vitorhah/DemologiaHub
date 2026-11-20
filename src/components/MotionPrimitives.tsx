import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Transition } from "motion/react";

export const CLINICAL_EASE = [0.16, 1, 0.3, 1] as const;

export const SNAPPY_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 35,
  mass: 0.8,
};

export const SMOOTH_SPRING: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 30,
  mass: 0.85,
};

const PANEL_ENTER_TRANSITION: Transition = {
  duration: 0.16,
  ease: CLINICAL_EASE,
};

const PANEL_EXIT_TRANSITION: Transition = {
  duration: 0.11,
  ease: "easeOut",
};

const ACCORDION_TRANSITION: Transition = {
  height: { duration: 0.16, ease: CLINICAL_EASE },
  opacity: { duration: 0.12, ease: "easeOut" },
};

export const MotionModalBackdrop: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = "" }) => {
  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: CLINICAL_EASE }}
      style={{ willChange: "opacity" }}
      onClick={onClick}
      className={`modal-backdrop-surface ${className}`}
    >
      {children}
    </motion.div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
};

export const MotionSheetPanel: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
> = ({ children, className = "", style, onClick, role, ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.985 }}
    animate={{
      opacity: 1,
      y: 0,
      scale: 1,
      transition: PANEL_ENTER_TRANSITION,
    }}
    exit={{
      opacity: 0,
      y: 6,
      scale: 0.99,
      transition: PANEL_EXIT_TRANSITION,
    }}
    onClick={onClick}
    role={role}
    aria-modal={rest["aria-modal"]}
    aria-labelledby={rest["aria-labelledby"]}
    aria-label={rest["aria-label"]}
    data-testid={(rest as Record<string, any>)["data-testid"]}
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
        transition={ACCORDION_TRANSITION}
        style={{ overflow: "hidden", contain: "layout style" }}
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
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.15, ease: CLINICAL_EASE },
      }}
      exit={{
        opacity: 0,
        y: -2,
        transition: { duration: 0.08, ease: "easeIn" },
      }}
      style={{ willChange: "opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
