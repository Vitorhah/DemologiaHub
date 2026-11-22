import { MasterNoteSummary, PendingNoteDraft } from "../types/masterNotes";

export const DEFAULT_NOTE_TITLE = "Nova anotação";
export const MASTER_NOTE_RECORD_PREFIX = "MASTER_NOTE_";
export const MAX_NOTE_TITLE_LENGTH = 160;
export const MAX_NOTE_PREVIEW_LENGTH = 140;
export const NOTE_AUTOSAVE_DEBOUNCE_MS = 900;

const PENDING_DRAFT_STORAGE_PREFIX = "demologia_master_note_draft_v1_";

export function normalizeNoteTitle(raw: string | null | undefined): string {
  if (typeof raw !== "string") return DEFAULT_NOTE_TITLE;
  const trimmed = raw.trim().slice(0, MAX_NOTE_TITLE_LENGTH);
  return trimmed.length > 0 ? trimmed : DEFAULT_NOTE_TITLE;
}

export function buildNotePreview(content: string | null | undefined): string {
  if (typeof content !== "string") return "";
  const flattened = content.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (flattened.length <= MAX_NOTE_PREVIEW_LENGTH) return flattened;
  return `${flattened.slice(0, MAX_NOTE_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

export function createNoteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getFallbackNoteRecordId(noteId: string): string {
  return `${MASTER_NOTE_RECORD_PREFIX}${noteId}`;
}

export function hasNoteContentChanged(
  saved: { title: string; content: string } | null | undefined,
  draft: { title: string; content: string }
): boolean {
  if (!saved) return true;
  return (
    normalizeNoteTitle(saved.title) !== normalizeNoteTitle(draft.title) ||
    saved.content !== draft.content
  );
}

export function sortNoteSummaries<T extends { updated_at: string }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const ta = Date.parse(a.updated_at) || 0;
    const tb = Date.parse(b.updated_at) || 0;
    return tb - ta;
  });
}

export function formatNoteTimestamp(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";

  const date = new Date(ts);
  const now = new Date(nowMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return `${hh}:${mm}`;
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

export function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; status?: number };
  const code = typeof err.code === "string" ? err.code : "";
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    err.status === 404 ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export function filterNoteSummaries(
  notes: MasterNoteSummary[],
  query: string
): MasterNoteSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(q) ||
      note.preview.toLowerCase().includes(q)
  );
}

// ============================================================================
// RECUPERAÇÃO TEMPORÁRIA DE RASCUNHO EM CASO DE FALHA DE CONEXÃO
// (Nunca substitui a persistência no Supabase — apenas preserva o texto
// digitado caso uma requisição de salvamento falhe temporariamente.)
// ============================================================================

function getPendingDraftKey(masterId: string, noteId: string): string {
  return `${PENDING_DRAFT_STORAGE_PREFIX}${masterId}_${noteId}`;
}

export function savePendingNoteDraft(draft: PendingNoteDraft): void {
  try {
    localStorage.setItem(
      getPendingDraftKey(draft.master_id, draft.id),
      JSON.stringify(draft)
    );
  } catch {
    // Ignora caso storage local esteja indisponível
  }
}

export function loadPendingNoteDraft(
  masterId: string,
  noteId: string
): PendingNoteDraft | null {
  try {
    const raw = localStorage.getItem(getPendingDraftKey(masterId, noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.content === "string"
    ) {
      return {
        id: parsed.id,
        master_id: typeof parsed.master_id === "string" ? parsed.master_id : masterId,
        title: typeof parsed.title === "string" ? parsed.title : DEFAULT_NOTE_TITLE,
        content: parsed.content,
        updated_at:
          typeof parsed.updated_at === "string"
            ? parsed.updated_at
            : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingNoteDraft(masterId: string, noteId: string): void {
  try {
    localStorage.removeItem(getPendingDraftKey(masterId, noteId));
  } catch {
    // Ignora erro de storage
  }
}
