import type {
  BackgroundActionMode,
  BackgroundMediaType,
  BackgroundSourceType,
  BlackoutEasingDirection,
  BlackoutEasingStyle,
  SceneBackgroundPayload,
  SceneBuilderNode,
  SceneBuilderNodeParams,
  SceneNodeType,
} from "../types/sceneDirector";

export interface SceneNodeCategoryMeta {
  type: SceneNodeType;
  label: string;
  shortLabel: string;
  description: string;
  barBgClass: string;
  barBorderClass: string;
  barHoverClass: string;
  accentTextClass: string;
  trackBlockBgClass: string;
  trackBlockBorderClass: string;
  defaultDurationSec: number;
}

export const SCENE_NODE_TYPE_ORDER: readonly SceneNodeType[] = [
  "ost",
  "sfx",
  "mode",
  "clock",
  "handout",
  "delay",
  "fade",
  "blackout",
  "background",
];

export const SCENE_NODE_CATALOG: Record<SceneNodeType, SceneNodeCategoryMeta> = {
  ost: {
    type: "ost",
    label: "OST / TRILHA",
    shortLabel: "OST",
    description: "Inicia, troca ou para a trilha sonora da mesa.",
    barBgClass: "bg-[#26090d]",
    barBorderClass: "border-[#991b1b]/80",
    barHoverClass: "hover:bg-[#350d13] hover:border-[#dc2626]",
    accentTextClass: "text-[#ff8a90]",
    trackBlockBgClass: "bg-[#2a0a0f]/95",
    trackBlockBorderClass: "border-[#b91c1c]/80",
    defaultDurationSec: 2.5,
  },
  sfx: {
    type: "sfx",
    label: "SOUND BOARD",
    shortLabel: "SFX",
    description: "Dispara efeito sonoro pontual sem interromper a OST.",
    barBgClass: "bg-[#241307]",
    barBorderClass: "border-[#b45309]/80",
    barHoverClass: "hover:bg-[#331b0a] hover:border-[#f59e0b]",
    accentTextClass: "text-amber-300",
    trackBlockBgClass: "bg-[#2a1608]/95",
    trackBlockBorderClass: "border-[#d97706]/80",
    defaultDurationSec: 1.8,
  },
  mode: {
    type: "mode",
    label: "MODO DE JOGO",
    shortLabel: "MODO",
    description: "Alterna a mesa entre Demologia e Real L.",
    barBgClass: "bg-[#1a0d26]",
    barBorderClass: "border-[#7e22ce]/80",
    barHoverClass: "hover:bg-[#261338] hover:border-[#a855f7]",
    accentTextClass: "text-purple-300",
    trackBlockBgClass: "bg-[#1f0f2e]/95",
    trackBlockBorderClass: "border-[#9333ea]/80",
    defaultDurationSec: 1.5,
  },
  clock: {
    type: "clock",
    label: "RELÓGIO",
    shortLabel: "RELÓGIO",
    description: "Avança, revela, oculta ou zera um Relógio de Tensão.",
    barBgClass: "bg-[#201908]",
    barBorderClass: "border-[#a16207]/80",
    barHoverClass: "hover:bg-[#2e240b] hover:border-[#eab308]",
    accentTextClass: "text-yellow-300",
    trackBlockBgClass: "bg-[#261e09]/95",
    trackBlockBorderClass: "border-[#ca8a04]/80",
    defaultDurationSec: 2.0,
  },
  handout: {
    type: "handout",
    label: "HANDOUT",
    shortLabel: "HANDOUT",
    description: "Libera um documento ou segredo da mesa aos jogadores.",
    barBgClass: "bg-[#0c1826]",
    barBorderClass: "border-[#1d4ed8]/80",
    barHoverClass: "hover:bg-[#122438] hover:border-[#3b82f6]",
    accentTextClass: "text-sky-300",
    trackBlockBgClass: "bg-[#0e1c2e]/95",
    trackBlockBorderClass: "border-[#2563eb]/80",
    defaultDurationSec: 2.0,
  },
  delay: {
    type: "delay",
    label: "ESPERA / DELAY",
    shortLabel: "DELAY",
    description: "Marca pausa dramática na sequência da cena.",
    barBgClass: "bg-[#16171f]",
    barBorderClass: "border-[#525264]/80",
    barHoverClass: "hover:bg-[#1f202c] hover:border-[#8c8ea3]",
    accentTextClass: "text-zinc-300",
    trackBlockBgClass: "bg-[#191a24]/95",
    trackBlockBorderClass: "border-[#63647a]/80",
    defaultDurationSec: 2.0,
  },
  fade: {
    type: "fade",
    label: "PENUMBRA",
    shortLabel: "PENUMBRA",
    description: "Escurece parcialmente a tela em penumbra sincronizada.",
    barBgClass: "bg-[#0c1d1c]",
    barBorderClass: "border-[#0f766e]/80",
    barHoverClass: "hover:bg-[#122b29] hover:border-[#14b8a6]",
    accentTextClass: "text-teal-300",
    trackBlockBgClass: "bg-[#0e2221]/95",
    trackBlockBorderClass: "border-[#0d9488]/80",
    defaultDurationSec: 2.5,
  },
  blackout: {
    type: "blackout",
    label: "BLACKOUT",
    shortLabel: "BLACKOUT",
    description:
      "Escurece totalmente a tela com Fade In, Duração, Fade Out e curva de aceleração.",
    barBgClass: "bg-[#111118]",
    barBorderClass: "border-[#9ca3af]/75",
    barHoverClass: "hover:bg-[#1a1a24] hover:border-white",
    accentTextClass: "text-zinc-100",
    trackBlockBgClass: "bg-[#12121a]/95",
    trackBlockBorderClass: "border-[#a1a1aa]/80",
    defaultDurationSec: 4.0,
  },
  background: {
    type: "background",
    label: "MUDAR FUNDO",
    shortLabel: "FUNDO",
    description:
      "Altera o fundo da mesa (imagem, GIF ou MP4 em loop) por link/upload ou restaura o Default do modo.",
    barBgClass: "bg-[#101324]",
    barBorderClass: "border-[#4f46e5]/80",
    barHoverClass: "hover:bg-[#171b33] hover:border-[#818cf8]",
    accentTextClass: "text-indigo-300",
    trackBlockBgClass: "bg-[#12162b]/95",
    trackBlockBorderClass: "border-[#6366f1]/80",
    defaultDurationSec: 1.5,
  },
};

