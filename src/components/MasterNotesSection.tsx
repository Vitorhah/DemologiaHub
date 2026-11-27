import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Edit2,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  MasterNote,
  MasterNoteSummary,
  NoteSaveStatus,
} from "../types/masterNotes";
import {
  createMasterNote,
  deleteMasterNote,
  getMasterNoteById,
  listMasterNoteSummaries,
  updateMasterNote,
} from "../services/masterNotesService";
import {
  DEFAULT_NOTE_TITLE,
  MAX_NOTE_TITLE_LENGTH,
  NOTE_AUTOSAVE_DEBOUNCE_MS,
  MasterNoteHeadingLevel,
  applyHeadingPrefixToLine,
  buildNotePreview,
  clearPendingNoteDraft,
  filterNoteSummaries,
  formatNoteTimestamp,
  hasNoteContentChanged,
  loadPendingNoteDraft,
  normalizeNoteTitle,
  parseMasterNoteContent,
  savePendingNoteDraft,
  sortNoteSummaries,
} from "../utils/masterNotes";
import { renderRichInlineTokens } from "./CreatureRichText";

const MASTER_NOTE_HEADING_LEVELS: readonly MasterNoteHeadingLevel[] = [
  1, 2, 3, 4, 5, 6,
];

const HEADING_CLASS_MAP: Record<MasterNoteHeadingLevel, string> = {
  1: "text-2xl sm:text-[26px] font-black text-white uppercase tracking-wider border-b-2 border-[var(--op-red)] pb-1.5 pt-2 leading-tight",
  2: "text-xl sm:text-[21px] font-bold text-[#f3f4f8] uppercase tracking-wide border-b border-[#252534] pb-1 pt-2 leading-snug",
  3: "text-lg font-bold text-[#ff8a90] tracking-wide pt-1.5 leading-snug",
  4: "text-base font-bold text-[#e2e3ee] pt-1 leading-snug",
  5: "text-sm font-bold uppercase tracking-wider text-[#b8b9c8] pt-1 leading-snug",
  6: "text-xs font-bold uppercase tracking-[0.18em] text-[#8d8ea0] pt-1 leading-snug",
};

export interface MasterNotesSectionProps {
  masterId: string | null | undefined;
  onCountChange?: (count: number) => void;
}

