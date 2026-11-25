import { supabase } from "../lib/supabase";
import type { BackgroundMediaType } from "../types/sceneDirector";
import {
  MAX_BACKGROUND_DATA_URL_FALLBACK_BYTES,
  validateBackgroundUploadFile,
} from "../utils/sceneBuilder";

export interface SceneBackgroundUploadResult {
  ok: boolean;
  url?: string;
  mediaType?: BackgroundMediaType;
  fileName?: string;
  warning?: string;
  error?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler o arquivo selecionado."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Falha ao ler o arquivo no dispositivo."));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Envia uma imagem, GIF ou vídeo MP4/WebM para o bucket público existente
 * ("audio-tracks") no Supabase Storage sob o prefixo `${roomId}/scene-backgrounds/`.
 * Caso o Storage esteja temporariamente indisponível e o arquivo seja uma imagem/GIF
 * pequena (<= 1.5 MB), realiza fallback transparente para Data URL com aviso explícito.
 */
export async function uploadSceneBackgroundMedia(
  file: File,
  roomId: string = "default-table",
): Promise<SceneBackgroundUploadResult> {
  const validation = validateBackgroundUploadFile(file);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  const cleanRoom = (roomId || "default-table").replace(/[^a-zA-Z0-9._-]/g, "_");
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${cleanRoom}/scene-backgrounds/${Date.now()}_${cleanFileName}`;
  const displayName = file.name.replace(/\.[^/.]+$/, "").trim() || "Fundo da Cena";

  const contentType =
    file.type ||
    (validation.mediaType === "video"
      ? cleanFileName.toLowerCase().endsWith(".webm")
        ? "video/webm"
        : "video/mp4"
      : validation.mediaType === "gif"
        ? "image/gif"
        : "image/png");

  try {
    const { error: uploadError } = await supabase.storage
      .from("audio-tracks")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType,
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
      mediaType: validation.mediaType,
      fileName: displayName,
    };
  } catch (err: any) {
    const canFallbackInline =
      validation.mediaType !== "video" &&
      file.size <= MAX_BACKGROUND_DATA_URL_FALLBACK_BYTES;

    if (canFallbackInline) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        return {
          ok: true,
          url: dataUrl,
          mediaType: validation.mediaType,
          fileName: displayName,
          warning:
            "Storage indisponível no momento — mídia incorporada diretamente na cena.",
        };
      } catch {
        // segue para retornar erro honesto abaixo
      }
    }

    const msg =
      typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Não foi possível enviar o arquivo para o servidor.";
    return {
      ok: false,
      error: `Falha no upload da mídia (${msg}). Tente novamente ou importe por Link.`,
    };
  }
}
