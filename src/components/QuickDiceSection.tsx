import React from "react";

interface RollResult {
  formula: string;
  result: number;
  details: string;
  critical?: "crit" | "fumble" | "normal";
}

interface QuickDiceSectionProps {
  quickDiceQty: number;
  setQuickDiceQty: (qty: number) => void;
  onRoll: (formula: string) => void;
  lastRoll: RollResult | null;
  isRlMode?: boolean;
}

// Renderização SVG detalhada com estética geométrica sagrada / paranormal
function DieShape({ sides, className = "w-10 h-10" }: { sides: number; className?: string }) {
  switch (sides) {
    case 4: // Tetraedro (Triângulo com nervuras internas)
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,4 37,34 3,34" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <line x1="20" y1="4" x2="20" y2="24" strokeDasharray="1 1" />
          <line x1="20" y1="24" x2="3" y2="34" />
          <line x1="20" y1="24" x2="37" y2="34" />
          <circle cx="20" cy="24" r="1.5" fill="currentColor" />
        </svg>
      );
    case 6: // Hexaedro / Cubo em perspectiva isométrica
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,5 35,13.5 35,28.5 20,37 5,28.5 5,13.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <line x1="20" y1="5" x2="20" y2="21" />
          <line x1="20" y1="21" x2="35" y2="13.5" />
          <line x1="20" y1="21" x2="5" y2="13.5" />
          <line x1="20" y1="21" x2="20" y2="37" />
          <circle cx="20" cy="21" r="1.5" fill="currentColor" />
        </svg>
      );
    case 8: // Octaedro (Losango facetado duplo)
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,3 36,20 20,37 4,20" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <line x1="4" y1="20" x2="36" y2="20" />
          <polygon points="20,3 28,20 20,37 12,20" strokeDasharray="1.5 1.5" />
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        </svg>
      );
    case 10: // Decaedro / Pipa com facetas
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,3 36,15 20,38 4,15" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <line x1="20" y1="3" x2="20" y2="38" />
          <line x1="4" y1="15" x2="20" y2="20" />
          <line x1="36" y1="15" x2="20" y2="20" />
          <line x1="4" y1="15" x2="20" y2="38" strokeDasharray="1 1" />
          <line x1="36" y1="15" x2="20" y2="38" strokeDasharray="1 1" />
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        </svg>
      );
    case 12: // Dodecaedro (Pentágono com facetas sagradas)
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,4 36,15 30,34 10,34 4,15" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <polygon points="20,12 28,18 25,28 15,28 12,18" strokeLinejoin="round" strokeDasharray="1.5 1.5" />
          <line x1="20" y1="4" x2="20" y2="12" />
          <line x1="36" y1="15" x2="28" y2="18" />
          <line x1="30" y1="34" x2="25" y2="28" />
          <line x1="10" y1="34" x2="15" y2="28" />
          <line x1="4" y1="15" x2="12" y2="18" />
        </svg>
      );
    case 20: // Icosaedro (Triângulo central sagrado com vértices em estrela)
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="20,3 36,11 36,29 20,37 4,29 4,11" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <polygon points="20,10 32,26 8,26" strokeLinejoin="round" />
          <line x1="20" y1="3" x2="20" y2="10" />
          <line x1="36" y1="11" x2="20" y2="10" />
          <line x1="4" y1="11" x2="20" y2="10" />
          <line x1="36" y1="11" x2="32" y2="26" />
          <line x1="4" y1="11" x2="8" y2="26" />
          <line x1="36" y1="29" x2="32" y2="26" />
          <line x1="4" y1="29" x2="8" y2="26" />
          <line x1="20" y1="37" x2="32" y2="26" />
          <line x1="20" y1="37" x2="8" y2="26" />
        </svg>
      );
    case 100: // Dado Percentil (Dois decaedros sobrepostos com símbolo %)
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          {/* Primeiro dado ao fundo */}
          <polygon points="17,6 29,15 17,32 5,15" strokeLinejoin="round" fill="currentColor" fillOpacity="0.08" strokeOpacity="0.6" />
          {/* Segundo dado em destaque na frente */}
          <polygon points="31,8 39,18 31,34 23,18" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
          <line x1="31" y1="8" x2="31" y2="34" />
          <line x1="17" y1="6" x2="17" y2="24" />
          <text x="31" y="32" fill="currentColor" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="monospace" stroke="none">%</text>
          <text x="17" y="30" fill="currentColor" fontSize="7" fontWeight="900" textAnchor="middle" fontFamily="monospace" stroke="none">00</text>
        </svg>
      );
    default:
      return null;
  }
}

