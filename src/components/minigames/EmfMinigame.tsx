import React, { useEffect, useRef, useState } from "react";
import { MinigameConfig } from "../../types/minigames";
import {
  getEmfBandHalfWidth,
  stepEmfSimulation,
} from "../../utils/minigamesLogic";

interface EmfMinigameProps {
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

// Maps 0..100 scale to semi-circular arc [-80..+80] degrees
function valueToDeg(val: number): number {
  return -80 + (val / 100) * 160;
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const span = endDeg - startDeg;
  const largeArc = Math.abs(span) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function pickBandCenter(): number {
  return Math.round(28 + Math.random() * 44); // [28..72]
}

export const EmfMinigame: React.FC<EmfMinigameProps> = ({
  config,
  hits,
  errors,
  finished,
  onHit,
  onMiss,
}) => {
  const bandHalfWidth = getEmfBandHalfWidth(config.speed);
  const [bandCenter, setBandCenter] = useState<number>(() => pickBandCenter());
  const [holding, setHolding] = useState(false);
  const [inZoneUi, setInZoneUi] = useState(false);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  const simRef = useRef({
    needle: 50,
    velocity: 0,
    progress: 0,
    overload: 0,
    elapsed: 0,
    holding: false,
    engaged: false,
    bandCenter,
    hits,
    errors,
    finished,
    inZone: false,
  });
  simRef.current.bandCenter = bandCenter;
  simRef.current.hits = hits;
  simRef.current.errors = errors;
  simRef.current.finished = finished;

  const needleRef = useRef<SVGGElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const overloadBarRef = useRef<HTMLDivElement | null>(null);

  const setHoldState = (next: boolean) => {
    if (next) simRef.current.engaged = true;
    simRef.current.holding = next;
    setHolding(next);
  };

  useEffect(() => {
    if (finished) return;
    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const cur = simRef.current;
      cur.elapsed += dt;

      // Brief startup stabilization window until player interacts or 1.8s passes
      if (!cur.engaged && cur.elapsed < 1.8) {
        if (needleRef.current) {
          const deg = valueToDeg(cur.needle);
          needleRef.current.setAttribute("transform", `rotate(${deg.toFixed(2)} 140 142)`);
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      const out = stepEmfSimulation({
        needle: cur.needle,
        velocity: cur.velocity,
        holding: cur.holding,
        dt,
        speed: config.speed,
        bandCenter: cur.bandCenter,
        bandHalfWidth,
        progress: cur.progress,
        overload: cur.overload,
        elapsed: cur.elapsed,
      });

      cur.needle = out.needle;
      cur.velocity = out.velocity;
      cur.progress = out.progress;
      cur.overload = out.overload;

      if (out.inBand !== cur.inZone) {
        cur.inZone = out.inBand;
        setInZoneUi(out.inBand);
      }

      if (needleRef.current) {
        const deg = valueToDeg(out.needle);
        needleRef.current.setAttribute("transform", `rotate(${deg.toFixed(2)} 140 142)`);
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${out.progress.toFixed(4)})`;
      }
      if (overloadBarRef.current) {
        overloadBarRef.current.style.transform = `scaleX(${out.overload.toFixed(4)})`;
      }

      if (out.roundCleared) {
        const nextHits = cur.hits + 1;
        cur.hits = nextHits;
        setFlash("hit");
        setBandCenter(pickBandCenter());
        onHit(nextHits);
      } else if (out.overloaded) {
        const nextErrors = cur.errors + 1;
        cur.errors = nextErrors;
        setFlash("miss");
        onMiss(nextErrors);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [bandHalfWidth, config.speed, finished, onHit, onMiss]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 240);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (finished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        e.stopPropagation();
        setHoldState(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setHoldState(false);
      }
    };
    const onBlur = () => setHoldState(false);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [finished]);

  const bandStartDeg = valueToDeg(Math.max(0, bandCenter - bandHalfWidth));
  const bandEndDeg = valueToDeg(Math.min(100, bandCenter + bandHalfWidth));

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto select-none">
      <div
        className={`w-full border p-3.5 transition-colors duration-150 ${
          flash === "hit"
            ? "border-[#22c55e] bg-[#0a140d]"
            : flash === "miss"
              ? "border-[#ef4444] bg-[#160a0a]"
              : "border-[#2a2a32] bg-[#0b0b0e]"
        }`}
      >
        <svg viewBox="0 0 280 165" className="w-full h-auto">
          {/* Base grey arc track */}
          <path
            d={describeArc(140, 142, 108, -80, 80)}
            fill="none"
            stroke="#27272f"
            strokeWidth="14"
          />

          {/* Red extreme bounds */}
          <path
            d={describeArc(140, 142, 108, -80, valueToDeg(6))}
            fill="none"
            stroke="#dc2626"
            strokeWidth="14"
          />
          <path
            d={describeArc(140, 142, 108, valueToDeg(94), 80)}
            fill="none"
            stroke="#dc2626"
            strokeWidth="14"
          />

          {/* Green calibration target arc */}
          <path
            d={describeArc(140, 142, 108, bandStartDeg, bandEndDeg)}
            fill="none"
            stroke="#22c55e"
            strokeWidth="15"
          />

          {/* Tick lines */}
          {[0, 20, 40, 60, 80, 100].map((v) => {
            const deg = valueToDeg(v);
            const p1 = polarToCartesian(140, 142, 88, deg);
            const p2 = polarToCartesian(140, 142, 97, deg);
            return (
              <line
                key={v}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#52525b"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Inner guide arc */}
          <path
            d={describeArc(140, 142, 74, -80, 80)}
            fill="none"
            stroke="#1f1f26"
            strokeWidth="1"
            strokeDasharray="3 4"
          />

          {/* Needle */}
          <g ref={needleRef} transform="rotate(0 140 142)">
            <line
              x1="140"
              y1="142"
              x2="140"
              y2="30"
              stroke={inZoneUi ? "#22c55e" : "#e4e4e7"}
              strokeWidth="2.5"
            />
            <polygon
              points="140,24 136,36 144,36"
              fill={inZoneUi ? "#22c55e" : "#ef4444"}
            />
          </g>

          {/* Pivot square */}
          <rect
            x="133"
            y="135"
            width="14"
            height="14"
            fill="#18181b"
            stroke={inZoneUi ? "#22c55e" : "#71717a"}
            strokeWidth="1.5"
          />
        </svg>

        {/* Calibration & Instability bars */}
        <div className="space-y-2.5 mt-2">
          <div>
            <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider mb-1">
              <span className="text-[#a1a1aa]">Calibração da Faixa</span>
              <span className={inZoneUi ? "text-[#22c55e] font-bold" : "text-[#71717a]"}>
                {inZoneUi ? "ESTÁVEL" : "FORA DA FAIXA"}
              </span>
            </div>
            <div className="h-2 bg-[#141418] border border-[#27272f] overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-[#22c55e] origin-left"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider mb-1">
              <span className="text-[#a1a1aa]">Instabilidade (Erro)</span>
              <span className="text-[#ef4444]">SOBRECARGA</span>
            </div>
            <div className="h-1.5 bg-[#141418] border border-[#27272f] overflow-hidden">
              <div
                ref={overloadBarRef}
                className="h-full bg-[#dc2626] origin-left"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={finished}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setHoldState(true);
        }}
        onPointerUp={() => setHoldState(false)}
        onPointerCancel={() => setHoldState(false)}
        onLostPointerCapture={() => setHoldState(false)}
        className={`w-full min-h-[52px] border font-mono text-xs font-bold uppercase tracking-[0.18em] cursor-pointer touch-none transition-colors ${
          holding
            ? "bg-[#13291b] border-[#22c55e] text-white"
            : "bg-[#18181d] hover:bg-[#202027] border-[#3f3f46] text-[#e4e4e7]"
        }`}
      >
        {holding ? "Mantendo Sinal... (Solte para Descer)" : "Segurar Sinal [Espaço]"}
      </button>
    </div>
  );
};
