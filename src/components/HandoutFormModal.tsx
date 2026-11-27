import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Eye,
  EyeOff,
  RotateCw,
  Lock,
  Globe,
  Users,
  Check,
  FileText,
  ShieldAlert,
} from "lucide-react";
import {
  HANDOUT_TYPE_META,
  HandoutFolder,
  HandoutItem,
  HandoutType,
  HandoutVisibility,
} from "../types/handouts";
import { compressImageFileToDataUrl } from "../utils/handoutsLogic";
import {
  getDefaultHandoutReadingSurface,
  getHandoutAccessionCode,
} from "../utils/handoutRichText";
import { AnimatePresence } from "motion/react";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";
import {
  CreatureRichInlineText,
  CreatureRichTextQuickBar,
} from "./CreatureRichText";
import {
  HandoutRichContent,
  HandoutRichTextToolbar,
} from "./HandoutRichContent";

interface HandoutFormModalProps {
  isOpen: boolean;
  editingHandout: HandoutItem | null;
  folders: HandoutFolder[];
  players: { id: string; name?: string }[];
  onClose: () => void;
  onSave: (handout: HandoutItem) => Promise<void> | void;
}

const HAS_INLINE_SYNTAX_RE = /\*\*|\^\^|#\(/;

export const HandoutFormModal: React.FC<HandoutFormModalProps> = ({
  isOpen,
  editingHandout,
  folders,
  players,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<HandoutType>("documento");
  const [folderId, setFolderId] = useState<string>("");

  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [hasBackSide, setHasBackSide] = useState(false);
  const [backText, setBackText] = useState("");
  const [backImageUrl, setBackImageUrl] = useState("");

  const [secretText, setSecretText] = useState("");
  const [secretImageUrl, setSecretImageUrl] = useState("");
  const [secretRevealed, setSecretRevealed] = useState(false);

  const [visibility, setVisibility] = useState<HandoutVisibility>("private");
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  const [previewFront, setPreviewFront] = useState(false);
  const [previewBack, setPreviewBack] = useState(false);
  const [previewSecret, setPreviewSecret] = useState(false);

  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const frontTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const secretTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPreviewFront(false);
    setPreviewBack(false);
    setPreviewSecret(false);

    if (editingHandout) {
      setTitle(editingHandout.title || "");
      setDescription(editingHandout.description || "");
      setType(editingHandout.type || "documento");
      setFolderId(editingHandout.folderId || "");
      setContent(editingHandout.content || "");
      setImageUrl(editingHandout.imageUrl || "");
      setHasBackSide(Boolean(editingHandout.hasBackSide));
      setBackText(editingHandout.backText || "");
      setBackImageUrl(editingHandout.backImageUrl || "");
      setSecretText(editingHandout.secretText || "");
      setSecretImageUrl(editingHandout.secretImageUrl || "");
      setSecretRevealed(Boolean(editingHandout.secretRevealed));
      setVisibility(editingHandout.visibility || "private");
      setSharedWith(
        Array.isArray(editingHandout.sharedWith) ? editingHandout.sharedWith : []
      );
    } else {
      setTitle("");
      setDescription("");
      setType("documento");
      setFolderId("");
      setContent("");
      setImageUrl("");
      setHasBackSide(false);
      setBackText("");
      setBackImageUrl("");
      setSecretText("");
      setSecretImageUrl("");
      setSecretRevealed(false);
      setVisibility("private");
      setSharedWith([]);
    }
  }, [isOpen, editingHandout]);

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "front" | "back" | "secret"
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMsg(null);
    setUploadBusy(target);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (target === "front") setImageUrl(dataUrl);
      else if (target === "back") setBackImageUrl(dataUrl);
      else setSecretImageUrl(dataUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao processar imagem.");
    } finally {
      setUploadBusy(null);
    }
  };

  const togglePlayerShare = (pid: string) => {
    setSharedWith((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg("Informe o título do Handout.");
      return;
    }
    if (visibility === "individual" && sharedWith.length === 0) {
      setErrorMsg("Selecione ao menos um jogador para visibilidade Individual.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const now = Date.now();
      const item: HandoutItem = {
        id:
          editingHandout?.id ||
          `ho_${now}_${Math.random().toString(36).slice(2, 7)}`,
        title: cleanTitle,
        description: description.trim(),
        type,
        folderId: folderId || null,
        content,
        imageUrl: imageUrl.trim(),
        hasBackSide,
        backText: hasBackSide ? backText : "",
        backImageUrl: hasBackSide ? backImageUrl.trim() : "",
        secretText,
        secretImageUrl: secretImageUrl.trim(),
        secretRevealed,
        visibility,
        sharedWith: visibility === "individual" ? sharedWith : [],
        createdAt: editingHandout?.createdAt || now,
        updatedAt: now,
      };
      await onSave(item);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Não foi possível salvar o Handout.");
    } finally {
      setSaving(false);
    }
  };

  const defaultSurface = getDefaultHandoutReadingSurface(type);
  const isPaperPreview = defaultSurface === "paper";
  const accessionPreview = editingHandout
    ? getHandoutAccessionCode({ id: editingHandout.id, type })
    : `${HANDOUT_TYPE_META[type].shortLabel.toUpperCase()} · NOVO`;

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-label={editingHandout ? "Editar Handout" : "Criar Novo Handout"}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-4xl max-h-[94dvh] bg-[#0a0a0e] border-t sm:border border-[#262634] shadow-[0_28px_72px_rgba(0,0,0,0.95)] flex flex-col relative overflow-hidden font-mono"
          >
            <div className="h-[2px] w-full bg-[var(--op-red-bright)] shrink-0" />

            {/* HEADER */}
            <div className="px-4 sm:px-6 py-3.5 bg-[#0e0e14] border-b border-[#1f1f2a] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#848698]">
                  <span>Registro {accessionPreview}</span>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span>Formatação Rica Ativa</span>
                </div>
                <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white mt-0.5">
                  {editingHandout ? "Editar Dossiê / Handout" : "Novo Dossiê / Handout"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar formulário"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#15151f] hover:bg-[#222230] text-[#9ca3af] hover:text-white border border-[#262634] cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
              style={{
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
              }}
            >
              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 bg-red-950/50 border border-red-600/70 text-red-200 text-xs"
                >
                  {errorMsg}
                </div>
              )}

              {/* IDENTIFICAÇÃO E CLASSIFICAÇÃO */}
              <div className="bg-[#0e0e14] border border-[#20202c] p-3.5 sm:p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#1c1c28] pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <FileText size={13} className="text-[var(--op-red-bright)]" />
                    <span>Identificação do Arquivo</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#787a8c]">
                    Suporta #h1–#h6 · **negrito** · ^^itálico^^ · #(Afiliação)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                      Título do Handout *
                    </label>
                    <CreatureRichTextQuickBar
                      compact
                      showDivider={false}
                      label="Título"
                      onInsertSnippet={(snippet) =>
                        setTitle((prev) =>
                          prev ? `${prev} ${snippet}` : snippet
                        )
                      }
                    />
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Relatório Autópsia Sala 04, Carta de #(Oculto)..."
                      className="w-full min-h-[44px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                      required
                    />
                    {HAS_INLINE_SYNTAX_RE.test(title) && (
                      <div className="px-3 py-1.5 bg-[#09090d] border border-[#1d1d28] text-xs text-white">
                        <span className="text-[9px] uppercase tracking-widest text-[#7c7e90] mr-2">
                          Prévia:
                        </span>
                        <CreatureRichInlineText
                          text={title}
                          tone="dark"
                          interactiveAffiliations={false}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                      Tipo de Material
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as HandoutType)}
                      className="w-full min-h-[44px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                    >
                      {(Object.keys(HANDOUT_TYPE_META) as HandoutType[]).map((t) => (
                        <option key={t} value={t}>
                          {HANDOUT_TYPE_META[t].label}
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-[#7c7e90] mt-1">
                      Superfície padrão na leitura:{" "}
                      <span className="text-[#c8cad6]">
                        {isPaperPreview ? "Papel Arquivístico" : "Terminal Clínico"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                      Pasta (Opcional)
                    </label>
                    <select
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full min-h-[44px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="">Sem pasta (Raiz)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                      Descrição Curta / Local de Origem (Opcional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Contexto breve ou local onde o documento foi encontrado..."
                      className="w-full min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                    />
                    {HAS_INLINE_SYNTAX_RE.test(description) && (
                      <div className="px-3 py-1.5 bg-[#09090d] border border-[#1d1d28] text-xs text-[#c8cad8]">
                        <span className="text-[9px] uppercase tracking-widest text-[#7c7e90] mr-2">
                          Prévia:
                        </span>
                        <CreatureRichInlineText
                          text={description}
                          tone="dark"
                          interactiveAffiliations={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* FRENTE DO HANDOUT */}
              <div className="bg-[#0e0e14] border border-[#20202c] p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#1c1c28] pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Frente do Handout
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#787a8c]">
                    Face Principal
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                    Texto / Conteúdo
                  </label>
                  <HandoutRichTextToolbar
                    value={content}
                    onChange={setContent}
                    textareaRef={frontTextareaRef}
                    showPreview={previewFront}
                    onTogglePreview={() => setPreviewFront((p) => !p)}
                  />

                  {previewFront ? (
                    <div
                      className={`p-4 sm:p-5 border min-h-[140px] ${
                        isPaperPreview
                          ? "border-[#c4b89f] shadow-[inset_0_0_24px_rgba(68,52,32,0.1)]"
                          : "bg-[#09090e] border-[#262636]"
                      }`}
                      style={
                        isPaperPreview
                          ? {
                              background:
                                "linear-gradient(180deg, #f3ecde 0%, #eae0cd 55%, #e1d5be 100%)",
                              fontFamily: "Georgia, 'Times New Roman', serif",
                            }
                          : undefined
                      }
                      data-testid="handout-form-front-preview"
                    >
                      <HandoutRichContent
                        text={content}
                        surface={defaultSurface}
                        emptyText="Sem texto registrado na frente."
                        interactiveAffiliations={false}
                      />
                    </div>
                  ) : (
                    <textarea
                      ref={frontTextareaRef}
                      rows={6}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={"#h1 Título do Relatório\n\nTexto do documento com **negrito**, ^^itálico^^ e #(Afiliação).\n---"}
                      className="w-full bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] p-3 text-xs sm:text-[13px] leading-relaxed text-white font-sans outline-none resize-y"
                    />
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                    Imagem (URL ou Upload Local via Canvas)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://... ou envie um arquivo ao lado"
                      className="flex-1 min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                    />
                    <label className="min-h-[42px] px-3.5 bg-[#161622] hover:bg-[#222232] text-zinc-200 border border-[#2c2c3c] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                      <Upload size={14} />
                      <span>
                        {uploadBusy === "front" ? "Comprimindo..." : "Enviar Imagem"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, "front")}
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="min-h-[42px] px-3 bg-[#1a1014] hover:bg-[#28121a] text-red-300 border border-red-900/50 text-xs uppercase cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Pré-visualização frente"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="max-h-40 object-contain border border-[#242430] bg-black/60 p-1.5"
                    />
                  )}
                </div>
              </div>

              {/* COSTAS DO PAPEL / VERSO */}
              <div className="bg-[#0e0e14] border border-[#20202c] p-3.5 sm:p-4 space-y-3">
                <label className="flex items-center justify-between gap-3 min-h-[40px] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <RotateCw size={14} className="text-amber-300 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Habilitar Costas do Papel / Verso
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasBackSide}
                    onChange={(e) => setHasBackSide(e.target.checked)}
                    className="w-5 h-5 accent-[#b52a30] cursor-pointer"
                  />
                </label>

                {hasBackSide && (
                  <div className="space-y-3 pt-2.5 border-t border-[#1c1c28]">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                        Texto no Verso
                      </label>
                      <HandoutRichTextToolbar
                        value={backText}
                        onChange={setBackText}
                        textareaRef={backTextareaRef}
                        showPreview={previewBack}
                        onTogglePreview={() => setPreviewBack((p) => !p)}
                      />

                      {previewBack ? (
                        <div
                          className={`p-4 sm:p-5 border min-h-[110px] ${
                            isPaperPreview
                              ? "border-[#c4b89f] shadow-[inset_0_0_24px_rgba(68,52,32,0.1)]"
                              : "bg-[#09090e] border-[#262636]"
                          }`}
                          style={
                            isPaperPreview
                              ? {
                                  background:
                                    "linear-gradient(180deg, #f3ecde 0%, #eae0cd 55%, #e1d5be 100%)",
                                  fontFamily: "Georgia, 'Times New Roman', serif",
                                }
                              : undefined
                          }
                          data-testid="handout-form-back-preview"
                        >
                          <HandoutRichContent
                            text={backText}
                            surface={defaultSurface}
                            emptyText="Sem texto registrado no verso."
                            interactiveAffiliations={false}
                          />
                        </div>
                      ) : (
                        <textarea
                          ref={backTextareaRef}
                          rows={4}
                          value={backText}
                          onChange={(e) => setBackText(e.target.value)}
                          placeholder="Escrita oculta atrás da foto, anotações rabiscadas no verso..."
                          className="w-full bg-[#13131b] border border-[#262634] focus:border-amber-500 p-3 text-xs sm:text-[13px] leading-relaxed text-white font-sans outline-none resize-y"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                        Imagem no Verso (URL ou Upload)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={backImageUrl}
                          onChange={(e) => setBackImageUrl(e.target.value)}
                          placeholder="https://... ou envie arquivo"
                          className="flex-1 min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-amber-500 px-3 py-2 text-xs text-white outline-none"
                        />
                        <label className="min-h-[42px] px-3.5 bg-[#161622] hover:bg-[#222232] text-zinc-200 border border-[#2c2c3c] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                          <Upload size={14} />
                          <span>
                            {uploadBusy === "back" ? "Comprimindo..." : "Enviar Verso"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageFileChange(e, "back")}
                          />
                        </label>
                        {backImageUrl && (
                          <button
                            type="button"
                            onClick={() => setBackImageUrl("")}
                            className="min-h-[42px] px-3 bg-[#1a1014] hover:bg-[#28121a] text-red-300 border border-red-900/50 text-xs uppercase cursor-pointer"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      {backImageUrl && (
                        <img
                          src={backImageUrl}
                          alt="Pré-visualização verso"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="max-h-36 object-contain border border-[#242430] bg-black/60 p-1.5"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SEGREDO REVELÁVEL */}
              <div className="bg-[#110a0d] border border-[#3d171f] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#ff8a90] flex items-center gap-1.5">
                    <ShieldAlert size={13} />
                    <span>Anexo Restrito · Segredo Oculto</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSecretRevealed((p) => !p)}
                    className={`min-h-[38px] px-3 py-1 text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer ${
                      secretRevealed
                        ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                        : "bg-[#1a1216] border-amber-500/40 text-amber-300"
                    }`}
                  >
                    {secretRevealed ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>{secretRevealed ? "Já Revelado" : "Oculto por Padrão"}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider text-[#a2a4b4]">
                    Texto Secreto (Protegido fora do banco público enquanto oculto)
                  </label>
                  <HandoutRichTextToolbar
                    value={secretText}
                    onChange={setSecretText}
                    textareaRef={secretTextareaRef}
                    showPreview={previewSecret}
                    onTogglePreview={() => setPreviewSecret((p) => !p)}
                  />

                  {previewSecret ? (
                    <div
                      className="p-4 bg-[#0b0709] border border-[#4a1a22] min-h-[96px]"
                      data-testid="handout-form-secret-preview"
                    >
                      <HandoutRichContent
                        text={secretText}
                        surface="dark"
                        emptyText="Sem texto secreto registrado."
                        interactiveAffiliations={false}
                      />
                    </div>
                  ) : (
                    <textarea
                      ref={secretTextareaRef}
                      rows={3}
                      value={secretText}
                      onChange={(e) => setSecretText(e.target.value)}
                      placeholder="Pista oculta, tradução de ritual ou revelação..."
                      className="w-full bg-[#13131b] border border-[#2e1c22] focus:border-[var(--op-red-bright)] p-3 text-xs sm:text-[13px] leading-relaxed text-white font-sans outline-none resize-y"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={secretImageUrl}
                      onChange={(e) => setSecretImageUrl(e.target.value)}
                      placeholder="URL de imagem secreta (opcional)"
                      className="flex-1 min-h-[42px] bg-[#13131b] border border-[#2e1c22] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                    />
                    <label className="min-h-[42px] px-3.5 bg-[#18141c] hover:bg-[#241b28] text-zinc-200 border border-[#3a2430] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                      <Upload size={14} />
                      <span>
                        {uploadBusy === "secret" ? "Comprimindo..." : "Imagem Secreta"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, "secret")}
                      />
                    </label>
                    {secretImageUrl && (
                      <button
                        type="button"
                        onClick={() => setSecretImageUrl("")}
                        className="min-h-[42px] px-3 bg-[#1a1014] text-red-300 border border-red-900/50 text-xs uppercase cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  {secretImageUrl && (
                    <img
                      src={secretImageUrl}
                      alt="Pré-visualização segredo"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="max-h-36 object-contain border border-[#3a1c24] bg-black/60 p-1.5"
                    />
                  )}
                </div>
              </div>

              {/* VISIBILIDADE E COMPARTILHAMENTO */}
              <div className="bg-[#0e0e14] border border-[#20202c] p-3.5 sm:p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-white">
                  Visibilidade na Mesa
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`min-h-[44px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                      visibility === "private"
                        ? "bg-[#22222c] border-zinc-400 text-white font-bold"
                        : "bg-[#13131b] border-[#242430] text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    <Lock size={13} />
                    <span>Privado (Mestre)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("all")}
                    className={`min-h-[44px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                      visibility === "all"
                        ? "bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold"
                        : "bg-[#13131b] border-[#242430] text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    <Globe size={13} />
                    <span>Todos os Jogadores</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("individual")}
                    className={`min-h-[44px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                      visibility === "individual"
                        ? "bg-amber-950/50 border-amber-500 text-amber-200 font-bold"
                        : "bg-[#13131b] border-[#242430] text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    <Users size={13} />
                    <span>Individual</span>
                  </button>
                </div>

                {visibility === "individual" && (
                  <div className="pt-2.5 border-t border-[#1c1c28] space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-amber-300">
                      Selecionar Jogadores Autorizados:
                    </div>
                    {players.length === 0 ? (
                      <p className="text-xs text-[#787989]">
                        Nenhum jogador conectado no momento. Conecte jogadores para selecioná-los individualmente.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {players.map((p) => {
                          const checked = sharedWith.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePlayerShare(p.id)}
                              className={`min-h-[40px] px-3 py-1.5 border text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                                checked
                                  ? "bg-amber-950/60 border-amber-400 text-white font-bold"
                                  : "bg-[#13131b] border-[#242430] text-[#9ca3af] hover:text-white"
                              }`}
                            >
                              {checked && <Check size={13} className="text-amber-300" />}
                              <span>{p.name || p.id.slice(0, 8)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1e1e28]">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 bg-[#16161f] hover:bg-[#222230] text-zinc-300 border border-[#2c2c38] text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || Boolean(uploadBusy)}
                  className="min-h-[44px] px-6 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:opacity-50 text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {saving
                    ? "Salvando..."
                    : editingHandout
                      ? "Salvar Alterações"
                      : "Criar Handout"}
                </button>
              </div>
            </form>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
