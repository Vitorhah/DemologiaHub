import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, Tag, X } from "lucide-react";
import type { CatalogRitualOption } from "../types/masterCreatures";
import {
  RITUAL_AFFILIATIONS,
  RITUAL_AFFILIATION_LIST,
  type RitualAffiliationId,
} from "../utils/rituals";
import {
  parseCreatureRichText,
  type RichTextInlineToken,
} from "../utils/creatureRichText";
import { RitualAffiliationTag } from "./RitualsSection";

export interface CreatureRichTextProps {
  text: string;
  emptyText?: string;
  ritualCatalog?: CatalogRitualOption[];
  className?: string;
}

const AffiliationDetailModal: React.FC<{
  affiliationId: RitualAffiliationId;
  ritualCatalog?: CatalogRitualOption[];
  onClose: () => void;
}> = ({ affiliationId, ritualCatalog = [], onClose }) => {
  const def = RITUAL_AFFILIATIONS[affiliationId];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matchingRituals = useMemo(
    () =>
      ritualCatalog
        .filter((opt) => opt.ritual.affiliations.includes(affiliationId))
        .slice(0, 8),
    [ritualCatalog, affiliationId],
  );

  if (!def || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[380] bg-black/75 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da afiliação ${def.label}`}
      data-testid="affiliation-detail-popover"
    >
      <div
        className="w-full sm:max-w-md bg-[#0a0a0f] border border-[#282836] border-t-2 rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.92)] font-mono overflow-hidden"
        style={{ borderTopColor: def.borderColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#0f0f17] border-b border-[#1f1f2b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Tag size={14} className="text-[var(--op-red-bright)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.2em] text-[#7c7d8e]">
                Afiliação Registrada · Demologia
              </div>
              <div className="mt-1 flex items-center gap-2">
                <RitualAffiliationTag affiliationId={affiliationId} />
                <span className="text-[10px] text-[#8d8e9e] uppercase">
                  ID: {def.id}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes da afiliação"
            className="min-w-[38px] min-h-[38px] bg-[#151520] hover:bg-[#1e1e2c] border border-[#282836] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="bg-[#0e0e14] border border-[#1e1e2a] p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7e8090]">
                Sintaxe de Menção
              </div>
              <div className="text-xs font-bold text-white mt-0.5">
                #({def.label})
              </div>
            </div>
            <div
              className="w-7 h-7 border shrink-0"
              style={{
                background: def.background,
                borderColor: def.borderColor,
              }}
              aria-hidden="true"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#7e8090] flex items-center gap-1.5">
              <Flame size={11} className="text-[var(--op-red-bright)]" />
              <span>
                Rituais cadastrados com {def.label} ({matchingRituals.length})
              </span>
            </div>

            {matchingRituals.length === 0 ? (
              <p className="text-[11px] text-[#787989] bg-[#0e0e14] border border-dashed border-[#242432] p-2.5">
                Nenhum ritual cadastrado na Biblioteca ou nas fichas conectadas utiliza esta afiliação no momento.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                {matchingRituals.map((opt) => (
                  <div
                    key={opt.key}
                    className="px-2.5 py-1.5 bg-[#101018] border border-[#222230] flex items-center justify-between gap-2"
                  >
                    <span className="text-[11px] text-white font-bold truncate">
                      {opt.ritual.name || "Ritual sem nome"}
                    </span>
                    <span className="text-[9px] uppercase text-[#8a8b9c] shrink-0">
                      NV {opt.ritual.level} · {opt.sourceLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

function renderInlineTokens(
  tokens: RichTextInlineToken[],
  keyPrefix: string,
  onSelectAffiliation: (id: RitualAffiliationId) => void,
): React.ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}_${index}`;
    switch (token.type) {
      case "text":
        return <React.Fragment key={key}>{token.value}</React.Fragment>;
      case "bold":
        return (
          <strong key={key} className="font-bold text-white">
            {renderInlineTokens(token.children, `${key}_b`, onSelectAffiliation)}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic text-[#dde0ec]">
            {renderInlineTokens(token.children, `${key}_i`, onSelectAffiliation)}
          </em>
        );
      case "affiliation":
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAffiliation(token.affiliationId);
            }}
            title={`Ver detalhes da afiliação ${RITUAL_AFFILIATIONS[token.affiliationId]?.label || token.affiliationId}`}
            data-testid={`rich-affiliation-mention-${token.affiliationId}`}
            className="inline-flex items-center align-baseline mx-0.5 hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
          >
            <RitualAffiliationTag affiliationId={token.affiliationId} compact />
          </button>
        );
      default:
        return null;
    }
  });
}

