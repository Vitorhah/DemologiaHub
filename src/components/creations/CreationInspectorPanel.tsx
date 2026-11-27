import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  Trash2,
  Underline,
} from "lucide-react";
import type {
  CreationDocument,
  CreationElement,
  CreationFontFamily,
  CreationLineOrientation,
  CreationLineStyle,
} from "../../types/masterCreations";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  CREATION_ELEMENT_META,
  CREATION_FONT_OPTIONS,
  CREATION_PAGE_PRESETS,
  createCreationId,
  normalizeHexOrTransparent,
} from "../../utils/masterCreations";
import { CreatureRichTextQuickBar } from "../CreatureRichText";

export interface CreationInspectorPanelProps {
  document: CreationDocument;
  selectedElement: CreationElement | null;
  isUploadingImage: boolean;
  onUpdateDocument: (
    patch: Partial<Pick<CreationDocument, "title" | "pageBackground" | "pageBorderColor">>,
  ) => void;
  onUpdateElement: (id: string, patch: Partial<CreationElement>) => void;
  onUploadElementImage: (elementId: string, file: File) => void;
}

const ColorField: React.FC<{
  label: string;
  value: string;
  allowTransparent?: boolean;
  testId?: string;
  onChange: (nextColor: string) => void;
}> = ({ label, value, allowTransparent = false, testId, onChange }) => {
  const isTransparent = value === "transparent";
  const pickerHex = isTransparent
    ? "#12121a"
    : normalizeHexOrTransparent(value, "#12121a");
  const [draft, setDraft] = useState(isTransparent ? "transparent" : value);

  useEffect(() => {
    setDraft(value === "transparent" ? "transparent" : value);
  }, [value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
          {label}
        </span>
        {allowTransparent && (
          <button
            type="button"
            onClick={() =>
              onChange(isTransparent ? "#12121a" : "transparent")
            }
            className={`text-[10px] uppercase px-1.5 py-0.5 border cursor-pointer touch-manipulation ${
              isTransparent
                ? "border-[#8f171c] text-[#ff888d] bg-[#1b0b0e]"
                : "border-[#252533] text-[#8a8c9c] hover:text-white"
            }`}
          >
            {isTransparent ? "Sem fundo" : "Transparente"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={pickerHex === "transparent" ? "#12121a" : pickerHex}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Seletor de cor ${label}`}
          className="w-8 h-8 bg-[#0b0b10] border border-[#2a2a38] p-0.5 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const v = raw.trim();
            if (v === "transparent" && allowTransparent) {
              onChange("transparent");
            } else if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              onChange(v.toLowerCase());
            }
          }}
          onBlur={() => {
            const v = draft.trim();
            if (v === "transparent" && allowTransparent) {
              onChange("transparent");
              setDraft("transparent");
            } else {
              const norm = normalizeHexOrTransparent(v, pickerHex);
              onChange(norm);
              setDraft(norm);
            }
          }}
          placeholder="#ececef"
          data-testid={testId}
          aria-label={`Código HEX ${label}`}
          className="flex-1 min-w-0 bg-[#0b0b10] border border-[#262634] px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#8f171c]"
        />
      </div>
    </div>
  );
};

export const CreationInspectorPanel: React.FC<CreationInspectorPanelProps> = ({
  document,
  selectedElement,
  isUploadingImage,
  onUpdateDocument,
  onUpdateElement,
  onUploadElementImage,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  if (!selectedElement) {
    return (
      <div
        data-testid="creation-page-inspector"
        className="space-y-4 font-mono text-xs"
      >
        <div className="border-b border-[#1f1f2b] pb-2">
          <div className="text-[10px] uppercase tracking-widest text-[var(--op-red-bright)] font-bold">
            Página A4
          </div>
          <p className="text-[11px] text-[#7c7e90] mt-0.5">
            Proporção padrão {A4_WIDTH_PX}×{A4_HEIGHT_PX}px (210×297mm).
            Clique em um elemento para editá-lo.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
            Folhas Rápidas
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {CREATION_PAGE_PRESETS.map((preset) => {
              const active =
                document.pageBackground.toLowerCase() ===
                preset.bg.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`creation-page-preset-${preset.id}`}
                  onClick={() =>
                    onUpdateDocument({
                      pageBackground: preset.bg,
                      pageBorderColor: preset.border,
                    })
                  }
                  className={`flex items-center gap-2.5 px-2.5 py-2 border text-left transition-colors cursor-pointer touch-manipulation ${
                    active
                      ? "bg-[#1a0b0e] border-[#8f171c] text-white"
                      : "bg-[#0d0d13] border-[#222230] text-[#b8bac8] hover:border-[#353548]"
                  }`}
                >
                  <span
                    className="w-4 h-4 border border-white/20 shrink-0"
                    style={{ backgroundColor: preset.bg }}
                  />
                  <span className="truncate text-[11px]">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ColorField
          label="Fundo da Página (HEX)"
          value={document.pageBackground}
          testId="creation-page-bg-input"
          onChange={(next) => onUpdateDocument({ pageBackground: next })}
        />

        <ColorField
          label="Borda da Página (HEX)"
          value={document.pageBorderColor}
          allowTransparent
          testId="creation-page-border-input"
          onChange={(next) => onUpdateDocument({ pageBorderColor: next })}
        />

        <div className="border-t border-[#1e1e29] pt-3 text-[11px] text-[#7a7c8d] space-y-1">
          <div>
            Camadas na página:{" "}
            <strong className="text-zinc-200">{document.elements.length}</strong>
          </div>
          <div>Dica: arraste um arquivo PNG direto para cima da folha A4.</div>
        </div>
      </div>
    );
  }

  const el = selectedElement;
  const patch = (partial: Partial<CreationElement>) =>
    onUpdateElement(el.id, partial);

  const hasTextFormatting =
    el.type === "text" ||
    el.type === "profile" ||
    el.type === "description" ||
    el.type === "info" ||
    el.type === "divider";

  const hasRichTextArea =
    el.type === "text" || el.type === "description" || el.type === "profile";

  const hasImageSlot = el.type === "image" || el.type === "profile";
  const isLineOrDivider = el.type === "line" || el.type === "divider";

  return (
    <div
      data-testid="creation-element-inspector"
      className="space-y-4 font-mono text-xs"
    >
      {/* Cabeçalho do elemento selecionado */}
      <div className="border-b border-[#1f1f2b] pb-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[var(--op-red-bright)] font-bold">
            {CREATION_ELEMENT_META[el.type].label}
          </span>
          {el.locked && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 bg-amber-950/50 border border-amber-600/50 text-amber-300">
              Bloqueado
            </span>
          )}
        </div>
        <input
          type="text"
          value={el.name}
          onChange={(e) => patch({ name: e.target.value })}
          aria-label="Nome da camada"
          data-testid="creation-inspector-name"
          className="w-full bg-[#0b0b10] border border-[#262634] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8f171c]"
          placeholder="Nome da camada"
        />
      </div>

      {/* Conteúdo específico do bloco */}
      {(el.type === "profile" ||
        el.type === "description" ||
        el.type === "info" ||
        el.type === "divider") && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
              {el.type === "divider" ? "Rótulo da Divisória" : "Título"}
            </span>
            <input
              type="text"
              value={el.title}
              onChange={(e) => patch({ title: e.target.value })}
              data-testid="creation-inspector-title"
              className="w-full bg-[#0b0b10] border border-[#262634] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8f171c]"
              placeholder={
                el.type === "divider"
                  ? "Opcional (ex: REGISTRO 01)"
                  : "Título do bloco"
              }
            />
          </label>

          {el.type === "profile" && (
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                Subtítulo / Classificação
              </span>
              <input
                type="text"
                value={el.subtitle}
                onChange={(e) => patch({ subtitle: e.target.value })}
                data-testid="creation-inspector-subtitle"
                className="w-full bg-[#0b0b10] border border-[#262634] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8f171c]"
                placeholder="Cargo, codinome ou registro"
              />
            </label>
          )}
        </div>
      )}

      {/* Editor de texto com barra de formatação rica reutilizada */}
      {hasRichTextArea && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[#8e90a0] block">
            {el.type === "profile" ? "Resumo" : "Conteúdo"}
          </span>
          <CreatureRichTextQuickBar
            textareaRef={textAreaRef}
            value={el.textContent}
            onChange={(next) => patch({ textContent: next })}
            compact
            showDivider={el.type !== "profile"}
          />
          <textarea
            ref={textAreaRef}
            rows={el.type === "profile" ? 3 : 4}
            value={el.textContent}
            onChange={(e) => patch({ textContent: e.target.value })}
            data-testid="creation-inspector-text"
            aria-label="Texto do elemento"
            className="w-full bg-[#0b0b10] border border-[#262634] px-2.5 py-2 text-xs text-zinc-100 leading-relaxed resize-y focus:outline-none focus:border-[#8f171c]"
            placeholder="Digite o conteúdo do bloco..."
          />
        </div>
      )}

      {/* Campos estruturados para bloco Informações */}
      {el.type === "info" && (
        <div className="space-y-2 border-t border-[#1e1e29] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
              Campos ({el.fields.length})
            </span>
            <button
              type="button"
              data-testid="creation-info-add-field"
              onClick={() =>
                patch({
                  fields: [
                    ...el.fields,
                    {
                      id: createCreationId("fld"),
                      label: "CAMPO",
                      value: "Valor",
                    },
                  ],
                })
              }
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase bg-[#1a0b0e] border border-[#8f171c]/70 text-white hover:bg-[#2a1015] cursor-pointer touch-manipulation"
            >
              <Plus size={11} />
              <span>Campo</span>
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {el.fields.map((field, idx) => (
              <div
                key={field.id}
                className="flex items-center gap-1 bg-[#0b0b10] border border-[#232332] p-1"
              >
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => {
                    const next = el.fields.map((f, i) =>
                      i === idx ? { ...f, label: e.target.value } : f,
                    );
                    patch({ fields: next });
                  }}
                  placeholder="Rótulo"
                  aria-label={`Rótulo do campo ${idx + 1}`}
                  className="w-[42%] bg-transparent px-1.5 py-1 text-[11px] text-zinc-300 border-r border-[#232332] focus:outline-none"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => {
                    const next = el.fields.map((f, i) =>
                      i === idx ? { ...f, value: e.target.value } : f,
                    );
                    patch({ fields: next });
                  }}
                  placeholder="Valor"
                  aria-label={`Valor do campo ${idx + 1}`}
                  className="flex-1 min-w-0 bg-transparent px-1.5 py-1 text-[11px] text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      fields: el.fields.filter((_, i) => i !== idx),
                    })
                  }
                  aria-label={`Remover campo ${idx + 1}`}
                  className="p-1 text-red-400 hover:bg-red-950/50 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Importação e opções de imagem (Imagem / Retrato de Perfil) */}
      {hasImageSlot && (
        <div className="space-y-2 border-t border-[#1e1e29] pt-3">
          <span className="text-[10px] uppercase tracking-wider text-[#8e90a0] block">
            {el.type === "profile" ? "Retrato (PNG/JPG)" : "Arquivo de Imagem"}
          </span>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            data-testid="creation-inspector-image-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadElementImage(el.id, file);
              }
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => imageInputRef.current?.click()}
              data-testid="creation-inspector-upload-btn"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[36px] px-2.5 bg-[#190a0d] hover:bg-[#271015] border border-[#8f171c]/70 text-white text-[11px] uppercase tracking-wider cursor-pointer disabled:opacity-50 touch-manipulation"
            >
              {isUploadingImage ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ImagePlus size={13} />
              )}
              <span>{el.imageUrl ? "Trocar PNG" : "Importar PNG"}</span>
            </button>
            {el.imageUrl && (
              <button
                type="button"
                onClick={() => patch({ imageUrl: "", imageAspectRatio: null })}
                aria-label="Remover imagem"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#121218] border border-[#2a2a38] text-red-400 hover:bg-red-950/40 cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {el.type === "image" && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => patch({ lockAspectRatio: !el.lockAspectRatio })}
                data-testid="creation-inspector-lock-ratio"
                className={`inline-flex items-center justify-center gap-1 min-h-[34px] px-2 border text-[10px] uppercase cursor-pointer touch-manipulation ${
                  el.lockAspectRatio
                    ? "bg-[#1a0b0e] border-[#8f171c] text-white"
                    : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0]"
                }`}
              >
                {el.lockAspectRatio ? (
                  <Link2 size={12} />
                ) : (
                  <Link2Off size={12} />
                )}
                <span>Proporção</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  patch({
                    objectFit: el.objectFit === "contain" ? "cover" : "contain",
                  })
                }
                className="min-h-[34px] px-2 bg-[#0d0d13] border border-[#252534] text-[10px] uppercase text-[#c4c6d4] hover:border-[#3c3c52] cursor-pointer touch-manipulation"
              >
                Ajuste: {el.objectFit === "contain" ? "Inteira" : "Preencher"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controles específicos de Linha / Separador */}
      {isLineOrDivider && (
        <div className="space-y-2.5 border-t border-[#1e1e29] pt-3">
          {el.type === "line" && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                Orientação
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(["horizontal", "vertical"] as CreationLineOrientation[]).map(
                  (orient) => (
                    <button
                      key={orient}
                      type="button"
                      onClick={() => {
                        if (orient === el.lineOrientation) return;
                        patch({
                          lineOrientation: orient,
                          width: el.height,
                          height: el.width,
                        });
                      }}
                      className={`min-h-[34px] text-[10px] uppercase border cursor-pointer touch-manipulation ${
                        el.lineOrientation === orient
                          ? "bg-[#1a0b0e] border-[#8f171c] text-white"
                          : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0]"
                      }`}
                    >
                      {orient === "horizontal" ? "Horizontal" : "Vertical"}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">
                Espessura ({el.strokeWidth}px)
              </span>
              <input
                type="range"
                min={1}
                max={12}
                value={el.strokeWidth}
                onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
                className="w-full accent-[#b91c1c]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">Estilo</span>
              <select
                value={el.lineStyle}
                onChange={(e) =>
                  patch({ lineStyle: e.target.value as CreationLineStyle })
                }
                className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1 text-[11px] text-white"
              >
                <option value="solid">Sólida</option>
                <option value="dashed">Tracejada</option>
                <option value="dotted">Pontilhada</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Tipografia individual */}
      {hasTextFormatting && (
        <div className="space-y-2.5 border-t border-[#1e1e29] pt-3">
          <div className="text-[10px] uppercase tracking-widest text-[#9c9eb0] font-bold">
            Tipografia
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">Fonte</span>
              <select
                value={el.fontFamily}
                onChange={(e) =>
                  patch({ fontFamily: e.target.value as CreationFontFamily })
                }
                data-testid="creation-inspector-font-family"
                className="w-full bg-[#0b0b10] border border-[#262634] px-1.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#8f171c]"
              >
                {CREATION_FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">
                Tamanho (px)
              </span>
              <input
                type="number"
                min={8}
                max={96}
                value={el.fontSize}
                onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                data-testid="creation-inspector-font-size"
                className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#8f171c]"
              />
            </label>
          </div>

          {/* Negrito / Itálico / Sublinhado + Alinhamento */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  patch({
                    fontWeight: el.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
                data-testid="creation-inspector-bold"
                aria-label="Negrito"
                title="Negrito"
                className={`min-w-[34px] min-h-[34px] flex items-center justify-center border cursor-pointer touch-manipulation ${
                  el.fontWeight === "bold"
                    ? "bg-[#1c0b0e] border-[#8f171c] text-white"
                    : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0] hover:text-white"
                }`}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                onClick={() =>
                  patch({
                    fontStyle: el.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
                data-testid="creation-inspector-italic"
                aria-label="Itálico"
                title="Itálico"
                className={`min-w-[34px] min-h-[34px] flex items-center justify-center border cursor-pointer touch-manipulation ${
                  el.fontStyle === "italic"
                    ? "bg-[#1c0b0e] border-[#8f171c] text-white"
                    : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0] hover:text-white"
                }`}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                onClick={() =>
                  patch({
                    textDecoration:
                      el.textDecoration === "underline" ? "none" : "underline",
                  })
                }
                data-testid="creation-inspector-underline"
                aria-label="Sublinhado"
                title="Sublinhado"
                className={`min-w-[34px] min-h-[34px] flex items-center justify-center border cursor-pointer touch-manipulation ${
                  el.textDecoration === "underline"
                    ? "bg-[#1c0b0e] border-[#8f171c] text-white"
                    : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0] hover:text-white"
                }`}
              >
                <Underline size={13} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: "left", icon: AlignLeft, label: "Esquerda" },
                  { id: "center", icon: AlignCenter, label: "Centralizado" },
                  { id: "right", icon: AlignRight, label: "Direita" },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ textAlign: id })}
                  data-testid={`creation-inspector-align-${id}`}
                  aria-label={`Alinhar ${label}`}
                  title={`Alinhar ${label}`}
                  className={`min-w-[34px] min-h-[34px] flex items-center justify-center border cursor-pointer touch-manipulation ${
                    el.textAlign === id
                      ? "bg-[#1c0b0e] border-[#8f171c] text-white"
                      : "bg-[#0d0d13] border-[#252534] text-[#8d8fa0] hover:text-white"
                  }`}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">
                Entrelinha ({el.lineHeight.toFixed(2)})
              </span>
              <input
                type="range"
                min={1}
                max={2.4}
                step={0.05}
                value={el.lineHeight}
                onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
                className="w-full accent-[#b91c1c]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] uppercase text-[#8e90a0]">
                Espaçamento ({el.letterSpacing}px)
              </span>
              <input
                type="range"
                min={-1}
                max={8}
                step={0.5}
                value={el.letterSpacing}
                onChange={(e) =>
                  patch({ letterSpacing: Number(e.target.value) })
                }
                className="w-full accent-[#b91c1c]"
              />
            </label>
          </div>
        </div>
      )}

      {/* Cores individuais + Opacidade */}
      <div className="space-y-2.5 border-t border-[#1e1e29] pt-3">
        <div className="text-[10px] uppercase tracking-widest text-[#9c9eb0] font-bold">
          Cores & Aparência
        </div>

        {hasTextFormatting && (
          <ColorField
            label="Cor do Texto"
            value={el.textColor}
            testId="creation-inspector-text-color"
            onChange={(next) => patch({ textColor: next })}
          />
        )}

        {isLineOrDivider && (
          <ColorField
            label="Cor da Linha"
            value={el.strokeColor}
            testId="creation-inspector-stroke-color"
            onChange={(next) => patch({ strokeColor: next })}
          />
        )}

        {(el.type === "profile" ||
          el.type === "description" ||
          el.type === "info") && (
          <ColorField
            label="Cor de Destaque"
            value={el.accentColor}
            testId="creation-inspector-accent-color"
            onChange={(next) => patch({ accentColor: next })}
          />
        )}

        {!isLineOrDivider && (
          <>
            <ColorField
              label="Cor de Fundo"
              value={el.backgroundColor}
              allowTransparent
              testId="creation-inspector-bg-color"
              onChange={(next) => patch({ backgroundColor: next })}
            />

            <ColorField
              label="Cor da Borda"
              value={el.borderColor}
              testId="creation-inspector-border-color"
              onChange={(next) => patch({ borderColor: next })}
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] uppercase text-[#8e90a0]">
                  Borda ({el.borderWidth}px)
                </span>
                <input
                  type="range"
                  min={0}
                  max={8}
                  value={el.borderWidth}
                  onChange={(e) =>
                    patch({ borderWidth: Number(e.target.value) })
                  }
                  className="w-full accent-[#b91c1c]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] uppercase text-[#8e90a0]">
                  Margem ({el.padding}px)
                </span>
                <input
                  type="range"
                  min={0}
                  max={36}
                  value={el.padding}
                  onChange={(e) => patch({ padding: Number(e.target.value) })}
                  className="w-full accent-[#b91c1c]"
                />
              </label>
            </div>
          </>
        )}

        <label className="block space-y-1">
          <span className="text-[10px] uppercase text-[#8e90a0]">
            Opacidade ({Math.round(el.opacity * 100)}%)
          </span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={el.opacity}
            data-testid="creation-inspector-opacity"
            onChange={(e) => patch({ opacity: Number(e.target.value) })}
            className="w-full accent-[#b91c1c]"
          />
        </label>
      </div>

      {/* Posição e Dimensão */}
      <div className="space-y-2 border-t border-[#1e1e29] pt-3">
        <div className="text-[10px] uppercase tracking-widest text-[#9c9eb0] font-bold">
          Posição & Tamanho (px)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-[10px] text-[#7c7e90]">X</span>
            <input
              type="number"
              data-testid="creation-inspector-x"
              value={Math.round(el.x)}
              onChange={(e) => patch({ x: Number(e.target.value) })}
              className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-[#7c7e90]">Y</span>
            <input
              type="number"
              data-testid="creation-inspector-y"
              value={Math.round(el.y)}
              onChange={(e) => patch({ y: Number(e.target.value) })}
              className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-[#7c7e90]">Largura</span>
            <input
              type="number"
              min={24}
              data-testid="creation-inspector-w"
              value={Math.round(el.width)}
              onChange={(e) => patch({ width: Number(e.target.value) })}
              className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-[#7c7e90]">Altura</span>
            <input
              type="number"
              min={12}
              data-testid="creation-inspector-h"
              value={Math.round(el.height)}
              onChange={(e) => patch({ height: Number(e.target.value) })}
              className="w-full bg-[#0b0b10] border border-[#262634] px-2 py-1 text-xs text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
