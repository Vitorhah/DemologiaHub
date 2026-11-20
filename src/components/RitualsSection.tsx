import React from "react";
import { AlertTriangle, Edit2, Plus } from "lucide-react";
import { MotionAccordion } from "./MotionPrimitives";
import { RitualFormFields } from "./MasterLibraryFormFields";
import {
  RITUAL_AFFILIATIONS,
  RITUAL_TEST_FORMULA,
  RitualAffiliationId,
  RitualCapacityState,
  RitualItem,
} from "../utils/rituals";

export const RitualAffiliationTag: React.FC<{
  affiliationId: RitualAffiliationId;
  compact?: boolean;
}> = React.memo(function RitualAffiliationTag({ affiliationId, compact = false }) {
  const def = RITUAL_AFFILIATIONS[affiliationId];
  if (!def) return null;

  return (
    <span
      data-testid={`ritual-affiliation-tag-${affiliationId}`}
      className={`inline-flex items-center font-mono font-bold uppercase tracking-wider border rounded-none leading-none select-none ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
      style={{
        background: def.background,
        color: def.textColor,
        borderColor: def.borderColor,
        textShadow: def.textShadow,
      }}
    >
      {def.label}
    </span>
  );
});

interface RitualsSectionProps {
  rituals: RitualItem[];
  capacity: RitualCapacityState;
  activeRitualId: number | null;
  editingRitualId: number | null;
  onToggleRitual: (id: number) => void;
  onAddRitual: () => void;
  onUpdateRitual: (id: number, field: keyof RitualItem, value: any) => void;
  onRemoveRitual: (id: number) => void;
  onStartEdit: (id: number) => void;
  onCloseEdit: () => void;
  onOpenUseModal: (id: number) => void;
  onQuickTest: (ritual: RitualItem) => void;
  onQuickDamage: (ritual: RitualItem) => void;
}

export const RitualsSection: React.FC<RitualsSectionProps> = React.memo(
  function RitualsSection({
    rituals,
    capacity,
    activeRitualId,
    editingRitualId,
    onToggleRitual,
    onAddRitual,
    onUpdateRitual,
    onRemoveRitual,
    onStartEdit,
    onCloseEdit,
    onOpenUseModal,
    onQuickTest,
    onQuickDamage,
  }) {
  const limitFormulaHint = capacity.isOculto
    ? `Perfil Oculto ativo: INT (${capacity.intValue}) × 2 = ${capacity.limit}`
    : `Padrão: INT (${capacity.intValue}) × 1 = ${capacity.limit}`;

  return (
    <div
      className="section rituals-section"
      data-testid="rituals-section"
    >
      <div className="section-title flex-wrap">
        <span>Rituais</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span
            data-testid="rituals-counter"
            data-over-limit={capacity.isOverLimit ? "true" : "false"}
            title={`Rituais armazenados / Limite (${limitFormulaHint})`}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums border rounded-none select-none ${
              capacity.isOverLimit
                ? "bg-amber-950/80 border-amber-500/80 text-amber-300"
                : capacity.isAtLimit && capacity.limit > 0
                  ? "bg-[#1a1014] border-[#52242c] text-[#f3c6cc]"
                  : "bg-[#111118] border-[#262634] text-[#b4b5c2]"
            }`}
          >
            {capacity.isOverLimit && <AlertTriangle size={11} />}
            <span>
              {capacity.count} / {capacity.limit}
            </span>
          </span>
        </div>
      </div>

      {capacity.isOverLimit && (
        <div
          data-testid="rituals-over-limit-banner"
          className="mb-3 px-3 py-2 bg-[#1c1208]/90 border border-amber-500/75 text-amber-200 font-mono text-[11px] leading-snug flex items-start gap-2 rounded-none"
        >
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <span>
            Rituais acima do limite atual ({capacity.count}/{capacity.limit} ·{" "}
            {capacity.isOculto ? "INT × 2" : "INT × 1"}). Os rituais existentes
            foram mantidos, mas novos rituais estão bloqueados até voltar ao
            limite.
          </span>
        </div>
      )}

      <div className="skill-list">
        {rituals.length === 0 ? (
          <div className="px-3 py-4 border border-dashed border-[#262634] bg-[#0e0e14]/75 text-center font-mono text-[11px] text-[#7a7b88] uppercase tracking-wider">
            Nenhum ritual armazenado
          </div>
        ) : (
          rituals.map((ritual) => {
            const isActive = activeRitualId === ritual.id;
            const isEditing = editingRitualId === ritual.id;

            return (
              <div
                key={ritual.id}
                data-testid={`ritual-item-${ritual.id}`}
              >
                <div
                  className="paper-bar"
                  onClick={() => onToggleRitual(ritual.id)}
                >
                  <div className="skill-header gap-2">
                    <div className="skill-name-area min-w-0 flex-wrap gap-2">
                      <span
                        className="shrink-0 font-mono text-[13px] font-black uppercase tracking-wider text-[#991016] tabular-nums"
                        title={`Ritual de Nível ${ritual.level}`}
                      >
                        NV {ritual.level}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-[#a19a8c] font-mono text-xs select-none"
                      >
                        /
                      </span>
                      <span className="truncate">
                        {ritual.name || "Novo Ritual"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#524b42] tabular-nums"
                        title={`Teste ${RITUAL_TEST_FORMULA} deve ser maior que ${ritual.difficulty}`}
                      >
                        DIF {ritual.difficulty}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-[#a19a8c] font-mono text-[11px] select-none"
                      >
                        ·
                      </span>
                      <div className="skill-cost">{ritual.cost}PE</div>
                    </div>
                  </div>

                  {ritual.affiliations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {ritual.affiliations.map((affId) => (
                        <RitualAffiliationTag
                          key={affId}
                          affiliationId={affId}
                          compact
                        />
                      ))}
                    </div>
                  )}

                  <div
                    className="mt-1.5"
                    style={{
                      fontSize: "12px",
                      color: "#3f3f46",
                    }}
                  >
                    {ritual.desc || "Sem descrição"}
                  </div>
                </div>

                <MotionAccordion isOpen={isActive && !isEditing}>
                  <div
                    className="skill-details active"
                    style={{
                      display: "flex",
                      background: "#0a0a0a",
                      padding: "12px",
                      gap: "8px",
                      alignItems: "center",
                      borderTop: "none",
                      borderRadius: "0",
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`ritual-use-btn-${ritual.id}`}
                      className="min-h-[44px] bg-[#1a1a1a] border border-[#333] hover:bg-[#333] hover:border-gray-500 text-gray-300 hover:text-white uppercase font-bold text-xs tracking-wider rounded-none py-2.5 px-3 transition-colors cursor-pointer touch-manipulation"
                      style={{ flex: 1 }}
                      onClick={() => onOpenUseModal(ritual.id)}
                    >
                      CONJURAR / USAR
                    </button>
                    <button
                      type="button"
                      data-testid={`ritual-edit-btn-${ritual.id}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent hover:bg-[#1A1A1A] text-gray-400 hover:text-white p-2 rounded-none transition-colors border border-transparent hover:border-[#2a2a36] cursor-pointer touch-manipulation"
                      onClick={() => onStartEdit(ritual.id)}
                      title="Editar Ritual"
                      aria-label={`Editar ritual ${ritual.name || "Novo Ritual"}`}
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </MotionAccordion>

                <MotionAccordion isOpen={isEditing}>
                  <div
                    className="skill-details active"
                    style={{ display: "block" }}
                  >
                    <RitualFormFields
                      ritual={ritual}
                      onChange={(field, value) =>
                        onUpdateRitual(ritual.id, field, value)
                      }
                    />

                    <div className="action-btns mt-3">
                      <button
                        type="button"
                        className="btn-action test"
                        onClick={() => onQuickTest(ritual)}
                      >
                        TESTE ({RITUAL_TEST_FORMULA})
                      </button>
                      {ritual.damage.trim() !== "" && (
                        <button
                          type="button"
                          className="btn-action damage"
                          onClick={() => onQuickDamage(ritual)}
                        >
                          DANO
                        </button>
                      )}
                    </div>

                    <div
                      className="action-btns"
                      style={{ marginTop: "10px" }}
                    >
                      <button
                        type="button"
                        data-testid={`ritual-delete-btn-${ritual.id}`}
                        className="btn-action"
                        style={{ background: "#500" }}
                        onClick={() => onRemoveRitual(ritual.id)}
                      >
                        EXCLUIR
                      </button>
                      <button
                        type="button"
                        className="btn-action"
                        style={{ background: "#1A1A1A" }}
                        onClick={onCloseEdit}
                      >
                        FECHAR
                      </button>
                    </div>
                  </div>
                </MotionAccordion>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        data-testid="add-ritual-button"
        disabled={!capacity.canAdd}
        onClick={onAddRitual}
        title={
          capacity.canAdd
            ? `Adicionar novo ritual (${capacity.count}/${capacity.limit})`
            : `Limite de rituais atingido (${capacity.count}/${capacity.limit} · ${limitFormulaHint})`
        }
        className="btn-add disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-[#2a2a36] disabled:hover:text-[#9b9caa] gap-1.5"
      >
        {capacity.canAdd ? (
          <>
            <Plus size={14} />
            <span>ADICIONAR RITUAL</span>
          </>
        ) : capacity.isOverLimit ? (
          <span>
            ACIMA DO LIMITE DE RITUAIS ({capacity.count}/{capacity.limit})
          </span>
        ) : (
          <span>
            LIMITE DE RITUAIS ATINGIDO ({capacity.count}/{capacity.limit})
          </span>
        )}
      </button>
    </div>
  );
});
