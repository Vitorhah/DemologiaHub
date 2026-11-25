import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Edit2,
  FileText,
  Flame,
  Folder,
  FolderOpen,
  FolderPlus,
  Library,
  Plus,
  Search,
  Send,
  Shield,
  Skull,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GameMode } from "../types";
import {
  MASTER_LIBRARY_TYPE_META,
  MasterLibraryFolder,
  MasterLibraryItem,
  MasterLibraryItemType,
} from "../types/masterLibrary";
import { MasterDataPushPayload } from "../types/masterDataPush";
import { LibraryActionResult } from "../services/useMasterLibrarySync";
import {
  buildLibraryItemFilename,
  exportLibraryItemToJson,
  filterLibraryItems,
  getFolderBreadcrumb,
  getFolderPathLabel,
  getFolderStats,
  getLibraryItemDescription,
  getLibraryItemName,
  parseImportedLibraryJson,
} from "../utils/masterLibrary";
import { formatPdiModifierChips, PdiItem } from "../utils/pdi";
import { RITUAL_TEST_FORMULA, type RitualItem } from "../utils/rituals";
import { RitualAffiliationTag } from "./RitualsSection";
import { CLINICAL_EASE, MotionAccordion } from "./MotionPrimitives";
import { PdiEditorModal } from "./PdiEditorModal";
import { MasterLibraryItemModal } from "./MasterLibraryItemModal";
import {
  LibraryPlayerTarget,
  MasterLibrarySendModal,
} from "./MasterLibrarySendModal";
import { MasterNotesSection } from "./MasterNotesSection";
import { MasterCreaturesSection } from "./MasterCreaturesSection";

export interface MasterLibraryViewProps {
  masterId?: string | null;
  folders: MasterLibraryFolder[];
  items: MasterLibraryItem[];
  syncStatus: "synced" | "syncing" | "offline";
  syncError: string | null;
  players: Array<LibraryPlayerTarget & { rituals?: unknown }>;
  localPlayerRituals?: RitualItem[];
  localPlayerName?: string;
  extraFichas?: Record<string, any>[];
  defaultState?: Record<string, any>;
  currentGlobalMode?: GameMode;
  isSendingDataPush: boolean;
  onCreateFolder: (
    name: string,
    parentId: string | null
  ) => Promise<LibraryActionResult>;
  onRenameFolder: (
    folderId: string,
    newName: string
  ) => Promise<LibraryActionResult>;
  onDeleteFolder: (folderId: string) => Promise<LibraryActionResult>;
  onSaveItem: (item: MasterLibraryItem) => Promise<LibraryActionResult>;
  onDeleteItem: (itemId: string) => Promise<LibraryActionResult>;
  onMoveItemToFolder: (
    itemId: string,
    folderId: string | null
  ) => Promise<LibraryActionResult>;
  onSendDataToPlayers: (
    targetPlayerIds: string[],
    payload: MasterDataPushPayload
  ) => Promise<{ ok: boolean; updatedCount: number; error?: string }>;
  onInvokeCreatureSheets?: (
    sheets: Record<string, any>[]
  ) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  onOpenInitiativesTab?: () => void;
}

const ALL_TYPES: readonly MasterLibraryItemType[] = [
  "ritual",
  "skill",
  "pdi",
  "tributo",
];

function getTypeIcon(type: MasterLibraryItemType) {
  switch (type) {
    case "ritual":
      return Flame;
    case "skill":
      return Sparkles;
    case "pdi":
      return Shield;
    case "tributo":
      return BookOpen;
  }
}

