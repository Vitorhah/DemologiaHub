import React, { useState } from "react";
import {
  Files,
  Plus,
  Trash2,
  Copy,
  Cloud,
  CloudOff,
  Maximize2,
  Heart,
  Zap,
  Brain,
  FileText,
} from "lucide-react";
import { StatMathInput } from "./StatMathInput";

export interface MasterExtrasViewProps {
  extraFichas: any[];
  setExtraFichas: React.Dispatch<React.SetStateAction<any[]>>;
  defaultState: any;
  activeFichaId: string;
  setActiveFichaId: (id: string) => void;
  setCurrentPage: (page: string) => void;
  setMestreTab: (tab: "fichas" | "ost" | "extras") => void;
  toggleFichaSync: (ficha: any) => void;
  supabase: any;
  currentGlobalMode?: "demologia" | "rl";
}

export function MasterExtrasView({
  extraFichas,
  setExtraFichas,
  defaultState,
  activeFichaId,
  setActiveFichaId,
  setCurrentPage,
  setMestreTab,
  toggleFichaSync,
  supabase,
  currentGlobalMode = "demologia",
}: MasterExtrasViewProps) {
  const [deletingFichaId, setDeletingFichaId] = useState<string | null>(null);

  const handleAddNew = () => {
    setExtraFichas([
      {
        ...defaultState,
        id: Date.now().toString(),
        name: `Ficha Extra ${extraFichas.length + 1}`,
        notes: "",
      },
      ...extraFichas,
    ]);
  };

  const handleDuplicate = (ficha: any) => {
    const cloned = {
      ...defaultState,
      ...ficha,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: `${ficha.name || "Extra"} (Cópia)`,
      synchronized: false,
      last_local_edit: undefined,
    };
    setExtraFichas([cloned, ...extraFichas]);
  };

  const handleDeleteConfirm = async (ficha: any) => {
    if (ficha.synchronized) {
      await supabase
        .from("players")
        .delete()
        .eq("id", `EXTRA_FICHA_${ficha.id}`)
        .catch(console.error);
    }
    setExtraFichas(extraFichas.filter((f) => f.id !== ficha.id));
    if (activeFichaId === ficha.id) {
      setActiveFichaId("main");
      setCurrentPage("mestre");
    }
    setDeletingFichaId(null);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 px-3 sm:px-4 font-mono my-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0c0c10] border border-[#202028] rounded-none p-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Fichas Extras e NPCs
          </h2>
          <p className="text-xs text-[#828392] mt-0.5">
            Fichas complementares para NPCs e criaturas com suporte a sincronização.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] active:scale-95 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer shrink-0 min-h-[44px] touch-manipulation border border-[#ff8085]/30"
        >
          <Plus size={15} />
          <span>Nova Ficha Extra</span>
        </button>
      </div>

      {/* Grid de Fichas Extras */}
      {extraFichas.length === 0 ? (
        <div className="py-14 text-center flex flex-col items-center justify-center bg-[#0c0c10] border border-[#202028] rounded-none">
          <Files size={32} className="text-[#626475] mb-2.5 opacity-60" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Nenhuma ficha extra cadastrada
          </h4>
          <p className="text-xs text-[#828392] max-w-xs mt-1">
            Toque no botão acima para adicionar uma ficha de NPC ou personagem secundário.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {extraFichas.map((ficha) => {
            const hpCurrent = ficha.hp?.current ?? ficha.hpCurrent ?? 100;
            const hpMax = ficha.hp?.max ?? ficha.hpMax ?? 100;
            const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

            const peCurrent = ficha.pe?.current ?? 60;
            const peMax = ficha.pe?.max ?? 60;
            const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

            const smCurrent = ficha.sm?.current ?? ficha.san?.current ?? 100;
            const smMax = ficha.sm?.max ?? ficha.san?.max ?? 100;
            const smPct = Math.max(0, Math.min(100, (smCurrent / smMax) * 100)) || 0;

            const skillsCount = ficha.skills?.length ?? 0;
            const variablesCount = Object.keys(ficha.variables || {}).length;

            return (
              <div
                key={ficha.id}
                className={`bg-[#0c0c10] border rounded-none p-4 flex flex-col justify-between transition-all ${
                  ficha.synchronized
                    ? "border-[var(--op-red)]/60"
                    : "border-[#202028] hover:border-[#2c2c38]"
                }`}
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      {ficha.synchronized && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--op-red-bright)] font-bold uppercase tracking-wider mb-1">
                          <span className="w-1.5 h-1.5 bg-[var(--op-red-bright)] rounded-full" />
                          Sincronizado
                        </span>
                      )}

                      <input
                        type="text"
                        value={ficha.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setExtraFichas(
                            extraFichas.map((f) =>
                              f.id === ficha.id
                                ? {
                                    ...f,
                                    name: newName,
                                    last_local_edit: f.synchronized ? Date.now() : undefined,
                                  }
                                : f,
                            ),
                          );
                        }}
                        className="bg-transparent text-white font-bold text-sm border-b border-transparent focus:border-[var(--op-red)] outline-none w-full min-w-0 pb-1 uppercase tracking-wider"
                        placeholder="Nome da ficha..."
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFichaSync(ficha)}
                        title={ficha.synchronized ? "Desativar sincronização" : "Sincronizar com a sessão"}
                        className={`p-2 rounded-none transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95 border ${
                          ficha.synchronized
                            ? "text-[#ff8085] bg-[#1e0a0d] border-[var(--op-red)]/60"
                            : "text-[#828392] hover:text-white bg-[#14141c] border-[#242430]"
                        }`}
                      >
                        {ficha.synchronized ? <Cloud size={14} /> : <CloudOff size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(ficha)}
                        title="Duplicar ficha"
                        className="p-2 text-[#828392] hover:text-white bg-[#14141c] border border-[#242430] rounded-none transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
                      >
                        <Copy size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingFichaId(ficha.id)}
                        className="p-2 text-[#828392] hover:text-red-400 bg-[#14141c] hover:bg-red-950/35 border border-[#242430] hover:border-red-900/50 rounded-none transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95"
                        title="Excluir ficha"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* HP & Status Condicional */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {/* HP */}
                    <div className="bg-[#111117] border border-[#1e1e28] rounded-none p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                        <span className="text-[var(--op-red-bright)] flex items-center gap-1">
                          <Heart size={10} /> HP
                        </span>
                        <span>{hpCurrent}/{hpMax}</span>
                      </div>
                      <div className="h-1.5 bg-[#181820] rounded-none overflow-hidden mb-2">
                        <div
                          className="h-full bg-[var(--op-red)] transition-all duration-200"
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <div className="w-1/2">
                          <StatMathInput
                            value={hpCurrent}
                            onSave={(val) => {
                              setExtraFichas(
                                extraFichas.map((f) =>
                                  f.id === ficha.id
                                    ? {
                                        ...f,
                                        hp: { ...f.hp, current: val },
                                        last_local_edit: f.synchronized ? Date.now() : undefined,
                                      }
                                    : f,
                                ),
                              );
                            }}
                            className="w-full min-h-[34px] bg-[#0c0c10] border border-[#202028] focus:border-[var(--op-red)] text-white text-xs text-center py-1 rounded-none outline-none font-bold"
                            placeholder="Atual"
                          />
                        </div>
                        <div className="w-1/2">
                          <StatMathInput
                            value={hpMax}
                            onSave={(val) => {
                              setExtraFichas(
                                extraFichas.map((f) =>
                                  f.id === ficha.id
                                    ? {
                                        ...f,
                                        hp: { ...f.hp, max: val },
                                        last_local_edit: f.synchronized ? Date.now() : undefined,
                                      }
                                    : f,
                                ),
                              );
                            }}
                            className="w-full min-h-[34px] bg-[#0c0c10] border border-[#202028] focus:border-[var(--op-red)] text-[#828392] text-xs text-center py-1 rounded-none outline-none font-bold"
                            placeholder="Máx"
                          />
                        </div>
                      </div>
                    </div>

                    {currentGlobalMode === "rl" ? (
                      <div className="bg-[#140b20] border border-purple-500/30 rounded-none p-2.5">
                        <div className="flex items-center justify-between text-[10px] text-[#c084fc] mb-1 font-bold uppercase tracking-wider">
                          <span className="text-purple-400 flex items-center gap-1">
                            <Brain size={10} /> SN
                          </span>
                          <span>{smCurrent}/{smMax}</span>
                        </div>
                        <div className="h-1.5 bg-[#181820] rounded-none overflow-hidden mb-2">
                          <div
                            className="h-full bg-purple-600 transition-all duration-200"
                            style={{ width: `${smPct}%` }}
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-1/2">
                            <StatMathInput
                              value={smCurrent}
                              onSave={(val) => {
                                setExtraFichas(
                                  extraFichas.map((f) =>
                                    f.id === ficha.id
                                      ? {
                                          ...f,
                                          sm: { ...(f.sm || f.san), current: val },
                                          san: { ...(f.sm || f.san), current: val },
                                          last_local_edit: f.synchronized ? Date.now() : undefined,
                                        }
                                      : f,
                                  ),
                                );
                              }}
                              className="w-full min-h-[34px] bg-[#0c0c10] border border-purple-500/40 focus:border-purple-400 text-white text-xs text-center py-1 rounded-none outline-none font-bold"
                              placeholder="Atual"
                            />
                          </div>
                          <div className="w-1/2">
                            <StatMathInput
                              value={smMax}
                              onSave={(val) => {
                                setExtraFichas(
                                  extraFichas.map((f) =>
                                    f.id === ficha.id
                                      ? {
                                          ...f,
                                          sm: { ...(f.sm || f.san), max: val },
                                          san: { ...(f.sm || f.san), max: val },
                                          last_local_edit: f.synchronized ? Date.now() : undefined,
                                        }
                                      : f,
                                  ),
                                );
                              }}
                              className="w-full min-h-[34px] bg-[#0c0c10] border border-purple-500/40 focus:border-purple-400 text-[#828392] text-xs text-center py-1 rounded-none outline-none font-bold"
                              placeholder="Máx"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#111117] border border-[#1e1e28] rounded-none p-2.5">
                        <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                          <span className="text-yellow-500 flex items-center gap-1">
                            <Zap size={10} /> PE
                          </span>
                          <span>{peCurrent}/{peMax}</span>
                        </div>
                        <div className="h-1.5 bg-[#181820] rounded-none overflow-hidden mb-2">
                          <div
                            className="h-full bg-yellow-500 transition-all duration-200"
                            style={{ width: `${pePct}%` }}
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <div className="w-1/2">
                            <StatMathInput
                              value={peCurrent}
                              onSave={(val) => {
                                setExtraFichas(
                                  extraFichas.map((f) =>
                                    f.id === ficha.id
                                      ? {
                                          ...f,
                                          pe: { ...f.pe, current: val },
                                          last_local_edit: f.synchronized ? Date.now() : undefined,
                                        }
                                      : f,
                                  ),
                                );
                              }}
                              className="w-full min-h-[34px] bg-[#0c0c10] border border-[#202028] focus:border-yellow-500 text-white text-xs text-center py-1 rounded-none outline-none font-bold"
                              placeholder="Atual"
                            />
                          </div>
                          <div className="w-1/2">
                            <StatMathInput
                              value={peMax}
                              onSave={(val) => {
                                setExtraFichas(
                                  extraFichas.map((f) =>
                                    f.id === ficha.id
                                      ? {
                                          ...f,
                                          pe: { ...f.pe, max: val },
                                          last_local_edit: f.synchronized ? Date.now() : undefined,
                                        }
                                      : f,
                                  ),
                                );
                              }}
                              className="w-full min-h-[34px] bg-[#0c0c10] border border-[#202028] focus:border-yellow-500 text-[#828392] text-xs text-center py-1 rounded-none outline-none font-bold"
                              placeholder="Máx"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-[#111117] border border-[#1e1e28] rounded-none py-1.5 text-center">
                      <span className="text-xs font-bold text-white block">
                        {skillsCount}
                      </span>
                      <span className="text-[#828392] text-[10px] uppercase tracking-wider">
                        Habilidades
                      </span>
                    </div>
                    <div className="bg-[#111117] border border-[#1e1e28] rounded-none py-1.5 text-center">
                      <span className="text-xs font-bold text-white block">
                        {variablesCount}
                      </span>
                      <span className="text-[#828392] text-[10px] uppercase tracking-wider">
                        Variáveis
                      </span>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="pt-2 border-t border-[#1e1e28]">
                    <div className="text-[10px] text-[#828392] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <FileText size={11} /> Anotações:
                    </div>
                    <textarea
                      value={ficha.notes || ""}
                      onChange={(e) => {
                        const newNotes = e.target.value;
                        setExtraFichas(
                          extraFichas.map((f) =>
                            f.id === ficha.id
                              ? {
                                  ...f,
                                  notes: newNotes,
                                  last_local_edit: f.synchronized ? Date.now() : undefined,
                                }
                              : f,
                          ),
                        );
                      }}
                      rows={2}
                      className="w-full bg-[#111117] border border-[#1e1e28] focus:border-[var(--op-red)] outline-none rounded-none p-2.5 text-xs text-[#c4c5d0] resize-none"
                      placeholder="Observações do mestre..."
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFichaId(ficha.id);
                      setCurrentPage("ficha_extra");
                      setMestreTab("fichas");
                    }}
                    className="flex-1 min-h-[44px] py-2 bg-[#121218] hover:bg-[#191922] active:scale-95 border border-[#22222c] hover:border-[#343444] text-[#60a5fa] rounded-none text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                  >
                    <Maximize2 size={14} />
                    <span>Abrir ficha completa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA EXCLUIR FICHA EXTRA */}
      {deletingFichaId !== null &&
        (() => {
          const fichaToDelete = extraFichas.find((f) => f.id === deletingFichaId);
          if (!fichaToDelete) return null;
          return (
            <div
              className="fixed inset-0 z-[350] modal-backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setDeletingFichaId(null)}
            >
              <div
                className="w-full sm:max-w-sm bg-[#0c0c10]/95 border-t sm:border border-[#2b2b36] rounded-none p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.9)] relative overflow-hidden animate-sheet-up"
                style={{
                  paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-[2px] w-full bg-[var(--op-red)] absolute top-0 left-0" />
                <div className="sm:hidden flex justify-center -mt-1 pb-3">
                  <div className="w-10 h-1 bg-[#32323e] rounded-none" />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Apagar Ficha Extra?
                    </h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {fichaToDelete.name || "Ficha Extra"}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#9ca3af] leading-relaxed mb-5 border-b border-[#1c1c26] pb-3.5 font-sans">
                  Deseja realmente apagar esta ficha extra?
                </p>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeletingFichaId(null)}
                    className="flex-1 min-h-[44px] bg-[#16161e] hover:bg-[#20202b] active:scale-95 border border-[#2c2c38] text-gray-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-none transition-all cursor-pointer touch-manipulation"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfirm(fichaToDelete)}
                    className="flex-1 min-h-[44px] bg-gradient-to-r from-[#b52a30] to-[#7a1015] hover:brightness-110 active:scale-95 border border-[#ff8085]/40 text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-none shadow-[0_0_16px_rgba(181,42,48,0.4)] transition-all cursor-pointer touch-manipulation"
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
