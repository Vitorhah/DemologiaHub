import React from "react";
import {
  Users,
  Music,
  Zap,
  Files,
  Dices,
  Plus,
  ArrowLeft,
  LayoutGrid,
  List,
} from "lucide-react";

export interface MasterHeaderBarProps {
  activeTab: "fichas" | "ost" | "eventos" | "extras";
  setActiveTab: (tab: "fichas" | "ost" | "eventos" | "extras") => void;
  playersCount: number;
  extrasCount: number;
  eventsCount: number;
  isOstPlaying: boolean;
  onRollInitiative?: () => void;
  onAddExtraFicha?: () => void;
  onReturnToMainSheet: () => void;
  viewMode?: "grid" | "list";
  setViewMode?: (mode: "grid" | "list") => void;
}

export function MasterHeaderBar({
  activeTab,
  setActiveTab,
  playersCount,
  extrasCount,
  eventsCount,
  isOstPlaying,
  onRollInitiative,
  onAddExtraFicha,
  onReturnToMainSheet,
  viewMode = "grid",
  setViewMode,
}: MasterHeaderBarProps) {
  const tabs = [
    {
      id: "fichas" as const,
      label: "Jogadores",
      icon: Users,
      badge: playersCount,
    },
    {
      id: "ost" as const,
      label: "Trilha Sonora",
      icon: Music,
      isLive: isOstPlaying,
    },
    {
      id: "eventos" as const,
      label: "Eventos",
      icon: Zap,
      badge: eventsCount,
    },
    {
      id: "extras" as const,
      label: "Fichas Extras",
      icon: Files,
      badge: extrasCount,
    },
  ];

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-[var(--op-border)] sticky top-0 z-30 font-mono text-[var(--op-text)]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3">
          {/* Lado Esquerdo: Título e Voltar */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onReturnToMainSheet}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-[#111] hover:bg-[#1a1a1a] border border-[var(--op-border)] text-gray-400 hover:text-white rounded-none text-xs font-bold uppercase transition-colors cursor-pointer"
                title="Voltar para a ficha do jogador"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Voltar</span>
              </button>

              <div className="h-4 w-[1px] bg-[var(--op-border)]" />

              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  SYS.MASTER
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0a2010] border border-[#104020] text-[#00ff41] text-[10px] font-bold rounded-none uppercase">
                  <span className="w-1.5 h-1.5 bg-[#00ff41] rounded-none animate-pulse" />
                  {playersCount} ON
                </span>
              </div>
            </div>
          </div>

          {/* Centro: Abas de navegação */}
          <nav
            aria-label="Navegação do Mestre"
            className="flex items-center gap-1 bg-black p-1 rounded-none border border-[var(--op-border)] overflow-x-auto no-scrollbar w-full md:w-auto"
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
                  className={`flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-none transition-colors whitespace-nowrap cursor-pointer uppercase tracking-wider ${
                    isActive
                      ? "bg-[var(--op-red)] text-white shadow-sm"
                      : "text-gray-500 hover:text-white hover:bg-[#111]"
                  }`}
                >
                  <Icon size={13} className={isActive ? "text-white" : "text-gray-500"} />
                  <span>{tab.label}</span>

                  {tab.isLive && (
                    <span className="w-1.5 h-1.5 bg-red-300 rounded-none animate-ping ml-0.5" />
                  )}

                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[9px] px-1 py-0 rounded-none font-bold ml-1 ${
                        isActive
                          ? "bg-black/50 text-white border border-white/20"
                          : "bg-[#1a1a1a] text-gray-400 border border-[#333]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Lado Direito: Ações contextuais */}
          <div className="flex items-center justify-between w-full md:w-auto gap-2 shrink-0">
            {activeTab === "fichas" && (
              <>
                {setViewMode && (
                  <div className="flex items-center bg-black border border-[var(--op-border)] p-0.5 rounded-none">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-none text-xs transition-colors ${
                        viewMode === "grid"
                          ? "bg-[#222] text-[var(--op-red-bright)]"
                          : "text-gray-600 hover:text-white"
                      }`}
                      title="Grade"
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-none text-xs transition-colors ${
                        viewMode === "list"
                          ? "bg-[#222] text-[var(--op-red-bright)]"
                          : "text-gray-600 hover:text-white"
                      }`}
                      title="Lista"
                    >
                      <List size={14} />
                    </button>
                  </div>
                )}
                {onRollInitiative && (
                  <button
                    type="button"
                    onClick={onRollInitiative}
                    className="flex-1 md:flex-none inline-flex justify-center items-center gap-1.5 px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-gray-300 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded-none border border-[var(--op-border)] hover:border-gray-500 transition-colors cursor-pointer"
                    title="Rolar iniciativas para todos os participantes"
                  >
                    <Dices size={13} className="text-[var(--op-red-bright)]" />
                    <span>Iniciativas</span>
                  </button>
                )}
              </>
            )}

            {activeTab === "extras" && onAddExtraFicha && (
              <button
                type="button"
                onClick={onAddExtraFicha}
                className="w-full md:w-auto inline-flex justify-center items-center gap-1.5 px-3 py-1.5 bg-[var(--op-red)] hover:bg-red-800 text-white text-[10px] uppercase tracking-wider font-bold rounded-none border border-red-950 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Nova Ficha Extra</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