export const CreatureRichText: React.FC<CreatureRichTextProps> = React.memo(
  function CreatureRichText({
    text,
    emptyText = "Sem conteúdo registrado.",
    ritualCatalog,
    className = "",
  }) {
    const [selectedAffiliation, setSelectedAffiliation] =
      useState<RitualAffiliationId | null>(null);

    const blocks = useMemo(() => parseCreatureRichText(text || ""), [text]);
    const hasVisibleContent = useMemo(
      () => blocks.some((b) => b.type !== "empty"),
      [blocks],
    );

    if (!hasVisibleContent) {
      return (
        <p className={`text-xs text-[#6f7080] italic ${className}`}>
          {emptyText}
        </p>
      );
    }

    return (
      <>
        <div
          className={`space-y-1.5 text-xs sm:text-[13px] text-[#c8c9d6] leading-relaxed break-words ${className}`}
          data-testid="creature-rich-text"
        >
          {blocks.map((lineBlock, idx) => {
            if (lineBlock.type === "divider") {
              return (
                <hr
                  key={`div_${idx}`}
                  data-testid="creature-rich-divider"
                  className="my-2.5 border-0 border-t border-[#2d2d3d]"
                />
              );
            }
            if (lineBlock.type === "empty") {
              return <div key={`empty_${idx}`} className="h-1.5" aria-hidden="true" />;
            }
            return (
              <p key={`p_${idx}`} className="leading-relaxed">
                {renderInlineTokens(
                  lineBlock.tokens,
                  `p_${idx}`,
                  setSelectedAffiliation,
                )}
              </p>
            );
          })}
        </div>

        {selectedAffiliation && (
          <AffiliationDetailModal
            affiliationId={selectedAffiliation}
            ritualCatalog={ritualCatalog}
            onClose={() => setSelectedAffiliation(null)}
          />
        )}
      </>
    );
  },
);

export interface CreatureRichTextQuickBarProps {
  onInsertSnippet: (snippet: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export const CreatureRichTextQuickBar: React.FC<CreatureRichTextQuickBarProps> =
  React.memo(function CreatureRichTextQuickBar({
    onInsertSnippet,
    showPreview,
    onTogglePreview,
  }) {
    const [showAffiliationMenu, setShowAffiliationMenu] = useState(false);

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-[#0e0e16] border border-[#222230] px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onInsertSnippet("**texto**")}
              title="Inserir negrito (**texto**)"
              className="min-h-[30px] px-2 bg-[#151520] hover:bg-[#1d1d2b] border border-[#2a2a38] text-[10px] font-bold text-white cursor-pointer touch-manipulation"
            >
              **B**
            </button>
            <button
              type="button"
              onClick={() => onInsertSnippet("^^texto^^")}
              title="Inserir itálico (^^texto^^)"
              className="min-h-[30px] px-2 bg-[#151520] hover:bg-[#1d1d2b] border border-[#2a2a38] text-[10px] italic text-[#d4d5e2] cursor-pointer touch-manipulation"
            >
              ^^I^^
            </button>
            <button
              type="button"
              onClick={() => onInsertSnippet("\n---\n")}
              title="Inserir linha divisória (---)"
              className="min-h-[30px] px-2 bg-[#151520] hover:bg-[#1d1d2b] border border-[#2a2a38] text-[10px] text-[#b4b5c2] cursor-pointer touch-manipulation"
            >
              ---
            </button>
            <button
              type="button"
              onClick={() => setShowAffiliationMenu((p) => !p)}
              title="Inserir menção de Afiliação #(Nome)"
              className={`min-h-[30px] px-2 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation inline-flex items-center gap-1 ${
                showAffiliationMenu
                  ? "bg-[#1a0b0e] border-[#8f171c] text-white font-bold"
                  : "bg-[#151520] hover:bg-[#1d1d2b] border-[#2a2a38] text-[#b4b5c2]"
              }`}
            >
              <Tag size={10} />
              <span>#(Afiliação)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onTogglePreview}
            className={`min-h-[30px] px-2.5 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation ${
              showPreview
                ? "bg-[#190a0d] border-[#8f171c] text-white font-bold"
                : "bg-[#14141e] hover:bg-[#1d1d2b] border-[#282836] text-[#9b9caa] hover:text-white"
            }`}
          >
            {showPreview ? "Editar Texto" : "Prévia"}
          </button>
        </div>

        {showAffiliationMenu && (
          <div className="p-2 bg-[#0b0b12] border border-[#242434] flex flex-wrap gap-1.5">
            {RITUAL_AFFILIATION_LIST.map((aff) => (
              <button
                key={aff.id}
                type="button"
                onClick={() => {
                  onInsertSnippet(`#(${aff.label})`);
                  setShowAffiliationMenu(false);
                }}
                className="cursor-pointer hover:brightness-110 transition-transform active:scale-95"
                title={`Inserir #(${aff.label})`}
              >
                <RitualAffiliationTag affiliationId={aff.id} compact />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  });
