import React, { useEffect, useState } from "react";
import { HeartPulse, Skull, FastForward } from "lucide-react";
import {
  ULTIMO_SUSPIRO_MAX_FAILURES,
  UltimoSuspiroState,
} from "../utils/ultimoSuspiro";

export interface MasterUltimoSuspiroControlsProps {
  ultimoSuspiro: UltimoSuspiroState;
  maxHp: number;
  characterName: string;
  isMaster: boolean;
  compact?: boolean;
  onAdvanceTurn?: () => void;
  onFinalizeDeath?: () => void;
  onRevive?: (targetHp: number) => void;
}

export const MasterUltimoSuspiroControls: React.FC<MasterUltimoSuspiroControlsProps> = ({
  ultimoSuspiro,
  maxHp,
  characterName,
  isMaster,
  compact = false,
  onAdvanceTurn,
  onFinalizeDeath,
  onRevive,
}) => {
  const defaultReviveHp = Math.max(1, Math.min(Math.max(1, maxHp), Math.ceil(Math.max(1, maxHp) * 0.25)));
  const [reviveHpInput, setReviveHpInput] = useState<string>(String(defaultReviveHp));

  useEffect(() => {
    setReviveHpInput(String(defaultReviveHp));
  }, [defaultReviveHp, ultimoSuspiro.status]);

  if (ultimoSuspiro.status === "alive") return null;

  const isDead = ultimoSuspiro.status === "dead";
  const counterLabel = `${ultimoSuspiro.failures}/${ULTIMO_SUSPIRO_MAX_FAILURES}`;

  return (
    <div
      data-testid="master-ultimo-suspiro-controls"
      data-status={ultimoSuspiro.status}
      className={`border rounded-none font-mono ${
        compact ? "p-1.5 mt-1.5" : "p-2 mb-2.5"
      } ${
        isDead
          ? "bg-[#131317] border-[#3f3f46]"
          : "bg-[#170709] border-[#8f171c]/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            isDead ? "text-[#a1a1aa]" : "text-[#ff8a90]"
          }`}
        >
          <Skull size={12} className="shrink-0" />
          <span>{isDead ? "MORTE DEFINITIVA" : "ÚLTIMO SUSPIRO"}</span>
        </span>
        <span
          className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 border ${
            isDead
              ? "border-[#3f3f46] bg-[#1c1c21] text-[#d4d4d8]"
              : "border-[#8f171c]/60 bg-[#240a0d] text-white"
          }`}
        >
          {counterLabel}
        </span>
      </div>

      {isMaster && !isDead && (onAdvanceTurn || onFinalizeDeath) && (
        <div className="flex items-center gap-1.5 mt-2">
          {onAdvanceTurn && (
            <button
              type="button"
              onClick={onAdvanceTurn}
              aria-label={`Avançar turno de Último Suspiro de ${characterName}`}
              title="Avançar +1 turno no contador de Último Suspiro"
              className="flex-1 min-h-[32px] px-2 bg-[#1c0c0e] hover:bg-[#2c1114] border border-[#7c1d22] text-[#f5b0b5] text-[10px] font-bold uppercase tracking-wider rounded-none cursor-pointer inline-flex items-center justify-center gap-1 touch-manipulation"
            >
              <FastForward size={11} />
              <span>+1 Turno</span>
            </button>
          )}
          {onFinalizeDeath && (
            <button
              type="button"
              onClick={onFinalizeDeath}
              aria-label={`Finalizar ${characterName} (Morte Definitiva)`}
              title="Finalizar personagem imediatamente (3/3 — Morte Definitiva)"
              className="flex-1 min-h-[32px] px-2 bg-[#2a0a0d] hover:bg-[#3f0e13] border border-[#b52a30] text-white text-[10px] font-bold uppercase tracking-wider rounded-none cursor-pointer inline-flex items-center justify-center gap-1 touch-manipulation"
            >
              <Skull size={11} />
              <span>Finalizar</span>
            </button>
          )}
        </div>
      )}

      {isMaster && isDead && onRevive && (
        <div className="flex items-center gap-1.5 mt-2">
          <label className="text-[10px] uppercase text-[#a1a1aa] shrink-0">
            PV:
          </label>
          <input
            type="number"
            min={1}
            max={Math.max(1, maxHp)}
            value={reviveHpInput}
            onChange={(e) => setReviveHpInput(e.target.value)}
            aria-label={`PV inicial ao reviver ${characterName}`}
            className="w-14 min-h-[32px] bg-[#0a0a0e] border border-[#3f3f46] focus:border-emerald-500 text-white text-xs text-center font-bold tabular-nums outline-none rounded-none"
          />
          <button
            type="button"
            onClick={() => {
              const parsed = Math.trunc(Number(reviveHpInput));
              const safeVal = Number.isFinite(parsed) && parsed >= 1 ? parsed : defaultReviveHp;
              onRevive(Math.min(Math.max(1, maxHp), safeVal));
            }}
            aria-label={`Reviver ${characterName}`}
            className="flex-1 min-h-[32px] px-2.5 bg-emerald-950/70 hover:bg-emerald-900/75 border border-emerald-500/60 text-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded-none cursor-pointer inline-flex items-center justify-center gap-1 touch-manipulation"
          >
            <HeartPulse size={12} />
            <span>Reviver</span>
          </button>
        </div>
      )}
    </div>
  );
};
