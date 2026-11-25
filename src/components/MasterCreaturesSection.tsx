import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Eye,
  Folder,
  FolderOpen,
  FolderPlus,
  Heart,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Skull,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { GameMode } from "../types";
import type { MasterLibraryItem } from "../types/masterLibrary";
import type {
  CreatureFolder,
  CreatureRecord,
  CreatureSummary,
} from "../types/masterCreatures";
import {
  buildCreatureFromLegacyExtra,
  buildInvokedSessionSheetsBatch,
  createCreatureFolderEntry,
  createNewCreatureDraft,
  deleteCreatureFolderEntry,
  filterCreatureSummaries,
  findUnmigratedLegacyExtras,
  getCreatureFolderBreadcrumb,
  getCreatureFolderPathLabel,
  getCreatureFolderStats,
  renameCreatureFolderEntry,
  sortCreatureSummaries,
  toCreatureSummary,
} from "../utils/masterCreatures";
import {
  bulkMoveMasterCreaturesFolder,
  deleteMasterCreature,
  getMasterCreatureById,
  listMasterCreatureFolders,
  listMasterCreatureSummaries,
  saveMasterCreature,
  saveMasterCreatureFolders,
} from "../services/masterCreaturesService";
import type { RitualItem } from "../utils/rituals";
import { getAttributeLimitForLevel } from "../utils/levelSystem";
import {
  buildAvailableRitualsCatalog,
  migrateLegacyCreatureToBlocks,
} from "../utils/creatureBlocks";
import { RitualAffiliationTag } from "./RitualsSection";
import { CreatureRichText } from "./CreatureRichText";
import { MasterCreatureSheetWorkspace } from "./MasterCreatureSheetWorkspace";

export interface MasterCreaturesSectionProps {
  masterId?: string | null;
  libraryItems: MasterLibraryItem[];
  players?: Array<{ id: string; name?: string; rituals?: unknown }>;
  localPlayerRituals?: RitualItem[];
  localPlayerName?: string;
  extraFichas: Record<string, any>[];
  defaultState: Record<string, any>;
  currentGlobalMode: GameMode;
  onInvokeCreatureSheets: (
    sheets: Record<string, any>[],
  ) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  onOpenInitiativesTab?: () => void;
  onCountChange?: (count: number) => void;
}

type SectionViewMode = "list" | "detail" | "editor";

