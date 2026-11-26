import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Palette,
  RotateCcw,
  Save,
  Upload,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Loader2,
  X,
  Eye,
  EyeOff,
  Undo2,
  Cloud,
  CloudOff,
  Wallpaper,
} from "lucide-react";
import type {
  TabletopAnimationIntensity,
  TabletopBrandImageSlot,
  TabletopColorsConfig,
  TabletopCornerRadius,
  TabletopCustomizationConfig,
  TabletopInterfaceDensity,
  TabletopShadowIntensity,
  TabletopThemePresetId,
} from "../types/tabletopCustomization";
import {
  DEFAULT_HEADER_TITLE,
  DEMOLOGIA_ORIGINAL_BACKGROUND,
  TABLETOP_THEME_PRESETS,
  applyPresetToConfig,
  areTabletopCustomizationsEqual,
  detectCustomBackgroundMediaType,
  detectMatchingPresetId,
  isDefaultTabletopCustomization,
  isValidHexInput,
  normalizeHexColor,
  sanitizeCustomImageUrl,
} from "../utils/tabletopCustomization";
import { uploadCustomBrandImage } from "../services/tabletopCustomizationUpload";
import { uploadSceneBackgroundMedia } from "../services/sceneBackgroundUpload";
import type { TabletopThemeActionResult } from "../services/useTabletopThemeSync";
import { DEMOLOGIA_LOGO_URL } from "../constants/branding";
import { TabletopThemePreview } from "./TabletopThemePreview";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

export interface MasterCustomizationViewProps {
  roomId: string;
  activeConfig: TabletopCustomizationConfig;
  syncStatus: "synced" | "syncing" | "offline";
  syncError: string | null;
  isSaving: boolean;
  onSaveCustomization: (
    next: TabletopCustomizationConfig,
  ) => Promise<TabletopThemeActionResult>;
  onResetCustomization: () => Promise<TabletopThemeActionResult>;
}

interface ColorFieldMeta {
  key: keyof TabletopColorsConfig;
  label: string;
  hint: string;
}

const COLOR_FIELDS: readonly ColorFieldMeta[] = [
  { key: "primary", label: "Cor principal", hint: "Abas ativas, selos e estrutura" },
  { key: "secondary", label: "Cor secundária", hint: "Sombras de destaque e apoio" },
  { key: "accent", label: "Cor de destaque", hint: "Indicadores, foco e realces" },
  { key: "background", label: "Fundo geral", hint: "Plano de fundo da plataforma" },
  { key: "panel", label: "Cor dos painéis", hint: "Cartões, seções e gavetas" },
  { key: "textPrimary", label: "Textos principais", hint: "Títulos e leitura principal" },
  { key: "textSecondary", label: "Textos secundários", hint: "Rótulos e descrições" },
  { key: "border", label: "Cor das bordas", hint: "Contornos e divisórias" },
  { key: "interactive", label: "Botões e interativos", hint: "Ações principais e controles" },
];

interface ImageSlotMeta {
  slot: TabletopBrandImageSlot;
  label: string;
  description: string;
  fallbackPreview?: string;
}

const IMAGE_SLOTS: readonly ImageSlotMeta[] = [
  {
    slot: "primaryLogoUrl",
    label: "Logo Principal",
    description: "Exibida na barra lateral e no cabeçalho principal da mesa.",
    fallbackPreview: DEMOLOGIA_LOGO_URL,
  },
  {
    slot: "secondaryLogoUrl",
    label: "Logo Secundária",
    description: "Exibida como emblema principal na ficha e selos internos.",
    fallbackPreview: DEMOLOGIA_LOGO_URL,
  },
  {
    slot: "campaignIconUrl",
    label: "Ícone da Campanha",
    description: "Selo compacto exibido ao lado do título e como ícone da aba.",
  },
];

