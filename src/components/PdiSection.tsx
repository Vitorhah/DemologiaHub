import React from "react";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { PdiItem, formatPdiModifierChips } from "../utils/pdi";

export interface PdiSectionProps {
  pdis: PdiItem[];
  canEdit: boolean;
  onToggle: (pdiId: string) => void;
  onAdd?: () => void;
  onEdit?: (pdi: PdiItem) => void;
  onDelete?: (pdiId: string) => void;
  compact?: boolean;
}

export function PdiSection({
  pdis,
  canEdit,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  compact = false,
}: PdiSectionProps) {
  const list = Array.isArray(pdis) ? pdis : [];
  const activeCount = list.filter((item) => item.active).length;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8f90a2]">
            {activeCount > 0
              ? `${activeCount} ativo${activeCount > 1 ? "s" : ""} de ${list.length}`
              : `${list.length} registrado${list.length !== 1 ? "s" : ""}`}
          </span>
          {canEdit && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="min-h-[34px] px-2.5 bg-[#180d10] hover:bg-[#271116] border border-[#5e151a] text-red-200 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors rounded-none"
            >
              <Plus size={12} />
              <span>Novo PDI</span>
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <div className="px-2.5 py-2 bg-[#0c0c12] border border-[#1d1d28] text-[11px] font-mono text-[#6a6b7a]">
            Nenhum PDI configurado.
          </div>
        ) : (
          <div className="space-y-1.5">
            {list.map((pdi) => {
              const chips = formatPdiModifierChips(pdi.modifiers);
              const hasDebuffOnly =
                chips.length > 0 && chips.every((c) => c.type === "debuff");

              return (
                <div
                  key={pdi.id}
                  className={`p-2 border transition-colors rounded-none ${
                    pdi.active
                      ? hasDebuffOnly
                        ? "bg-[#190c0f] border-[#7a191f]"
                        : "bg-[#0c1613] border-emerald-800/70"
                      : "bg-[#0d0d13] border-[#1f1f2b]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {pdi.name}
                      </div>
                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {chips.map((chip, idx) => (
                            <span
                              key={`${pdi.id}_${chip.stat}_${chip.type}_${idx}`}
                              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums border rounded-none ${
                                chip.type === "buff"
                                  ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                                  : "bg-[#260b0f] border-[#7a191f] text-red-300"
                              }`}
                            >
                              {chip.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={pdi.active}
                        aria-label={`Alternar PDI ${pdi.name}`}
                        onClick={() => onToggle(pdi.id)}
                        className={`min-h-[34px] min-w-[48px] px-2 border text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-colors rounded-none ${
                          pdi.active
                            ? hasDebuffOnly
                              ? "bg-[#8f171c] border-[#b9272d] text-white"
                              : "bg-emerald-900/80 border-emerald-500/70 text-emerald-100"
                            : "bg-[#14141d] border-[#282836] text-[#828392] hover:text-white"
                        }`}
                      >
                        {pdi.active ? "ON" : "OFF"}
                      </button>

                      {canEdit && onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(pdi)}
                          aria-label={`Editar PDI ${pdi.name}`}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center bg-[#14141d] hover:bg-[#1f1f2d] border border-[#282836] text-[#9ca3af] hover:text-white cursor-pointer transition-colors rounded-none"
                        >
                          <Pencil size={12} />
                        </button>
                      )}

                      {canEdit && onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(pdi.id)}
                          aria-label={`Excluir PDI ${pdi.name}`}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center bg-[#180c0f] hover:bg-[#2a1116] border border-[#4a1419] text-red-300 cursor-pointer transition-colors rounded-none"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="pdi-section" className="section">
      {/* Header matching Variáveis de Status & Habilidades (Skills) */}
      <div className="section-title flex items-center justify-between gap-2">
        <span className="truncate">PDI — Poderes de Intenção</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono tabular-nums text-[#a6a7b8]">
            {activeCount}/{list.length}
          </span>
          {!canEdit && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[#8e8fa0]"
              title="Apenas o Mestre pode criar ou editar PDIs"
            >
              <Lock size={10} />
              <span>Edição: Mestre</span>
            </span>
          )}
        </div>
      </div>

      {/* PDI List in Tributo ribbon design */}
      {list.length === 0 ? (
        <div className="paper-bar tributo-bar pdi-bar pdi-bar-inactive cursor-default">
          <div className="tributo-header">Nenhum PDI registrado</div>
          <div className="text-[14px] font-bold text-black/85">
            {canEdit
              ? "Use o botão abaixo para registrar um Poder de Intenção nesta ficha."
              : "Solicite ao Mestre para adicionar ou editar seus Poderes de Intenção."}
          </div>
        </div>
      ) : (
        <div className="skill-list">
          {list.map((pdi) => {
            const chips = formatPdiModifierChips(pdi.modifiers);

            return (
              <div
                key={pdi.id}
                onClick={() => onToggle(pdi.id)}
                className={`paper-bar tributo-bar pdi-bar ${
                  pdi.active ? "pdi-bar-active" : "pdi-bar-inactive"
                }`}
              >
                <div className="tributo-header flex items-center justify-between gap-2">
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <span className="truncate">{pdi.name}</span>
                    {pdi.active && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest bg-black/85 text-emerald-300 border border-emerald-500/60 leading-none">
                        ATIVO
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pdi.active}
                      aria-label={`Alternar PDI ${pdi.name}`}
                      onClick={() => onToggle(pdi.id)}
                      className={`min-h-[40px] min-w-[58px] px-2.5 border font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer touch-manipulation rounded-none ${
                        pdi.active
                          ? "bg-black/90 hover:bg-black border-emerald-400/80 text-emerald-300"
                          : "bg-black/65 hover:bg-black/85 border-black/80 text-[#d4d5e0] hover:text-white"
                      }`}
                    >
                      {pdi.active ? "ON" : "OFF"}
                    </button>

                    {canEdit && onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(pdi)}
                        aria-label={`Editar PDI ${pdi.name}`}
                        title={`Editar ${pdi.name}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-black/75 hover:bg-black border border-black/80 text-white/90 hover:text-white transition-colors cursor-pointer touch-manipulation rounded-none"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {pdi.desc && (
                  <div
                    className="break-words leading-snug"
                    style={{ fontSize: "14px", fontWeight: "bold", color: "#000000" }}
                  >
                    {pdi.desc}
                  </div>
                )}

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {chips.map((chip, idx) => (
                      <span
                        key={`${pdi.id}_${chip.stat}_${chip.type}_${idx}`}
                        className={`px-2 py-0.5 text-[11px] font-mono font-bold tabular-nums border rounded-none ${
                          chip.type === "buff"
                            ? "bg-black/85 border-emerald-500/70 text-emerald-300"
                            : "bg-black/85 border-red-400/80 text-red-200"
                        }`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && onAdd && (
        <button type="button" className="btn-add" onClick={onAdd}>
          + ADICIONAR PDI
        </button>
      )}
    </div>
  );
}
