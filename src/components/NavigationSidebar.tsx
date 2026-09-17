import React from "react";
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
  Menu,
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
    // Fecha o menu gaveta ao selecionar um item (padrão YouTube)
    setMenuOpen(false);
  };

  const navItems = [
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
      id: "dados",
      label: "Rolar dados",
      icon: Dices,
      isActive: currentPage === "oraculo",
      onClick: () => {
        setCurrentPage("oraculo");
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

  return (
    <aside aria-label="Menu de Navegação Principal">
      {/* 1. Backdrop escuro e suave ao abrir o menu (padrão YouTube) */}
      <div
        className={`fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] transition-opacity duration-200 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* 2. Gaveta lateral deslizante estruturada e quadrada (padrão YouTube) */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 sm:w-72 bg-[#0e0e11] border-r border-[#26262c] flex flex-col justify-between p-4 shadow-2xl transition-transform duration-200 ease-out select-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Painel de Navegação"
      >
        {/* PARTE SUPERIOR: CABEÇALHO E LISTA DE ITENS */}
        <div className="flex flex-col space-y-4">
          {/* CABEÇALHO DO MENU: BOTÃO HAMBÚRGUER + LOGO + BOTÃO FECHAR */}
          <div className="flex items-center justify-between pb-3 border-b border-[#222227]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-white/[0.06] text-[#99999f] hover:text-white rounded-none border border-[#26262c] transition-colors cursor-pointer"
                aria-label="Fechar menu"
                title="Fechar menu"
              >
                <Menu size={16} />
              </button>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold tracking-widest text-[#dedede] uppercase">
                  Dossiê
                </span>
                <span className="font-mono text-[9px] tracking-wider text-[var(--op-red-bright)] uppercase font-semibold">
                  Ordem Paranormal
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-1.5 text-[#68686e] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer rounded-none"
              aria-label="Fechar navegação"
            >
              <X size={16} />
            </button>
          </div>

          {/* RÓTULO DA SEÇÃO */}
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#68686e] uppercase px-1">
            // Navegação
          </span>

          {/* LISTA ESTRUTURADA DE NAVEGAÇÃO - DESIGN QUADRADO */}
          <nav className="flex flex-col space-y-1" aria-label="Rotas">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.onClick)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3.5 px-3 py-2.5 rounded-none text-xs font-mono tracking-wider uppercase transition-colors duration-150 cursor-pointer text-left min-h-[42px] border-l-[3px] focus-visible:outline-none focus-visible:bg-white/[0.06] ${
                    active
                      ? "bg-[rgba(143,23,28,0.18)] text-white border-[var(--op-red)] font-bold shadow-none"
                      : "bg-transparent text-[#99999f] hover:text-white hover:bg-white/[0.04] border-transparent"
                  }`}
                >
                  {/* Ícone */}
                  <Icon
                    size={16}
                    className={`shrink-0 transition-colors duration-150 ${
                      active
                        ? "text-[var(--op-red-bright)]"
                        : "text-[#68686e] group-hover:text-[#dedede]"
                    }`}
                  />

                  {/* Rótulo */}
                  <span className="truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* PARTE INFERIOR: CITAÇÃO EM CAIXA QUADRADA & UTILITÁRIOS */}
        <div className="pt-4 space-y-3 border-t border-[#222227]">
          {/* Citação estruturada no estilo dossiê */}
          <div className="border-l-2 border-[var(--op-red)] bg-[#131316] p-2.5 text-[11px] font-mono text-[#99999f] leading-relaxed">
            <p className="text-[10px] text-[#dedede]/90">
              &ldquo;O mundo é cruel,
            </p>
            <p className="text-[10px] text-[#dedede]/90">
              mas ainda há pessoas
            </p>
            <p className="text-[10px] text-[#dedede]/90">
              que sorriem.&rdquo;
            </p>
          </div>

          {/* Ações secundárias: Tela cheia e Logs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-none bg-[#131316] hover:bg-[#1c1c20] text-[#99999f] hover:text-white border border-[#26262c] transition-colors cursor-pointer text-[10px] font-mono uppercase"
              title="Alternar Tela Cheia"
            >
              <Maximize size={13} />
              <span>Tela</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUpdateLog(true);
                setMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-none bg-[#131316] hover:bg-[#1c1c20] text-[#99999f] hover:text-white border border-[#26262c] transition-colors cursor-pointer text-[10px] font-mono uppercase"
              title="Ver Histórico de Atualizações"
            >
              <FileText size={13} />
              <span>Logs</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
