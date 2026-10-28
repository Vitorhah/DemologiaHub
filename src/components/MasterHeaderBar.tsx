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
    <header className="w-full bg-[#0c0c10]/95 backdrop-blur-md border-b border-[#202028] sticky top-0 z-30 font-mono transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          {/* Esquerda: Botão Sidebar (Mobile) + Voltar + Abas com indicador inferior animado */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="lg:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] bg-[#121218] hover:bg-[#191922] active:scale-95 text-[#dedede] hover:text-white border border-[#24242e] rounded-none transition-all duration-150 cursor-pointer touch-manipulation shrink-0"
                title="Abrir menu lateral"
                aria-label="Abrir menu de navegação"
              >
                <Menu size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={onReturnToMainSheet}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] bg-[#121218] hover:bg-[#191922] active:scale-95 text-[#9ca3af] hover:text-white border border-[#22222c] hover:border-[#323240] rounded-none text-xs font-mono uppercase transition-all duration-150 cursor-pointer touch-manipulation shrink-0"
              title="Voltar para a Ficha"
              aria-label="Voltar para a Ficha"
            >
              <ArrowLeft size={14} />
              <span className="hidden xs:inline">Ficha</span>
            </button>

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
                    className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 min-h-[40px] text-xs font-mono uppercase tracking-wider rounded-none transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] cursor-pointer select-none touch-manipulation shrink-0 border ${
                      isActive
                        ? "bg-[#190a0d] text-white border-[#8f171c]/70 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "bg-transparent text-[#828392] border-transparent hover:text-[#d4d4dc] hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon
                      size={14}
                      className={`transition-transform duration-200 ${
                        isActive
                          ? "text-[var(--op-red-bright)] scale-105"
                          : "text-[#686875]"
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
                        className={`text-[10px] px-1.5 py-0.5 rounded-none font-mono tabular-nums transition-colors duration-200 ${
                          isActive
                            ? "bg-[var(--op-red)] text-white font-bold"
                            : "bg-[#16161e] text-[#8a8a98]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}

                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--op-red-bright)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center ${
                        isActive ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Direita: Controles Rápidos */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {activeTab === "fichas" && setViewMode && (
              <div className="flex items-center bg-[#121218] border border-[#22222c] p-0.5 rounded-none">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation ${
                    viewMode === "grid"
                      ? "bg-[#220a0e] text-[var(--op-red-bright)] border border-[#8f171c]/50"
                      : "text-[#787989] hover:text-white"
                  }`}
                  title="Grade"
                  aria-label="Exibição em Grade"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation ${
                    viewMode === "list"
                      ? "bg-[#220a0e] text-[var(--op-red-bright)] border border-[#8f171c]/50"
                      : "text-[#787989] hover:text-white"
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
                className={`inline-flex items-center gap-1.5 px-3 min-h-[38px] text-xs uppercase tracking-wider font-mono rounded-none transition-all duration-150 active:scale-95 cursor-pointer touch-manipulation border ${
                  currentGlobalMode === "rl"
                    ? "bg-[#180f24] hover:bg-[#221534] text-purple-200 border-purple-500/45"
                    : "bg-[#150b0d] hover:bg-[#200e12] text-[#ff8085] border-[#8f171c]/45"
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
                className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[38px] bg-[#121218] hover:bg-red-950/35 active:scale-95 text-[#8a8a98] hover:text-red-300 border border-[#22222c] hover:border-red-900/50 text-xs uppercase tracking-wider font-mono rounded-none transition-all duration-150 cursor-pointer touch-manipulation"
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
