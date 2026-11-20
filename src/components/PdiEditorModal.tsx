import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Save, Trash2, Sparkles } from "lucide-react";
import {
  DEMOLOGIA_STAT_KEYS,
  DEMOLOGIA_STAT_LABELS,
  DemologiaStatKey,
  PdiDiceValue,
  PdiItem,
  PdiStatModifier,
  VALID_PDI_DICE,
  normalizePdis,
} from "../utils/pdi";

export interface PdiEditorModalProps {
  isOpen: boolean;
  initialPdi: PdiItem | null;
  targetName?: string;
  onClose: () => void;
  onSave: (pdi: PdiItem) => void;
  onDelete?: (pdiId: string) => void;
}

type ModifiersDraft = Record<
  DemologiaStatKey,
  {
    buffDice: PdiDiceValue;
    debuffDice: PdiDiceValue;
    buffFlat: string;
    debuffFlat: string;
  }
>;

function buildEmptyModifiersDraft(): ModifiersDraft {
  return {
    VIT: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
    AGL: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
    FOR: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
    OCU: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
    INT: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
    SAN: { buffDice: "", debuffDice: "", buffFlat: "", debuffFlat: "" },
  };
}

function modifiersToDraft(
  modifiers?: Partial<Record<DemologiaStatKey, PdiStatModifier>>,
): ModifiersDraft {
  const draft = buildEmptyModifiersDraft();
  if (!modifiers) return draft;
  for (const stat of DEMOLOGIA_STAT_KEYS) {
    const m = modifiers[stat];
    if (!m) continue;
    draft[stat] = {
      buffDice: m.buffDice || "",
      debuffDice: m.debuffDice || "",
      buffFlat: m.buffFlat && m.buffFlat > 0 ? String(m.buffFlat) : "",
      debuffFlat: m.debuffFlat && m.debuffFlat > 0 ? String(m.debuffFlat) : "",
    };
  }
  return draft;
}

