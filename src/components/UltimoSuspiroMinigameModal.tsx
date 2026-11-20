import React, { useCallback, useEffect, useRef, useState } from "react";
import { Skull, AlertTriangle, ShieldCheck, X } from "lucide-react";
import {
  CoinSide,
  TIMING_RING_CONFIG,
  ULTIMO_SUSPIRO_MAX_FAILURES,
  UltimoSuspiroCoinFlipSummary,
  UltimoSuspiroRollSummary,
  UltimoSuspiroState,
  evaluateTimingOverlap,
  rollSecureCoinSide,
  rollVitalitySurvivalTest,
} from "../utils/ultimoSuspiro";
import { DemologiaCoin } from "./DemologiaCoin";

export interface UltimoSuspiroMinigameModalProps {
  isOpen: boolean;
  characterName: string;
  vit: number;
  maxHp: number;
  ultimoSuspiro: UltimoSuspiroState;
  onAttemptStart: () => void;
  onResolve: (payload: {
    testResult: UltimoSuspiroRollSummary;
    turnToken: string;
  }) => {
    appliedHp: number;
    nextFailures: number;
    isDead: boolean;
    coinFlipAvailable?: boolean;
    ignored: boolean;
  };
  onResolveCoinFlip?: (payload: {
    choice: CoinSide;
    landed: CoinSide;
  }) => {
    coinFlip?: UltimoSuspiroCoinFlipSummary;
    won: boolean;
    nextFailures: number;
    isDead: boolean;
    ignored: boolean;
  };
  onClose: () => void;
}

type ModalPhase =
  | "ready"
  | "running"
  | "resolved"
  | "coin_ready"
  | "coin_flipping"
  | "coin_resolved";

interface ResolvedSummary {
  roll: UltimoSuspiroRollSummary;
  appliedHp: number;
  nextFailures: number;
  isDead: boolean;
  coinFlipAvailable: boolean;
}

interface CoinResolvedSummary {
  choice: CoinSide;
  landed: CoinSide;
  won: boolean;
  nextFailures: number;
  isDead: boolean;
}

const COIN_FLIP_DURATION_MS = 1650;