export const MasterCreaturesSection: React.FC<MasterCreaturesSectionProps> = ({
  masterId,
  libraryItems,
  players = [],
  localPlayerRituals = [],
  localPlayerName,
  extraFichas,
  defaultState,
  currentGlobalMode,
  onInvokeCreatureSheets,
  onOpenInitiativesTab,
  onCountChange,
}) => {
  const [folders, setFolders] = useState<CreatureFolder[]>([]);
  const [summaries, setSummaries] = useState<CreatureSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInvokingId, setIsInvokingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [viewMode, setViewMode] = useState<SectionViewMode>("list");
  const [activeCreature, setActiveCreature] = useState<CreatureRecord | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Folder forms
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
    showInitiativesShortcut?: boolean;
  } | null>(null);

  // On-demand cache for full creature records (never pre-populated on list load)
  const creatureCacheRef = useRef<Map<string, CreatureRecord>>(new Map());
  const migrationAttemptedRef = useRef<string | null>(null);
  const extraFichasRef = useRef(extraFichas);
  extraFichasRef.current = extraFichas;

  useEffect(() => {
    onCountChange?.(summaries.length);
  }, [summaries.length, onCountChange]);

  // Initial lean fetch (folders + lightweight creature summaries only) + idempotent legacy extra migration
  useEffect(() => {
    if (!masterId) {
      setFolders([]);
      setSummaries([]);
      setIsLoadingList(false);
      return;
    }

    let cancelled = false;
    setIsLoadingList(true);
    setFeedback(null);

    const loadAll = async () => {
      try {
        const [loadedFolders, loadedSummaries] = await Promise.all([
          listMasterCreatureFolders(masterId),
          listMasterCreatureSummaries(masterId),
        ]);
        if (cancelled) return;

        setFolders(loadedFolders);
        let nextSummaries = loadedSummaries;

        // Migração automática idempotente das Fichas Extras legadas
        if (migrationAttemptedRef.current !== masterId) {
          migrationAttemptedRef.current = masterId;
          const legacyToMigrate = findUnmigratedLegacyExtras(
            extraFichasRef.current,
            loadedSummaries,
          );
          if (legacyToMigrate.length > 0) {
            const migratedSummaries: CreatureSummary[] = [];
            for (const legacyExtra of legacyToMigrate) {
              const converted = buildCreatureFromLegacyExtra(legacyExtra, masterId);
              if (!converted) continue;
              try {
                const saved = await saveMasterCreature(converted, masterId);
                creatureCacheRef.current.set(saved.id, saved);
                migratedSummaries.push(toCreatureSummary(saved));
              } catch {
                // Keep non-blocking so remaining creatures still load cleanly
              }
            }
            if (!cancelled && migratedSummaries.length > 0) {
              nextSummaries = sortCreatureSummaries([
                ...migratedSummaries,
                ...loadedSummaries,
              ]);
              setFeedback({
                type: "info",
                text: `${migratedSummaries.length} Ficha(s) Extra(s) existente(s) foram migradas automaticamente para a Biblioteca de Criaturas.`,
              });
            }
          }
        }

        if (!cancelled) {
          setSummaries(nextSummaries);
        }
      } catch (err: any) {
        if (!cancelled) {
          setFeedback({
            type: "error",
            text: err?.message || "Falha ao carregar criaturas da Biblioteca.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [masterId]);

  const effectiveFolderId = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.some((f) => f.id === currentFolderId) ? currentFolderId : null;
  }, [currentFolderId, folders]);

  const breadcrumb = useMemo(
    () => getCreatureFolderBreadcrumb(folders, effectiveFolderId),
    [folders, effectiveFolderId],
  );

  const childFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders
      .filter((f) => f.parentId === effectiveFolderId)
      .filter((f) => (!q ? true : f.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [folders, effectiveFolderId, search]);

  const visibleSummaries = useMemo(
    () =>
      filterCreatureSummaries(summaries, {
        currentFolderId: effectiveFolderId,
        search,
        searchAllFolders: true,
      }),
    [summaries, effectiveFolderId, search],
  );

  const activeInstancesByCreatureId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sheet of extraFichas) {
      if (sheet?.synchronized && typeof sheet.sourceCreatureId === "string") {
        counts.set(
          sheet.sourceCreatureId,
          (counts.get(sheet.sourceCreatureId) || 0) + 1,
        );
      }
    }
    return counts;
  }, [extraFichas]);

  const ritualCatalog = useMemo(
    () =>
      buildAvailableRitualsCatalog({
        libraryItems,
        players,
        localPlayerRituals,
        localPlayerName,
      }),
    [libraryItems, players, localPlayerRituals, localPlayerName],
  );

  const loadFullCreatureOnDemand = useCallback(
    async (creatureId: string): Promise<CreatureRecord | null> => {
      const cached = creatureCacheRef.current.get(creatureId);
      if (cached) return cached;
      if (!masterId) return null;

      setIsLoadingDetail(true);
      try {
        const fetched = await getMasterCreatureById(creatureId, masterId);
        if (!fetched) return null;

        // Migração automática e não-destrutiva de fichas antigas (v1 fixa -> v2 blocos dinâmicos)
        const { creature: readyRecord, migrated } =
          migrateLegacyCreatureToBlocks(fetched);
        creatureCacheRef.current.set(readyRecord.id, readyRecord);

        if (migrated) {
          void saveMasterCreature(readyRecord, masterId)
            .then((saved) => {
              creatureCacheRef.current.set(saved.id, saved);
            })
            .catch(() => {
              // Mantém ficha migrada em memória; será salva na próxima edição
            });
        }

        return readyRecord;
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [masterId],
  );

  const handleOpenCreature = async (
    creatureId: string,
    targetMode: "detail" | "editor",
  ) => {
    setFeedback(null);
    try {
      const record = await loadFullCreatureOnDemand(creatureId);
      if (!record) {
        setFeedback({
          type: "error",
          text: "Não foi possível encontrar a ficha completa desta criatura.",
        });
        return;
      }
      setActiveCreature(record);
      setViewMode(targetMode);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Erro ao carregar ficha completa da criatura.",
      });
    }
  };

  const handleCreateCreature = async () => {
    if (!masterId || isCreating) return;
    setIsCreating(true);
    setFeedback(null);
    try {
      const draft = createNewCreatureDraft(masterId, effectiveFolderId);
      const saved = await saveMasterCreature(draft, masterId);
      creatureCacheRef.current.set(saved.id, saved);
      setSummaries((prev) =>
        sortCreatureSummaries([
          toCreatureSummary(saved),
          ...prev.filter((c) => c.id !== saved.id),
        ]),
      );
      setActiveCreature(saved);
      setViewMode("editor");
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Não foi possível criar a nova criatura.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveCreatureRecord = useCallback(
    async (
      record: CreatureRecord,
    ): Promise<{ ok: true; record: CreatureRecord } | { ok: false; error: string }> => {
      if (!masterId) {
        return { ok: false, error: "Identificador do Mestre indisponível." };
      }
      try {
        const saved = await saveMasterCreature(record, masterId);
        creatureCacheRef.current.set(saved.id, saved);
        setActiveCreature((prev) => (prev && prev.id === saved.id ? saved : prev));
        setSummaries((prev) =>
          sortCreatureSummaries([
            toCreatureSummary(saved),
            ...prev.filter((c) => c.id !== saved.id),
          ]),
        );
        return { ok: true, record: saved };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || "Erro ao salvar criatura no banco de dados.",
        };
      }
    },
    [masterId],
  );

  const handleDeleteCreaturePermanent = async (creature: CreatureRecord) => {
    if (!masterId || isDeleting) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await deleteMasterCreature(creature.id, masterId);
      creatureCacheRef.current.delete(creature.id);
      setSummaries((prev) => prev.filter((c) => c.id !== creature.id));
      setActiveCreature(null);
      setViewMode("list");
      setFeedback({
        type: "info",
        text: `Criatura "${creature.name}" excluída permanentemente da Biblioteca. Skills compartilhadas e instâncias já em sessão foram preservadas.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Falha ao excluir criatura permanentemente.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInvokeCreature = async (
    creature: CreatureRecord,
    quantity: number = 1,
  ) => {
    setIsInvokingId(creature.id);
    setFeedback(null);
    try {
      const existingNames = extraFichas.map((f) => String(f?.name || ""));
      const sheets = buildInvokedSessionSheetsBatch(
        creature,
        quantity,
        libraryItems,
        existingNames,
        defaultState,
        ritualCatalog,
      );
      const res = await onInvokeCreatureSheets(sheets);
      if (res.ok === false) {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao invocar criatura na sessão ativa.",
        });
        return;
      }

      const createdNames = sheets.map((s) => s.name).join(", ");
      setFeedback({
        type: "success",
        text:
          sheets.length === 1
            ? `"${createdNames}" invocada na sessão ativa (Iniciativas).`
            : `${sheets.length} exemplares invocados nas Iniciativas: ${createdNames}.`,
        showInitiativesShortcut: true,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Erro ao invocar criatura na sessão.",
      });
    } finally {
      setIsInvokingId(null);
    }
  };

  // Folder CRUD
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterId) return;
    setFeedback(null);
    const res = createCreatureFolderEntry(
      folders,
      masterId,
      newFolderName,
      effectiveFolderId,
    );
    if (res.ok === false) {
      setFeedback({ type: "error", text: res.error });
      return;
    }
    try {
      const savedFolders = await saveMasterCreatureFolders(masterId, res.folders);
      setFolders(savedFolders);
      setNewFolderName("");
      setShowNewFolderForm(false);
      setFeedback({
        type: "success",
        text: `Pasta "${res.folder.name}" criada.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Falha ao salvar pasta.",
      });
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent, folderId: string) => {
    e.preventDefault();
    if (!masterId) return;
    setFeedback(null);
    const res = renameCreatureFolderEntry(folders, folderId, renameDraft);
    if (res.ok === false) {
      setFeedback({ type: "error", text: res.error });
      return;
    }
    try {
      const savedFolders = await saveMasterCreatureFolders(masterId, res.folders);
      setFolders(savedFolders);
      setRenamingFolderId(null);
      setRenameDraft("");
      setFeedback({ type: "success", text: "Pasta renomeada com sucesso." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Falha ao renomear pasta.",
      });
    }
  };

  const handleConfirmDeleteFolder = async (folder: CreatureFolder) => {
    if (!masterId) return;
    setFeedback(null);
    const result = deleteCreatureFolderEntry(folders, summaries, folder.id);
    setConfirmDeleteFolderId(null);
    try {
      if (result.reassignedCreatureIds.length > 0) {
        await bulkMoveMasterCreaturesFolder(
          result.reassignedCreatureIds,
          result.targetParentId,
          masterId,
        );
        for (const id of result.reassignedCreatureIds) {
          const cached = creatureCacheRef.current.get(id);
          if (cached) {
            creatureCacheRef.current.set(id, {
              ...cached,
              folderId: result.targetParentId,
            });
          }
        }
      }
      const savedFolders = await saveMasterCreatureFolders(masterId, result.folders);
      setFolders(savedFolders);
      setSummaries(result.summaries);
      setFeedback({
        type: "info",
        text:
          result.reassignedCreatureIds.length > 0
            ? `Pasta "${folder.name}" excluída. ${result.reassignedCreatureIds.length} criatura(s) movida(s) para o diretório anterior.`
            : `Pasta "${folder.name}" excluída.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Falha ao excluir pasta.",
      });
    }
  };

  return (
    <div className="space-y-4 font-mono" data-testid="master-creatures-section">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          data-testid="creatures-feedback-banner"
          className={`px-3.5 py-2.5 text-xs border flex flex-wrap items-center justify-between gap-2 ${
            feedback.type === "error"
              ? "bg-red-950/45 border-red-700/60 text-red-300"
              : feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
                : "bg-[#13131b] border-[#282834] text-[#c8c9d6]"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {feedback.type === "error" ? (
              <AlertTriangle size={14} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2
                size={14}
                className={`shrink-0 ${
                  feedback.type === "success" ? "text-emerald-400" : "text-[#8a8b99]"
                }`}
              />
            )}
            <span className="break-words">{feedback.text}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {feedback.showInitiativesShortcut && onOpenInitiativesTab && (
              <button
                type="button"
                onClick={onOpenInitiativesTab}
                data-testid="creatures-banner-goto-initiatives"
                className="min-h-[34px] px-2.5 bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-500/50 text-[10px] font-bold uppercase tracking-wider text-emerald-100 inline-flex items-center gap-1 cursor-pointer"
              >
                <Users size={12} />
                <span>Ir para Iniciativas</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
              className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay while opening a full sheet on demand */}
      {isLoadingDetail && (
        <div className="bg-[#0c0c10] border border-[#202028] p-8 flex items-center justify-center gap-2.5 text-xs text-[#9b9caa]">
          <Loader2 size={16} className="animate-spin text-[var(--op-red-bright)]" />
          <span>Carregando ficha completa da criatura...</span>
        </div>
      )}

      {/* WORKSPACE UNIFICADO DE FICHA DINÂMICA (MODO VISUALIZAR / EDITAR) */}
      {!isLoadingDetail &&
        (viewMode === "detail" || viewMode === "editor") &&
        activeCreature && (
          <MasterCreatureSheetWorkspace
            creature={activeCreature}
            initialMode={viewMode === "editor" ? "edit" : "view"}
            folders={folders}
            libraryItems={libraryItems}
            ritualCatalog={ritualCatalog}
            currentGlobalMode={currentGlobalMode}
            activeInstancesCount={
              activeInstancesByCreatureId.get(activeCreature.id) || 0
            }
            isInvoking={isInvokingId === activeCreature.id}
            isDeleting={isDeleting}
            onSaveCreature={handleSaveCreatureRecord}
            onBackToList={() => {
              setViewMode("list");
              setActiveCreature(null);
            }}
            onInvoke={handleInvokeCreature}
            onDeleteConfirm={handleDeleteCreaturePermanent}
            onOpenInitiativesTab={onOpenInitiativesTab}
          />
        )}

      {/* MODO LISTAGEM & ORGANIZAÇÃO EM PASTAS */}
      {!isLoadingDetail && viewMode === "list" && (
        <>
          {/* Barra de ações de Criaturas */}
          <div className="bg-[#0c0c10] border border-[#202028] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Skull size={16} className="text-[var(--op-red-bright)] shrink-0" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Bestiário & Fichas de Criaturas
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#14141c] border border-[#262634] text-[#9b9caa] tabular-nums">
                  {summaries.length}
                </span>
              </div>
              <p className="text-[11px] text-[#7e8090] mt-0.5">
                Apenas o Mestre pode administrar, editar, excluir e invocar criaturas para a sessão.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNewFolderForm((p) => !p)}
                data-testid="creatures-new-folder-btn"
                className="min-h-[44px] sm:min-h-[40px] px-3 bg-[#14141c] hover:bg-[#1c1c28] text-zinc-200 border border-[#282834] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
              >
                <FolderPlus size={14} />
                <span>Nova Pasta</span>
              </button>

              <button
                type="button"
                disabled={isCreating || !masterId}
                onClick={handleCreateCreature}
                data-testid="creatures-new-creature-btn"
                className="min-h-[44px] sm:min-h-[40px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 touch-manipulation"
              >
                {isCreating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                <span>Nova Criatura</span>
              </button>
            </div>
          </div>

          {/* Formulário Inline de Nova Pasta */}
          {showNewFolderForm && (
            <form
              onSubmit={handleCreateFolderSubmit}
              data-testid="creatures-new-folder-form"
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
                    : "Nome da pasta (ex: Entidades de Sangue, Cultistas, Chefes)..."
                }
                aria-label="Nome da nova pasta de criaturas"
                data-testid="creatures-new-folder-input"
                className="flex-1 min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 text-xs text-white outline-none rounded-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  data-testid="creatures-create-folder-submit"
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
          )}

          {/* Breadcrumb + Pesquisa */}
          <div className="bg-[#0c0c10] border border-[#202028] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1c1c26]">
              <nav
                aria-label="Caminho de pastas de Criaturas"
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
                  <span>Criaturas</span>
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

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727282] pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar criaturas pelo nome ou descrição em todas as pastas..."
                aria-label="Pesquisar criaturas"
                data-testid="creatures-search-input"
                className="w-full min-h-[42px] bg-[#13131b] border border-[#262632] focus:border-[var(--op-red-bright)] pl-9 pr-8 py-2 text-xs text-white placeholder-[#6e7080] outline-none rounded-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca de criaturas"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#727282] hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {isLoadingList ? (
            <div className="bg-[#0c0c10] border border-[#202028] p-8 flex items-center justify-center gap-2.5 text-xs text-[#9b9caa]">
              <Loader2 size={16} className="animate-spin text-[var(--op-red-bright)]" />
              <span>Carregando criaturas da Biblioteca...</span>
            </div>
          ) : (
            <>
              {/* Pastas */}
              {childFolders.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#7e8090] px-0.5">
                    // Pastas ({childFolders.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {childFolders.map((folder) => {
                      const stats = getCreatureFolderStats(folders, summaries, folder.id);
                      const isRenaming = renamingFolderId === folder.id;
                      const isConfirmingDelete = confirmDeleteFolderId === folder.id;

                      return (
                        <div
                          key={folder.id}
                          data-testid={`creature-folder-${folder.id}`}
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
                                aria-label="Novo nome da pasta de criaturas"
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
                                  {stats.totalCreatures} criatura
                                  {stats.totalCreatures === 1 ? "" : "s"}
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
                                Excluir pasta? Criaturas serão mantidas.
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

              {/* Lista de Criaturas (apenas metadados leves) */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#7e8090] px-0.5">
                  // Criaturas{" "}
                  {search.trim()
                    ? `(busca global: ${visibleSummaries.length})`
                    : `em ${getCreatureFolderPathLabel(folders, effectiveFolderId)} (${visibleSummaries.length})`}
                </div>

                {visibleSummaries.length === 0 ? (
                  <div className="bg-[#0c0c10] border border-dashed border-[#262634] p-8 text-center space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#b4b5c2]">
                      {search.trim()
                        ? "Nenhuma criatura encontrada para a busca atual"
                        : childFolders.length > 0
                          ? "Nenhuma criatura diretamente nesta pasta"
                          : "Nenhuma criatura registrada nesta pasta"}
                    </div>
                    <p className="text-[11px] text-[#787989] max-w-md mx-auto">
                      Cadastre entidades, cultistas e ameaças paranormais com atributos e
                      Skills integradas ao Demologia e invoque múltiplos exemplares na
                      sessão quando necessário.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isCreating || !masterId}
                        onClick={handleCreateCreature}
                        className="min-h-[42px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Criar Criatura</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleSummaries.map((summary) => {
                      const activeCount = activeInstancesByCreatureId.get(summary.id) || 0;
                      const attrLimit = getAttributeLimitForLevel(summary.lv);

                      return (
                        <article
                          key={summary.id}
                          data-testid={`creature-card-${summary.id}`}
                          className="demologia-list-card bg-[#0c0c10] border border-[#22222e] hover:border-[#3c3c4e] p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-colors"
                        >
                          {/* Cópia do Bloco de Perfil da Criatura */}
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => handleOpenCreature(summary.id, "detail")}
                                className="text-left min-w-0 flex-1 space-y-1.5 group cursor-pointer"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#12121a] border border-[#262634] text-[#9b9caa]">
                                    <Folder size={10} className="text-[var(--op-red-bright)]" />
                                    <span className="max-w-[140px] truncate">
                                      {getCreatureFolderPathLabel(folders, summary.folderId)}
                                    </span>
                                  </span>

                                  <span
                                    data-testid={`creature-card-lv-${summary.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a0b0e] border border-[#8f171c]/70 text-white font-bold tabular-nums"
                                  >
                                    <span>LV {summary.lv}</span>
                                    <span className="text-[#ff8a90] font-normal">
                                      · Teto {attrLimit}
                                    </span>
                                  </span>

                                  {activeCount > 0 && (
                                    <span className="px-1.5 py-0.5 text-[9px] bg-[#101828] border border-sky-700/50 text-sky-300 uppercase tabular-nums">
                                      {activeCount} em sessão
                                    </span>
                                  )}
                                </div>

                                <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-[#ff8a90] uppercase tracking-wider break-words leading-tight transition-colors">
                                  {summary.name}
                                </h2>
                              </button>

                              {/* Botões de Ação: Olho (Visualizar) e Lápis (Editar) */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreature(summary.id, "detail")}
                                  aria-label={`Visualizar ${summary.name}`}
                                  title="Visualizar"
                                  data-testid={`creature-open-${summary.id}`}
                                  className="min-w-[40px] min-h-[40px] bg-[#14141e] hover:bg-[#1e1e2c] border border-[#282838] hover:border-[#4a4a62] text-zinc-100 hover:text-white flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                                >
                                  <Eye size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenCreature(summary.id, "editor")}
                                  aria-label={`Editar ${summary.name}`}
                                  title="Editar"
                                  data-testid={`creature-edit-${summary.id}`}
                                  className="min-w-[40px] min-h-[40px] bg-[#14141e] hover:bg-[#1e1e2c] border border-[#282838] hover:border-[var(--op-red-bright)] text-[#b4b5c2] hover:text-white flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                                >
                                  <Pencil size={15} />
                                </button>
                              </div>
                            </div>

                            {summary.affiliations.length > 0 && (
                              <div
                                className="flex flex-wrap items-center gap-1.5"
                                data-testid={`creature-card-affiliations-${summary.id}`}
                              >
                                {summary.affiliations.map((affId) => (
                                  <RitualAffiliationTag key={affId} affiliationId={affId} />
                                ))}
                              </div>
                            )}

                            <div
                              className="pt-2 border-t border-[#1c1c26]"
                              data-testid={`creature-card-desc-${summary.id}`}
                            >
                              <CreatureRichText
                                text={summary.description || summary.descriptionPreview}
                                emptyText="Sem descrição registrada para esta criatura."
                                ritualCatalog={ritualCatalog}
                              />
                            </div>
                          </div>

                          {/* Spoiler de HP, PE e SM */}
                          <div
                            data-testid={`creature-card-stats-spoiler-${summary.id}`}
                            className="pt-2.5 border-t border-[#1c1c26] flex flex-wrap items-center gap-2 text-[11px] tabular-nums"
                          >
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#140d10] border border-[#4a1820] text-red-300 font-bold">
                              <Heart size={11} />
                              <span>HP {summary.hpMax}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#10131e] border border-[#243456] text-sky-300 font-bold">
                              <Zap size={11} />
                              <span>PE {summary.peMax}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#161022] border border-violet-700/50 text-violet-200 font-bold">
                              <Shield size={11} />
                              <span>SM {summary.smMax}</span>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
