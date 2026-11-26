import { DEMOLOGIA_LOGO_URL } from "../constants/branding";
import type {
  TabletopAnimationIntensity,
  TabletopBackgroundConfig,
  TabletopBackgroundMediaType,
  TabletopBrandingConfig,
  TabletopColorsConfig,
  TabletopCornerRadius,
  TabletopCustomPreset,
  TabletopCustomizationConfig,
  TabletopInterfaceDensity,
  TabletopInterfaceStyleConfig,
  TabletopShadowIntensity,
  TabletopThemePresetDefinition,
  TabletopThemePresetId,
} from "../types/tabletopCustomization";

export const TABLETOP_THEME_RECORD_PREFIX = "TABLETOP_THEME_";
export const TABLETOP_THEME_LOCAL_CACHE_PREFIX = "demologia_tabletop_theme_v1_";
export const TABLETOP_PRESETS_LOCAL_CACHE_PREFIX = "demologia_tabletop_presets_v1_";
export const MAX_SAVED_CUSTOM_PRESETS = 24;
export const MAX_CUSTOM_BRAND_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CUSTOM_BRAND_INLINE_FALLBACK_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export const DEFAULT_HEADER_TITLE = "Demologya";

export const DEMOLOGIA_ORIGINAL_COLORS: TabletopColorsConfig = {
  primary: "#8f171c",
  secondary: "#5c0e12",
  accent: "#b52a30",
  background: "#0b0b0d",
  panel: "#151518",
  textPrimary: "#dedede",
  textSecondary: "#99999f",
  border: "#303036",
  interactive: "#8f171c",
};

export const DEMOLOGIA_ORIGINAL_INTERFACE: TabletopInterfaceStyleConfig = {
  cornerRadius: "none",
  shadowIntensity: "medium",
  panelOpacity: 100,
  density: "normal",
  animationIntensity: "normal",
  hideHpPePanelBackground: false,
  logoScale: 100,
  sheetNameOutlineSize: 2.5,
};

export const DEMOLOGIA_ORIGINAL_BRANDING: TabletopBrandingConfig = {
  primaryLogoUrl: "",
  secondaryLogoUrl: "",
  headerTitle: "",
  seasonSubtitle: "",
  campaignIconUrl: "",
};

export const DEMOLOGIA_ORIGINAL_BACKGROUND: TabletopBackgroundConfig = {
  url: "",
  mediaType: "default",
  overlayOpacity: 45,
};

export const TABLETOP_THEME_PRESETS: readonly TabletopThemePresetDefinition[] = [
  {
    id: "demologia",
    name: "Demologia Original",
    tagline: "Padrão Oficial",
    description:
      "Aparência clínica, industrial e opressiva original do arquivo central Demologia.",
    colors: { ...DEMOLOGIA_ORIGINAL_COLORS },
    interfaceStyle: { ...DEMOLOGIA_ORIGINAL_INTERFACE },
  },
  {
    id: "nirvana",
    name: "Nirvana",
    tagline: "Angélico · Gótico · Dourado",
    description:
      "Catedral sombria com ouro envelhecido, marfim sagrado e contrastes litúrgicos refinados.",
    colors: {
      primary: "#c59b3c",
      secondary: "#6b501a",
      accent: "#e8c468",
      background: "#0c0b09",
      panel: "#171410",
      textPrimary: "#f2ece1",
      textSecondary: "#b0a48e",
      border: "#463922",
      interactive: "#b4892e",
    },
    interfaceStyle: {
      cornerRadius: "subtle",
      shadowIntensity: "medium",
      panelOpacity: 96,
      density: "normal",
      animationIntensity: "normal",
      hideHpPePanelBackground: false,
      logoScale: 100,
      sheetNameOutlineSize: 2.5,
    },
  },
  {
    id: "profano",
    name: "Profano",
    tagline: "Abissal · Vermelho · Preto",
    description:
      "Preto absoluto cortado por carmesim arterial, bordas agudas e contraste extremo.",
    colors: {
      primary: "#b91c1c",
      secondary: "#450a0a",
      accent: "#ef4444",
      background: "#040405",
      panel: "#0f090b",
      textPrimary: "#f2e9ea",
      textSecondary: "#9d888b",
      border: "#4b171d",
      interactive: "#9f1218",
    },
    interfaceStyle: {
      cornerRadius: "none",
      shadowIntensity: "strong",
      panelOpacity: 98,
      density: "normal",
      animationIntensity: "normal",
      hideHpPePanelBackground: false,
      logoScale: 100,
      sheetNameOutlineSize: 2.5,
    },
  },
] as const;

export function sanitizeRoomKey(roomId: string | null | undefined): string {
  const cleaned = String(roomId || "default-table")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);
  return cleaned || "default-table";
}

