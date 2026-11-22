import { supabase } from "../lib/supabase";
import { MasterNote, MasterNoteSummary } from "../types/masterNotes";
import {
  MASTER_NOTE_RECORD_PREFIX,
  buildNotePreview,
  createNoteId,
  getFallbackNoteRecordId,
  isTableMissingError,
  normalizeNoteTitle,
  sortNoteSummaries,
} from "../utils/masterNotes";

type StorageBackend = "unknown" | "master_notes" | "players_fallback";

let resolvedBackend: StorageBackend = "unknown";

/**
 * Serviço CRUD minimalista e sob demanda para Anotações do Mestre.
 * - Sem Supabase Realtime.
 * - Sem polling nem timers em segundo plano.
 * - Listagem carrega apenas metadados (id, master_id, title, preview, updated_at).
 * - Conteúdo completo (`content`) só é consultado quando uma nota é aberta.
 * - Usa `public.master_notes` como tabela principal; caso a migração SQL ainda
 *   não tenha sido aplicada no banco, utiliza registros individuais
 *   `MASTER_NOTE_<id>` em `public.players` mantendo a mesma projeção enxuta.
 */
export async function listMasterNoteSummaries(
  masterId: string
): Promise<MasterNoteSummary[]> {
  if (!masterId) return [];

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_notes")
      .select("id, master_id, title, preview, updated_at")
      .eq("master_id", masterId)
      .order("updated_at", { ascending: false });

    if (!error) {
      resolvedBackend = "master_notes";
      return sortNoteSummaries(
        (data || []).map((row: any) => ({
          id: String(row.id),
          master_id: String(row.master_id || masterId),
          title: normalizeNoteTitle(row.title),
          preview: typeof row.preview === "string" ? row.preview : "",
          updated_at: String(row.updated_at || new Date().toISOString()),
        }))
      );
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao carregar anotações.");
    }

    resolvedBackend = "players_fallback";
  }

  // Fallback na tabela existente `public.players`: projeta apenas metadados sem transferir `content`
  const { data, error } = await supabase
    .from("players")
    .select(
      "id, updated_at, note_id:data->>id, master_id:data->>master_id, title:data->>title, preview:data->>preview"
    )
    .like("id", `${MASTER_NOTE_RECORD_PREFIX}%`)
    .eq("data->>master_id", masterId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Falha ao carregar anotações.");
  }

  return sortNoteSummaries(
    (data || []).map((row: any) => {
      const rawId =
        typeof row.note_id === "string" && row.note_id.length > 0
          ? row.note_id
          : String(row.id || "").replace(MASTER_NOTE_RECORD_PREFIX, "");
      return {
        id: rawId,
        master_id: String(row.master_id || masterId),
        title: normalizeNoteTitle(row.title),
        preview: typeof row.preview === "string" ? row.preview : "",
        updated_at: String(row.updated_at || new Date().toISOString()),
      };
    })
  );
}

export async function getMasterNoteById(
  noteId: string,
  masterId: string
): Promise<MasterNote | null> {
  if (!noteId || !masterId) return null;

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_notes")
      .select("id, master_id, title, content, preview, updated_at")
      .eq("id", noteId)
      .eq("master_id", masterId)
      .maybeSingle();

    if (!error) {
      resolvedBackend = "master_notes";
      if (!data) return null;
      const content = typeof data.content === "string" ? data.content : "";
      return {
        id: String(data.id),
        master_id: String(data.master_id || masterId),
        title: normalizeNoteTitle(data.title),
        content,
        preview:
          typeof data.preview === "string"
            ? data.preview
            : buildNotePreview(content),
        updated_at: String(data.updated_at || new Date().toISOString()),
      };
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Falha ao abrir anotação.");
    }

    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackNoteRecordId(noteId);
  const { data, error } = await supabase
    .from("players")
    .select("id, data, updated_at")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Falha ao abrir anotação.");
  }
  if (!data || !data.data || typeof data.data !== "object") return null;

  const payload = data.data as Record<string, unknown>;
  if (typeof payload.master_id === "string" && payload.master_id !== masterId) {
    return null;
  }

  const content = typeof payload.content === "string" ? payload.content : "";
  return {
    id: noteId,
    master_id: masterId,
    title: normalizeNoteTitle(
      typeof payload.title === "string" ? payload.title : undefined
    ),
    content,
    preview:
      typeof payload.preview === "string"
        ? payload.preview
        : buildNotePreview(content),
    updated_at: String(
      payload.updated_at || data.updated_at || new Date().toISOString()
    ),
  };
}

