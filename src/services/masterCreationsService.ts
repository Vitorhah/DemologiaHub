import { supabase } from "../lib/supabase";
import type {
  CreationDocument,
  CreationDocumentSummary,
} from "../types/masterCreations";
import {
  CREATION_DEFAULT_PAGE_BG,
  CREATION_RECORD_PREFIX,
  MAX_CREATION_IMAGE_DIMENSION,
  MAX_CREATION_INLINE_IMAGE_BYTES,
  createCreationId,
  createEmptyCreationDocument,
  getFallbackCreationRecordId,
  normalizeCreationDocument,
  normalizeCreationTitle,
  normalizeHexOrTransparent,
  sortCreationSummaries,
  toCreationDocumentSummary,
  validateCreationImageFile,
} from "../utils/masterCreations";
import { isTableMissingError } from "../utils/masterNotes";
import { sanitizeRoomKey } from "../utils/tabletopCustomization";

type CreationsBackend = "unknown" | "master_creations" | "players_fallback";

let resolvedBackend: CreationsBackend = "unknown";

/**
 * Serviço CRUD otimizado para a aba "Criações" (exclusivo do Mestre):
 * - Listagem (`listMasterCreationSummaries`) projeta apenas metadados leves
 *   (id, masterId, title, pageBackground, elementsCount, updatedAt) sem baixar
 *   os blocos/imagens completos de cada página até abrir.
 * - Sem Realtime ou polling contínuo; salvamento sob demanda e controlado.
 * - Usa `public.master_creations` quando disponível; caso a migração ainda não
 *   tenha sido aplicada, utiliza registros isolados `CREATION_DOC_<id>` em
 *   `public.players`.
 */
export async function listMasterCreationSummaries(
  masterId: string,
): Promise<CreationDocumentSummary[]> {
  if (!masterId) return [];

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_creations")
      .select("id, master_id, title, page_background, elements_count, updated_at")
      .eq("master_id", masterId)
      .order("updated_at", { ascending: false });

    if (!error) {
      resolvedBackend = "master_creations";
      return sortCreationSummaries(
        (data || []).map((row: any) => ({
          id: String(row.id),
          masterId: String(row.master_id || masterId),
          title: normalizeCreationTitle(row.title),
          pageBackground: normalizeHexOrTransparent(
            row.page_background,
            CREATION_DEFAULT_PAGE_BG,
          ),
          elementsCount:
            typeof row.elements_count === "number" ? row.elements_count : 0,
          updatedAt: String(row.updated_at || new Date().toISOString()),
        })),
      );
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao carregar documentos de Criações.");
    }
    resolvedBackend = "players_fallback";
  }

  const { data, error } = await supabase
    .from("players")
    .select(
      "id, updated_at, doc_id:data->>id, master_id:data->>masterId, title:data->>title, page_bg:data->>pageBackground, elements_count:data->>elementsCount",
    )
    .like("id", `${CREATION_RECORD_PREFIX}%`)
    .eq("data->>masterId", masterId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Falha ao carregar documentos de Criações.");
  }

  return sortCreationSummaries(
    (data || []).map((row: any) => {
      const rawId =
        typeof row.doc_id === "string" && row.doc_id.length > 0
          ? row.doc_id
          : String(row.id || "").replace(CREATION_RECORD_PREFIX, "");
      const parsedCount = Number(row.elements_count);
      return {
        id: rawId,
        masterId: String(row.master_id || masterId),
        title: normalizeCreationTitle(row.title),
        pageBackground: normalizeHexOrTransparent(
          row.page_bg,
          CREATION_DEFAULT_PAGE_BG,
        ),
        elementsCount: Number.isFinite(parsedCount) ? parsedCount : 0,
        updatedAt: String(row.updated_at || new Date().toISOString()),
      };
    }),
  );
}