export function getTabletopThemeRecordId(roomId: string | null | undefined): string {
  return `${TABLETOP_THEME_RECORD_PREFIX}${sanitizeRoomKey(roomId)}`;
}

export function getTabletopThemeLocalKey(roomId: string | null | undefined): string {
  return `${TABLETOP_THEME_LOCAL_CACHE_PREFIX}${sanitizeRoomKey(roomId)}`;
}

export function getTabletopPresetsLocalKey(roomId: string | null | undefined): string {
  return `${TABLETOP_PRESETS_LOCAL_CACHE_PREFIX}${sanitizeRoomKey(roomId)}`;
}

export function createDefaultTabletopCustomization(
  roomId: string = "default-table",
  updatedAt: number = 0,
): TabletopCustomizationConfig {
  return {
    version: 1,
    roomId: sanitizeRoomKey(roomId),
    presetId: "demologia",
    branding: { ...DEMOLOGIA_ORIGINAL_BRANDING },
    background: { ...DEMOLOGIA_ORIGINAL_BACKGROUND },
    colors: { ...DEMOLOGIA_ORIGINAL_COLORS },
    interfaceStyle: { ...DEMOLOGIA_ORIGINAL_INTERFACE },
    updatedAt,
  };
}

/**
 * Valida e normaliza um código HEX para o formato "#rrggbb".
 * Aceita "#RGB" (expande para 6 dígitos) e "#RRGGBB" (com ou sem "#").
 */
export function normalizeHexColor(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const expanded = trimmed
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return fallback;
}

export function isValidHexInput(value: string): boolean {
  const trimmed = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{3}$/.test(trimmed) || /^[0-9a-fA-F]{6}$/.test(trimmed);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex, "#0b0b0d").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  return `rgba(${r}, ${g}, ${b}, ${Number(clamped.toFixed(3))})`;
}

