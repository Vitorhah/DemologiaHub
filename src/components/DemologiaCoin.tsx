import React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CoinSide } from "../utils/ultimoSuspiro";
import { DEMOLOGIA_LOGO_URL } from "../constants/branding";

export interface DemologiaCoinProps {
  /** Which face is currently shown (preview choice before flip, or final landed side) */
  face: CoinSide;
  /** Whether the coin is actively mid-air spinning */
  isFlipping: boolean;
  /** Outcome visual accent after landing */
  outcome: "idle" | "won" | "lost";
  /** Monotonic spin counter so every flip performs a full dramatic toss */
  spinCount: number;
}

/**
 * Heavy forged dark-iron Demologia medallion with 3D dual-face flip.
 * CARA = O Olho de Demologia (obsidian + crimson iris).
 * COROA = A Coroa do Abismo (forged gunmetal + pale silver sigil).
 */
export const DemologiaCoin: React.FC<DemologiaCoinProps> = ({
  face,
  isFlipping,
  outcome,
  spinCount,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const baseFaceAngle = face === "cara" ? 0 : 180;
  // Each toss rotates 5 full turns (1800deg) plus the exact face offset so it lands cleanly on the true result
  const targetRotateY =
    spinCount > 0
      ? spinCount * (prefersReducedMotion ? 360 : 1800) + baseFaceAngle
      : baseFaceAngle;

  const glowColor =
    outcome === "won"
      ? "rgba(16, 185, 129, 0.28)"
      : outcome === "lost"
        ? "rgba(113, 113, 122, 0.16)"
        : "rgba(181, 42, 48, 0.30)";

  return (
    <div
      className="relative flex flex-col items-center justify-center py-5 select-none"
      data-testid="demologia-coin"
      data-face={face}
      data-flipping={isFlipping ? "true" : "false"}
      data-outcome={outcome}
    >
      {/* Atmospheric halo behind coin */}
      <motion.div
        aria-hidden="true"
        animate={{
          opacity: isFlipping ? 0.9 : outcome === "lost" ? 0.35 : 0.72,
          scale: isFlipping ? 1.15 : 1,
        }}
        transition={{ duration: 0.45 }}
        className="pointer-events-none absolute w-48 h-48 rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />

      {/* 3D Perspective Stage */}
      <div
        className="relative w-[156px] h-[156px]"
        style={{ perspective: "960px" }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
          initial={false}
          animate={{
            rotateY: targetRotateY,
            rotateX: isFlipping && !prefersReducedMotion ? [0, 14, -10, 0] : 0,
            y: isFlipping && !prefersReducedMotion ? [0, -34, -18, 0] : 0,
            scale: isFlipping && !prefersReducedMotion ? [1, 1.14, 1.06, 1] : 1,
          }}
          transition={
            isFlipping
              ? {
                  rotateY: {
                    duration: prefersReducedMotion ? 0.55 : 1.65,
                    ease: [0.18, 0.88, 0.24, 1],
                  },
                  rotateX: {
                    duration: prefersReducedMotion ? 0.55 : 1.65,
                    ease: "easeInOut",
                  },
                  y: {
                    duration: prefersReducedMotion ? 0.55 : 1.65,
                    times: [0, 0.42, 0.78, 1],
                    ease: [0.22, 1, 0.36, 1],
                  },
                  scale: {
                    duration: prefersReducedMotion ? 0.55 : 1.65,
                    times: [0, 0.45, 0.8, 1],
                    ease: "easeOut",
                  },
                }
              : {
                  rotateY: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.25 },
                  scale: { duration: 0.25 },
                }
          }
        >
          {/* Metallic rim thickness disc */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[#3a3a46]"
            style={{
              transform: "translateZ(-2px)",
              background: "linear-gradient(135deg, #272731 0%, #0d0d12 50%, #3d171c 100%)",
            }}
          />

          {/* FRONT FACE — CARA (O Olho de Demologia) */}
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(2px)",
              boxShadow:
                outcome === "won" && face === "cara"
                  ? "0 0 28px rgba(16, 185, 129, 0.35), inset 0 1px 2px rgba(255,255,255,0.16)"
                  : "0 14px 32px rgba(0, 0, 0, 0.85), inset 0 1px 2px rgba(255,255,255,0.14)",
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
              <defs>
                <radialGradient id="coin-cara-metal" cx="34%" cy="28%" r="74%">
                  <stop offset="0%" stopColor="#26191d" />
                  <stop offset="48%" stopColor="#130d10" />
                  <stop offset="86%" stopColor="#09070a" />
                  <stop offset="100%" stopColor="#1c1215" />
                </radialGradient>
                <linearGradient id="coin-cara-rim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9c4249" />
                  <stop offset="45%" stopColor="#352529" />
                  <stop offset="78%" stopColor="#c45c63" />
                  <stop offset="100%" stopColor="#211417" />
                </linearGradient>
              </defs>

              {/* Forged obsidian disc */}
              <circle cx="100" cy="100" r="98" fill="url(#coin-cara-metal)" />

              {/* Outer machined rim */}
              <circle
                cx="100"
                cy="100"
                r="95"
                fill="none"
                stroke="url(#coin-cara-rim)"
                strokeWidth="4"
              />
              {/* Knurled precision notches */}
              <circle
                cx="100"
                cy="100"
                r="87"
                fill="none"
                stroke="rgba(196, 118, 124, 0.30)"
                strokeWidth="2.5"
                strokeDasharray="2 7.12"
              />
              {/* Inner hairline */}
              <circle
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke="rgba(181, 78, 86, 0.42)"
                strokeWidth="1"
              />

              {/* Subtle dashed inner orbit matching COROA */}
              <circle
                cx="100"
                cy="100"
                r="66"
                fill="none"
                stroke="rgba(210, 175, 178, 0.14)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />

              {/* Engraved face name */}
              <text
                x="100"
                y="175"
                textAnchor="middle"
                fill="#d2c3c6"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="700"
                letterSpacing="4"
              >
                CARA
              </text>
            </svg>

            {/* Official Demologia logo color-graded & stamped into the coin's metallic texture */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-3">
              <img
                src={DEMOLOGIA_LOGO_URL}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                decoding="async"
                className="w-[88px] h-[88px] object-contain opacity-[0.88]"
                style={{
                  filter:
                    "saturate(0.36) contrast(1.24) brightness(1.14) sepia(0.16) hue-rotate(-14deg) drop-shadow(0 1px 0 rgba(255, 224, 228, 0.16)) drop-shadow(0 -1px 2px rgba(0, 0, 0, 0.92))",
                }}
              />
            </div>

            {/* Unified brushed metallic sheen across both coin disc and logo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 38%, rgba(0,0,0,0.08) 65%, rgba(0,0,0,0.34) 100%)",
              }}
            />
          </div>

          {/* BACK FACE — COROA (A Coroa do Abismo) */}
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
              boxShadow:
                outcome === "won" && face === "coroa"
                  ? "0 0 28px rgba(16, 185, 129, 0.35), inset 0 1px 2px rgba(255,255,255,0.16)"
                  : "0 14px 32px rgba(0, 0, 0, 0.85), inset 0 1px 2px rgba(255,255,255,0.14)",
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
              <defs>
                <radialGradient id="coin-coroa-metal" cx="34%" cy="28%" r="74%">
                  <stop offset="0%" stopColor="#2b2d38" />
                  <stop offset="48%" stopColor="#14151c" />
                  <stop offset="86%" stopColor="#090a0e" />
                  <stop offset="100%" stopColor="#1e2028" />
                </radialGradient>
                <linearGradient id="coin-coroa-rim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a1a5b5" />
                  <stop offset="45%" stopColor="#353844" />
                  <stop offset="78%" stopColor="#d4d6e2" />
                  <stop offset="100%" stopColor="#1f212a" />
                </linearGradient>
              </defs>

              {/* Forged gunmetal disc */}
              <circle cx="100" cy="100" r="98" fill="url(#coin-coroa-metal)" />

              {/* Outer machined steel rim */}
              <circle
                cx="100"
                cy="100"
                r="95"
                fill="none"
                stroke="url(#coin-coroa-rim)"
                strokeWidth="4"
              />
              {/* Knurled precision notches */}
              <circle
                cx="100"
                cy="100"
                r="87"
                fill="none"
                stroke="rgba(180, 184, 200, 0.32)"
                strokeWidth="2.5"
                strokeDasharray="2 7.12"
              />
              {/* Inner hairline */}
              <circle
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke="rgba(161, 165, 181, 0.45)"
                strokeWidth="1"
              />

              {/* Subtle inverted ritual arc */}
              <circle
                cx="100"
                cy="100"
                r="52"
                fill="none"
                stroke="rgba(161, 165, 181, 0.14)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Sharp Gothic-Industrial Demologia Crown Sigil */}
              <path
                d="M54 126 L48 76 L78 96 L100 58 L122 96 L152 76 L146 126 Z"
                fill="#0d0e13"
                stroke="#e5e7ef"
                strokeWidth="2.2"
                strokeLinejoin="miter"
              />
              {/* Crown base band */}
              <rect
                x="54"
                y="126"
                width="92"
                height="10"
                fill="#181a22"
                stroke="#c7cad6"
                strokeWidth="1.6"
              />
              {/* Crimson keystone jewel inside crown */}
              <polygon
                points="100,88 108,104 100,118 92,104"
                fill="#b52a30"
                stroke="#ff8a90"
                strokeWidth="1"
              />
              {/* Spire dots */}
              <circle cx="100" cy="52" r="2.4" fill="#d93840" />
              <circle cx="46" cy="70" r="2" fill="#b4b8c8" />
              <circle cx="154" cy="70" r="2" fill="#b4b8c8" />

              {/* Engraved face name */}
              <text
                x="100"
                y="175"
                textAnchor="middle"
                fill="#c7cad6"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="700"
                letterSpacing="4"
              >
                COROA
              </text>
            </svg>
          </div>
        </motion.div>
      </div>

      {/* Reactive ground shadow */}
      <motion.div
        aria-hidden="true"
        animate={{
          scaleX: isFlipping && !prefersReducedMotion ? [1, 0.62, 0.78, 1] : 1,
          opacity: isFlipping && !prefersReducedMotion ? [0.65, 0.25, 0.4, 0.65] : 0.65,
        }}
        transition={
          isFlipping
            ? { duration: prefersReducedMotion ? 0.55 : 1.65, times: [0, 0.42, 0.78, 1] }
            : { duration: 0.25 }
        }
        className="mt-4 w-28 h-2.5 rounded-full bg-black/80 blur-[3px]"
      />
    </div>
  );
};
