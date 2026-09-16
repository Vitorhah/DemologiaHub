import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface RollingTerminalProps {
  diceInput: string;
  setDiceInput: (val: string) => void;
  onRoll: () => void;
  history: string[];
  historyRef: React.RefObject<HTMLDivElement | null>;
  isShaking: boolean;
  title?: string;
}

export function RollingTerminal({
  diceInput,
  setDiceInput,
  onRoll,
  history,
  historyRef,
  isShaking,
  title = "Terminal de Rolagem",
}: RollingTerminalProps) {
  const [showHistory, setShowHistory] = useState(true);

  return (
    <div className="section" style={{ borderBottom: "none", padding: "0" }}>
      <div className="section-title flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs sm:text-sm">{title}</span>
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="text-[11px] font-mono text-[var(--op-text-muted)] hover:text-white px-2.5 py-1.5 min-h-[36px] rounded bg-[#131318] hover:bg-[#1c1c24] border border-[var(--op-border)] cursor-pointer transition-colors flex items-center gap-1.5 font-normal touch-manipulation select-none"
          style={{ textTransform: "none", letterSpacing: "normal" }}
          title={showHistory ? "Ocultar histórico" : "Mostrar histórico"}
        >
          {showHistory ? (
            <>
              <EyeOff size={13} className="text-[var(--op-red-bright)]" />
              <span>Ocultar Histórico</span>
            </>
          ) : (
            <>
              <Eye size={13} className="text-[var(--op-red-bright)]" />
              <span>Mostrar Histórico ({history.length})</span>
            </>
          )}
        </button>
      </div>

      <div className="dice-panel !p-3.5 sm:!p-4">
        <div className="dice-input-group flex gap-2">
          <input
            type="text"
            className="dice-input !min-h-[44px] text-base"
            placeholder="Ex: 1d20+OCU"
            value={diceInput}
            onChange={(e) => setDiceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRoll()}
          />
          <button
            type="button"
            className="btn-roll !min-h-[44px] !px-4 sm:!px-6 shrink-0 touch-manipulation select-none"
            onClick={onRoll}
          >
            ROLAR
          </button>
        </div>

        {showHistory ? (
          <div
            className="dice-history !max-h-36 sm:!max-h-44"
            ref={historyRef as any}
            style={isShaking ? { animation: "shake 0.3s ease" } : {}}
          >
            {history.length === 0 ? (
              <div
                className="log-entry"
                style={{ color: "var(--op-text-muted)", fontStyle: "italic" }}
              >
                Nenhuma rolagem realizada ainda.
              </div>
            ) : (
              history.map((h, i) => (
                <div
                  key={i}
                  className="log-entry break-words"
                  dangerouslySetInnerHTML={{ __html: h }}
                />
              ))
            )}
          </div>
        ) : (
          <div
            onClick={() => setShowHistory(true)}
            className="mt-2 py-2.5 px-3 rounded-lg border border-dashed border-[var(--op-border)] text-center text-[11px] font-mono text-[var(--op-text-muted)] hover:text-white hover:border-[var(--op-red)] cursor-pointer transition-all bg-[#0e0e12]/60 touch-manipulation select-none"
          >
            Histórico ocultado ({history.length} registro{history.length === 1 ? "" : "s"}). Toque para expandir.
          </div>
        )}
      </div>
    </div>
  );
}
