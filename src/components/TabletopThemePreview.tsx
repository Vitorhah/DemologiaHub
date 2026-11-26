import React from "react";
import { ShieldAlert, Sparkles, Radio, Check } from "lucide-react";
import type { TabletopCustomizationConfig } from "../types/tabletopCustomization";
import {
  CORNER_RADIUS_PX,
  SHADOW_TOKENS,
  adjustHexBrightness,
  getContrastTextColor,
  hexToRgba,
  resolveEffectiveBranding,
} from "../utils/tabletopCustomization";
import { DEMOLOGIA_LOGO_URL } from "../constants/branding";

export interface TabletopThemePreviewProps {
  config: TabletopCustomizationConfig;
  hasUnsavedChanges?: boolean;
}

export const TabletopThemePreview = React.memo(function TabletopThemePreview({
  config,
  hasUnsavedChanges = false,
}: TabletopThemePreviewProps) {
  const { colors, interfaceStyle, background } = config;
  const branding = resolveEffectiveBranding(config);
  const radius = CORNER_RADIUS_PX[interfaceStyle.cornerRadius];
  const shadow = SHADOW_TOKENS[interfaceStyle.shadowIntensity];
  const panelAlpha = Math.max(0.6, Math.min(1, interfaceStyle.panelOpacity / 100));
  const panelBg = hexToRgba(colors.panel, panelAlpha);
  const headerBg = hexToRgba(adjustHexBrightness(colors.background, 5), Math.min(0.99, panelAlpha + 0.04));
  const softPrimaryBg = hexToRgba(colors.primary, 0.18);
  const softAccentBg = hexToRgba(colors.accent, 0.16);
  const hasCustomBgMedia = Boolean(background?.url);
  const hideHudPanel = Boolean(interfaceStyle.hideHpPePanelBackground);

  const densityPad =
    interfaceStyle.density === "compact"
      ? "p-2.5 gap-2"
      : interfaceStyle.density === "comfortable"
        ? "p-4 gap-3.5"
        : "p-3 gap-3";

  const transitionDuration =
    interfaceStyle.animationIntensity === "reduced"
      ? "0ms"
      : interfaceStyle.animationIntensity === "expressive"
        ? "320ms"
        : "180ms";

  return (
    <div
      data-testid="customization-live-preview"
      className="border border-[#242430] bg-[#0b0b0f] overflow-hidden"
    >
      {/* Faixa de status do preview */}
      <div className="px-3.5 py-2.5 bg-[#101016] border-b border-[#22222d] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 bg-emerald-400 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4d5e2] truncate">
            Pré-visualização em Tempo Real
          </span>
        </div>
        <span
          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${
            hasUnsavedChanges
              ? "bg-amber-950/35 border-amber-700/50 text-amber-200"
              : "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
          }`}
        >
          {hasUnsavedChanges ? "Rascunho local" : "Aplicado na sala"}
        </span>
      </div>

      {/* Palco simulado da interface */}
      <div
        className="relative p-3.5 sm:p-4 transition-colors overflow-hidden"
        style={{
          backgroundColor: colors.background,
          color: colors.textPrimary,
          transitionDuration,
          backgroundImage: hasCustomBgMedia
            ? undefined
            : `radial-gradient(circle at 50% 0%, ${hexToRgba(colors.primary, 0.18)} 0%, transparent 65%)`,
        }}
      >
        {hasCustomBgMedia && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {background.mediaType === "video" ? (
              <video
                key={background.url}
                src={background.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={background.url}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${(background.overlayOpacity ?? 45) / 100})`,
              }}
            />
          </div>
        )}
        <div className="relative z-10 flex flex-col gap-3">
          {/* 1. Cabeçalho / Navegação */}
          <div
            data-testid="preview-header"
            className="flex items-center justify-between gap-2.5 px-3 py-2.5 border transition-all"
            style={{
              backgroundColor: headerBg,
              borderColor: colors.border,
              borderRadius: radius,
              boxShadow: shadow.panel,
              transitionDuration,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={branding.primaryLogo}
                alt={branding.headerTitle}
                onError={(e) => {
                  if (e.currentTarget.src !== DEMOLOGIA_LOGO_URL) {
                    e.currentTarget.src = DEMOLOGIA_LOGO_URL;
                  }
                }}
                className="w-8 h-8 object-cover border shrink-0"
                style={{
                  borderColor: colors.primary,
                  borderRadius: radius,
                }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {branding.campaignIcon && (
                    <img
                      src={branding.campaignIcon}
                      alt="Ícone da campanha"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      className="w-4 h-4 object-cover shrink-0"
                      style={{ borderRadius: radius }}
                    />
                  )}
                  <span
                    data-testid="preview-header-title"
                    className="text-xs font-bold uppercase tracking-[0.16em] truncate"
                    style={{ color: colors.textPrimary }}
                  >
                    {branding.headerTitle}
                  </span>
                </div>
                {branding.seasonSubtitle && (
                  <p
                    data-testid="preview-season-subtitle"
                    className="text-[10px] uppercase tracking-[0.12em] truncate mt-0.5"
                    style={{ color: colors.textSecondary }}
                  >
                    {branding.seasonSubtitle}
                  </p>
                )}
              </div>
            </div>

            <span
              className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider border shrink-0"
              style={{
                backgroundColor: softPrimaryBg,
                borderColor: colors.accent,
                color: colors.accent,
                borderRadius: radius,
              }}
            >
              <Radio size={10} />
              <span>Sala</span>
            </span>
          </div>

          {/* 2. Painel principal com Logo Secundária, Textos e Destaque */}
          <div
            data-testid="preview-panel"
            className={`border flex flex-col transition-all ${densityPad}`}
            style={{
              backgroundColor: panelBg,
              borderColor: colors.border,
              borderRadius: radius,
              boxShadow: shadow.panel,
              transitionDuration,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: colors.border }}>
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={branding.secondaryLogo}
                  alt="Logo secundária"
                  onError={(e) => {
                    if (e.currentTarget.src !== DEMOLOGIA_LOGO_URL) {
                      e.currentTarget.src = DEMOLOGIA_LOGO_URL;
                    }
                  }}
                  className="w-9 h-9 object-contain border p-0.5 shrink-0"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: hexToRgba(colors.background, 0.7),
                    borderRadius: radius,
                  }}
                />
                <div className="min-w-0">
                  <div
                    className="text-xs font-bold uppercase tracking-wider truncate"
                    style={{ color: colors.textPrimary }}
                  >
                    Dossiê Operacional
                  </div>
                  <div
                    className="text-[10px] truncate"
                    style={{ color: colors.textSecondary }}
                  >
                    Texto secundário · Registro classificado
                  </div>
                </div>
              </div>

              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border shrink-0"
                style={{
                  backgroundColor: softAccentBg,
                  borderColor: colors.primary,
                  color: colors.accent,
                  borderRadius: radius,
                }}
              >
                <Sparkles size={10} />
                <span>Destaque</span>
              </span>
            </div>

            <p
              className="text-[11px] leading-relaxed"
              style={{ color: colors.textPrimary }}
            >
              A identidade visual configurada acima será aplicada automaticamente no cabeçalho, painéis, bordas e botões de todos os jogadores conectados à sala.
            </p>

            {/* Barra de destaque / acento */}
            <div
              className="px-2.5 py-2 border flex items-center justify-between gap-2 text-[10px]"
              style={{
                backgroundColor: hexToRgba(colors.secondary, 0.35),
                borderColor: colors.primary,
                color: colors.textPrimary,
                borderRadius: radius,
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <ShieldAlert size={12} style={{ color: colors.accent }} />
                <span>Alerta da Campanha</span>
              </span>
              <span style={{ color: colors.accent }}>ATIVO</span>
            </div>

            {/* Prévia do painel de HP e PE (respeita desligar painel de fundo) */}
            <div
              data-testid="preview-hud-hp-pe"
              data-hud-panel-hidden={hideHudPanel ? "true" : "false"}
              className="p-2.5 transition-all"
              style={
                hideHudPanel
                  ? {
                      backgroundColor: "transparent",
                      border: "1px dashed transparent",
                      boxShadow: "none",
                      borderRadius: radius,
                      transitionDuration,
                    }
                  : {
                      backgroundColor: hexToRgba(colors.background, 0.72),
                      border: `1px solid ${colors.border}`,
                      boxShadow: shadow.panel,
                      borderRadius: radius,
                      transitionDuration,
                    }
              }
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <span className="text-[#dc2626]">26/26 HP</span>
                <span className="text-[#00a8ff]">10/10 PE</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-black/75 border border-white/15 overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-[#5c0e12] via-[#b52a30] to-[#f87171]" />
                </div>
                <div className="h-2 w-full bg-black/75 border border-white/15 overflow-hidden">
                  <div className="h-full w-4/5 bg-gradient-to-r from-[#005588] via-[#00a8ff] to-[#7dd3fc]" />
                </div>
              </div>
            </div>

            {/* 3. Botões Interativos */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                tabIndex={-1}
                className="flex-1 min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-1.5 border pointer-events-none"
                style={{
                  backgroundColor: colors.interactive,
                  borderColor: colors.accent,
                  color: getContrastTextColor(colors.interactive),
                  borderRadius: radius,
                  boxShadow: shadow.elevated,
                }}
              >
                <Check size={13} />
                <span>Ação Principal</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider border pointer-events-none"
                style={{
                  backgroundColor: hexToRgba(colors.background, 0.65),
                  borderColor: colors.border,
                  color: colors.textSecondary,
                  borderRadius: radius,
                }}
              >
                Secundário
              </button>
            </div>
          </div>

          {/* Mini resumo técnico */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border text-[9px] uppercase tracking-wider"
            style={{
              backgroundColor: hexToRgba(colors.panel, 0.7),
              borderColor: colors.border,
              color: colors.textSecondary,
              borderRadius: radius,
            }}
          >
            <span>Cantos: {radius}</span>
            <span>Opacidade: {interfaceStyle.panelOpacity}%</span>
            <span>Painel HP/PE: {hideHudPanel ? "Invisível" : "Visível"}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
