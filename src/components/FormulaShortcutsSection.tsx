import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Dices, Check, X, ArrowUpRight, Sparkles } from "lucide-react";

export interface FormulaShortcut {
  id: string;
  name: string;
  formula: string;
}

const MAX_SHORTCUTS = 8;
const STORAGE_KEY = "op_custom_formula_shortcuts";

interface FormulaShortcutsSectionProps {
  onRollFormula: (formula: string) => void;
  setDiceInput: (formula: string) => void;
  diceInput?: string;
}

export function FormulaShortcutsSection({
  onRollFormula,
  setDiceInput,
  diceInput = "",
}: FormulaShortcutsSectionProps) {
  // Inicialmente vazio (sem atalhos padrão pré-inseridos)
  const [shortcuts, setShortcuts] = useState<FormulaShortcut[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_SHORTCUTS);
      }
    } catch (e) {
      console.error("Erro ao carregar atalhos customizados:", e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch (e) {
      console.error("Erro ao salvar atalhos customizados:", e);
    }
  }, [shortcuts]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFormula, setFormFormula] = useState("");

  const handleOpenCreate = () => {
    if (shortcuts.length >= MAX_SHORTCUTS) return;
    setEditingId(null);
    setFormName("");
    setFormFormula(diceInput.trim() || "");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sc: FormulaShortcut, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sc.id);
    setFormName(sc.name);
    setFormFormula(sc.formula);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) {
      setIsFormOpen(false);
      setEditingId(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFormula = formFormula.trim();
    if (!cleanFormula) return;
    const cleanName = formName.trim() || cleanFormula;

    if (editingId) {
      setShortcuts((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, name: cleanName, formula: cleanFormula } : s))
      );
    } else {
      if (shortcuts.length >= MAX_SHORTCUTS) return;
      const newShortcut: FormulaShortcut = {
        id: Date.now().toString(),
        name: cleanName,
        formula: cleanFormula,
      };
      setShortcuts((prev) => [...prev, newShortcut].slice(0, MAX_SHORTCUTS));
    }

    setIsFormOpen(false);
    setEditingId(null);
    setFormName("");
    setFormFormula("");
  };

  const handleInsert = (formula: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiceInput(formula);
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[var(--op-panel)] border border-[var(--op-border)] rounded-xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* CABEÇALHO DA SEÇÃO DE ATALHOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 sm:pb-4 mb-4 sm:mb-5 border-b border-[var(--op-border)]">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24]" />
            <h2 className="text-sm sm:text-base font-mono font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-[var(--op-white)]">
              ATALHOS DE FÓRMULA
            </h2>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                shortcuts.length >= MAX_SHORTCUTS
                  ? "bg-[#330f13] text-[#ff8085] border-[#7a181e]"
                  : "bg-[#14141a] text-[var(--op-text-muted)] border-[var(--op-border)]"
              }`}
            >
              {shortcuts.length} / {MAX_SHORTCUTS}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-mono text-[var(--op-text-muted)] mt-1">
            Grave suas fórmulas frequentes para rolagens imediatas com um toque
          </p>
        </div>

        {shortcuts.length < MAX_SHORTCUTS && !isFormOpen && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg font-mono font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#99151b] to-[#6e0f14] hover:from-[#b81d24] hover:to-[#851218] border border-[#b81d24]/60 shadow-[0_0_12px_rgba(184,29,36,0.35)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px] touch-manipulation select-none"
          >
            <Plus size={15} className="text-white" />
            <span>Novo Atalho</span>
          </button>
        )}
      </div>

      {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO AMPLIADO */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="mb-4 sm:mb-5 p-4 sm:p-5 bg-gradient-to-b from-[#1c0a0d] via-[#140608] to-[#0f0406] border border-[#851a21] rounded-xl shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-[#3d0f14]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--op-red-bright)]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                {editingId ? "Editar Atalho de Fórmula" : "Criar Novo Atalho"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
              className="p-1.5 rounded text-[var(--op-text-muted)] hover:text-white hover:bg-white/10 transition-colors touch-manipulation"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-mono font-bold text-[#e5b3b6] uppercase tracking-wider mb-1.5">
                Nome do Atalho:
              </label>
              <input
                type="text"
                placeholder="Ex: Ataque Furtivo, Tiroteio, Ocultismo"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-[#0a0a0d] border border-[var(--op-border)] focus:border-[var(--op-red-bright)] focus:ring-1 focus:ring-[var(--op-red-bright)] rounded-lg px-3 py-2.5 text-base sm:text-sm font-mono text-white placeholder:text-[#555] outline-none transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#e5b3b6] uppercase tracking-wider mb-1.5">
                Fórmula do Dado <span className="text-[var(--op-red-bright)]">*</span>:
              </label>
              <input
                type="text"
                placeholder="Ex: 1d20+FOR, 2d8+3, 1d100"
                value={formFormula}
                onChange={(e) => setFormFormula(e.target.value)}
                className="w-full bg-[#0a0a0d] border border-[var(--op-border)] focus:border-[var(--op-red-bright)] focus:ring-1 focus:ring-[var(--op-red-bright)] rounded-lg px-3 py-2.5 text-base sm:text-sm font-mono text-white placeholder:text-[#555] outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
              className="px-4 py-2.5 sm:py-2 text-xs font-mono uppercase tracking-wider text-[var(--op-text-muted)] hover:text-white bg-[#14141a] hover:bg-[#20202a] rounded-lg border border-[var(--op-border)] transition-colors cursor-pointer text-center min-h-[42px] touch-manipulation select-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!formFormula.trim()}
              className="px-5 py-2.5 sm:py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#b81d24] to-[#7a1015] hover:from-[#d1242c] hover:to-[#96141a] rounded-lg border border-[#b81d24] shadow-[0_0_14px_rgba(184,29,36,0.5)] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px] touch-manipulation select-none"
            >
              <Check size={14} />
              <span>{editingId ? "Atualizar Atalho" : "Salvar Atalho"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ESTADO VAZIO (SEM ATALHOS PADRÃO) */}
      {shortcuts.length === 0 ? (
        <div className="py-8 sm:py-10 px-4 border border-dashed border-[var(--op-border)] rounded-xl text-center bg-[#0d0d12]/50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#1c080b] border border-[#541217] flex items-center justify-center text-[var(--op-red-bright)] shadow-[0_0_16px_rgba(184,29,36,0.25)] mb-3">
            <Dices size={26} />
          </div>
          <h3 className="text-xs sm:text-sm font-mono font-bold text-white uppercase tracking-wider">
            Nenhum atalho criado ainda
          </h3>
          <p className="text-[11px] sm:text-xs font-mono text-[var(--op-text-muted)] max-w-sm mt-1.5 mb-4 sm:mb-5 leading-relaxed">
            Personalize até 8 botões rápidos com as fórmulas mais usadas da sua ficha para rolar com agilidade.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg font-mono font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#b81d24] to-[#7a1015] hover:from-[#d1242c] hover:to-[#96141a] border border-[#b81d24] shadow-[0_0_16px_rgba(184,29,36,0.4)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] touch-manipulation select-none"
          >
            <Plus size={16} />
            <span>Criar Primeiro Atalho</span>
          </button>
        </div>
      ) : (
        /* GRADE AMPLIADA DE ATALHOS CRIADOS */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
          {shortcuts.map((sc) => (
            <div
              key={sc.id}
              onClick={() => onRollFormula(sc.formula)}
              className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#17171f] to-[#111116] hover:from-[#240b0e] hover:to-[#170608] border border-[var(--op-border)] hover:border-[#99171e] hover:shadow-[0_4px_20px_rgba(184,29,36,0.25)] active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden touch-manipulation min-h-[66px]"
              title={`Toque para rolar ${sc.formula}`}
            >
              {/* Linha de acento luminoso no topo */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-[var(--op-red-bright)]/70 transition-colors" />

              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#21090c] border border-[#521016] group-hover:border-[var(--op-red-bright)] flex items-center justify-center text-[var(--op-red-bright)] group-hover:shadow-[0_0_10px_rgba(184,29,36,0.5)] shrink-0 transition-all">
                  <Dices size={17} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-mono font-bold text-white group-hover:text-[#ff8085] truncate transition-colors leading-snug">
                    {sc.name}
                  </div>
                  <div className="text-[11px] sm:text-xs font-mono font-bold text-[var(--op-red-bright)] mt-0.5 tracking-wider">
                    {sc.formula}
                  </div>
                </div>
              </div>

              {/* AÇÕES LATERAIS - TOUCH TARGETS DE 40PX NO MOBILE */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleInsert(sc.formula, e)}
                  title="Copiar fórmula para o terminal"
                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 text-[var(--op-text-muted)] hover:text-white transition-colors cursor-pointer touch-manipulation"
                >
                  <ArrowUpRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleOpenEdit(sc, e)}
                  title="Editar atalho"
                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 text-[var(--op-text-muted)] hover:text-white transition-colors cursor-pointer touch-manipulation"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(sc.id, e)}
                  title="Excluir atalho"
                  className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-red-950/60 active:bg-red-900 text-[var(--op-text-muted)] hover:text-red-400 transition-colors cursor-pointer touch-manipulation"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RODAPÉ INFORMATIVO */}
      {shortcuts.length > 0 && (
        <div className="mt-3.5 sm:mt-4 pt-3 border-t border-[var(--op-border)] flex items-center justify-between text-[11px] sm:text-xs font-mono text-[var(--op-text-muted)]">
          <span>Toque no atalho para rolar.</span>
          <span className="text-[#777]">{shortcuts.length} de {MAX_SHORTCUTS}</span>
        </div>
      )}
    </div>
  );
}