export async function getMasterCreationById(
  docId: string,
  masterId: string,
): Promise<CreationDocument | null> {
  if (!docId || !masterId) return null;

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_creations")
      .select(
        "id, master_id, title, page_background, page_border_color, elements, created_at, updated_at",
      )
      .eq("id", docId)
      .eq("master_id", masterId)
      .maybeSingle();

    if (!error) {
      resolvedBackend = "master_creations";
      if (!data) return null;
      return normalizeCreationDocument(
        {
          id: String(data.id),
          masterId: String(data.master_id || masterId),
          title: data.title,
          pageBackground: data.page_background,
          pageBorderColor: data.page_border_color,
          elements: Array.isArray(data.elements) ? data.elements : [],
          createdAt: String(data.created_at || new Date().toISOString()),
          updatedAt: String(data.updated_at || new Date().toISOString()),
        },
        masterId,
      );
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao abrir documento.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreationRecordId(docId);
  const { data, error } = await supabase
    .from("players")
    .select("id, data, updated_at")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao abrir documento.");
  }
  if (!data || !data.data || typeof data.data !== "object") return null;

  const payload = data.data as Record<string, unknown>;
  if (
    typeof payload.masterId === "string" &&
    payload.masterId &&
    payload.masterId !== masterId
  ) {
    return null;
  }

  return normalizeCreationDocument(
    {
      ...(payload as Partial<CreationDocument>),
      id: docId,
      masterId,
      updatedAt: String(
        payload.updatedAt || data.updated_at || new Date().toISOString(),
      ),
    },
    masterId,
  );
}

export async function saveMasterCreation(
  doc: CreationDocument,
): Promise<CreationDocument> {
  if (!doc.id || !doc.masterId) {
    throw new Error("Dados insuficientes para salvar documento.");
  }
  const nowIso = new Date().toISOString();
  const clean = normalizeCreationDocument(
    { ...doc, updatedAt: nowIso },
    doc.masterId,
  );

  if (resolvedBackend !== "players_fallback") {
    const { error } = await supabase.from("master_creations").upsert({
      id: clean.id,
      master_id: clean.masterId,
      title: clean.title,
      page_background: clean.pageBackground,
      page_border_color: clean.pageBorderColor,
      elements: clean.elements,
      elements_count: clean.elements.length,
      created_at: clean.createdAt,
      updated_at: clean.updatedAt,
    });

    if (!error) {
      resolvedBackend = "master_creations";
      return clean;
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao salvar documento.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreationRecordId(clean.id);
  const rowPayload = {
    ...clean,
    elementsCount: clean.elements.length,
  };

  const { error } = await supabase.from("players").upsert({
    id: recordId,
    data: rowPayload,
    updated_at: clean.updatedAt,
  });

  if (error) {
    throw new Error(error.message || "Falha ao salvar documento.");
  }

  return clean;
}

export async function createMasterCreationDocument(
  masterId: string,
  title?: string,
): Promise<CreationDocument> {
  const fresh = createEmptyCreationDocument(masterId, title);
  return saveMasterCreation(fresh);
}

export async function duplicateMasterCreationDocument(
  sourceId: string,
  masterId: string,
): Promise<CreationDocument> {
  const original = await getMasterCreationById(sourceId, masterId);
  if (!original) {
    throw new Error("Documento original não encontrado para duplicação.");
  }
  const nowIso = new Date().toISOString();
  const cloned = normalizeCreationDocument(
    {
      ...original,
      id: createCreationId("doc"),
      title: `${original.title} (Cópia)`.slice(0, 120),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    masterId,
  );
  return saveMasterCreation(cloned);
}

export async function deleteMasterCreationDocument(
  docId: string,
  masterId: string,
): Promise<void> {
  if (!docId || !masterId) return;

  if (resolvedBackend !== "players_fallback") {
    const { error } = await supabase
      .from("master_creations")
      .delete()
      .eq("id", docId)
      .eq("master_id", masterId);

    if (!error) {
      resolvedBackend = "master_creations";
      return;
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Erro ao excluir documento.");
    }
    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackCreationRecordId(docId);
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", recordId);

  if (error) {
    throw new Error(error.message || "Erro ao excluir documento.");
  }
}

export { toCreationDocumentSummary };

// --- Optimized Image Processing & Upload (PNG transparency preserved) ---

export interface CreationImageUploadResult {
  ok: boolean;
  url?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  warning?: string;
  error?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Não foi possível ler a imagem."));
    };
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

function loadImageDimensionsAndOptimize(
  file: File,
  mimeType: string,
): Promise<{
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth || 400;
      const natH = img.naturalHeight || 300;
      URL.revokeObjectURL(objectUrl);

      const maxDim = MAX_CREATION_IMAGE_DIMENSION;
      if (natW <= maxDim && natH <= maxDim) {
        resolve({ blob: file, mimeType, width: natW, height: natH });
        return;
      }

      const scale = Math.min(maxDim / natW, maxDim / natH);
      const targetW = Math.max(1, Math.round(natW * scale));
      const targetH = Math.max(1, Math.round(natH * scale));

      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ blob: file, mimeType, width: natW, height: natH });
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        // Preserve PNG alpha transparency; compress JPEG/WebP cleanly
        const outMime = mimeType === "image/png" ? "image/png" : mimeType;
        const quality = outMime === "image/png" ? undefined : 0.88;
        canvas.toBlob(
          (resized) => {
            if (resized && resized.size > 0) {
              resolve({
                blob: resized,
                mimeType: outMime,
                width: targetW,
                height: targetH,
              });
            } else {
              resolve({ blob: file, mimeType, width: natW, height: natH });
            }
          },
          outMime,
          quality,
        );
      } catch {
        resolve({ blob: file, mimeType, width: natW, height: natH });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível decodificar a imagem selecionada."));
    };
    img.src = objectUrl;
  });
}