const VALID_NODE_TYPES = new Set<SceneNodeType>(SCENE_NODE_TYPE_ORDER);
export const MAX_TIMELINE_SECONDS = 300;
export const MAX_SCENE_NODES = 60;

export function roundTenths(val: number): number {
  return Math.round(val * 10) / 10;
}

export function clampStartTimeSec(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return roundTenths(Math.max(0, Math.min(MAX_TIMELINE_SECONDS, num)));
}

export function clampDurationSec(raw: unknown, fallback = 2): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return roundTenths(Math.max(0.5, Math.min(60, num)));
}

export function clampFadeTransitionSec(raw: unknown, fallback = 1): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return roundTenths(Math.max(0, Math.min(30, num)));
}

export function clampBlackoutHoldSec(raw: unknown, fallback = 2): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return roundTenths(Math.max(0, Math.min(60, num)));
}

export function clampOstFadeOutSec(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return roundTenths(Math.min(15, num));
}

const VALID_EASING_STYLES: readonly BlackoutEasingStyle[] = [
  "linear",
  "quad",
  "exponential",
];

const VALID_EASING_DIRECTIONS: readonly BlackoutEasingDirection[] = [
  "in",
  "out",
  "inout",
];

export function normalizeBlackoutEasingStyle(raw: unknown): BlackoutEasingStyle {
  if (
    typeof raw === "string" &&
    VALID_EASING_STYLES.includes(raw as BlackoutEasingStyle)
  ) {
    return raw as BlackoutEasingStyle;
  }
  return "quad";
}

export function normalizeBlackoutEasingDirection(
  raw: unknown,
): BlackoutEasingDirection {
  if (
    typeof raw === "string" &&
    VALID_EASING_DIRECTIONS.includes(raw as BlackoutEasingDirection)
  ) {
    return raw as BlackoutEasingDirection;
  }
  return "inout";
}

