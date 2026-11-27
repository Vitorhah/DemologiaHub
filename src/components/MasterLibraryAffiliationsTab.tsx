import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Edit2,
  Lock,
  Palette,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { RITUAL_AFFILIATION_LIST } from "../utils/rituals";
import {
  CUSTOM_AFFILIATION_PRESETS,
  CustomAffiliationDraft,
  CustomAffiliationRecord,
  MAX_CUSTOM_AFFILIATION_NAME_LENGTH,
  deriveAffiliationBorderColor,
  getHexContrastRatio,
  normalizeHexColor,
} from "../utils/customAffiliations";
import { LibraryActionResult } from "../services/useMasterLibrarySync";
import { CLINICAL_EASE } from "./MotionPrimitives";

export interface MasterLibraryAffiliationsTabProps {
  customAffiliations: CustomAffiliationRecord[];
  syncError: string | null;
  onSaveAffiliation: (
    draft: CustomAffiliationDraft
  ) => Promise<LibraryActionResult>;
  onDeleteAffiliation: (affiliationId: string) => Promise<LibraryActionResult>;
}

const DEFAULT_BG_HEX = "#5c0f16";
const DEFAULT_TEXT_HEX = "#fce7ea";

export const MasterLibraryAffiliationsTab: React.FC<
  MasterLibraryAffiliationsTabProps
