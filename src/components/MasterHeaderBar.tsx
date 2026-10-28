import React from "react";
import {
  Users,
  Music,
  Files,
  ArrowLeft,
  LayoutGrid,
  List,
  Trash2,
  Flame,
  EyeOff,
  Menu,
} from "lucide-react";
import { GameMode } from "../types";

export interface MasterHeaderBarProps {
  activeTab: "fichas" | "ost" | "extras";
  setActiveTab: (tab: "fichas" | "ost" | "extras") => void;
  playersCount: number;
  extrasCount: number;
  isOstPlaying: boolean;
  onRollInitiative?: () => void;
  onReturnToMainSheet: () => void;
  onOpenMenu?: () => void;
  viewMode?: "grid" | "list";
  setViewMode?: (mode: "grid" | "list") => void;
  onClearChatHistory?: () => void;
  currentGlobalMode?: GameMode;
  onOpenModeModal?: () => void;
}

export function MasterHeaderBar({
  activeTab,
  setActiveTab,
  playersCount,
  extrasCount,
  isOstPlaying,
  onReturnToMainSheet,
  onOpenMenu,
  viewMode = "grid",
  setViewMode,
  onClearChatHistory,
  currentGlobalMode = "demologia",
  onOpenModeModal,
}: MasterHeaderBarProps) {
  const tabs = [
    {
      id: "fichas" as const,
      label: "Iniciativas",
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
    <header
      className="w-full bg-[#0a0a0e]/95 backdrop-blur-md border-b border-[#1c1c24] sticky top-0 z-30 font-mono"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 py-2">
          {/* Esquerda: Menu (mobile) + Voltar + Abas Dinâmicas */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="lg:hidden w-10 h-10 flex items-center justify-center bg-[#111117] hover:bg-[#191922] active:bg-[#22222e] active:scale-95 text-[#dedede] hover:text-white border border-[#242430] rounded-none transition-all duration-150 ease-out cursor-pointer touch-manipulation shrink-0"
                aria-label="Abrir menu de navegação"
                title="Menu"
              >
                <Menu size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={onReturnToMainSheet}
              className="group inline-flex items-center justify-center gap-1.5 px-2.5 h-10 bg-[#111117] hover:bg-[#191922] active:scale-95 text-[#9ca3af] hover:text-white border border-[#20202a] rounded-none text-xs font-mono uppercase transition-all duration-150 ease-out cursor-pointer touch-manipulation shrink-0"
              title="Voltar para a Ficha"
              aria-label="Voltar para a Ficha"
            >
              <ArrowLeft size={14} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Ficha</span>
            </button>

            <div className="h-5 w-[1px] bg-[#1f1f29] mx-0.5 shrink-0" />

            <nav aria-label="Abas do Mestre" className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 h-10 text-xs font-mono uppercase tracking-wider rounded-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] cursor-pointer select-none touch-manipulation shrink-0 ${
                      isActive
                        ? "bg-[rgba(181,42,48,0.16)] text-white font-bold"
                        : "text-[#8a8b9a] hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon
                      size={14}
                      className={`transition-transform duration-200 group-hover:scale-105 ${
                        isActive ? "text-[var(--op-red-bright)]" : "text-[#707180] group-hover:text-gray-300"
                      }`}
                    />
                    <span>{tab.label}</span>

                    {tab.isActiveTrack && (
                      <span
                        className="w-1.5 h-1.5 bg-[var(--op-red-bright)] rounded-full animate-pulse"
                        title="Reproduzindo áudio"
                      />
                    )}

                    {tab.count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 font-mono tabular-nums transition-colors duration-200 ${
                          isActive
                            ? "bg-[var(--op-red)]/30 text-white font-bold"
                            : "bg-[#15151d] text-[#707180]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}

                    {/* Indicador inferior ativo com animação suave */}
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] origin-center transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isActive
                          ? "bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24] opacity-100 scale-x-100"
                          : "opacity-0 scale-x-0 group-hover:opacity-40 group-hover:scale-x-50 bg-white/40"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Direita: Controles Rápidos enxutos */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {activeTab === "fichas" && setViewMode && (
              <div className="flex items-center bg-[#101016] border border-[#20202a] p-0.5 rounded-none">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`w-9 h-9 flex items-center justify-center rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation ${
                    viewMode === "grid"
                      ? "bg-[rgba(181,42,48,0.22)] text-[var(--op-red-bright)]"
                      : "text-[#767786] hover:text-white"
                  }`}
                  title="Grade"
                  aria-label="Exibição em Grade"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`w-9 h-9 flex items-center justify-center rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation ${
                    viewMode === "list"
                      ? "bg-[rgba(181,42,48,0.22)] text-[var(--op-red-bright)]"
                      : "text-[#767786] hover:text-white"
                  }`}
                  title="Lista"
                  aria-label="Exibição em Lista"
                >
                  <List size={14} />
                </button>
              </div>
            )}

            {onOpenModeModal && (
              <button
                type="button"
                onClick={onOpenModeModal}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-10 text-xs uppercase tracking-wider font-mono rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation border ${
                  currentGlobalMode === "rl"
                    ? "bg-[#180f24] hover:bg-[#241636] text-purple-200 border-purple-500/45"
                    : "bg-[#150b0d] hover:bg-[#221014] text-[#ff8085] hover:text-white border-[#8f171c]/45"
                }`}
                title="Alternar modo (Demologia / Real L)"
              >
                {currentGlobalMode === "rl" ? (
                  <>
                    <EyeOff size={13} className="text-purple-300" />
                    <span className="hidden xs:inline">Real L</span>
                  </>
                ) : (
                  <>
                    <Flame size={13} className="text-[#ff5258]" />
                    <span className="hidden xs:inline">Demologia</span>
                  </>
                )}
              </button>
            )}

            {onClearChatHistory && (
              <button
                type="button"
                onClick={onClearChatHistory}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 bg-[#111117] hover:bg-red-950/40 active:scale-95 text-[#8e90a0] hover:text-red-400 border border-[#20202a] hover:border-red-900/50 text-xs uppercase tracking-wider font-mono rounded-none transition-all duration-150 cursor-pointer touch-manipulation"
                title="Limpar histórico do Chat"
                aria-label="Limpar histórico do Chat"
              >
                <Trash2 size={13} className="text-red-500/90" />
                <span className="hidden md:inline">Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