export function computeBlackoutTotalSec(params: {
  fadeInSec?: number;
  holdSeconds?: number;
  fadeOutSec?: number;
}): number {
  const fadeIn = clampFadeTransitionSec(params.fadeInSec, 1);
  const hold = clampBlackoutHoldSec(params.holdSeconds, 2);
  const fadeOut = clampFadeTransitionSec(params.fadeOutSec, 1);
  return roundTenths(Math.max(0.5, fadeIn + hold + fadeOut));
}

export function resolveFadeEasingCss(
  style: BlackoutEasingStyle,
  direction: BlackoutEasingDirection,
): string {
  if (style === "linear") return "linear";
  if (style === "quad") {
    if (direction === "in") return "cubic-bezier(0.11, 0, 0.5, 0)";
    if (direction === "out") return "cubic-bezier(0.5, 1, 0.89, 1)";
    return "cubic-bezier(0.45, 0, 0.55, 1)";
  }
  // exponential
  if (direction === "in") return "cubic-bezier(0.7, 0, 0.84, 0)";
  if (direction === "out") return "cubic-bezier(0.16, 1, 0.3, 1)";
  return "cubic-bezier(0.87, 0, 0.13, 1)";
}

export function sampleEasingCurve(
  style: BlackoutEasingStyle,
  direction: BlackoutEasingDirection,
  rawT: number,
): number {
  const t = Math.max(0, Math.min(1, rawT));
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (style === "linear") return t;

  if (style === "quad") {
    if (direction === "in") return t * t;
    if (direction === "out") return 1 - (1 - t) * (1 - t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // exponential
  if (direction === "in") return Math.pow(2, 10 * t - 10);
  if (direction === "out") return 1 - Math.pow(2, -10 * t);
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

export interface SceneFadeCuePayload {
  mode: "dim" | "blackout";
  opacity: number;
  fadeInSec: number;
  holdSeconds: number;
  fadeOutSec: number;
  easingStyle: BlackoutEasingStyle;
  easingDirection: BlackoutEasingDirection;
}

export function normalizeSceneFadeCuePayload(
  raw: unknown,
): SceneFadeCuePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  const mode: "dim" | "blackout" =
    obj.mode === "blackout" || obj.fadeStyle === "blackout" ? "blackout" : "dim";

  if (mode === "blackout") {
    return {
      mode: "blackout",
      opacity: 1,
      fadeInSec: clampFadeTransitionSec(obj.fadeInSec, 1),
      holdSeconds: clampBlackoutHoldSec(obj.holdSeconds, 2),
      fadeOutSec: clampFadeTransitionSec(obj.fadeOutSec, 1),
      easingStyle: normalizeBlackoutEasingStyle(obj.easingStyle),
      easingDirection: normalizeBlackoutEasingDirection(obj.easingDirection),
    };
  }

  const opacity = Number.isFinite(Number(obj.opacity))
    ? Math.max(0.1, Math.min(0.95, Math.round(Number(obj.opacity) * 100) / 100))
    : 0.6;
  return {
    mode: "dim",
    opacity,
    fadeInSec: clampFadeTransitionSec(obj.fadeInSec, 0.7),
    holdSeconds: clampDurationSec(obj.holdSeconds, 2.5),
    fadeOutSec: clampFadeTransitionSec(obj.fadeOutSec, 0.7),
    easingStyle: normalizeBlackoutEasingStyle(obj.easingStyle),
    easingDirection: normalizeBlackoutEasingDirection(obj.easingDirection),
  };
}

export const MAX_BACKGROUND_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_BACKGROUND_DATA_URL_FALLBACK_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const SCENE_BACKGROUND_RECORD_ID = "SCENE_BACKGROUND_STATE";
export const SCENE_BACKGROUND_LOCAL_KEY = "demologia_scene_background_state";

const SAFE_BG_DATA_URL_REGEX =
  /^data:(image\/(?:png|jpeg|jpg|webp|gif|avif)|video\/(?:mp4|webm));base64,/i;

export function sanitizeBackgroundUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (SAFE_BG_DATA_URL_REGEX.test(trimmed)) {
    // Impede payloads base64 excessivamente grandes no JSONB
    if (trimmed.length > 2_800_000) return "";
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed.slice(0, 1000);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href.slice(0, 2048);
    }
  } catch {
    return "";
  }

  return "";
}