export function adjustHexBrightness(hex: string, delta: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${toHex(r + delta)}${toHex(g + delta)}${toHex(b + delta)}`;
}

/**
 * Calcula cor de texto com contraste legível (WCAG) sobre qualquer fundo HEX.
 */
export function getContrastTextColor(hex: string): "#09090b" | "#ffffff" {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#09090b" : "#ffffff";
}

/**
 * Sanitiza URLs de imagem personalizadas (HTTPS/HTTP, caminho relativo ou data:image segura).
 * Bloqueia protocolos perigosos como javascript:, vbscript:, data:text/html, etc.
 */
export function sanitizeCustomImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2_500_000) return "";

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html")
  ) {
    return "";
  }

  if (lower.startsWith("data:image/")) {
    const allowedDataPrefixes = [
      "data:image/png;",
      "data:image/jpeg;",
      "data:image/jpg;",
      "data:image/webp;",
      "data:image/gif;",
      "data:image/svg+xml;",
    ];
    if (!allowedDataPrefixes.some((p) => lower.startsWith(p))) {
      return "";
    }
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

/**
 * Sanitiza conteúdo textual de SVG antes de upload ou conversão inline,
 * removendo scripts, handlers inline (on*), foreignObject e links javascript:.
 */
export function sanitizeSvgContent(svgText: string): string {
  if (typeof svgText !== "string") return "";
  let cleaned = svgText.trim();
  if (!cleaned.toLowerCase().includes("<svg")) return "";

  // Remove blocos <script> e <foreignObject>
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*\/?>/gi, "");

  // Remove atributos de evento inline (onload=, onclick=, etc.)
  cleaned = cleaned.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    "",
  );

  // Neutraliza href/xlink:href com javascript: ou vbscript: ou data:text/html
  cleaned = cleaned.replace(
    /\s+(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi,
    "",
  );

  return cleaned;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|svg)$/i;

export function validateCustomBrandImageFile(
  file: Pick<File, "name" | "type" | "size">,
): { ok: true; isSvg: boolean; mimeType: string } | { ok: false; error: string } {
  const name = (file.name || "").trim();
  const type = (file.type || "").toLowerCase().trim();
  const isSvg = type === "image/svg+xml" || /\.svg$/i.test(name);

  const hasAllowedMime = type ? ALLOWED_IMAGE_MIME_TYPES.has(type) : false;
  const hasAllowedExt = ALLOWED_IMAGE_EXTENSIONS.test(name);

  if (!hasAllowedMime && !hasAllowedExt) {
    return {
      ok: false,
      error: "Formato não suportado. Use PNG, JPG, JPEG, WebP ou SVG.",
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: "O arquivo selecionado está vazio." };
  }

  if (file.size > MAX_CUSTOM_BRAND_IMAGE_BYTES) {
    return {
      ok: false,
      error: "A imagem excede o limite de 5 MB. Use um arquivo mais leve.",
    };
  }

  const mimeType =
    type && ALLOWED_IMAGE_MIME_TYPES.has(type)
      ? type
      : isSvg
        ? "image/svg+xml"
        : /\.webp$/i.test(name)
          ? "image/webp"
          : /\.jpe?g$/i.test(name)
            ? "image/jpeg"
            : "image/png";

  return { ok: true, isSvg, mimeType };
}

function clampPanelOpacity(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return DEMOLOGIA_ORIGINAL_INTERFACE.panelOpacity;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function clampLogoScale(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return DEMOLOGIA_ORIGINAL_INTERFACE.logoScale;
  return Math.max(50, Math.min(180, Math.round(num)));
}

export function clampSheetNameOutlineSize(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return DEMOLOGIA_ORIGINAL_INTERFACE.sheetNameOutlineSize;
  const clamped = Math.max(0, Math.min(10, num));
  return Math.round(clamped * 2) / 2;
}

function normalizeCornerRadius(val: unknown): TabletopCornerRadius {
  return val === "subtle" || val === "medium" || val === "rounded"
    ? val
    : "none";
}

function normalizeShadowIntensity(val: unknown): TabletopShadowIntensity {
  return val === "none" || val === "subtle" || val === "strong"
    ? val
    : "medium";
}

function normalizeDensity(val: unknown): TabletopInterfaceDensity {
  return val === "compact" || val === "comfortable" ? val : "normal";
}

function normalizeAnimationIntensity(val: unknown): TabletopAnimationIntensity {
  return val === "reduced" || val === "expressive" ? val : "normal";
}

function normalizePresetId(val: unknown): TabletopThemePresetId {
  return val === "nirvana" || val === "profano" || val === "custom"
    ? val
    : "demologia";
}

function sanitizeTextField(val: unknown, maxLength: number): string {
  if (typeof val !== "string") return "";
  return val.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function clampBackgroundOverlayOpacity(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return DEMOLOGIA_ORIGINAL_BACKGROUND.overlayOpacity;
  return Math.max(0, Math.min(90, Math.round(num)));
}

export function detectCustomBackgroundMediaType(
  url: string,
): TabletopBackgroundMediaType {
  const trimmed = (url || "").trim().toLowerCase();
  if (!trimmed) return "default";
  if (trimmed.startsWith("data:image/gif;") || /\.gif(?:[?#]|$)/i.test(trimmed)) {
    return "gif";
  }
  if (
    trimmed.startsWith("data:video/") ||
    /\.(mp4|webm|ogg|mov)(?:[?#]|$)/i.test(trimmed)
  ) {
    return "video";
  }
  return "image";
}

function normalizeBackgroundMediaType(
  rawType: unknown,
  url: string,
): TabletopBackgroundMediaType {
  if (!url) return "default";
  if (rawType === "image" || rawType === "gif" || rawType === "video") {
    return rawType;
  }
  return detectCustomBackgroundMediaType(url);
}

export function normalizeTabletopCustomization(
  raw: unknown,
  roomId: string = "default-table",
): TabletopCustomizationConfig {
  const safeRoom = sanitizeRoomKey(roomId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createDefaultTabletopCustomization(safeRoom, 0);
  }

  const input = raw as Partial<TabletopCustomizationConfig>;
  const rawBranding = (input.branding || {}) as Partial<TabletopBrandingConfig>;
  const rawBg = (input.background || {}) as Partial<TabletopBackgroundConfig>;
  const rawColors = (input.colors || {}) as Partial<TabletopColorsConfig>;
  const rawInterface = (input.interfaceStyle || {}) as Partial<TabletopInterfaceStyleConfig>;

  const branding: TabletopBrandingConfig = {
    primaryLogoUrl: sanitizeCustomImageUrl(rawBranding.primaryLogoUrl),
    secondaryLogoUrl: sanitizeCustomImageUrl(rawBranding.secondaryLogoUrl),
    headerTitle: sanitizeTextField(rawBranding.headerTitle, 48),
    seasonSubtitle: sanitizeTextField(rawBranding.seasonSubtitle, 72),
    campaignIconUrl: sanitizeCustomImageUrl(rawBranding.campaignIconUrl),
  };

  const safeBgUrl = sanitizeCustomImageUrl(rawBg.url);
  const background: TabletopBackgroundConfig = {
    url: safeBgUrl,
    mediaType: normalizeBackgroundMediaType(rawBg.mediaType, safeBgUrl),
    overlayOpacity: clampBackgroundOverlayOpacity(rawBg.overlayOpacity),
  };

  const colors: TabletopColorsConfig = {
    primary: normalizeHexColor(rawColors.primary, DEMOLOGIA_ORIGINAL_COLORS.primary),
    secondary: normalizeHexColor(rawColors.secondary, DEMOLOGIA_ORIGINAL_COLORS.secondary),
    accent: normalizeHexColor(rawColors.accent, DEMOLOGIA_ORIGINAL_COLORS.accent),
    background: normalizeHexColor(rawColors.background, DEMOLOGIA_ORIGINAL_COLORS.background),
    panel: normalizeHexColor(rawColors.panel, DEMOLOGIA_ORIGINAL_COLORS.panel),
    textPrimary: normalizeHexColor(rawColors.textPrimary, DEMOLOGIA_ORIGINAL_COLORS.textPrimary),
    textSecondary: normalizeHexColor(rawColors.textSecondary, DEMOLOGIA_ORIGINAL_COLORS.textSecondary),
    border: normalizeHexColor(rawColors.border, DEMOLOGIA_ORIGINAL_COLORS.border),
    interactive: normalizeHexColor(rawColors.interactive, DEMOLOGIA_ORIGINAL_COLORS.interactive),
  };

  const interfaceStyle: TabletopInterfaceStyleConfig = {
    cornerRadius: normalizeCornerRadius(rawInterface.cornerRadius),
    shadowIntensity: normalizeShadowIntensity(rawInterface.shadowIntensity),
    panelOpacity: clampPanelOpacity(rawInterface.panelOpacity),
    density: normalizeDensity(rawInterface.density),
    animationIntensity: normalizeAnimationIntensity(rawInterface.animationIntensity),
    hideHpPePanelBackground: Boolean(rawInterface.hideHpPePanelBackground),
    logoScale: clampLogoScale(rawInterface.logoScale),
    sheetNameOutlineSize: clampSheetNameOutlineSize(rawInterface.sheetNameOutlineSize),
  };

  const updatedAt =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt) && input.updatedAt >= 0
      ? Math.floor(input.updatedAt)
      : 0;

  return {
    version: 1,
    roomId: sanitizeRoomKey(input.roomId || safeRoom),
    presetId: normalizePresetId(input.presetId),
    branding,
    background,
    colors,
    interfaceStyle,
    updatedAt,
  };
}

export function applyPresetToConfig(
  current: TabletopCustomizationConfig,
  presetId: Exclude<TabletopThemePresetId, "custom">,
): TabletopCustomizationConfig {
  const preset =
    TABLETOP_THEME_PRESETS.find((p) => p.id === presetId) ||
    TABLETOP_THEME_PRESETS[0];

  return {
    ...current,
    presetId: preset.id,
    colors: { ...preset.colors },
    interfaceStyle: {
      ...preset.interfaceStyle,
      hideHpPePanelBackground: current.interfaceStyle.hideHpPePanelBackground,
      logoScale: current.interfaceStyle.logoScale,
      sheetNameOutlineSize: current.interfaceStyle.sheetNameOutlineSize,
    },
  };
}

export function detectMatchingPresetId(
  colors: TabletopColorsConfig,
  interfaceStyle: TabletopInterfaceStyleConfig,
): TabletopThemePresetId {
  for (const preset of TABLETOP_THEME_PRESETS) {
    const colorsMatch = (
      Object.keys(preset.colors) as Array<keyof TabletopColorsConfig>
    ).every(
      (k) =>
        normalizeHexColor(colors[k], preset.colors[k]) ===
        preset.colors[k].toLowerCase(),
    );

    const styleMatch =
      interfaceStyle.cornerRadius === preset.interfaceStyle.cornerRadius &&
      interfaceStyle.shadowIntensity === preset.interfaceStyle.shadowIntensity &&
      interfaceStyle.panelOpacity === preset.interfaceStyle.panelOpacity &&
      interfaceStyle.density === preset.interfaceStyle.density &&
      interfaceStyle.animationIntensity === preset.interfaceStyle.animationIntensity;

    if (colorsMatch && styleMatch) {
      return preset.id;
    }
  }
  return "custom";
}

/**
 * Retorna true somente quando nenhuma customização visual está ativa
 * (aparência 100% original do Demologia).
 */
export function isDefaultTabletopCustomization(
  config: TabletopCustomizationConfig,
): boolean {
  const b = config.branding;
  const hasBranding = Boolean(
    b.primaryLogoUrl ||
      b.secondaryLogoUrl ||
      b.headerTitle ||
      b.seasonSubtitle ||
      b.campaignIconUrl,
  );
  if (hasBranding) return false;
  if (config.background?.url) return false;
  if (config.interfaceStyle.hideHpPePanelBackground) return false;
  if (
    clampLogoScale(config.interfaceStyle.logoScale) !==
    DEMOLOGIA_ORIGINAL_INTERFACE.logoScale
  ) {
    return false;
  }
  if (
    clampSheetNameOutlineSize(config.interfaceStyle.sheetNameOutlineSize) !==
    DEMOLOGIA_ORIGINAL_INTERFACE.sheetNameOutlineSize
  ) {
    return false;
  }

  const matchedPreset = detectMatchingPresetId(
    config.colors,
    config.interfaceStyle,
  );
  return matchedPreset === "demologia";
}

export function areTabletopCustomizationsEqual(
  a: TabletopCustomizationConfig,
  b: TabletopCustomizationConfig,
): boolean {
  return (
    a.presetId === b.presetId &&
    a.branding.primaryLogoUrl === b.branding.primaryLogoUrl &&
    a.branding.secondaryLogoUrl === b.branding.secondaryLogoUrl &&
    a.branding.headerTitle === b.branding.headerTitle &&
    a.branding.seasonSubtitle === b.branding.seasonSubtitle &&
    a.branding.campaignIconUrl === b.branding.campaignIconUrl &&
    (a.background?.url || "") === (b.background?.url || "") &&
    (a.background?.mediaType || "default") === (b.background?.mediaType || "default") &&
    (a.background?.overlayOpacity ?? DEMOLOGIA_ORIGINAL_BACKGROUND.overlayOpacity) ===
      (b.background?.overlayOpacity ?? DEMOLOGIA_ORIGINAL_BACKGROUND.overlayOpacity) &&
    a.colors.primary === b.colors.primary &&
    a.colors.secondary === b.colors.secondary &&
    a.colors.accent === b.colors.accent &&
    a.colors.background === b.colors.background &&
    a.colors.panel === b.colors.panel &&
    a.colors.textPrimary === b.colors.textPrimary &&
    a.colors.textSecondary === b.colors.textSecondary &&
    a.colors.border === b.colors.border &&
    a.colors.interactive === b.colors.interactive &&
    a.interfaceStyle.cornerRadius === b.interfaceStyle.cornerRadius &&
    a.interfaceStyle.shadowIntensity === b.interfaceStyle.shadowIntensity &&
    a.interfaceStyle.panelOpacity === b.interfaceStyle.panelOpacity &&
    a.interfaceStyle.density === b.interfaceStyle.density &&
    a.interfaceStyle.animationIntensity === b.interfaceStyle.animationIntensity &&
    Boolean(a.interfaceStyle.hideHpPePanelBackground) ===
      Boolean(b.interfaceStyle.hideHpPePanelBackground) &&
    clampLogoScale(a.interfaceStyle.logoScale) ===
      clampLogoScale(b.interfaceStyle.logoScale) &&
    clampSheetNameOutlineSize(a.interfaceStyle.sheetNameOutlineSize) ===
      clampSheetNameOutlineSize(b.interfaceStyle.sheetNameOutlineSize)
  );
}

export function normalizeCustomPreset(raw: unknown): TabletopCustomPreset | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, any>;
  const name = sanitizeTextField(obj.name, 48);
  if (!name) return null;

  const rawId =
    typeof obj.id === "string"
      ? obj.id.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64)
      : "";
  const id =
    rawId ||
    `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const normalizedConfig = normalizeTabletopCustomization(
    {
      branding: obj.branding,
      background: obj.background,
      colors: obj.colors,
      interfaceStyle: obj.interfaceStyle,
      presetId: "custom",
    },
    "default-table",
  );

  const createdAt =
    typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt) && obj.createdAt >= 0
      ? Math.floor(obj.createdAt)
      : 0;
  const updatedAt =
    typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt) && obj.updatedAt >= 0
      ? Math.floor(obj.updatedAt)
      : createdAt;

  return {
    id,
    name,
    branding: { ...normalizedConfig.branding },
    background: { ...normalizedConfig.background },
    colors: { ...normalizedConfig.colors },
    interfaceStyle: { ...normalizedConfig.interfaceStyle },
    createdAt,
    updatedAt,
  };
}

