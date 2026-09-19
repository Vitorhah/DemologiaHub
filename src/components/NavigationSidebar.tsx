import React, { useEffect } from "react";
import {
  Home,
  User,
  Sparkles,
  Dices,
  Package,
  ShieldAlert,
  Radio,
  Maximize,
  FileText,
  X,
  MessageSquare,
} from "lucide-react";

export interface NavigationSidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  isMestreAuth: boolean;
  setShowPasswordModal: (show: boolean) => void;
  setActiveFichaId: (id: string) => void;
  setShowUpdateLog: (show: boolean) => void;
}

export function NavigationSidebar({
  currentPage,
  setCurrentPage,
  menuOpen,
  setMenuOpen,
  isMestreAuth,
  setShowPasswordModal,
  setActiveFichaId,
  setShowUpdateLog,
}: NavigationSidebarProps) {
  // Fecha com a tecla Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, setMenuOpen]);

  // Rola suavemente até uma seção específica dentro da ficha se já estiver na página
  const scrollToSection = (sectionSelector?: string) => {
    if (sectionSelector) {
      setTimeout(() => {
        const el = document.querySelector(sectionSelector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNavClick = (action: () => void) => {
    action();
    // Fecha o menu gaveta ao selecionar um item
    setMenuOpen(false);
  };

  // Grupo 1: Ficha do Agente
  const agentNavItems = [
    {
      id: "inicio",
      label: "Início",
      icon: Home,
      isActive: currentPage === "ficha",
      onClick: () => {
        setActiveFichaId("main");
        setCurrentPage("ficha");
        scrollToSection();
      },
    },
    {
      id: "personagem",
      label: "Personagem",
      icon: User,
      isActive: currentPage === "ficha",
      onClick: () => {
        setActiveFichaId("main");
        setCurrentPage("ficha");
        scrollToSection(".hud-container");
      },
    },
    {
      id: "tecnicas",
      label: "Técnicas",
      icon: Sparkles,
      isActive: false,
      onClick: () => {
        setActiveFichaId("main");
        setCurrentPage("ficha");
        scrollToSection(".skill-list");
      },
    },
    {
      id: "inventario",
      label: "Inventário",
      icon: Package,
      isActive: false,
      onClick: () => {
        setActiveFichaId("main");
        setCurrentPage("ficha");
        scrollToSection(".inv-grid");
      },
    },
  ];

  // Grupo 2: Sistema e Operações
  const systemNavItems = [
    {
      id: "dados",
      label: "Rolar dados",
      icon: Dices,
      isActive: currentPage === "oraculo",
      onClick: () => {
        setCurrentPage("oraculo");
      },
    },
    {
      id: "chat",
      label: "Chat da Mesa",
      icon: MessageSquare,
      isActive: currentPage === "chat",
      onClick: () => {
        setCurrentPage("chat");
      },
    },
    {
      id: "conexao",
      label: "Conexão",
      icon: Radio,
      isActive: currentPage === "conexao",
      onClick: () => {
        setCurrentPage("conexao");
      },
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const renderNavButton = (item: {
    id: string;
    label: string;
    icon: React.ElementType;
    isActive: boolean;
    onClick: () => void;
  }) => {
    const Icon = item.icon;
    const active = item.isActive;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item.onClick)}
        aria-current={active ? "page" : undefined}
        className={`group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-xs font-mono tracking-wider uppercase transition-all duration-150 cursor-pointer text-left min-h-[46px] select-none ${
          active
            ? "bg-[rgba(181,42,48,0.2)] text-white border border-[var(--op-red)] outline outline-1 outline-[var(--op-red-bright)]/50 font-bold shadow-sm"
            : "bg-[#101015] hover:bg-[#15151c] text-[#9ca3af] hover:text-white border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a]"
        } focus-visible:outline-none focus-visible:outline-[var(--op-red-bright)]`}
      >
        {/* Ícone e Rótulo */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-7 h-7 rounded-none flex items-center justify-center shrink-0 transition-colors duration-150 ${
              active
                ? "bg-[var(--op-red-bright)]/25 text-[var(--op-red-bright)] outline outline-1 outline-[var(--op-red-bright)]/40"
                : "bg-white/[0.03] text-[#828392] group-hover:text-white group-hover:bg-white/[0.06] outline outline-1 outline-white/[0.06]"
            }`}
          >
            <Icon size={15} />
          </div>
          <span className="truncate text-xs tracking-wider">
            {item.label}
          </span>
        </div>

        {/* Indicador sutil de item ativo */}
        {active && (
          <div className="flex items-center shrink-0 pl-2">
            <span
              className="w-1.5 h-1.5 bg-[var(--op-red-bright)] rounded-none outline outline-1 outline-[var(--op-red)]/60 shadow-[0_0_6px_rgba(181,42,48,0.85)]"
              aria-hidden="true"
            />
          </div>
        )}
      </button>
    );
  };

  return (
    <aside aria-label="Menu de Navegação Principal">
      {/* 1. Backdrop escuro com blur moderno */}
      <div
        className={`fixed inset-0 z-50 bg-black/65 backdrop-blur-sm transition-opacity duration-200 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* 2. Gaveta lateral deslizante otimizada para Mobile (WebView) e Desktop */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-80 max-w-[85vw] bg-[#0c0c10] border-r border-[#1f1f26] outline outline-1 outline-[#16161d] flex flex-col justify-between p-4 sm:p-5 shadow-2xl transition-transform duration-200 ease-out select-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        style={{
          paddingTop: "max(1.25rem, env(safe-area-inset-top, 1.25rem))",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Painel de Navegação"
      >
        {/* PARTE SUPERIOR: CABEÇALHO & LISTA DE NAVEGAÇÃO */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* CABEÇALHO DO MENU */}
          <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-[#1c1c24] shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 bg-[var(--op-red-bright)] rounded-none outline outline-1 outline-[var(--op-red)]/60 shadow-[0_0_6px_rgba(181,42,48,0.7)]"
                aria-hidden="true"
              />
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#eeeeee] uppercase">
                Menu
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-8 h-8 rounded-none flex items-center justify-center text-[#9ca3af] hover:text-white bg-[#121217] hover:bg-[#181820] border border-[#22222a] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] transition-all cursor-pointer"
              aria-label="Fechar menu"
              title="Fechar (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* ITENS DE NAVEGAÇÃO COM ROLAGEM SUAVE TOUCH-FRIENDLY */}
          <div className="flex-1 overflow-y-auto overscroll-contain pr-1 py-2 space-y-4">
            {/* SEÇÃO: AGENTE */}
            <div>
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#636471] uppercase px-1 block mb-2">
                Agente
              </span>
              <nav className="flex flex-col space-y-1.5" aria-label="Rotas do Agente">
                {agentNavItems.map(renderNavButton)}
              </nav>
            </div>

            {/* SEÇÃO: SISTEMA */}
            <div>
              <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#636471] uppercase px-1 block mb-2">
                Sistema
              </span>
              <nav className="flex flex-col space-y-1.5" aria-label="Rotas do Sistema">
                {systemNavItems.map(renderNavButton)}
              </nav>
            </div>
          </div>
        </div>

        {/* PARTE INFERIOR: CITAÇÃO SUTIL & UTILITÁRIOS */}
        <div className="pt-3.5 space-y-3 border-t border-[#1c1c24] shrink-0">
          {/* Citação reflexiva */}
          <div className="px-3 py-2.5 rounded-none bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820]">
            <p className="text-[10px] font-mono text-[#828392] italic leading-relaxed text-center">
              &ldquo;O mundo é cruel, mas ainda há pessoas que sorriem.&rdquo;
            </p>
          </div>

          {/* Ações secundárias: Tela cheia e Logs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center justify-center gap-2 h-9 px-3 rounded-none bg-[#111116] hover:bg-[#16161d] text-[#9ca3af] hover:text-white border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] transition-all cursor-pointer text-[11px] font-mono uppercase"
              title="Alternar Tela Cheia"
            >
              <Maximize size={14} className="text-[#767786]" />
              <span>Tela cheia</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUpdateLog(true);
                setMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 h-9 px-3 rounded-none bg-[#111116] hover:bg-[#16161d] text-[#9ca3af] hover:text-white border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] transition-all cursor-pointer text-[11px] font-mono uppercase"
              title="Ver Histórico de Atualizações"
            >
              <FileText size={14} className="text-[#767786]" />
              <span>Logs</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
