import React, { useEffect, useRef, useState, useCallback } from "react";
import { MinigameConfig } from "../../types/minigames";
import {
  getTimingZoneSpanDeg,
  isAngleInTargetArc,
  normalizeAngle,
  pickNextTimingArcStart,
} from "../../utils/minigamesLogic";

interface TimingMinigameProps {
  config: MinigameConfig;
  hits: number;
  errors: number;
  finished: boolean;
  onHit: (nextHits: number) => void;
  onMiss: (nextErrors: number) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, spanDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, startDeg + spanDeg);
  const largeArc = spanDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const TimingMinigame: React.FC<TimingMinigameProps> = ({
  config,
  hits,
  errors,
  finished,
  onHit,
  onMiss,
}) => {
  const initialSpan = getTimingZoneSpanDeg(config.speed, 0, config.rounds);
  const [arcStart, setArcStart] = useState<number>(() => Math.floor(Math.random() * 300));
  const [arcSpan, setArcSpan] = useState<number>(initialSpan);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  const pointerAngleRef = useRef<number>(0);
  const directionRef = useRef<1 | -1>(1);
  const needleGroupRef = useRef<SVGGElement | null>(null);
  const stateRef = useRef({ arcStart, arcSpan, hits, errors, finished });
  stateRef.current = { arcStart, arcSpan, hits, errors, finished };

  // 60 FPS needle rotation decoupled from React state
  useEffect(() => {
    if (finished) return;
    let rafId = 0;
    let lastTime = performance.now();

    const degPerSec = 115 + config.speed * 26; // speed 1 => 141 deg/s, speed 10 => 375 deg/s

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const speedBoost = 1 + stateRef.current.hits * 0.04;
      pointerAngleRef.current = normalizeAngle(
        pointerAngleRef.current + directionRef.current * degPerSec * speedBoost * dt
      );

      if (needleGroupRef.current) {
        needleGroupRef.current.setAttribute(
          "transform",
          `rotate(${pointerAngleRef.current.toFixed(2)} 120 120)`
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [config.speed, finished]);

  const triggerAction = useCallback(() => {
    const cur = stateRef.current;
    if (cur.finished) return;

    const hit = isAngleInTargetArc(pointerAngleRef.current, cur.arcStart, cur.arcSpan);
    if (hit) {
      const nextHits = cur.hits + 1;
      setFlash("hit");
      directionRef.current = directionRef.current === 1 ? -1 : 1;
      const nextSpan = getTimingZoneSpanDeg(config.speed, nextHits, config.rounds);
      const nextStart = pickNextTimingArcStart(cur.arcStart, cur.arcSpan, nextSpan);
      setArcSpan(nextSpan);
      setArcStart(nextStart);
      onHit(nextHits);
    } else {
      const nextErrors = cur.errors + 1;
      setFlash("miss");
      onMiss(nextErrors);
    }
  }, [config.rounds, config.speed, onHit, onMiss]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 220);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (finished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) triggerAction();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [finished, triggerAction]);

  const ticks = Array.from({ length: 12 }, (_, idx) => idx * 30);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          triggerAction();
        }}
        role="button"
        tabIndex={0}
        aria-label="Área do círculo de timing — toque quando o ponteiro estiver na zona verde"
        className={`relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center border cursor-pointer touch-manipulation transition-colors duration-150 ${
          flash === "hit"
            ? "border-[#22c55e] bg-[#0a140d]"
            : flash === "miss"
              ? "border-[#ef4444] bg-[#160a0a]"
              : "border-[#2a2a32] bg-[#0b0b0e]"
        }`}
      >
        <svg viewBox="0 0 240 240" className="w-full h-full">
          {/* Outer guide ring */}
          <circle
            cx="120"
            cy="120"
            r="92"
            fill="none"
            stroke="#27272f"
            strokeWidth="12"
          />

          {/* Inner concentric rings */}
          <circle
            cx="120"
            cy="120"
            r="62"
            fill="none"
            stroke="#1f1f26"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <circle
            cx="120"
            cy="120"
            r="34"
            fill="none"
            stroke="#27272f"
            strokeWidth="1"
          />

          {/* Tick marks */}
          {ticks.map((deg) => {
            const p1 = polarToCartesian(120, 120, 74, deg);
            const p2 = polarToCartesian(120, 120, 82, deg);
            return (
              <line
                key={deg}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#3f3f46"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Green target arc */}
          <path
            d={describeArc(120, 120, 92, arcStart, arcSpan)}
            fill="none"
            stroke="#22c55e"
            strokeWidth="13"
            strokeLinecap="butt"
          />

          {/* Subtle green inner arc marker */}
          <path
            d={describeArc(120, 120, 80, arcStart, arcSpan)}
            fill="none"
            stroke="#16a34a"
            strokeOpacity="0.45"
            strokeWidth="2"
          />

          {/* Rotating pointer needle */}
          <g ref={needleGroupRef} transform="rotate(0 120 120)">
            <line
              x1="120"
              y1="120"
              x2="120"
              y2="24"
              stroke={flash === "miss" ? "#ef4444" : "#e4e4e7"}
              strokeWidth="2.5"
            />
            <polygon points="120,18 115,32 125,32" fill="#dc2626" />
          </g>

          {/* Center hub */}
          <rect
            x="114"
            y="114"
            width="12"
            height="12"
            fill={flash === "hit" ? "#22c55e" : flash === "miss" ? "#ef4444" : "#18181b"}
            stroke="#71717a"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <button
        type="button"
        disabled={finished}
        onPointerDown={(e) => {
          e.preventDefault();
          triggerAction();
        }}
        className="w-full max-w-xs min-h-[48px] bg-[#18181d] hover:bg-[#222229] active:scale-[0.98] disabled:opacity-50 border border-[#3f3f46] hover:border-[#22c55e] text-white font-mono text-xs font-bold uppercase tracking-[0.2em] cursor-pointer touch-manipulation transition-colors"
      >
        Interceptar Pulso [Espaço]
      </button>
    </div>
  );
};