export async function createMasterNote(
  masterId: string,
  initialTitle?: string
): Promise<MasterNote> {
  if (!masterId) {
    throw new Error("Identificador do Mestre indisponível.");
  }

  const id = createNoteId();
  const title = normalizeNoteTitle(initialTitle);
  const updatedAt = new Date().toISOString();

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_notes")
      .insert({
        id,
        master_id: masterId,
        title,
        content: "",
        updated_at: updatedAt,
      })
      .select("id, master_id, title, content, preview, updated_at")
      .single();

    if (!error && data) {
      resolvedBackend = "master_notes";
      return {
        id: String(data.id),
        master_id: String(data.master_id || masterId),
        title: normalizeNoteTitle(data.title),
        content: typeof data.content === "string" ? data.content : "",
        preview: typeof data.preview === "string" ? data.preview : "",
        updated_at: String(data.updated_at || updatedAt),
      };
    }

    if (error && !isTableMissingError(error)) {
      throw new Error(error.message || "Não foi possível criar a anotação.");
    }

    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackNoteRecordId(id);
  const rowPayload = {
    id,
    master_id: masterId,
    title,
    content: "",
    preview: "",
    updated_at: updatedAt,
  };

  const { error } = await supabase.from("players").upsert({
    id: recordId,
    data: rowPayload,
    updated_at: updatedAt,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível criar a anotação.");
  }

  return rowPayload;
}

export async function updateMasterNote(
  noteId: string,
  masterId: string,
  patch: { title: string; content: string }
): Promise<MasterNote> {
  if (!noteId || !masterId) {
    throw new Error("Dados insuficientes para salvar a anotação.");
  }

  const title = normalizeNoteTitle(patch.title);
  const content = typeof patch.content === "string" ? patch.content : "";
  const preview = buildNotePreview(content);
  const updatedAt = new Date().toISOString();

  if (resolvedBackend !== "players_fallback") {
    const { data, error } = await supabase
      .from("master_notes")
      .update({
        title,
        content,
        updated_at: updatedAt,
      })
      .eq("id", noteId)
      .eq("master_id", masterId)
      .select("id, master_id, title, content, preview, updated_at")
      .single();

    if (!error && data) {
      resolvedBackend = "master_notes";
      return {
        id: String(data.id),
        master_id: String(data.master_id || masterId),
        title: normalizeNoteTitle(data.title),
        content: typeof data.content === "string" ? data.content : content,
        preview: typeof data.preview === "string" ? data.preview : preview,
        updated_at: String(data.updated_at || updatedAt),
      };
    }

    if (error && !isTableMissingError(error)) {
      throw new Error(error.message || "Erro ao salvar anotação.");
    }

    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackNoteRecordId(noteId);
  const rowPayload = {
    id: noteId,
    master_id: masterId,
    title,
    content,
    preview,
    updated_at: updatedAt,
  };

  const { error } = await supabase.from("players").upsert({
    id: recordId,
    data: rowPayload,
    updated_at: updatedAt,
  });

  if (error) {
    throw new Error(error.message || "Erro ao salvar anotação.");
  }

  return rowPayload;
}

export async function deleteMasterNote(
  noteId: string,
  masterId: string
): Promise<void> {
  if (!noteId || !masterId) return;

  if (resolvedBackend !== "players_fallback") {
    const { error } = await supabase
      .from("master_notes")
      .delete()
      .eq("id", noteId)
      .eq("master_id", masterId);

    if (!error) {
      resolvedBackend = "master_notes";
      return;
    }

    if (!isTableMissingError(error)) {
      throw new Error(error.message || "Erro ao excluir anotação.");
    }

    resolvedBackend = "players_fallback";
  }

  const recordId = getFallbackNoteRecordId(noteId);
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", recordId)
    .eq("data->>master_id", masterId);

  if (error) {
    throw new Error(error.message || "Erro ao excluir anotação.");
  }
}
