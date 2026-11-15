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
      transition={{ duration: 0.15, ease: CLINICAL_EASE }}
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
    initial={{ opacity: 0, y: 12, scale: 0.98 }}
    animate={{
      opacity: 1,
      y: 0,
      scale: 1,
      transition: SNAPPY_SPRING,
    }}
    exit={{
      opacity: 0,
      y: 8,
      scale: 0.985,
      transition: { duration: 0.13, ease: CLINICAL_EASE },
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
        initial={{ height: 0, opacity: 0, y: -3 }}
        animate={{ height: "auto", opacity: 1, y: 0 }}
        exit={{ height: 0, opacity: 0, y: -3 }}
        transition={{
          height: { duration: 0.2, ease: CLINICAL_EASE },
          opacity: { duration: 0.15, ease: "easeOut" },
          y: { duration: 0.18, ease: CLINICAL_EASE },
        }}
        style={{ overflow: "hidden", willChange: "height, opacity, transform" }}
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
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.18, ease: CLINICAL_EASE },
      }}
      exit={{
        opacity: 0,
        y: -3,
        transition: { duration: 0.08, ease: "easeIn" },
      }}
      style={{ willChange: "opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);