export function PdiEditorModal({
  isOpen,
  initialPdi,
  targetName,
  onClose,
  onSave,
  onDelete,
}: PdiEditorModalProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(false);
  const [modifiers, setModifiers] = useState<ModifiersDraft>(buildEmptyModifiersDraft);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialPdi) {
      setName(initialPdi.name || "");
      setDesc(initialPdi.desc || "");
      setActive(Boolean(initialPdi.active));
      setModifiers(modifiersToDraft(initialPdi.modifiers));
    } else {
      setName("");
      setDesc("");
      setActive(false);
      setModifiers(buildEmptyModifiersDraft());
    }
    setErrorMsg("");
  }, [isOpen, initialPdi]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const updateStatField = (
    stat: DemologiaStatKey,
    field: "buffDice" | "debuffDice" | "buffFlat" | "debuffFlat",
    value: string,
  ) => {
    setModifiers((prev) => ({
      ...prev,
      [stat]: {
        ...prev[stat],
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("Informe um nome para o PDI.");
      return;
    }

    const builtMods: Partial<Record<DemologiaStatKey, PdiStatModifier>> = {};
    for (const stat of DEMOLOGIA_STAT_KEYS) {
      const row = modifiers[stat];
      const bf = parseInt(row.buffFlat, 10);
      const df = parseInt(row.debuffFlat, 10);
      const cleanBf = Number.isFinite(bf) && bf > 0 ? Math.min(99, bf) : 0;
      const cleanDf = Number.isFinite(df) && df > 0 ? Math.min(99, df) : 0;

      if (row.buffDice || row.debuffDice || cleanBf > 0 || cleanDf > 0) {
        builtMods[stat] = {
          ...(row.buffDice ? { buffDice: row.buffDice } : {}),
          ...(row.debuffDice ? { debuffDice: row.debuffDice } : {}),
          ...(cleanBf > 0 ? { buffFlat: cleanBf } : {}),
          ...(cleanDf > 0 ? { debuffFlat: cleanDf } : {}),
        };
      }
    }

    const rawItem: PdiItem = {
      id:
        initialPdi?.id ||
        `pdi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      desc: desc.trim(),
      active,
      modifiers: builtMods,
    };

    const [normalized] = normalizePdis([rawItem], []);
    if (normalized) {
      onSave(normalized);
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[370] bg-black/80 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={initialPdi ? "Editar PDI" : "Novo PDI"}
    >
      <div
        className="w-full sm:max-w-2xl bg-[#09090e] border border-[#282836] border-t-2 border-t-[#8f171c] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.9)] max-h-[92dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#0e0e15] border-b border-[#1f1f2b] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[var(--op-red-bright)] shrink-0" />
              <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-white truncate">
                {initialPdi ? "Editar Poder de Intenção" : "Novo Poder de Intenção"}
              </h3>
            </div>
            {targetName && (
              <p className="text-[11px] font-mono text-[#7c7d8c] mt-0.5 truncate">
                ALVO: <span className="text-[#c8c9d6]">{targetName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar editor de PDI"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[#14141d] hover:bg-[#1e1e2b] border border-[#282836] text-[#9ca3af] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 bg-[#2a0c10] border border-[#8f171c] text-xs font-mono text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label
                htmlFor="pdi-name-input"
                className="block text-[10px] font-mono uppercase tracking-widest text-[#8f90a2] mb-1"
              >
                Nome do PDI *
              </label>
              <input
                id="pdi-name-input"
                type="text"
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                placeholder="Ex: Ladino, Olhar do Abismo, Fúria Contida..."
                className="w-full min-h-[44px] bg-[#0e0e14] border border-[#262634] focus:border-[#8f171c] outline-none px-3 py-2 text-sm text-white placeholder-[#525364] rounded-none"
                autoFocus
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive((prev) => !prev)}
              className={`min-h-[44px] px-3.5 border font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 rounded-none ${
                active
                  ? "bg-emerald-950/60 border-emerald-600/70 text-emerald-300"
                  : "bg-[#12121a] border-[#262634] text-[#828392] hover:text-white"
              }`}
            >
              <span
                className={`w-2 h-2 inline-block ${
                  active ? "bg-emerald-400" : "bg-[#525364]"
                }`}
              />
              {active ? "ATIVO (ON)" : "INATIVO (OFF)"}
            </button>
          </div>

          <div>
            <label
              htmlFor="pdi-desc-input"
              className="block text-[10px] font-mono uppercase tracking-widest text-[#8f90a2] mb-1"
            >
              Descrição / Condição de Ativação
            </label>
            <textarea
              id="pdi-desc-input"
              rows={2}
              maxLength={400}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descreva o efeito narrativo ou condição para ativar este PDI..."
              className="w-full bg-[#0e0e14] border border-[#262634] focus:border-[#8f171c] outline-none px-3 py-2 text-xs sm:text-sm text-[#d4d5e0] placeholder-[#525364] resize-none rounded-none"
            />
          </div>

          {/* Modificadores por Atributo */}
          <div className="border border-[#1f1f2b] bg-[#0c0c12]">
            <div className="px-3 py-2 bg-[#111119] border-b border-[#1f1f2b] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#a6a7b8] font-bold">
                Modificadores nos Atributos Oficiais
              </span>
              <span className="text-[10px] font-mono text-[#6b6c7e]">
                Buff (+) soma na rolagem • Debuff (-) subtrai
              </span>
            </div>

            {/* Desktop table headers */}
            <div className="hidden sm:grid sm:grid-cols-[112px_1fr_1fr_76px_76px] gap-2 px-3 py-1.5 bg-[#0a0a10] border-b border-[#191924] text-[10px] font-mono uppercase tracking-wider text-[#6b6c7e]">
              <span>Atributo</span>
              <span className="text-emerald-400/90">Buff Dado</span>
              <span className="text-red-400/90">Debuff Dado</span>
              <span className="text-emerald-400/90 text-center">Buff +</span>
              <span className="text-red-400/90 text-center">Debuff -</span>
            </div>

            <div className="divide-y divide-[#181822]">
              {DEMOLOGIA_STAT_KEYS.map((stat) => {
                const row = modifiers[stat];
                const hasBuff = Boolean(row.buffDice) || Number(row.buffFlat) > 0;
                const hasDebuff = Boolean(row.debuffDice) || Number(row.debuffFlat) > 0;

                return (
                  <div
                    key={stat}
                    className={`p-3 sm:px-3 sm:py-2 grid grid-cols-1 sm:grid-cols-[112px_1fr_1fr_76px_76px] gap-2 sm:items-center ${
                      hasBuff || hasDebuff ? "bg-[#12121b]" : ""
                    }`}
                  >
                    {/* Stat Label */}
                    <div className="flex items-center justify-between sm:block">
                      <div className="flex items-baseline gap-1.5 sm:flex-col sm:gap-0">
                        <span className="font-mono text-xs font-bold text-white tracking-wider">
                          {stat}
                        </span>
                        <span className="text-[10px] text-[#757688]">
                          {DEMOLOGIA_STAT_LABELS[stat]}
                        </span>
                      </div>
                      {(hasBuff || hasDebuff) && (
                        <span className="sm:hidden text-[10px] font-mono text-[#9ca3af] uppercase">
                          Modificado
                        </span>
                      )}
                    </div>

                    {/* Mobile 2x2 grid wrapper -> desktop contents */}
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      <div>
                        <span className="sm:hidden block text-[9px] font-mono uppercase text-emerald-400/80 mb-0.5">
                          Buff Dado
                        </span>
                        <select
                          aria-label={`${stat} Buff Dado`}
                          value={row.buffDice}
                          onChange={(e) =>
                            updateStatField(stat, "buffDice", e.target.value)
                          }
                          className={`w-full min-h-[40px] sm:min-h-[36px] bg-[#09090e] border outline-none px-2 py-1 text-xs font-mono rounded-none ${
                            row.buffDice
                              ? "border-emerald-700/70 text-emerald-300"
                              : "border-[#232330] text-[#9ca3af]"
                          }`}
                        >
                          {VALID_PDI_DICE.map((die) => (
                            <option key={die || "none"} value={die}>
                              {die ? `+${die.toUpperCase()}` : "—"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="sm:hidden block text-[9px] font-mono uppercase text-red-400/80 mb-0.5">
                          Debuff Dado
                        </span>
                        <select
                          aria-label={`${stat} Debuff Dado`}
                          value={row.debuffDice}
                          onChange={(e) =>
                            updateStatField(stat, "debuffDice", e.target.value)
                          }
                          className={`w-full min-h-[40px] sm:min-h-[36px] bg-[#09090e] border outline-none px-2 py-1 text-xs font-mono rounded-none ${
                            row.debuffDice
                              ? "border-[#8f171c] text-red-300"
                              : "border-[#232330] text-[#9ca3af]"
                          }`}
                        >
                          {VALID_PDI_DICE.map((die) => (
                            <option key={die || "none"} value={die}>
                              {die ? `-${die.toUpperCase()}` : "—"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="sm:hidden block text-[9px] font-mono uppercase text-emerald-400/80 mb-0.5">
                          Buff Fixo (+)
                        </span>
                        <input
                          aria-label={`${stat} Buff Fixo`}
                          type="number"
                          min={0}
                          max={99}
                          inputMode="numeric"
                          value={row.buffFlat}
                          onChange={(e) =>
                            updateStatField(stat, "buffFlat", e.target.value)
                          }
                          placeholder="0"
                          className={`w-full min-h-[40px] sm:min-h-[36px] bg-[#09090e] border outline-none px-2 py-1 text-xs font-mono text-center tabular-nums rounded-none ${
                            Number(row.buffFlat) > 0
                              ? "border-emerald-700/70 text-emerald-300"
                              : "border-[#232330] text-[#9ca3af]"
                          }`}
                        />
                      </div>

                      <div>
                        <span className="sm:hidden block text-[9px] font-mono uppercase text-red-400/80 mb-0.5">
                          Debuff Fixo (-)
                        </span>
                        <input
                          aria-label={`${stat} Debuff Fixo`}
                          type="number"
                          min={0}
                          max={99}
                          inputMode="numeric"
                          value={row.debuffFlat}
                          onChange={(e) =>
                            updateStatField(stat, "debuffFlat", e.target.value)
                          }
                          placeholder="0"
                          className={`w-full min-h-[40px] sm:min-h-[36px] bg-[#09090e] border outline-none px-2 py-1 text-xs font-mono text-center tabular-nums rounded-none ${
                            Number(row.debuffFlat) > 0
                              ? "border-[#8f171c] text-red-300"
                              : "border-[#232330] text-[#9ca3af]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-2 border-t border-[#1f1f2b] flex flex-wrap items-center justify-between gap-2">
            <div>
              {initialPdi && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialPdi.id);
                    onClose();
                  }}
                  className="min-h-[44px] px-3.5 bg-[#1b0a0d] hover:bg-[#2c1015] border border-[#611319] text-red-300 text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer rounded-none"
                >
                  <Trash2 size={14} />
                  <span>Excluir</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 bg-[#12121a] hover:bg-[#1a1a26] border border-[#262634] text-[#9ca3af] hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer rounded-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 bg-[#8f171c] hover:bg-[#a91c22] border border-[#b9272d] text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer rounded-none"
              >
                <Save size={14} />
                <span>Salvar PDI</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
