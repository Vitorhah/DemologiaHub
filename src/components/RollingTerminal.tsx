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
  isRlMode?: boolean;
}

export function RollingTerminal({
  diceInput,
  setDiceInput,
  onRoll,
  history,
  historyRef,
  isShaking,
  title = "Terminal de Rolagem",
  isRlMode = false,
}: RollingTerminalProps) {
  const [showHistory, setShowHistory] = useState(true);

  return (
    <div className="section" style={{ borderBottom: "none", padding: "0" }}>
      <div className="section-title flex flex-wrap items-center justify-between gap-2">
        <span
          className={`text-xs sm:text-sm ${
            isRlMode ? "text-purple-200" : ""
          }`}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className={`text-[11px] font-mono px-3 py-1.5 min-h-[44px] sm:min-h-[38px] rounded-none border cursor-pointer transition-colors flex items-center gap-1.5 font-normal touch-manipulation select-none ${
            isRlMode
              ? "bg-[#181228] hover:bg-[#251a3d] border-purple-500/30 text-[#d8b4fe] hover:text-white"
              : "bg-[#131318] hover:bg-[#1c1c24] border-[var(--op-border)] text-[var(--op-text-muted)] hover:text-white"
          }`}
          style={{ textTransform: "none", letterSpacing: "normal" }}
          title={showHistory ? "Ocultar histórico" : "Mostrar histórico"}
        >
          {showHistory ? (
            <>
              <EyeOff
                size={13}
                className={isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"}
              />
              <span>Ocultar Histórico</span>
            </>
          ) : (
            <>
              <Eye
                size={13}
                className={isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"}
              />
              <span>Mostrar Histórico ({history.length})</span>
            </>
          )}
        </button>
      </div>

      <div
        className={`dice-panel !p-3.5 sm:!p-4 border transition-colors ${
          isRlMode
            ? "bg-gradient-to-b from-[#151224] to-[#0c0a14] border-purple-500/30"
            : ""
        }`}
      >
        <div className="dice-input-group flex gap-2">
          <input
            type="text"
            className={`dice-input !min-h-[44px] text-base ${
              isRlMode
                ? "!bg-[#110d1c] !border-purple-500/35 focus:!border-[#c084fc] focus:!ring-1 focus:!ring-[#c084fc] text-white"
                : ""
            }`}
            placeholder="Ex: 1d20+OCU"
            value={diceInput}
            onChange={(e) => setDiceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onRoll()}
          />
          <button
            type="button"
            className={`btn-roll !min-h-[44px] !px-4 sm:!px-6 shrink-0 touch-manipulation select-none ${
              isRlMode
                ? "bg-gradient-to-r from-[#7e22ce] via-[#9333ea] to-[#6b21a8] hover:from-[#9333ea] hover:to-[#7e22ce] border border-purple-400/40 shadow-[0_0_16px_rgba(168,85,247,0.4)] text-white font-bold"
                : ""
            }`}
            onClick={onRoll}
          >
            ROLAR
          </button>
        </div>

        {showHistory ? (
          <div
            className={`dice-history !max-h-36 sm:!max-h-44 ${
              isRlMode
                ? "!bg-[#0e091b]/90 !border-purple-900/40"
                : ""
            }`}
            ref={historyRef as any}
            style={isShaking ? { animation: "shake 0.3s ease" } : {}}
          >
            {history.length === 0 ? (
              <div
                className="log-entry"
                style={{
                  color: isRlMode ? "rgba(216, 180, 254, 0.5)" : "var(--op-text-muted)",
                  fontStyle: "italic",
                }}
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
            className={`mt-2 py-2.5 px-3 rounded-none border border-dashed text-center text-[11px] font-mono cursor-pointer transition-all touch-manipulation select-none ${
              isRlMode
                ? "border-purple-500/30 hover:border-[#c084fc] bg-[#140e24]/70 text-[#d8b4fe] hover:text-white"
                : "border-[var(--op-border)] text-[var(--op-text-muted)] hover:text-white hover:border-[var(--op-red)] bg-[#0e0e12]/60"
            }`}
          >
            Histórico ocultado ({history.length} registro{history.length === 1 ? "" : "s"}). Toque para expandir.
          </div>
        )}
      </div>
    </div>
  );
}
