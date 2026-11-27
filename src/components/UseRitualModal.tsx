import React from "react";
import { X } from "lucide-react";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";
import { RitualAffiliationTag } from "./RitualsSection";
import { CreatureRichInlineText, CreatureRichText } from "./CreatureRichText";
import {
  RITUAL_TEST_FORMULA,
  RitualItem,
  RitualTestOutcome,
} from "../utils/rituals";
import { sanitizeRollHistoryHtml } from "../utils/security";

interface UseRitualModalProps {
  ritual: RitualItem;
  history: string[];
  lastOutcome: RitualTestOutcome | null;
  onCastTest: (ritual: RitualItem) => void;
  onRollDamage: (ritual: RitualItem) => void;
  onClose: () => void;
}

export const UseRitualModal: React.FC<UseRitualModalProps> = React.memo(
  function UseRitualModal({
    ritual,
    history,
    lastOutcome,
    onCastTest,
    onRollDamage,
    onClose,
  }) {
  return (
    <MotionModalBackdrop
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <MotionSheetPanel
        data-testid="use-ritual-modal"
        className="bg-[#0a0a0e]/95 border-t sm:border border-[#2c2c38] rounded-none w-full max-w-sm flex flex-col p-4 sm:p-5 gap-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center -mt-1 pb-1">
          <div className="w-10 h-1 bg-[#32323e] rounded-none" />
        </div>

        <div className="flex justify-between items-start gap-2 border-b border-[#1f1f29] pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider bg-[#15151e] border border-[#8f171c] text-[#ededed] rounded-none">
                NV {ritual.level}
              </span>
              <h3 className="font-bold text-blood-red uppercase tracking-widest truncate">
                <CreatureRichInlineText
                  text={ritual.name || "Novo Ritual"}
                  tone="inherit"
                />
              </h3>
            </div>
            {ritual.affiliations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ritual.affiliations.map((affId) => (
                  <RitualAffiliationTag
                    key={affId}
                    affiliationId={affId}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white cursor-pointer touch-manipulation shrink-0"
            aria-label="Fechar modal do ritual"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-3 py-2 bg-[#111118] border border-[#242430] font-mono text-[11px] flex items-center justify-between gap-2 tabular-nums">
          <span className="text-[#a1a1aa]">
            TESTE: <strong className="text-white">{RITUAL_TEST_FORMULA}</strong>
          </span>
          <span className="text-[#ef4444] font-bold">
            &gt; DIF {ritual.difficulty}
          </span>
        </div>

        {ritual.desc.trim() !== "" && (
          <CreatureRichText
            text={ritual.desc}
            emptyText=""
            tone="dark"
            className="!text-xs text-[#b4b5c2]"
          />
        )}

        {lastOutcome && (
          <div
            data-testid="ritual-test-outcome"
            data-success={lastOutcome.success ? "true" : "false"}
            className={`px-3 py-2 border font-mono text-xs flex items-center justify-between gap-2 tabular-nums rounded-none ${
              lastOutcome.success
                ? "bg-emerald-950/70 border-emerald-600/80 text-emerald-200"
                : "bg-[#260b0f]/90 border-[#991b1b] text-red-200"
            }`}
          >
            <span className="font-bold uppercase tracking-wider">
              {lastOutcome.success ? "SUCESSO NO RITUAL" : "FALHA NO RITUAL"}
            </span>
            <span>
              {lastOutcome.result}{" "}
              {lastOutcome.success ? ">" : "≤"} Dif. {lastOutcome.difficulty}
            </span>
          </div>
        )}

        <div className="h-44 overflow-y-auto bg-[#14141b] p-3 border border-[#1f1f29] rounded-none text-[13px] text-[#aaa] flex flex-col shadow-[inset_0_0_10px_#000]">
          {history.length > 0 ? (
            history.slice(0, 10).map((h, i) => (
              <div
                key={i}
                className="log-entry"
                dangerouslySetInnerHTML={{ __html: sanitizeRollHistoryHtml(h) }}
              />
            ))
          ) : (
            <span className="opacity-50 italic">Nenhum log de rolagem.</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="ritual-roll-test-btn"
            className="flex-1 min-h-[44px] bg-[#1a1a22] border border-[#383848] hover:bg-[#2a2a36] hover:border-gray-400 text-gray-200 hover:text-white uppercase font-bold text-xs tracking-wider rounded-none py-3 px-2 transition-colors cursor-pointer touch-manipulation"
            onClick={() => onCastTest(ritual)}
          >
            {lastOutcome ? "REPETIR TESTE" : "TESTE 2D6+OCU"}{" "}
            {ritual.cost > 0 ? `(-${ritual.cost} PE)` : "(0 PE)"}
          </button>

          {ritual.damage.trim() !== "" && (
            <button
              type="button"
              data-testid="ritual-roll-damage-btn"
              disabled={ritual.needsTest && !lastOutcome?.success}
              title={
                ritual.needsTest && !lastOutcome?.success
                  ? `Necessita sucesso no teste (${RITUAL_TEST_FORMULA} > Dif. ${ritual.difficulty}) para liberar o dano.`
                  : "Rolar dano/efeito do ritual"
              }
              className="flex-1 min-h-[44px] bg-gradient-to-r from-[#900] to-[var(--blood-red)] text-white hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed uppercase font-bold text-xs tracking-wider rounded-none py-3 px-2 transition-[filter,opacity] duration-150 border-none cursor-pointer touch-manipulation"
              onClick={() => onRollDamage(ritual)}
            >
              ROLA DANO (0 PE)
            </button>
          )}
        </div>
      </MotionSheetPanel>
    </MotionModalBackdrop>
  );
});
