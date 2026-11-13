import React, { useEffect, useState, useRef, useCallback } from "react";
import { MinigameConfig } from "../../types/minigames";
import {
  clampNumber,
  getLockpickZoneWidth,
  isLockpickAligned,
} from "../../utils/minigamesLogic";

interface LockpickMinigameProps {
  config: MinigameConfig;
  hits: number;
  errors: number;
  finished: boolean;
  onHit: (nextHits: number) => void;
  onMiss: (nextErrors: number) => void;
}

function randomZoneCenter(zoneWidth: number): number {
  const margin = Math.ceil(zoneWidth / 2) + 8;
  return Math.round(margin + Math.random() * (100 - margin * 2));
}

export const LockpickMinigame: React.FC<LockpickMinigameProps> = ({
  config,
  hits,
  errors,
  finished,
  onHit,
  onMiss,
}) => {
  const zoneWidth = getLockpickZoneWidth(config.speed);
  const [zoneCenter, setZoneCenter] = useState<number>(() => randomZoneCenter(zoneWidth));
  const [position, setPosition] = useState<number>(50);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  const posRef = useRef(50);
  posRef.current = position;
  const keysHeldRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  const stateRef = useRef({
    zoneCenter,
    zoneWidth,
    hits,
    errors,
    finished,
  });
  stateRef.current = { zoneCenter, zoneWidth, hits, errors, finished };

  // Subtle mechanical drift at higher speed + smooth keyboard sliding
  useEffect(() => {
    if (finished) return;
    let rafId = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      elapsed += dt;

      let delta = 0;
      if (keysHeldRef.current.left) delta -= 68 * dt;
      if (keysHeldRef.current.right) delta += 68 * dt;

      // Gentle mechanical core oscillation proportional to speed
      if (config.speed >= 4) {
        const driftAmp = (config.speed - 3) * 2.1;
        delta += Math.sin(elapsed * (1.8 + config.speed * 0.2)) * driftAmp * dt;
      }

      if (Math.abs(delta) > 0.001) {
        const nextPos = clampNumber(posRef.current + delta, 0, 100);
        posRef.current = nextPos;
        setPosition(nextPos);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [config.speed, finished]);

  const handleLockPin = useCallback(() => {
    const cur = stateRef.current;
    if (cur.finished) return;

    const aligned = isLockpickAligned(posRef.current, cur.zoneCenter, cur.zoneWidth);
    if (aligned) {
      const nextHits = cur.hits + 1;
      setFlash("hit");
      setZoneCenter(randomZoneCenter(cur.zoneWidth));
      onHit(nextHits);
    } else {
      const nextErrors = cur.errors + 1;
      setFlash("miss");
      onMiss(nextErrors);
    }
  }, [onHit, onMiss]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 220);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (finished) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        keysHeldRef.current.left = true;
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        keysHeldRef.current.right = true;
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) handleLockPin();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keysHeldRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keysHeldRef.current.right = false;
    };
    const onBlur = () => {
      keysHeldRef.current.left = false;
      keysHeldRef.current.right = false;
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [finished, handleLockPin]);

  const alignedNow = isLockpickAligned(position, zoneCenter, zoneWidth);
  const zoneLeftPct = clampNumber(zoneCenter - zoneWidth / 2, 0, 100);
  const totalPins = config.rounds;
  const activePinIdx = Math.min(hits, totalPins - 1);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto select-none">
      {/* Row of geometric pin chambers */}
      <div
        className={`w-full border p-3.5 transition-colors duration-150 ${
          flash === "hit"
            ? "border-[#22c55e] bg-[#0a140d]"
            : flash === "miss"
              ? "border-[#ef4444] bg-[#160a0a]"
              : "border-[#2a2a32] bg-[#0b0b0e]"
        }`}
      >
        <div className="flex items-end justify-center gap-2 sm:gap-2.5 h-28">
          {Array.from({ length: totalPins }, (_, idx) => {
            const unlocked = idx < hits;
            const isCurrent = idx === activePinIdx && !finished;
            const pinHeightPct = unlocked
              ? 88
              : isCurrent
                ? 25 + (position / 100) * 65
                : 35;

            return (
              <div
                key={idx}
                className={`flex-1 max-w-[38px] h-full border relative flex flex-col justify-end p-1 ${
                  unlocked
                    ? "border-[#22c55e]/70 bg-[#0d1c12]"
                    : isCurrent
                      ? "border-[#71717a] bg-[#141419]"
                      : "border-[#24242b] bg-[#0d0d11]"
                }`}
              >
                {/* Sweet spot line on active cylinder */}
                {isCurrent && (
                  <div
                    className="absolute left-0 right-0 border-y border-[#22c55e]/70 bg-[#22c55e]/20 pointer-events-none"
                    style={{
                      bottom: `${25 + (zoneLeftPct / 100) * 65}%`,
                      height: `${(zoneWidth / 100) * 65}%`,
                    }}
                  />
                )}

                {/* Sliding geometric pin core */}
                <div
                  className={`w-full transition-colors duration-75 ${
                    unlocked
                      ? "bg-[#22c55e]"
                      : isCurrent
                        ? alignedNow
                          ? "bg-[#22c55e]"
                          : "bg-[#a1a1aa]"
                        : "bg-[#3f3f46]"
                  }`}
                  style={{ height: `${pinHeightPct}%` }}
                />

                <span className="absolute top-1 left-0 right-0 text-center text-[9px] font-mono text-[#71717a]">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Precision horizontal alignment rail */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5">
            <span>Pino {Math.min(hits + 1, totalPins)} / {totalPins}</span>
            <span className={alignedNow ? "text-[#22c55e] font-bold" : "text-[#71717a]"}>
              {alignedNow ? "ALINHADO" : "AJUSTANDO"}
            </span>
          </div>

          <div className="relative h-8 bg-[#121217] border border-[#2d2d36] flex items-center px-1">
            {/* Green alignment zone */}
            <div
              className="absolute top-1 bottom-1 bg-[#22c55e]/25 border-x-2 border-[#22c55e]"
              style={{
                left: `${zoneLeftPct}%`,
                width: `${zoneWidth}%`,
              }}
            />

            {/* Player cursor marker */}
            <div
              className={`absolute top-0.5 bottom-0.5 w-1.5 -ml-[3px] pointer-events-none ${
                alignedNow ? "bg-[#22c55e]" : "bg-[#ef4444]"
              }`}
              style={{ left: `${position}%` }}
            />

            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={position}
              disabled={finished}
              onChange={(e) => {
                const v = Number(e.target.value);
                posRef.current = v;
                setPosition(v);
              }}
              aria-label="Controle de alinhamento do pino da fechadura"
              className="relative z-10 w-full h-full opacity-0 cursor-ew-resize touch-pan-x"
            />
          </div>
        </div>
      </div>

      {/* Controls: coarse nudges for touch + lock button */}
      <div className="w-full flex items-center gap-2">
        <button
          type="button"
          disabled={finished}
          onPointerDown={() => {
            keysHeldRef.current.left = true;
          }}
          onPointerUp={() => {
            keysHeldRef.current.left = false;
          }}
          onPointerLeave={() => {
            keysHeldRef.current.left = false;
          }}
          onPointerCancel={() => {
            keysHeldRef.current.left = false;
          }}
          aria-label="Mover controle para esquerda"
          className="min-w-[48px] min-h-[48px] bg-[#141418] hover:bg-[#1f1f26] border border-[#32323c] text-white font-mono text-sm font-bold cursor-pointer touch-manipulation"
        >
          ◀
        </button>

        <button
          type="button"
          disabled={finished}
          onClick={handleLockPin}
          className={`flex-1 min-h-[48px] border font-mono text-xs font-bold uppercase tracking-[0.18em] cursor-pointer touch-manipulation transition-colors ${
            alignedNow
              ? "bg-[#14331e] hover:bg-[#194227] border-[#22c55e] text-white"
              : "bg-[#18181d] hover:bg-[#23232b] border-[#3f3f46] text-[#d4d4d8]"
          }`}
        >
          Travar Pino [Espaço]
        </button>

        <button
          type="button"
          disabled={finished}
          onPointerDown={() => {
            keysHeldRef.current.right = true;
          }}
          onPointerUp={() => {
            keysHeldRef.current.right = false;
          }}
          onPointerLeave={() => {
            keysHeldRef.current.right = false;
          }}
          onPointerCancel={() => {
            keysHeldRef.current.right = false;
          }}
          aria-label="Mover controle para direita"
          className="min-w-[48px] min-h-[48px] bg-[#141418] hover:bg-[#1f1f26] border border-[#32323c] text-white font-mono text-sm font-bold cursor-pointer touch-manipulation"
        >
          ▶
        </button>
      </div>
    </div>
  );
};
