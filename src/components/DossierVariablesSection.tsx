import React, { useState } from "react";
import {
  Brain,
  Zap,
  Swords,
  Heart,
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  Dices,
  Check,
  Edit2,
  Minus,
  Shield,
  FileText,
} from "lucide-react";

interface VariableMeta {
  fullName: string;
  category: string;
  color: string;
  borderColor: string;
  bgGradient: string;
  badgeBg: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const DEFAULT_VARIABLES_META: Record<string, VariableMeta> = {
  SAN: {
    fullName: "Sanidade",
    category: "Estabilidade Mental",
    color: "#60a5fa", // Azul psíquico
    borderColor: "#2563eb",
    bgGradient: "from-[#0c1322] via-[#080d17] to-[#05080f]",
    badgeBg: "bg-blue-950/70 text-blue-300 border-blue-600/50",
    icon: Brain,
  },
  AGL: {
    fullName: "Agilidade",
    category: "Reflexos & Destreza",
    color: "#fbbf24", // Âmbar tático
    borderColor: "#d97706",
    bgGradient: "from-[#221706] via-[#140e04] to-[#0a0702]",
    badgeBg: "bg-amber-950/70 text-amber-300 border-amber-600/50",
    icon: Zap,
  },
  INT: {
    fullName: "Intelecto",
    category: "Lógica & Investigação",
    color: "#38bdf8", // Ciano analítico
    borderColor: "#0284c7",
    bgGradient: "from-[#081a24] via-[#051017] to-[#03080c]",
    badgeBg: "bg-cyan-950/70 text-cyan-300 border-cyan-600/50",
    icon: BookOpen,
  },
  FOR: {
    fullName: "Força",
    category: "Potência Muscular",
    color: "#f97316", // Laranja bélico
    borderColor: "#ea580c",
    bgGradient: "from-[#241008] via-[#170a05] to-[#0d0502]",
    badgeBg: "bg-orange-950/70 text-orange-300 border-orange-600/50",
    icon: Swords,
  },
  VIT: {
    fullName: "Vitalidade",
    category: "Resistência Biológica",
    color: "#34d399", // Esmeralda fisiológico
    borderColor: "#059669",
    bgGradient: "from-[#071f16] via-[#04140e] to-[#020b08]",
    badgeBg: "bg-emerald-950/70 text-emerald-300 border-emerald-600/50",
    icon: Heart,
  },
  OCU: {
    fullName: "Ocultismo",
    category: "Afinidade Paranormal",
    color: "#f43f5e", // Carmesim do Outro Lado
    borderColor: "#b81d24",
    bgGradient: "from-[#28080c] via-[#190407] to-[#0d0203]",
    badgeBg: "bg-rose-950/70 text-rose-300 border-rose-600/50",
    icon: Sparkles,
  },
};

const GENERIC_META: VariableMeta = {
  fullName: "Atributo Tático",
  category: "Parâmetro Especial",
  color: "#a1a1aa",
  borderColor: "#52525b",
  bgGradient: "from-[#17171d] via-[#101014] to-[#0b0b0e]",
  badgeBg: "bg-zinc-900 text-zinc-300 border-zinc-700",
  icon: Shield,
};

interface DossierVariablesSectionProps {
  variables: Record<string, number>;
  updateVariable: (key: string, val: number) => void;
  renameVariable: (oldKey: string, newKey: string) => void;
  removeVariable: (key: string) => void;
  addVariable: () => void;
  onRollTest?: (variableKey: string) => void;
}

export function DossierVariablesSection({
  variables,
  updateVariable,
  renameVariable,
  removeVariable,
  addVariable,
  onRollTest,
}: DossierVariablesSectionProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const handleStartRename = (key: string) => {
    setEditingKey(key);
    setRenameDraft(key);
  };

  const handleFinishRename = (oldKey: string) => {
    const clean = renameDraft.trim().toUpperCase();
    if (clean && clean !== oldKey) {
      renameVariable(oldKey, clean);
    }
    setEditingKey(null);
  };

  const varEntries = Object.entries(variables);

  return (
    <div className="section !p-0 !border-none">
      {/* CABEÇALHO ESTILO DOSSIÊ CONFIDENCIAL */}
      <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-[#17090b] via-[#14141a] to-[#0e0e13] border border-[var(--op-border)] p-3.5 sm:p-4 mb-3 shadow-lg">
        {/* Linha superior de classificação */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--op-red-bright)] via-[#b81d24]/50 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#24080a] border border-[#7a181e] flex items-center justify-center text-[var(--op-red-bright)] shadow-[0_0_10px_rgba(184,29,36,0.35)] shrink-0">
              <FileText size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-[#ff8085] bg-[#380b0f] px-2 py-0.5 rounded border border-[#691419]">
                  ARQUIVO CLASSIFICADO // DOC-06
                </span>
                <span className="text-[10px] font-mono text-[var(--op-text-muted)] hidden sm:inline">
                  REF. PERFIL INVESTIGATIVO
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-mono font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] text-white mt-0.5 flex items-center gap-1.5">
                VARIÁVEIS DE STATUS
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--op-border)]/50">
            <span className="text-[11px] font-mono text-[var(--op-text-muted)] bg-[#111116] px-2.5 py-1 rounded-md border border-[var(--op-border)]">
              {varEntries.length} PARÂMETRO{varEntries.length === 1 ? "" : "S"} REGISTRADOS
            </span>
            <button
              type="button"
              onClick={addVariable}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#8f171c] to-[#5c0e12] hover:from-[#b81d24] hover:to-[#7a1015] border border-[#b81d24]/60 shadow-[0_0_10px_rgba(184,29,36,0.3)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 min-h-[36px] touch-manipulation select-none"
            >
              <Plus size={14} />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      </div>

      {/* GRADE DOSSIÊ DE VARIÁVEIS (SAN, AGL, INT, FOR, VIT, OCU)
          Layout responsivo:
          - Mobile pequeno/médio: 2 colunas amplas com botões de incremento/decremento tátil de 40px
          - Tablet: 3 colunas
          - Desktop: 6 colunas completas para a linha dos atributos clássicos!
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {varEntries.map(([key, rawValue]) => {
          const value = typeof rawValue === "number" ? rawValue : parseInt(rawValue as any) || 0;
          const meta = DEFAULT_VARIABLES_META[key] || GENERIC_META;
          const IconComp = meta.icon;
          const isDefault = Boolean(DEFAULT_VARIABLES_META[key]);
          const isEditing = editingKey === key;

          return (
            <div
              key={key}
              className={`group relative rounded-xl border transition-all duration-200 shadow-lg flex flex-col justify-between overflow-hidden bg-gradient-to-b ${meta.bgGradient} hover:shadow-[0_4px_20px_rgba(0,0,0,0.7)]`}
              style={{ borderColor: `${meta.borderColor}70` }}
            >
              {/* Marcador de canto estilo pasta dossiê */}
              <div
                className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-25 group-hover:opacity-60 transition-opacity"
                style={{
                  background: `linear-gradient(135deg, transparent 50%, ${meta.color} 50%)`,
                }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-colors"
                style={{ backgroundColor: meta.color }}
              />

              {/* TOPO DO CARD: TAG DE CLASSIFICAÇÃO + AÇÃO DE REMOVER */}
              <div className="p-2.5 pb-1 flex items-start justify-between gap-1">
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value.toUpperCase())}
                      onBlur={() => handleFinishRename(key)}
                      onKeyDown={(e) => e.key === "Enter" && handleFinishRename(key)}
                      className="w-full bg-[#07070a] border border-[var(--op-red-bright)] rounded px-1.5 py-0.5 text-xs font-mono font-bold text-white outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleFinishRename(key)}
                      className="p-1 text-emerald-400 hover:bg-emerald-950/50 rounded"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-black tracking-wider uppercase border shadow-sm ${meta.badgeBg}`}
                    >
                      {key}
                    </span>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleStartRename(key)}
                        title="Renomear variável"
                        className="opacity-60 hover:opacity-100 p-1 text-[var(--op-text-muted)] hover:text-white transition-opacity"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                  </div>
                )}

                {/* BOTÃO DE REMOÇÃO DISCRETO */}
                <button
                  type="button"
                  onClick={() => removeVariable(key)}
                  title={`Remover parâmetro ${key}`}
                  className="w-6 h-6 flex items-center justify-center rounded text-[var(--op-text-muted)] hover:text-rose-400 hover:bg-rose-950/40 transition-colors opacity-70 hover:opacity-100 touch-manipulation cursor-pointer shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* TÍTULO DESCRITIVO / SUBTÍTULO DO DOSSIÊ */}
              <div className="px-2.5 pt-0.5 pb-1">
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-white truncate">
                  <IconComp size={12} className="shrink-0" style={{ color: meta.color }} />
                  <span className="truncate">{meta.fullName}</span>
                </div>
                <div className="text-[9px] font-mono text-[var(--op-text-muted)] truncate">
                  {meta.category}
                </div>
              </div>

              {/* ÁREA CENTRAL: VALOR NUMÉRICO COM STEPPERS TÁTEIS */}
              <div className="px-2.5 py-1.5 my-1 bg-[#09090d]/80 border-y border-white/5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => updateVariable(key, value - 1)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[#14141a] hover:bg-[#20202a] active:bg-[#282834] border border-[var(--op-border)] text-[var(--op-text-secondary)] hover:text-white flex items-center justify-center font-mono font-bold transition-all active:scale-95 cursor-pointer touch-manipulation select-none"
                  title="Diminuir valor (-1)"
                >
                  <Minus size={13} />
                </button>

                <div className="text-center px-1">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => updateVariable(key, parseInt(e.target.value) || 0)}
                    className="w-12 bg-transparent text-center text-xl sm:text-2xl font-mono font-black text-white outline-none tracking-tight select-all focus:text-[var(--op-red-bright)]"
                    title="Clique para digitar o valor"
                  />
                  <div className="text-[8px] font-mono uppercase tracking-widest text-[#666]">
                    NÍVEL
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateVariable(key, value + 1)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[#14141a] hover:bg-[#20202a] active:bg-[#282834] border border-[var(--op-border)] text-[var(--op-text-secondary)] hover:text-white flex items-center justify-center font-mono font-bold transition-all active:scale-95 cursor-pointer touch-manipulation select-none"
                  title="Aumentar valor (+1)"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* BOTÃO DE AÇÃO: ROLAR TESTE (1d20+ATTR) ESTILO DOSSIÊ */}
              <div className="p-2 pt-1">
                <button
                  type="button"
                  onClick={() => onRollTest?.(key)}
                  className="w-full py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--op-text-secondary)] hover:text-white bg-[#131318] hover:bg-[#220a0d] border border-[var(--op-border)] hover:border-[var(--op-red-bright)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation shadow-sm"
                  title={`Rolar teste com 1d20+${key}`}
                >
                  <Dices size={13} style={{ color: meta.color }} />
                  <span>Testar 1d20+{key}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTÃO EXPANDIDO DE ADICIONAR VARIÁVEL SE DESEJADO */}
      <button
        type="button"
        onClick={addVariable}
        className="btn-add !mt-3.5 !py-2.5 flex items-center justify-center gap-2 hover:!bg-[#15151b] touch-manipulation"
      >
        <Plus size={14} className="text-[var(--op-red-bright)]" />
        <span>+ REGISTRAR NOVO PARÂMETRO TÁTICO NO DOSSIÊ</span>
      </button>
    </div>
  );
}
