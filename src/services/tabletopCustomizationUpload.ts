import { supabase } from "../lib/supabase";
import type { TabletopBrandImageSlot } from "../types/tabletopCustomization";
import {
  MAX_CUSTOM_BRAND_INLINE_FALLBACK_BYTES,
  sanitizeRoomKey,
  sanitizeSvgContent,
  validateCustomBrandImageFile,
} from "../utils/tabletopCustomization";

export interface CustomBrandUploadResult {
  ok: boolean;
  url?: string;
  warning?: string;
  error?: string;
}

function readFileAsDataUrl(blob: Blob): Promise<string> {
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
      reject(new Error("Falha ao ler a imagem no dispositivo."));
    };
    reader.readAsDataURL(blob);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler o arquivo SVG."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Falha ao ler o arquivo SVG."));
    };
    reader.readAsText(file);
  });
}

/**
 * Envia imagens de identidade visual (PNG, JPG, JPEG, WebP ou SVG sanitizado)
 * para o bucket público existente ("audio-tracks") no Supabase Storage sob
 * `${roomId}/tabletop-customization/`. Caso o Storage esteja indisponível e o arquivo
 * seja <= 1.5 MB, realiza fallback seguro para Data URL com aviso explícito.
 */
export async function uploadCustomBrandImage(
  file: File,
  slot: TabletopBrandImageSlot,
  roomId: string = "default-table",
): Promise<CustomBrandUploadResult> {
  const validation = validateCustomBrandImageFile(file);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  let uploadBlob: Blob = file;
  if (validation.isSvg) {
    try {
      const rawSvg = await readFileAsText(file);
      const cleanSvg = sanitizeSvgContent(rawSvg);
      if (!cleanSvg) {
        return {
          ok: false,
          error: "O arquivo SVG é inválido ou não contém um elemento <svg> válido.",
        };
      }
      uploadBlob = new Blob([cleanSvg], { type: "image/svg+xml" });
    } catch {
      return {
        ok: false,
        error: "Não foi possível processar o arquivo SVG selecionado.",
      };
    }
  }

  const cleanRoom = sanitizeRoomKey(roomId);
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${cleanRoom}/tabletop-customization/${slot}_${Date.now()}_${cleanFileName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("audio-tracks")
      .upload(storagePath, uploadBlob, {
        cacheControl: "3600",
        upsert: true,
        contentType: validation.mimeType,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("audio-tracks")
      .getPublicUrl(storagePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error("URL pública não retornada pelo Storage.");
    }

    return {
      ok: true,
      url: publicUrlData.publicUrl,
    };
  } catch (err: any) {
    if (uploadBlob.size <= MAX_CUSTOM_BRAND_INLINE_FALLBACK_BYTES) {
      try {
        const dataUrl = await readFileAsDataUrl(uploadBlob);
        return {
          ok: true,
          url: dataUrl,
          warning:
            "Storage indisponível — imagem incorporada diretamente na configuração da sala.",
        };
      } catch {
        // segue para retornar erro abaixo
      }
    }

    const msg =
      typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Não foi possível enviar a imagem para o servidor.";
    return {
      ok: false,
      error: `Falha ao enviar imagem (${msg}). Tente um arquivo menor ou informe uma URL HTTPS.`,
    };
  }
}
