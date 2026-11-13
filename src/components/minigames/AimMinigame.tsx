import React, { useEffect, useRef } from "react";
import { MinigameConfig } from "../../types/minigames";
import { clampNumber, isPointInsideCircle } from "../../utils/minigamesLogic";

interface AimMinigameProps {
  config: MinigameConfig;
  hits: number;
  errors: number;
  finished: boolean;
  onHit: (nextHits: number) => void;
  onMiss: (nextErrors: number) => void;
}

interface AimTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  lifetime: number;
}

interface RedDecoy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rot: number;
}

interface PulseEffect {
  x: number;
  y: number;
  color: string;
  age: number;
  maxAge: number;
}

const ARENA_SIZE = 300;

function spawnTarget(speed: number): AimTarget {
  const pad = 42;
  const x = pad + Math.random() * (ARENA_SIZE - pad * 2);
  const y = pad + Math.random() * (ARENA_SIZE - pad * 2);
  const angle = Math.random() * Math.PI * 2;
  const moveSpeed = speed <= 2 ? 22 : 24 + speed * 9;
  const lifetime = clampNumber(3.4 - speed * 0.19, 1.35, 3.2);
  return {
    x,
    y,
    vx: Math.cos(angle) * moveSpeed,
    vy: Math.sin(angle) * moveSpeed,
    radius: 23,
    age: 0,
    lifetime,
  };
}

function spawnDecoys(speed: number): RedDecoy[] {
  const count = speed >= 7 ? 3 : speed >= 4 ? 2 : 1;
  return Array.from({ length: count }, () => {
    const pad = 34;
    const angle = Math.random() * Math.PI * 2;
    const spd = 28 + speed * 8;
    return {
      x: pad + Math.random() * (ARENA_SIZE - pad * 2),
      y: pad + Math.random() * (ARENA_SIZE - pad * 2),
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      radius: 17,
      rot: Math.random() * Math.PI * 2,
    };
  });
}

