import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Edit2,
  Eye,
  FileText,
  Flame,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Skull,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Table2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { GameMode } from "../types";
import type { MasterLibraryItem } from "../types/masterLibrary";
import type {
  CatalogRitualOption,
  CreatureBlockType,
  CreatureFolder,
  CreatureRecord,
  CreatureSheetBlock,
  CreatureTableData,
} from "../types/masterCreatures";
import {
  CREATURE_BLOCK_META,
  addBlockToSheet,
  duplicateBlockInSheet,
  moveSheetBlockByOffset,
  removeBlockFromSheet,
  reorderSheetBlocks,
  resizeSheetBlock,
  updateTableBlockData,
  updateTextBlockContent,
} from "../utils/creatureBlocks";
import {
  CreatureModesBlock,
  CreatureProfileBlock,
  CreatureRitualsBlock,
  CreatureSkillsBlock,
  CreatureStatusBlock,
  CreatureTableBlock,
  CreatureTextBlock,
} from "./CreatureSheetBlocks";
import { CreatureAddBlockModal } from "./CreatureAddBlockModal";
import { CreatureSheetExportModal } from "./CreatureSheetExportModal";

export interface MasterCreatureSheetWorkspaceProps {
  creature: CreatureRecord;
  initialMode: "view" | "edit";
  folders: CreatureFolder[];
  libraryItems: MasterLibraryItem[];
  ritualCatalog: CatalogRitualOption[];
  currentGlobalMode: GameMode;
  activeInstancesCount: number;
  isInvoking: boolean;
  isDeleting: boolean;
  onSaveCreature: (
    record: CreatureRecord,
  ) => Promise<{ ok: true; record: CreatureRecord } | { ok: false; error: string }>;
  onBackToList: () => void;
  onInvoke: (creature: CreatureRecord, quantity: number) => Promise<void>;
  onDeleteConfirm: (creature: CreatureRecord) => Promise<void>;
  onOpenInitiativesTab?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 600;
const WIDTH_PRESETS: readonly { label: string; pct: number }[] = [
  { label: "1/3", pct: 33 },
  { label: "1/2", pct: 50 },
  { label: "2/3", pct: 67 },
  { label: "100%", pct: 100 },
];

function getBlockIcon(type: CreatureBlockType) {
  switch (type) {
    case "profile":
      return User;
    case "status":
      return SlidersHorizontal;
    case "skills":
      return Sparkles;
    case "rituals":
      return Flame;
    case "modes":
      return Shield;
    case "text":
      return FileText;
    case "table":
      return Table2;
  }
}

function useIsDesktopCanvas(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return isDesktop;
}

export const MasterCreatureSheetWorkspace: React.FC<
  MasterCreatureSheetWorkspaceProps
> = ({
  creature,
  initialMode,
  folders,
  libraryItems,
  ritualCatalog,
  currentGlobalMode,
  activeInstancesCount,
  isInvoking,
  isDeleting,
  onSaveCreature,
  onBackToList,
  onInvoke,
  onDeleteConfirm,
  onOpenInitiativesTab,
}) => {
  const [draft, setDraft] = useState<CreatureRecord>(creature);
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [invokeQuantity, setInvokeQuantity] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [blockActionNotice, setBlockActionNotice] = useState<string | null>(
    null,
  );

  // Drag-and-drop & Resize states (preview throttled via rAF, committed once on pointerup)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    blockId: string;
    position: "before" | "after";
  } | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    blockId: string;
    widthPct?: number;
    minHeightPx?: number | null;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isDesktop = useIsDesktopCanvas();

