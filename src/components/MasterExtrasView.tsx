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
      {/* Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-3.5 sm:p-4">
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
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--op-red)] hover:bg-red-700 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-none border border-red-950 transition-colors cursor-pointer shrink-0 min-h-[36px]"
        >
          <Plus size={14} />
          <span>Nova Ficha Extra</span>
        </button>
      </div>

      {/* Grid de Fichas Extras */}
      {extraFichas.length === 0 ? (
        <div className="py-14 text-center flex flex-col items-center justify-center bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none">
          <Files size={32} className="text-[#626475] mb-2.5 opacity-60" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Nenhuma ficha extra cadastrada
          </h4>
          <p className="text-xs text-[#828392] max-w-xs mt-1">
            Clique no botão acima para adicionar uma ficha de NPC ou personagem secundário.
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
                className={`bg-[#0c0c10] border rounded-none p-3.5 sm:p-4 flex flex-col justify-between transition-all ${
                  ficha.synchronized
                    ? "border-[var(--op-red)] outline outline-1 outline-[var(--op-red-bright)]/40"
                    : "border-[#202028] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a]"
                }`}
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      {ficha.synchronized && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--op-red-bright)] font-bold uppercase tracking-wider mb-1">
                          <span className="w-1.5 h-1.5 bg-[var(--op-red-bright)] rounded-none" />
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
                        className="bg-transparent text-white font-bold text-sm border-b border-transparent focus:border-[var(--op-red)] outline-none w-full min-w-0 pb-0.5 uppercase tracking-wider"
                        placeholder="Nome da ficha..."
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFichaSync(ficha)}
                        title={ficha.synchronized ? "Desativar sincronização" : "Sincronizar com a sessão"}
                        className={`p-1.5 rounded-none transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                          ficha.synchronized
                            ? "text-[var(--op-red-bright)] bg-[rgba(181,42,48,0.2)] border border-[var(--op-red)] outline outline-1 outline-[var(--op-red-bright)]/40"
                            : "text-[#828392] hover:text-white bg-[#121217] hover:bg-[#181820] border border-[#202028] outline outline-1 outline-[#181820]"
                        }`}
                      >
                        {ficha.synchronized ? <Cloud size={13} /> : <CloudOff size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(ficha)}
                        title="Duplicar ficha"
                        className="p-1.5 text-[#828392] hover:text-white bg-[#121217] hover:bg-[#181820] border border-[#202028] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] rounded-none transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        <Copy size={13} />
                      </button>

                      {deletingFichaId === ficha.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirm(ficha)}
                            className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-[10px] font-bold uppercase rounded-none"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingFichaId(null)}
                            className="px-2 py-1 bg-[#181820] text-[#828392] hover:text-white text-[10px] font-bold uppercase rounded-none border border-[#262634]"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingFichaId(ficha.id)}
                          className="p-1.5 text-[#828392] hover:text-[var(--op-red-bright)] bg-[#121217] hover:bg-[#1a1215] border border-[#202028] hover:border-[var(--op-red)] outline outline-1 outline-[#181820] hover:outline-[var(--op-red-bright)]/40 rounded-none transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                          title="Excluir ficha"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* HP & Status Condicional (PE em Demologia, SN em Real L) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {/* HP */}
                    <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2">
                      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                        <span className="text-[var(--op-red-bright)] flex items-center gap-1">
                          <Heart size={10} /> HP
                        </span>
                        <span>{hpCurrent}/{hpMax}</span>
                      </div>
                      <div className="h-1.5 bg-[#181820] border border-[#242430] overflow-hidden mb-2">
                        <div
                          className="h-full bg-[var(--op-red)] transition-all duration-200"
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={hpCurrent}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
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
                          className="w-1/2 bg-[#0c0c10] border border-[#202028] focus:border-[var(--op-red)] text-white text-xs text-center py-0.5 rounded-none outline-none font-bold"
                          placeholder="Atual"
                        />
                        <input
                          type="number"
                          value={hpMax}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
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
                          className="w-1/2 bg-[#0c0c10] border border-[#202028] focus:border-[var(--op-red)] text-[#828392] text-xs text-center py-0.5 rounded-none outline-none font-bold"
                          placeholder="Máx"
                        />
                      </div>
                    </div>

                    {/* Modo RL: Exibe SN abaixo de HP */}
                    {currentGlobalMode === "rl" ? (
                      <div className="bg-[#140b20] border border-purple-500/30 outline outline-1 outline-purple-500/20 rounded-none p-2">
                        <div className="flex items-center justify-between text-[10px] text-[#c084fc] mb-1 font-bold uppercase tracking-wider">
                          <span className="text-purple-400 flex items-center gap-1">
                            <Brain size={10} /> SN
                          </span>
                          <span>{smCurrent}/{smMax}</span>
                        </div>
                        <div className="h-1.5 bg-[#181820] border border-purple-900/40 overflow-hidden mb-2">
                          <div
                            className="h-full bg-purple-600 transition-all duration-200"
                            style={{ width: `${smPct}%` }}
                          />
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={smCurrent}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
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
                            className="w-1/2 bg-[#0c0c10] border border-purple-500/40 focus:border-purple-400 text-white text-xs text-center py-0.5 rounded-none outline-none font-bold"
                            placeholder="Atual"
                          />
                          <input
                            type="number"
                            value={smMax}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
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
                            className="w-1/2 bg-[#0c0c10] border border-purple-500/40 focus:border-purple-400 text-[#828392] text-xs text-center py-0.5 rounded-none outline-none font-bold"
                            placeholder="Máx"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Modo Demologia: Exibe PE abaixo de HP */
                      <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2">
                        <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                          <span className="text-yellow-500 flex items-center gap-1">
                            <Zap size={10} /> PE
                          </span>
                          <span>{peCurrent}/{peMax}</span>
                        </div>
                        <div className="h-1.5 bg-[#181820] border border-[#242430] overflow-hidden mb-2">
                          <div
                            className="h-full bg-yellow-500 transition-all duration-200"
                            style={{ width: `${pePct}%` }}
                          />
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={peCurrent}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
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
                            className="w-1/2 bg-[#0c0c10] border border-[#202028] focus:border-yellow-500 text-white text-xs text-center py-0.5 rounded-none outline-none font-bold"
                            placeholder="Atual"
                          />
                          <input
                            type="number"
                            value={peMax}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
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
                            className="w-1/2 bg-[#0c0c10] border border-[#202028] focus:border-yellow-500 text-[#828392] text-xs text-center py-0.5 rounded-none outline-none font-bold"
                            placeholder="Máx"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none py-1 text-center">
                      <span className="text-xs font-bold text-white block">
                        {skillsCount}
                      </span>
                      <span className="text-[#828392] text-[10px] uppercase tracking-wider">
                        Habilidades
                      </span>
                    </div>
                    <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none py-1 text-center">
                      <span className="text-xs font-bold text-white block">
                        {variablesCount}
                      </span>
                      <span className="text-[#828392] text-[10px] uppercase tracking-wider">
                        Variáveis
                      </span>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="pt-2 border-t border-[#1a1a24]">
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
                      className="w-full bg-[#0c0c10] border border-[#202028] focus:border-[var(--op-red)] outline-none rounded-none p-2 text-xs text-[#9ca3af] resize-none"
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
                    className="flex-1 py-2 bg-[#121217] hover:bg-[#181820] border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] text-[#60a5fa] rounded-none text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px]"
                  >
                    <Maximize2 size={13} />
                    <span>Abrir ficha completa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