export const AimMinigame: React.FC<AimMinigameProps> = ({
  config,
  hits,
  errors,
  finished,
  onHit,
  onMiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    target: spawnTarget(config.speed),
    decoys: spawnDecoys(config.speed),
    pulses: [] as PulseEffect[],
    hits,
    errors,
    finished,
    crosshair: { x: ARENA_SIZE / 2, y: ARENA_SIZE / 2, active: false },
  });

  stateRef.current.hits = hits;
  stateRef.current.errors = errors;
  stateRef.current.finished = finished;

  const callbacksRef = useRef({ onHit, onMiss });
  callbacksRef.current = { onHit, onMiss };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ARENA_SIZE * dpr;
    canvas.height = ARENA_SIZE * dpr;

    let rafId = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const s = stateRef.current;

      if (!s.finished) {
        // Move green target
        const t = s.target;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.age += dt;
        if (t.x < t.radius + 10 || t.x > ARENA_SIZE - t.radius - 10) {
          t.vx *= -1;
          t.x = clampNumber(t.x, t.radius + 10, ARENA_SIZE - t.radius - 10);
        }
        if (t.y < t.radius + 10 || t.y > ARENA_SIZE - t.radius - 10) {
          t.vy *= -1;
          t.y = clampNumber(t.y, t.radius + 10, ARENA_SIZE - t.radius - 10);
        }

        if (t.age >= t.lifetime) {
          s.pulses.push({ x: t.x, y: t.y, color: "#ef4444", age: 0, maxAge: 0.35 });
          s.target = spawnTarget(config.speed);
          const nextErr = s.errors + 1;
          s.errors = nextErr;
          callbacksRef.current.onMiss(nextErr);
        }

        // Move red interference decoys
        for (const d of s.decoys) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.rot += 1.6 * dt;
          if (d.x < d.radius + 8 || d.x > ARENA_SIZE - d.radius - 8) {
            d.vx *= -1;
            d.x = clampNumber(d.x, d.radius + 8, ARENA_SIZE - d.radius - 8);
          }
          if (d.y < d.radius + 8 || d.y > ARENA_SIZE - d.radius - 8) {
            d.vy *= -1;
            d.y = clampNumber(d.y, d.radius + 8, ARENA_SIZE - d.radius - 8);
          }
        }
      }

      // Advance pulses
      s.pulses = s.pulses
        .map((p) => ({ ...p, age: p.age + dt }))
        .filter((p) => p.age < p.maxAge);

      // Render crisp geometric radar viewport
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);

      // Subtle orthogonal grid
      ctx.strokeStyle = "#18181f";
      ctx.lineWidth = 1;
      for (let g = 50; g < ARENA_SIZE; g += 50) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, ARENA_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, g);
        ctx.lineTo(ARENA_SIZE, g);
        ctx.stroke();
      }

      // Concentric radar rings
      ctx.strokeStyle = "#22222b";
      for (const r of [48, 96, 138]) {
        ctx.beginPath();
        ctx.arc(ARENA_SIZE / 2, ARENA_SIZE / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Red decoys (crossed triangles / interference diamonds)
      for (const d of s.decoys) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.strokeStyle = "#dc2626";
        ctx.fillStyle = "rgba(220, 38, 38, 0.14)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
          const px = Math.cos(a) * d.radius;
          const py = Math.sin(a) * d.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner red X
        ctx.beginPath();
        ctx.moveTo(-5, -5);
        ctx.lineTo(5, 5);
        ctx.moveTo(5, -5);
        ctx.lineTo(-5, 5);
        ctx.stroke();
        ctx.restore();
      }

      // Green Target + outer shrinking countdown ring
      if (!s.finished) {
        const t = s.target;
        const lifeFrac = clampNumber(1 - t.age / t.lifetime, 0, 1);

        // Outer countdown ring (interpolates from gray/green to red near expiry)
        ctx.strokeStyle = lifeFrac < 0.35 ? "#ef4444" : "#52525b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          t.x,
          t.y,
          t.radius + 4 + lifeFrac * 10,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * lifeFrac
        );
        ctx.stroke();

        // Green diamond/octagon target
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.fillStyle = "rgba(34, 197, 94, 0.18)";
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        const sides = 8;
        for (let i = 0; i < sides; i++) {
          const a = (i * Math.PI * 2) / sides;
          const px = Math.cos(a) * t.radius;
          const py = Math.sin(a) * t.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crosshair inner ticks
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-4, 0);
        ctx.moveTo(4, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, -4);
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 10);
        ctx.stroke();

        ctx.fillStyle = "#22c55e";
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
      }

      // Expanding geometric feedback pulses
      for (const p of s.pulses) {
        const k = p.age / p.maxAge;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const size = 12 + k * 28;
        ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
        ctx.restore();
      }

      // Subtle tactical reticle when pointer hovers (desktop)
      if (s.crosshair.active && !s.finished) {
        ctx.strokeStyle = "rgba(228, 228, 231, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.crosshair.x - 12, s.crosshair.y);
        ctx.lineTo(s.crosshair.x + 12, s.crosshair.y);
        ctx.moveTo(s.crosshair.x, s.crosshair.y - 12);
        ctx.lineTo(s.crosshair.x, s.crosshair.y + 12);
        ctx.stroke();
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [config.speed]);

  const toArenaCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * ARENA_SIZE,
      y: ((clientY - rect.top) / rect.height) * ARENA_SIZE,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.finished) return;
    e.preventDefault();
    const pt = toArenaCoords(e.clientX, e.clientY);
    if (!pt) return;

    // 1. Check green target first (generous +4px touch grace)
    if (isPointInsideCircle(pt.x, pt.y, s.target.x, s.target.y, s.target.radius + 4)) {
      s.pulses.push({ x: s.target.x, y: s.target.y, color: "#22c55e", age: 0, maxAge: 0.3 });
      s.target = spawnTarget(config.speed);
      const nextHits = s.hits + 1;
      s.hits = nextHits;
      onHit(nextHits);
      return;
    }

    // 2. Otherwise either decoy hit or miss
    s.pulses.push({ x: pt.x, y: pt.y, color: "#ef4444", age: 0, maxAge: 0.3 });
    const nextErrors = s.errors + 1;
    s.errors = nextErrors;
    onMiss(nextErrors);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full select-none">
      <div className="w-full max-w-[320px] aspect-square border border-[#2d2d36] bg-[#09090b] relative overflow-hidden">
        <canvas
          ref={canvasRef}
          data-testid="aim-minigame-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => {
            const pt = toArenaCoords(e.clientX, e.clientY);
            if (pt) {
              stateRef.current.crosshair = { x: pt.x, y: pt.y, active: true };
            }
          }}
          onPointerLeave={() => {
            stateRef.current.crosshair.active = false;
          }}
          className="w-full h-full block cursor-crosshair touch-none"
        />
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-[#22c55e] bg-[#22c55e]/25 inline-block" />
          Alvo (+1)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-[#dc2626] bg-[#dc2626]/25 inline-block" />
          Interferência (-1 Chance)
        </span>
      </div>
    </div>
  );
};
