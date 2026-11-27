import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Copy,
  Download,
  Edit2,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Loader2,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  CreationDocument,
  CreationDocumentSummary,
  CreationElement,
  CreationElementType,
  CreationHistoryState,
} from "../types/masterCreations";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  CREATION_ELEMENT_META,
  CREATION_ELEMENT_ORDER,
  addElementToDocument,
  bringElementToFront,
  cloneElementForInsert,
  createCreationHistory,
  createCreationId,
  duplicateElementInDocument,
  moveElementLayerStep,
  normalizeCreationTitle,
  pushCreationHistory,
  redoCreationHistory,
  removeElementFromDocument,
  reorderElementLayerById,
  sendElementToBack,
  sortCreationSummaries,
  toCreationDocumentSummary,
  undoCreationHistory,
  updateElementInDocument,
} from "../utils/masterCreations";
import {
  createMasterCreationDocument,
  deleteMasterCreationDocument,
  duplicateMasterCreationDocument,
  getMasterCreationById,
  listMasterCreationSummaries,
  saveMasterCreation,
  uploadCreationImage,
} from "../services/masterCreationsService";
import { CreationCanvasWorkspace } from "./creations/CreationCanvasWorkspace";
import {
  CreationLayersPanel,
  getCreationElementIcon,
} from "./creations/CreationLayersPanel";
import { CreationInspectorPanel } from "./creations/CreationInspectorPanel";
import { CreationExportModal } from "./creations/CreationExportModal";

export interface MasterCreationsViewProps {
  masterId: string;
  roomId?: string;
}

type SaveStatus = "saved" | "saving" | "dirty" | "error";
type LeftSidebarTab = "blocks" | "layers";
type MobileEditorPane = "canvas" | "blocks" | "layers" | "inspector";

