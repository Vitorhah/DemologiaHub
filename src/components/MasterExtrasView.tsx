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
  FileText,
} from "lucide-react";

export interface MasterExtrasViewProps {
  extraFichas: any[];
  setExtraFichas: React.Dispatch<React.SetStateAction<any[]>>;
  defaultState: any;
  activeFichaId: string;
  setActiveFichaId: (id: string) => void;
  setCurrentPage: (page: string) => void;
  setMestreTab: (tab: "fichas" | "ost" | "eventos" | "extras") => void;
  toggleFichaSync: (ficha: any) => void;
  supabase: any;
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
    <div className="max-w-6xl mx-auto flex flex-col gap-5 px-4 font-sans">
      {/* Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#14151c] border border-[#262835] rounded-none p-4 shadow-sm">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-white">
            Fichas Extras e NPCs
          </h2>
          <p className="text-xs text-[#8f909e] mt-0.5">
            Crie fichas complementares para NPCs ou criaturas e sincronize com a sessão.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white text-xs font-medium rounded-none transition-colors cursor-pointer shrink-0"
        >
          <Plus size={14} />
          <span>Nova Ficha Extra</span>
        </button>
      </div>

      {/* Grid de Fichas Extras */}
      {extraFichas.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center border border-[#272935] bg-[#14151c] rounded-none">
          <Files size={36} className="text-[#626475] mb-2.5 opacity-60" />
          <h4 className="text-sm font-semibold text-white">
            Nenhuma ficha extra cadastrada
          </h4>
          <p className="text-xs text-[#8f909d] max-w-xs mt-1">
            Clique no botão acima para adicionar uma ficha de NPC ou personagem secundário.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {extraFichas.map((ficha) => {
            const hpCurrent = ficha.hp?.current ?? ficha.hpCurrent ?? 100;
            const hpMax = ficha.hp?.max ?? ficha.hpMax ?? 100;
            const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

            const peCurrent = ficha.pe?.current ?? 60;
            const peMax = ficha.pe?.max ?? 60;
            const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

            const skillsCount = ficha.skills?.length ?? 0;
            const variablesCount = Object.keys(ficha.variables || {}).length;

            return (
              <div
                key={ficha.id}
                className={`bg-[#14151c] border rounded-none p-4 shadow-sm flex flex-col justify-between transition-all ${
                  ficha.synchronized
                    ? "border-blue-800/60"
                    : "border-[#262835] hover:border-[#353849]"
                }`}
              >
                <div>
                  {/* Topo do Card */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      {ficha.synchronized && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-medium mb-1">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          Sincronizado na sessão
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
                        className="bg-transparent text-white font-semibold text-sm border-b border-transparent focus:border-red-500 outline-none w-full min-w-0 pb-0.5"
                        placeholder="Nome da ficha..."
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFichaSync(ficha)}
                        title={ficha.synchronized ? "Desativar sincronização" : "Sincronizar com a sessão"}
                        className={`p-1.5 rounded-none transition-colors cursor-pointer ${
                          ficha.synchronized
                            ? "text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-800/40"
                            : "text-[#71717a] hover:text-white bg-[#1a1c24] border border-[#2b2d3b]"
                        }`}
                      >
                        {ficha.synchronized ? <Cloud size={14} /> : <CloudOff size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(ficha)}
                        title="Duplicar ficha"
                        className="p-1.5 text-[#71717a] hover:text-white bg-[#1a1c24] border border-[#2b2d3b] rounded-none transition-colors cursor-pointer"
                      >
                        <Copy size={14} />
                      </button>

                      {deletingFichaId === ficha.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirm(ficha)}
                            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium rounded-none"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingFichaId(null)}
                            className="px-1.5 py-0.5 bg-[#252735] text-[#c4c4cc] text-[11px] rounded-none"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingFichaId(ficha.id)}
                          className="p-1.5 text-[#71717a] hover:text-red-400 bg-[#1a1c24] border border-[#2b2d3b] rounded-none transition-colors cursor-pointer"
                          title="Excluir ficha"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* HP & PE */}
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    {/* HP */}
                    <div className="bg-[#191b24] border border-[#242633] rounded-none p-2.5">
                      <div className="flex items-center justify-between text-xs text-[#8e8f9e] mb-1">
                        <span className="text-red-400 font-medium flex items-center gap-1">
                          <Heart size={12} /> HP
                        </span>
                        <span className="text-[11px]">{hpCurrent}/{hpMax}</span>
                      </div>
                      <div className="h-1.5 bg-[#12131a] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-red-600 rounded-full transition-all duration-200"
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
                          className="w-1/2 bg-[#14151c] border border-[#2d2f3d] focus:border-red-500 text-white text-xs text-center py-0.5 rounded-none outline-none"
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
                          className="w-1/2 bg-[#14151c] border border-[#2d2f3d] focus:border-red-500 text-[#8e8f9e] text-xs text-center py-0.5 rounded-none outline-none"
                          placeholder="Máx"
                        />
                      </div>
                    </div>

                    {/* PE */}
                    <div className="bg-[#191b24] border border-[#242633] rounded-none p-2.5">
                      <div className="flex items-center justify-between text-xs text-[#8e8f9e] mb-1">
                        <span className="text-blue-400 font-medium flex items-center gap-1">
                          <Zap size={12} /> PE
                        </span>
                        <span className="text-[11px]">{peCurrent}/{peMax}</span>
                      </div>
                      <div className="h-1.5 bg-[#12131a] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-200"
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
                          className="w-1/2 bg-[#14151c] border border-[#2d2f3d] focus:border-blue-500 text-white text-xs text-center py-0.5 rounded-none outline-none"
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
                          className="w-1/2 bg-[#14151c] border border-[#2d2f3d] focus:border-blue-500 text-[#8e8f9e] text-xs text-center py-0.5 rounded-none outline-none"
                          placeholder="Máx"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-[#191b24] border border-[#242633] rounded-none py-1 text-center">
                      <span className="text-xs font-semibold text-white block">
                        {skillsCount}
                      </span>
                      <span className="text-[#71717a] text-[10px]">
                        Habilidades
                      </span>
                    </div>
                    <div className="bg-[#191b24] border border-[#242633] rounded-none py-1 text-center">
                      <span className="text-xs font-semibold text-white block">
                        {variablesCount}
                      </span>
                      <span className="text-[#71717a] text-[10px]">
                        Variáveis
                      </span>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="pt-2 border-t border-[#222430]">
                    <div className="text-[11px] text-[#8e8f9e] font-medium mb-1 flex items-center gap-1">
                      <FileText size={12} /> Anotações:
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
                      placeholder="Anotações sobre a ficha..."
                      className="w-full bg-[#191b24] border border-[#242633] focus:border-red-500 text-xs text-[#c4c4cc] p-2 rounded-none outline-none resize-none h-14"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFichaId(ficha.id);
                    setCurrentPage("ficha_extra");
                    setMestreTab("fichas");
                  }}
                  className="w-full mt-3 py-1.5 bg-[#1f212c] hover:bg-[#282a38] text-white rounded-none text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 size={13} />
                  <span>Abrir ficha completa</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