export const DICE_CONFIG = [
  { sides: 4, label: "D4", subtitle: "Tetraedro" },
  { sides: 6, label: "D6", subtitle: "Hexaedro" },
  { sides: 8, label: "D8", subtitle: "Octaedro" },
  { sides: 10, label: "D10", subtitle: "Decaedro" },
  { sides: 12, label: "D12", subtitle: "Dodecaedro" },
  { sides: 20, label: "D20", subtitle: "Icosaedro" },
  { sides: 100, label: "D%", subtitle: "Percentil" },
];

export function QuickDiceSection({
  quickDiceQty,
  setQuickDiceQty,
  onRoll,
  lastRoll,
  isRlMode = false,
}: QuickDiceSectionProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      {/* VISOR DE RESULTADO DO DADO (SE HOUVER ROLAGEM RECENTE) */}
      {lastRoll && (
        <div
          className={`mb-4 sm:mb-5 border rounded-none p-3.5 sm:p-4 relative overflow-hidden transition-all ${
            isRlMode
              ? "bg-gradient-to-b from-[#1b122e] via-[#140c24] to-[#0c0817] border-purple-500/35 shadow-[0_8px_30px_rgba(168,85,247,0.25)]"
              : "bg-gradient-to-b from-[#18181f] to-[#0f0f13] border-[var(--op-border)] shadow-[0_6px_25px_rgba(0,0,0,0.8)]"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[10px] font-mono uppercase tracking-widest border-b pb-2 mb-2 ${
              isRlMode ? "border-purple-500/25 text-[#d8b4fe]/80" : "border-[var(--op-border)] text-[var(--op-text-muted)]"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[var(--op-white)] font-bold">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRlMode
                    ? "bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
                    : "bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24]"
                }`}
              />
              RESULTADO
            </span>
            <span
              className={`font-bold tracking-wider ${
                isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"
              }`}
            >
              {lastRoll.formula}
            </span>
          </div>

          <div className="text-center py-1">
            <div
              className={`text-5xl sm:text-6xl font-black text-white font-mono tracking-tight select-none ${
                isRlMode
                  ? "drop-shadow-[0_0_20px_rgba(192,132,252,0.9)]"
                  : "drop-shadow-[0_0_20px_rgba(184,29,36,0.8)]"
              }`}
            >
              {lastRoll.result}
            </div>
            {lastRoll.critical === "crit" && (
              <div className="inline-block mt-1.5 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 rounded-full animate-bounce">
                ★ SUCESSO CRÍTICO (20) ★
              </div>
            )}
            {lastRoll.critical === "fumble" && (
              <div
                className={`inline-block mt-1.5 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border ${
                  isRlMode
                    ? "bg-purple-950/60 text-purple-300 border-purple-500/50"
                    : "bg-red-900/40 text-red-400 border-red-500/50"
                }`}
              >
                ☠ DESASTRE CRÍTICO (1) ☠
              </div>
            )}
            <div
              className={`text-xs font-mono mt-1.5 py-1.5 px-3 rounded-none border inline-block max-w-full break-words ${
                isRlMode
                  ? "bg-[#0e0818] border-purple-900/40 text-[#d8b4fe]"
                  : "bg-[#0a0a0d] border-[#24242c] text-[var(--op-text-secondary)]"
              }`}
            >
              {lastRoll.details}
            </div>
          </div>
        </div>
      )}

      {/* CONTAINER DOS DADOS RÁPIDOS */}
      <div
        className={`border rounded-none p-3.5 sm:p-5 shadow-lg transition-colors ${
          isRlMode
            ? "bg-gradient-to-b from-[#151224] to-[#0c0a14] border-purple-500/30"
            : "bg-[var(--op-panel)] border-[var(--op-border)]"
        }`}
      >
        {/* CABEÇALHO */}
        <div
          className={`pb-3 mb-3 sm:pb-3.5 sm:mb-3.5 border-b ${
            isRlMode ? "border-purple-500/25" : "border-[var(--op-border)]"
          }`}
        >
          <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[var(--op-white)] flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-none ${
                isRlMode
                  ? "bg-[#a855f7] shadow-[0_0_8px_#a855f7]"
                  : "bg-[var(--op-red)] shadow-[0_0_6px_#8f171c]"
              }`}
            />
            {isRlMode ? "DADOS RÁPIDOS • REAL L" : "DADOS RÁPIDOS"}
          </h2>
          <p
            className={`text-[10px] sm:text-[11px] font-mono mt-0.5 ${
              isRlMode ? "text-purple-300/70" : "text-[var(--op-text-muted)]"
            }`}
          >
            {isRlMode
              ? "Geometria balística e probabilidade calculada"
              : "Formas geométricas sagradas de invocação"}
          </p>
        </div>

        {/* GRADE DOS DADOS */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-2.5 md:gap-3">
          {DICE_CONFIG.map((die, idx) => {
            const formula = `${quickDiceQty}d${die.sides}`;
            const isPercentile = idx === 6;
            return (
              <button
                key={die.sides}
                type="button"
                onClick={() => onRoll(formula)}
                className={`group relative flex flex-col items-center justify-between p-2 sm:p-3 md:p-3.5 rounded-none border transition-all duration-200 active:scale-95 cursor-pointer overflow-hidden touch-manipulation min-h-[78px] sm:min-h-[88px] ${
                  isPercentile ? "col-span-2 sm:col-span-1 md:col-span-1" : "col-span-1"
                } ${
                  isRlMode
                    ? "bg-gradient-to-b from-[#1b152d] to-[#110d1c] border-purple-500/25 hover:border-[#c084fc] hover:shadow-[0_0_18px_rgba(168,85,247,0.35)]"
                    : "bg-gradient-to-b from-[#1d1d25] to-[#121217] border-[var(--op-border)] hover:border-[var(--op-red-bright)] hover:shadow-[0_0_16px_rgba(184,29,36,0.35)]"
                }`}
              >
                {/* Efeito sutil de brilho superior */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-colors ${
                    isRlMode ? "group-hover:via-[#c084fc]/70" : "group-hover:via-[var(--op-red-bright)]/60"
                  }`}
                />

                {/* ÍCONE COM A FORMA GEOMÉTRICA */}
                <div
                  className={`transition-all duration-200 my-0.5 sm:my-1 ${
                    isRlMode
                      ? "text-purple-300 group-hover:text-purple-100 group-hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.7)]"
                      : "text-[var(--op-text-secondary)] group-hover:text-[var(--op-red-bright)] group-hover:drop-shadow-[0_0_8px_rgba(184,29,36,0.6)]"
                  }`}
                >
                  <DieShape sides={die.sides} className="w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12" />
                </div>

                {/* IDENTIFICADOR DO DADO */}
                <div className="text-center mt-1 w-full">
                  <div
                    className={`font-mono font-black text-xs sm:text-sm text-white transition-colors leading-tight ${
                      isRlMode ? "group-hover:text-[#c084fc]" : "group-hover:text-[var(--op-red-bright)]"
                    }`}
                  >
                    {die.label}
                  </div>
                  <div
                    className={`text-[8px] sm:text-[9px] font-mono transition-colors leading-tight ${
                      isRlMode ? "text-purple-300/60 group-hover:text-purple-200" : "text-[var(--op-text-muted)] group-hover:text-[#ccc]"
                    }`}
                  >
                    {formula}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* PAINEL DE MULTIPLICADOR / QUANTIDADE DE DADOS */}
        <div
          className={`mt-3.5 sm:mt-4 pt-3 sm:pt-3.5 border-t ${
            isRlMode ? "border-purple-500/25" : "border-[var(--op-border)]"
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-none p-3 sm:p-4 ${
              isRlMode
                ? "bg-gradient-to-r from-[#1b102e] via-[#2d1548] to-[#1b102e] border border-purple-500/40 shadow-[0_4px_22px_rgba(147,51,234,0.35),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                : "bg-gradient-to-r from-[#24080a] via-[#380e12] to-[#24080a] border border-[#7a181e] shadow-[0_4px_20px_rgba(143,23,28,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]"
            }`}
          >
            {/* Brilho de ambientação */}
            <div
              className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-16 blur-2xl pointer-events-none ${
                isRlMode ? "bg-[#a855f7]/25" : "bg-[#b81d24]/20"
              }`}
            />

            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Lado Esquerdo: Identificação e Stepper Rápido */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
                <div>
                  <div
                    className={`text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] flex items-center gap-1.5 ${
                      isRlMode ? "text-[#d8b4fe]" : "text-[#ff8085]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        isRlMode
                          ? "bg-[#c084fc] shadow-[0_0_6px_#c084fc]"
                          : "bg-[#ff3b45] shadow-[0_0_6px_#ff3b45]"
                      }`}
                    />
                    QUANTIDADE DE DADOS
                  </div>
                  <div
                    className={`text-[11px] sm:text-xs font-mono mt-0.5 ${
                      isRlMode ? "text-[#e9d5ff]" : "text-[#e5b3b6]"
                    }`}
                  >
                    Multiplicador:{" "}
                    <strong className="text-white text-sm font-black tracking-wide">
                      {quickDiceQty}x
                    </strong>{" "}
                    {quickDiceQty === 1 ? "dado" : "dados"}
                  </div>
                </div>

                {/* Controles de incremento / decremento rápido */}
                <div
                  className={`flex items-center gap-1 rounded-none p-1 shadow-inner shrink-0 border ${
                    isRlMode
                      ? "bg-[#130b20] border-purple-600/40"
                      : "bg-[#170507] border-[#6b1419]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setQuickDiceQty(Math.max(1, quickDiceQty - 1))}
                    disabled={quickDiceQty <= 1}
                    className={`w-10 h-10 sm:w-8 sm:h-8 rounded-none flex items-center justify-center font-mono font-black text-base sm:text-sm text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer touch-manipulation select-none ${
                      isRlMode
                        ? "bg-[#281342] hover:bg-[#3b1c60]"
                        : "bg-[#300a0d] hover:bg-[#521016]"
                    }`}
                    title="Diminuir quantidade (-1)"
                  >
                    -
                  </button>
                  <span className="w-7 sm:w-8 text-center font-mono font-black text-base sm:text-sm text-white select-none">
                    {quickDiceQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickDiceQty(Math.min(20, quickDiceQty + 1))}
                    disabled={quickDiceQty >= 20}
                    className={`w-10 h-10 sm:w-8 sm:h-8 rounded-none flex items-center justify-center font-mono font-black text-base sm:text-sm text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer touch-manipulation select-none ${
                      isRlMode
                        ? "bg-[#581c87] hover:bg-[#7e22ce] shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                        : "bg-[#521016] hover:bg-[#7a181e] shadow-[0_0_8px_rgba(184,29,36,0.5)]"
                    }`}
                    title="Aumentar quantidade (+1)"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Lado Direito: Pílulas de Seleção Rápida */}
              <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center justify-center sm:justify-end gap-1.5 w-full sm:w-auto">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((qty) => {
                  const isActive = quickDiceQty === qty;
                  return (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuickDiceQty(qty)}
                      className={`h-9 sm:h-8 px-2 sm:px-2.5 rounded-none text-xs font-mono font-bold transition-all duration-150 cursor-pointer flex items-center justify-center touch-manipulation select-none ${
                        isRlMode
                          ? isActive
                            ? "bg-gradient-to-b from-[#c084fc] to-[#7e22ce] text-white shadow-[0_0_14px_rgba(192,132,252,0.8)] border border-[#e9d5ff] scale-105"
                            : "bg-[#180f2b]/80 hover:bg-[#2e174e] text-[#d8b4fe] hover:text-white border border-purple-500/30"
                          : isActive
                          ? "bg-gradient-to-b from-[#ff3b45] to-[#b81d24] text-white shadow-[0_0_12px_rgba(255,59,69,0.8)] border border-[#ff8085] scale-105"
                          : "bg-[#1f0709]/80 hover:bg-[#3d0e13] text-[#f2c2c5] hover:text-white border border-[#521016]"
                      }`}
                    >
                      {qty}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