export function detectBackgroundMediaType(
  url: string | null | undefined,
  mimeType?: string | null,
): BackgroundMediaType {
  const mime = (mimeType || "").toLowerCase().trim();
  if (mime.startsWith("video/")) return "video";
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";

  const raw = (url || "").trim().toLowerCase();
  if (!raw) return "image";

  if (raw.startsWith("data:video/")) return "video";
  if (raw.startsWith("data:image/gif")) return "gif";

  const withoutHashOrQuery = raw.split("#")[0].split("?")[0];
  if (
    withoutHashOrQuery.endsWith(".mp4") ||
    withoutHashOrQuery.endsWith(".webm") ||
    withoutHashOrQuery.endsWith(".m4v") ||
    withoutHashOrQuery.endsWith(".mov")
  ) {
    return "video";
  }
  if (withoutHashOrQuery.endsWith(".gif")) {
    return "gif";
  }

  return "image";
}

export function validateBackgroundUploadFile(file: {
  name?: string;
  type?: string;
  size?: number;
}): { ok: true; mediaType: BackgroundMediaType } | { ok: false; error: string } {
  const name = (file.name || "").toLowerCase().trim();
  const type = (file.type || "").toLowerCase().trim();
  const size = Number(file.size) || 0;

  if (size <= 0) {
    return { ok: false, error: "Arquivo vazio ou inválido." };
  }
  if (size > MAX_BACKGROUND_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "Arquivo excede o limite de 25 MB. Use um arquivo menor ou importe por link.",
    };
  }

  const isAllowedVideo =
    type === "video/mp4" ||
    type === "video/webm" ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm");
  const isAllowedGif = type === "image/gif" || name.endsWith(".gif");
  const isAllowedImage =
    (type.startsWith("image/") && type !== "image/svg+xml") ||
    /\.(png|jpe?g|webp|avif)$/i.test(name);

  if (isAllowedVideo) return { ok: true, mediaType: "video" };
  if (isAllowedGif) return { ok: true, mediaType: "gif" };
  if (isAllowedImage) return { ok: true, mediaType: "image" };

  return {
    ok: false,
    error: "Formato não suportado. Envie PNG, JPG, WEBP, GIF ou vídeo MP4/WebM.",
  };
}

export function normalizeSceneBackgroundPayload(
  raw: unknown,
): SceneBackgroundPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const mode: BackgroundActionMode = obj.mode === "custom" ? "custom" : "default";
  const updatedAt = Number.isFinite(Number(obj.updatedAt))
    ? Number(obj.updatedAt)
    : Date.now();
  const name =
    typeof obj.name === "string" ? obj.name.trim().slice(0, 120) : "";

  if (mode === "default") {
    return {
      mode: "default",
      url: null,
      mediaType: null,
      name: "",
      updatedAt,
    };
  }

  const cleanUrl = sanitizeBackgroundUrl(obj.url);
  if (!cleanUrl) return null;

  const explicitType =
    obj.mediaType === "video" || obj.mediaType === "gif" || obj.mediaType === "image"
      ? (obj.mediaType as BackgroundMediaType)
      : detectBackgroundMediaType(cleanUrl);

  return {
    mode: "custom",
    url: cleanUrl,
    mediaType: explicitType,
    name,
    updatedAt,
  };
}

