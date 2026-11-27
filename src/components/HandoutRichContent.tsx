import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Edit3, Tag, X } from "lucide-react";
import {
  MasterNoteHeadingLevel,
  parseMasterNoteContent,
} from "../utils/masterNotes";
import {
  HandoutReadingSurface,
  applyHandoutInlineFormat,
} from "../utils/handoutRichText";
import {
  getRitualAffiliationDefinition,
  type RitualAffiliationId,
} from "../utils/rituals";
import { useRegisteredAffiliations } from "../services/useRegisteredAffiliations";
import { renderRichInlineTokens } from "./CreatureRichText";
import { RitualAffiliationTag } from "./RitualsSection";

const PAPER_HEADING_CLASSES: Record<MasterNoteHeadingLevel, string> = {
  1: "text-xl sm:text-2xl font-black text-[#181310] uppercase tracking-wider border-b-2 border-[#8f171c] pb-1.5 pt-2 leading-tight [text-wrap:balance]",
  2: "text-lg sm:text-xl font-bold text-[#221c17] uppercase tracking-wide border-b border-[#c2b6a2] pb-1 pt-2 leading-snug [text-wrap:balance]",
  3: "text-base sm:text-lg font-bold text-[#8f171c] tracking-wide pt-1.5 leading-snug",
  4: "text-sm sm:text-base font-bold text-[#2a241e] pt-1 leading-snug",
  5: "text-xs sm:text-sm font-bold uppercase tracking-wider text-[#463d34] pt-1 leading-snug",
  6: "text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#665c50] pt-1 leading-snug",
};

const DARK_HEADING_CLASSES: Record<MasterNoteHeadingLevel, string> = {
  1: "text-xl sm:text-2xl font-black text-white uppercase tracking-wider border-b-2 border-[var(--op-red)] pb-1.5 pt-2 leading-tight [text-wrap:balance]",
  2: "text-lg sm:text-xl font-bold text-[#f3f4f8] uppercase tracking-wide border-b border-[#262636] pb-1 pt-2 leading-snug [text-wrap:balance]",
  3: "text-base sm:text-lg font-bold text-[#ff8a90] tracking-wide pt-1.5 leading-snug",
  4: "text-sm sm:text-base font-bold text-[#e2e3ee] pt-1 leading-snug",
  5: "text-xs sm:text-sm font-bold uppercase tracking-wider text-[#b8b9c8] pt-1 leading-snug",
  6: "text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#8d8ea0] pt-1 leading-snug",
};