export function normalizeSavedCustomPresets(raw: unknown): TabletopCustomPreset[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, TabletopCustomPreset>();
  for (const item of raw) {
    const normalized = normalizeCustomPreset(item);
    if (!normalized) continue;
    byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values())
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
    .slice(0, MAX_SAVED_CUSTOM_PRESETS);
}

export function createCustomPresetFromConfig(
  name: string,
  config: TabletopCustomizationConfig,
  existingId?: string,
  now: number = Date.now(),
): TabletopCustomPreset | null {
  const cleanName = sanitizeTextField(name, 48);
  if (!cleanName) return null;
  const normalizedConfig = normalizeTabletopCustomization(config, config.roomId);
  const safeId =
    existingId && existingId.trim()
      ? existingId.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64)
      : `preset_${now}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: safeId,
    name: cleanName,
    branding: { ...normalizedConfig.branding },
    background: { ...normalizedConfig.background },
    colors: { ...normalizedConfig.colors },
    interfaceStyle: { ...normalizedConfig.interfaceStyle },
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertSavedCustomPreset(
  list: TabletopCustomPreset[],
  preset: TabletopCustomPreset,
): TabletopCustomPreset[] {
  const existing = list.find((item) => item.id === preset.id);
  const merged: TabletopCustomPreset = existing
    ? { ...preset, createdAt: existing.createdAt || preset.createdAt }
    : preset;
  const rest = list.filter((item) => item.id !== preset.id);
  return normalizeSavedCustomPresets([merged, ...rest]);
}

export function deleteSavedCustomPreset(
  list: TabletopCustomPreset[],
  presetId: string,
): TabletopCustomPreset[] {
  return list.filter((item) => item.id !== presetId);
}

export function applyCustomPresetToConfig(
  current: TabletopCustomizationConfig,
  preset: TabletopCustomPreset,
): TabletopCustomizationConfig {
  const normalizedPreset = normalizeCustomPreset(preset);
  if (!normalizedPreset) return current;
  return {
    ...current,
    presetId: "custom",
    branding: { ...normalizedPreset.branding },
    background: { ...normalizedPreset.background },
    colors: { ...normalizedPreset.colors },
    interfaceStyle: { ...normalizedPreset.interfaceStyle },
  };
}

export function matchesCustomPreset(
  config: TabletopCustomizationConfig,
  preset: TabletopCustomPreset,
): boolean {
  const asConfig: TabletopCustomizationConfig = {
    version: 1,
    roomId: config.roomId,
    presetId: config.presetId,
    branding: preset.branding,
    background: preset.background,
    colors: preset.colors,
    interfaceStyle: preset.interfaceStyle,
    updatedAt: config.updatedAt,
  };
  return areTabletopCustomizationsEqual(config, asConfig);
}

export function resolveCustomizationForAppearanceAction(
  action: "preset" | "reset",
  presetId: string | undefined,
  savedPresets: TabletopCustomPreset[],
  roomId: string = "default-table",
  now: number = Date.now(),
): { config: TabletopCustomizationConfig; clearSceneBackground: boolean } | null {
  const baseDefault = createDefaultTabletopCustomization(roomId, now);

  if (action === "reset" || presetId === "demologia") {
    return { config: baseDefault, clearSceneBackground: true };
  }

  if (presetId === "nirvana" || presetId === "profano") {
    return {
      config: applyPresetToConfig(baseDefault, presetId),
      clearSceneBackground: true,
    };
  }

  if (!presetId) return null;
  const customPreset = savedPresets.find((p) => p.id === presetId);
  if (!customPreset) return null;

  const applied = applyCustomPresetToConfig(baseDefault, customPreset);
  return {
    config: applied,
    clearSceneBackground: true,
  };
}

export function resolveEffectiveBranding(config: TabletopCustomizationConfig) {
  const primaryLogo = config.branding.primaryLogoUrl || DEMOLOGIA_LOGO_URL;
  const secondaryLogo =
    config.branding.secondaryLogoUrl ||
    config.branding.primaryLogoUrl ||
    DEMOLOGIA_LOGO_URL;
  const headerTitle = config.branding.headerTitle || DEFAULT_HEADER_TITLE;
  const seasonSubtitle = config.branding.seasonSubtitle || "";
  const campaignIcon = config.branding.campaignIconUrl || "";

  return {
    primaryLogo,
    secondaryLogo,
    headerTitle,
    seasonSubtitle,
    campaignIcon,
  };
}

export const CORNER_RADIUS_PX: Record<TabletopCornerRadius, string> = {
  none: "0px",
  subtle: "4px",
  medium: "8px",
  rounded: "12px",
};

export const SHADOW_TOKENS: Record<
  TabletopShadowIntensity,
  { panel: string; elevated: string }
> = {
  none: {
    panel: "none",
    elevated: "none",
  },
  subtle: {
    panel: "0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    elevated: "0 8px 20px rgba(0, 0, 0, 0.4)",
  },
  medium: {
    panel: "0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    elevated: "0 16px 40px rgba(0, 0, 0, 0.75)",
  },
  strong: {
    panel: "0 14px 36px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    elevated: "0 24px 56px rgba(0, 0, 0, 0.9)",
  },
};

export const ANIMATION_TIMING_TOKENS: Record<
  TabletopAnimationIntensity,
  { fast: string; base: string }
> = {
  reduced: {
    fast: "0ms linear",
    base: "0ms linear",
  },
  normal: {
    fast: "140ms cubic-bezier(0.16, 1, 0.3, 1)",
    base: "220ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
  expressive: {
    fast: "220ms cubic-bezier(0.22, 1, 0.36, 1)",
    base: "340ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
};

/**
 * Gera o mapa completo de variáveis CSS aplicadas no `:root` quando há customização ativa.
 */
export function buildThemeCssVariables(
  config: TabletopCustomizationConfig,
): Record<string, string> {
  const c = config.colors;
  const ui = config.interfaceStyle;
  const panelOpacityPct = clampPanelOpacity(ui.panelOpacity);
  const panelAlpha = panelOpacityPct / 100;
  const radius = CORNER_RADIUS_PX[ui.cornerRadius];
  const shadows = SHADOW_TOKENS[ui.shadowIntensity];
  const timings = ANIMATION_TIMING_TOKENS[ui.animationIntensity];
  const logoScaleRatio = Number((clampLogoScale(ui.logoScale) / 100).toFixed(2));
  const outlineSize = clampSheetNameOutlineSize(ui.sheetNameOutlineSize);
  const outlineShadow = Number((outlineSize * 0.6).toFixed(2));

  const panelLight = adjustHexBrightness(c.panel, 10);
  const bgSecondary = adjustHexBrightness(c.background, 7);
  const borderLight = adjustHexBrightness(c.border, 18);
  const interactiveHover = adjustHexBrightness(c.interactive, 20);
  const sidebarBg = adjustHexBrightness(c.background, 4);
  const headerAlpha =
    panelAlpha === 0 ? 0 : Math.min(0.99, panelAlpha + 0.04);
  const effectivePanelShadow = panelAlpha === 0 ? "none" : shadows.panel;

  return {
    "--op-bg": c.background,
    "--op-bg-secondary": bgSecondary,
    "--op-panel": c.panel,
    "--op-panel-light": panelLight,
    "--op-border": c.border,
    "--op-border-light": borderLight,
    "--op-text": c.textPrimary,
    "--op-text-secondary": c.textSecondary,
    "--op-text-muted": hexToRgba(c.textSecondary, 0.72),
    "--op-red": c.primary,
    "--op-red-dark": c.secondary,
    "--op-red-bright": c.accent,
    "--op-blood": c.secondary,
    "--op-white": c.textPrimary,
    "--op-sidebar-bg": sidebarBg,
    "--op-sidebar-border": c.border,
    "--op-sidebar-active": hexToRgba(c.primary, 0.2),
    "--op-sidebar-indicator": c.accent,
    "--bg-dark": c.background,
    "--text-light": c.textPrimary,
    "--shadow-panel": effectivePanelShadow,
    "--shadow-elevated": shadows.elevated,
    "--transition-fast": timings.fast,
    "--transition-base": timings.base,
    "--ct-primary": c.primary,
    "--ct-primary-soft": hexToRgba(c.primary, 0.16),
    "--ct-primary-glow": hexToRgba(c.accent, 0.42),
    "--ct-secondary": c.secondary,
    "--ct-accent": c.accent,
    "--ct-bg": c.background,
    "--ct-panel": c.panel,
    "--ct-panel-rgba": hexToRgba(c.panel, panelAlpha),
    "--ct-panel-header-rgba": hexToRgba(sidebarBg, headerAlpha),
    "--ct-panel-border-rgba": hexToRgba(c.border, panelAlpha),
    "--ct-panel-light": panelLight,
    "--ct-text": c.textPrimary,
    "--ct-text-secondary": c.textSecondary,
    "--ct-border": c.border,
    "--ct-border-light": borderLight,
    "--ct-interactive": c.interactive,
    "--ct-interactive-hover": interactiveHover,
    "--ct-interactive-text": getContrastTextColor(c.interactive),
    "--ct-radius": radius,
    "--ct-shadow-panel": effectivePanelShadow,
    "--ct-shadow-elevated": shadows.elevated,
    "--ct-logo-scale": String(logoScaleRatio),
    "--ct-name-outline": `${outlineSize}px`,
    "--ct-name-outline-shadow": `${outlineShadow}px`,
  };
}

export const MANAGED_THEME_CSS_KEYS: readonly string[] = Object.keys(
  buildThemeCssVariables(createDefaultTabletopCustomization()),
);

/**
 * Aplica (ou remove, se estiver no padrão Demologia Original) as variáveis CSS
 * e atributos visuais no documento inteiro.
 */
export function applyTabletopCustomizationToDom(
  config: TabletopCustomizationConfig,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDefault = isDefaultTabletopCustomization(config);

  if (isDefault) {
    root.removeAttribute("data-custom-theme");
    root.removeAttribute("data-ct-density");
    root.removeAttribute("data-ct-motion");
    root.removeAttribute("data-ct-radius");
    root.removeAttribute("data-ct-shadow");
    root.removeAttribute("data-ct-hide-hud-panel");
    root.removeAttribute("data-ct-logo-scale");
    root.removeAttribute("data-ct-name-outline");
    root.removeAttribute("data-ct-panels-transparent");
    for (const key of MANAGED_THEME_CSS_KEYS) {
      root.style.removeProperty(key);
    }
    document.title = `${DEFAULT_HEADER_TITLE} ~ Hub`;
    const customFavicon = document.querySelector<HTMLLinkElement>(
      'link[data-demologia-custom-favicon="true"]',
    );
    if (customFavicon) {
      customFavicon.remove();
    }
    return;
  }

  // Aplica somente os overrides de paleta/tema se paleta/interface forem diferentes de Demologia Original
  const hasThemeStyleOverrides =
    detectMatchingPresetId(config.colors, config.interfaceStyle) !== "demologia";

  if (hasThemeStyleOverrides) {
    const vars = buildThemeCssVariables(config);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.setAttribute("data-custom-theme", "true");
    root.setAttribute("data-ct-density", config.interfaceStyle.density);
    root.setAttribute("data-ct-motion", config.interfaceStyle.animationIntensity);
    root.setAttribute("data-ct-radius", config.interfaceStyle.cornerRadius);
    root.setAttribute("data-ct-shadow", config.interfaceStyle.shadowIntensity);
  } else {
    root.removeAttribute("data-custom-theme");
    root.removeAttribute("data-ct-density");
    root.removeAttribute("data-ct-motion");
    root.removeAttribute("data-ct-radius");
    root.removeAttribute("data-ct-shadow");
    for (const key of MANAGED_THEME_CSS_KEYS) {
      root.style.removeProperty(key);
    }
  }

  // Transparência dos painéis (0 = 100% transparente / painéis invisíveis)
  const panelOpacityPct = clampPanelOpacity(config.interfaceStyle.panelOpacity);
  if (panelOpacityPct === 0) {
    root.setAttribute("data-ct-panels-transparent", "full");
  } else if (panelOpacityPct < 100) {
    root.setAttribute("data-ct-panels-transparent", "partial");
  } else {
    root.removeAttribute("data-ct-panels-transparent");
  }

  if (config.interfaceStyle.hideHpPePanelBackground) {
    root.setAttribute("data-ct-hide-hud-panel", "true");
  } else {
    root.removeAttribute("data-ct-hide-hud-panel");
  }

  // Tamanho da logo (aplicável independentemente da paleta)
  const logoScale = clampLogoScale(config.interfaceStyle.logoScale);
  if (logoScale !== DEMOLOGIA_ORIGINAL_INTERFACE.logoScale) {
    root.style.setProperty("--ct-logo-scale", String(Number((logoScale / 100).toFixed(2))));
    root.setAttribute("data-ct-logo-scale", "custom");
  } else {
    root.removeAttribute("data-ct-logo-scale");
    if (!hasThemeStyleOverrides) {
      root.style.removeProperty("--ct-logo-scale");
    }
  }

  // Tamanho da outline do nome da ficha (aplicável independentemente da paleta)
  const outlineSize = clampSheetNameOutlineSize(config.interfaceStyle.sheetNameOutlineSize);
  if (outlineSize !== DEMOLOGIA_ORIGINAL_INTERFACE.sheetNameOutlineSize) {
    root.style.setProperty("--ct-name-outline", `${outlineSize}px`);
    root.style.setProperty(
      "--ct-name-outline-shadow",
      `${Number((outlineSize * 0.6).toFixed(2))}px`,
    );
    root.setAttribute("data-ct-name-outline", outlineSize === 0 ? "none" : "custom");
  } else {
    root.removeAttribute("data-ct-name-outline");
    if (!hasThemeStyleOverrides) {
      root.style.removeProperty("--ct-name-outline");
      root.style.removeProperty("--ct-name-outline-shadow");
    }
  }

  const effective = resolveEffectiveBranding(config);
  document.title = effective.seasonSubtitle
    ? `${effective.headerTitle} — ${effective.seasonSubtitle}`
    : `${effective.headerTitle} ~ Hub`;

  // Atualiza favicon dinâmico quando há ícone da campanha
  let faviconLink = document.querySelector<HTMLLinkElement>(
    'link[data-demologia-custom-favicon="true"]',
  );
  if (effective.campaignIcon) {
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      faviconLink.setAttribute("data-demologia-custom-favicon", "true");
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = effective.campaignIcon;
  } else if (faviconLink) {
    faviconLink.remove();
  }
}
