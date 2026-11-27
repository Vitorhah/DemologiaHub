import React, { useState, useMemo, useEffect, Suspense } from "react";
import {
  FolderOpen,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Users,
  FileText,
  Image as ImageIcon,
  RotateCw,
  X,
  Cloud,
  Check,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import {
  HANDOUT_TYPE_META,
  HANDOUT_VISIBILITY_META,
  HandoutFolder,
  HandoutItem,
  HandoutType,
  HandoutVisibility,
} from "../types/handouts";
import { filterHandouts } from "../utils/handoutsLogic";
import {
  getDefaultHandoutReadingSurface,
  getHandoutAccessionCode,
  stripHandoutRichTextForPreview,
} from "../utils/handoutRichText";
import { CreatureRichInlineText } from "./CreatureRichText";
import { AnimatePresence } from "motion/react";
import {
  MotionAccordion,
  MotionModalBackdrop,
  MotionSheetPanel,
} from "./MotionPrimitives";

const LazyHandoutViewerModal = React.lazy(() =>
  import("./HandoutViewerModal").then((m) => ({ default: m.HandoutViewerModal }))
);
const LazyHandoutFormModal = React.lazy(() =>
  import("./HandoutFormModal").then((m) => ({ default: m.HandoutFormModal }))
);

interface HandoutsViewProps {
  handouts: HandoutItem[];
  folders: HandoutFolder[];
  unreadIds: Set<string>;
  syncStatus: "synced" | "syncing" | "offline";
  isMestre: boolean;
  players: { id: string; name?: string }[];
  externalOpenHandout?: HandoutItem | null;
  onClearExternalOpen?: () => void;
  onMarkAsRead: (handoutId: string) => void;
  onSaveHandout: (handout: HandoutItem) => Promise<void> | void;
  onDeleteHandout: (handoutId: string) => Promise<void> | void;
  onUpdateVisibility: (
    handoutId: string,
    visibility: HandoutVisibility,
    sharedWith?: string[]
  ) => Promise<void> | void;
  onToggleSecret: (handoutId: string) => Promise<void> | void;
  onCreateFolder: (name: string) => Promise<void> | void;
  onDeleteFolder: (folderId: string) => Promise<void> | void;
}

export const HandoutsView: React.FC<HandoutsViewProps> = ({
  handouts,
  folders,
  unreadIds,
  syncStatus,
  isMestre,
  players,
  externalOpenHandout,
  onClearExternalOpen,
  onMarkAsRead,
  onSaveHandout,
  onDeleteHandout,
  onUpdateVisibility,
  onToggleSecret,
  onCreateFolder,
  onDeleteFolder,
}) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<HandoutType | "all">("all");
  const [visFilter, setVisFilter] = useState<HandoutVisibility | "all_vis">(
    "all_vis"
  );
  const [folderFilter, setFolderFilter] = useState<string>("all_folders");

  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const [viewingHandoutId, setViewingHandoutId] = useState<string | null>(null);
  const [hasOpenedViewer, setHasOpenedViewer] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [hasOpenedForm, setHasOpenedForm] = useState(false);
  const [editingHandout, setEditingHandout] = useState<HandoutItem | null>(null);
  const [deletingHandoutId, setDeletingHandoutId] = useState<string | null>(
    null
  );
  const [indivPickerHandoutId, setIndivPickerHandoutId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (viewingHandoutId) setHasOpenedViewer(true);
  }, [viewingHandoutId]);

  useEffect(() => {
    if (formOpen) setHasOpenedForm(true);
  }, [formOpen]);

  useEffect(() => {
    if (externalOpenHandout) {
      setViewingHandoutId(externalOpenHandout.id);
      onMarkAsRead(externalOpenHandout.id);
      onClearExternalOpen?.();
    }
  }, [externalOpenHandout, onMarkAsRead, onClearExternalOpen]);

  const activeViewingHandout = useMemo(
    () => handouts.find((h) => h.id === viewingHandoutId) || null,
    [handouts, viewingHandoutId]
  );

  const filteredHandouts = useMemo(
    () =>
      filterHandouts(handouts, {
        search,
        type: typeFilter,
        visibility: isMestre ? visFilter : "all_vis",
        folderId: folderFilter,
      }),
    [handouts, search, typeFilter, visFilter, folderFilter, isMestre]
  );

  const folderNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach((f) => {
      map[f.id] = f.name;
    });
    return map;
  }, [folders]);

  const unreadCount = !isMestre ? unreadIds.size : 0;

  const handleOpenViewer = (item: HandoutItem) => {
    setViewingHandoutId(item.id);
    if (!isMestre) {
      onMarkAsRead(item.id);
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName("");
    setShowNewFolderInput(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 font-mono space-y-4">
      {/* HEADER BAR — ARQUIVO CLASSIFICADO */}
      <div className="bg-[#0a0a0e] border border-[#22222e] border-t-2 border-t-[var(--op-red)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-[#848698]">
            <span>Arquivo Classificado</span>
            <span aria-hidden="true">·</span>
            <span>
              {handouts.length}{" "}
              {handouts.length === 1 ? "registro" : "registros"}
            </span>
            {unreadCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#ff6b72] font-bold">
                  {unreadCount} {unreadCount === 1 ? "novo" : "novos"}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
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
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-[0.08em] mt-1">
            {isMestre
              ? "Cofre de Handouts"
              : "Dossiês & Handouts Compartilhados"}
          </h2>
        </div>

        {isMestre && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNewFolderInput((p) => !p)}
              className="min-h-[44px] px-3.5 bg-[#13131c] hover:bg-[#1c1c28] text-zinc-200 border border-[#2a2a38] text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderPlus size={14} />
              <span>Nova Pasta</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingHandout(null);
                setFormOpen(true);
              }}
              className="min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Novo Handout</span>
            </button>
          </div>
        )}
      </div>

      {/* NEW FOLDER INLINE CREATOR (Master) */}
      <MotionAccordion isOpen={Boolean(isMestre && showNewFolderInput)}>
        <form
          onSubmit={handleCreateFolderSubmit}
          className="bg-[#0d0d13] border border-[#242432] p-3.5 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da pasta (ex: Setor 04, Cartas Antigas)..."
            className="flex-1 min-h-[44px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 text-xs text-white outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
            >
              Criar Pasta
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderInput(false)}
              className="min-h-[44px] px-3.5 bg-[#16161f] text-zinc-300 border border-[#262632] text-xs uppercase cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </MotionAccordion>

      {/* SEARCH + FILTERS */}
      <div className="bg-[#0a0a0e] border border-[#20202b] p-3.5 space-y-3">
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
              placeholder="Pesquisar por título, conteúdo ou afiliação..."
              className="w-full min-h-[42px] bg-[#12121a] border border-[#262634] focus:border-[var(--op-red-bright)] pl-9 pr-9 py-2 text-xs text-white placeholder-[#6e7080] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] flex items-center justify-center text-[#727282] hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {isMestre && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: "all_vis", label: "Todas Visib." },
                  { id: "private", label: "Privados" },
                  { id: "all", label: "Todos" },
                  { id: "individual", label: "Individuais" },
                ] as const
              ).map((vf) => (
                <button
                  key={vf.id}
                  type="button"
                  onClick={() => setVisFilter(vf.id)}
                  className={`min-h-[42px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap shrink-0 cursor-pointer ${
                    visFilter === vf.id
                      ? "bg-[#220a0e] border-[var(--op-red-bright)] text-white font-bold"
                      : "bg-[#12121a] border-[#242432] text-[#8e90a0] hover:text-white"
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TYPE FILTER */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`min-h-[36px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap shrink-0 cursor-pointer ${
              typeFilter === "all"
                ? "bg-[#220a0e] border-[var(--op-red-bright)] text-white font-bold"
                : "bg-[#12121a] border-[#242432] text-[#8e90a0] hover:text-white"
            }`}
          >
            Todos os Tipos
          </button>
          {(Object.keys(HANDOUT_TYPE_META) as HandoutType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`min-h-[36px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === t
                  ? "bg-[#220a0e] border-[var(--op-red-bright)] text-white font-bold"
                  : "bg-[#12121a] border-[#242432] text-[#8e90a0] hover:text-white"
              }`}
            >
              {HANDOUT_TYPE_META[t].shortLabel}
            </button>
          ))}
        </div>

        {/* FOLDER STRIP */}
        {folders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 border-t border-[#181822]">
            <button
              type="button"
              onClick={() => setFolderFilter("all_folders")}
              className={`min-h-[36px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap shrink-0 cursor-pointer ${
                folderFilter === "all_folders"
                  ? "bg-[#1b1b26] border-zinc-400 text-white font-bold"
                  : "bg-[#121218] border-[#22222c] text-[#8e90a0] hover:text-white"
              }`}
            >
              Todas Pastas
            </button>
            <button
              type="button"
              onClick={() => setFolderFilter("unfiled")}
              className={`min-h-[36px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap shrink-0 cursor-pointer ${
                folderFilter === "unfiled"
                  ? "bg-[#1b1b26] border-zinc-400 text-white font-bold"
                  : "bg-[#121218] border-[#22222c] text-[#8e90a0] hover:text-white"
              }`}
            >
              Sem Pasta
            </button>
            {folders.map((fld) => (
              <div key={fld.id} className="inline-flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setFolderFilter(fld.id)}
                  className={`min-h-[36px] px-3 text-[11px] uppercase tracking-wider border whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    folderFilter === fld.id
                      ? "bg-[#1b1b26] border-zinc-400 text-white font-bold"
                      : "bg-[#121218] border-[#22222c] text-[#8e90a0] hover:text-white"
                  }`}
                >
                  <FolderOpen size={12} />
                  <span>{fld.name}</span>
                </button>
                {isMestre && (
                  <button
                    type="button"
                    onClick={() => {
                      if (folderFilter === fld.id) setFolderFilter("all_folders");
                      onDeleteFolder(fld.id);
                    }}
                    title={`Excluir pasta ${fld.name}`}
                    aria-label={`Excluir pasta ${fld.name}`}
                    className="min-h-[36px] px-2 bg-[#121218] hover:bg-red-950/50 text-[#727282] hover:text-red-400 border border-l-0 border-[#22222c] cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GRID OF IMMERSIVE DOSSIER CARDS */}
      {filteredHandouts.length === 0 ? (
        <div className="bg-[#0a0a0e] border border-[#20202b] py-16 px-6 text-center space-y-3">
          <FolderOpen size={34} className="mx-auto text-[#626475] opacity-70" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {handouts.length === 0
              ? isMestre
                ? "Nenhum Handout no Cofre"
                : "Nenhum Handout Disponível"
              : "Nenhum Handout Corresponde aos Filtros"}
          </h3>
          <p className="text-xs text-[#828392] max-w-md mx-auto leading-relaxed font-sans">
            {isMestre
              ? "Crie relatórios, cartas com verso, fotografias e anexos secretos com formatação rica (#h1, negrito, itálico e afiliações) para distribuir em tempo real."
              : "Quando o Mestre compartilhar documentos, pistas ou fotografias com você ou com o grupo, eles aparecerão aqui instantaneamente."}
          </p>
          {isMestre && (
            <button
              type="button"
              onClick={() => {
                setEditingHandout(null);
                setFormOpen(true);
              }}
              className="min-h-[44px] px-5 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider border border-[#ff8085]/40 cursor-pointer"
            >
              + Criar Primeiro Handout
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHandouts.map((item) => {
            const typeMeta =
              HANDOUT_TYPE_META[item.type] || HANDOUT_TYPE_META.documento;
            const visMeta =
              HANDOUT_VISIBILITY_META[item.visibility] ||
              HANDOUT_VISIBILITY_META.private;
            const accessionCode = getHandoutAccessionCode(item);
            const isPaperDoc =
              getDefaultHandoutReadingSurface(item.type) === "paper";
            const isUnread = !isMestre && unreadIds.has(item.id);
            const hasSecret = Boolean(
              (item.secretText && item.secretText.trim()) ||
                (item.secretImageUrl && item.secretImageUrl.trim())
            );
            const showIndivPicker = indivPickerHandoutId === item.id;
            const contentPreview = stripHandoutRichTextForPreview(
              item.content,
              190
            );
            const descriptionPreview = stripHandoutRichTextForPreview(
              item.description,
              120
            );

            return (
              <article
                key={item.id}
                data-testid={`handout-card-${item.id}`}
                className={`bg-[#0b0b10] border flex flex-col justify-between transition-colors ${
                  isUnread
                    ? "border-[var(--op-red-bright)] shadow-[0_0_24px_rgba(143,23,28,0.22)]"
                    : "border-[#20202b] hover:border-[#343446]"
                }`}
              >
                {/* CLICKABLE DOSSIER PREVIEW */}
                <button
                  type="button"
                  onClick={() => handleOpenViewer(item)}
                  className="text-left flex-1 flex flex-col cursor-pointer group"
                >
                  {/* ARCHIVAL ACCESSION HEADER STRIP */}
                  <div className="px-4 py-2.5 bg-[#0f0f16] border-b border-[#1b1b26] flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[#8a8c9e] font-bold">
                        {accessionCode}
                      </span>
                      <span className="text-[#4a4c5c]" aria-hidden="true">
                        ·
                      </span>
                      <span className={`font-bold truncate ${typeMeta.accentClass}`}>
                        {typeMeta.shortLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[#8e90a0]">
                      {item.hasBackSide && (
                        <span
                          className="inline-flex items-center gap-1 text-amber-300"
                          title="Possui costas do papel / verso"
                        >
                          <RotateCw size={10} />
                          <span>Verso</span>
                        </span>
                      )}
                      {hasSecret && (isMestre || item.secretRevealed) && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            item.secretRevealed
                              ? "text-emerald-300"
                              : "text-[#ff8085]"
                          }`}
                          title={
                            item.secretRevealed
                              ? "Anexo secreto revelado"
                              : "Anexo secreto oculto"
                          }
                        >
                          <ShieldAlert size={10} />
                        </span>
                      )}
                      {isUnread && (
                        <span className="font-bold text-[#ff6b72]">NOVO</span>
                      )}
                    </div>
                  </div>

                  {/* CARD BODY */}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-[15px] font-bold text-white uppercase tracking-[0.06em] group-hover:text-[#ff8a90] transition-colors leading-snug line-clamp-2">
                        <CreatureRichInlineText
                          text={item.title}
                          tone="dark"
                          interactiveAffiliations={false}
                        />
                      </h3>

                      {item.folderId && folderNameMap[item.folderId] && (
                        <div className="text-[10px] text-[#7c7e90] flex items-center gap-1">
                          <FolderOpen size={11} className="shrink-0" />
                          <span className="truncate">
                            {folderNameMap[item.folderId]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ARTIFACT VISUAL PREVIEW */}
                    {item.imageUrl ? (
                      <div className="bg-[#050508] border border-[#1d1d28] p-1.5 space-y-1.5">
                        <div className="h-36 w-full overflow-hidden bg-black flex items-center justify-center">
                          <img
                            src={item.imageUrl}
                            alt={stripHandoutRichTextForPreview(item.title, 80)}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-[#7a7c8e] px-0.5">
                          <span>Anexo Fotográfico</span>
                          {contentPreview && <span>+ Transcrição</span>}
                        </div>
                      </div>
                    ) : contentPreview && isPaperDoc ? (
                      <div
                        className="p-3 border border-[#c6ba9f]/70 shadow-[inset_0_0_18px_rgba(68,52,32,0.12)] space-y-1.5"
                        style={{
                          background:
                            "linear-gradient(180deg, #f1eadb 0%, #e4dac6 100%)",
                          fontFamily: "Georgia, 'Times New Roman', serif",
                        }}
                      >
                        <div className="h-[1px] w-10 bg-[#8f171c]/80" />
                        <p className="text-[12px] text-[#28221c] leading-relaxed line-clamp-4 m-0">
                          {contentPreview}
                        </p>
                      </div>
                    ) : contentPreview ? (
                      <div className="p-3 bg-[#08080c] border border-[#1d1d29]">
                        <p className="text-xs text-[#b4b6c6] font-sans line-clamp-4 leading-relaxed m-0">
                          {contentPreview}
                        </p>
                      </div>
                    ) : descriptionPreview ? (
                      <p className="text-xs text-[#8d8f9f] font-sans line-clamp-3 leading-relaxed m-0">
                        {descriptionPreview}
                      </p>
                    ) : (
                      <div className="py-5 px-3 bg-[#08080c] border border-dashed border-[#20202e] text-[11px] text-[#6d6f80] italic flex items-center justify-center gap-1.5">
                        {item.type === "imagem" ? (
                          <ImageIcon size={13} />
                        ) : (
                          <FileText size={13} />
                        )}
                        <span>Abrir dossiê para inspecionar</span>
                      </div>
                    )}

                    {/* FOOTER META LINE */}
                    <div className="mt-auto pt-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-[#76788a]">
                      <span>
                        {!isMestre && item.secretRevealed && hasSecret ? (
                          <span className="text-emerald-300 font-bold">
                            Anexo Secreto Liberado
                          </span>
                        ) : (
                          descriptionPreview && item.content ? (
                            <span className="line-clamp-1 normal-case tracking-normal text-[#808294] font-sans text-[11px]">
                              {descriptionPreview}
                            </span>
                          ) : (
                            "Inspecionar Dossiê"
                          )
                        )}
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="text-[#6d6f82] group-hover:text-[#ff8a90] transition-colors shrink-0"
                      />
                    </div>
                  </div>
                </button>

                {/* MASTER QUICK CONTROLS */}
                {isMestre && (
                  <div className="px-3.5 py-3 bg-[#09090d] border-t border-[#191924] space-y-2">
                    {/* Quick Visibility Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIndivPickerHandoutId(null);
                          onUpdateVisibility(item.id, "private");
                        }}
                        className={`flex-1 min-h-[36px] px-1.5 text-[10px] uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                          item.visibility === "private"
                            ? `${visMeta.bgClass} ${visMeta.borderClass} text-white font-bold`
                            : "bg-[#121218] border-[#22222c] text-[#787989] hover:text-white"
                        }`}
                        title="Somente Mestre"
                      >
                        <Lock size={10} />
                        <span>Privado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIndivPickerHandoutId(null);
                          onUpdateVisibility(item.id, "all");
                        }}
                        className={`flex-1 min-h-[36px] px-1.5 text-[10px] uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                          item.visibility === "all"
                            ? "bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-bold"
                            : "bg-[#121218] border-[#22222c] text-[#787989] hover:text-white"
                        }`}
                        title="Compartilhar com todos os jogadores"
                      >
                        <Globe size={10} />
                        <span>Todos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setIndivPickerHandoutId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className={`flex-1 min-h-[36px] px-1.5 text-[10px] uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                          item.visibility === "individual"
                            ? "bg-amber-950/50 border-amber-500/60 text-amber-200 font-bold"
                            : "bg-[#121218] border-[#22222c] text-[#787989] hover:text-white"
                        }`}
                        title="Selecionar jogadores específicos"
                      >
                        <Users size={10} />
                        <span>
                          Indiv
                          {item.visibility === "individual" &&
                          item.sharedWith.length > 0
                            ? ` (${item.sharedWith.length})`
                            : ""}
                        </span>
                      </button>
                    </div>

                    {/* Inline Individual Player Selector */}
                    {showIndivPicker && (
                      <div className="p-2.5 bg-[#12121a] border border-amber-500/35 space-y-1.5">
                        <div className="text-[10px] uppercase text-amber-300 font-bold">
                          Jogadores com Acesso:
                        </div>
                        {players.length === 0 ? (
                          <div className="text-[10px] text-[#787989]">
                            Nenhum jogador conectado.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {players.map((p) => {
                              const active = item.sharedWith.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    const next = active
                                      ? item.sharedWith.filter(
                                          (id) => id !== p.id
                                        )
                                      : [...item.sharedWith, p.id];
                                    onUpdateVisibility(
                                      item.id,
                                      next.length > 0 ? "individual" : "private",
                                      next
                                    );
                                  }}
                                  className={`min-h-[32px] px-2.5 py-1 text-[10px] border flex items-center gap-1 cursor-pointer ${
                                    active
                                      ? "bg-amber-950/70 border-amber-400 text-white font-bold"
                                      : "bg-[#0c0c10] border-[#262632] text-[#8e90a0]"
                                  }`}
                                >
                                  {active && <Check size={10} />}
                                  <span>{p.name || p.id.slice(0, 6)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Secret Toggle + Edit + Delete Row */}
                    <div className="flex items-center gap-1.5">
                      {hasSecret && (
                        <button
                          type="button"
                          onClick={() => onToggleSecret(item.id)}
                          className={`flex-1 min-h-[38px] px-2 text-[10px] uppercase font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                            item.secretRevealed
                              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                              : "bg-[#1c1014] hover:bg-[#2a1218] border-[#691419] text-[#ff8085]"
                          }`}
                        >
                          {item.secretRevealed ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                          <span>
                            {item.secretRevealed
                              ? "Ocultar Segredo"
                              : "Revelar Segredo"}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingHandout(item);
                          setFormOpen(true);
                        }}
                        className={`${
                          hasSecret ? "min-w-[38px]" : "flex-1"
                        } min-h-[38px] px-2.5 bg-[#14141c] hover:bg-[#1e1e28] text-zinc-200 border border-[#262632] text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer`}
                        title="Editar handout"
                      >
                        <Edit2 size={12} />
                        {!hasSecret && <span>Editar</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingHandoutId(item.id)}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#14141c] hover:bg-red-950/50 text-[#828392] hover:text-red-400 border border-[#262632] hover:border-red-800/60 cursor-pointer"
                        title="Excluir handout"
                        aria-label={`Excluir handout ${stripHandoutRichTextForPreview(item.title, 60)}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* VIEWER MODAL */}
      {(activeViewingHandout || hasOpenedViewer) && (
        <Suspense fallback={null}>
          <LazyHandoutViewerModal
            handout={activeViewingHandout}
            isMestre={isMestre}
            folderName={
              activeViewingHandout?.folderId
                ? folderNameMap[activeViewingHandout.folderId] || null
                : null
            }
            onClose={() => setViewingHandoutId(null)}
            onToggleRevealSecret={isMestre ? onToggleSecret : undefined}
            onEdit={
              isMestre
                ? (h) => {
                    setEditingHandout(h);
                    setFormOpen(true);
                  }
                : undefined
            }
          />
        </Suspense>
      )}

      {/* FORM MODAL */}
      {isMestre && (formOpen || hasOpenedForm) && (
        <Suspense fallback={null}>
          <LazyHandoutFormModal
            isOpen={formOpen}
            editingHandout={editingHandout}
            folders={folders}
            players={players}
            onClose={() => {
              setFormOpen(false);
              setEditingHandout(null);
            }}
            onSave={onSaveHandout}
          />
        </Suspense>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingHandoutId && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[340] flex items-center justify-center p-4"
            onClick={() => setDeletingHandoutId(null)}
          >
            <MotionSheetPanel
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0c0c10] border border-[#2b2b36] p-5 space-y-4 font-mono shadow-[0_24px_60px_rgba(0,0,0,0.9)]"
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Excluir Handout?
              </h3>
              <p className="text-xs text-[#9ca3af] font-sans">
                Esta ação removerá o handout do cofre e também dos jogadores com
                quem foi compartilhado.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingHandoutId(null)}
                  className="flex-1 min-h-[44px] bg-[#16161f] text-zinc-200 border border-[#2c2c38] text-xs uppercase cursor-pointer active:scale-95 transition-transform"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = deletingHandoutId;
                    setDeletingHandoutId(null);
                    await onDeleteHandout(target);
                  }}
                  className="flex-1 min-h-[44px] bg-[#b52a30] hover:bg-[#d30000] text-white text-xs font-bold uppercase cursor-pointer active:scale-95 transition-transform"
                >
                  Excluir
                </button>
              </div>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>
    </div>
  );
};