export function normalizeSceneNodeParams(
  type: SceneNodeType,
  raw: unknown,
): SceneBuilderNodeParams {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};

  switch (type) {
    case "ost":
      return {
        ostAction: obj.ostAction === "stop" ? "stop" : "play",
        trackUrl:
          typeof obj.trackUrl === "string" ? obj.trackUrl.trim().slice(0, 500) : "",
        trackName:
          typeof obj.trackName === "string" ? obj.trackName.trim().slice(0, 120) : "",
        fadeSeconds: Number.isFinite(Number(obj.fadeSeconds))
          ? Math.max(0, Math.min(10, Math.round(Number(obj.fadeSeconds))))
          : 0,
        ostFadeOutSeconds: clampOstFadeOutSec(obj.ostFadeOutSeconds),
      };
    case "sfx":
      return {
        effectId:
          typeof obj.effectId === "string" ? obj.effectId.trim().slice(0, 120) : "",
        effectName:
          typeof obj.effectName === "string"
            ? obj.effectName.trim().slice(0, 120)
            : "",
        volume: Number.isFinite(Number(obj.volume))
          ? Math.max(0, Math.min(1, Math.round(Number(obj.volume) * 100) / 100))
          : 1,
      };
    case "mode":
      return {
        targetMode: obj.targetMode === "rl" ? "rl" : "demologia",
      };
    case "clock": {
      const validActions = ["advance", "regress", "reveal", "hide", "reset"] as const;
      const clockAction = validActions.includes(obj.clockAction)
        ? obj.clockAction
        : "advance";
      return {
        clockId:
          typeof obj.clockId === "string" ? obj.clockId.trim().slice(0, 120) : "",
        clockTitle:
          typeof obj.clockTitle === "string"
            ? obj.clockTitle.trim().slice(0, 120)
            : "",
        clockAction,
        amount: Number.isFinite(Number(obj.amount))
          ? Math.max(1, Math.min(12, Math.round(Number(obj.amount))))
          : 1,
      };
    }
    case "handout":
      return {
        handoutId:
          typeof obj.handoutId === "string" ? obj.handoutId.trim().slice(0, 120) : "",
        handoutTitle:
          typeof obj.handoutTitle === "string"
            ? obj.handoutTitle.trim().slice(0, 120)
            : "",
        handoutAction:
          obj.handoutAction === "reveal_secret" ? "reveal_secret" : "reveal_all",
      };
    case "delay":
      return {
        waitSeconds: clampDurationSec(obj.waitSeconds, 2),
        note: typeof obj.note === "string" ? obj.note.trim().slice(0, 120) : "",
      };
    case "fade": {
      return {
        fadeStyle: "dim",
        opacity: Number.isFinite(Number(obj.opacity))
          ? Math.max(0.1, Math.min(0.9, Math.round(Number(obj.opacity) * 100) / 100))
          : 0.6,
        holdSeconds: clampDurationSec(obj.holdSeconds, 2.5),
        caption:
          typeof obj.caption === "string" ? obj.caption.trim().slice(0, 120) : "",
      };
    }
    case "blackout": {
      return {
        fadeInSec: clampFadeTransitionSec(obj.fadeInSec, 1),
        holdSeconds: clampBlackoutHoldSec(obj.holdSeconds, 2),
        fadeOutSec: clampFadeTransitionSec(obj.fadeOutSec, 1),
        easingStyle: normalizeBlackoutEasingStyle(obj.easingStyle),
        easingDirection: normalizeBlackoutEasingDirection(obj.easingDirection),
      };
    }
    case "background": {
      const backgroundAction: BackgroundActionMode =
        obj.backgroundAction === "default" ? "default" : "custom";
      const backgroundSource: BackgroundSourceType =
        obj.backgroundSource === "upload" ? "upload" : "link";
      const backgroundUrl =
        backgroundAction === "default" ? "" : sanitizeBackgroundUrl(obj.backgroundUrl);
      const backgroundMediaType: BackgroundMediaType =
        obj.backgroundMediaType === "video" ||
        obj.backgroundMediaType === "gif" ||
        obj.backgroundMediaType === "image"
          ? obj.backgroundMediaType
          : detectBackgroundMediaType(backgroundUrl);
      const backgroundName =
        typeof obj.backgroundName === "string"
          ? obj.backgroundName.trim().slice(0, 120)
          : "";
      return {
        backgroundAction,
        backgroundSource,
        backgroundUrl,
        backgroundMediaType,
        backgroundName,
      };
    }
  }
}

