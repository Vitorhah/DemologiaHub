import React, { useState } from "react";
import { ChevronDown, ChevronUp, Clock, AlertTriangle } from "lucide-react";
import { PublicSceneDirectorState } from "../types/sceneDirector";
import {
  CLOCK_CATEGORY_META,
  isTensionClockComplete,
} from "../utils/sceneDirector";

export interface PlayerSceneOverlayBarProps {
  publicState: PublicSceneDirectorState;
  isRlMode?: boolean;
}

/**
 * Compact, non-sticky inline bar rendered for players ONLY when the Master
 * exposes one or more public Tension Clocks (active-scene popup removed per UX spec).
 */
export const PlayerSceneOverlayBar: React.FC<PlayerSceneOverlayBarProps> = ({
  publicState,
  isRlMode = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const hasClocks = publicState.visibleClocks.length > 0;
  if (!hasClocks) {
    return null;
  }

  return (
    <section
      aria-label="Relógios de Tensão"
      data-testid="player-scene-overlay-bar"
      className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6 pt-14 lg:pt-4 pb-0 font-mono"
    >
      <div
        className={`bg-[#0b0b10]/95 border rounded-none transition-colors ${
          isRlMode ? "border-purple-500/45" : "border-[#2a2a36]"
        }`}
      >
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <Clock
              size={14}
              className={
                isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"
              }
            />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Relógios de Tensão
            </span>
            <span className="text-[#525364]" aria-hidden="true">
              ·
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#9a9cad] tabular-nums">
              {publicState.visibleClocks.length} ativo
              {publicState.visibleClocks.length === 1 ? "" : "s"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? "Expandir relógios de tensão"
                : "Recolher relógios de tensão"
            }
            data-testid="player-scene-bar-toggle"
            className="min-w-[36px] min-h-[36px] px-2 flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-[#9a9cad] hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-[#2a2a38] cursor-pointer touch-manipulation shrink-0 transition-colors"
          >
            <span className="hidden sm:inline">
              {collapsed ? "Expandir" : "Ocultar"}
            </span>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pb-2.5 pt-1 border-t border-[#1b1b24]">
            <div
              data-testid="player-visible-clocks-list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
            >
              {publicState.visibleClocks.map((clock) => {
                const catMeta = CLOCK_CATEGORY_META[clock.category];
                const complete = isTensionClockComplete(clock);
                return (
                  <div
                    key={clock.id}
                    data-testid={`player-clock-${clock.id}`}
                    className={`bg-[#08080c] border px-2.5 py-2 flex flex-col gap-1.5 ${
                      complete ? "border-red-500/75" : "border-[#22222e]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate">
                          {clock.title}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold tabular-nums shrink-0 ${
                          complete ? "text-red-300" : catMeta.textClass
                        }`}
                      >
                        {clock.filled}/{clock.segments}
                      </span>
                    </div>

                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${clock.segments}, minmax(0, 1fr))`,
                      }}
                      role="progressbar"
                      aria-label={clock.title}
                      aria-valuemin={0}
                      aria-valuemax={clock.segments}
                      aria-valuenow={clock.filled}
                    >
                      {Array.from({ length: clock.segments }).map((_, idx) => {
                        const isFilled = idx < clock.filled;
                        return (
                          <span
                            key={idx}
                            className={`h-2 border transition-colors ${
                              isFilled
                                ? `${catMeta.fillClass} border-transparent`
                                : "bg-[#12121a] border-[#262634]"
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#848698]">
                      <span>{catMeta.label}</span>
                      {complete && (
                        <span className="inline-flex items-center gap-1 text-red-300 font-bold">
                          <AlertTriangle size={11} />
                          Concluído
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
