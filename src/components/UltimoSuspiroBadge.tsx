import React from "react";
import { Skull } from "lucide-react";
import {
  ULTIMO_SUSPIRO_MAX_FAILURES,
  UltimoSuspiroState,
  canTriggerSurvivalTest,
} from "../utils/ultimoSuspiro";

export interface UltimoSuspiroBadgeProps {
  ultimoSuspiro: UltimoSuspiroState;
  canInteract: boolean;
  onTriggerTest: () => void;
  compact?: boolean;
}

export const UltimoSuspiroBadge: React.FC<UltimoSuspiroBadgeProps> = ({
  ultimoSuspiro,
  canInteract,
  onTriggerTest,
  compact = false,
}) => {
  if (ultimoSuspiro.status === "alive") return null;

  const isDead = ultimoSuspiro.status === "dead";
  const isCoinPending =
    ultimoSuspiro.status === "dying" &&
    Boolean(ultimoSuspiro.coinFlipPending) &&
    !ultimoSuspiro.coinFlipUsed;
  const isImminent =
    ultimoSuspiro.status === "dying" &&
    ultimoSuspiro.failures >= ULTIMO_SUSPIRO_MAX_FAILURES - 1;
  const interactive = canTriggerSurvivalTest(ultimoSuspiro, canInteract);
  const counterLabel = isCoinPending
    ? "0T"
    : `${ultimoSuspiro.failures}/${ULTIMO_SUSPIRO_MAX_FAILURES}`;

  if (isDead) {
    return (
      <button
        type="button"
        disabled
        data-testid="ultimo-suspiro-skull-badge"
        data-status="dead"
        aria-label={`Morte Definitiva (${counterLabel}) — apenas o Mestre pode reviver`}
        title="Morte Definitiva (3/3) — personagem morto. Apenas o Mestre pode reviver."
        className={`inline-flex items-center justify-center gap-1.5 border border-[#3a3a44] bg-[#141418] text-[#7f818c] font-mono uppercase tracking-[0.14em] rounded-none select-none cursor-not-allowed ${
          compact
            ? "px-2 py-1 text-[10px] min-h-[28px]"
            : "px-3 py-1.5 text-[11px] min-h-[44px]"
        }`}
      >
        <Skull size={compact ? 12 : 14} className="shrink-0 opacity-75" />
        <span className="font-bold tabular-nums">{counterLabel}</span>
        {!compact && (
          <span className="text-[9px] tracking-[0.16em] text-[#6a6b75] border-l border-[#2c2c34] pl-1.5">
            MORTO
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => {
        if (interactive) onTriggerTest();
      }}
      data-testid="ultimo-suspiro-skull-badge"
      data-status={isCoinPending ? "coin_pending" : "dying"}
      aria-label={
        isCoinPending
          ? "Última Chance — jogar cara ou coroa por um turno extra"
          : `Último Suspiro ${counterLabel} — iniciar teste de sobrevivência`
      }
      title={
        isCoinPending
          ? "0 turnos restantes — clique para jogar Cara ou Coroa pela Última Chance"
          : interactive
            ? `Último Suspiro (${counterLabel}) — clique para realizar o teste de sobrevivência (2d6 + VIT)`
            : `Último Suspiro (${counterLabel})`
      }
      className={`group inline-flex items-center justify-center gap-1.5 border font-mono uppercase tracking-[0.14em] rounded-none transition-colors touch-manipulation select-none ${
        compact
          ? "px-2 py-1 text-[10px] min-h-[30px]"
          : "px-3 py-1.5 text-[11px] min-h-[44px]"
      } ${
        interactive
          ? isCoinPending || isImminent
            ? "bg-[#26070a] hover:bg-[#380b0f] active:scale-[0.97] border-[#d93840] text-[#ffb3b8] shadow-[0_0_16px_rgba(181,42,48,0.45)] cursor-pointer animate-pulse"
            : "bg-[#1a0709] hover:bg-[#2a0b0e] active:scale-[0.97] border-[#8f171c] hover:border-[#c82d35] text-[#f5b0b5] shadow-[0_0_12px_rgba(143,23,28,0.3)] cursor-pointer"
          : "bg-[#17090b] border-[#5c161a] text-[#b47478] cursor-default"
      }`}
    >
      <Skull
        size={compact ? 12 : 15}
        className={`shrink-0 ${
          isCoinPending || isImminent ? "text-[#ff5964]" : "text-[#d93840]"
        } group-hover:scale-105 transition-transform`}
      />
      <span className="font-bold tabular-nums text-white">{counterLabel}</span>
      {!compact && (
        <span className="text-[9px] font-bold tracking-[0.14em] text-[#ff9399] border-l border-[#8f171c]/60 pl-1.5">
          {isCoinPending
            ? "ÚLTIMA CHANCE"
            : isImminent
              ? "ÚLTIMO TURNO"
              : "SOBREVIVER"}
        </span>
      )}
    </button>
  );
};