/**
 * Valida, redimensiona (se > 1600px, preservando transparência PNG) e envia
 * a imagem para o bucket existente ("audio-tracks") sob `${roomId}/master-creations/`.
 * Caso o Storage esteja indisponível e a imagem otimizada seja <= 1.5 MB,
 * realiza fallback seguro em Data URL com aviso transparente.
 */
export async function uploadCreationImage(
  file: File,
  roomId: string = "default-table",
): Promise<CreationImageUploadResult> {
  const validation = validateCreationImageFile(file);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  let processed: {
    blob: Blob;
    mimeType: string;
    width: number;
    height: number;
  };
  try {
    processed = await loadImageDimensionsAndOptimize(file, validation.mimeType);
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Não foi possível processar a imagem.",
    };
  }

  const cleanRoom = sanitizeRoomKey(roomId);
  const safeName = (file.name || "imagem.png").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${cleanRoom}/master-creations/${Date.now()}_${safeName}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from("audio-tracks")
      .upload(storagePath, processed.blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: processed.mimeType,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("audio-tracks")
      .getPublicUrl(storagePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error("URL pública não retornada pelo Storage.");
    }

    return {
      ok: true,
      url: publicUrlData.publicUrl,
      naturalWidth: processed.width,
      naturalHeight: processed.height,
    };
  } catch (err: any) {
    if (processed.blob.size <= MAX_CREATION_INLINE_IMAGE_BYTES) {
      try {
        const dataUrl = await blobToDataUrl(processed.blob);
        return {
          ok: true,
          url: dataUrl,
          naturalWidth: processed.width,
          naturalHeight: processed.height,
          warning:
            "Storage indisponível — imagem incorporada diretamente neste documento.",
        };
      } catch {
        // segue para erro
      }
    }

    const msg =
      typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Falha ao enviar imagem.";
    return {
      ok: false,
      error: `Falha ao importar imagem (${msg}). Tente um arquivo PNG/JPG menor.`,
    };
  }
}