function formatShortUpdatedAt(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export const MasterCreationsView: React.FC<MasterCreationsViewProps> = ({
  masterId,
  roomId = "default-table",
}) => {
  // --- Estado da Biblioteca de Documentos ---
  const [summaries, setSummaries] = useState<CreationDocumentSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [duplicatingDocId, setDuplicatingDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameDocDraft, setRenameDocDraft] = useState("");

  // --- Estado do Editor A4 ---
  const [history, setHistory] = useState<CreationHistoryState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboardElement, setClipboardElement] =
    useState<CreationElement | null>(null);
  const [zoom, setZoom] = useState<number>(0.72);
  const [leftTab, setLeftTab] = useState<LeftSidebarTab>("blocks");
  const [mobilePane, setMobilePane] = useState<MobileEditorPane>("canvas");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editorNotice, setEditorNotice] = useState<{
    type: "error" | "warning" | "info";
    text: string;
  } | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDocRef = useRef<CreationDocument | null>(null);
  const dirtyRef = useRef<boolean>(false);
  const quickPngInputRef = useRef<HTMLInputElement | null>(null);

  const activeDoc = history?.present || null;
  latestDocRef.current = activeDoc;

  // Calcula zoom confortável inicial conforme a largura da tela
  const computeDefaultZoom = useCallback(() => {
    if (typeof window === "undefined") return 0.72;
    const vw = window.innerWidth;
    if (vw < 640) return Math.max(0.38, Math.min(0.45, (vw - 40) / A4_WIDTH_PX));
    if (vw < 1024) return 0.62;
    if (vw < 1400) return 0.68;
    return 0.78;
  }, []);

  // Ajusta o zoom automaticamente caso o usuário redimensione entre PC e Mobile
  useEffect(() => {
    if (!activeDoc || typeof window === "undefined") return;
    let lastNarrow = window.innerWidth < 640;
    const onResize = () => {
      const nowNarrow = window.innerWidth < 640;
      if (nowNarrow !== lastNarrow) {
        lastNarrow = nowNarrow;
        setZoom(computeDefaultZoom());
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeDoc, computeDefaultZoom]);

  const loadSummaries = useCallback(async () => {
    if (!masterId) {
      setIsLoadingList(false);
      return;
    }
    setIsLoadingList(true);
    setListError(null);
    try {
      const list = await listMasterCreationSummaries(masterId);
      setSummaries(list);
    } catch (err: any) {
      setListError(
        err?.message || "Não foi possível carregar seus documentos.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, [masterId]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // --- Salvamento automático controlado (debounce 1100ms, sem flood no Supabase) ---
  const persistDocumentNow = useCallback(
    async (docToSave: CreationDocument) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const saved = await saveMasterCreation(docToSave);
        dirtyRef.current = false;
        setSaveStatus("saved");
        const nextSummary = toCreationDocumentSummary(saved);
        setSummaries((prev) =>
          sortCreationSummaries([
            nextSummary,
            ...prev.filter((item) => item.id !== nextSummary.id),
          ]),
        );
      } catch (err: any) {
        setSaveStatus("error");
        setSaveError(
          err?.message || "Falha ao salvar documento no servidor.",
        );
      }
    },
    [],
  );

  const scheduleAutosave = useCallback(
    (docToSave: CreationDocument) => {
      dirtyRef.current = true;
      setSaveStatus("dirty");
      setSaveError(null);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        const current = latestDocRef.current;
        if (current && current.id === docToSave.id) {
          void persistDocumentNow(current);
        }
      }, 1100);
    },
    [persistDocumentNow],
  );

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (dirtyRef.current && latestDocRef.current) {
        void saveMasterCreation(latestDocRef.current).catch(() => {});
      }
    };
  }, []);

  // Aplica mutação no documento atual com histórico Undo/Redo + autosave
  const commitDocumentChange = useCallback(
    (updater: (doc: CreationDocument) => CreationDocument) => {
      setHistory((prev) => {
        if (!prev) return prev;
        const nextDoc = updater(prev.present);
        if (nextDoc === prev.present) return prev;
        scheduleAutosave(nextDoc);
        return pushCreationHistory(prev, nextDoc);
      });
    },
    [scheduleAutosave],
  );

  // --- Ações da Biblioteca ---
  const handleCreateDocument = async () => {
    if (isCreatingDoc || !masterId) return;
    setIsCreatingDoc(true);
    setListError(null);
    try {
      const created = await createMasterCreationDocument(
        masterId,
        `Documento A4 #${summaries.length + 1}`,
      );
      const summary = toCreationDocumentSummary(created);
      setSummaries((prev) => sortCreationSummaries([summary, ...prev]));
      setHistory(createCreationHistory(created));
      setSelectedId(null);
      setZoom(computeDefaultZoom());
      setSaveStatus("saved");
      setSaveError(null);
      setEditorNotice(null);
      setMobilePane("canvas");
    } catch (err: any) {
      setListError(err?.message || "Erro ao criar novo documento.");
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleOpenDocument = async (docId: string) => {
    if (openingDocId) return;
    setOpeningDocId(docId);
    setListError(null);
    try {
      const loaded = await getMasterCreationById(docId, masterId);
      if (!loaded) {
        setListError("Documento não encontrado.");
        return;
      }
      setHistory(createCreationHistory(loaded));
      setSelectedId(null);
      setZoom(computeDefaultZoom());
      setSaveStatus("saved");
      setSaveError(null);
      setEditorNotice(null);
      setMobilePane("canvas");
    } catch (err: any) {
      setListError(err?.message || "Não foi possível abrir o documento.");
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleDuplicateLibraryDocument = async (docId: string) => {
    if (duplicatingDocId) return;
    setDuplicatingDocId(docId);
    setListError(null);
    try {
      const cloned = await duplicateMasterCreationDocument(docId, masterId);
      const summary = toCreationDocumentSummary(cloned);
      setSummaries((prev) => sortCreationSummaries([summary, ...prev]));
    } catch (err: any) {
      setListError(err?.message || "Não foi possível duplicar o documento.");
    } finally {
      setDuplicatingDocId(null);
    }
  };

  const handleDeleteLibraryDocument = async (docId: string) => {
    setListError(null);
    try {
      await deleteMasterCreationDocument(docId, masterId);
      setSummaries((prev) => prev.filter((item) => item.id !== docId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setListError(err?.message || "Erro ao excluir o documento.");
    }
  };

  const handleCommitLibraryRename = async (docId: string) => {
    const cleanTitle = normalizeCreationTitle(renameDocDraft);
    setRenamingDocId(null);
    try {
      const full = await getMasterCreationById(docId, masterId);
      if (!full) return;
      const saved = await saveMasterCreation({ ...full, title: cleanTitle });
      const summary = toCreationDocumentSummary(saved);
      setSummaries((prev) =>
        sortCreationSummaries([
          summary,
          ...prev.filter((item) => item.id !== summary.id),
        ]),
      );
    } catch (err: any) {
      setListError(err?.message || "Erro ao renomear o documento.");
    }
  };

  const handleBackToLibrary = async () => {
    if (dirtyRef.current && latestDocRef.current) {
      await persistDocumentNow(latestDocRef.current);
    }
    setHistory(null);
    setSelectedId(null);
    setEditorNotice(null);
    setIsExportOpen(false);
  };

  // --- Ações do Editor ---
  const handleAddBlock = useCallback(
    (type: CreationElementType) => {
      const createdId = createCreationId(type);
      commitDocumentChange((doc) => {
        const res = addElementToDocument(doc, type, { id: createdId });
        return res.doc;
      });
      setSelectedId(createdId);
      setMobilePane("canvas");
    },
    [commitDocumentChange],
  );

  const handleImportNewImage = useCallback(
    async (file: File, coords?: { x: number; y: number }) => {
      setIsUploadingImage(true);
      setEditorNotice(null);
      try {
        const res = await uploadCreationImage(file, roomId);
        if (!res.ok || !res.url) {
          setEditorNotice({
            type: "error",
            text: res.error || "Não foi possível importar a imagem.",
          });
          return;
        }
        if (res.warning) {
          setEditorNotice({ type: "warning", text: res.warning });
        }

        const natW = res.naturalWidth || 320;
        const natH = res.naturalHeight || 240;
        const ratio = natW / Math.max(1, natH);
        const maxInitialW = 340;
        const maxInitialH = 340;
        let width = Math.min(maxInitialW, natW);
        let height = Math.round(width / ratio);
        if (height > maxInitialH) {
          height = maxInitialH;
          width = Math.round(height * ratio);
        }

        const cleanName = (file.name || "Imagem PNG")
          .replace(/\.[^.]+$/, "")
          .slice(0, 48);

        const createdId = createCreationId("image");
        commitDocumentChange((doc) => {
          const added = addElementToDocument(doc, "image", {
            id: createdId,
            name: cleanName || "Imagem PNG",
            imageUrl: res.url,
            imageAspectRatio: ratio,
            lockAspectRatio: true,
            width: Math.max(48, width),
            height: Math.max(48, height),
            backgroundColor: "transparent",
            borderWidth: 0,
            ...(coords ? { x: coords.x, y: coords.y } : {}),
          });
          return added.doc;
        });
        setSelectedId(createdId);
        setMobilePane("canvas");
      } finally {
        setIsUploadingImage(false);
      }
    },
    [commitDocumentChange, roomId],
  );

  const handleUploadElementImage = useCallback(
    async (elementId: string, file: File) => {
      setIsUploadingImage(true);
      setEditorNotice(null);
      try {
        const res = await uploadCreationImage(file, roomId);
        if (!res.ok || !res.url) {
          setEditorNotice({
            type: "error",
            text: res.error || "Não foi possível importar a imagem.",
          });
          return;
        }
        if (res.warning) {
          setEditorNotice({ type: "warning", text: res.warning });
        }
        const ratio =
          res.naturalWidth && res.naturalHeight
            ? res.naturalWidth / res.naturalHeight
            : null;
        commitDocumentChange((doc) => {
          const target = doc.elements.find((e) => e.id === elementId);
          if (!target) return doc;
          const nextPatch: Partial<CreationElement> = {
            imageUrl: res.url,
            imageAspectRatio: ratio,
          };
          if (target.type === "image" && ratio) {
            nextPatch.height = Math.max(24, Math.round(target.width / ratio));
            nextPatch.backgroundColor = "transparent";
            nextPatch.borderWidth = 0;
          }
          return updateElementInDocument(doc, elementId, nextPatch);
        });
      } finally {
        setIsUploadingImage(false);
      }
    },
    [commitDocumentChange, roomId],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (!prev || prev.past.length === 0) return prev;
      const next = undoCreationHistory(prev);
      scheduleAutosave(next.present);
      return next;
    });
  }, [scheduleAutosave]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (!prev || prev.future.length === 0) return prev;
      const next = redoCreationHistory(prev);
      scheduleAutosave(next.present);
      return next;
    });
  }, [scheduleAutosave]);

  const handleDuplicateElement = useCallback(
    (id: string) => {
      const current = latestDocRef.current;
      const source = current?.elements.find((e) => e.id === id);
      if (!source) return;
      const clonedId = createCreationId(source.type);
      commitDocumentChange((doc) => {
        const res = duplicateElementInDocument(doc, id);
        if (!res.element) return doc;
        return {
          ...res.doc,
          elements: res.doc.elements.map((el) =>
            el.id === res.element!.id ? { ...el, id: clonedId } : el,
          ),
        };
      });
      setSelectedId(clonedId);
    },
    [commitDocumentChange],
  );

  const handleCopyElement = useCallback(
    (id: string) => {
      const target = activeDoc?.elements.find((e) => e.id === id) || null;
      if (!target) return;
      setClipboardElement(target);
      setEditorNotice({
        type: "info",
        text: `Camada "${target.name}" copiada. Use Ctrl+V para colar.`,
      });
    },
    [activeDoc],
  );

  const handlePasteElement = useCallback(() => {
    if (!clipboardElement) return;
    const pastedId = createCreationId(clipboardElement.type);
    commitDocumentChange((doc) => {
      const cloned = {
        ...cloneElementForInsert(clipboardElement, doc.elements.length, 24),
        id: pastedId,
      };
      return {
        ...doc,
        elements: [...doc.elements, cloned],
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedId(pastedId);
  }, [clipboardElement, commitDocumentChange]);

  const handleDeleteElement = useCallback(
    (id: string) => {
      commitDocumentChange((doc) => removeElementFromDocument(doc, id));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [commitDocumentChange],
  );

  // Atalhos de teclado do editor (ignora quando foco está em input/textarea/select)
  useEffect(() => {
    if (!activeDoc || isExportOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (!isEditingField) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      if (
        (mod && e.key.toLowerCase() === "y") ||
        (mod && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        if (!isEditingField) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      if (isEditingField) return;

      if (mod && e.key.toLowerCase() === "c" && selectedId) {
        e.preventDefault();
        handleCopyElement(selectedId);
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && clipboardElement) {
        e.preventDefault();
        handlePasteElement();
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        handleDuplicateElement(selectedId);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDeleteElement(selectedId);
        return;
      }

      if (
        selectedId &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        const el = activeDoc.elements.find((item) => item.id === selectedId);
        if (!el || el.locked) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commitDocumentChange((doc) =>
          updateElementInDocument(doc, selectedId, {
            x: el.x + dx,
            y: el.y + dy,
          }),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeDoc,
    clipboardElement,
    commitDocumentChange,
    handleCopyElement,
    handleDeleteElement,
    handleDuplicateElement,
    handlePasteElement,
    handleRedo,
    handleUndo,
    isExportOpen,
    selectedId,
  ]);

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((item) => item.title.toLowerCase().includes(q));
  }, [searchQuery, summaries]);

  const selectedElement = useMemo(
    () => activeDoc?.elements.find((el) => el.id === selectedId) || null,
    [activeDoc, selectedId],
  );

  // =========================================================================
  // MODO BIBLIOTECA DE CRIAÇÕES (Lista limpa de documentos A4)
  // =========================================================================
  if (!activeDoc) {
    return (
      <div
        data-testid="master-creations-library"
        className="max-w-7xl mx-auto px-2.5 sm:px-4 pb-16 space-y-4 font-mono text-[#dedede]"
      >
        {/* Cabeçalho */}
        <div className="bg-[#0d0d13] border border-[#20202c] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#848697]">
              DOCUMENTOS VISUAIS A4 · EXCLUSIVO DO MESTRE
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <LayoutTemplate
                size={18}
                className="text-[var(--op-red-bright)] shrink-0"
              />
              <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-white truncate">
                Criações
              </h2>
              <span className="text-[10px] px-2 py-0.5 bg-[#15151f] border border-[#262634] text-[#9b9caa]">
                {summaries.length}{" "}
                {summaries.length === 1 ? "documento" : "documentos"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateDocument}
            disabled={isCreatingDoc}
            data-testid="creations-new-doc-btn"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer disabled:opacity-50 touch-manipulation shrink-0"
          >
            {isCreatingDoc ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FilePlus2 size={15} />
            )}
            <span>Novo Documento A4</span>
          </button>
        </div>

        {/* Barra de busca */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737586]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar documento por nome..."
              aria-label="Buscar documento nas Criações"
              data-testid="creations-search-input"
              className="w-full min-h-[42px] bg-[#0c0c12] border border-[#222230] pl-9 pr-3 text-xs text-white placeholder-[#666878] focus:outline-none focus:border-[#8f171c]"
            />
          </div>
          <button
            type="button"
            onClick={loadSummaries}
            disabled={isLoadingList}
            aria-label="Atualizar lista de documentos"
            className="min-w-[42px] min-h-[42px] flex items-center justify-center bg-[#0d0d13] border border-[#222230] text-[#9c9eb0] hover:text-white cursor-pointer touch-manipulation"
          >
            <RefreshCw
              size={14}
              className={isLoadingList ? "animate-spin" : ""}
            />
          </button>
        </div>

        {listError && (
          <div className="flex items-center justify-between gap-3 p-3 bg-red-950/40 border border-red-800/70 text-red-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{listError}</span>
            </div>
            <button
              type="button"
              onClick={loadSummaries}
              className="px-2.5 py-1 border border-red-700/80 text-[10px] uppercase hover:bg-red-900/40 cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isLoadingList ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-xs text-[#8a8c9c] bg-[#0b0b10] border border-[#1d1d27]">
            <Loader2
              size={20}
              className="animate-spin text-[var(--op-red-bright)]"
            />
            <span>Carregando biblioteca de documentos A4...</span>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div
            data-testid="creations-empty-state"
            className="py-14 px-4 text-center bg-[#0b0b10] border border-dashed border-[#252534] space-y-3"
          >
            <LayoutTemplate
              size={28}
              className="mx-auto text-[#8f171c]/80"
            />
            <div className="text-sm font-bold uppercase tracking-wider text-white">
              {searchQuery
                ? "Nenhum documento encontrado"
                : "Nenhuma criação registrada"}
            </div>
            <p className="text-xs text-[#808294] max-w-md mx-auto leading-relaxed">
              Monte relatórios, dossiês, arquivos narrativos, cartazes e
              registros visuais em formato A4 com blocos arrastáveis, imagens
              PNG e camadas independentes.
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={isCreatingDoc}
                className="inline-flex items-center gap-2 min-h-[42px] px-4 bg-[#190a0d] hover:bg-[#281015] border border-[#8f171c] text-white text-xs uppercase font-bold tracking-wider cursor-pointer touch-manipulation"
              >
                <Plus size={14} />
                <span>Criar Primeiro Documento A4</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredSummaries.map((item) => {
              const isConfirming = confirmDeleteId === item.id;
              const isRenaming = renamingDocId === item.id;
              return (
                <div
                  key={item.id}
                  data-testid={`creation-doc-card-${item.id}`}
                  className="bg-[#0d0d13] border border-[#222230] hover:border-[#3c242a] transition-colors flex flex-col"
                >
                  {/* Miniatura proporcional A4 clicável para abrir */}
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(item.id)}
                    disabled={openingDocId === item.id}
                    data-testid={`creation-doc-open-${item.id}`}
                    className="relative p-4 bg-[#08080c] border-b border-[#1d1d28] flex items-center justify-center cursor-pointer group touch-manipulation"
                  >
                    <div
                      className="w-[106px] h-[150px] border border-white/15 shadow-lg flex flex-col justify-between p-2.5 transition-transform duration-150 group-hover:scale-[1.03]"
                      style={{ backgroundColor: item.pageBackground }}
                    >
                      <div className="space-y-1.5 opacity-60">
                        <div className="h-1.5 w-3/4 bg-[#b91c1c]" />
                        <div className="h-1 w-full bg-current opacity-30" />
                        <div className="h-1 w-5/6 bg-current opacity-20" />
                      </div>
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider opacity-70">
                        <span>A4</span>
                        <span>{item.elementsCount} cam.</span>
                      </div>
                    </div>

                    {openingDocId === item.id && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Loader2
                          size={20}
                          className="animate-spin text-[var(--op-red-bright)]"
                        />
                      </div>
                    )}
                  </button>

                  {/* Metadados + Ações */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                    <div className="min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={renameDocDraft}
                            onChange={(e) => setRenameDocDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                void handleCommitLibraryRename(item.id);
                              if (e.key === "Escape") setRenamingDocId(null);
                            }}
                            aria-label="Renomear documento"
                            className="flex-1 min-w-0 bg-[#09090d] border border-[#8f171c] px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCommitLibraryRename(item.id)}
                            aria-label="Confirmar novo nome"
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-emerald-400 border border-emerald-700/50 cursor-pointer"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-white truncate">
                          {item.title}
                        </div>
                      )}
                      <div className="text-[10px] text-[#7c7e90] mt-1 flex items-center justify-between">
                        <span>
                          {item.elementsCount}{" "}
                          {item.elementsCount === 1 ? "camada" : "camadas"}
                        </span>
                        <span>{formatShortUpdatedAt(item.updatedAt)}</span>
                      </div>
                    </div>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-[#222230]">
                        <button
                          type="button"
                          onClick={() => void handleDeleteLibraryDocument(item.id)}
                          data-testid={`creation-doc-delete-confirm-${item.id}`}
                          className="flex-1 min-h-[36px] bg-red-900/70 hover:bg-red-800 text-white text-[10px] uppercase font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] px-2.5 bg-[#14141d] border border-[#2a2a38] text-[10px] uppercase text-[#a8aab8] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 pt-1 border-t border-[#1b1b26]">
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(item.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1 min-h-[36px] bg-[#161620] hover:bg-[#1f1f2d] border border-[#262636] text-[10px] uppercase text-white cursor-pointer touch-manipulation"
                        >
                          <FolderOpen size={12} />
                          <span>Abrir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingDocId(item.id);
                            setRenameDocDraft(item.title);
                          }}
                          title="Renomear documento"
                          aria-label={`Renomear ${item.title}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#12121a] border border-[#242432] text-[#9b9caa] hover:text-white cursor-pointer touch-manipulation"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={duplicatingDocId === item.id}
                          onClick={() =>
                            void handleDuplicateLibraryDocument(item.id)
                          }
                          data-testid={`creation-doc-duplicate-${item.id}`}
                          title="Duplicar documento"
                          aria-label={`Duplicar ${item.title}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#12121a] border border-[#242432] text-[#9b9caa] hover:text-white cursor-pointer touch-manipulation"
                        >
                          {duplicatingDocId === item.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          data-testid={`creation-doc-delete-${item.id}`}
                          title="Excluir documento"
                          aria-label={`Excluir ${item.title}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#12121a] border border-[#242432] text-red-400 hover:bg-red-950/50 cursor-pointer touch-manipulation"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODO EDITOR VISUAL A4 (Minimalista, focado na página)
  // =========================================================================
  const canUndo = (history?.past.length || 0) > 0;
  const canRedo = (history?.future.length || 0) > 0;

  return (
    <div
      data-testid="master-creations-editor"
      className="max-w-[1600px] mx-auto px-2 sm:px-3 pb-10 space-y-2.5 font-mono text-[#dedede]"
    >
      {/* Input oculto para importar PNG rápido */}
      <input
        ref={quickPngInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid="creations-quick-png-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportNewImage(file);
          e.target.value = "";
        }}
      />

      {/* Barra Superior Minimalista do Editor */}
      <div className="bg-[#0c0c12] border border-[#20202c] px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Esquerda: Voltar + Título + Status Autosave */}
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
          <button
            type="button"
            onClick={() => void handleBackToLibrary()}
            data-testid="creations-back-btn"
            className="inline-flex items-center gap-1.5 px-2.5 min-h-[38px] bg-[#13131b] hover:bg-[#1c1c28] border border-[#262634] text-xs uppercase text-[#b5b7c6] hover:text-white cursor-pointer touch-manipulation shrink-0"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Documentos</span>
          </button>

          <input
            type="text"
            value={activeDoc.title}
            onChange={(e) =>
              commitDocumentChange((doc) => ({
                ...doc,
                title: e.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
            aria-label="Título do documento A4"
            data-testid="creations-doc-title-input"
            className="min-w-0 flex-1 sm:max-w-xs bg-[#09090d] sm:bg-transparent border border-[#222230] sm:border-transparent hover:border-[#262634] focus:border-[#8f171c] focus:bg-[#09090d] px-2 py-1.5 text-xs sm:text-sm font-bold text-white focus:outline-none truncate"
          />

          <div
            data-testid="creations-save-status"
            className="hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-wider shrink-0"
          >
            {saveStatus === "saving" && (
              <span className="text-[#9e9fb0] inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                Salvando...
              </span>
            )}
            {saveStatus === "dirty" && (
              <span className="text-amber-400">Alterações pendentes</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-emerald-400 inline-flex items-center gap-1">
                <Check size={11} />
                Salvo
              </span>
            )}
            {saveStatus === "error" && (
              <button
                type="button"
                onClick={() => void persistDocumentNow(activeDoc)}
                className="text-red-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
                title={saveError || "Erro ao salvar"}
              >
                <CloudOff size={11} />
                Erro · Tentar novamente
              </button>
            )}
          </div>
        </div>

        {/* Direita: Undo / Redo + Zoom + Exportar */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0">
          <div className="flex items-center bg-[#12121a] border border-[#242432]">
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              data-testid="creations-undo-btn"
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#c2c4d4] hover:text-white disabled:opacity-30 cursor-pointer touch-manipulation"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              data-testid="creations-redo-btn"
              title="Refazer (Ctrl+Y)"
              aria-label="Refazer"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#c2c4d4] hover:text-white disabled:opacity-30 border-l border-[#242432] cursor-pointer touch-manipulation"
            >
              <Redo2 size={14} />
            </button>
          </div>

          <div className="flex items-center bg-[#12121a] border border-[#242432]">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 100) / 100))
              }
              data-testid="creations-zoom-out-btn"
              title="Afastar zoom"
              aria-label="Afastar zoom"
              className="min-w-[34px] min-h-[36px] flex items-center justify-center text-[#c2c4d4] hover:text-white cursor-pointer touch-manipulation"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(computeDefaultZoom())}
              data-testid="creations-zoom-reset-btn"
              title="Ajustar zoom à tela"
              className="px-2 min-h-[36px] text-[11px] tabular-nums text-white border-x border-[#242432] hover:bg-white/5 cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 100) / 100))
              }
              data-testid="creations-zoom-in-btn"
              title="Aproximar zoom"
              aria-label="Aproximar zoom"
              className="min-w-[34px] min-h-[36px] flex items-center justify-center text-[#c2c4d4] hover:text-white cursor-pointer touch-manipulation"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (dirtyRef.current && latestDocRef.current) {
                await persistDocumentNow(latestDocRef.current);
              }
              setIsExportOpen(true);
            }}
            data-testid="creations-export-btn"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs uppercase font-bold tracking-wider cursor-pointer touch-manipulation"
          >
            <Download size={13} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Aviso/Erro contextual */}
      {editorNotice && (
        <div
          className={`px-3 py-2 border text-xs flex items-center justify-between gap-2 ${
            editorNotice.type === "error"
              ? "bg-red-950/40 border-red-800/70 text-red-200"
              : editorNotice.type === "warning"
                ? "bg-amber-950/35 border-amber-700/60 text-amber-200"
                : "bg-[#12121b] border-[#2c2c3e] text-[#c8cad8]"
          }`}
        >
          <span>{editorNotice.text}</span>
          <button
            type="button"
            onClick={() => setEditorNotice(null)}
            className="text-[10px] uppercase opacity-75 hover:opacity-100 cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* Navegação Mobile do Editor (< lg) */}
      <div className="grid grid-cols-4 gap-1 lg:hidden bg-[#0c0c12] border border-[#20202c] p-1">
        {(
          [
            { id: "canvas", label: "Página", icon: LayoutTemplate },
            { id: "blocks", label: "Blocos", icon: Plus },
            { id: "layers", label: "Camadas", icon: Layers },
            { id: "inspector", label: "Editar", icon: SlidersHorizontal },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`creations-mobile-pane-${id}`}
            onClick={() => setMobilePane(id)}
            className={`min-h-[42px] flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider border cursor-pointer touch-manipulation ${
              mobilePane === id
                ? "bg-[#1a0b0e] border-[#8f171c] text-white font-bold"
                : "bg-transparent border-transparent text-[#8c8e9e]"
            }`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Área Principal em 3 Zonas (Minimalista, foco no A4 central) */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch">
        {/* Esquerda: Blocos + Camadas */}
        <aside
          className={`${
            mobilePane === "blocks" || mobilePane === "layers"
              ? "flex"
              : "hidden lg:flex"
          } lg:w-[248px] shrink-0 flex-col bg-[#0c0c12] border border-[#20202c]`}
        >
          {/* Switcher Desktop (Blocos / Camadas) */}
          <div className="hidden lg:grid grid-cols-2 border-b border-[#20202c]">
            <button
              type="button"
              onClick={() => setLeftTab("blocks")}
              data-testid="creations-tab-blocks"
              className={`min-h-[40px] flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider cursor-pointer ${
                leftTab === "blocks"
                  ? "bg-[#180a0d] text-white font-bold border-b-2 border-[var(--op-red-bright)]"
                  : "text-[#828494] hover:text-white"
              }`}
            >
              <Plus size={13} />
              <span>Blocos</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("layers")}
              data-testid="creations-tab-layers"
              className={`min-h-[40px] flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider border-l border-[#20202c] cursor-pointer ${
                leftTab === "layers"
                  ? "bg-[#180a0d] text-white font-bold border-b-2 border-[var(--op-red-bright)]"
                  : "text-[#828494] hover:text-white"
              }`}
            >
              <Layers size={13} />
              <span>Camadas ({activeDoc.elements.length})</span>
            </button>
          </div>

          <div className="p-2.5 overflow-y-auto max-h-[680px] space-y-2.5">
            {(mobilePane === "blocks" ||
              (mobilePane !== "layers" && leftTab === "blocks")) && (
              <div data-testid="creations-blocks-palette" className="space-y-2">
                {/* Importar PNG direto */}
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => quickPngInputRef.current?.click()}
                  data-testid="creations-import-png-btn"
                  className="w-full min-h-[42px] px-3 flex items-center justify-center gap-2 bg-[#190a0d] hover:bg-[#271015] border border-[#8f171c]/80 text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50 touch-manipulation"
                >
                  {isUploadingImage ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImagePlus size={14} />
                  )}
                  <span>Importar PNG</span>
                </button>

                <div className="text-[10px] uppercase tracking-wider text-[#787a8c] pt-1">
                  Blocos de Documento
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                  {CREATION_ELEMENT_ORDER.map((type) => {
                    const meta = CREATION_ELEMENT_META[type];
                    const Icon = getCreationElementIcon(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAddBlock(type)}
                        data-testid={`creations-add-block-${type}`}
                        className="w-full min-h-[44px] px-2.5 py-2 bg-[#101018] hover:bg-[#181824] border border-[#222230] hover:border-[#8f171c]/70 text-left flex items-center gap-2.5 transition-colors cursor-pointer touch-manipulation"
                      >
                        <Icon
                          size={15}
                          className="text-[var(--op-red-bright)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {meta.label}
                          </div>
                          <div className="text-[10px] text-[#7c7e90] truncate hidden lg:block">
                            {meta.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(mobilePane === "layers" ||
              (mobilePane !== "blocks" && leftTab === "layers")) && (
              <CreationLayersPanel
                elements={activeDoc.elements}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                }}
                onToggleVisible={(id) =>
                  commitDocumentChange((doc) => {
                    const target = doc.elements.find((e) => e.id === id);
                    if (!target) return doc;
                    return updateElementInDocument(doc, id, {
                      visible: !target.visible,
                    });
                  })
                }
                onToggleLock={(id) =>
                  commitDocumentChange((doc) => {
                    const target = doc.elements.find((e) => e.id === id);
                    if (!target) return doc;
                    return updateElementInDocument(doc, id, {
                      locked: !target.locked,
                    });
                  })
                }
                onRename={(id, nextName) =>
                  commitDocumentChange((doc) =>
                    updateElementInDocument(doc, id, { name: nextName }),
                  )
                }
                onMoveStep={(id, dir) =>
                  commitDocumentChange((doc) =>
                    moveElementLayerStep(doc, id, dir),
                  )
                }
                onBringToFront={(id) =>
                  commitDocumentChange((doc) => bringElementToFront(doc, id))
                }
                onSendToBack={(id) =>
                  commitDocumentChange((doc) => sendElementToBack(doc, id))
                }
                onReorderById={(sourceId, targetId) =>
                  commitDocumentChange((doc) =>
                    reorderElementLayerById(doc, sourceId, targetId),
                  )
                }
                onDelete={handleDeleteElement}
              />
            )}
          </div>
        </aside>

        {/* Centro: Área de Edição A4 */}
        <div
          className={`${
            mobilePane === "canvas" ? "flex" : "hidden lg:flex"
          } flex-1 min-w-0 flex-col`}
        >
          <CreationCanvasWorkspace
            document={activeDoc}
            zoom={zoom}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCommitElementBox={(id, box) =>
              commitDocumentChange((doc) =>
                updateElementInDocument(doc, id, box),
              )
            }
            onInlineTextChange={(id, nextText) =>
              commitDocumentChange((doc) =>
                updateElementInDocument(doc, id, { textContent: nextText }),
              )
            }
            onDropImageFile={(file, coords) =>
              void handleImportNewImage(file, coords)
            }
            onDuplicate={handleDuplicateElement}
            onCopy={handleCopyElement}
            onBringToFront={(id) =>
              commitDocumentChange((doc) => bringElementToFront(doc, id))
            }
            onSendToBack={(id) =>
              commitDocumentChange((doc) => sendElementToBack(doc, id))
            }
            onToggleLock={(id) =>
              commitDocumentChange((doc) => {
                const target = doc.elements.find((e) => e.id === id);
                if (!target) return doc;
                return updateElementInDocument(doc, id, {
                  locked: !target.locked,
                });
              })
            }
            onDelete={handleDeleteElement}
          />
        </div>

        {/* Direita: Inspetor Minimalista (Página A4 ou Elemento Selecionado) */}
        <aside
          className={`${
            mobilePane === "inspector" ? "block" : "hidden lg:block"
          } lg:w-[276px] shrink-0 bg-[#0c0c12] border border-[#20202c] p-3 overflow-y-auto max-h-[720px]`}
        >
          <CreationInspectorPanel
            document={activeDoc}
            selectedElement={selectedElement}
            isUploadingImage={isUploadingImage}
            onUpdateDocument={(patch) =>
              commitDocumentChange((doc) => ({
                ...doc,
                ...patch,
                updatedAt: new Date().toISOString(),
              }))
            }
            onUpdateElement={(id, patch) =>
              commitDocumentChange((doc) =>
                updateElementInDocument(doc, id, patch),
              )
            }
            onUploadElementImage={(id, file) =>
              void handleUploadElementImage(id, file)
            }
          />
        </aside>
      </div>

      {/* Modal de Exportação A4 (JPG / PNG) */}
      <CreationExportModal
        isOpen={isExportOpen}
        document={activeDoc}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
};