> = ({
  customAffiliations,
  syncError,
  onSaveAffiliation,
  onDeleteAffiliation,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [bgInput, setBgInput] = useState(DEFAULT_BG_HEX);
  const [textInput, setTextInput] = useState(DEFAULT_TEXT_HEX);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedBg = useMemo(
    () => normalizeHexColor(bgInput) ?? DEFAULT_BG_HEX,
    [bgInput]
  );
  const resolvedText = useMemo(
    () => normalizeHexColor(textInput) ?? DEFAULT_TEXT_HEX,
    [textInput]
  );
  const resolvedBorder = useMemo(
    () => deriveAffiliationBorderColor(resolvedBg, resolvedText),
    [resolvedBg, resolvedText]
  );
  const contrastRatio = useMemo(
    () => getHexContrastRatio(resolvedBg, resolvedText),
    [resolvedBg, resolvedText]
  );

  const previewLabel = label.trim() || "Nova Afiliação";

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setBgInput(DEFAULT_BG_HEX);
    setTextInput(DEFAULT_TEXT_HEX);
  };

  const handleStartEdit = (aff: CustomAffiliationRecord) => {
    setFeedback(null);
    setConfirmDeleteId(null);
    setEditingId(aff.id);
    setLabel(aff.label);
    setBgInput(aff.background);
    setTextInput(aff.textColor);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => nameInputRef.current?.focus(), 60);
  };

  const handleSwapColors = () => {
    const nextBg = resolvedText;
    const nextText = resolvedBg;
    setBgInput(nextBg);
    setTextInput(nextText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFeedback(null);

    const validBg = normalizeHexColor(bgInput);
    const validText = normalizeHexColor(textInput);
    if (!validBg) {
      setFeedback({
        type: "error",
        text: "Cor de fundo inválida. Informe um código HEX no formato #RRGGBB.",
      });
      return;
    }
    if (!validText) {
      setFeedback({
        type: "error",
        text: "Cor de texto inválida. Informe um código HEX no formato #RRGGBB.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const wasEditing = Boolean(editingId);
      const res = await onSaveAffiliation({
        id: editingId ?? undefined,
        label,
        background: validBg,
        textColor: validText,
      });

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível salvar a afiliação.",
        });
        return;
      }

      const savedName = res.affiliation?.label || label.trim();
      resetForm();
      setFeedback({
        type: "success",
        text: wasEditing
          ? `Afiliação "${savedName}" atualizada e sincronizada com a sessão.`
          : `Afiliação "${savedName}" adicionada. Já disponível em Rituais, Criaturas e #(${savedName}).`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (aff: CustomAffiliationRecord) => {
    if (deletingId) return;
    setFeedback(null);
    setDeletingId(aff.id);
    try {
      const res = await onDeleteAffiliation(aff.id);
      setConfirmDeleteId(null);
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível remover a afiliação.",
        });
        return;
      }
      if (editingId === aff.id) {
        resetForm();
      }
      setFeedback({
        type: "info",
        text: `Afiliação "${aff.label}" removida da Biblioteca.`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="space-y-4 font-mono"
      data-testid="master-library-affiliations-tab"
    >
      {/* FEEDBACK & SYNC ERRORS */}
      <AnimatePresence initial={false}>
        {(feedback || syncError) && (
          <motion.div
            key={feedback?.text || syncError || "aff-msg"}
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

      {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="bg-[#0c0c10] border border-[#22222e] border-l-2 border-l-[var(--op-red)] p-4 space-y-4"
        data-testid="affiliation-editor-form"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1c1c26]">
          <div className="flex items-center gap-2">
            <Palette size={15} className="text-[var(--op-red-bright)] shrink-0" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                {editingId ? "Editar Afiliação Personalizada" : "Nova Afiliação"}
              </h3>
              <p className="text-[10px] text-[#838596]">
                Defina nome, cor de fundo e cor de texto. Sincronizada em tempo real para rituais, criaturas e menções #(Nome).
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[38px] px-3 bg-[#151520] hover:bg-[#1e1e2b] border border-[#2a2a38] text-[11px] text-[#c8c9d6] hover:text-white uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
            >
              <X size={13} />
              <span>Cancelar Edição</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Campos principais */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Nome */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="custom-affiliation-name"
                  className="block text-[10px] uppercase tracking-widest text-[#9a9ba8]"
                >
                  Nome da Afiliação *
                </label>
                <span className="text-[10px] text-[#6f7082] tabular-nums">
                  {label.trim().length}/{MAX_CUSTOM_AFFILIATION_NAME_LENGTH}
                </span>
              </div>
              <input
                ref={nameInputRef}
                id="custom-affiliation-name"
                type="text"
                maxLength={MAX_CUSTOM_AFFILIATION_NAME_LENGTH}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Abismo, Cinza, Relíquia, Eco..."
                data-testid="custom-affiliation-name-input"
                className="w-full min-h-[44px] bg-[#13131b] border border-[#282838] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs sm:text-sm text-white placeholder-[#5e6070] outline-none rounded-none"
              />
            </div>

            {/* Cores: Fundo e Texto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cor de Fundo */}
              <div className="bg-[#101018] border border-[#222230] p-2.5 space-y-2">
                <label
                  htmlFor="custom-affiliation-bg-hex"
                  className="block text-[10px] uppercase tracking-widest text-[#9a9ba8]"
                >
                  Cor de Fundo
                </label>
                <div className="flex items-center gap-2">
                  <label className="relative w-11 h-11 shrink-0 border border-[#343446] cursor-pointer overflow-hidden block">
                    <input
                      type="color"
                      aria-label="Selecionar cor de fundo"
                      data-testid="custom-affiliation-bg-picker"
                      value={resolvedBg}
                      onChange={(e) => setBgInput(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span
                      className="block w-full h-full"
                      style={{ backgroundColor: resolvedBg }}
                    />
                  </label>
                  <input
                    id="custom-affiliation-bg-hex"
                    type="text"
                    maxLength={7}
                    value={bgInput}
                    onChange={(e) => setBgInput(e.target.value)}
                    placeholder="#5c0f16"
                    data-testid="custom-affiliation-bg-hex"
                    className="flex-1 min-w-0 min-h-[44px] bg-[#151520] border border-[#2a2a38] focus:border-[var(--op-red-bright)] px-2.5 text-xs uppercase text-white outline-none rounded-none"
                  />
                </div>
              </div>

              {/* Cor de Texto */}
              <div className="bg-[#101018] border border-[#222230] p-2.5 space-y-2">
                <label
                  htmlFor="custom-affiliation-text-hex"
                  className="block text-[10px] uppercase tracking-widest text-[#9a9ba8]"
                >
                  Cor de Texto
                </label>
                <div className="flex items-center gap-2">
                  <label className="relative w-11 h-11 shrink-0 border border-[#343446] cursor-pointer overflow-hidden block">
                    <input
                      type="color"
                      aria-label="Selecionar cor de texto"
                      data-testid="custom-affiliation-text-picker"
                      value={resolvedText}
                      onChange={(e) => setTextInput(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span
                      className="block w-full h-full"
                      style={{ backgroundColor: resolvedText }}
                    />
                  </label>
                  <input
                    id="custom-affiliation-text-hex"
                    type="text"
                    maxLength={7}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="#fce7ea"
                    data-testid="custom-affiliation-text-hex"
                    className="flex-1 min-w-0 min-h-[44px] bg-[#151520] border border-[#2a2a38] focus:border-[var(--op-red-bright)] px-2.5 text-xs uppercase text-white outline-none rounded-none"
                  />
                </div>
              </div>
            </div>

            {/* Paletas rápidas + Inverter */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#7e8090]">
                  Combinações Rápidas
                </span>
                <button
                  type="button"
                  onClick={handleSwapColors}
                  className="min-h-[34px] px-2.5 bg-[#14141e] hover:bg-[#1c1c2a] border border-[#282838] text-[10px] text-[#c8c9d6] hover:text-white uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <ArrowLeftRight size={12} />
                  <span>Inverter Cores</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_AFFILIATION_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setBgInput(preset.background);
                      setTextInput(preset.textColor);
                    }}
                    className="min-h-[34px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-none cursor-pointer touch-manipulation transition-transform active:scale-95"
                    style={{
                      backgroundColor: preset.background,
                      color: preset.textColor,
                      borderColor: deriveAffiliationBorderColor(
                        preset.background,
                        preset.textColor
                      ),
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Painel de Prévia ao Vivo */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-[#09090d] border border-[#20202c] p-3.5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1b1b26]">
                <span className="text-[10px] uppercase tracking-widest text-[#8e90a0]">
                  Prévia em Tempo Real
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 border tabular-nums ${
                    contrastRatio >= 4.5
                      ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
                      : contrastRatio >= 3
                        ? "bg-[#151520] border-[#2d2d3d] text-[#c8c9d6]"
                        : "bg-amber-950/50 border-amber-600/60 text-amber-300"
                  }`}
                  title="Razão de contraste entre cor de texto e cor de fundo"
                >
                  Contraste {contrastRatio}:1
                </span>
              </div>

              {/* Superfície Escura (Biblioteca / Criaturas / Notas) */}
              <div className="bg-[#0e0e14] border border-[#1f1f2b] p-3 space-y-2">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#747686]">
                  Superfície Escura (Biblioteca / Criaturas)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="affiliation-live-preview-badge"
                    className="inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border rounded-none leading-none select-none"
                    style={{
                      backgroundColor: resolvedBg,
                      color: resolvedText,
                      borderColor: resolvedBorder,
                    }}
                  >
                    {previewLabel}
                  </span>
                  <span className="text-[11px] text-[#9b9caa]">
                    Menção:{" "}
                    <code className="text-white">#({previewLabel})</code>
                  </span>
                </div>
              </div>

              {/* Superfície Clara (Papel da Ficha / Rituais) */}
              <div className="bg-[#ebe6dc] border border-[#c4beb2] p-3 space-y-1.5">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#5c564c]">
                  Superfície da Ficha (Rituais / Skills)
                </div>
                <div className="text-xs text-[#27272f] leading-relaxed">
                  Ritual vinculado a{" "}
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none leading-none align-baseline mx-0.5"
                    style={{
                      backgroundColor: resolvedBg,
                      color: resolvedText,
                      borderColor: resolvedBorder,
                    }}
                  >
                    {previewLabel}
                  </span>{" "}
                  com efeito imediato.
                </div>
              </div>

              {contrastRatio < 3 && (
                <div className="px-2.5 py-1.5 bg-amber-950/35 border border-amber-700/50 text-[10px] text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                  <span>
                    Contraste baixo — considere clarear o texto ou escurecer o fundo para melhor leitura.
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || !label.trim()}
              data-testid="custom-affiliation-submit-btn"
              className="w-full min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:opacity-45 disabled:cursor-not-allowed text-white border border-[#ff8085]/40 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer transition-colors touch-manipulation"
            >
              {editingId ? <CheckCircle2 size={15} /> : <Plus size={15} />}
              <span>
                {isSaving
                  ? "Salvando..."
                  : editingId
                    ? "Salvar Alterações"
                    : "Adicionar Afiliação"}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* LISTA DE AFILIAÇÕES PERSONALIZADAS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7e8090]">
            // Afiliações Personalizadas ({customAffiliations.length})
          </div>
        </div>

        {customAffiliations.length === 0 ? (
          <div className="bg-[#0c0c10] border border-dashed border-[#262634] p-7 text-center space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#b4b5c2]">
              Nenhuma afiliação personalizada criada ainda
            </div>
            <p className="text-[11px] text-[#787989] max-w-lg mx-auto leading-relaxed">
              Crie novas afiliações acima com cor de fundo e cor de texto próprias. Elas ficarão disponíveis automaticamente em Rituais, Criaturas, Skills e na sintaxe{" "}
              <code className="text-[#d4d5e2]">#(Nome)</code> para o Mestre e jogadores.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {customAffiliations.map((aff) => {
              const isConfirming = confirmDeleteId === aff.id;
              const isEditingThis = editingId === aff.id;
              const isDeletingThis = deletingId === aff.id;

              return (
                <article
                  key={aff.id}
                  data-testid={`custom-affiliation-card-${aff.id}`}
                  className={`bg-[#0c0c10] border p-3 flex flex-col justify-between gap-3 transition-colors ${
                    isEditingThis
                      ? "border-[var(--op-red-bright)] bg-[#130b0e]"
                      : "border-[#22222e] hover:border-[#383848]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="inline-flex items-center px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider border rounded-none leading-none select-none"
                        style={{
                          backgroundColor: aff.background,
                          color: aff.textColor,
                          borderColor: aff.borderColor,
                        }}
                      >
                        {aff.label}
                      </span>
                      <span className="text-[10px] text-[#7e8090] bg-[#13131b] border border-[#222230] px-1.5 py-0.5 truncate max-w-[140px]">
                        #({aff.label})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5 bg-[#101018] border border-[#1f1f2b] px-2 py-1.5">
                        <span
                          className="w-3.5 h-3.5 border border-white/25 shrink-0"
                          style={{ backgroundColor: aff.background }}
                          aria-hidden="true"
                        />
                        <span className="text-[#7c7d8e] uppercase">Fundo</span>
                        <span className="text-[#d4d5e0] uppercase ml-auto tabular-nums">
                          {aff.background}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#101018] border border-[#1f1f2b] px-2 py-1.5">
                        <span
                          className="w-3.5 h-3.5 border border-white/25 shrink-0"
                          style={{ backgroundColor: aff.textColor }}
                          aria-hidden="true"
                        />
                        <span className="text-[#7c7d8e] uppercase">Texto</span>
                        <span className="text-[#d4d5e0] uppercase ml-auto tabular-nums">
                          {aff.textColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="pt-2 border-t border-[#1e1e28] flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-amber-300">Excluir afiliação?</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => handleConfirmDelete(aff)}
                          className="min-h-[34px] px-2.5 bg-[#7f1d1d] hover:bg-[#991b1b] disabled:opacity-50 text-white font-bold uppercase cursor-pointer touch-manipulation"
                        >
                          {isDeletingThis ? "..." : "Sim"}
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[34px] px-2.5 bg-[#16161f] border border-[#282834] text-[#b4b5c2] uppercase cursor-pointer touch-manipulation"
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[#1a1a24] flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(aff)}
                        data-testid={`edit-custom-affiliation-${aff.id}`}
                        className="min-h-[38px] px-3 bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#c8c9d6] hover:text-white text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
                      >
                        <Edit2 size={12} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(aff.id)}
                        data-testid={`delete-custom-affiliation-${aff.id}`}
                        aria-label={`Excluir afiliação ${aff.label}`}
                        className="min-w-[38px] min-h-[38px] bg-[#160b0d] hover:bg-[#2a1015] border border-[#4a1820] text-red-400 hover:text-red-300 flex items-center justify-center cursor-pointer touch-manipulation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* REFERÊNCIA DAS 9 AFILIAÇÕES OFICIAIS */}
      <div className="bg-[#0c0c10] border border-[#202028] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1c1c26]">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-[var(--op-red-bright)] shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              Afiliações Oficiais de Demologia ({RITUAL_AFFILIATION_LIST.length})
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#7e8090]">
            <Lock size={11} />
            <span>Núcleo do Sistema</span>
          </span>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
          {RITUAL_AFFILIATION_LIST.map((aff) => (
            <div
              key={aff.id}
              className="bg-[#101017] border border-[#1f1f2b] px-2.5 py-2 flex items-center justify-between gap-2"
            >
              <span
                className="inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border rounded-none leading-none select-none"
                style={{
                  background: aff.background,
                  color: aff.textColor,
                  borderColor: aff.borderColor,
                  textShadow: aff.textShadow,
                }}
              >
                {aff.label}
              </span>
              <span className="text-[10px] text-[#7c7d8e] truncate">
                #({aff.label})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
