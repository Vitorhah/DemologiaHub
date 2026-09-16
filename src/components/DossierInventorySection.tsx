import React, { useState } from "react";
import {
  Package,
  Plus,
  Trash2,
  Dices,
  Shield,
  Layers,
  Sparkles,
  RotateCcw,
  Check,
} from "lucide-react";

interface DossierInventorySectionProps {
  inventory: string[];
  updateInventory: (index: number, val: string) => void;
  onRollFormula?: (formula: string) => void;
  onAddSlot?: () => void;
  onRemoveSlot?: (index: number) => void;
  onClearAll?: () => void;
}

// Extrai qualquer fórmula de rolagem presente no nome do item (ex: "Faca 1d4+FOR" -> "1d4+FOR")
function extractDiceFormula(text: string): string | null {
  if (!text) return null;
  // Procura padrões como 1d20, 2d6+3, 1d8+FOR, 3d10
  const match = text.match(/\b\d+d\d+(?:\s*[+-]\s*[\w\d]+)?\b/i);
  return match ? match[0].replace(/\s+/g, "") : null;
}

export function DossierInventorySection({
  inventory,
  updateInventory,
  onRollFormula,
  onAddSlot,
  onRemoveSlot,
  onClearAll,
}: DossierInventorySectionProps) {
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const occupiedCount = inventory.filter((item) => item.trim().length > 0).length;
  const totalSlots = inventory.length;
  const percentOccupied = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0;

  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3500);
      return;
    }
    if (onClearAll) {
      onClearAll();
    } else {
      inventory.forEach((_, idx) => updateInventory(idx, ""));
    }
    setConfirmClearAll(false);
  };

  return (
    <div className="section !p-0 !border-none">
      {/* CABEÇALHO DO DOSSIÊ DE INVENTÁRIO */}
      <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-[#170c0e] via-[#14141a] to-[#0c0c10] border border-[var(--op-border)] p-3.5 sm:p-4 mb-3 shadow-lg">
        {/* Linha de acento de carga */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#b81d24] via-[#8f171c]/50 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#24080a] border border-[#7a181e] flex items-center justify-center text-[var(--op-red-bright)] shadow-[0_0_10px_rgba(184,29,36,0.35)] shrink-0">
              <Package size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[#ff8085] bg-[#380b0f] px-2 py-0.5 rounded border border-[#691419]">
                  REGISTRO DE CARGA // DOSSIÊ-INV
                </span>
                <span className="text-[10px] font-mono text-[var(--op-text-muted)] hidden sm:inline">
                  MANIFESTO DE EQUIPAMENTO & EVIDÊNCIAS
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-mono font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] text-white mt-0.5">
                INVENTÁRIO & EQUIPAMENTO
              </h2>
            </div>
          </div>

          {/* MEDIDOR DE CAPACIDADE / SLOTS OCUPADOS */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--op-border)]/50">
            <div className="flex items-center gap-2 bg-[#0d0d12] px-3 py-1.5 rounded-lg border border-[var(--op-border)]">
              <Layers size={13} className="text-[var(--op-red-bright)]" />
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--op-text-muted)] leading-none">
                  CAPACIDADE
                </div>
                <div className="text-xs font-mono font-bold text-white leading-tight">
                  <span className={percentOccupied >= 100 ? "text-[#ff8085]" : "text-white"}>
                    {occupiedCount}
                  </span>{" "}
                  / {totalSlots} <span className="text-[10px] text-[#777]">({percentOccupied}%)</span>
                </div>
              </div>
            </div>

            {onAddSlot && (
              <button
                type="button"
                onClick={onAddSlot}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-white bg-[#1a1a24] hover:bg-[#252533] border border-[var(--op-border)] hover:border-[var(--op-red-bright)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px] touch-manipulation select-none"
                title="Adicionar mais um slot de inventário"
              >
                <Plus size={14} className="text-[var(--op-red-bright)]" />
                <span className="hidden sm:inline">+ Slot</span>
              </button>
            )}

            {occupiedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px] touch-manipulation select-none ${
                  confirmClearAll
                    ? "bg-red-950 text-red-200 border border-red-500 animate-pulse"
                    : "text-[var(--op-text-muted)] hover:text-white bg-transparent hover:bg-white/5"
                }`}
                title="Limpar todos os itens do inventário"
              >
                <RotateCcw size={13} />
                <span>{confirmClearAll ? "Confirmar?" : "Limpar"}</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE CAPACIDADE DE CARGA TÁTICA */}
        <div className="mt-3 w-full bg-[#0a0a0d] h-1.5 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full transition-all duration-300 ${
              percentOccupied >= 100
                ? "bg-gradient-to-r from-[#b81d24] to-[#ff3b45] shadow-[0_0_8px_#ff3b45]"
                : percentOccupied > 60
                  ? "bg-gradient-to-r from-[#b45309] to-[#f59e0b]"
                  : "bg-gradient-to-r from-[#8f171c] to-[#b81d24]"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, percentOccupied))}%` }}
          />
        </div>
      </div>

      {/* GRADE DOS SLOTS DE INVENTÁRIO NO ESTILO DOSSIÊ
          No mobile: 1 coluna confortável com altura mínima de 44px para facilidade de toque
          No tablet/desktop: 2 colunas amplas no estilo pasta de arquivo
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
        {inventory.map((item, i) => {
          const isOccupied = item.trim().length > 0;
          const detectedFormula = extractDiceFormula(item);
          const slotNum = String(i + 1).padStart(2, "0");

          return (
            <div
              key={i}
              className={`group relative rounded-xl border transition-all duration-200 shadow-md flex flex-col justify-between overflow-hidden ${
                isOccupied
                  ? "bg-gradient-to-b from-[#171720] via-[#121217] to-[#0d0d12] border-[#383844] hover:border-[#8f171c]"
                  : "bg-gradient-to-b from-[#111116]/80 via-[#0d0d11]/70 to-[#09090c] border-[var(--op-border)]/70 hover:border-[#40404a]"
              }`}
            >
              {/* Efeito sutil de marcador dossiê no topo */}
              <div
                className={`absolute top-0 left-0 right-0 h-[1.5px] transition-colors ${
                  isOccupied
                    ? "bg-gradient-to-r from-transparent via-[var(--op-red-bright)]/70 to-transparent"
                    : "bg-transparent"
                }`}
              />

              {/* CABEÇALHO DO SLOT: ÍNDICE DO DOSSIÊ + STATUS */}
              <div className="p-2.5 pb-1.5 flex items-center justify-between gap-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-[#888] bg-[#09090d] px-2 py-0.5 rounded border border-[#222]">
                    SLOT // {slotNum}
                  </span>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 font-bold ${
                      isOccupied ? "text-[#4ade80]" : "text-[var(--op-text-muted)]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOccupied ? "bg-[#22c55e] shadow-[0_0_6px_#22c55e]" : "bg-[#444]"
                      }`}
                    />
                    {isOccupied ? "REGISTRADO" : "LIVRE"}
                  </span>
                </div>

                {/* AÇÕES RÁPIDAS DO SLOT */}
                <div className="flex items-center gap-1">
                  {isOccupied && (
                    <button
                      type="button"
                      onClick={() => updateInventory(i, "")}
                      title="Esvaziar este slot"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--op-text-muted)] hover:text-rose-400 hover:bg-rose-950/40 transition-colors touch-manipulation cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  {onRemoveSlot && inventory.length > 6 && (
                    <button
                      type="button"
                      onClick={() => onRemoveSlot(i)}
                      title="Excluir slot adicional"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--op-text-muted)] hover:text-red-400 hover:bg-white/5 transition-colors touch-manipulation cursor-pointer"
                    >
                      <span className="font-mono text-xs">×</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CORPO DO SLOT: CAMPO DE ENTRADA DO ITEM */}
              <div className="p-2.5">
                <input
                  type="text"
                  className="w-full bg-[#09090d] border border-[var(--op-border)] focus:border-[var(--op-red-bright)] focus:ring-1 focus:ring-[var(--op-red-bright)] rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-[#555] outline-none transition-all min-h-[44px]"
                  placeholder={`Vazio // Item, arma ou evidência #${slotNum}...`}
                  value={item}
                  onChange={(e) => updateInventory(i, e.target.value)}
                />

                {/* BOTÃO DE ROLAGEM SE O ITEM CONTER FÓRMULA DE DADO (ex: 2d6+2 ou 1d8+FOR) */}
                {detectedFormula && onRollFormula && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-1.5 px-2 rounded-lg bg-[#20070a] border border-[#5c1015]">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#ff8085]">
                      <Sparkles size={13} className="text-[var(--op-red-bright)]" />
                      <span>Fórmula detectada:</span>
                      <strong className="text-white font-bold">{detectedFormula}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRollFormula(detectedFormula)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#99151b] to-[#6e0f14] hover:from-[#b81d24] hover:to-[#851218] border border-[#b81d24]/60 shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer touch-manipulation"
                      title={`Rolar ${detectedFormula}`}
                    >
                      <Dices size={12} />
                      <span>Rolar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTÃO PARA ADICIONAR MAIS SLOTS DE CARGA SE NECESSÁRIO */}
      {onAddSlot && (
        <button
          type="button"
          onClick={onAddSlot}
          className="btn-add !mt-3.5 !py-2.5 flex items-center justify-center gap-2 hover:!bg-[#15151b] touch-manipulation"
        >
          <Plus size={14} className="text-[var(--op-red-bright)]" />
          <span>+ EXPANDIR CAPACIDADE DE CARGA (ADICIONAR NOVO SLOT DE DOSSIÊ)</span>
        </button>
      )}
    </div>
  );
}