export const MasterLibraryView: React.FC<MasterLibraryViewProps> = ({
  masterId,
  folders,
  items,
  syncStatus,
  syncError,
  players,
  localPlayerRituals = [],
  localPlayerName,
  extraFichas = [],
  defaultState = {},
  currentGlobalMode = "demologia",
  isSendingDataPush,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSaveItem,
  onDeleteItem,
  onMoveItemToFolder,
  onSendDataToPlayers,
  onInvokeCreatureSheets,
  onOpenInitiativesTab,
}) => {
  const [activeSection, setActiveSection] = useState<
    "arquivos" | "criaturas" | "anotacoes"
  >("arquivos");
  const [creaturesCount, setCreaturesCount] = useState<number | null>(null);
  const [notesCount, setNotesCount] = useState<number | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MasterLibraryItemType | "all">("all");

  // Folder UI state
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // Create file chooser & modals
  const [showCreateChooser, setShowCreateChooser] = useState(false);
  const [editorMode, setEditorMode] = useState<"ritual" | "skill" | "tributo" | null>(null);
  const [editingItem, setEditingItem] = useState<MasterLibraryItem | null>(null);

  // PDI native editor reuse
  const [pdiModalOpen, setPdiModalOpen] = useState(false);
  const [editingPdiItem, setEditingPdiItem] = useState<MasterLibraryItem | null>(null);

  // Send modal & inline delete confirm
  const [sendingItem, setSendingItem] = useState<MasterLibraryItem | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If currentFolderId no longer exists (e.g. deleted remotely), fall back to root
  const effectiveFolderId = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.some((f) => f.id === currentFolderId) ? currentFolderId : null;
  }, [currentFolderId, folders]);

  const breadcrumb = useMemo(
    () => getFolderBreadcrumb(folders, effectiveFolderId),
    [folders, effectiveFolderId]
  );

  const childFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders
      .filter((f) => f.parentId === effectiveFolderId)
      .filter((f) => (!q ? true : f.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [folders, effectiveFolderId, search]);

  const visibleItems = useMemo(
    () =>
      filterLibraryItems(items, {
        currentFolderId: effectiveFolderId,
        typeFilter,
        search,
        searchAllFolders: true,
      }),
    [items, effectiveFolderId, typeFilter, search]
  );

  const typeCounts = useMemo(() => {
    const inScope = search.trim()
      ? items
      : items.filter((it) => it.folderId === effectiveFolderId);
    return {
      all: inScope.length,
      ritual: inScope.filter((i) => i.type === "ritual").length,
      skill: inScope.filter((i) => i.type === "skill").length,
      pdi: inScope.filter((i) => i.type === "pdi").length,
      tributo: inScope.filter((i) => i.type === "tributo").length,
    };
  }, [items, effectiveFolderId, search]);

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await onCreateFolder(newFolderName, effectiveFolderId);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Não foi possível criar a pasta." });
      return;
    }
    setNewFolderName("");
    setShowNewFolderForm(false);
    setFeedback({
      type: "success",
      text: `Pasta "${res.folder?.name}" criada com sucesso.`,
    });
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent, folderId: string) => {
    e.preventDefault();
    setFeedback(null);
    const res = await onRenameFolder(folderId, renameDraft);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Não foi possível renomear a pasta." });
      return;
    }
    setRenamingFolderId(null);
    setRenameDraft("");
    setFeedback({ type: "success", text: "Pasta renomeada com sucesso." });
  };

  const handleConfirmDeleteFolder = async (folder: MasterLibraryFolder) => {
    setFeedback(null);
    const res = await onDeleteFolder(folder.id);
    setConfirmDeleteFolderId(null);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Erro ao excluir pasta." });
      return;
    }
    const movedMsg =
      res.movedItemsCount && res.movedItemsCount > 0
        ? ` ${res.movedItemsCount} arquivo(s) foram movidos para o diretório anterior.`
        : "";
    setFeedback({
      type: "info",
      text: `Pasta "${folder.name}" excluída.${movedMsg}`,
    });
  };

  const handleOpenCreateType = (type: MasterLibraryItemType) => {
    setShowCreateChooser(false);
    setFeedback(null);
    if (type === "pdi") {
      setEditingPdiItem(null);
      setPdiModalOpen(true);
    } else {
      setEditingItem(null);
      setEditorMode(type);
    }
  };

  const handleOpenEditItem = (item: MasterLibraryItem) => {
    setFeedback(null);
    if (item.type === "pdi") {
      setEditingPdiItem(item);
      setPdiModalOpen(true);
    } else {
      setEditingItem(item);
      setEditorMode(item.type);
    }
  };

  const handleSavePdiFromModal = async (pdiData: PdiItem) => {
    const now = Date.now();
    const itemToSave: MasterLibraryItem = editingPdiItem
      ? {
          id: editingPdiItem.id,
          type: "pdi",
          folderId: editingPdiItem.folderId,
          createdAt: editingPdiItem.createdAt,
          updatedAt: now,
          data: pdiData,
        }
      : {
          id: `lib_pdi_${now}_${Math.random().toString(36).slice(2, 6)}`,
          type: "pdi",
          folderId: effectiveFolderId,
          createdAt: now,
          updatedAt: now,
          data: pdiData,
        };

    const res = await onSaveItem(itemToSave);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Falha ao salvar PDI na Biblioteca." });
      return;
    }
    setFeedback({
      type: "success",
      text: `PDI "${pdiData.name}" salvo na Biblioteca.`,
    });
  };

  const handleSaveGenericItem = async (item: MasterLibraryItem) => {
    const res = await onSaveItem(item);
    if (!res.ok) {
      throw new Error(res.error || "Falha ao salvar arquivo na Biblioteca.");
    }
    const meta = MASTER_LIBRARY_TYPE_META[item.type];
    setFeedback({
      type: "success",
      text: `${meta.label} "${getLibraryItemName(item)}" salvo na Biblioteca.`,
    });
  };

  const handleDeleteItem = async (item: MasterLibraryItem) => {
    setConfirmDeleteItemId(null);
    const res = await onDeleteItem(item.id);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Erro ao excluir arquivo." });
      return;
    }
    setFeedback({
      type: "info",
      text: `"${getLibraryItemName(item)}" removido da Biblioteca.`,
    });
  };

  const handleExportJson = (item: MasterLibraryItem) => {
    try {
      const jsonStr = exportLibraryItemToJson(item);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildLibraryItemFilename(item);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({
        type: "success",
        text: `Arquivo "${buildLibraryItemFilename(item)}" exportado com sucesso.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Não foi possível gerar o download do arquivo JSON.",
      });
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so re-importing the same file works cleanly
    e.target.value = "";
    if (!file) return;

    setFeedback(null);
    try {
      const rawText = await file.text();
      const parsed = parseImportedLibraryJson(rawText, effectiveFolderId);
      if ("error" in parsed) {
        setFeedback({ type: "error", text: parsed.error });
        return;
      }
      const saved = await onSaveItem(parsed.item);
      if (!saved.ok) {
        setFeedback({
          type: "error",
          text: saved.error || "Erro ao salvar arquivo importado.",
        });
        return;
      }
      const meta = MASTER_LIBRARY_TYPE_META[parsed.item.type];
      setFeedback({
        type: "success",
        text: `${meta.label} "${getLibraryItemName(parsed.item)}" importado para ${getFolderPathLabel(folders, effectiveFolderId)}.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Erro ao ler o arquivo selecionado. Verifique se é um .json válido.",
      });
    }
  };

  const handleMoveItem = async (item: MasterLibraryItem, targetFolderId: string | null) => {
    const res = await onMoveItemToFolder(item.id, targetFolderId);
    if (!res.ok) {
      setFeedback({ type: "error", text: res.error || "Erro ao mover arquivo." });
      return;
    }
    setFeedback({
      type: "info",
      text: `"${getLibraryItemName(item)}" movido para ${getFolderPathLabel(folders, targetFolderId)}.`,
    });
  };

  return (
    <div
      className="w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 font-mono space-y-4 my-4"
      data-testid="master-library-view"
    >
      {/* Hidden JSON File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="Importar arquivo JSON para a Biblioteca"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {/* HEADER BAR (Mesmo padrão visual de HandoutsView / MasterUtilitiesView) */}
      <div className="bg-[#0c0c10] border border-[#202028] border-t-2 border-t-[var(--op-red)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-[0.2em] text-[#8e90a0]">
            <span>Acervo Central · Demologia</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span
              className={`inline-flex items-center gap-1 ${
                syncStatus === "synced"
                  ? "text-emerald-400"
                  : syncStatus === "syncing"
                    ? "text-amber-300"
                    : "text-zinc-500"
              }`}
            >
              <Cloud size={11} />
              {syncStatus === "synced"
                ? "Sincronizado"
                : syncStatus === "syncing"
                  ? "Sincronizando"
                  : "Local"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Library size={18} className="text-[var(--op-red-bright)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider truncate">
              Biblioteca do Mestre
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#14141c] border border-[#262634] text-[#9b9caa] tabular-nums shrink-0">
              {items.length} arquivo{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {activeSection === "arquivos" && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowCreateChooser(false);
                setShowNewFolderForm((p) => !p);
              }}
              className="min-h-[44px] sm:min-h-[42px] px-3 bg-[#14141c] hover:bg-[#1c1c28] text-zinc-200 border border-[#282834] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
            >
              <FolderPlus size={14} />
              <span>Nova Pasta</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] sm:min-h-[42px] px-3 bg-[#14141c] hover:bg-[#1c1c28] text-zinc-200 border border-[#282834] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
            >
              <Upload size={14} />
              <span>Importar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNewFolderForm(false);
                setShowCreateChooser((p) => !p);
              }}
              className="col-span-2 sm:col-span-1 min-h-[44px] sm:min-h-[42px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
            >
              <Plus size={15} />
              <span>Novo Arquivo</span>
            </button>
          </div>
        )}
      </div>

      {/* SEÇÕES DA BIBLIOTECA: ARQUIVOS / CRIATURAS / ANOTAÇÕES */}
      <div
        role="tablist"
        aria-label="Seções da Biblioteca do Mestre"
        className="grid grid-cols-3 bg-[#0c0c10] border border-[#202028] p-1 gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "arquivos"}
          data-testid="library-tab-arquivos"
          onClick={() => setActiveSection("arquivos")}
          className={`relative min-h-[44px] sm:min-h-[42px] px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 border transition-colors cursor-pointer touch-manipulation ${
            activeSection === "arquivos"
              ? "bg-[#151520] border-[var(--op-red)]/80 text-white"
              : "bg-transparent border-transparent text-[#8e90a0] hover:text-white hover:bg-[#111119]"
          }`}
        >
          {activeSection === "arquivos" && (
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--op-red)]" />
          )}
          <Library size={14} className="text-[var(--op-red-bright)] shrink-0" />
          <span className="truncate">Arquivos</span>
          <span className="text-[10px] text-[#8e90a0] tabular-nums hidden xs:inline">
            ({items.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "criaturas"}
          data-testid="library-tab-criaturas"
          onClick={() => setActiveSection("criaturas")}
          className={`relative min-h-[44px] sm:min-h-[42px] px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 border transition-colors cursor-pointer touch-manipulation ${
            activeSection === "criaturas"
              ? "bg-[#151520] border-[var(--op-red)]/80 text-white"
              : "bg-transparent border-transparent text-[#8e90a0] hover:text-white hover:bg-[#111119]"
          }`}
        >
          {activeSection === "criaturas" && (
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--op-red)]" />
          )}
          <Skull size={14} className="text-[var(--op-red-bright)] shrink-0" />
          <span className="truncate">Criaturas</span>
          {creaturesCount !== null && (
            <span className="text-[10px] text-[#8e90a0] tabular-nums hidden xs:inline">
              ({creaturesCount})
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "anotacoes"}
          data-testid="library-tab-anotacoes"
          onClick={() => setActiveSection("anotacoes")}
          className={`relative min-h-[44px] sm:min-h-[42px] px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 border transition-colors cursor-pointer touch-manipulation ${
            activeSection === "anotacoes"
              ? "bg-[#151520] border-[var(--op-red)]/80 text-white"
              : "bg-transparent border-transparent text-[#8e90a0] hover:text-white hover:bg-[#111119]"
          }`}
        >
          {activeSection === "anotacoes" && (
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--op-red)]" />
          )}
          <FileText size={14} className="text-[var(--op-red-bright)] shrink-0" />
          <span className="truncate">Anotações</span>
          {notesCount !== null && (
            <span className="text-[10px] text-[#8e90a0] tabular-nums hidden xs:inline">
              ({notesCount})
            </span>
          )}
        </button>
      </div>

      {activeSection === "anotacoes" ? (
        <MasterNotesSection
          masterId={masterId}
          onCountChange={setNotesCount}
        />
      ) : activeSection === "criaturas" ? (
        <MasterCreaturesSection
          masterId={masterId}
          libraryItems={items}
          players={players}
          localPlayerRituals={localPlayerRituals}
          localPlayerName={localPlayerName}
          extraFichas={extraFichas}
          defaultState={defaultState}
          currentGlobalMode={currentGlobalMode}
          onInvokeCreatureSheets={
            onInvokeCreatureSheets ||
            (async () => ({
              ok: false,
              error: "Invocação de criaturas indisponível nesta sessão.",
            }))
          }
          onOpenInitiativesTab={onOpenInitiativesTab}
          onCountChange={setCreaturesCount}
        />
      ) : (
        <>

      {/* FEEDBACK & SYNC ERRORS */}
      <AnimatePresence initial={false}>
        {(feedback || syncError) && (
          <motion.div
            key={feedback?.text || syncError || "msg"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: CLINICAL_EASE }}
            role={feedback?.type === "error" || syncError ? "alert" : "status"}
            className={`px-3.5 py-2.5 text-xs border flex items-center justify-between gap-2 ${
              feedback?.type === "error" || (!feedback && syncError)
                ? "bg-red-950/45 border-red-700/60 text-red-300"
                : feedback?.type === "success"
                  ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
                  : "bg-[#13131b] border-[#282834] text-[#c8c9d6]"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {feedback?.type === "error" || (!feedback && syncError) ? (
                <AlertTriangle size={14} className="shrink-0 text-red-400" />
              ) : (
                <CheckCircle2
                  size={14}
                  className={`shrink-0 ${
                    feedback?.type === "success"
                      ? "text-emerald-400"
                      : "text-[#8a8b99]"
                  }`}
                />
              )}
              <span className="break-words">{feedback?.text || syncError}</span>
            </div>
            {feedback && (
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Fechar aviso"
                className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW FOLDER INLINE FORM */}
      <MotionAccordion isOpen={showNewFolderForm}>
        <form
          onSubmit={handleCreateFolderSubmit}
          className="bg-[#0e0e14] border border-[#242430] p-3 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            maxLength={80}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={
              effectiveFolderId
                ? `Nova subpasta dentro de "${breadcrumb[breadcrumb.length - 1]?.name || ""}"...`
                : "Nome da pasta (ex: Rituais Nível 2, Skills de Combate, Campanha 01)..."
            }
            aria-label="Nome da nova pasta"
            className="flex-1 min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 text-xs text-white outline-none rounded-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[42px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Criar Pasta
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolderForm(false);
                setNewFolderName("");
              }}
              className="min-h-[42px] px-3 bg-[#16161f] text-zinc-300 border border-[#262632] text-xs uppercase cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </MotionAccordion>

      {/* NEW FILE TYPE CHOOSER */}
      <MotionAccordion isOpen={showCreateChooser}>
        <div
          className="bg-[#0e0e14] border border-[#282836] border-l-2 border-l-[var(--op-red)] p-3.5 space-y-2.5"
          data-testid="library-type-chooser"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              Escolha o tipo de arquivo para criar em{" "}
              <span className="text-[var(--op-red-bright)]">
                {getFolderPathLabel(folders, effectiveFolderId)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowCreateChooser(false)}
              aria-label="Fechar seletor de tipo"
              className="p-1 text-[#828392] hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {ALL_TYPES.map((type) => {
              const meta = MASTER_LIBRARY_TYPE_META[type];
              const Icon = getTypeIcon(type);
              return (
                <button
                  key={type}
                  type="button"
                  data-testid={`create-library-type-${type}`}
                  onClick={() => handleOpenCreateType(type)}
                  className="text-left p-3 bg-[#12121a] hover:bg-[#1a1014] border border-[#262634] hover:border-[#8f171c] transition-colors cursor-pointer touch-manipulation flex flex-col gap-1.5 rounded-none"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Icon size={14} className="text-[var(--op-red-bright)]" />
                    <span>{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-[#8c8d9c] leading-snug">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </MotionAccordion>

      {/* BREADCRUMB + SEARCH + TYPE FILTERS */}
      <div className="bg-[#0c0c10] border border-[#202028] p-3.5 space-y-3">
        {/* Breadcrumb bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1c1c26]">
          <nav
            aria-label="Caminho da Biblioteca"
            className="flex flex-wrap items-center gap-1 text-xs"
          >
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 border transition-colors cursor-pointer ${
                effectiveFolderId === null
                  ? "bg-[#190a0d] border-[#8f171c]/70 text-white font-bold"
                  : "bg-[#121218] border-[#242430] text-[#9b9caa] hover:text-white"
              }`}
            >
              <FolderOpen size={13} className="text-[var(--op-red-bright)]" />
              <span>Biblioteca</span>
            </button>

            {breadcrumb.map((folder, idx) => {
              const isLast = idx === breadcrumb.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight size={13} className="text-[#525264]" />
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`px-2 py-1 border transition-colors cursor-pointer max-w-[180px] truncate ${
                      isLast
                        ? "bg-[#190a0d] border-[#8f171c]/70 text-white font-bold"
                        : "bg-[#121218] border-[#242430] text-[#9b9caa] hover:text-white"
                    }`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {effectiveFolderId && (
            <button
              type="button"
              onClick={() => {
                const current = folders.find((f) => f.id === effectiveFolderId);
                setCurrentFolderId(current?.parentId ?? null);
              }}
              className="min-h-[34px] px-2.5 bg-[#121218] hover:bg-[#1a1a24] border border-[#262634] text-[11px] uppercase tracking-wider text-[#b4b5c2] hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Voltar</span>
            </button>
          )}
        </div>

        {/* Search & type filter */}
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727282] pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar em toda a biblioteca por nome, descrição, afiliação ou fórmula..."
              aria-label="Pesquisar na Biblioteca"
              className="w-full min-h-[40px] bg-[#13131b] border border-[#262632] focus:border-[var(--op-red-bright)] pl-9 pr-8 py-2 text-xs text-white placeholder-[#6e7080] outline-none rounded-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#727282] hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Filtrar por tipo de arquivo"
          >
            {(["all", ...ALL_TYPES] as const).map((t) => {
              const active = typeFilter === t;
              const label =
                t === "all" ? "Todos" : MASTER_LIBRARY_TYPE_META[t].pluralLabel;
              const count = typeCounts[t];
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTypeFilter(t)}
                  className={`min-h-[38px] px-2.5 py-1 text-[11px] uppercase tracking-wider border rounded-none transition-colors cursor-pointer touch-manipulation inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-[#1a0b0e] border-[#8f171c] text-white font-bold"
                      : "bg-[#111118] border-[#242430] text-[#8e90a0] hover:text-white hover:border-[#383848]"
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[10px] px-1 bg-black/40 text-[#9b9caa] tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOLDERS SECTION */}
      {childFolders.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7e8090] px-0.5">
            // Pastas ({childFolders.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {childFolders.map((folder) => {
              const stats = getFolderStats(folders, items, folder.id);
              const isRenaming = renamingFolderId === folder.id;
              const isConfirmingDelete = confirmDeleteFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  data-testid={`library-folder-${folder.id}`}
                  className="bg-[#0c0c10] border border-[#22222e] hover:border-[#3c3c4e] p-3 flex flex-col gap-2.5 transition-colors"
                >
                  {isRenaming ? (
                    <form
                      onSubmit={(e) => handleRenameFolderSubmit(e, folder.id)}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        maxLength={80}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        aria-label="Novo nome da pasta"
                        className="flex-1 min-w-0 min-h-[38px] bg-[#14141d] border border-[var(--op-red-bright)] px-2.5 text-xs text-white outline-none rounded-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        aria-label="Confirmar novo nome"
                        className="min-w-[38px] min-h-[38px] bg-[#8f171c] hover:bg-[#a91c22] text-white flex items-center justify-center cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancelar renomeação"
                        onClick={() => {
                          setRenamingFolderId(null);
                          setRenameDraft("");
                        }}
                        className="min-w-[38px] min-h-[38px] bg-[#16161f] border border-[#282834] text-[#9ca3af] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="w-full text-left flex items-center gap-2.5 min-h-[40px] group cursor-pointer touch-manipulation"
                    >
                      <div className="w-9 h-9 bg-[#160a0d] border border-[#8f171c]/45 flex items-center justify-center text-[var(--op-red-bright)] shrink-0">
                        <Folder size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-[#ff8a90] uppercase tracking-wider truncate transition-colors">
                          {folder.name}
                        </div>
                        <div className="text-[10px] text-[#7c7d8e] tabular-nums mt-0.5">
                          {stats.totalItems} arquivo{stats.totalItems === 1 ? "" : "s"}
                          {stats.directSubfolders > 0
                            ? ` · ${stats.directSubfolders} subpasta${stats.directSubfolders === 1 ? "" : "s"}`
                            : ""}
                        </div>
                      </div>
                      <ChevronRight
                        size={15}
                        className="text-[#5c5d6e] group-hover:text-white shrink-0"
                      />
                    </button>
                  )}

                  {isConfirmingDelete ? (
                    <div className="pt-2 border-t border-[#1e1e28] flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-amber-300">
                        Excluir pasta? Arquivos serão mantidos.
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteFolder(folder)}
                          className="min-h-[32px] px-2.5 bg-[#7f1d1d] hover:bg-[#991b1b] text-white font-bold uppercase cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFolderId(null)}
                          className="min-h-[32px] px-2 bg-[#16161f] border border-[#282834] text-[#b4b5c2] uppercase cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[#1a1a24] flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="min-h-[34px] px-2.5 bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[10px] text-[#d4d5e0] uppercase tracking-wider cursor-pointer touch-manipulation"
                      >
                        Abrir
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteFolderId(null);
                            setRenamingFolderId(folder.id);
                            setRenameDraft(folder.name);
                          }}
                          aria-label={`Renomear pasta ${folder.name}`}
                          className="min-h-[34px] px-2 bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#9b9caa] hover:text-white text-[10px] uppercase inline-flex items-center gap-1 cursor-pointer touch-manipulation"
                        >
                          <Edit2 size={12} />
                          <span>Renomear</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingFolderId(null);
                            setConfirmDeleteFolderId(folder.id);
                          }}
                          aria-label={`Excluir pasta ${folder.name}`}
                          className="min-w-[34px] min-h-[34px] bg-[#160b0d] hover:bg-[#2a1015] border border-[#4a1820] text-red-400 hover:text-red-300 flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILES SECTION */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7e8090]">
            // Arquivos{" "}
            {search.trim()
              ? `(busca global: ${visibleItems.length})`
              : `em ${getFolderPathLabel(folders, effectiveFolderId)} (${visibleItems.length})`}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="bg-[#0c0c10] border border-dashed border-[#262634] p-8 text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#b4b5c2]">
              {search.trim()
                ? "Nenhum arquivo encontrado para a busca atual"
                : childFolders.length > 0
                  ? "Nenhum arquivo diretamente nesta pasta"
                  : "Esta pasta da Biblioteca está vazia"}
            </div>
            <p className="text-[11px] text-[#787989] max-w-md mx-auto">
              Crie Rituais, Skills, PDIs ou Tributos reutilizáveis, organize-os em pastas
              ou importe arquivos .json externos para distribuir aos jogadores durante a sessão.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateChooser(true)}
                className="min-h-[40px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Criar Arquivo</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3.5 bg-[#14141c] hover:bg-[#1c1c28] border border-[#282834] text-zinc-200 text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload size={14} />
                <span>Importar JSON</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleItems.map((item) => {
              const meta = MASTER_LIBRARY_TYPE_META[item.type];
              const Icon = getTypeIcon(item.type);
              const name = getLibraryItemName(item);
              const desc = getLibraryItemDescription(item);
              const isDeleting = confirmDeleteItemId === item.id;
              const pdiChips =
                item.type === "pdi"
                  ? formatPdiModifierChips(item.data.modifiers)
                  : [];

              return (
                <article
                  key={item.id}
                  data-testid={`library-item-${item.id}`}
                  className="bg-[#0c0c10] border border-[#22222e] hover:border-[#383848] flex flex-col justify-between transition-colors"
                >
                  {/* Top Content */}
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#1a0a0d] border border-[#8f171c]/60 text-[#ff8a90]">
                            <Icon size={10} />
                            <span>{meta.shortTag}</span>
                          </span>

                          {item.type === "ritual" && (
                            <>
                              <span className="text-[11px] font-black text-[#e11d48] tabular-nums">
                                NV {item.data.level}
                              </span>
                              <span className="text-[10px] text-[#9b9caa] tabular-nums">
                                DIF {item.data.difficulty} · {item.data.cost} PE
                              </span>
                            </>
                          )}

                          {item.type === "skill" && (
                            <span className="text-[10px] text-[#9b9caa] tabular-nums">
                              {item.data.cost} PE
                              {item.data.needsTest ? " · EXIGE TESTE" : ""}
                            </span>
                          )}

                          {item.type === "pdi" && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 border uppercase ${
                                item.data.active
                                  ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                                  : "bg-[#121218] border-[#262632] text-[#7c7d8e]"
                              }`}
                            >
                              Padrão: {item.data.active ? "ON" : "OFF"}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-white uppercase tracking-wide truncate">
                          {name}
                        </h3>
                      </div>

                      {search.trim() && item.folderId !== effectiveFolderId && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#12121a] border border-[#242432] text-[#8e90a0] shrink-0 max-w-[120px] truncate">
                          {getFolderPathLabel(folders, item.folderId)}
                        </span>
                      )}
                    </div>

                    {desc && (
                      <p className="text-xs text-[#a4a5b5] leading-relaxed line-clamp-2">
                        {desc}
                      </p>
                    )}

                    {/* Native system metadata preview */}
                    {item.type === "ritual" && (
                      <div className="space-y-1.5">
                        {item.data.affiliations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.data.affiliations.map((affId) => (
                              <RitualAffiliationTag
                                key={affId}
                                affiliationId={affId}
                                compact
                              />
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-[#8c8d9c] flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>
                            TESTE: <strong className="text-[#d4d5e0]">{RITUAL_TEST_FORMULA} &gt; {item.data.difficulty}</strong>
                          </span>
                          {item.data.damage && (
                            <span>
                              DANO: <strong className="text-[#ff8a90]">{item.data.damage}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {item.type === "skill" &&
                      (item.data.test || item.data.damage) && (
                        <div className="text-[10px] text-[#8c8d9c] flex flex-wrap gap-x-3 gap-y-0.5">
                          {item.data.test && (
                            <span>
                              TESTE: <strong className="text-[#d4d5e0]">{item.data.test}</strong>
                            </span>
                          )}
                          {item.data.damage && (
                            <span>
                              DANO: <strong className="text-[#ff8a90]">{item.data.damage}</strong>
                            </span>
                          )}
                        </div>
                      )}

                    {item.type === "pdi" && pdiChips.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pdiChips.map((chip, idx) => (
                          <span
                            key={`${chip.stat}-${idx}`}
                            className={`px-1.5 py-0.5 text-[10px] font-bold border uppercase ${
                              chip.type === "buff"
                                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                                : "bg-red-950/60 border-red-800/70 text-red-300"
                            }`}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.type === "tributo" &&
                      (item.data.passivo || item.data.ativo) && (
                        <div className="space-y-1 text-[10px] text-[#9b9caa] border-t border-[#181822] pt-2">
                          {item.data.passivo && (
                            <p className="truncate">
                              <span className="text-[#787989] uppercase">Passivo:</span>{" "}
                              {item.data.passivo}
                            </p>
                          )}
                          {item.data.ativo && (
                            <p className="truncate">
                              <span className="text-[var(--op-red-bright)] uppercase">Ativo:</span>{" "}
                              {item.data.ativo}
                            </p>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="px-3.5 py-2.5 bg-[#09090d] border-t border-[#1c1c26] space-y-2">
                    {isDeleting ? (
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-red-300">
                          Remover permanentemente da Biblioteca?
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="min-h-[36px] px-3 bg-[#7f1d1d] hover:bg-[#991b1b] text-white font-bold uppercase text-[10px] cursor-pointer"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteItemId(null)}
                            className="min-h-[36px] px-2.5 bg-[#16161f] border border-[#282834] text-[#b4b5c2] uppercase text-[10px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`library-send-btn-${item.id}`}
                          onClick={() => setSendingItem(item)}
                          className="min-h-[38px] px-3 bg-[#8f171c] hover:bg-[#a91c22] border border-[#ff8085]/35 text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
                        >
                          <Send size={12} />
                          <span>Enviar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(item)}
                          aria-label={`Editar ${name}`}
                          className="min-h-[38px] px-2.5 bg-[#13131c] hover:bg-[#1c1c28] border border-[#262634] text-[#d4d5e0] hover:text-white text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
                        >
                          <Edit2 size={12} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportJson(item)}
                          aria-label={`Exportar ${name} em JSON`}
                          className="min-h-[38px] px-2.5 bg-[#13131c] hover:bg-[#1c1c28] border border-[#262634] text-[#b4b5c2] hover:text-white text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
                        >
                          <Download size={12} />
                          <span>JSON</span>
                        </button>

                        {folders.length > 0 && (
                          <select
                            aria-label={`Mover ${name} para pasta`}
                            value={item.folderId || ""}
                            onChange={(e) =>
                              handleMoveItem(item, e.target.value || null)
                            }
                            className="min-h-[38px] max-w-[140px] bg-[#13131c] border border-[#262634] px-2 text-[10px] text-[#a4a5b5] outline-none focus:border-[var(--op-red-bright)] rounded-none cursor-pointer"
                          >
                            <option value="">Pasta: Raiz</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {getFolderPathLabel(folders, f.id)}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItemId(item.id)}
                          aria-label={`Excluir ${name}`}
                          className="ml-auto min-w-[38px] min-h-[38px] bg-[#160b0d] hover:bg-[#2a1015] border border-[#4a1820] text-red-400 hover:text-red-300 flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* NATIVE ITEM EDITOR MODAL (Ritual, Skill, Tributo) */}
      <MasterLibraryItemModal
        isOpen={editorMode !== null}
        mode={editorMode}
        initialItem={editingItem}
        folders={folders}
        defaultFolderId={effectiveFolderId}
        onClose={() => {
          setEditorMode(null);
          setEditingItem(null);
        }}
        onSave={handleSaveGenericItem}
        onDelete={async (id) => {
          const target = items.find((it) => it.id === id);
          if (target) await handleDeleteItem(target);
        }}
      />

      {/* REUSED NATIVE PDI EDITOR MODAL */}
      <PdiEditorModal
        isOpen={pdiModalOpen}
        initialPdi={editingPdiItem?.type === "pdi" ? editingPdiItem.data : null}
        targetName={`Biblioteca · ${getFolderPathLabel(folders, editingPdiItem ? editingPdiItem.folderId : effectiveFolderId)}`}
        onClose={() => {
          setPdiModalOpen(false);
          setEditingPdiItem(null);
        }}
        onSave={handleSavePdiFromModal}
        onDelete={
          editingPdiItem
            ? () => {
                handleDeleteItem(editingPdiItem);
              }
            : undefined
        }
      />

      {/* SEND TO PLAYERS MODAL */}
      <MasterLibrarySendModal
        item={sendingItem}
        players={players}
        isSending={isSendingDataPush}
        onClose={() => setSendingItem(null)}
        onSendToPlayers={onSendDataToPlayers}
        onSuccessFeedback={(msg) => setFeedback({ type: "success", text: msg })}
      />
        </>
      )}
    </div>
  );
};