export function normalizeSceneBuilderNode(raw: unknown): SceneBuilderNode | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  if (!VALID_NODE_TYPES.has(obj.type)) return null;

  // Migrate legacy fade nodes configured as "blackout" into the dedicated blackout node
  const rawParams =
    obj.params && typeof obj.params === "object"
      ? (obj.params as Record<string, any>)
      : {};
  const type: SceneNodeType =
    obj.type === "fade" && rawParams.fadeStyle === "blackout"
      ? "blackout"
      : (obj.type as SceneNodeType);

  const meta = SCENE_NODE_CATALOG[type];
  const params = normalizeSceneNodeParams(
    type,
    obj.type === "fade" && type === "blackout"
      ? {
          fadeInSec: rawParams.fadeInSec ?? 0.7,
          holdSeconds: rawParams.holdSeconds ?? obj.durationSec ?? 2,
          fadeOutSec: rawParams.fadeOutSec ?? 0.7,
          easingStyle: rawParams.easingStyle ?? "quad",
          easingDirection: rawParams.easingDirection ?? "inout",
        }
      : obj.params,
  );
  const defaultDuration =
    type === "delay"
      ? params.waitSeconds || meta.defaultDurationSec
      : type === "fade"
        ? params.holdSeconds || meta.defaultDurationSec
        : type === "blackout"
          ? computeBlackoutTotalSec(params)
          : meta.defaultDurationSec;

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim().slice(0, 80)
        : `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    startTimeSec: clampStartTimeSec(obj.startTimeSec),
    durationSec:
      type === "blackout"
        ? computeBlackoutTotalSec(params)
        : clampDurationSec(obj.durationSec, defaultDuration),
    enabled: obj.enabled !== false,
    label:
      typeof obj.label === "string" && obj.label.trim()
        ? obj.label.trim().slice(0, 90)
        : undefined,
    params,
  };
}

export function sortSceneBuilderNodes(
  nodes: SceneBuilderNode[],
): SceneBuilderNode[] {
  return [...nodes].sort((a, b) => {
    if (a.startTimeSec !== b.startTimeSec) return a.startTimeSec - b.startTimeSec;
    return a.id.localeCompare(b.id);
  });
}

export function normalizeSceneBuilderNodes(raw: unknown): SceneBuilderNode[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SceneBuilderNode[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SCENE_NODES) break;
    const norm = normalizeSceneBuilderNode(item);
    if (!norm || seen.has(norm.id)) continue;
    seen.add(norm.id);
    out.push(norm);
  }
  return sortSceneBuilderNodes(out);
}

export function computeNextDefaultStartTime(nodes: SceneBuilderNode[]): number {
  if (nodes.length === 0) return 0;
  const last = sortSceneBuilderNodes(nodes)[nodes.length - 1];
  const step = last.type === "delay" ? last.params.waitSeconds || last.durationSec : 1.5;
  return clampStartTimeSec(last.startTimeSec + step);
}

export function createDefaultSceneNode(
  type: SceneNodeType,
  existingNodes: SceneBuilderNode[],
  overrides?: Partial<SceneBuilderNodeParams>,
): SceneBuilderNode {
  const meta = SCENE_NODE_CATALOG[type];
  const startTimeSec = computeNextDefaultStartTime(existingNodes);
  const params = normalizeSceneNodeParams(type, overrides || {});
  return {
    id: `node_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    startTimeSec,
    durationSec:
      type === "delay"
        ? params.waitSeconds || meta.defaultDurationSec
        : type === "fade"
          ? params.holdSeconds || meta.defaultDurationSec
          : type === "blackout"
            ? computeBlackoutTotalSec(params)
            : meta.defaultDurationSec,
    enabled: true,
    params,
  };
}

export function computeTimelineDurationSec(nodes: SceneBuilderNode[]): number {
  if (nodes.length === 0) return 0;
  let maxEnd = 0;
  for (const n of nodes) {
    const span =
      n.type === "delay"
        ? n.params.waitSeconds || n.durationSec
        : n.type === "fade"
          ? n.params.holdSeconds || n.durationSec
          : n.type === "blackout"
            ? computeBlackoutTotalSec(n.params)
            : n.durationSec;
    const end = n.startTimeSec + Math.max(0.5, span);
    if (end > maxEnd) maxEnd = end;
  }
  return roundTenths(maxEnd);
}

