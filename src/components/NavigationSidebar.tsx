import React, { useEffect, useRef, useState } from "react";
import {
  User,
  Dices,
  ShieldAlert,
  Radio,
  Maximize,
  FileText,
  X,
  MessageSquare,
  Flame,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { GameMode } from "../types";
import demologiaLogoUrl from "../assets/demologia_logo.png";

export interface NavigationSidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  isMestreAuth: boolean;
  setShowPasswordModal: (show: boolean) => void;
  setActiveFichaId: (id: string) => void;
  setShowUpdateLog: (show: boolean) => void;
  gameMode?: GameMode;
  onOpenModeModal?: () => void;
  isOnline?: boolean;
}

export const NavigationSidebar = React.memo(function NavigationSidebar({
  currentPage,
  setCurrentPage,
  menuOpen,
  setMenuOpen,
  isMestreAuth,
  setShowPasswordModal,
  setActiveFichaId,
  setShowUpdateLog,
  gameMode = "demologia",
  onOpenModeModal,
  isOnline = false,
}: NavigationSidebarProps) {
  const isRlMode = gameMode === "rl";
  const [collapsed, setCollapsed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // Fecha com a tecla Esc e trava o scroll do body quando a gaveta mobile está aberta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    if (menuOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen, setMenuOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    if (endX - touchStartXRef.current < -45) {
      setMenuOpen(false);
    }
    touchStartXRef.current = null;
  };

  const scrollToSection = (sectionSelector?: string) => {
    if (sectionSelector) {
      setTimeout(() => {
        const el = document.querySelector(sectionSelector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNavClick = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  const isSheetPage = currentPage === "ficha" || currentPage === "ficha_extra";

  const navItems = [
    {
      id: "ficha",
      label: "Ficha",
      icon: User,
      isActive: isSheetPage,
      onClick: () => {
        setActiveFichaId("main");
        setCurrentPage("ficha");
        scrollToSection();
      },
    },
    {
      id: "dados",
      label: "Dados",
      icon: Dices,
      isActive: currentPage === "oraculo",
      onClick: () => setCurrentPage("oraculo"),
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      isActive: currentPage === "chat",
      onClick: () => setCurrentPage("chat"),
    },
    ...(isRlMode
      ? [
          {
            id: "caderno",
            label: "Caderno",
            icon: FileText,
            isActive: currentPage === "caderno",
            onClick: () => setCurrentPage("caderno"),
          },
        ]
      : []),
    {
      id: "conexao",
      label: "Conexão",
      icon: Radio,
      isActive: currentPage === "conexao",
      statusDot: isOnline ? "online" : "offline",
      onClick: () => setCurrentPage("conexao"),
    },
    {
      id: "mestre",
      label: "Mestre",
      icon: ShieldAlert,
      isActive: currentPage === "mestre",
      onClick: () => {
        if (!isMestreAuth) {
          setShowPasswordModal(true);
        } else {
          setCurrentPage("mestre");
        }
      },
    },
  ];

  const sheetQuickJumps = [
    { label: "Status", selector: ".hud-container" },
    ...(!isRlMode ? [{ label: "Skills", selector: ".skills-section" }] : []),
    { label: "Itens", selector: ".inv-grid" },
  ];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <aside
      aria-label="Menu de Navegação Principal"
      className={`${
        collapsed ? "lg:w-[68px]" : "lg:w-56 xl:w-60"
      } lg:shrink-0 lg:sticky lg:top-0 lg:h-[100dvh] lg:z-30 transition-[width] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width]`}
    >
      {/* Backdrop mobile com fade escuro de opacidade reduzida e desfoque */}
      <div
        className={`fixed inset-0 z-50 bg-[#06060a]/55 backdrop-blur-md transition-opacity duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Gaveta mobile & Sidebar dinâmica no Desktop */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 max-w-[82vw] lg:static lg:w-full lg:max-w-none lg:h-[100dvh] bg-[#0a0a0e]/95 backdrop-blur-md border-r border-[#1c1c24] flex flex-col justify-between p-3 shadow-2xl lg:shadow-none transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform select-none ${
          menuOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none lg:translate-x-0 lg:pointer-events-auto"
        }`}
        style={{
          paddingTop: "max(0.875rem, env(safe-area-inset-top, 0.875rem))",
          paddingBottom: "max(0.875rem, env(safe-area-inset-bottom, 0.875rem))",
        }}
        role="navigation"
        aria-label="Painel de Navegação"
      >
        {/* TOPO: Marca + Seletor de Modo + Colapsar/Fechar */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className={`flex items-center ${
              collapsed ? "lg:justify-center" : "justify-between"
            } pb-3 mb-3 border-b border-[#181820] shrink-0 gap-2`}
          >
            <button
              type="button"
              onClick={() =>
                handleNavClick(() => {
                  setActiveFichaId("main");
                  setCurrentPage("ficha");
                  scrollToSection();
                })
              }
              className={`flex items-center gap-2.5 min-w-0 cursor-pointer group active:scale-[0.98] transition-transform duration-150 ${
                collapsed ? "lg:hidden" : ""
              }`}
              title="Ir para a Ficha"
            >
              <img
                src={demologiaLogoUrl}
                alt="Demologia"
                className="w-6 h-6 object-cover rounded-none border border-[#2a2a34] group-hover:border-[var(--op-red)] transition-colors duration-200 shrink-0"
              />
              <span className="font-mono text-xs font-bold tracking-[0.18em] text-[#eeeeee] uppercase truncate">
                Demologya
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              {!collapsed &&
                (isMestreAuth && onOpenModeModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenModeModal();
                      setMenuOpen(false);
                    }}
                    className={`min-h-[30px] text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-none border transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1 ${
                      isRlMode
                        ? "bg-purple-950/50 hover:bg-purple-900/70 text-purple-200 border-purple-500/40"
                        : "bg-[var(--op-red)]/15 hover:bg-[var(--op-red)]/30 text-[var(--op-red-bright)] border-[var(--op-red)]/35"
                    }`}
                    title="Alternar modo de jogo"
                  >
                    {isRlMode ? <EyeOff size={11} /> : <Flame size={11} />}
                    <span>{isRlMode ? "RL" : "Demo"}</span>
                  </button>
                ) : null)}

              {/* Botão colapsar (somente PC) */}
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden lg:flex w-9 h-9 items-center justify-center text-[#787988] hover:text-white hover:bg-white/[0.05] active:scale-95 rounded-none transition-all duration-150 cursor-pointer"
                title={collapsed ? "Expandir menu" : "Recolher menu"}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              >
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>

              {/* Botão fechar (somente Mobile) */}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="lg:hidden min-w-[44px] min-h-[44px] rounded-none flex items-center justify-center text-[#9ca3af] hover:text-white active:scale-95 bg-[#121217] border border-[#22222a] transition-all duration-150 cursor-pointer touch-manipulation"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* LISTA PRINCIPAL DE NAVEGAÇÃO */}
          <nav
            className="flex-1 overflow-y-auto overscroll-contain space-y-1"
            aria-label="Navegação Principal"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive;

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(item.onClick)}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`group relative w-full flex items-center ${
                      collapsed ? "lg:justify-center lg:px-0" : "justify-between px-3"
                    } py-2.5 min-h-[44px] rounded-none text-xs font-mono tracking-wider uppercase transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] cursor-pointer select-none touch-manipulation ${
                      active
                        ? isRlMode
                          ? "bg-purple-950/40 text-white font-bold"
                          : "bg-[rgba(181,42,48,0.16)] text-white font-bold"
                        : "text-[#8e90a0] hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Barra vertical dinâmica de item ativo */}
                    <span
                      className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] origin-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        active
                          ? isRlMode
                            ? "bg-[#c084fc] shadow-[0_0_8px_#a855f7] opacity-100 scale-y-100"
                            : "bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24] opacity-100 scale-y-100"
                          : "opacity-0 scale-y-0 group-hover:opacity-40 group-hover:scale-y-50 bg-white/40"
                      }`}
                    />

                    <div
                      className={`flex items-center gap-3 min-w-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        collapsed ? "" : "group-hover:translate-x-0.5"
                      }`}
                    >
                      <div className="relative flex items-center justify-center shrink-0 transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95">
                        <Icon
                          size={17}
                          className={
                            active
                              ? isRlMode
                                ? "text-[#c084fc]"
                                : "text-[var(--op-red-bright)]"
                              : "text-[#7c7d8c] group-hover:text-white transition-colors duration-150"
                          }
                        />
                        {item.statusDot && (
                          <span
                            className={`
                              absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a0a0e]
                              ${
                                item.statusDot === "online"
                                  ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                                  : "bg-[#555666]"
                              }
                            `}
                          />
                        )}
                      </div>
                      <span
                        className={`truncate text-xs tracking-wider transition-opacity duration-150 ${
                          collapsed ? "lg:hidden" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </button>

                  {/* Sub-atalhos dinâmicos da Ficha (aparecem apenas quando na Ficha e menu expandido) */}
                  {item.id === "ficha" && active && (
                    <div
                      className={`grid grid-cols-3 gap-1 pt-1 pb-1.5 pl-3 pr-1 animate-subitems-in ${
                        collapsed ? "lg:hidden" : ""
                      }`}
                    >
                      {sheetQuickJumps.map((jump) => (
                        <button
                          key={jump.label}
                          type="button"
                          onClick={() =>
                            handleNavClick(() => {
                              scrollToSection(jump.selector);
                            })
                          }
                          className="min-h-[32px] px-1.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#828392] hover:text-white bg-[#111117] hover:bg-[#191922] active:scale-95 border border-[#1e1e28] rounded-none transition-all duration-150 cursor-pointer text-center truncate touch-manipulation"
                        >
                          {jump.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* RODAPÉ MINIMALISTA: Tela Cheia & Logs */}
        <div
          className={`pt-2.5 border-t border-[#181820] shrink-0 flex ${
            collapsed ? "lg:flex-col" : "flex-row"
          } gap-1.5`}
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] px-2 rounded-none bg-[#101015] hover:bg-[#17171f] active:scale-95 text-[#828392] hover:text-white border border-[#1e1e26] transition-all cursor-pointer text-[11px] font-mono uppercase touch-manipulation"
            title="Tela cheia"
            aria-label="Alternar Tela Cheia"
          >
            <Maximize size={14} className="shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>Tela</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowUpdateLog(true);
              setMenuOpen(false);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] px-2 rounded-none bg-[#101015] hover:bg-[#17171f] active:scale-95 text-[#828392] hover:text-white border border-[#1e1e26] transition-all cursor-pointer text-[11px] font-mono uppercase touch-manipulation"
            title="Histórico de Atualizações"
            aria-label="Histórico de Atualizações"
          >
            <FileText size={14} className="shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>Logs</span>
          </button>
        </div>
      </div>
    </aside>
  );
});