export const MasterNotesSection: React.FC<MasterNotesSectionProps> = ({
  masterId,
  onCountChange,
}) => {
  const effectiveMasterId = (masterId || "").trim();

  // Lista enxuta (apenas id, master_id, title, preview, updated_at)
  const [summaries, setSummaries] = useState<MasterNoteSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  // Nota selecionada + editor de texto simples
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState<boolean>(false);
  const [noteLoadError, setNoteLoadError] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftContent, setDraftContent] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>("idle");
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [editorViewMode, setEditorViewMode] = useState<"edit" | "preview">("edit");

  const parsedNoteBlocks = useMemo(
    () => parseMasterNoteContent(draftContent),
    [draftContent],
  );

  // Cache em memória das notas já abertas nesta sessão (evita SELECT repetido ao alternar)
  const contentCacheRef = useRef<Map<string, MasterNote>>(new Map());
  // Último estado efetivamente salvo no banco para a nota selecionada
  const lastSavedRef = useRef<{
    id: string;
    title: string;
    content: string;
  } | null>(null);
  // Refs para flush seguro sem causar re-renders nem closures obsoletas
  const draftRef = useRef<{ id: string | null; title: string; content: string }>({
    id: null,
    title: "",
    content: "",
  });
  const debounceTimerRef = useRef<number | null>(null);
  const openReqIdRef = useRef<number>(0);
  const saveReqIdRef = useRef<number>(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasLoadedOnceRef = useRef<string | null>(null);

  draftRef.current = {
    id: selectedId,
    title: draftTitle,
    content: draftContent,
  };

  useEffect(() => {
    onCountChange?.(summaries.length);
  }, [summaries.length, onCountChange]);

  const cancelDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Persiste no Supabase apenas se houver diferença real em relação ao último estado salvo
  const persistNote = useCallback(
    async (
      noteId: string,
      titleInput: string,
      contentInput: string,
      options?: { silentIfUnchanged?: boolean }
    ): Promise<boolean> => {
      if (!effectiveMasterId || !noteId) return false;

      const lastSaved = lastSavedRef.current;
      const isCurrentNote = draftRef.current.id === noteId;
      const normalizedTitle = normalizeNoteTitle(titleInput);

      if (
        options?.silentIfUnchanged !== false &&
        lastSaved &&
        lastSaved.id === noteId &&
        !hasNoteContentChanged(lastSaved, {
          title: normalizedTitle,
          content: contentInput,
        })
      ) {
        return true;
      }

      const reqId = ++saveReqIdRef.current;
      if (isCurrentNote) {
        setSaveStatus("saving");
        setSaveErrorDetail(null);
      }

      try {
        const updated = await updateMasterNote(noteId, effectiveMasterId, {
          title: normalizedTitle,
          content: contentInput,
        });

        clearPendingNoteDraft(effectiveMasterId, noteId);
        contentCacheRef.current.set(noteId, updated);

        if (lastSavedRef.current?.id === noteId || isCurrentNote) {
          lastSavedRef.current = {
            id: noteId,
            title: updated.title,
            content: updated.content,
          };
        }

        setSummaries((prev) =>
          sortNoteSummaries(
            prev.map((item) =>
              item.id === noteId
                ? {
                    ...item,
                    title: updated.title,
                    preview: updated.preview,
                    updated_at: updated.updated_at,
                  }
                : item
            )
          )
        );

        if (draftRef.current.id === noteId && reqId === saveReqIdRef.current) {
          setSaveStatus("saved");
          setSaveErrorDetail(null);
        }
        return true;
      } catch (err: any) {
        // Preserva o conteúdo digitado localmente em caso de falha temporária de conexão
        savePendingNoteDraft({
          id: noteId,
          master_id: effectiveMasterId,
          title: normalizedTitle,
          content: contentInput,
          updated_at: new Date().toISOString(),
        });

        if (draftRef.current.id === noteId && reqId === saveReqIdRef.current) {
          setSaveStatus("error");
          setSaveErrorDetail(
            err?.message || "Sem conexão com o servidor. Texto preservado localmente."
          );
        }
        return false;
      }
    },
    [effectiveMasterId]
  );

  const flushPendingSave = useCallback(() => {
    cancelDebounce();
    const { id, title, content } = draftRef.current;
    if (!id || !effectiveMasterId) return;
    if (
      lastSavedRef.current &&
      lastSavedRef.current.id === id &&
      hasNoteContentChanged(lastSavedRef.current, { title, content })
    ) {
      void persistNote(id, title, content);
    }
  }, [cancelDebounce, effectiveMasterId, persistNote]);

  // Flush ao desmontar a seção (sem polling nem listeners contínuos)
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const loadSummaries = useCallback(async () => {
    if (!effectiveMasterId) return;
    setIsLoadingList(true);
    setListError(null);
    try {
      const list = await listMasterNoteSummaries(effectiveMasterId);
      setSummaries(list);
    } catch (err: any) {
      setListError(err?.message || "Não foi possível carregar as anotações.");
    } finally {
      setIsLoadingList(false);
    }
  }, [effectiveMasterId]);

  // Consulta única na abertura da seção (sem polling, sem Realtime)
  useEffect(() => {
    if (!effectiveMasterId) return;
    if (hasLoadedOnceRef.current === effectiveMasterId) return;
    hasLoadedOnceRef.current = effectiveMasterId;
    void loadSummaries();
  }, [effectiveMasterId, loadSummaries]);

  const scheduleAutosave = useCallback(
    (noteId: string, nextTitle: string, nextContent: string) => {
      cancelDebounce();
      if (!effectiveMasterId) return;

      const lastSaved = lastSavedRef.current;
      if (
        lastSaved &&
        lastSaved.id === noteId &&
        !hasNoteContentChanged(lastSaved, {
          title: nextTitle,
          content: nextContent,
        })
      ) {
        return;
      }

      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void persistNote(noteId, nextTitle, nextContent);
      }, NOTE_AUTOSAVE_DEBOUNCE_MS);
    },
    [cancelDebounce, effectiveMasterId, persistNote]
  );

  const handleOpenNote = useCallback(
    async (summary: MasterNoteSummary) => {
      if (!effectiveMasterId) return;
      if (selectedId === summary.id && !noteLoadError) {
        setConfirmDelete(false);
        return;
      }

      // Salva alterações pendentes da nota anterior antes de trocar
      flushPendingSave();

      setSelectedId(summary.id);
      setConfirmDelete(false);
      setNoteLoadError(null);
      setSaveErrorDetail(null);

      // Verifica rascunho não salvo de falha anterior de conexão
      const pendingDraft = loadPendingNoteDraft(effectiveMasterId, summary.id);
      const cached = contentCacheRef.current.get(summary.id);

      if (cached) {
        if (pendingDraft) {
          lastSavedRef.current = {
            id: cached.id,
            title: cached.title,
            content: cached.content,
          };
          setDraftTitle(
            pendingDraft.title === DEFAULT_NOTE_TITLE ? "" : pendingDraft.title
          );
          setDraftContent(pendingDraft.content);
          setSaveStatus("error");
          setSaveErrorDetail(
            "Alteração local pendente de sincronização. Clique em tentar novamente ou continue editando."
          );
        } else {
          lastSavedRef.current = {
            id: cached.id,
            title: cached.title,
            content: cached.content,
          };
          setDraftTitle(cached.title === DEFAULT_NOTE_TITLE ? "" : cached.title);
          setDraftContent(cached.content);
          setSaveStatus("saved");
        }
        return;
      }

      // Carrega conteúdo completo sob demanda apenas ao abrir a nota
      const reqId = ++openReqIdRef.current;
      setIsLoadingNote(true);
      setDraftTitle(summary.title === DEFAULT_NOTE_TITLE ? "" : summary.title);
      setDraftContent("");
      setSaveStatus("idle");

      try {
        const full = await getMasterNoteById(summary.id, effectiveMasterId);
        if (reqId !== openReqIdRef.current) return;

        if (!full) {
          setNoteLoadError("Anotação não encontrada no banco de dados.");
          return;
        }

        contentCacheRef.current.set(full.id, full);
        lastSavedRef.current = {
          id: full.id,
          title: full.title,
          content: full.content,
        };

        if (pendingDraft) {
          setDraftTitle(
            pendingDraft.title === DEFAULT_NOTE_TITLE ? "" : pendingDraft.title
          );
          setDraftContent(pendingDraft.content);
          setSaveStatus("error");
          setSaveErrorDetail(
            "Alteração anterior preservada localmente. Clique em tentar novamente para salvar."
          );
        } else {
          setDraftTitle(full.title === DEFAULT_NOTE_TITLE ? "" : full.title);
          setDraftContent(full.content);
          setSaveStatus("saved");
        }
      } catch (err: any) {
        if (reqId !== openReqIdRef.current) return;
        if (pendingDraft) {
          lastSavedRef.current = {
            id: summary.id,
            title: summary.title,
            content: "",
          };
          setDraftTitle(
            pendingDraft.title === DEFAULT_NOTE_TITLE ? "" : pendingDraft.title
          );
          setDraftContent(pendingDraft.content);
          setSaveStatus("error");
          setSaveErrorDetail(
            "Sem conexão ao carregar. Exibindo rascunho preservado localmente."
          );
        } else {
          setNoteLoadError(
            err?.message || "Erro ao carregar conteúdo da anotação."
          );
        }
      } finally {
        if (reqId === openReqIdRef.current) {
          setIsLoadingNote(false);
        }
      }
    },
    [effectiveMasterId, flushPendingSave, noteLoadError, selectedId]
  );

  const handleCreateNote = async () => {
    if (!effectiveMasterId || isCreating) return;
    flushPendingSave();
    setIsCreating(true);
    setListError(null);
    setNoteLoadError(null);
    setConfirmDelete(false);

    try {
      const created = await createMasterNote(effectiveMasterId);
      contentCacheRef.current.set(created.id, created);
      lastSavedRef.current = {
        id: created.id,
        title: created.title,
        content: created.content,
      };

      const summary: MasterNoteSummary = {
        id: created.id,
        master_id: created.master_id,
        title: created.title,
        preview: created.preview,
        updated_at: created.updated_at,
      };

      setSummaries((prev) => sortNoteSummaries([summary, ...prev]));
      setSelectedId(created.id);
      setDraftTitle("");
      setDraftContent("");
      setSaveStatus("saved");
      setSaveErrorDetail(null);

      // Foca o campo de conteúdo ou título para escrita imediata
      window.requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    } catch (err: any) {
      setListError(err?.message || "Não foi possível criar uma nova anotação.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = e.target.value;
    setDraftTitle(nextTitle);
    if (!selectedId) return;

    const normalized = normalizeNoteTitle(nextTitle);
    setSummaries((prev) =>
      prev.map((item) =>
        item.id === selectedId ? { ...item, title: normalized } : item
      )
    );
    scheduleAutosave(selectedId, nextTitle, draftContent);
  };

  const commitContentUpdate = (nextContent: string) => {
    setDraftContent(nextContent);
    if (!selectedId) return;

    const preview = buildNotePreview(nextContent);
    setSummaries((prev) =>
      prev.map((item) =>
        item.id === selectedId ? { ...item, preview } : item
      )
    );
    scheduleAutosave(selectedId, draftTitle, nextContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    commitContentUpdate(e.target.value);
  };

  const handleApplyHeading = (level: MasterNoteHeadingLevel) => {
    const textarea = contentTextareaRef.current;
    const cursorPos =
      textarea && editorViewMode === "edit"
        ? textarea.selectionStart ?? draftContent.length
        : draftContent.length;

    const baseContent =
      editorViewMode === "preview" &&
      draftContent.length > 0 &&
      !draftContent.endsWith("\n")
        ? `${draftContent}\n`
        : draftContent;
    const effectiveCursor =
      editorViewMode === "preview" ? baseContent.length : cursorPos;

    const { content: nextContent, nextCursor } = applyHeadingPrefixToLine(
      baseContent,
      effectiveCursor,
      level,
    );

    if (editorViewMode !== "edit") {
      setEditorViewMode("edit");
    }
    commitContentUpdate(nextContent);
    window.requestAnimationFrame(() => {
      const el = contentTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleInsertInlineSyntax = (snippet: string) => {
    const textarea = contentTextareaRef.current;
    const start =
      textarea && editorViewMode === "edit"
        ? textarea.selectionStart ?? draftContent.length
        : draftContent.length;
    const end =
      textarea && editorViewMode === "edit"
        ? textarea.selectionEnd ?? start
        : start;

    const nextContent =
      draftContent.slice(0, start) + snippet + draftContent.slice(end);
    const nextCursor = start + snippet.length;
    if (editorViewMode !== "edit") {
      setEditorViewMode("edit");
    }
    commitContentUpdate(nextContent);
    window.requestAnimationFrame(() => {
      const el = contentTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleRetrySave = () => {
    if (!selectedId) return;
    cancelDebounce();
    void persistNote(selectedId, draftTitle, draftContent, {
      silentIfUnchanged: false,
    });
  };

  const handleConfirmDeleteNote = async () => {
    if (!selectedId || !effectiveMasterId || isDeleting) return;
    const targetId = selectedId;
    cancelDebounce();
    setIsDeleting(true);

    try {
      await deleteMasterNote(targetId, effectiveMasterId);
      contentCacheRef.current.delete(targetId);
      clearPendingNoteDraft(effectiveMasterId, targetId);
      if (lastSavedRef.current?.id === targetId) {
        lastSavedRef.current = null;
      }

      setSummaries((prev) => prev.filter((item) => item.id !== targetId));
      setSelectedId(null);
      setDraftTitle("");
      setDraftContent("");
      setSaveStatus("idle");
      setSaveErrorDetail(null);
      setConfirmDelete(false);
    } catch (err: any) {
      setSaveStatus("error");
      setSaveErrorDetail(err?.message || "Erro ao excluir anotação.");
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackToListMobile = () => {
    flushPendingSave();
    setConfirmDelete(false);
    setSelectedId(null);
  };

  const visibleSummaries = useMemo(
    () => filterNoteSummaries(summaries, search),
    [summaries, search]
  );

  const activeSummary = useMemo(
    () => summaries.find((s) => s.id === selectedId) || null,
    [summaries, selectedId]
  );

  if (!effectiveMasterId) {
    return (
      <div
        className="bg-[#0c0c10] border border-[#202028] p-6 text-center text-xs text-[#8e90a0]"
        data-testid="master-notes-section"
      >
        Sessão do Mestre indisponível para carregar anotações privadas.
      </div>
    );
  }

  return (
    <section
      aria-label="Anotações do Mestre"
      className="flex flex-col gap-3"
      data-testid="master-notes-section"
    >
      {/* BARRA SUPERIOR DA SEÇÃO ANOTAÇÕES */}
      <div className="bg-[#0c0c10] border border-[#202028] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={15} className="text-[var(--op-red-bright)] shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white truncate">
            Anotações Privadas
          </h3>
          <span
            data-testid="master-notes-count"
            className="text-[10px] px-1.5 py-0.5 bg-[#14141c] border border-[#262634] text-[#9b9caa] tabular-nums shrink-0"
          >
            {summaries.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {summaries.length > 0 && (
            <div className="relative flex-1 sm:w-52">
              <Search
                size={13}
                className="text-[#6f7182] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar notas..."
                aria-label="Filtrar anotações"
                data-testid="master-notes-search"
                className="w-full min-h-[40px] bg-[#12121a] border border-[#252532] focus:border-[var(--op-red-bright)] pl-8 pr-2.5 text-xs text-white placeholder-[#6f7182] outline-none rounded-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateNote}
            disabled={isCreating}
            data-testid="master-notes-new-btn"
            className="min-h-[42px] px-3.5 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:opacity-50 text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors touch-manipulation shrink-0"
          >
            {isCreating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* ERRO DE LISTAGEM */}
      {listError && (
        <div
          role="alert"
          className="px-3.5 py-2.5 bg-red-950/45 border border-red-700/60 text-red-300 text-xs flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="shrink-0 text-red-400" />
            <span className="break-words">{listError}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadSummaries()}
            className="min-h-[34px] px-2.5 bg-[#1b0e11] hover:bg-[#2a1216] border border-red-700/60 text-[10px] uppercase tracking-wider text-red-200 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw size={12} />
            <span>Recarregar</span>
          </button>
        </div>
      )}

      {/* PAINEL DIVIDIDO: LISTA COMPACTA (ESQUERDA) + BLOCO DE NOTAS (DIREITA) */}
      <div className="bg-[#0c0c10] border border-[#202028] flex flex-col md:flex-row min-h-[440px]">
        {/* COLUNA ESQUERDA: LISTA COMPACTA DE NOTAS */}
        <div
          className={`md:w-72 lg:w-80 md:border-r border-[#202028] flex flex-col shrink-0 ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          {isLoadingList ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-12 text-xs text-[#8a8b99]">
              <Loader2 size={15} className="animate-spin text-[var(--op-red-bright)]" />
              <span>Carregando anotações...</span>
            </div>
          ) : visibleSummaries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
              <FileText size={24} className="text-[#3e3f4e] mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#9b9caa]">
                {summaries.length === 0
                  ? "Nenhuma anotação criada"
                  : "Nenhuma nota encontrada"}
              </p>
              <p className="text-[11px] font-sans text-[#6e7080] mt-1 max-w-[220px]">
                {summaries.length === 0
                  ? "Clique em + Nova Nota para registrar pistas, nomes de NPCs e lembretes da sessão."
                  : "Ajuste o filtro para localizar outra anotação."}
              </p>
            </div>
          ) : (
            <ul
              data-testid="master-notes-list"
              className="divide-y divide-[#1a1a23] overflow-y-auto max-h-[540px]"
            >
              {visibleSummaries.map((note) => {
                const isSelected = note.id === selectedId;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => void handleOpenNote(note)}
                      data-testid={`master-note-item-${note.id}`}
                      data-selected={isSelected ? "true" : "false"}
                      className={`w-full text-left px-3.5 py-3 transition-colors cursor-pointer touch-manipulation border-l-2 ${
                        isSelected
                          ? "bg-[#151218] border-l-[var(--op-red-bright)] text-white"
                          : "bg-transparent border-l-transparent hover:bg-[#12121a] text-zinc-200"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold truncate text-white">
                          {note.title}
                        </span>
                        <span className="text-[10px] text-[#757788] tabular-nums shrink-0">
                          {formatNoteTimestamp(note.updated_at)}
                        </span>
                      </div>
                      <p className="text-[11px] font-sans text-[#8a8c9e] mt-1 line-clamp-2 break-words leading-snug">
                        {note.preview || "Sem conteúdo ainda..."}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* COLUNA DIREITA: EDITOR SIMPLES ESTILO BLOCO DE NOTAS */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-[#09090d] ${
            selectedId ? "flex" : "hidden md:flex"
          }`}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-14 text-[#737586]">
              <FileText size={26} className="text-[#2f303e] mb-2.5" />
              <p className="text-xs uppercase tracking-widest font-bold text-[#9a9ca8]">
                Bloco de Notas do Mestre
              </p>
              <p className="text-[11px] font-sans text-[#6e7080] mt-1 max-w-sm">
                Selecione uma anotação à esquerda ou crie uma nova nota para
                escrever em texto simples com salvamento automático.
              </p>
            </div>
          ) : (
            <>
              {/* CABEÇALHO DO EDITOR: VOLTAR (MOBILE) + TÍTULO + STATUS + EXCLUIR */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-[#1c1c26] bg-[#0d0d13] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={handleBackToListMobile}
                    aria-label="Voltar para a lista de notas"
                    data-testid="master-notes-mobile-back"
                    className="md:hidden min-w-[38px] min-h-[38px] px-2 bg-[#14141d] border border-[#262634] text-zinc-300 hover:text-white flex items-center justify-center gap-1 text-[11px] uppercase cursor-pointer touch-manipulation shrink-0"
                  >
                    <ArrowLeft size={14} />
                    <span>Notas</span>
                  </button>

                  <input
                    ref={titleInputRef}
                    type="text"
                    maxLength={MAX_NOTE_TITLE_LENGTH}
                    value={draftTitle}
                    onChange={handleTitleChange}
                    onBlur={flushPendingSave}
                    placeholder={DEFAULT_NOTE_TITLE}
                    aria-label="Título da anotação"
                    data-testid="master-note-title-input"
                    disabled={isLoadingNote}
                    className="w-full min-w-0 bg-transparent text-sm sm:text-base font-bold text-white placeholder-[#5e6070] focus:outline-none border-b border-transparent focus:border-[var(--op-red-bright)] py-1 transition-colors"
                  />
                </div>

                {/* INDICADOR DISCRETO DE SALVAMENTO + BOTÃO EXCLUIR */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    data-testid="master-note-save-status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border ${
                      saveStatus === "saving"
                        ? "bg-amber-950/35 border-amber-600/40 text-amber-300"
                        : saveStatus === "saved"
                          ? "bg-emerald-950/30 border-emerald-700/40 text-emerald-300"
                          : saveStatus === "error"
                            ? "bg-red-950/45 border-red-700/60 text-red-300"
                            : "bg-[#12121a] border-[#22222e] text-[#7c7e90]"
                    }`}
                  >
                    {saveStatus === "saving" && (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        <span>Salvando...</span>
                      </>
                    )}
                    {saveStatus === "saved" && (
                      <>
                        <Check size={11} />
                        <span>Salvo</span>
                      </>
                    )}
                    {saveStatus === "error" && (
                      <>
                        <AlertTriangle size={11} />
                        <span>Erro ao salvar</span>
                      </>
                    )}
                    {saveStatus === "idle" && (
                      <span>{isLoadingNote ? "Abrindo..." : "Pronto"}</span>
                    )}
                  </span>

                  {saveStatus === "error" && (
                    <button
                      type="button"
                      onClick={handleRetrySave}
                      data-testid="master-note-retry-save"
                      className="min-h-[34px] px-2.5 bg-[#1b0e11] hover:bg-[#2a1216] border border-red-700/60 text-[10px] uppercase tracking-wider text-red-200 flex items-center gap-1 cursor-pointer touch-manipulation"
                    >
                      <RefreshCw size={11} />
                      <span>Tentar</span>
                    </button>
                  )}

                  {!confirmDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      aria-label="Excluir anotação"
                      title="Excluir anotação"
                      data-testid="master-note-delete-btn"
                      className="min-w-[38px] min-h-[38px] bg-[#160b0d] hover:bg-[#2a1015] border border-[#4a1820] text-red-400 hover:text-red-300 flex items-center justify-center cursor-pointer transition-colors touch-manipulation"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* CONFIRMAÇÃO DISCRETA APENAS ANTES DE EXCLUIR */}
              {confirmDelete && (
                <div
                  data-testid="master-note-delete-confirm"
                  className="px-3 sm:px-4 py-2.5 bg-[#1a0b0e] border-b border-red-800/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span className="text-red-200">
                    Excluir{" "}
                    <strong className="text-white">
                      &ldquo;{activeSummary?.title || DEFAULT_NOTE_TITLE}&rdquo;
                    </strong>
                    ? Esta ação não pode ser desfeita.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isDeleting}
                      className="min-h-[36px] px-3 bg-[#15151f] hover:bg-[#20202d] border border-[#2b2b38] text-zinc-300 text-[11px] uppercase tracking-wider cursor-pointer touch-manipulation"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmDeleteNote()}
                      disabled={isDeleting}
                      data-testid="master-note-delete-confirm-btn"
                      className="min-h-[36px] px-3 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:opacity-50 text-white border border-[#ff8085]/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation"
                    >
                      {isDeleting && <Loader2 size={12} className="animate-spin" />}
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AVISO DE ERRO DE SALVAMENTO / CARREGAMENTO */}
              {(saveErrorDetail || noteLoadError) && (
                <div
                  role="alert"
                  className="px-3 sm:px-4 py-2 bg-red-950/35 border-b border-red-800/50 text-[11px] text-red-300 flex items-center justify-between gap-2"
                >
                  <span className="break-words">
                    {noteLoadError || saveErrorDetail}
                  </span>
                  {noteLoadError && activeSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        setNoteLoadError(null);
                        void handleOpenNote(activeSummary);
                      }}
                      className="px-2 py-1 bg-[#1b0e11] border border-red-700/60 text-[10px] uppercase cursor-pointer shrink-0"
                    >
                      Recarregar
                    </button>
                  )}
                </div>
              )}

              {/* BARRA DE FORMATAÇÃO (#h1–#h6, NEGRITO, ITÁLICO) + EDITAR / VISUALIZAR */}
              <div
                data-testid="master-note-format-toolbar"
                className="px-3 sm:px-4 py-2 border-b border-[#1c1c26] bg-[#0b0b11] flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex flex-wrap items-center gap-1">
                  {MASTER_NOTE_HEADING_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      disabled={isLoadingNote}
                      data-testid={`master-note-heading-btn-${lvl}`}
                      onClick={() => handleApplyHeading(lvl)}
                      title={`Aplicar título HTML #h${lvl} na linha atual`}
                      className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#282838] hover:border-[var(--op-red)] text-[10px] font-mono font-bold text-[#d4d5e2] hover:text-white cursor-pointer touch-manipulation disabled:opacity-40"
                    >
                      #h{lvl}
                    </button>
                  ))}
                  <span
                    aria-hidden="true"
                    className="h-4 w-px bg-[#242434] mx-1 hidden xs:inline-block"
                  />
                  <button
                    type="button"
                    disabled={isLoadingNote}
                    onClick={() => handleInsertInlineSyntax("**texto**")}
                    title="Inserir negrito (**texto**)"
                    className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#282838] text-[10px] font-bold text-white cursor-pointer touch-manipulation disabled:opacity-40"
                  >
                    **B**
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingNote}
                    onClick={() => handleInsertInlineSyntax("^^texto^^")}
                    title="Inserir itálico (^^texto^^)"
                    className="min-h-[32px] px-2 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#282838] text-[10px] italic text-[#d4d5e2] cursor-pointer touch-manipulation disabled:opacity-40"
                  >
                    ^^I^^
                  </button>
                </div>

                <div
                  role="tablist"
                  aria-label="Modo de exibição da anotação"
                  className="inline-flex items-center border border-[#262636] bg-[#0f0f17] p-0.5 shrink-0"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorViewMode === "edit"}
                    data-testid="master-note-mode-edit"
                    onClick={() => setEditorViewMode("edit")}
                    className={`min-h-[30px] px-2.5 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer touch-manipulation ${
                      editorViewMode === "edit"
                        ? "bg-[#1c0b0f] text-white border border-[#8f171c]/80"
                        : "text-[#8e90a0] hover:text-white border border-transparent"
                    }`}
                  >
                    <Edit2 size={11} />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorViewMode === "preview"}
                    data-testid="master-note-mode-preview"
                    onClick={() => setEditorViewMode("preview")}
                    className={`min-h-[30px] px-2.5 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer touch-manipulation ${
                      editorViewMode === "preview"
                        ? "bg-[#1c0b0f] text-white border border-[#8f171c]/80"
                        : "text-[#8e90a0] hover:text-white border border-transparent"
                    }`}
                  >
                    <Eye size={11} />
                    <span>Visualizar</span>
                  </button>
                </div>
              </div>

              {/* CORPO DO BLOCO DE NOTAS (EDITOR / PRÉVIA FORMATADA COM #h1–#h6) */}
              {isLoadingNote ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-16 text-xs text-[#8a8b99]">
                  <Loader2
                    size={16}
                    className="animate-spin text-[var(--op-red-bright)]"
                  />
                  <span>Carregando conteúdo...</span>
                </div>
              ) : editorViewMode === "preview" ? (
                <div
                  data-testid="master-note-rendered-view"
                  className="flex-1 w-full min-h-[340px] sm:min-h-[420px] px-4 sm:px-6 py-4 overflow-y-auto space-y-2 text-sm font-mono text-zinc-200 leading-relaxed break-words"
                >
                  {parsedNoteBlocks.every((b) => b.type === "empty") ? (
                    <p className="text-xs text-[#6f7080] italic">
                      Nenhum conteúdo nesta anotação ainda. Volte para &ldquo;Editar&rdquo; e use #h1 a #h6 para estruturar títulos.
                    </p>
                  ) : (
                    parsedNoteBlocks.map((block, idx) => {
                      if (block.type === "empty") {
                        return (
                          <div
                            key={`note_empty_${idx}`}
                            className="h-2"
                            aria-hidden="true"
                          />
                        );
                      }
                      if (block.type === "divider") {
                        return (
                          <hr
                            key={`note_div_${idx}`}
                            className="my-3 border-0 border-t border-[#2d2d3d]"
                          />
                        );
                      }
                      if (block.type === "heading") {
                        const headingContent = renderRichInlineTokens(
                          block.tokens,
                          `nh_${idx}`,
                          {
                            tone: "inherit",
                            interactiveAffiliations: false,
                          },
                        );
                        const cls = HEADING_CLASS_MAP[block.level];
                        switch (block.level) {
                          case 1:
                            return (
                              <h1 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h1>
                            );
                          case 2:
                            return (
                              <h2 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h2>
                            );
                          case 3:
                            return (
                              <h3 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h3>
                            );
                          case 4:
                            return (
                              <h4 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h4>
                            );
                          case 5:
                            return (
                              <h5 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h5>
                            );
                          case 6:
                            return (
                              <h6 key={`nh_${idx}`} className={cls}>
                                {headingContent}
                              </h6>
                            );
                        }
                      }
                      return (
                        <p key={`np_${idx}`} className="m-0 leading-relaxed text-zinc-200">
                          {renderRichInlineTokens(block.tokens, `np_${idx}`, {
                            tone: "dark",
                            interactiveAffiliations: false,
                          })}
                        </p>
                      );
                    })
                  )}
                </div>
              ) : (
                <textarea
                  ref={contentTextareaRef}
                  value={draftContent}
                  onChange={handleContentChange}
                  onBlur={flushPendingSave}
                  placeholder="Escreva pistas, segredos, nomes de NPCs... Use #h1 a #h6 no início da linha para títulos (ex: #h1 Dossiê, #h2 Pistas) e **negrito** / ^^itálico^^."
                  aria-label="Conteúdo da anotação"
                  data-testid="master-note-content-textarea"
                  className="flex-1 w-full min-h-[340px] sm:min-h-[420px] bg-transparent px-3.5 sm:px-5 py-4 text-sm font-mono text-zinc-100 placeholder-[#555768] leading-relaxed resize-y focus:outline-none selection:bg-[var(--op-red)]/40"
                />
              )}

              {/* RODAPÉ MINIMALISTA DO BLOCO DE NOTAS */}
              <div className="px-3.5 sm:px-5 py-2 border-t border-[#181822] bg-[#0b0b10] flex items-center justify-between gap-2 text-[10px] text-[#6d6f80]">
                <span className="truncate">
                  Suporta #h1–#h6, **negrito**, ^^itálico^^ · Privado do Mestre
                </span>
                {activeSummary?.updated_at && (
                  <span className="tabular-nums shrink-0">
                    Atualizado {formatNoteTimestamp(activeSummary.updated_at)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