export function shiftNodeStartTime(
  nodes: SceneBuilderNode[],
  nodeId: string,
  deltaSec: number,
): SceneBuilderNode[] {
  return sortSceneBuilderNodes(
    nodes.map((node) =>
      node.id === nodeId
        ? { ...node, startTimeSec: clampStartTimeSec(node.startTimeSec + deltaSec) }
        : node,
    ),
  );
}

export function removeSceneNode(
  nodes: SceneBuilderNode[],
  nodeId: string,
): SceneBuilderNode[] {
  return nodes.filter((n) => n.id !== nodeId);
}

export function duplicateSceneNode(
  nodes: SceneBuilderNode[],
  nodeId: string,
): { nodes: SceneBuilderNode[]; created: SceneBuilderNode | null } {
  const source = nodes.find((n) => n.id === nodeId);
  if (!source || nodes.length >= MAX_SCENE_NODES) {
    return { nodes, created: null };
  }
  const created: SceneBuilderNode = {
    ...source,
    id: `node_${source.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startTimeSec: clampStartTimeSec(source.startTimeSec + 1.5),
    params: { ...source.params },
  };
  return {
    nodes: sortSceneBuilderNodes([...nodes, created]),
    created,
  };
}

export interface ScheduledSceneExecutionItem {
  node: SceneBuilderNode;
  executeAtMs: number;
}

export function buildExecutionSchedule(
  nodes: SceneBuilderNode[],
): ScheduledSceneExecutionItem[] {
  const sorted = sortSceneBuilderNodes(nodes);
  return sorted
    .filter((n) => n.enabled && n.type !== "delay")
    .map((node) => ({
      node,
      executeAtMs: Math.round(clampStartTimeSec(node.startTimeSec) * 1000),
    }));
}

export interface SceneNodeSummaryLookup {
  trackNameByUrl?: Map<string, string>;
  effectNameById?: Map<string, string>;
  clockTitleById?: Map<string, string>;
  handoutTitleById?: Map<string, string>;
}

export function summarizeSceneNode(
  node: SceneBuilderNode,
  lookup?: SceneNodeSummaryLookup,
): string {
  if (node.label && node.label.trim()) return node.label.trim();

  switch (node.type) {
    case "ost": {
      if (node.params.ostAction === "stop") {
        const fadeOut = clampOstFadeOutSec(node.params.ostFadeOutSeconds);
        if (fadeOut > 0) {
          const formatted = Number.isInteger(fadeOut)
            ? `${fadeOut}s`
            : `${fadeOut.toFixed(1)}s`;
          return `OST · Parar trilha (Fade Out ${formatted})`;
        }
        return "OST · Parar trilha";
      }
      const trackName =
        (node.params.trackUrl && lookup?.trackNameByUrl?.get(node.params.trackUrl)) ||
        node.params.trackName ||
        "Selecionar trilha";
      const fadePart =
        node.params.fadeSeconds && node.params.fadeSeconds > 0
          ? ` (Fade ${node.params.fadeSeconds}s)`
          : "";
      return `OST · ${trackName}${fadePart}`;
    }
    case "sfx": {
      const fxName =
        (node.params.effectId && lookup?.effectNameById?.get(node.params.effectId)) ||
        node.params.effectName ||
        "Selecionar efeito";
      return `SFX · ${fxName}`;
    }
    case "mode":
      return `MODO · ${node.params.targetMode === "rl" ? "Real L" : "Demologia"}`;
    case "clock": {
      const clockName =
        (node.params.clockId && lookup?.clockTitleById?.get(node.params.clockId)) ||
        node.params.clockTitle ||
        "Selecionar relógio";
      const actionMap: Record<string, string> = {
        advance: `+${node.params.amount || 1}`,
        regress: `-${node.params.amount || 1}`,
        reveal: "Exibir",
        hide: "Ocultar",
        reset: "Zerar",
      };
      const act = actionMap[node.params.clockAction || "advance"] || "+1";
      return `RELÓGIO · ${clockName} (${act})`;
    }
    case "handout": {
      const title =
        (node.params.handoutId &&
          lookup?.handoutTitleById?.get(node.params.handoutId)) ||
        node.params.handoutTitle ||
        "Selecionar handout";
      const suffix =
        node.params.handoutAction === "reveal_secret" ? " · Segredo" : "";
      return `HANDOUT · ${title}${suffix}`;
    }
    case "delay": {
      const sec = (node.params.waitSeconds || node.durationSec).toFixed(1);
      return node.params.note
        ? `ESPERA · ${sec}s (${node.params.note})`
        : `ESPERA · ${sec}s`;
    }
    case "fade": {
      const hold = (node.params.holdSeconds || node.durationSec).toFixed(1);
      const pct = Math.round((node.params.opacity ?? 0.6) * 100);
      return `PENUMBRA · ${pct}% (${hold}s)`;
    }
    case "blackout": {
      const fadeIn = clampFadeTransitionSec(node.params.fadeInSec, 1).toFixed(1);
      const hold = clampBlackoutHoldSec(node.params.holdSeconds, 2).toFixed(1);
      const fadeOut = clampFadeTransitionSec(node.params.fadeOutSec, 1).toFixed(1);
      const styleLabelMap: Record<BlackoutEasingStyle, string> = {
        linear: "Linear",
        quad: "Quad",
        exponential: "Exp",
      };
      const dirLabelMap: Record<BlackoutEasingDirection, string> = {
        in: "In",
        out: "Out",
        inout: "InOut",
      };
      const style = normalizeBlackoutEasingStyle(node.params.easingStyle);
      const dir = normalizeBlackoutEasingDirection(node.params.easingDirection);
      const curveLabel =
        style === "linear"
          ? "Linear"
          : `${styleLabelMap[style]} ${dirLabelMap[dir]}`;
      return `BLACKOUT · ${fadeIn}/${hold}/${fadeOut}s · ${curveLabel}`;
    }
    case "background": {
      if (node.params.backgroundAction === "default") {
        return "FUNDO · Default (Padrão do Modo)";
      }
      if (!node.params.backgroundUrl) {
        return "FUNDO · Selecionar mídia";
      }
      const mediaType =
        node.params.backgroundMediaType ||
        detectBackgroundMediaType(node.params.backgroundUrl);
      const typeTag =
        mediaType === "video"
          ? "MP4 · Loop"
          : mediaType === "gif"
            ? "GIF · Loop"
            : "Imagem";
      if (node.params.backgroundName && node.params.backgroundName.trim()) {
        return `FUNDO · ${node.params.backgroundName.trim()} (${typeTag})`;
      }
      return `FUNDO · ${typeTag}`;
    }
  }
}

export function serializeSceneBuilderNodes(nodes: SceneBuilderNode[]): string {
  return JSON.stringify(
    {
      format: "demologia_scene_builder_v1",
      nodes: normalizeSceneBuilderNodes(nodes),
    },
    null,
    2,
  );
}

export function parseImportedSceneBuilderNodes(
  rawJson: string,
): { ok: true; nodes: SceneBuilderNode[] } | { ok: false; error: string } {
  if (!rawJson || !rawJson.trim()) {
    return { ok: false, error: "Cole o JSON da timeline para importar." };
  }
  try {
    const parsed = JSON.parse(rawJson);
    const candidate = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray(parsed.nodes)
        ? parsed.nodes
        : null;
    if (!candidate) {
      return {
        ok: false,
        error: "JSON inválido: esperado campo 'nodes' com a lista de blocos.",
      };
    }
    const normalized = normalizeSceneBuilderNodes(candidate);
    if (candidate.length > 0 && normalized.length === 0) {
      return {
        ok: false,
        error: "Nenhum node válido foi encontrado no JSON informado.",
      };
    }
    return { ok: true, nodes: normalized };
  } catch {
    return { ok: false, error: "Formato JSON inválido. Verifique as chaves e vírgulas." };
  }
}
