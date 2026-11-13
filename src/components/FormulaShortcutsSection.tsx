import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Dices,
  Check,
  X,
  Play,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  CustomRollFormula,
  upsertCustomFormula,
  removeCustomFormula,
} from "../utils/diceFormula";

export type FormulaShortcut = CustomRollFormula;

const MAX_FORMULAS = 16;

export interface FormulaShortcutsSectionProps {
  formulas: CustomRollFormula[];
  onUpdateFormulas: (next: CustomRollFormula[]) => void;
  onExecuteFormula: (formula: string, label?: string) => boolean;
  sheetName?: string;
  isExtraSheet?: boolean;
  isRlMode?: boolean;
}

export function FormulaShortcutsSection({
  formulas,
  onUpdateFormulas,
  onExecuteFormula,
  sheetName = "Ficha",
  isExtraSheet = false,
  isRlMode = false,
}: FormulaShortcutsSectionProps) {
  const [quickFormula, setQuickFormula] = useState("");
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFormula, setFormFormula] = useState("");

  const handleExecuteDirect = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = quickFormula.trim();
    if (!clean) {
      setFormulaError("Digite uma fórmula antes de executar.");
      return;
    }
    const ok = onExecuteFormula(clean);
    if (!ok) {
      setFormulaError("Fórmula inválida. Use expressões como 2d6+OCU, 1d4+FOR ou 1d8+3.");
    } else {
      setFormulaError(null);
    }
  };

  const handleOpenCreate = () => {
    if (formulas.length >= MAX_FORMULAS) return;
    setEditingId(null);
    setFormName("");
    setFormFormula(quickFormula.trim());
    setIsFormOpen(true);
    setFormulaError(null);
  };

  const handleOpenEdit = (sc: CustomRollFormula, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sc.id);
    setFormName(sc.name);
    setFormFormula(sc.formula);
    setIsFormOpen(true);
    setFormulaError(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateFormulas(removeCustomFormula(formulas, id));
    if (editingId === id) {
      setIsFormOpen(false);
      setEditingId(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFormula = formFormula.trim();
    if (!cleanFormula) return;
    if (!editingId && formulas.length >= MAX_FORMULAS) return;

    const next = upsertCustomFormula(formulas, {
      id: editingId || undefined,
      name: formName,
      formula: cleanFormula,
    });
    onUpdateFormulas(next.slice(0, MAX_FORMULAS));

    setIsFormOpen(false);
    setEditingId(null);
    setFormName("");
    setFormFormula("");
  };

  const handleRunSaved = (sc: CustomRollFormula) => {
    const ok = onExecuteFormula(sc.formula, sc.name);
    if (!ok) {
      setFormulaError(`Fórmula "${sc.name}" inválida (${sc.formula}). Edite para corrigir.`);
    } else {
      setFormulaError(null);
    }
  };

  return (
    <div
      className={`w-full max-w-xl lg:max-w-none mx-auto rounded-none p-4 sm:p-5 shadow-xl relative overflow-hidden border transition-colors ${
        isRlMode
          ? "bg-gradient-to-b from-[#151224] to-[#0c0a14] border-purple-500/30"
          : "bg-[var(--op-panel)] border-[var(--op-border)]"
      }`}
    >
      {/* CABEÇALHO DA SEÇÃO DE FÓRMULAS */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 pb-3 mb-3.5 border-b ${
          isRlMode ? "border-purple-500/25" : "border-[var(--op-border)]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-none shrink-0 ${
              isRlMode
                ? "bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
                : "bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24]"
            }`}
          />
          <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-[0.14em] text-[var(--op-white)] truncate">
            Fórmulas Personalizadas
          </h2>
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${
              isExtraSheet
                ? "bg-blue-950/40 text-blue-300 border-blue-500/35"
                : isRlMode
                  ? "bg-purple-950/40 text-purple-200 border-purple-500/35"
                  : "bg-[#1a090c] text-[#ff9aa0] border-[var(--op-red)]/40"
            }`}
            title={`Vinculadas à ficha: ${sheetName}`}
          >
            {isExtraSheet ? "Extra" : "Normal"}
          </span>
          <span
            className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-none border shrink-0 ${
              formulas.length >= MAX_FORMULAS
                ? isRlMode
                  ? "bg-[#341147] text-[#f3e8ff] border-purple-500/60"
                  : "bg-[#330f13] text-[#ff8085] border-[#7a181e]"
                : isRlMode
                  ? "bg-[#181128] text-purple-200/80 border-purple-500/30"
                  : "bg-[#14141a] text-[var(--op-text-muted)] border-[var(--op-border)]"
            }`}
          >
            {formulas.length}/{MAX_FORMULAS}
          </span>
        </div>

        {formulas.length < MAX_FORMULAS && !isFormOpen && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className={`px-3 py-1.5 rounded-none font-mono font-bold text-xs uppercase tracking-wider text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation select-none border ${
              isRlMode
                ? "bg-gradient-to-r from-[#7e22ce] to-[#581c87] hover:from-[#9333ea] hover:to-[#6b21a8] border-purple-400/50"
                : "bg-gradient-to-r from-[#99151b] to-[#6e0f14] hover:from-[#b81d24] hover:to-[#851218] border-[#b81d24]/60"
            }`}
          >
            <Plus size={14} className="text-white" />
            <span>Nova Fórmula</span>
          </button>
        )}
      </div>

      {/* BARRA DIRETA PARA INSERIR E EXECUTAR FÓRMULA (RESULTADO APENAS VIA NOTIFICAÇÃO) */}
      <form onSubmit={handleExecuteDirect} className="mb-3.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={quickFormula}
            onChange={(e) => {
              setQuickFormula(e.target.value);
              if (formulaError) setFormulaError(null);
            }}
            aria-label="Inserir fórmula personalizada"
            placeholder="Inserir fórmula (ex: 2d6+OCU+2, 1d4+FOR)"
            className={`flex-1 min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono text-white placeholder:text-[#666674] border rounded-none outline-none transition-colors ${
              isRlMode
                ? "bg-[#100b1b] border-purple-500/35 focus:border-[#c084fc]"
                : "bg-[#0b0b10] border-[var(--op-border)] focus:border-[var(--op-red-bright)]"
            }`}
          />
          <button
            type="submit"
            className={`min-h-[44px] px-4 py-2 rounded-none font-mono text-xs uppercase tracking-wider font-bold text-white border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 touch-manipulation ${
              isRlMode
                ? "bg-gradient-to-r from-[#7e22ce] to-[#581c87] hover:from-[#9333ea] hover:to-[#6b21a8] border-purple-400/50"
                : "bg-gradient-to-r from-[#99151b] to-[#6e0f14] hover:from-[#b81d24] hover:to-[#851218] border-[#ff8085]/35"
            }`}
          >
            <Play size={14} />
            <span>Executar</span>
          </button>
        </div>

        {formulaError && (
          <div
            role="alert"
            className="mt-2 px-3 py-2 bg-red-950/45 border border-red-700/60 text-red-300 text-xs font-mono flex items-center gap-2"
          >
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span>{formulaError}</span>
          </div>
        )}
      </form>

      {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO DE FÓRMULA SALVA NA FICHA */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className={`mb-4 p-4 rounded-none shadow-2xl relative overflow-hidden border ${
            isRlMode
              ? "bg-gradient-to-b from-[#1b112d] via-[#130b20] to-[#0d0716] border-purple-500/50"
              : "bg-gradient-to-b from-[#1c0a0d] via-[#140608] to-[#0f0406] border-[#851a21]"
          }`}
        >
          <div
            className={`flex items-center justify-between pb-2.5 mb-3 border-b ${
              isRlMode ? "border-purple-900/40" : "border-[#3d0f14]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles
                size={15}
                className={isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"}
              />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                {editingId ? "Editar Fórmula" : "Salvar Fórmula na Ficha"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-none text-[var(--op-text-muted)] hover:text-white hover:bg-white/10 transition-colors touch-manipulation cursor-pointer"
              aria-label="Fechar formulário de fórmula"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5">
            <div>
              <label
                className={`block text-xs font-mono uppercase tracking-wider mb-1 ${
                  isRlMode ? "text-purple-200" : "text-[#e5b3b6]"
                }`}
              >
                Nome da Fórmula
              </label>
              <input
                type="text"
                placeholder="Ex: Ritual Oculto, Esquiva, Tiro"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={`w-full min-h-[44px] rounded-none px-3 py-2 text-base sm:text-sm font-mono text-white placeholder:text-[#555] outline-none transition-all border ${
                  isRlMode
                    ? "bg-[#0e0818] border-purple-500/40 focus:border-[#c084fc]"
                    : "bg-[#0a0a0d] border-[var(--op-border)] focus:border-[var(--op-red-bright)]"
                }`}
                autoFocus
              />
            </div>

            <div>
              <label
                className={`block text-xs font-mono uppercase tracking-wider mb-1 ${
                  isRlMode ? "text-purple-200" : "text-[#e5b3b6]"
                }`}
              >
                Expressão{" "}
                <span className={isRlMode ? "text-[#c084fc]" : "text-[var(--op-red-bright)]"}>
                  *
                </span>
              </label>
              <input
                type="text"
                placeholder="Ex: 2d6+AGL, 1d4+FOR"
                value={formFormula}
                onChange={(e) => setFormFormula(e.target.value)}
                className={`w-full min-h-[44px] rounded-none px-3 py-2 text-base sm:text-sm font-mono text-white placeholder:text-[#555] outline-none transition-all border ${
                  isRlMode
                    ? "bg-[#0e0818] border-purple-500/40 focus:border-[#c084fc]"
                    : "bg-[#0a0a0d] border-[var(--op-border)] focus:border-[var(--op-red-bright)]"
                }`}
                required
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-none border transition-colors cursor-pointer min-h-[44px] touch-manipulation ${
                isRlMode
                  ? "text-purple-200/70 hover:text-white bg-[#160f25] border-purple-500/30"
                  : "text-[var(--op-text-muted)] hover:text-white bg-[#14141a] border-[var(--op-border)]"
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!formFormula.trim()}
              className={`px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white rounded-none border disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] touch-manipulation ${
                isRlMode
                  ? "bg-gradient-to-r from-[#7e22ce] to-[#581c87] border-purple-400/50"
                  : "bg-gradient-to-r from-[#b81d24] to-[#7a1015] border-[#b81d24]"
              }`}
            >
              <Check size={14} />
              <span>{editingId ? "Atualizar" : "Salvar Fórmula"}</span>
            </button>
          </div>
        </form>
      )}

      {/* LISTA DE FÓRMULAS SALVAS NA FICHA ATIVA (SEM HISTÓRICO) */}
      {formulas.length === 0 ? (
        <div
          className={`py-5 px-4 border border-dashed rounded-none text-center flex flex-col items-center justify-center ${
            isRlMode
              ? "border-purple-500/30 bg-[#120c1f]/50"
              : "border-[var(--op-border)] bg-[#0d0d12]/50"
          }`}
        >
          <p
            className={`text-xs font-mono ${
              isRlMode ? "text-purple-300/75" : "text-[var(--op-text-muted)]"
            }`}
          >
            Nenhuma fórmula salva em "{sheetName}". Insira acima para executar ou salve suas fórmulas recorrentes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
          {formulas.map((sc) => (
            <div
              key={sc.id}
              onClick={() => handleRunSaved(sc)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRunSaved(sc);
                }
              }}
              aria-label={`Executar fórmula ${sc.name}: ${sc.formula}`}
              className={`group relative flex items-center justify-between p-3 rounded-none border active:scale-[0.98] transition-all duration-200 cursor-pointer overflow-hidden touch-manipulation min-h-[62px] ${
                isRlMode
                  ? "bg-gradient-to-r from-[#181129] to-[#110c1c] hover:from-[#261540] hover:to-[#170c2a] border-purple-500/25 hover:border-purple-400"
                  : "bg-gradient-to-r from-[#17171f] to-[#111116] hover:from-[#240b0e] hover:to-[#170608] border-[var(--op-border)] hover:border-[#99171e]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div
                  className={`w-9 h-9 rounded-none border flex items-center justify-center shrink-0 transition-all ${
                    isRlMode
                      ? "bg-[#23123b] border-purple-500/40 text-[#c084fc]"
                      : "bg-[#21090c] border-[#521016] group-hover:border-[var(--op-red-bright)] text-[var(--op-red-bright)]"
                  }`}
                >
                  <Dices size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-mono font-bold text-white truncate leading-snug">
                    {sc.name}
                  </div>
                  <div
                    className={`text-xs font-mono mt-0.5 tracking-wider truncate ${
                      isRlMode ? "text-[#c084fc]" : "text-[#ff8085]"
                    }`}
                  >
                    {sc.formula}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleOpenEdit(sc, e)}
                  title="Editar fórmula"
                  aria-label={`Editar fórmula ${sc.name}`}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-none hover:bg-white/10 text-[var(--op-text-muted)] hover:text-white transition-colors cursor-pointer touch-manipulation"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(sc.id, e)}
                  title="Excluir fórmula"
                  aria-label={`Excluir fórmula ${sc.name}`}
                  className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-none transition-colors cursor-pointer touch-manipulation ${
                    isRlMode
                      ? "hover:bg-purple-950/60 text-[var(--op-text-muted)] hover:text-purple-300"
                      : "hover:bg-red-950/60 text-[var(--op-text-muted)] hover:text-red-400"
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