const HandoutAffiliationPopover: React.FC<{
  affiliationId: RitualAffiliationId;
  onClose: () => void;
}> = ({ affiliationId, onClose }) => {
  useRegisteredAffiliations();
  const def = getRitualAffiliationDefinition(affiliationId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!def || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] bg-black/75 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da afiliação ${def.label}`}
    >
      <div
        className="w-full sm:max-w-sm bg-[#0a0a0f] border border-[#282836] border-t-2 rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.92)] font-mono overflow-hidden"
        style={{ borderTopColor: def.borderColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#0f0f17] border-b border-[#1f1f2b] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Tag size={14} className="text-[var(--op-red-bright)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#848698]">
                Afiliação Citada no Documento
              </div>
              <div className="mt-1">
                <RitualAffiliationTag affiliationId={affiliationId} />
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

        <div className="p-4 text-xs">
          <div className="bg-[#0e0e14] border border-[#1e1e2a] p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7e8090]">
                Referência de Registro
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
        </div>
      </div>
    </div>,
    document.body
  );
};

export interface HandoutRichContentProps {
  text: string;
  surface?: HandoutReadingSurface;
  emptyText?: string;
  interactiveAffiliations?: boolean;
  className?: string;
}

/**
 * Renderizador rico de Handouts com paridade total com Fichas de Criaturas e Anotações do Mestre:
 * suporta #h1..#h6, **negrito**, ^^itálico^^, --- (divisória) e #(Afiliação) (oficiais e personalizadas).
 */
export const HandoutRichContent: React.FC<HandoutRichContentProps> = React.memo(
  function HandoutRichContent({
    text,
    surface = "dark",
    emptyText = "",
    interactiveAffiliations = true,
    className = "",
  }) {
    const [selectedAffiliation, setSelectedAffiliation] =
      useState<RitualAffiliationId | null>(null);
    const registeredAffiliations = useRegisteredAffiliations();

    const blocks = useMemo(
      () => parseMasterNoteContent(text || ""),
      [text, registeredAffiliations]
    );

    const hasContent = useMemo(
      () => blocks.some((b) => b.type !== "empty"),
      [blocks]
    );

    if (!hasContent) {
      if (!emptyText) return null;
      return (
        <p
          className={`text-xs italic ${
            surface === "paper" ? "text-[#6d6457]" : "text-[#787989]"
          } ${className}`}
        >
          {emptyText}
        </p>
      );
    }

    const isPaper = surface === "paper";
    const tone = isPaper ? "light" : "dark";
    const headingClasses = isPaper ? PAPER_HEADING_CLASSES : DARK_HEADING_CLASSES;
    const bodyTextClass = isPaper ? "text-[#241f1a]" : "text-[#dcdee8]";
    const dividerClass = isPaper
      ? "my-3.5 border-0 border-t border-[#bfb39d]"
      : "my-3.5 border-0 border-t border-[#2b2b3b]";

    return (
      <>
        <div
          className={`space-y-2 text-[14px] sm:text-[15px] leading-[1.75] break-words select-text ${bodyTextClass} ${className}`}
          data-testid="handout-rich-content"
        >
          {blocks.map((block, idx) => {
            if (block.type === "divider") {
              return (
                <hr
                  key={`ho_div_${idx}`}
                  data-testid="handout-rich-divider"
                  className={dividerClass}
                />
              );
            }

            if (block.type === "empty") {
              return <div key={`ho_emp_${idx}`} className="h-2" aria-hidden="true" />;
            }

            if (block.type === "heading") {
              const HeadingTag = `h${block.level}` as
                | "h1"
                | "h2"
                | "h3"
                | "h4"
                | "h5"
                | "h6";
              return (
                <HeadingTag
                  key={`ho_h_${idx}`}
                  className={headingClasses[block.level]}
                >
                  {renderRichInlineTokens(block.tokens, `ho_h_${idx}`, {
                    tone: "inherit",
                    interactiveAffiliations,
                    onSelectAffiliation: interactiveAffiliations
                      ? setSelectedAffiliation
                      : undefined,
                  })}
                </HeadingTag>
              );
            }

            return (
              <p key={`ho_p_${idx}`} className="m-0 leading-[1.75]">
                {renderRichInlineTokens(block.tokens, `ho_p_${idx}`, {
                  tone,
                  interactiveAffiliations,
                  onSelectAffiliation: interactiveAffiliations
                    ? setSelectedAffiliation
                    : undefined,
                })}
              </p>
            );
          })}
        </div>

        {interactiveAffiliations && selectedAffiliation && (
          <HandoutAffiliationPopover
            affiliationId={selectedAffiliation}
            onClose={() => setSelectedAffiliation(null)}
          />
        )}
      </>
    );
  }
);

export interface HandoutRichTextToolbarProps {
  value: string;
  onChange: (nextValue: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  showPreview: boolean;
  onTogglePreview: () => void;
  showHeadings?: boolean;
  label?: string;
}

const TOOLBAR_HEADINGS: readonly MasterNoteHeadingLevel[] = [1, 2, 3];

export const HandoutRichTextToolbar: React.FC<HandoutRichTextToolbarProps> = ({
  value,
  onChange,
  textareaRef,
  showPreview,
  onTogglePreview,
  showHeadings = true,
  label,
}) => {
  const [showAffiliationMenu, setShowAffiliationMenu] = useState(false);
  const registeredAffiliations = useRegisteredAffiliations();

  const applyFormat = (
    format:
      | { kind: "bold" }
      | { kind: "italic" }
      | { kind: "divider" }
      | { kind: "affiliation"; label: string }
      | { kind: "heading"; level: MasterNoteHeadingLevel }
  ) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const res = applyHandoutInlineFormat(value, start, end, format);
    onChange(res.content);
    if (el) {
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(res.nextSelectionStart, res.nextSelectionEnd);
      });
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-[#0c0c12] border border-[#222230] px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {label && (
            <span className="text-[10px] uppercase tracking-wider text-[#7e8090] mr-1">
              {label}
            </span>
          )}

          {showHeadings &&
            TOOLBAR_HEADINGS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => applyFormat({ kind: "heading", level: lvl })}
                title={`Alternar título H${lvl} (#h${lvl})`}
                className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2a2a38] text-[10px] font-bold text-[#d4d5e2] hover:text-white cursor-pointer touch-manipulation whitespace-nowrap"
              >
                H{lvl}
              </button>
            ))}

          <button
            type="button"
            onClick={() => applyFormat({ kind: "bold" })}
            title="Negrito (**texto**)"
            className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2a2a38] text-[10px] font-bold text-white cursor-pointer touch-manipulation whitespace-nowrap"
          >
            **B**
          </button>

          <button
            type="button"
            onClick={() => applyFormat({ kind: "italic" })}
            title="Itálico (^^texto^^)"
            className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2a2a38] text-[10px] italic text-[#d4d5e2] cursor-pointer touch-manipulation whitespace-nowrap"
          >
            ^^I^^
          </button>

          <button
            type="button"
            onClick={() => applyFormat({ kind: "divider" })}
            title="Linha divisória (---)"
            className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2a2a38] text-[10px] text-[#b4b5c2] hover:text-white cursor-pointer touch-manipulation whitespace-nowrap"
          >
            ---
          </button>

          <button
            type="button"
            onClick={() => setShowAffiliationMenu((p) => !p)}
            title="Inserir menção de Afiliação #(Nome)"
            className={`min-h-[32px] px-2 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation inline-flex items-center gap-1 whitespace-nowrap ${
              showAffiliationMenu
                ? "bg-[#1e0b0f] border-[var(--op-red-bright)] text-white font-bold"
                : "bg-[#14141e] hover:bg-[#1e1e2c] border-[#2a2a38] text-[#b4b5c2] hover:text-white"
            }`}
          >
            <Tag size={10} />
            <span>#(Afiliação)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onTogglePreview}
          className={`min-h-[32px] px-2.5 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation inline-flex items-center gap-1.5 whitespace-nowrap ${
            showPreview
              ? "bg-[#1e0b0f] border-[var(--op-red-bright)] text-white font-bold"
              : "bg-[#14141e] hover:bg-[#1e1e2c] border-[#282836] text-[#9b9caa] hover:text-white"
          }`}
        >
          {showPreview ? <Edit3 size={11} /> : <Eye size={11} />}
          <span>{showPreview ? "Editar" : "Prévia"}</span>
        </button>
      </div>

      {showAffiliationMenu && (
        <div className="p-2 bg-[#0a0a10] border border-[#242434] flex flex-wrap gap-1.5">
          {registeredAffiliations.map((aff) => (
            <button
              key={aff.id}
              type="button"
              onClick={() => {
                applyFormat({ kind: "affiliation", label: aff.label });
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
};
