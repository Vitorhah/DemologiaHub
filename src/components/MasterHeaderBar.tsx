import React from "react";
import {
  Users,
  Music,
  Files,
  Dices,
  ArrowLeft,
  LayoutGrid,
  List,
} from "lucide-react";

export interface MasterHeaderBarProps {
  activeTab: "fichas" | "ost" | "extras";
  setActiveTab: (tab: "fichas" | "ost" | "extras") => void;
  playersCount: number;
  extrasCount: number;
  isOstPlaying: boolean;
  onRollInitiative?: () => void;
  onReturnToMainSheet: () => void;
  viewMode?: "grid" | "list";
  setViewMode?: (mode: "grid" | "list") => void;
}

export function MasterHeaderBar({
  activeTab,
  setActiveTab,
  playersCount,
  extrasCount,
  isOstPlaying,
  onRollInitiative,
  onReturnToMainSheet,
  viewMode = "grid",
  setViewMode,
}: MasterHeaderBarProps) {
  const tabs = [
    {
      id: "fichas" as const,
      label: "Jogadores",
      icon: Users,
      count: playersCount,
    },
    {
      id: "ost" as const,
      label: "Trilhas",
      icon: Music,
      isActiveTrack: isOstPlaying,
    },
    {
      id: "extras" as const,
      label: "Extras",
      icon: Files,
      count: extrasCount,
    },
  ];

  return (
    <div className="w-full bg-[#0c0c10] border-b border-[#1f1f26] outline outline-1 outline-[#16161d] sticky top-0 z-30 font-mono">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Lado Esquerdo: Voltar e Título Limpo */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <button
              type="button"
              onClick={onReturnToMainSheet}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#121217] hover:bg-[#181820] border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] text-[#9ca3af] hover:text-white rounded-none text-xs font-mono uppercase transition-all cursor-pointer min-h-[38px]"
              title="Voltar para a ficha"
            >
              <ArrowLeft size={14} />
              <span>Voltar</span>
            </button>

            <div className="h-4 w-[1px] bg-[#22222a] hidden sm:block" />

            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 bg-[var(--op-red-bright)] rounded-none outline outline-1 outline-[var(--op-red)]/60 shadow-[0_0_6px_rgba(181,42,48,0.7)]"
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Mestre
              </span>
              <span className="text-xs text-[#828392]">
                ({playersCount} online)
              </span>
            </div>
          </div>

          {/* Centro: Abas de navegação simplificadas com estilo da sidebar */}
          <nav
            aria-label="Navegação do Mestre"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-none transition-all cursor-pointer select-none min-h-[38px] ${
                    isActive
                      ? "bg-[rgba(181,42,48,0.2)] text-white border border-[var(--op-red)] outline outline-1 outline-[var(--op-red-bright)]/50 font-bold shadow-sm"
                      : "bg-[#101015] hover:bg-[#15151c] text-[#9ca3af] hover:text-white border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a]"
                  }`}
                >
                  <Icon
                    size={14}
                    className={isActive ? "text-[var(--op-red-bright)]" : "text-[#767786]"}
                  />
                  <span>{tab.label}</span>

                  {tab.isActiveTrack && (
                    <span
                      className="w-1.5 h-1.5 bg-[var(--op-red-bright)] rounded-none"
                      title="Reproduzindo áudio"
                    />
                  )}

                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1 py-0 font-mono ${
                        isActive ? "text-white/90 font-bold" : "text-[#707180]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Lado Direito: Ações rápidas */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {activeTab === "fichas" && (
              <>
                {setViewMode && (
                  <div className="flex items-center bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] p-0.5 rounded-none">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-none text-xs transition-colors cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-[rgba(181,42,48,0.2)] text-[var(--op-red-bright)] border border-[var(--op-red)]/50"
                          : "text-[#767786] hover:text-white"
                      }`}
                      title="Exibição em Grade"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-none text-xs transition-colors cursor-pointer ${
                        viewMode === "list"
                          ? "bg-[rgba(181,42,48,0.2)] text-[var(--op-red-bright)] border border-[var(--op-red)]/50"
                          : "text-[#767786] hover:text-white"
                      }`}
                      title="Exibição em Lista"
                    >
                      <List size={15} />
                    </button>
                  </div>
                )}
                {onRollInitiative && (
                  <button
                    type="button"
                    onClick={onRollInitiative}
                    className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-3 py-2 bg-[#101015] hover:bg-[#15151c] text-[#9ca3af] hover:text-white text-xs uppercase tracking-wider font-mono rounded-none border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] transition-all cursor-pointer min-h-[38px]"
                    title="Rolar iniciativa de todos os participantes"
                  >
                    <Dices size={14} className="text-[var(--op-red-bright)]" />
                    <span>Iniciativas</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
