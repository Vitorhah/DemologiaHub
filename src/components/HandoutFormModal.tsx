import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  HANDOUT_TYPE_META,
  HandoutFolder,
  HandoutItem,
  HandoutType,
  HandoutVisibility,
} from "../types/handouts";
import { compressImageFileToDataUrl } from "../utils/handoutsLogic";
import { AnimatePresence } from "motion/react";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

interface HandoutFormModalProps {
  isOpen: boolean;
  editingHandout: HandoutItem | null;
  folders: HandoutFolder[];
  players: { id: string; name?: string }[];
  onClose: () => void;
  onSave: (handout: HandoutItem) => Promise<void> | void;
}

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

  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
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
      setSharedWith(Array.isArray(editingHandout.sharedWith) ? editingHandout.sharedWith : []);
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
            className="w-full sm:max-w-3xl max-h-[92dvh] bg-[#0c0c10] border-t sm:border border-[#262632] shadow-[0_24px_60px_rgba(0,0,0,0.92)] flex flex-col relative overflow-hidden font-mono"
          >
        <div className="h-[2px] w-full bg-[var(--op-red-bright)] shrink-0" />

        <div className="px-4 sm:px-6 py-3.5 bg-[#101016] border-b border-[#1e1e28] flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
            {editingHandout ? "Editar Handout" : "Novo Handout"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#16161f] hover:bg-[#222230] text-[#9ca3af] hover:text-white border border-[#262632] cursor-pointer"
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

          {/* Título e Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Título do Handout *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Relatório Autópsia Sala 04, Carta Rasgada..."
                className="w-full min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Tipo de Material
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HandoutType)}
                className="w-full min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
              >
                {(Object.keys(HANDOUT_TYPE_META) as HandoutType[]).map((t) => (
                  <option key={t} value={t}>
                    {HANDOUT_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Pasta (Opcional)
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full min-h-[42px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
              >
                <option value="">Sem pasta (Raiz)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Descrição Curta (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contexto breve ou local onde foi encontrado..."
                className="w-full min-h-[40px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* FRENTE */}
          <div className="bg-[#101016] border border-[#20202a] p-3.5 sm:p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white border-b border-[#1c1c26] pb-2">
              Frente do Handout
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Texto / Conteúdo
              </label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Texto do documento, transcrição, anotações..."
                className="w-full bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] p-3 text-xs text-white font-sans outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af]">
                Imagem (URL ou Upload Local via Canvas)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... ou envie um arquivo ao lado"
                  className="flex-1 min-h-[40px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
                />
                <label className="min-h-[40px] px-3 bg-[#181824] hover:bg-[#242434] text-zinc-200 border border-[#2c2c3c] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                  <Upload size={14} />
                  <span>{uploadBusy === "front" ? "Comprimindo..." : "Enviar Imagem"}</span>
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
                    className="min-h-[40px] px-2.5 bg-[#1a1014] text-red-300 border border-red-900/50 text-xs cursor-pointer"
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
                  className="max-h-36 object-contain border border-[#242430] bg-black/50 p-1"
                />
              )}
            </div>
          </div>

          {/* COSTAS DO PAPEL / VERSO */}
          <div className="bg-[#101016] border border-[#20202a] p-3.5 sm:p-4 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <RotateCw size={14} className="text-amber-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Habilitar Costas do Papel / Verso
                </span>
              </div>
              <input
                type="checkbox"
                checked={hasBackSide}
                onChange={(e) => setHasBackSide(e.target.checked)}
                className="w-4 h-4 accent-[#d30000] cursor-pointer"
              />
            </label>

            {hasBackSide && (
              <div className="space-y-3 pt-2 border-t border-[#1c1c26]">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                    Texto no Verso
                  </label>
                  <textarea
                    rows={3}
                    value={backText}
                    onChange={(e) => setBackText(e.target.value)}
                    placeholder="Escrita oculta atrás da foto ou verso da folha..."
                    className="w-full bg-[#13131b] border border-[#262634] focus:border-amber-500 p-3 text-xs text-white font-sans outline-none"
                  />
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
                      className="flex-1 min-h-[40px] bg-[#13131b] border border-[#262634] focus:border-amber-500 px-3 py-2 text-xs text-white outline-none"
                    />
                    <label className="min-h-[40px] px-3 bg-[#181824] hover:bg-[#242434] text-zinc-200 border border-[#2c2c3c] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                      <Upload size={14} />
                      <span>{uploadBusy === "back" ? "Comprimindo..." : "Enviar Verso"}</span>
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
                        className="min-h-[40px] px-2.5 bg-[#1a1014] text-red-300 border border-red-900/50 text-xs cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEGREDO REVELÁVEL */}
          <div className="bg-[#120d11] border border-[#3a161c] p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ff8085]">
                Segredo Oculto (Revelável em Tempo Real)
              </span>
              <button
                type="button"
                onClick={() => setSecretRevealed((p) => !p)}
                className={`min-h-[32px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer ${
                  secretRevealed
                    ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-300"
                    : "bg-[#1a1418] border-amber-500/40 text-amber-300"
                }`}
              >
                {secretRevealed ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>{secretRevealed ? "Já Revelado" : "Oculto por Padrão"}</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9ca3af] mb-1">
                Texto Secreto (Fica protegido fora do banco público enquanto oculto)
              </label>
              <textarea
                rows={2}
                value={secretText}
                onChange={(e) => setSecretText(e.target.value)}
                placeholder="Pista oculta, tradução de ritual ou revelação..."
                className="w-full bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] p-3 text-xs text-white font-sans outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={secretImageUrl}
                onChange={(e) => setSecretImageUrl(e.target.value)}
                placeholder="URL de imagem secreta (opcional)"
                className="flex-1 min-h-[40px] bg-[#13131b] border border-[#262634] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none"
              />
              <label className="min-h-[40px] px-3 bg-[#181824] hover:bg-[#242434] text-zinc-200 border border-[#2c2c3c] text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                <Upload size={14} />
                <span>{uploadBusy === "secret" ? "Comprimindo..." : "Imagem Secreta"}</span>
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
                  className="min-h-[40px] px-2.5 bg-[#1a1014] text-red-300 border border-red-900/50 text-xs cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* VISIBILIDADE E COMPARTILHAMENTO */}
          <div className="bg-[#101016] border border-[#20202a] p-3.5 sm:p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white">
              Visibilidade na Mesa
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`min-h-[42px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibility === "private"
                    ? "bg-[#22222c] border-zinc-400 text-white font-bold"
                    : "bg-[#13131b] border-[#242430] text-[#8e90a0]"
                }`}
              >
                <Lock size={13} />
                <span>Privado (Mestre)</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("all")}
                className={`min-h-[42px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibility === "all"
                    ? "bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold"
                    : "bg-[#13131b] border-[#242430] text-[#8e90a0]"
                }`}
              >
                <Globe size={13} />
                <span>Todos os Jogadores</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("individual")}
                className={`min-h-[42px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibility === "individual"
                    ? "bg-amber-950/50 border-amber-500 text-amber-200 font-bold"
                    : "bg-[#13131b] border-[#242430] text-[#8e90a0]"
                }`}
              >
                <Users size={13} />
                <span>Individual</span>
              </button>
            </div>

            {visibility === "individual" && (
              <div className="pt-2 border-t border-[#1c1c26] space-y-2">
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
                          className={`min-h-[38px] px-3 py-1.5 border text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
                            checked
                              ? "bg-amber-950/60 border-amber-400 text-white font-bold"
                              : "bg-[#13131b] border-[#242430] text-[#9ca3af]"
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
              {saving ? "Salvando..." : editingHandout ? "Salvar Alterações" : "Criar Handout"}
            </button>
          </div>
        </form>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