  // Serialized debounced auto-save refs
  const latestDraftRef = useRef<CreatureRecord>(creature);
  const dirtyRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingAfterFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const onSaveRef = useRef(onSaveCreature);
  onSaveRef.current = onSaveCreature;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset only when switching to another creature
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDraft(creature);
    latestDraftRef.current = creature;
    dirtyRef.current = false;
    setMode(initialMode);
    setSaveStatus("idle");
    setSaveError(null);
    setShowAddBlockMenu(false);
    setShowExportModal(false);
    setShowDeleteModal(false);
    setResizePreview(null);
    setResizingBlockId(null);
    setBlockActionNotice(null);
  }, [creature.id]);

  const executePersist = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) {
      pendingAfterFlightRef.current = true;
      return true;
    }
    if (!dirtyRef.current) {
      return true;
    }

    inFlightRef.current = true;
    dirtyRef.current = false;
    const payload = latestDraftRef.current;

    if (mountedRef.current) {
      setSaveStatus("saving");
      setSaveError(null);
    }

    let ok = true;
    try {
      const res = await onSaveRef.current(payload);
      if (res.ok === false) {
        ok = false;
        dirtyRef.current = true;
        if (mountedRef.current) {
          setSaveStatus("error");
          setSaveError(res.error);
        }
      } else if (mountedRef.current) {
        setSaveStatus("saved");
        setSaveError(null);
      }
    } catch (err: any) {
      ok = false;
      dirtyRef.current = true;
      if (mountedRef.current) {
        setSaveStatus("error");
        setSaveError(err?.message || "Falha ao salvar alterações.");
      }
    } finally {
      inFlightRef.current = false;
    }

    if (pendingAfterFlightRef.current) {
      pendingAfterFlightRef.current = false;
      if (dirtyRef.current) {
        return executePersist();
      }
    }

    return ok;
  }, []);

  const scheduleAutoSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void executePersist();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [executePersist]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!dirtyRef.current && !inFlightRef.current) {
      return true;
    }
    return executePersist();
  }, [executePersist]);

  // Flush pending edits on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (dirtyRef.current) {
        void onSaveRef.current(latestDraftRef.current);
      }
    };
  }, []);

  const updateDraft = useCallback(
    (updater: (prev: CreatureRecord) => CreatureRecord) => {
      setDraft((prev) => {
        const next = updater(prev);
        latestDraftRef.current = next;
        return next;
      });
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  // Block operations
  const handleAddBlock = useCallback(
    (type: CreatureBlockType) => {
      let notice: string | null = null;
      updateDraft((prev) => {
        const res = addBlockToSheet(prev.sheetBlocks || [], type);
        if (res.ok === false) {
          notice = res.error;
          return prev;
        }
        return {
          ...prev,
          sheetBlocks: res.blocks,
          updatedAt: Date.now(),
        };
      });
      if (notice) {
        setBlockActionNotice(notice);
      } else {
        setBlockActionNotice(null);
        setShowAddBlockMenu(false);
      }
    },
    [updateDraft],
  );

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      updateDraft((prev) => ({
        ...prev,
        sheetBlocks: removeBlockFromSheet(prev.sheetBlocks || [], blockId),
        updatedAt: Date.now(),
      }));
    },
    [updateDraft],
  );

  const handleDuplicateBlock = useCallback(
    (blockId: string) => {
      let notice: string | null = null;
      updateDraft((prev) => {
        const res = duplicateBlockInSheet(prev.sheetBlocks || [], blockId);
        if (res.ok === false) {
          notice = res.error;
          return prev;
        }
        return {
          ...prev,
          sheetBlocks: res.blocks,
          updatedAt: Date.now(),
        };
      });
      if (notice) setBlockActionNotice(notice);
    },
    [updateDraft],
  );

  const handleMoveBlock = useCallback(
    (blockId: string, delta: -1 | 1) => {
      updateDraft((prev) => ({
        ...prev,
        sheetBlocks: moveSheetBlockByOffset(
          prev.sheetBlocks || [],
          blockId,
          delta,
        ),
        updatedAt: Date.now(),
      }));
    },
    [updateDraft],
  );

  const handleResizeBlock = useCallback(
    (blockId: string, patch: { widthPct?: number; minHeightPx?: number | null }) => {
      updateDraft((prev) => ({
        ...prev,
        sheetBlocks: resizeSheetBlock(prev.sheetBlocks || [], blockId, patch),
        updatedAt: Date.now(),
      }));
    },
    [updateDraft],
  );

  const handleUpdateTextBlock = useCallback(
    (blockId: string, patch: { title?: string; content?: string }) => {
      updateDraft((prev) => ({
        ...prev,
        sheetBlocks: updateTextBlockContent(
          prev.sheetBlocks || [],
          blockId,
          patch,
        ),
        updatedAt: Date.now(),
      }));
    },
    [updateDraft],
  );

  const handleUpdateTableBlock = useCallback(
    (
      blockId: string,
      patch: { title?: string; tableData?: CreatureTableData },
    ) => {
      updateDraft((prev) => ({
        ...prev,
        sheetBlocks: updateTableBlockData(
          prev.sheetBlocks || [],
          blockId,
          patch,
        ),
        updatedAt: Date.now(),
      }));
    },
    [updateDraft],
  );

  // Horizontal pointer resize handle (desktop Edit mode — rAF throttled, committed on pointerup)
  const startHorizontalResize = (
    e: React.PointerEvent<HTMLDivElement>,
    block: CreatureSheetBlock,
  ) => {
    if (!isDesktop || mode !== "edit") return;
    e.preventDefault();
    e.stopPropagation();
    const canvasWidth = canvasRef.current?.getBoundingClientRect().width || 900;
    const minPct = CREATURE_BLOCK_META[block.type].minWidthPct;
    const startX = e.clientX;
    const startPct = block.widthPct;
    let latestPct = startPct;
    let rafId: number | null = null;
    setResizingBlockId(block.id);

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const deltaPct = (dx / Math.max(320, canvasWidth)) * 100;
      const clampedPct = Math.min(
        100,
        Math.max(minPct, Math.round(startPct + deltaPct)),
      );
      if (clampedPct === latestPct) return;
      latestPct = clampedPct;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setResizePreview({ blockId: block.id, widthPct: latestPct });
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setResizingBlockId(null);
      setResizePreview(null);
      if (latestPct !== startPct) {
        handleResizeBlock(block.id, { widthPct: latestPct });
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Vertical pointer resize handle (blocks with supportsVerticalResize — rAF throttled)
  const startVerticalResize = (
    e: React.PointerEvent<HTMLDivElement>,
    block: CreatureSheetBlock,
  ) => {
    if (mode !== "edit") return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = block.minHeightPx || 160;
    let latestHeight = startHeight;
    let rafId: number | null = null;
    setResizingBlockId(block.id);

    const onMove = (moveEvent: PointerEvent) => {
      const dy = moveEvent.clientY - startY;
      const clampedHeight = Math.min(
        960,
        Math.max(120, Math.round(startHeight + dy)),
      );
      if (clampedHeight === latestHeight) return;
      latestHeight = clampedHeight;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setResizePreview({ blockId: block.id, minHeightPx: latestHeight });
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setResizingBlockId(null);
      setResizePreview(null);
      if (latestHeight !== startHeight) {
        handleResizeBlock(block.id, { minHeightPx: latestHeight });
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Drag-and-drop handlers
  const handleDragStart = (
    e: React.DragEvent<HTMLElement>,
    blockId: string,
  ) => {
    setDraggedBlockId(blockId);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", blockId);
    } catch {
      // Some WebViews restrict setData; state holds draggedBlockId safely
    }
  };

  const handleDragOverBlock = (
    e: React.DragEvent<HTMLDivElement>,
    targetBlockId: string,
  ) => {
    if (!draggedBlockId || draggedBlockId === targetBlockId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position: "before" | "after" = e.clientX < midX ? "before" : "after";
    setDropTarget((prev) =>
      prev && prev.blockId === targetBlockId && prev.position === position
        ? prev
        : { blockId: targetBlockId, position },
    );
  };

  const handleDropOnBlock = (
    e: React.DragEvent<HTMLDivElement>,
    targetBlockId: string,
  ) => {
    e.preventDefault();
    const sourceId = draggedBlockId;
    const pos = dropTarget?.position || "before";
    setDraggedBlockId(null);
    setDropTarget(null);
    if (!sourceId || sourceId === targetBlockId) return;
    updateDraft((prev) => ({
      ...prev,
      sheetBlocks: reorderSheetBlocks(
        prev.sheetBlocks || [],
        sourceId,
        targetBlockId,
        pos,
      ),
      updatedAt: Date.now(),
    }));
  };

  const handleSwitchMode = async (nextMode: "view" | "edit") => {
    if (nextMode === "view" && mode === "edit") {
      setShowAddBlockMenu(false);
      await flushSave();
    }
    setMode(nextMode);
  };

  const handleBackClick = async () => {
    await flushSave();
    onBackToList();
  };

  const handleInvokeClick = async () => {
    await flushSave();
    await onInvoke(latestDraftRef.current, invokeQuantity);
  };

  const handleOpenExportModal = async () => {
    await flushSave();
    setShowExportModal(true);
  };

  const blocks = draft.sheetBlocks || [];
  const presentSingletonTypes = useMemo(() => {
    const set = new Set<CreatureBlockType>();
    for (const blk of blocks) {
      if (CREATURE_BLOCK_META[blk.type].singleton) {
        set.add(blk.type);
      }
    }
    return set;
  }, [blocks]);

  const isEditing = mode === "edit";

  return (
    <div
      className="space-y-4 font-mono"
      data-testid="creature-sheet-workspace"
      data-sheet-mode={mode}
    >
      {/* BARRA SUPERIOR DE COMANDO */}
      <div className="bg-[#0c0c10] border border-[#22222e] border-t-2 border-t-[var(--op-red)] p-3 sm:p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Esquerda: Voltar + Status de Salvamento */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              data-testid="creature-sheet-back-btn"
              className="min-h-[40px] px-3 bg-[#14141c] hover:bg-[#1d1d29] border border-[#2a2a38] text-xs uppercase tracking-wider text-[#d2d3e0] hover:text-white inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
            >
              <ArrowLeft size={14} />
              <span>Criaturas</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px]">
              {saveStatus === "saving" && (
                <span
                  data-testid="creature-autosave-status"
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#14141e] border border-[#2a2a3a] text-amber-300"
                >
                  <Loader2 size={12} className="animate-spin" />
                  <span>Salvando...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span
                  data-testid="creature-autosave-status"
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300"
                >
                  <CheckCircle2 size={12} />
                  <span>Salvo</span>
                </span>
              )}
              {saveStatus === "error" && (
                <button
                  type="button"
                  onClick={() => void executePersist()}
                  data-testid="creature-autosave-retry-btn"
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-950/60 border border-red-700/70 text-red-200 hover:text-white cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Erro ao salvar · Tentar novamente</span>
                </button>
              )}
            </div>
          </div>

          {/* Direita: Alternar Visualizar/Editar + Invocar + Excluir */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Modo da ficha de criatura"
              className="inline-flex bg-[#09090e] border border-[#262634] p-0.5"
            >
              <button
                type="button"
                onClick={() => void handleSwitchMode("view")}
                data-testid="creature-mode-view-btn"
                aria-pressed={!isEditing}
                className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                  !isEditing
                    ? "bg-[#190a0d] border border-[#8f171c] text-white"
                    : "border border-transparent text-[#8d8e9f] hover:text-white"
                }`}
              >
                <Eye size={13} />
                <span>Visualizar</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchMode("edit")}
                data-testid="creature-mode-edit-btn"
                aria-pressed={isEditing}
                className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                  isEditing
                    ? "bg-[#190a0d] border border-[#8f171c] text-white"
                    : "border border-transparent text-[#8d8e9f] hover:text-white"
                }`}
              >
                <Edit2 size={13} />
                <span>Editar</span>
              </button>
            </div>

            {/* Invocação com múltiplos exemplares */}
            <div className="inline-flex items-center border border-[#2a2a38] bg-[#111119]">
              <select
                aria-label="Quantidade de exemplares para invocar"
                value={invokeQuantity}
                onChange={(e) => setInvokeQuantity(Number(e.target.value) || 1)}
                data-testid="creature-invoke-qty-select"
                className="min-h-[40px] bg-transparent px-2 text-xs text-white font-bold tabular-nums outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n} className="bg-[#0e0e15]">
                    {n}x
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isInvoking}
                onClick={handleInvokeClick}
                data-testid="creature-sheet-invoke-btn"
                className="min-h-[40px] px-3.5 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 touch-manipulation"
              >
                {isInvoking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Swords size={13} />
                )}
                <span>Invocar</span>
              </button>
            </div>

            {/* Exportar Ficha em JPG */}
            <button
              type="button"
              onClick={() => void handleOpenExportModal()}
              data-testid="creature-sheet-export-btn"
              aria-label="Exportar ficha da criatura em JPG"
              className="min-h-[40px] px-3 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2d2d40] hover:border-[#8f171c] text-[#e0e1ec] hover:text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
            >
              <Download size={14} className="text-[var(--op-red-bright)]" />
              <span>Exportar JPG</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              data-testid="creature-sheet-delete-btn"
              aria-label="Excluir criatura permanentemente"
              className="min-w-[40px] min-h-[40px] px-2.5 bg-[#160a0d] hover:bg-[#2a1016] border border-[#541b23] text-red-300 hover:text-red-100 inline-flex items-center justify-center gap-1.5 text-xs uppercase cursor-pointer touch-manipulation"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>
        </div>

        {/* Barra secundária de contexto em sessão / erro de salvamento / botão + Bloco */}
        {(saveError ||
          activeInstancesCount > 0 ||
          isEditing ||
          blockActionNotice) && (
          <div className="pt-2.5 border-t border-[#1c1c26] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setBlockActionNotice(null);
                    setShowAddBlockMenu(true);
                  }}
                  data-testid="creature-add-block-top-btn"
                  className="min-h-[38px] px-3 bg-[#151520] hover:bg-[#1f1f2e] border border-[#2e2e40] hover:border-[#8f171c] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <Plus size={14} className="text-[var(--op-red-bright)]" />
                  <span>Adicionar Bloco</span>
                </button>
              )}

              {activeInstancesCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenInitiativesTab}
                  className="min-h-[34px] px-2.5 bg-[#0f1726] hover:bg-[#162238] border border-sky-700/50 text-sky-300 text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Users size={12} />
                  <span>
                    {activeInstancesCount} exemplar
                    {activeInstancesCount === 1 ? "" : "es"} em sessão
                  </span>
                </button>
              )}

              {saveError && (
                <span className="text-red-300 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  <span>{saveError}</span>
                </span>
              )}

              {blockActionNotice && (
                <span className="text-amber-300 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  <span>{blockActionNotice}</span>
                </span>
              )}
            </div>

            {isEditing && (
              <span className="text-[10px] text-[#7c7d8e]">
                Arraste pela alça para reordenar · Redimensione pela borda direita ou presets
              </span>
            )}
          </div>
        )}
      </div>

      {/* CANVAS FLEXBOX DINÂMICO (flex-wrap, zero sobreposição, responsivo) */}
      {blocks.length === 0 ? (
        <div className="bg-[#0c0c10] border border-dashed border-[#2a2a3a] p-8 text-center space-y-3">
          <Skull size={22} className="mx-auto text-[var(--op-red-bright)]" />
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            Ficha sem blocos ativos
          </div>
          <p className="text-[11px] text-[#8a8b9c] max-w-md mx-auto">
            {isEditing
              ? "Adicione blocos de Perfil, Status, Skills, Rituais, Modos ou Texto para compor a ficha desta criatura."
              : "Ative o modo Editar para adicionar blocos a esta ficha."}
          </p>
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowAddBlockMenu(true)}
              className="min-h-[42px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Adicionar Primeiro Bloco</span>
            </button>
          )}
        </div>
      ) : (
        <div
          ref={canvasRef}
          data-testid="creature-blocks-canvas"
          className="flex flex-wrap items-start gap-3 w-full"
        >
          {blocks.map((block, index) => {
            const meta = CREATURE_BLOCK_META[block.type];
            const Icon = getBlockIcon(block.type);
            const activePreview =
              resizePreview && resizePreview.blockId === block.id
                ? resizePreview
                : null;
            const effectiveWidthPct =
              activePreview?.widthPct ?? block.widthPct;
            const effectiveMinHeightPx =
              activePreview && activePreview.minHeightPx !== undefined
                ? activePreview.minHeightPx
                : block.minHeightPx;
            const isFullWidth = !isDesktop || effectiveWidthPct >= 98;
            const isDragged = draggedBlockId === block.id;
            const isDropBefore =
              dropTarget?.blockId === block.id &&
              dropTarget.position === "before";
            const isDropAfter =
              dropTarget?.blockId === block.id &&
              dropTarget.position === "after";

            const containerStyle: React.CSSProperties = isFullWidth
              ? {
                  flex: "1 1 100%",
                  width: "100%",
                  maxWidth: "100%",
                  minHeight: effectiveMinHeightPx
                    ? `${effectiveMinHeightPx}px`
                    : undefined,
                }
              : {
                  flex: `1 1 calc(${effectiveWidthPct}% - 12px)`,
                  minWidth: "260px",
                  maxWidth: "100%",
                  minHeight: effectiveMinHeightPx
                    ? `${effectiveMinHeightPx}px`
                    : undefined,
                };

            return (
              <div
                key={block.id}
                data-testid={`creature-sheet-block-${block.type}`}
                data-block-id={block.id}
                data-block-width={effectiveWidthPct}
                style={containerStyle}
                onDragOver={
                  isEditing ? (e) => handleDragOverBlock(e, block.id) : undefined
                }
                onDrop={
                  isEditing ? (e) => handleDropOnBlock(e, block.id) : undefined
                }
                className={`relative bg-[#0c0c10] border transition-colors flex flex-col min-w-0 ${
                  isDragged
                    ? "opacity-55 border-[var(--op-red-bright)]"
                    : resizingBlockId === block.id
                      ? "border-[var(--op-red-bright)]"
                      : isEditing
                        ? "border-[#252534] hover:border-[#3c3c52]"
                        : "border-[#1f1f2b]"
                } ${
                  isDropBefore
                    ? "border-l-2 border-l-[var(--op-red-bright)]"
                    : ""
                } ${
                  isDropAfter
                    ? "border-r-2 border-r-[var(--op-red-bright)]"
                    : ""
                }`}
              >
                {/* Cabeçalho do Bloco */}
                {isEditing ? (
                  <div
                    data-testid={`creature-block-toolbar-${block.id}`}
                    className="px-2.5 py-1.5 bg-[#101018] border-b border-[#1f1f2d] flex flex-wrap items-center justify-between gap-1.5 select-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, block.id)}
                        onDragEnd={() => {
                          setDraggedBlockId(null);
                          setDropTarget(null);
                        }}
                        title="Arraste para reposicionar este bloco"
                        aria-label={`Arrastar bloco ${meta.label}`}
                        data-testid={`creature-block-drag-${block.id}`}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center text-[#7c7d90] hover:text-white cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical size={14} />
                      </div>
                      <Icon
                        size={12}
                        className="text-[var(--op-red-bright)] shrink-0"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4d5e2] truncate">
                        {meta.label}
                      </span>
                      {isDesktop && (
                        <span className="text-[9px] text-[#7a7b8c] tabular-nums">
                          {effectiveWidthPct}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Presets rápidos de largura (Desktop) */}
                      {isDesktop && (
                        <div className="hidden md:flex items-center gap-0.5 mr-1">
                          {WIDTH_PRESETS.filter(
                            (p) => p.pct >= meta.minWidthPct,
                          ).map((preset) => {
                            const active =
                              Math.abs(block.widthPct - preset.pct) <= 3;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  handleResizeBlock(block.id, {
                                    widthPct: preset.pct,
                                  })
                                }
                                data-testid={`creature-block-width-${block.id}-${preset.pct}`}
                                title={`Definir largura para ${preset.label}`}
                                className={`min-h-[26px] px-1.5 text-[9px] font-bold uppercase border cursor-pointer tabular-nums ${
                                  active
                                    ? "bg-[#1c0b0f] border-[#8f171c] text-white"
                                    : "bg-[#14141e] border-[#262634] text-[#8a8b9c] hover:text-white"
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Reordenar por clique/toque (Mobile & Acessibilidade) */}
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`Mover bloco ${meta.label} para antes`}
                        data-testid={`creature-block-move-prev-${block.id}`}
                        onClick={() => handleMoveBlock(block.id, -1)}
                        className="min-w-[28px] min-h-[28px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-30 touch-manipulation"
                      >
                        <ArrowLeft size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={index === blocks.length - 1}
                        aria-label={`Mover bloco ${meta.label} para depois`}
                        data-testid={`creature-block-move-next-${block.id}`}
                        onClick={() => handleMoveBlock(block.id, 1)}
                        className="min-w-[28px] min-h-[28px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-30 touch-manipulation"
                      >
                        <ArrowRight size={11} />
                      </button>

                      {/* Duplicar (quando suportado pelo bloco, ex: Texto) */}
                      {meta.supportsDuplicate && (
                        <button
                          type="button"
                          aria-label={`Duplicar bloco ${meta.label}`}
                          data-testid={`creature-block-duplicate-${block.id}`}
                          onClick={() => handleDuplicateBlock(block.id)}
                          title="Duplicar bloco"
                          className="min-w-[28px] min-h-[28px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          <Copy size={11} />
                        </button>
                      )}

                      {/* Remover bloco */}
                      <button
                        type="button"
                        aria-label={`Remover bloco ${meta.label}`}
                        data-testid={`creature-block-remove-${block.id}`}
                        onClick={() => handleRemoveBlock(block.id)}
                        title="Remover bloco da ficha"
                        className="min-w-[28px] min-h-[28px] bg-[#1a0b0e] hover:bg-[#2c1116] border border-[#5a1c24] text-red-300 flex items-center justify-center cursor-pointer touch-manipulation"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Modo Visualizar: cabeçalho limpo apenas para seções técnicas (Perfil, Texto e Tabela possuem títulos próprios) */
                  block.type !== "profile" &&
                  block.type !== "text" &&
                  block.type !== "table" && (
                    <div className="px-3.5 py-2 bg-[#0f0f16] border-b border-[#1b1b26] flex items-center gap-1.5">
                      <Icon
                        size={12}
                        className="text-[var(--op-red-bright)] shrink-0"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b4b5c2]">
                        {meta.label}
                      </span>
                    </div>
                  )
                )}

                {/* Conteúdo do Bloco */}
                <div className="p-3.5 flex-1 min-w-0">
                  {block.type === "profile" && (
                    <CreatureProfileBlock
                      creature={draft}
                      folders={folders}
                      ritualCatalog={ritualCatalog}
                      isEditing={isEditing}
                      onUpdateCreature={updateDraft}
                    />
                  )}
                  {block.type === "status" && (
                    <CreatureStatusBlock
                      creature={draft}
                      currentGlobalMode={currentGlobalMode}
                      isEditing={isEditing}
                      onUpdateCreature={updateDraft}
                    />
                  )}
                  {block.type === "skills" && (
                    <CreatureSkillsBlock
                      creature={draft}
                      libraryItems={libraryItems}
                      isEditing={isEditing}
                      onUpdateCreature={updateDraft}
                    />
                  )}
                  {block.type === "rituals" && (
                    <CreatureRitualsBlock
                      creature={draft}
                      ritualCatalog={ritualCatalog}
                      isEditing={isEditing}
                      onUpdateCreature={updateDraft}
                    />
                  )}
                  {block.type === "modes" && (
                    <CreatureModesBlock
                      creature={draft}
                      ritualCatalog={ritualCatalog}
                      isEditing={isEditing}
                      onUpdateCreature={updateDraft}
                    />
                  )}
                  {block.type === "text" && (
                    <CreatureTextBlock
                      block={block}
                      ritualCatalog={ritualCatalog}
                      isEditing={isEditing}
                      onUpdateTextBlock={handleUpdateTextBlock}
                    />
                  )}
                  {block.type === "table" && (
                    <CreatureTableBlock
                      block={block}
                      ritualCatalog={ritualCatalog}
                      isEditing={isEditing}
                      onUpdateTableBlock={handleUpdateTableBlock}
                    />
                  )}
                </div>

                {/* Alça de Redimensionamento Horizontal (Borda Direita - Desktop Edit Mode) */}
                {isEditing && isDesktop && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionar largura do bloco ${meta.label}`}
                    data-testid={`creature-block-resize-x-${block.id}`}
                    onPointerDown={(e) => startHorizontalResize(e, block)}
                    title="Arraste para redimensionar horizontalmente"
                    className="hidden md:block absolute top-8 bottom-2 right-0 w-2 cursor-ew-resize hover:bg-[var(--op-red)]/55 transition-colors"
                  />
                )}

                {/* Alça de Redimensionamento Vertical (Borda Inferior - Blocos compatíveis em Edit Mode) */}
                {isEditing && meta.supportsVerticalResize && (
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label={`Redimensionar altura do bloco ${meta.label}`}
                    data-testid={`creature-block-resize-y-${block.id}`}
                    onPointerDown={(e) => startVerticalResize(e, block)}
                    title="Arraste para redimensionar verticalmente"
                    className="h-2 w-full cursor-ns-resize bg-transparent hover:bg-[var(--op-red)]/45 border-t border-transparent hover:border-[var(--op-red)]/60 transition-colors"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ÁREA DE INSERÇÃO INFERIOR (Edit Mode ONLY) */}
      {isEditing && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              setBlockActionNotice(null);
              setShowAddBlockMenu(true);
            }}
            data-testid="creature-add-block-bottom-btn"
            className="w-full min-h-[44px] bg-[#0b0b11] hover:bg-[#14141e] border border-dashed border-[#2b2b3d] hover:border-[var(--op-red-bright)] text-[#9b9caa] hover:text-white text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors cursor-pointer touch-manipulation"
          >
            <Plus size={14} className="text-[var(--op-red-bright)]" />
            <span>Adicionar Bloco à Ficha</span>
          </button>
        </div>
      )}

      {/* POPUP ADICIONAR BLOCO (mesmo padrão modal da senha do Mestre — PC e Mobile) */}
      <CreatureAddBlockModal
        isOpen={isEditing && showAddBlockMenu}
        presentSingletonTypes={presentSingletonTypes}
        notice={blockActionNotice}
        onSelectBlock={handleAddBlock}
        onClose={() => setShowAddBlockMenu(false)}
      />

      {/* POPUP EXPORTAR FICHA EM JPG (Layout PC / Mobile + Fundo Temporário) */}
      <CreatureSheetExportModal
        isOpen={showExportModal}
        creature={draft}
        folders={folders}
        libraryItems={libraryItems}
        ritualCatalog={ritualCatalog}
        currentGlobalMode={currentGlobalMode}
        onClose={() => setShowExportModal(false)}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO PERMANENTE */}
      {showDeleteModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[380] bg-black/80 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar exclusão permanente da criatura"
            data-testid="creature-delete-confirm-modal"
          >
            <div
              className="w-full sm:max-w-md bg-[#09090e] border border-[#2d2d3d] border-t-2 border-t-[#b91c1c] rounded-none shadow-2xl font-mono p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#220a0d] border border-[#8f171c] flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Excluir Criatura Permanentemente
                  </h3>
                  <p className="text-xs text-[#b4b5c2] mt-1 leading-relaxed">
                    Deseja excluir{" "}
                    <strong className="text-white">{draft.name}</strong> da
                    Biblioteca?
                  </p>
                  <p className="text-[11px] text-[#848596] mt-1.5 leading-relaxed">
                    Skills e Rituais compartilhados na Biblioteca e exemplares já
                    invocados na sessão ativa serão preservados.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1d1d29]">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="min-h-[42px] px-4 bg-[#14141d] hover:bg-[#1e1e2b] border border-[#2a2a38] text-xs uppercase text-[#b4b5c2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  data-testid="creature-delete-confirm-btn"
                  onClick={() => void onDeleteConfirm(draft)}
                  className="min-h-[42px] px-4 bg-[#8f171c] hover:bg-[#b91c1c] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
