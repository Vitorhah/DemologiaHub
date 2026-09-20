import React, { useEffect, useState, useRef } from "react";
import { GameMode } from "../types";
import { Flame, EyeOff } from "lucide-react";

interface ModeTransitionEffectProps {
  activeMode: GameMode;
}

export const ModeTransitionEffect: React.FC<ModeTransitionEffectProps> = ({
  activeMode,
}) => {
  const prevModeRef = useRef<GameMode>(activeMode);
  const isFirstMount = useRef(true);
  const [transitioningTo, setTransitioningTo] = useState<GameMode | null>(null);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevModeRef.current = activeMode;
      return;
    }

    if (prevModeRef.current !== activeMode) {
      prevModeRef.current = activeMode;
      setTransitioningTo(activeMode);

      const timer = setTimeout(() => {
        setTransitioningTo(null);
      }, 950);

      return () => clearTimeout(timer);
    }
  }, [activeMode]);

  if (!transitioningTo) return null;

  const isRl = transitioningTo === "rl";

  return (
    <div
      className={`fixed inset-0 z-[9999] pointer-events-none flex flex-col items-center justify-center overflow-hidden select-none ${
        isRl ? "animate-mode-rl" : "animate-mode-demologia"
      }`}
      aria-hidden="true"
    >
      {/* Linhas de varredura cinematográfica */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

      {/* Vinheta atmosférica */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isRl
            ? "shadow-[inset_0_0_120px_rgba(168,85,247,0.45)]"
            : "shadow-[inset_0_0_120px_rgba(181,42,48,0.55)]"
        }`}
      />

      {/* Conteúdo central da transição */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 py-4">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-none border mb-3 shadow-2xl transition-transform transform scale-110 ${
            isRl
              ? "bg-[#140b22] border-purple-400/80 text-white shadow-[0_0_30px_rgba(168,85,247,0.7)]"
              : "bg-[#1f0a0d] border-[var(--op-red)] text-white shadow-[0_0_30px_rgba(181,42,48,0.7)]"
          }`}
        >
          {isRl ? (
            <EyeOff size={28} className="text-purple-200 animate-pulse" />
          ) : (
            <Flame size={28} className="text-[#ff6b72] animate-pulse" />
          )}
        </div>

        <div className="space-y-1">
          <div
            className={`text-xs sm:text-sm font-mono font-bold tracking-[0.3em] uppercase ${
              isRl ? "text-purple-200" : "text-[#ff7b80]"
            }`}
            style={{
              textShadow: isRl
                ? "0 0 14px rgba(168,85,247,0.8), 0 0 2px #fff"
                : "0 0 14px rgba(220,38,38,0.8), 0 0 2px #fff",
            }}
          >
            {isRl
              ? "REALIDADE MUNDANA // MODO REAL L"
              : "O PARANORMAL DESPERTO // MODO DEMOLOGIA"}
          </div>

          <div className="text-[11px] font-mono text-[#d1d2de] tracking-wider">
            {isRl
              ? "Sanidade Mental ativa • Habilidades paranormais ocultas"
              : "Pontos de Esforço ativos • Técnicas paranormais liberadas"}
          </div>
        </div>

        {/* Linha de energia dimensional */}
        <div
          className={`mt-4 h-[2px] w-48 sm:w-64 transition-all ${
            isRl
              ? "bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_10px_#c084fc]"
              : "bg-gradient-to-r from-transparent via-[var(--op-red-bright)] to-transparent shadow-[0_0_10px_#ef4444]"
          }`}
        />
      </div>
    </div>
  );
};
