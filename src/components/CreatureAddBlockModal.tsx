import React, { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  FileText,
  Flame,
  Layers,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Table2,
  User,
  X,
} from "lucide-react";
import type { CreatureBlockType } from "../types/masterCreatures";
import {
  CREATURE_BLOCK_META,
  CREATURE_BLOCK_TYPES_ORDER,
} from "../utils/creatureBlocks";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

export interface CreatureAddBlockModalProps {
  isOpen: boolean;
  presentSingletonTypes: Set<CreatureBlockType>;
  notice?: string | null;
  onSelectBlock: (type: CreatureBlockType) => void;
  onClose: () => void;
}

function getBlockIcon(type: CreatureBlockType) {
  switch (type) {
    case "profile":
      return User;
    case "status":
      return SlidersHorizontal;
    case "skills":
      return Sparkles;
    case "rituals":
      return Flame;
    case "modes":
      return Shield;
    case "text":
      return FileText;
    case "table":
      return Table2;
  }
}

export const CreatureAddBlockModal: React.FC<CreatureAddBlockModalProps> = ({
  isOpen,
  presentSingletonTypes,
  notice,
  onSelectBlock,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby="creature-add-block-modal-title"
            data-testid="creature-add-block-modal"
            className="w-full sm:max-w-xl bg-[#0c0c10]/95 border-t sm:border border-[#282834] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.9)] relative overflow-hidden max-h-[88dvh] flex flex-col font-mono"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra superior vermelha idêntica ao popup de senha do Mestre */}
            <div className="h-[2px] w-full bg-[var(--op-red)] absolute top-0 left-0" />

            {/* Alça de toque visual no mobile */}
            <div
              className="w-10 h-1 rounded-none bg-[#32323e] mx-auto mt-3 sm:hidden shrink-0"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de adicionar bloco"
              data-testid="creature-add-block-close-btn"
              className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white active:scale-95 transition-all rounded-none cursor-pointer touch-manipulation z-10"
            >
              <X size={20} />
            </button>

            <div className="p-5 sm:p-6 pb-4 flex items-center gap-3 pr-14 shrink-0 border-b border-[#1c1c26]">
              <div className="w-10 h-10 bg-[#140a0c] border border-[#3a161a] flex items-center justify-center shrink-0">
                <Layers className="text-[var(--op-red-bright)]" size={18} />
              </div>
              <div className="min-w-0">
                <h3
                  id="creature-add-block-modal-title"
                  className="text-base sm:text-lg font-bold text-white uppercase tracking-[0.14em]"
                >
                  Adicionar Bloco
                </h3>
                <p className="text-[11px] text-[#8a8a98] mt-0.5 leading-snug">
                  Selecione um módulo para inserir na ficha dinâmica
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 pt-4 overflow-y-auto space-y-3">
              {notice && (
                <div className="bg-[#1b110d] border border-amber-700/60 px-3 py-2 text-[11px] text-amber-200 flex items-center gap-2">
                  <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                  <span>{notice}</span>
                </div>
              )}

              <div
                data-testid="creature-add-block-menu"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {CREATURE_BLOCK_TYPES_ORDER.map((blockType) => {
                  const meta = CREATURE_BLOCK_META[blockType];
                  const Icon = getBlockIcon(blockType);
                  const alreadyAdded =
                    meta.singleton && presentSingletonTypes.has(blockType);

                  return (
                    <button
                      key={blockType}
                      type="button"
                      disabled={alreadyAdded}
                      data-testid={`creature-add-block-option-${blockType}`}
                      onClick={() => onSelectBlock(blockType)}
                      className={`text-left min-h-[76px] p-3.5 border transition-colors flex flex-col justify-between gap-1.5 touch-manipulation ${
                        alreadyAdded
                          ? "bg-[#0d0d13] border-[#1f1f2a] opacity-45 cursor-not-allowed"
                          : "bg-[#12121b] hover:bg-[#1b1015] active:bg-[#241218] border-[#282838] hover:border-[#8f171c] cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                          <Icon
                            size={14}
                            className="text-[var(--op-red-bright)] shrink-0"
                          />
                          <span>{meta.label}</span>
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
                            alreadyAdded
                              ? "border-[#2a2a38] text-[#7c7d8f] bg-[#0b0b10]"
                              : meta.singleton
                                ? "border-[#3a1d22] text-[#d69fa2] bg-[#160c0e]"
                                : "border-[#253042] text-[#9cb8dc] bg-[#0e141f]"
                          }`}
                        >
                          {alreadyAdded
                            ? "Na ficha"
                            : meta.singleton
                              ? "Único"
                              : "Múltiplos"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8e90a0] leading-snug">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
