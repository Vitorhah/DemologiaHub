import type React from "react";
import type { CreatureSheetBlock } from "../types/masterCreatures";

export type CreatureExportLayout = "pc" | "mobile";

export interface CreatureExportLayoutSpec {
  id: CreatureExportLayout;
  label: string;
  shortLabel: string;
  description: string;
  widthPx: number;
  paddingPx: number;
  pixelRatio: number;
}

export const CREATURE_EXPORT_LAYOUTS: Record<
  CreatureExportLayout,
  CreatureExportLayoutSpec
> = {
  pc: {
    id: "pc",
    label: "Layout PC",
    shortLabel: "PC",
    description: "Composição ampla em múltiplas colunas (1080px)",
    widthPx: 1080,
    paddingPx: 28,
    pixelRatio: 2,
  },
  mobile: {
    id: "mobile",
    label: "Layout Mobile",
    shortLabel: "Mobile",
    description: "Coluna única vertical para leitura rápida (430px)",
    widthPx: 430,
    paddingPx: 16,
    pixelRatio: 2,
  },
};

export const MAX_EXPORT_BG_FILE_BYTES = 12 * 1024 * 1024;
export const DEFAULT_EXPORT_OVERLAY_OPACITY = 0.72;

const ALLOWED_BG_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_BG_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
]);

export function clampExportOverlayOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EXPORT_OVERLAY_OPACITY;
  return Math.min(0.92, Math.max(0, Math.round(value * 100) / 100));
}

export function validateExportBackgroundFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): { ok: true } | { ok: false; error: string } {
  const size = typeof file.size === "number" ? file.size : 0;
  if (size <= 0) {
    return { ok: false, error: "O arquivo de imagem selecionado está vazio." };
  }
  if (size > MAX_EXPORT_BG_FILE_BYTES) {
    return {
      ok: false,
      error: "Imagem muito grande para exportação. Use arquivos de até 12 MB.",
    };
  }

  const normalizedMime = (file.type || "").trim().toLowerCase();
  if (normalizedMime) {
    if (!ALLOWED_BG_MIME_TYPES.has(normalizedMime)) {
      return {
        ok: false,
        error: "Formato não suportado. Use JPG, PNG, WebP ou GIF.",
      };
    }
    return { ok: true };
  }

  const ext = (file.name || "").split(".").pop()?.trim().toLowerCase() || "";
  if (!ext || !ALLOWED_BG_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "Formato não suportado. Use JPG, PNG, WebP ou GIF.",
    };
  }

  return { ok: true };
}

export function buildCreatureExportFilename(
  creatureName: string,
  layout: CreatureExportLayout,
): string {
  const safeSlug = (creatureName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  const base = safeSlug || "criatura";
  return `ficha_${base}_${layout}.jpg`;
}

export function resolveExportBlockContainerStyle(
  block: Pick<CreatureSheetBlock, "widthPct" | "minHeightPx">,
  layout: CreatureExportLayout,
): React.CSSProperties {
  const isFullWidth = layout === "mobile" || block.widthPct >= 98;
  if (isFullWidth) {
    return {
      flex: "1 1 100%",
      width: "100%",
      maxWidth: "100%",
      minHeight: block.minHeightPx ? `${block.minHeightPx}px` : undefined,
    };
  }

  return {
    flex: `1 1 calc(${block.widthPct}% - 12px)`,
    minWidth: "260px",
    maxWidth: "100%",
    minHeight: block.minHeightPx ? `${block.minHeightPx}px` : undefined,
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler a imagem selecionada."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Erro ao carregar a imagem selecionada."));
    };
    reader.readAsDataURL(file);
  });
}

async function waitForFontsReady(timeoutMs = 1200): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Ignore font-ready failures
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Tempo limite excedido ao renderizar imagem.")),
      ms,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return new Blob([], { type: "image/jpeg" });
  }
  const header = dataUrl.slice(0, commaIdx);
  const mimeMatch = header.match(/data:([^;]+);/i);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const base64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function exportCreatureElementToJpg(
  element: HTMLElement,
  options: {
    pixelRatio?: number;
    quality?: number;
    backgroundColor?: string;
    width?: number;
  } = {},
): Promise<string> {
  await waitForFontsReady(1000);

  const { toJpeg } = await import("html-to-image");
  const captureWidth = options.width || element.scrollWidth || element.offsetWidth || 1080;
  const captureHeight = Math.max(
    120,
    Math.ceil(element.scrollHeight || element.offsetHeight || 600),
  );

  const baseOptions = {
    quality: options.quality ?? 0.93,
    pixelRatio: options.pixelRatio ?? 2,
    backgroundColor: options.backgroundColor ?? "#07070b",
    cacheBust: false,
    skipAutoScale: true,
    width: captureWidth,
    height: captureHeight,
  };

  try {
    return await withTimeout(toJpeg(element, baseOptions), 4500);
  } catch {
    // Fallback if cross-origin stylesheet font embedding fails or stalls in WebViews
    return await toJpeg(element, {
      ...baseOptions,
      skipFonts: true,
    });
  }
}

export function triggerJpgDownload(dataUrl: string, filename: string): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.download = filename;
  link.rel = "noopener";

  let objectUrl: string | null = null;
  try {
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const blob = dataUrlToBlob(dataUrl);
      objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
    } else {
      link.href = dataUrl;
    }
  } catch {
    link.href = dataUrl;
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (objectUrl) {
    const urlToRevoke = objectUrl;
    setTimeout(() => {
      try {
        URL.revokeObjectURL(urlToRevoke);
      } catch {
        // Ignore cleanup errors
      }
    }, 8000);
  }
}