export const MasterCustomizationView: React.FC<MasterCustomizationViewProps> = ({
  roomId,
  activeConfig,
  syncStatus,
  syncError,
  isSaving,
  onSaveCustomization,
  onResetCustomization,
}) => {
  const [draft, setDraft] = useState<TabletopCustomizationConfig>(activeConfig);
  const [hexDrafts, setHexDrafts] = useState<Record<keyof TabletopColorsConfig, string>>(
    () => ({ ...activeConfig.colors }),
  );
  const [urlInputs, setUrlInputs] = useState<Record<TabletopBrandImageSlot, string>>(() => ({
    primaryLogoUrl: activeConfig.branding.primaryLogoUrl,
    secondaryLogoUrl: activeConfig.branding.secondaryLogoUrl,
    campaignIconUrl: activeConfig.branding.campaignIconUrl,
  }));
  const [bgUrlInput, setBgUrlInput] = useState<string>(
    () => activeConfig.background?.url || "",
  );
  const [uploadingSlot, setUploadingSlot] = useState<TabletopBrandImageSlot | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const lastSyncedUpdatedAtRef = useRef<number>(activeConfig.updatedAt);

  // Sincroniza rascunho quando a configuração ativa da sala mudar externamente (ex: outro dispositivo ou após salvar/resetar)
  useEffect(() => {
    if (activeConfig.updatedAt !== lastSyncedUpdatedAtRef.current) {
      lastSyncedUpdatedAtRef.current = activeConfig.updatedAt;
      setDraft(activeConfig);
      setHexDrafts({ ...activeConfig.colors });
      setUrlInputs({
        primaryLogoUrl: activeConfig.branding.primaryLogoUrl,
        secondaryLogoUrl: activeConfig.branding.secondaryLogoUrl,
        campaignIconUrl: activeConfig.branding.campaignIconUrl,
      });
      setBgUrlInput(activeConfig.background?.url || "");
    }
  }, [activeConfig]);

  // Fecha modal de reset com Escape
  useEffect(() => {
    if (!showResetModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        setShowResetModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showResetModal, isSaving]);

  const hasUnsavedChanges = useMemo(
    () => !areTabletopCustomizationsEqual(draft, activeConfig),
    [draft, activeConfig],
  );

  const isCurrentlyDefault = useMemo(
    () => isDefaultTabletopCustomization(activeConfig) && !hasUnsavedChanges,
    [activeConfig, hasUnsavedChanges],
  );

  const handleSelectPreset = (presetId: TabletopThemePresetId) => {
    setFeedback(null);
    if (presetId === "custom") {
      setDraft((prev) => ({ ...prev, presetId: "custom" }));
      return;
    }
    setDraft((prev) => {
      const next = applyPresetToConfig(prev, presetId);
      setHexDrafts({ ...next.colors });
      return next;
    });
  };

  const handleColorPickerChange = (key: keyof TabletopColorsConfig, rawHex: string) => {
    const normalized = normalizeHexColor(rawHex, draft.colors[key]);
    setHexDrafts((prev) => ({ ...prev, [key]: normalized }));
    setDraft((prev) => {
      const nextColors = { ...prev.colors, [key]: normalized };
      return {
        ...prev,
        colors: nextColors,
        presetId: detectMatchingPresetId(nextColors, prev.interfaceStyle),
      };
    });
  };

  const handleHexTextChange = (key: keyof TabletopColorsConfig, inputVal: string) => {
    const sanitized = inputVal.slice(0, 7);
    setHexDrafts((prev) => ({ ...prev, [key]: sanitized }));
    if (isValidHexInput(sanitized)) {
      const normalized = normalizeHexColor(sanitized, draft.colors[key]);
      setDraft((prev) => {
        const nextColors = { ...prev.colors, [key]: normalized };
        return {
          ...prev,
          colors: nextColors,
          presetId: detectMatchingPresetId(nextColors, prev.interfaceStyle),
        };
      });
    }
  };

  const handleHexTextBlur = (key: keyof TabletopColorsConfig) => {
    setHexDrafts((prev) => ({
      ...prev,
      [key]: draft.colors[key],
    }));
  };

  const handleInterfaceStyleChange = <
    K extends keyof TabletopCustomizationConfig["interfaceStyle"],
  >(
    key: K,
    value: TabletopCustomizationConfig["interfaceStyle"][K],
  ) => {
    setDraft((prev) => {
      const nextStyle = { ...prev.interfaceStyle, [key]: value };
      return {
        ...prev,
        interfaceStyle: nextStyle,
        presetId: detectMatchingPresetId(prev.colors, nextStyle),
      };
    });
  };

  const handleBrandingTextChange = (
    field: "headerTitle" | "seasonSubtitle",
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [field]: value,
      },
    }));
  };

  const handleImageFileUpload = async (
    slot: TabletopBrandImageSlot,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFeedback(null);
    setUploadingSlot(slot);

    const res = await uploadCustomBrandImage(file, slot, roomId);
    setUploadingSlot(null);

    if (!res.ok || !res.url) {
      setFeedback({
        type: "error",
        text: res.error || "Falha ao enviar a imagem selecionada.",
      });
      return;
    }

    setDraft((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [slot]: res.url!,
      },
    }));
    setUrlInputs((prev) => ({
      ...prev,
      [slot]: res.url!.startsWith("data:") ? "" : res.url!,
    }));

    if (res.warning) {
      setFeedback({ type: "warning", text: res.warning });
    } else {
      setFeedback({
        type: "success",
        text: "Imagem carregada na pré-visualização. Clique em Salvar e Aplicar na Sala para publicar.",
      });
    }
  };

  const handleApplyImageUrl = (slot: TabletopBrandImageSlot) => {
    setFeedback(null);
    const raw = (urlInputs[slot] || "").trim();
    if (!raw) {
      handleClearImageSlot(slot);
      return;
    }
    const safeUrl = sanitizeCustomImageUrl(raw);
    if (!safeUrl) {
      setFeedback({
        type: "error",
        text: "URL de imagem inválida. Utilize um link HTTPS/HTTP válido.",
      });
      return;
    }
    setDraft((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [slot]: safeUrl,
      },
    }));
    setUrlInputs((prev) => ({ ...prev, [slot]: safeUrl }));
  };

  const handleClearImageSlot = (slot: TabletopBrandImageSlot) => {
    setDraft((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [slot]: "",
      },
    }));
    setUrlInputs((prev) => ({ ...prev, [slot]: "" }));
  };

  const handleBackgroundFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFeedback(null);
    setUploadingBg(true);
    const res = await uploadSceneBackgroundMedia(file, roomId);
    setUploadingBg(false);

    if (!res.ok || !res.url) {
      setFeedback({
        type: "error",
        text: res.error || "Falha ao enviar mídia de fundo.",
      });
      return;
    }

    const mediaType =
      res.mediaType ?? detectCustomBackgroundMediaType(res.url);

    setDraft((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        url: res.url!,
        mediaType,
      },
    }));
    setBgUrlInput(res.url.startsWith("data:") ? "" : res.url);

    if (res.warning) {
      setFeedback({ type: "warning", text: res.warning });
    } else {
      setFeedback({
        type: "success",
        text: "Fundo carregado na pré-visualização. Clique em Salvar e Aplicar na Sala para publicar.",
      });
    }
  };

  const handleApplyBackgroundUrl = () => {
    setFeedback(null);
    const raw = bgUrlInput.trim();
    if (!raw) {
      handleResetBackgroundToDefault();
      return;
    }
    const safeUrl = sanitizeCustomImageUrl(raw);
    if (!safeUrl) {
      setFeedback({
        type: "error",
        text: "URL de fundo inválida. Utilize um link HTTPS/HTTP válido (imagem, GIF ou MP4/WebM).",
      });
      return;
    }
    const mediaType = detectCustomBackgroundMediaType(safeUrl);
    setDraft((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        url: safeUrl,
        mediaType,
      },
    }));
    setBgUrlInput(safeUrl);
  };

  const handleResetBackgroundToDefault = () => {
    setDraft((prev) => ({
      ...prev,
      background: {
        ...DEMOLOGIA_ORIGINAL_BACKGROUND,
      },
    }));
    setBgUrlInput("");
  };

  const handleBackgroundOverlayChange = (val: number) => {
    const clamped = Math.max(0, Math.min(90, Math.round(val)));
    setDraft((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        overlayOpacity: clamped,
      },
    }));
  };

  const handleDiscardChanges = () => {
    setDraft(activeConfig);
    setHexDrafts({ ...activeConfig.colors });
    setUrlInputs({
      primaryLogoUrl: activeConfig.branding.primaryLogoUrl,
      secondaryLogoUrl: activeConfig.branding.secondaryLogoUrl,
      campaignIconUrl: activeConfig.branding.campaignIconUrl,
    });
    setBgUrlInput(activeConfig.background?.url || "");
    setFeedback(null);
  };

  const handleSave = async () => {
    setFeedback(null);
    const res = await onSaveCustomization(draft);
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível salvar a customização da sala.",
      });
      return;
    }
    setFeedback({
      type: "success",
      text: "Identidade visual salva e sincronizada em tempo real para todos os jogadores da sala.",
    });
  };

  const handleConfirmReset = async () => {
    setFeedback(null);
    const res = await onResetCustomization();
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível restaurar a aparência padrão.",
      });
      return;
    }
    setShowResetModal(false);
    setFeedback({
      type: "success",
      text: "Aparência original do Demologia restaurada e sincronizada para todos os jogadores.",
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-4 pt-3 pb-16 font-mono text-[#dedede]">
      {/* Cabeçalho Operacional da Aba */}
      <div className="bg-[#0e0e13] border border-[#23232f] p-3.5 sm:p-5 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8a8b9c] mb-1">
              <span>Identidade Visual da Sala · {roomId}</span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9px] ${
                  syncStatus === "offline"
                    ? "border-amber-700/50 bg-amber-950/30 text-amber-300"
                    : syncStatus === "syncing"
                      ? "border-sky-700/50 bg-sky-950/30 text-sky-300"
                      : "border-emerald-700/40 bg-emerald-950/25 text-emerald-300"
                }`}
              >
                {syncStatus === "offline" ? <CloudOff size={10} /> : <Cloud size={10} />}
                <span>
                  {syncStatus === "offline"
                    ? "Offline"
                    : syncStatus === "syncing"
                      ? "Sincronizando..."
                      : "Sincronizado"}
                </span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.14em] text-white flex items-center gap-2.5">
              <Palette size={20} className="text-[var(--op-red-bright)] shrink-0" />
              <span>Customização do Tabletop</span>
            </h1>
            <p className="text-xs text-[#9b9caa] mt-1 max-w-2xl leading-relaxed">
              Personalize cores, logos e aparência visual de toda a plataforma para todos os jogadores desta sala. Exclusivamente estético — nenhuma mecânica, ficha ou regra é alterada.
            </p>
          </div>

          {/* Ações Principais */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                data-testid="customization-discard-btn"
                className="min-h-[44px] px-3 bg-[#14141c] hover:bg-[#1c1c28] border border-[#2a2a38] text-[#b4b5c2] hover:text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 touch-manipulation"
              >
                <Undo2 size={14} />
                <span>Descartar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={isSaving}
              data-testid="customization-reset-btn"
              className="min-h-[44px] px-3.5 bg-[#1b0b0e] hover:bg-[#2a1015] border border-[#7c1d25] text-red-200 hover:text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 touch-manipulation"
            >
              <RotateCcw size={14} />
              <span>Restaurar Padrão (RESET)</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              data-testid="customization-save-btn"
              className="min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:bg-[#23232e] disabled:text-[#6f7080] text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Aplicando...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Salvar e Aplicar na Sala</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Alertas de status / erro */}
        {(feedback || syncError) && (
          <div
            role={feedback?.type === "error" || syncError ? "alert" : "status"}
            data-testid="customization-feedback"
            className={`mt-3.5 px-3 py-2.5 border text-xs flex items-center gap-2 ${
              feedback?.type === "error" || (!feedback && syncError)
                ? "bg-[#1c0b0e] border-[#7c1d25] text-red-200"
                : feedback?.type === "warning"
                  ? "bg-amber-950/35 border-amber-700/60 text-amber-200"
                  : "bg-emerald-950/35 border-emerald-700/60 text-emerald-200"
            }`}
          >
            {feedback?.type === "error" || (!feedback && syncError) ? (
              <AlertTriangle size={15} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            )}
            <span>{feedback?.text || syncError}</span>
          </div>
        )}
      </div>

      {/* Layout Principal: Controles à esquerda + Pré-visualização sticky à direita */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* SEÇÃO 1: TEMAS PREDEFINIDOS */}
          <section className="bg-[#0e0e13] border border-[#23232f] p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#1d1d28]">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--op-red-bright)]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                  // 01. Temas Predefinidos
                </h2>
              </div>
              <span className="text-[10px] text-[#8a8b9c] uppercase tracking-wider">
                Modelos editáveis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TABLETOP_THEME_PRESETS.map((preset) => {
                const active = draft.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`preset-card-${preset.id}`}
                    aria-pressed={active}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`text-left p-3.5 border transition-all cursor-pointer touch-manipulation flex flex-col justify-between gap-2.5 ${
                      active
                        ? "bg-[#180d11] border-[var(--op-red-bright)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "bg-[#121218] hover:bg-[#171720] border-[#252532]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white">
                          {preset.name}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-[#9b9caa] mt-0.5">
                          {preset.tagline}
                        </div>
                      </div>
                      {active && (
                        <span className="px-1.5 py-0.5 bg-[var(--op-red)] text-white text-[9px] font-bold uppercase tracking-wider shrink-0">
                          Ativo
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#8c8d9e] leading-snug">
                      {preset.description}
                    </p>

                    <div className="flex items-center gap-1.5 pt-1">
                      {[
                        preset.colors.background,
                        preset.colors.panel,
                        preset.colors.primary,
                        preset.colors.accent,
                        preset.colors.textPrimary,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          className="w-5 h-3.5 border border-white/15"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}

              {/* Card Personalizado */}
              <button
                type="button"
                data-testid="preset-card-custom"
                aria-pressed={draft.presetId === "custom"}
                onClick={() => handleSelectPreset("custom")}
                className={`text-left p-3.5 border transition-all cursor-pointer touch-manipulation flex flex-col justify-between gap-2.5 ${
                  draft.presetId === "custom"
                    ? "bg-[#180d11] border-[var(--op-red-bright)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "bg-[#121218] hover:bg-[#171720] border-[#252532]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white">
                      Personalizado
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#9b9caa] mt-0.5">
                      Configuração do Mestre
                    </div>
                  </div>
                  {draft.presetId === "custom" && (
                    <span className="px-1.5 py-0.5 bg-[var(--op-red)] text-white text-[9px] font-bold uppercase tracking-wider shrink-0">
                      Ativo
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[#8c8d9e] leading-snug">
                  Ativado automaticamente sempre que você edita qualquer cor ou parâmetro de interface manualmente.
                </p>

                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    draft.colors.background,
                    draft.colors.panel,
                    draft.colors.primary,
                    draft.colors.accent,
                    draft.colors.interactive,
                  ].map((hex, i) => (
                    <span
                      key={i}
                      className="w-5 h-3.5 border border-white/15"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              </button>
            </div>
          </section>

          {/* SEÇÃO 2: IDENTIDADE VISUAL */}
          <section className="bg-[#0e0e13] border border-[#23232f] p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#1d1d28]">
              <div className="flex items-center gap-2">
                <ImageIcon size={15} className="text-[var(--op-red-bright)]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                  // 02. Identidade Visual e Logos
                </h2>
              </div>
              <span className="text-[10px] text-[#8a8b9c] uppercase tracking-wider">
                PNG · JPG · WebP · SVG
              </span>
            </div>

            {/* Textos de Cabeçalho e Temporada */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label
                  htmlFor="ct-header-title"
                  className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-1.5"
                >
                  Nome exibido no cabeçalho
                </label>
                <input
                  id="ct-header-title"
                  data-testid="customization-header-title-input"
                  type="text"
                  maxLength={48}
                  value={draft.branding.headerTitle}
                  onChange={(e) => handleBrandingTextChange("headerTitle", e.target.value)}
                  placeholder={DEFAULT_HEADER_TITLE}
                  className="w-full min-h-[44px] px-3 bg-[#121218] border border-[#2a2a38] focus:border-[var(--op-red-bright)] text-white text-xs placeholder-[#636475]"
                />
              </div>

              <div>
                <label
                  htmlFor="ct-season-subtitle"
                  className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-1.5"
                >
                  Subtítulo ou nome da temporada
                </label>
                <input
                  id="ct-season-subtitle"
                  data-testid="customization-season-subtitle-input"
                  type="text"
                  maxLength={72}
                  value={draft.branding.seasonSubtitle}
                  onChange={(e) => handleBrandingTextChange("seasonSubtitle", e.target.value)}
                  placeholder="Ex: Temporada II — O Véu"
                  className="w-full min-h-[44px] px-3 bg-[#121218] border border-[#2a2a38] focus:border-[var(--op-red-bright)] text-white text-xs placeholder-[#636475]"
                />
              </div>
            </div>

            {/* Slots de Imagem (Logo Principal, Logo Secundária, Ícone da Campanha) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {IMAGE_SLOTS.map(({ slot, label, description, fallbackPreview }) => {
                const currentUrl = draft.branding[slot];
                const isUploading = uploadingSlot === slot;
                const displayThumb = currentUrl || fallbackPreview || "";
                const inputId = `ct-upload-${slot}`;

                return (
                  <div
                    key={slot}
                    className="bg-[#121218] border border-[#252532] p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                          {label}
                        </span>
                        {currentUrl ? (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 uppercase">
                            Custom
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#181822] border border-[#2c2c3a] text-[#888a9b] uppercase">
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#888a9b] leading-snug mb-2.5">
                        {description}
                      </p>

                      {/* Preview Thumbnail */}
                      <div className="h-24 w-full bg-[#09090d] border border-[#22222e] flex items-center justify-center overflow-hidden p-2 mb-2.5">
                        {displayThumb ? (
                          <img
                            src={displayThumb}
                            alt={label}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-[#5f6070]">
                            <ImageIcon size={20} />
                            <span className="text-[9px] uppercase tracking-wider">
                              Sem ícone
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Botões de Upload e Limpar */}
                      <div className="flex items-center gap-1.5">
                        <input
                          id={inputId}
                          data-testid={`customization-upload-${slot}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                          onChange={(e) => handleImageFileUpload(slot, e)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className={`flex-1 min-h-[40px] px-2.5 bg-[#181822] hover:bg-[#222230] border border-[#303042] text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                            isUploading ? "opacity-60 pointer-events-none" : ""
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={13} />
                              <span>Importar</span>
                            </>
                          )}
                        </label>
                        {currentUrl && (
                          <button
                            type="button"
                            onClick={() => handleClearImageSlot(slot)}
                            aria-label={`Remover ${label}`}
                            title={`Restaurar ${label}`}
                            className="min-w-[40px] min-h-[40px] bg-[#1a0d10] hover:bg-[#2b1116] border border-[#5e1b22] text-red-300 inline-flex items-center justify-center cursor-pointer touch-manipulation"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Campo URL direta */}
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          value={urlInputs[slot]}
                          onChange={(e) =>
                            setUrlInputs((prev) => ({ ...prev, [slot]: e.target.value }))
                          }
                          onBlur={() => {
                            if (urlInputs[slot].trim()) {
                              handleApplyImageUrl(slot);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyImageUrl(slot);
                            }
                          }}
                          placeholder="Ou cole URL https://..."
                          aria-label={`URL para ${label}`}
                          className="flex-1 min-w-0 min-h-[36px] px-2 bg-[#0c0c11] border border-[#242430] text-[10px] text-[#d4d5e2] placeholder-[#5d5e6e]"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyImageUrl(slot)}
                          className="min-h-[36px] px-2 bg-[#16161f] hover:bg-[#222230] border border-[#2a2a38] text-[9px] uppercase font-bold text-[#c2c3d2] cursor-pointer touch-manipulation shrink-0"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Plano de Fundo da Plataforma (Mudar Fundo) */}
            <div className="mt-4 pt-4 border-t border-[#1d1d28]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Wallpaper size={14} className="text-[var(--op-red-bright)]" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                    Mudar Fundo da Plataforma
                  </h3>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-[#8a8b9c]">
                  PNG · JPG · WebP · GIF · MP4/WebM (Loop)
                </span>
              </div>

              <div className="bg-[#121218] border border-[#252532] p-3 grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-3 items-center">
                {/* Preview do Fundo */}
                <div className="relative h-28 w-full bg-[#09090d] border border-[#22222e] overflow-hidden flex items-center justify-center">
                  {draft.background?.url ? (
                    <>
                      {draft.background.mediaType === "video" ? (
                        <video
                          key={draft.background.url}
                          src={draft.background.url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={draft.background.url}
                          alt="Prévia do fundo personalizado"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundColor: `rgba(0,0,0,${(draft.background.overlayOpacity ?? 45) / 100})`,
                        }}
                      />
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/75 border border-white/15 text-[9px] uppercase text-white">
                        {draft.background.mediaType === "video"
                          ? "MP4 Loop"
                          : draft.background.mediaType === "gif"
                            ? "GIF Loop"
                            : "Imagem"}
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[#636475]">
                      <Wallpaper size={20} />
                      <span className="text-[9px] uppercase tracking-wider">
                        Fundo Padrão
                      </span>
                    </div>
                  )}
                </div>

                {/* Controles de Upload, URL, Padrão e Escurecimento */}
                <div className="space-y-2.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="ct-upload-background"
                      data-testid="customization-bg-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"
                      onChange={handleBackgroundFileUpload}
                      className="sr-only"
                    />
                    <label
                      htmlFor="ct-upload-background"
                      className={`min-h-[42px] px-3 bg-[#181822] hover:bg-[#222230] border border-[#303042] text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                        uploadingBg ? "opacity-60 pointer-events-none" : ""
                      }`}
                    >
                      {uploadingBg ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Enviando fundo...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>Importar Fundo</span>
                        </>
                      )}
                    </label>

                    <button
                      type="button"
                      onClick={handleResetBackgroundToDefault}
                      disabled={!draft.background?.url}
                      data-testid="customization-bg-clear-btn"
                      className="min-h-[42px] px-3 bg-[#170c0f] hover:bg-[#271116] disabled:opacity-45 border border-[#5e1b22] text-red-200 hover:text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed touch-manipulation"
                    >
                      <RotateCcw size={13} />
                      <span>Usar Padrão</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      data-testid="customization-bg-url-input"
                      value={bgUrlInput}
                      onChange={(e) => setBgUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyBackgroundUrl();
                        }
                      }}
                      placeholder="Ou cole URL https://... (Imagem, GIF ou MP4)"
                      aria-label="URL do fundo da plataforma"
                      className="flex-1 min-w-0 min-h-[40px] px-2.5 bg-[#0c0c11] border border-[#242430] text-[11px] text-[#d4d5e2] placeholder-[#5d5e6e]"
                    />
                    <button
                      type="button"
                      data-testid="customization-bg-url-apply-btn"
                      onClick={handleApplyBackgroundUrl}
                      className="min-h-[40px] px-3 bg-[#16161f] hover:bg-[#222230] border border-[#2a2a38] text-[10px] uppercase font-bold text-[#d4d5e2] cursor-pointer touch-manipulation shrink-0"
                    >
                      Aplicar
                    </button>
                  </div>

                  {draft.background?.url && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9b9caa] mb-1">
                        <label htmlFor="ct-bg-overlay-range">
                          Escurecimento sobre o fundo (legibilidade)
                        </label>
                        <span className="text-white font-bold tabular-nums">
                          {draft.background.overlayOpacity ?? 45}%
                        </span>
                      </div>
                      <input
                        id="ct-bg-overlay-range"
                        data-testid="customization-bg-overlay-range"
                        type="range"
                        min={0}
                        max={90}
                        step={5}
                        value={draft.background.overlayOpacity ?? 45}
                        onChange={(e) =>
                          handleBackgroundOverlayChange(Number(e.target.value))
                        }
                        className="w-full accent-[var(--op-red-bright)] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: PALETA DE CORES (HEX) */}
          <section className="bg-[#0e0e13] border border-[#23232f] p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#1d1d28]">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-[var(--op-red-bright)]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                  // 03. Paleta de Cores (HEX)
                </h2>
              </div>
              <span className="text-[10px] text-[#8a8b9c] uppercase tracking-wider">
                9 Variáveis Globais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {COLOR_FIELDS.map((field) => {
                const currentHex = draft.colors[field.key];
                const rawHexText = hexDrafts[field.key] ?? currentHex;
                const hexValid = isValidHexInput(rawHexText);

                return (
                  <div
                    key={field.key}
                    className="bg-[#121218] border border-[#252532] p-2.5 flex flex-col gap-2"
                  >
                    <div className="min-w-0">
                      <label
                        htmlFor={`ct-color-hex-${field.key}`}
                        className="block text-[11px] font-bold uppercase tracking-wider text-white truncate"
                      >
                        {field.label}
                      </label>
                      <span className="block text-[10px] text-[#848597] truncate">
                        {field.hint}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="relative w-11 h-11 shrink-0 border border-[#363646] cursor-pointer overflow-hidden">
                        <input
                          type="color"
                          aria-label={`Seletor visual: ${field.label}`}
                          value={currentHex}
                          onChange={(e) =>
                            handleColorPickerChange(field.key, e.target.value)
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span
                          className="block w-full h-full"
                          style={{ backgroundColor: currentHex }}
                        />
                      </label>

                      <input
                        id={`ct-color-hex-${field.key}`}
                        data-testid={`customization-hex-${field.key}`}
                        type="text"
                        value={rawHexText}
                        onChange={(e) => handleHexTextChange(field.key, e.target.value)}
                        onBlur={() => handleHexTextBlur(field.key)}
                        maxLength={7}
                        spellCheck={false}
                        className={`flex-1 min-w-0 min-h-[44px] px-2.5 bg-[#0b0b10] border text-xs uppercase tracking-widest tabular-nums text-white ${
                          hexValid
                            ? "border-[#2a2a38] focus:border-[var(--op-red-bright)]"
                            : "border-red-500 text-red-300"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SEÇÃO 4: APARÊNCIA DA INTERFACE */}
          <section className="bg-[#0e0e13] border border-[#23232f] p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#1d1d28]">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[var(--op-red-bright)]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                  // 04. Aparência da Interface
                </h2>
              </div>
              <span className="text-[10px] text-[#8a8b9c] uppercase tracking-wider">
                Ajustes estéticos
              </span>
            </div>

            <div className="space-y-4">
              {/* Desligar painel de fundo de HP e PE */}
              <div className="bg-[#121218] border border-[#252532] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <EyeOff size={14} className="text-[var(--op-red-bright)] shrink-0" />
                    <span>Desligar painel de fundo de HP e PE</span>
                  </div>
                  <p className="text-[11px] text-[#9b9caa] mt-1 leading-snug">
                    Deixa apenas a caixa, borda e sombra de fundo do painel de HP e PE invisíveis, mantendo a logo, o nome, os valores e as barras intactos sobre o fundo da mesa.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(draft.interfaceStyle.hideHpPePanelBackground)}
                  data-testid="customization-hide-hud-panel-toggle"
                  onClick={() =>
                    handleInterfaceStyleChange(
                      "hideHpPePanelBackground",
                      !draft.interfaceStyle.hideHpPePanelBackground,
                    )
                  }
                  className={`min-h-[44px] px-4 border text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors touch-manipulation ${
                    draft.interfaceStyle.hideHpPePanelBackground
                      ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                      : "bg-[#0c0c11] hover:bg-[#171722] border-[#2c2c3a] text-[#9b9caa]"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      draft.interfaceStyle.hideHpPePanelBackground
                        ? "bg-emerald-400"
                        : "bg-[#4a4b5c]"
                    }`}
                  />
                  <span>
                    {draft.interfaceStyle.hideHpPePanelBackground
                      ? "Invisível (Ligado)"
                      : "Visível (Padrão)"}
                  </span>
                </button>
              </div>

              {/* Arredondamento dos cantos */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-2">
                  Arredondamento dos cantos
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "none", label: "Reto (0px)" },
                      { id: "subtle", label: "Sutil (4px)" },
                      { id: "medium", label: "Médio (8px)" },
                      { id: "rounded", label: "Suave (12px)" },
                    ] as Array<{ id: TabletopCornerRadius; label: string }>
                  ).map((opt) => {
                    const active = draft.interfaceStyle.cornerRadius === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        data-testid={`customization-radius-${opt.id}`}
                        onClick={() => handleInterfaceStyleChange("cornerRadius", opt.id)}
                        className={`min-h-[44px] px-2.5 border text-xs uppercase tracking-wider font-bold cursor-pointer touch-manipulation ${
                          active
                            ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                            : "bg-[#121218] hover:bg-[#191922] border-[#262634] text-[#9b9caa]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intensidade das sombras */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-2">
                  Intensidade das sombras
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "none", label: "Nenhuma" },
                      { id: "subtle", label: "Sutil" },
                      { id: "medium", label: "Média" },
                      { id: "strong", label: "Intensa" },
                    ] as Array<{ id: TabletopShadowIntensity; label: string }>
                  ).map((opt) => {
                    const active = draft.interfaceStyle.shadowIntensity === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        data-testid={`customization-shadow-${opt.id}`}
                        onClick={() => handleInterfaceStyleChange("shadowIntensity", opt.id)}
                        className={`min-h-[44px] px-2.5 border text-xs uppercase tracking-wider font-bold cursor-pointer touch-manipulation ${
                          active
                            ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                            : "bg-[#121218] hover:bg-[#191922] border-[#262634] text-[#9b9caa]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transparência / Opacidade dos painéis */}
              <div className="bg-[#121218] border border-[#252532] p-3">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-2">
                  <label htmlFor="ct-panel-opacity">
                    Opacidade / Transparência dos painéis
                  </label>
                  <span className="text-white tabular-nums text-xs">
                    {draft.interfaceStyle.panelOpacity}%
                  </span>
                </div>
                <input
                  id="ct-panel-opacity"
                  data-testid="customization-panel-opacity-range"
                  type="range"
                  min={60}
                  max={100}
                  step={2}
                  value={draft.interfaceStyle.panelOpacity}
                  onChange={(e) =>
                    handleInterfaceStyleChange("panelOpacity", Number(e.target.value))
                  }
                  className="w-full accent-[var(--op-red-bright)] cursor-pointer"
                />
                <div className="flex items-center justify-between text-[9px] text-[#7a7b8c] uppercase mt-1">
                  <span>Mais translúcido (60%)</span>
                  <span>Sólido (100%)</span>
                </div>
              </div>

              {/* Densidade visual + Intensidade das animações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-2">
                    Densidade visual
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "compact", label: "Compacta" },
                        { id: "normal", label: "Padrão" },
                        { id: "comfortable", label: "Ampla" },
                      ] as Array<{ id: TabletopInterfaceDensity; label: string }>
                    ).map((opt) => {
                      const active = draft.interfaceStyle.density === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          data-testid={`customization-density-${opt.id}`}
                          onClick={() => handleInterfaceStyleChange("density", opt.id)}
                          className={`min-h-[44px] px-2 border text-[11px] uppercase tracking-wider font-bold cursor-pointer touch-manipulation ${
                            active
                              ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                              : "bg-[#121218] hover:bg-[#191922] border-[#262634] text-[#9b9caa]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2a3b4] mb-2">
                    Intensidade das animações
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "reduced", label: "Reduzida" },
                        { id: "normal", label: "Normal" },
                        { id: "expressive", label: "Expressiva" },
                      ] as Array<{ id: TabletopAnimationIntensity; label: string }>
                    ).map((opt) => {
                      const active = draft.interfaceStyle.animationIntensity === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          data-testid={`customization-motion-${opt.id}`}
                          onClick={() =>
                            handleInterfaceStyleChange("animationIntensity", opt.id)
                          }
                          className={`min-h-[44px] px-2 border text-[11px] uppercase tracking-wider font-bold cursor-pointer touch-manipulation ${
                            active
                              ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                              : "bg-[#121218] hover:bg-[#191922] border-[#262634] text-[#9b9caa]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO STICKY + RESUMO DE PUBLICAÇÃO */}
        <aside className="xl:sticky xl:top-20 flex flex-col gap-3 min-w-0">
          <TabletopThemePreview
            config={draft}
            hasUnsavedChanges={hasUnsavedChanges}
          />

          <div className="bg-[#0e0e13] border border-[#23232f] p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b4b5c2]">
              <Eye size={13} className="text-[var(--op-red-bright)]" />
              <span>Distribuição Global na Sala</span>
            </div>
            <p className="text-[11px] text-[#8d8e9f] leading-relaxed">
              As edições acima ficam visíveis apenas nesta prévia até você clicar em{" "}
              <strong className="text-white">Salvar e Aplicar na Sala</strong>. Ao publicar, todos os jogadores conectados recebem o novo visual automaticamente sem recarregar a página.
            </p>
            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="w-full min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] disabled:bg-[#22222d] disabled:text-[#6f7080] text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Salvar e Aplicar na Sala</span>
                  </>
                )}
              </button>

              {!isCurrentlyDefault && (
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  disabled={isSaving}
                  className="w-full min-h-[42px] px-3 bg-[#170a0d] hover:bg-[#260e13] border border-[#6e1c26] text-red-200 hover:text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 touch-manipulation"
                >
                  <RotateCcw size={13} />
                  <span>Restaurar Padrão Demologia</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE RESET (mesmo padrão do popup de senha do Mestre) */}
      <AnimatePresence>
        {showResetModal && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[100] bg-black/82 flex items-end sm:items-center justify-center sm:p-4 font-mono"
            onClick={() => !isSaving && setShowResetModal(false)}
          >
            <MotionSheetPanel
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-customization-title"
              data-testid="customization-reset-modal"
              className="relative bg-[#0c0c10] border-t sm:border border-[#262632] w-full sm:max-w-md overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.88)] rounded-none"
              style={{
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-[2px] w-full bg-[var(--op-red-bright)]" />

              <div className="sm:hidden flex justify-center pt-2.5">
                <span className="w-10 h-1 bg-[#2e2e3a]" aria-hidden="true" />
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowResetModal(false)}
                aria-label="Fechar confirmação de reset"
                className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#78798a] hover:text-white active:scale-95 transition-all cursor-pointer touch-manipulation"
              >
                <X size={18} />
              </button>

              <div className="px-5 pt-5 pb-1 sm:px-6 sm:pt-6 sm:pb-2 space-y-4">
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-10 h-10 bg-[#1c0a0d] border border-[#7c1d25] flex items-center justify-center shrink-0">
                    <RotateCcw size={18} className="text-[var(--op-red-bright)]" />
                  </div>
                  <div>
                    <h2
                      id="reset-customization-title"
                      className="text-base font-bold uppercase tracking-[0.16em] text-white"
                    >
                      Restaurar Padrão
                    </h2>
                    <p className="text-[11px] text-[#9b9caa] mt-0.5">
                      RESET visual global para toda a sala
                    </p>
                  </div>
                </div>

                <div className="bg-[#13131a] border border-[#252532] p-3.5 text-xs text-[#c7c8d6] space-y-2 leading-relaxed">
                  <p>
                    Esta ação remove todas as cores, logos, títulos e ajustes estéticos personalizados, devolvendo imediatamente a aparência oficial do <strong className="text-white">Demologia</strong> para todos os jogadores conectados.
                  </p>
                  <p className="text-[11px] text-emerald-300/90 border-t border-[#22222e] pt-2">
                    Nenhum dado da campanha será apagado: fichas, jogadores, criaturas, rituais, handouts, chat e anotações permanecem intactos.
                  </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowResetModal(false)}
                    data-testid="customization-reset-cancel-btn"
                    className="w-full sm:w-auto min-h-[44px] px-4 bg-[#14141c] hover:bg-[#1d1d28] border border-[#2a2a38] text-xs font-bold uppercase tracking-wider text-[#b4b5c2] hover:text-white cursor-pointer touch-manipulation"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleConfirmReset}
                    data-testid="customization-reset-confirm-btn"
                    className="w-full sm:flex-1 min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 touch-manipulation"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Restaurando...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>Confirmar RESET</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>
    </div>
  );
};