export const UltimoSuspiroMinigameModal: React.FC<UltimoSuspiroMinigameModalProps> = ({
  isOpen,
  characterName,
  vit,
  maxHp,
  ultimoSuspiro,
  onAttemptStart,
  onResolve,
  onResolveCoinFlip,
  onClose,
}) => {
  const [phase, setPhase] = useState<ModalPhase>("ready");
  const [resolved, setResolved] = useState<ResolvedSummary | null>(null);
  const [capturedRadius, setCapturedRadius] = useState<number>(TIMING_RING_CONFIG.startRadius);

  // Coin flip state
  const [coinChoice, setCoinChoice] = useState<CoinSide>("cara");
  const [coinFace, setCoinFace] = useState<CoinSide>("cara");
  const [coinSpinCount, setCoinSpinCount] = useState<number>(0);
  const [coinResolved, setCoinResolved] = useState<CoinResolvedSummary | null>(null);

  const shrinkingCircleRef = useRef<SVGCircleElement | null>(null);
  const radiusRef = useRef<number>(TIMING_RING_CONFIG.startRadius);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const attemptLockedRef = useRef<boolean>(false);
  const coinLockedRef = useRef<boolean>(false);
  const coinTimerRef = useRef<number | null>(null);
  const turnTokenRef = useRef<string>("");

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (coinTimerRef.current !== null) {
      window.clearTimeout(coinTimerRef.current);
      coinTimerRef.current = null;
    }
  }, []);

  // Reset modal internal state cleanly when opened or closed
  useEffect(() => {
    if (!isOpen) {
      stopAnimation();
      setPhase("ready");
      setResolved(null);
      setCoinResolved(null);
      setCoinChoice("cara");
      setCoinFace("cara");
      setCoinSpinCount(0);
      attemptLockedRef.current = false;
      coinLockedRef.current = false;
      radiusRef.current = TIMING_RING_CONFIG.startRadius;
      setCapturedRadius(TIMING_RING_CONFIG.startRadius);
      turnTokenRef.current = "";
    } else if (ultimoSuspiro.coinFlipPending && !ultimoSuspiro.coinFlipUsed) {
      setPhase("coin_ready");
      setCoinChoice("cara");
      setCoinFace("cara");
      setCoinSpinCount(0);
      setCoinResolved(null);
      coinLockedRef.current = false;
    }
    return () => stopAnimation();
  }, [isOpen, stopAnimation]);

  const finalizeAttempt = useCallback(
    (finalRadius: number) => {
      if (attemptLockedRef.current) return;
      attemptLockedRef.current = true;
      stopAnimation();

      radiusRef.current = finalRadius;
      setCapturedRadius(finalRadius);
      if (shrinkingCircleRef.current) {
        shrinkingCircleRef.current.setAttribute("r", String(finalRadius));
      }

      const { hit, centerHit } = evaluateTimingOverlap(
        finalRadius,
        TIMING_RING_CONFIG.targetRadius,
        TIMING_RING_CONFIG.tolerance,
        TIMING_RING_CONFIG.centerTolerance,
      );

      const testResult = rollVitalitySurvivalTest({
        vit,
        timingHit: hit,
        centerHit,
      });

      const outcome = onResolve({
        testResult,
        turnToken: turnTokenRef.current,
      });

      setResolved({
        roll: testResult,
        appliedHp: outcome.appliedHp,
        nextFailures: outcome.nextFailures,
        isDead: outcome.isDead,
        coinFlipAvailable: Boolean(outcome.coinFlipAvailable),
      });
      setPhase("resolved");
    },
    [onResolve, stopAnimation, vit],
  );

  const startAttempt = useCallback(() => {
    if (phase !== "ready" || ultimoSuspiro.status !== "dying" || ultimoSuspiro.coinFlipPending) {
      return;
    }

    attemptLockedRef.current = false;
    turnTokenRef.current = `us_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    radiusRef.current = TIMING_RING_CONFIG.startRadius;
    setCapturedRadius(TIMING_RING_CONFIG.startRadius);
    setPhase("running");
    onAttemptStart();

    startTimeRef.current = performance.now();

    const step = (now: number) => {
      if (attemptLockedRef.current) return;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, Math.max(0, elapsed / TIMING_RING_CONFIG.durationMs));
      const nextRadius =
        TIMING_RING_CONFIG.startRadius -
        progress * (TIMING_RING_CONFIG.startRadius - TIMING_RING_CONFIG.endRadius);

      radiusRef.current = nextRadius;
      if (shrinkingCircleRef.current) {
        shrinkingCircleRef.current.setAttribute("r", nextRadius.toFixed(2));
      }

      if (progress >= 1) {
        finalizeAttempt(TIMING_RING_CONFIG.endRadius);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [
    finalizeAttempt,
    onAttemptStart,
    phase,
    ultimoSuspiro.coinFlipPending,
    ultimoSuspiro.status,
  ]);

  const enterCoinPhase = useCallback(() => {
    setCoinChoice("cara");
    setCoinFace("cara");
    setCoinSpinCount(0);
    setCoinResolved(null);
    coinLockedRef.current = false;
    setPhase("coin_ready");
  }, []);

  const launchCoinFlip = useCallback(() => {
    if (phase !== "coin_ready" || coinLockedRef.current || !onResolveCoinFlip) return;
    coinLockedRef.current = true;

    const pickedChoice = coinChoice;
    const landed = rollSecureCoinSide();
    setCoinFace(landed);
    setCoinSpinCount((prev) => prev + 1);
    setPhase("coin_flipping");

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const delayMs = prefersReduced ? 580 : COIN_FLIP_DURATION_MS;

    coinTimerRef.current = window.setTimeout(() => {
      coinTimerRef.current = null;
      const outcome = onResolveCoinFlip({ choice: pickedChoice, landed });
      setCoinResolved({
        choice: pickedChoice,
        landed: outcome.coinFlip?.landed ?? landed,
        won: outcome.won,
        nextFailures: outcome.nextFailures,
        isDead: outcome.isDead,
      });
      setPhase("coin_resolved");
    }, delayMs);
  }, [coinChoice, onResolveCoinFlip, phase]);

  // Keyboard support: Space/Enter triggers the single tap while running; Escape closes only when safe
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === "running" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        finalizeAttempt(radiusRef.current);
      } else if (
        phase !== "running" &&
        phase !== "coin_flipping" &&
        e.key === "Escape"
      ) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finalizeAttempt, isOpen, onClose, phase]);

  if (!isOpen) return null;

  const isCoinMode =
    phase === "coin_ready" || phase === "coin_flipping" || phase === "coin_resolved";
  const canClose = phase !== "running" && phase !== "coin_flipping";
  const targetOuter = TIMING_RING_CONFIG.targetRadius + TIMING_RING_CONFIG.tolerance;
  const targetInner = Math.max(4, TIMING_RING_CONFIG.targetRadius - TIMING_RING_CONFIG.tolerance);
  const centerOuter = TIMING_RING_CONFIG.targetRadius + TIMING_RING_CONFIG.centerTolerance;
  const centerInner = Math.max(
    4,
    TIMING_RING_CONFIG.targetRadius - TIMING_RING_CONFIG.centerTolerance,
  );
  const vitSign = vit >= 0 ? `+${vit}` : `${vit}`;
  const isCritical = Boolean(resolved?.roll.isCritical);
  const hitCenter = Boolean(resolved?.roll.centerHit);
  const centerCritPct = Math.round(
    (1 - Math.pow(5 / 6, TIMING_RING_CONFIG.centerBonusRolls)) * 100,
  );

  const topAccentClass = isCoinMode
    ? phase === "coin_resolved"
      ? coinResolved?.won
        ? "bg-emerald-500"
        : "bg-[#71717a]"
      : "bg-[#b52a30]"
    : phase === "resolved"
      ? isCritical
        ? "bg-emerald-500"
        : resolved?.isDead
          ? "bg-[#71717a]"
          : "bg-[#b52a30]"
      : "bg-[#8f171c]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ultimo-suspiro-modal-title"
      data-testid="ultimo-suspiro-modal"
      data-phase={phase}
      className="fixed inset-0 z-[360] flex items-center justify-center bg-black/88 p-3 sm:p-4 font-mono"
      onClick={() => {
        if (canClose) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm bg-[#09090d] border border-[#2c2c38] rounded-none shadow-[0_24px_64px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clinical accent top line */}
        <div className={`h-[2px] w-full ${topAccentClass}`} />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1d1d26] bg-[#0d0d13]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center bg-[#1c080a] border border-[#8f171c]/60 text-[#e0424a] shrink-0">
              <Skull size={16} />
            </div>
            <div className="min-w-0">
              <h2
                id="ultimo-suspiro-modal-title"
                className="text-xs font-bold uppercase tracking-[0.18em] text-white truncate"
              >
                {isCoinMode ? "ÚLTIMA CHANCE" : "ÚLTIMO SUSPIRO"}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8d8e9d] truncate">
                {isCoinMode
                  ? characterName || "Personagem"
                  : `${characterName || "Personagem"} · 2d6 ${vitSign} VIT`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-1 text-[11px] font-bold tabular-nums border border-[#8f171c]/50 bg-[#170709] text-[#ff9399]">
              {isCoinMode
                ? phase === "coin_resolved" && coinResolved
                  ? `${coinResolved.nextFailures}/${ULTIMO_SUSPIRO_MAX_FAILURES}`
                  : "0 TURNOS"
                : `${resolved ? resolved.nextFailures : ultimoSuspiro.failures}/${ULTIMO_SUSPIRO_MAX_FAILURES}`}
            </span>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar teste de Último Suspiro"
                className="w-8 h-8 flex items-center justify-center text-[#8a8b9a] hover:text-white border border-transparent hover:border-[#2a2a36] cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            ÚLTIMA CHANCE — CARA OU COROA (MINIMALISTA E DRAMÁTICO)
           ============================================================ */}
        {isCoinMode ? (
          <div
            className="px-5 pt-3 pb-5 flex flex-col items-center bg-gradient-to-b from-[#07070b] to-[#0a0a0f]"
            data-testid="ultimo-suspiro-coin-stage"
          >
            <DemologiaCoin
              face={phase === "coin_ready" ? coinChoice : coinFace}
              isFlipping={phase === "coin_flipping"}
              outcome={
                phase === "coin_resolved" && coinResolved
                  ? coinResolved.won
                    ? "won"
                    : "lost"
                  : "idle"
              }
              spinCount={coinSpinCount}
            />

            {phase === "coin_ready" && (
              <div className="w-full mt-2 space-y-3">
                <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[#8d8e9d]">
                  Escolha um lado
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="coin-choice-cara"
                    onClick={() => {
                      setCoinChoice("cara");
                      setCoinFace("cara");
                    }}
                    className={`min-h-[44px] border text-xs font-bold uppercase tracking-[0.2em] rounded-none cursor-pointer transition-colors touch-manipulation ${
                      coinChoice === "cara"
                        ? "bg-[#220a0d] border-[#d93840] text-white"
                        : "bg-[#101016] border-[#262632] text-[#8c8d9c] hover:text-white hover:border-[#3b3b4c]"
                    }`}
                  >
                    CARA
                  </button>
                  <button
                    type="button"
                    data-testid="coin-choice-coroa"
                    onClick={() => {
                      setCoinChoice("coroa");
                      setCoinFace("coroa");
                    }}
                    className={`min-h-[44px] border text-xs font-bold uppercase tracking-[0.2em] rounded-none cursor-pointer transition-colors touch-manipulation ${
                      coinChoice === "coroa"
                        ? "bg-[#1a1c24] border-[#b4b8c8] text-white"
                        : "bg-[#101016] border-[#262632] text-[#8c8d9c] hover:text-white hover:border-[#3b3b4c]"
                    }`}
                  >
                    COROA
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="coin-flip-launch-btn"
                  onClick={launchCoinFlip}
                  className="w-full min-h-[46px] bg-[#8f171c] hover:bg-[#a91d23] active:scale-[0.98] border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-[0.22em] rounded-none cursor-pointer touch-manipulation"
                >
                  LANÇAR MOEDA
                </button>
              </div>
            )}

            {phase === "coin_flipping" && (
              <div className="w-full mt-2 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-[#a5a6b5] animate-pulse">
                  {coinChoice === "cara" ? "CARA..." : "COROA..."}
                </p>
              </div>
            )}

            {phase === "coin_resolved" && coinResolved && (
              <div
                className="w-full mt-1 space-y-4 text-center"
                data-testid="coin-flip-result-panel"
              >
                <div className="py-1">
                  <div
                    className={`text-lg font-black uppercase tracking-[0.24em] ${
                      coinResolved.won ? "text-emerald-300" : "text-[#a1a1aa]"
                    }`}
                  >
                    {coinResolved.won ? "+1 TURNO" : "MORTE DEFINITIVA"}
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8f909f]">
                    {coinResolved.landed === "cara" ? "CARA" : "COROA"} ·{" "}
                    {coinResolved.won ? "SOBREVIVEU" : "3/3"}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="coin-flip-close-btn"
                  onClick={onClose}
                  className={`w-full min-h-[44px] border text-xs font-bold uppercase tracking-[0.2em] rounded-none cursor-pointer touch-manipulation ${
                    coinResolved.won
                      ? "bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/50 text-emerald-200"
                      : "bg-[#14141c] hover:bg-[#1f1f2a] border-[#30303e] text-white"
                  }`}
                >
                  {coinResolved.won ? "CONTINUAR" : "FECHAR"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
             MINIGAME DE TIMING + TESTE DE VITALIDADE (2d6 + VIT)
             ============================================================ */
          <div className="px-4 pt-4 pb-3 flex flex-col items-center">
            <button
              type="button"
              disabled={phase !== "running"}
              onPointerDown={(e) => {
                if (phase === "running") {
                  e.preventDefault();
                  finalizeAttempt(radiusRef.current);
                }
              }}
              onClick={() => {
                if (phase === "running") {
                  finalizeAttempt(radiusRef.current);
                }
              }}
              data-testid="ultimo-suspiro-arena-trigger"
              aria-label={
                phase === "running"
                  ? "Toque ou clique agora para travar o anel no alvo"
                  : "Área do teste de precisão de Último Suspiro"
              }
              className={`relative w-[208px] h-[208px] flex items-center justify-center border rounded-none select-none touch-manipulation transition-colors ${
                phase === "running"
                  ? "bg-[#0d0709] border-[#8f171c]/70 cursor-pointer active:bg-[#19090c]"
                  : phase === "resolved"
                    ? isCritical
                      ? "bg-[#07130d] border-emerald-500/50 cursor-default"
                      : "bg-[#11080a] border-[#641015] cursor-default"
                    : "bg-[#0c0c12] border-[#22222e] cursor-default"
              }`}
            >
              <svg
                viewBox="0 0 200 200"
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                {/* Subtle clinical crosshairs */}
                <line x1="100" y1="8" x2="100" y2="192" stroke="#1e1e28" strokeWidth="1" />
                <line x1="8" y1="100" x2="192" y2="100" stroke="#1e1e28" strokeWidth="1" />

                {/* Target tolerance zone band */}
                <circle
                  cx="100"
                  cy="100"
                  r={TIMING_RING_CONFIG.targetRadius}
                  fill="none"
                  stroke={
                    phase === "resolved"
                      ? isCritical
                        ? "rgba(16, 185, 129, 0.22)"
                        : "rgba(181, 42, 48, 0.2)"
                      : "rgba(143, 23, 28, 0.22)"
                  }
                  strokeWidth={TIMING_RING_CONFIG.tolerance * 2}
                />

                {/* Outer & inner tolerance guide hairlines */}
                <circle
                  cx="100"
                  cy="100"
                  r={targetOuter}
                  fill="none"
                  stroke="rgba(181, 42, 48, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={targetInner}
                  fill="none"
                  stroke="rgba(181, 42, 48, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Center Sweet-Spot Band (Vantagem de Crítico) */}
                <circle
                  cx="100"
                  cy="100"
                  r={TIMING_RING_CONFIG.targetRadius}
                  fill="none"
                  stroke={
                    phase === "resolved"
                      ? isCritical
                        ? "rgba(52, 211, 153, 0.36)"
                        : "rgba(220, 38, 38, 0.28)"
                      : "rgba(239, 68, 68, 0.34)"
                  }
                  strokeWidth={TIMING_RING_CONFIG.centerTolerance * 2}
                />
                <circle
                  cx="100"
                  cy="100"
                  r={centerOuter}
                  fill="none"
                  stroke={
                    phase === "resolved" && isCritical
                      ? "rgba(110, 231, 183, 0.5)"
                      : "rgba(255, 138, 144, 0.42)"
                  }
                  strokeWidth="0.75"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={centerInner}
                  fill="none"
                  stroke={
                    phase === "resolved" && isCritical
                      ? "rgba(110, 231, 183, 0.5)"
                      : "rgba(255, 138, 144, 0.42)"
                  }
                  strokeWidth="0.75"
                />

                {/* Fixed Target Center Line */}
                <circle
                  cx="100"
                  cy="100"
                  r={TIMING_RING_CONFIG.targetRadius}
                  fill="none"
                  stroke={
                    phase === "resolved"
                      ? isCritical
                        ? "#6ee7b7"
                        : "#dc2626"
                      : "#ff6b72"
                  }
                  strokeWidth="1.8"
                />

                {/* Animated Shrinking Circle (mutated directly via rAF ref) */}
                <circle
                  ref={shrinkingCircleRef}
                  cx="100"
                  cy="100"
                  r={phase === "resolved" ? capturedRadius : TIMING_RING_CONFIG.startRadius}
                  fill="none"
                  stroke={
                    phase === "resolved"
                      ? isCritical
                        ? "#a7f3d0"
                        : "#ef4444"
                      : "#f1f5f9"
                  }
                  strokeWidth={phase === "running" ? "2.6" : "2"}
                />

                {/* Center anchor dot */}
                <circle cx="100" cy="100" r="3" fill="#8f171c" />
              </svg>

              <span className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase tracking-[0.16em] text-[#a0a1b0]">
                {phase === "running"
                  ? "MIRAR NO MEIO · TOQUE / ESPAÇO"
                  : phase === "ready"
                    ? "PRECISÃO + 2D6"
                    : isCritical
                      ? hitCenter
                        ? "CENTRO · DADOS IGUAIS"
                        : "DADOS IGUAIS"
                      : "TENTATIVA ENCERRADA"}
              </span>
            </button>

            {/* Phase-specific instructions or synchronized result */}
            {phase === "ready" && (
              <div className="w-full mt-3.5 space-y-3">
                <div className="border border-[#20202b] bg-[#0e0e14] p-2.5 text-[11px] leading-relaxed text-[#b5b6c4] font-sans">
                  <p>
                    Clique ou toque quando o anel branco alinhar com o alvo vermelho.
                    O teste rola <strong className="text-white font-mono">2d6 {vitSign} (VIT)</strong>.
                  </p>
                  <p className="mt-1 text-[#d4a5a8]">
                    Acertar o <strong className="text-[#ff8a90]">meio brilhante</strong> concede{" "}
                    <strong className="text-white">Vantagem de Crítico</strong> (chance sobe de{" "}
                    <span className="font-mono">~17%</span> para{" "}
                    <span className="font-mono text-[#ff9fa5]">~{centerCritPct}%</span> —{" "}
                    {TIMING_RING_CONFIG.centerBonusRolls} chances de dados iguais).
                  </p>
                  <p className="mt-1 text-[#9596a6]">
                    Apenas <strong className="text-[#ff8a90]">dados iguais</strong> ([1,1] a [6,6])
                    escapam da morte e recuperam PV igual à soma dos dados (máx. {maxHp}).
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-3 bg-[#14141c] hover:bg-[#1e1e28] border border-[#2a2a36] text-[#a2a3b2] hover:text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer touch-manipulation"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={startAttempt}
                    data-testid="ultimo-suspiro-start-btn"
                    className="flex-1 min-h-[44px] px-4 bg-[#8f171c] hover:bg-[#a91d23] active:scale-[0.98] border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-[0.14em] rounded-none cursor-pointer touch-manipulation"
                  >
                    Iniciar Teste
                  </button>
                </div>
              </div>
            )}

            {phase === "running" && (
              <div className="w-full mt-3.5">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    finalizeAttempt(radiusRef.current);
                  }}
                  onClick={() => finalizeAttempt(radiusRef.current)}
                  data-testid="ultimo-suspiro-lock-btn"
                  className="w-full min-h-[48px] bg-[#9e1a20] hover:bg-[#b52a30] active:scale-[0.98] border border-[#ff8085]/50 text-white text-xs font-bold uppercase tracking-[0.18em] rounded-none cursor-pointer touch-manipulation"
                >
                  RESISTIR AGORA
                </button>
                <p className="text-[10px] text-center text-[#7d7e8d] uppercase tracking-wider mt-2">
                  Tentativa única · sem pausa ou reinício
                </p>
              </div>
            )}

            {phase === "resolved" && resolved && (
              <div className="w-full mt-3.5 space-y-3" data-testid="ultimo-suspiro-result-panel">
                <div
                  className={`border p-3 ${
                    isCritical
                      ? "bg-emerald-950/35 border-emerald-500/60"
                      : resolved.isDead
                        ? "bg-[#15151a] border-[#52525b]"
                        : "bg-[#1b080a] border-[#8f171c]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isCritical ? (
                      <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                    ) : resolved.isDead ? (
                      <Skull size={16} className="text-[#a1a1aa] shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-[#f87171] shrink-0" />
                    )}
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.14em] ${
                        isCritical
                          ? "text-emerald-300"
                          : resolved.isDead
                            ? "text-[#d4d4d8]"
                            : "text-[#ff8a90]"
                      }`}
                    >
                      {isCritical
                        ? "SUCESSO CRÍTICO — RESISTIU"
                        : resolved.coinFlipAvailable
                          ? "0 TURNOS — ÚLTIMA CHANCE"
                          : resolved.isDead
                            ? "MORTE DEFINITIVA (3/3)"
                            : "FALHA NA SOBREVIVÊNCIA"}
                    </span>
                  </div>

                  {hitCenter && (
                    <div
                      data-testid="ultimo-suspiro-center-badge"
                      className={`mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] border ${
                        isCritical
                          ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                          : "border-[#a91d23]/60 bg-[#240a0d] text-[#ff9fa5]"
                      }`}
                    >
                      <span>
                        ACERTO NO CENTRO · CRÍTICO ~{resolved.roll.critChancePct ?? centerCritPct}%
                      </span>
                    </div>
                  )}

                  {/* Synchronized dice & VIT display */}
                  <div className="flex items-center justify-between bg-[#09090d] border border-[#22222c] px-2.5 py-2 text-xs tabular-nums">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 border border-[#323240] bg-[#14141c] text-white font-bold">
                        {resolved.roll.d1}
                      </span>
                      <span className="px-2 py-0.5 border border-[#323240] bg-[#14141c] text-white font-bold">
                        {resolved.roll.d2}
                      </span>
                      <span className="text-[#8e8f9e] text-[11px]">
                        {vitSign} VIT
                      </span>
                    </div>
                    <div className="font-bold text-white">
                      Total: {resolved.roll.total}
                    </div>
                  </div>

                  <p className="text-[11px] font-sans leading-relaxed mt-2 text-[#c4c5d2]">
                    {isCritical
                      ? hitCenter
                        ? `Acerto no centro (${(resolved.roll.attemptsUsed ?? 1) > 1 ? "vantagem decisiva" : "de primeira"})! Dados iguais [${resolved.roll.d1}, ${resolved.roll.d2}] — ${characterName} escapou do Último Suspiro e recuperou +${resolved.appliedHp} PV automaticamente.`
                        : `Dados iguais [${resolved.roll.d1}, ${resolved.roll.d2}]! ${characterName} escapou do Último Suspiro e recuperou +${resolved.appliedHp} PV automaticamente.`
                      : resolved.coinFlipAvailable
                        ? "Seus turnos acabaram. Jogue a moeda por um turno extra."
                        : !resolved.roll.timingHit
                          ? `O anel não coincidiu com o alvo. Nenhum PV recuperado · Contador: ${resolved.nextFailures}/${ULTIMO_SUSPIRO_MAX_FAILURES}.`
                          : hitCenter
                            ? `Acerto no centro (${TIMING_RING_CONFIG.centerBonusRolls} chances de crítico), mas nenhum par saiu igual [${resolved.roll.d1}, ${resolved.roll.d2}]. Nenhum PV recuperado · Contador: ${resolved.nextFailures}/${ULTIMO_SUSPIRO_MAX_FAILURES}.`
                            : `Alvo acertado fora do centro, mas os dados [${resolved.roll.d1}, ${resolved.roll.d2}] não foram iguais. Nenhum PV recuperado · Contador: ${resolved.nextFailures}/${ULTIMO_SUSPIRO_MAX_FAILURES}.`}
                  </p>
                </div>

                {resolved.coinFlipAvailable && onResolveCoinFlip ? (
                  <button
                    type="button"
                    onClick={enterCoinPhase}
                    data-testid="ultimo-suspiro-enter-coin-btn"
                    className="w-full min-h-[46px] bg-[#8f171c] hover:bg-[#a91d23] active:scale-[0.98] border border-[#ff8085]/45 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-none cursor-pointer touch-manipulation"
                  >
                    ÚLTIMA CHANCE
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    data-testid="ultimo-suspiro-close-btn"
                    className="w-full min-h-[44px] bg-[#14141c] hover:bg-[#1f1f2a] border border-[#30303e] text-white text-xs font-bold uppercase tracking-[0.16em] rounded-none cursor-pointer touch-manipulation"
                  >
                    Fechar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
