export function isOcultistaSheetName(name?: string | null): boolean {
  return String(name ?? "").trim().toLowerCase() === "ocultista";
}

export interface MainSheetAutoSyncCheck {
  name?: string | null;
  userUid: string | null;
  isOnline: boolean;
  currentPage: string;
  manualOcultistaSync: boolean;
}

/**
 * Fichas chamadas "Ocultista" não sincronizam automaticamente;
 * exigem ativação ou solicitação manual explícita do usuário.
 * Demais fichas preservam sincronização automática normal.
 */
export function shouldAutoSyncMainSheet({
  name,
  userUid,
  isOnline,
  currentPage,
  manualOcultistaSync,
}: MainSheetAutoSyncCheck): boolean {
  if (!userUid || !isOnline) return false;
  if (currentPage === "mestre" || currentPage === "ficha_extra") return false;

  if (isOcultistaSheetName(name)) {
    return Boolean(manualOcultistaSync);
  }

  return true;
}

export interface ExtraSheetAutoSyncCheck {
  name?: string | null;
  synchronized?: boolean;
  last_local_edit?: number;
  manualOcultistaSync?: boolean;
}

export function shouldAutoSyncExtraSheet(ficha: ExtraSheetAutoSyncCheck): boolean {
  if (!ficha || !ficha.synchronized || !ficha.last_local_edit) return false;

  if (isOcultistaSheetName(ficha.name)) {
    return Boolean(ficha.manualOcultistaSync);
  }

  return true;
}

export interface PlayerCleanupRow {
  id: string;
  name?: string | null;
  data?: { name?: string | null } | null;
}

export function findOcultistaPlayerRecordIds(
  rows: PlayerCleanupRow[],
  isNonPlayerSystemId: (id: string) => boolean
): string[] {
  if (!Array.isArray(rows)) return [];
  const ids: string[] = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    const isExtraRecord = row.id.startsWith("EXTRA_FICHA_");
    if (!isExtraRecord && isNonPlayerSystemId(row.id)) continue;
    const resolvedName = row.data?.name ?? row.name;
    if (isOcultistaSheetName(resolvedName)) {
      ids.push(row.id);
    }
  }
  return Array.from(new Set(ids));
}
