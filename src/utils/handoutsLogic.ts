import {
  HandoutFolder,
  HandoutItem,
  HandoutType,
  HandoutVisibility,
} from "../types/handouts";

export const HANDOUTS_MASTER_RECORD_ID = "HANDOUTS_MASTER";
export const HANDOUTS_SHARED_RECORD_ID = "HANDOUTS_SHARED";
export const HANDOUTS_INDIV_PREFIX = "HANDOUTS_INDIV_";
export const HANDOUTS_LOCAL_MASTER_KEY = "demologia_handouts_master_v1";

/**
 * Identifica se um registro na tabela `public.players` é um registro de sistema
 * (não devendo aparecer como card de jogador na aba Iniciativas do Mestre).
 */
export function isSystemRecordId(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return true;
  return (
    id === "MASTER_STATE" ||
    id === "MASTER_EVENTS" ||
    id === "TABLETOP_GRID" ||
    id === "CADERNO_CAMPO_SHARED" ||
    id === "MASTER_LIBRARY" ||
    id === "CUSTOM_AFFILIATIONS_SHARED" ||
    id === "SCENE_BACKGROUND_STATE" ||
    id.startsWith("SCENE_DIRECTOR_") ||
    id === HANDOUTS_MASTER_RECORD_ID ||
    id === HANDOUTS_SHARED_RECORD_ID ||
    id.startsWith(HANDOUTS_INDIV_PREFIX) ||
    id.startsWith("OST_FILE_") ||
    id.startsWith("SOUNDBOARD_") ||
    id.startsWith("MASTER_NOTE_") ||
    id.startsWith("CREATURE_") ||
    id.startsWith("EXTRA_FICHA_") ||
    id.startsWith("CHAT_") ||
    id.startsWith("MINIGAME_") ||
    id.startsWith("MASTER_PUSH_") ||
    id.startsWith("TABLETOP_THEME_") ||
    id.startsWith("CREATION_DOC_") ||
    id.startsWith("SESSION_PAUSE_") ||
    id.startsWith("SESSION_POLL_") ||
    id.startsWith("SESSION_POLL_VOTE_")
  );
}

/**
 * Normaliza um HandoutItem para evitar campos undefined ao carregar do banco ou JSON.
 */
export function normalizeHandoutItem(raw: Partial<HandoutItem> & { id: string }): HandoutItem {
  const now = Date.now();
  const validTypes: HandoutType[] = ["documento", "imagem", "texto", "pista", "outro"];
  const validVis: HandoutVisibility[] = ["private", "all", "individual"];

  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "Sem Título",
    description: typeof raw.description === "string" ? raw.description : "",
    type: validTypes.includes(raw.type as HandoutType) ? (raw.type as HandoutType) : "documento",
    folderId: typeof raw.folderId === "string" && raw.folderId.trim() ? raw.folderId : null,
    content: typeof raw.content === "string" ? raw.content : "",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
    hasBackSide: Boolean(raw.hasBackSide),
    backText: typeof raw.backText === "string" ? raw.backText : "",
    backImageUrl: typeof raw.backImageUrl === "string" ? raw.backImageUrl : "",
    secretText: typeof raw.secretText === "string" ? raw.secretText : "",
    secretImageUrl: typeof raw.secretImageUrl === "string" ? raw.secretImageUrl : "",
    secretRevealed: Boolean(raw.secretRevealed),
    visibility: validVis.includes(raw.visibility as HandoutVisibility)
      ? (raw.visibility as HandoutVisibility)
      : "private",
    sharedWith: Array.isArray(raw.sharedWith)
      ? Array.from(new Set(raw.sharedWith.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
      : [],
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
  };
}

/**
 * Sanitiza um Handout antes de gravar em HANDOUTS_SHARED ou HANDOUTS_INDIV_<playerId>.
 * Quando secretRevealed === false, secretText e secretImageUrl DEVEM ser vazios ("")
 * para proteger o segredo também no banco de dados.
 */
export function sanitizeHandoutForPlayer(handout: HandoutItem): HandoutItem {
  const normalized = normalizeHandoutItem(handout);
  if (normalized.secretRevealed) {
    return {
      ...normalized,
      // Jogadores não precisam da lista completa de outros destinatários individuais
      sharedWith: [],
    };
  }
  return {
    ...normalized,
    secretText: "",
    secretImageUrl: "",
    secretRevealed: false,
    sharedWith: [],
  };
}

/**
 * Prepara os payloads sanitizados para HANDOUTS_SHARED e para cada HANDOUTS_INDIV_<playerId>.
 */
export function buildSanitizedDistribution(
  items: HandoutItem[],
  folders: HandoutFolder[],
  knownPlayerIds: string[] = []
): {
  sharedItems: HandoutItem[];
  sharedFolders: HandoutFolder[];
  individualByPlayer: Record<string, { items: HandoutItem[]; folders: HandoutFolder[] }>;
} {
  const normalizedItems = items.map(normalizeHandoutItem);
  const sharedItems = normalizedItems
    .filter((item) => item.visibility === "all")
    .map(sanitizeHandoutForPlayer);

  const sharedFolderIds = new Set(
    sharedItems.map((i) => i.folderId).filter((fid): fid is string => Boolean(fid))
  );
  const sharedFolders = folders.filter((f) => sharedFolderIds.has(f.id));

  const targetPlayerIds = new Set<string>(
    knownPlayerIds.filter((id) => typeof id === "string" && !isSystemRecordId(id))
  );
  normalizedItems.forEach((item) => {
    if (item.visibility === "individual") {
      item.sharedWith.forEach((pid) => {
        if (pid && !isSystemRecordId(pid)) {
          targetPlayerIds.add(pid);
        }
      });
    }
  });

  const individualByPlayer: Record<string, { items: HandoutItem[]; folders: HandoutFolder[] }> = {};
  targetPlayerIds.forEach((playerId) => {
    const pItems = normalizedItems
      .filter(
        (item) =>
          item.visibility === "individual" && item.sharedWith.includes(playerId)
      )
      .map(sanitizeHandoutForPlayer);
    const pFolderIds = new Set(
      pItems.map((i) => i.folderId).filter((fid): fid is string => Boolean(fid))
    );
    const pFolders = folders.filter((f) => pFolderIds.has(f.id));
    individualByPlayer[playerId] = { items: pItems, folders: pFolders };
  });

  return {
    sharedItems,
    sharedFolders,
    individualByPlayer,
  };
}

/**
 * Mescla handouts compartilhados globalmente (HANDOUTS_SHARED) e individuais (HANDOUTS_INDIV_<uid>)
 * removendo duplicatas por ID e ordenando do mais recente ao mais antigo.
 */
export function mergePlayerHandouts(
  sharedItems: HandoutItem[],
  individualItems: HandoutItem[]
): HandoutItem[] {
  const map = new Map<string, HandoutItem>();
  for (const item of sharedItems) {
    const norm = normalizeHandoutItem(item);
    map.set(norm.id, norm);
  }
  for (const item of individualItems) {
    const norm = normalizeHandoutItem(item);
    map.set(norm.id, norm);
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Filtra handouts na biblioteca por busca textual, tipo, visibilidade e pasta.
 */
export function filterHandouts(
  items: HandoutItem[],
  options: {
    search?: string;
    type?: HandoutType | "all";
    visibility?: HandoutVisibility | "all_vis";
    folderId?: string | "all_folders" | "unfiled";
  }
): HandoutItem[] {
  const q = (options.search || "").trim().toLowerCase();
  const typeFilter = options.type || "all";
  const visFilter = options.visibility || "all_vis";
  const folderFilter = options.folderId || "all_folders";

  return items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (visFilter !== "all_vis" && item.visibility !== visFilter) return false;
    if (folderFilter === "unfiled" && item.folderId !== null) return false;
    if (
      folderFilter !== "all_folders" &&
      folderFilter !== "unfiled" &&
      item.folderId !== folderFilter
    ) {
      return false;
    }
    if (q) {
      const stripInline = (s: string) =>
        s
          .replace(/^\s*#h[1-6](?:\s+|:\s*)/gim, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\^\^([^^]+)\^\^/g, "$1")
          .replace(/#\(([^)]+)\)/g, "$1");
      const hay = `${item.title} ${stripInline(item.title)} ${item.description || ""} ${item.content} ${stripInline(item.content)} ${item.backText} ${stripInline(item.backText)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Converte e comprime um arquivo de imagem local via Canvas para DataURL JPEG/WebP,
 * mantendo dimensões e peso seguros para sincronização JSONB no Supabase.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("O arquivo selecionado não é uma imagem válida."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Não foi possível decodificar a imagem."));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const hasAlpha = file.type === "image/png" || file.type === "image/webp";
          const outputMime = hasAlpha ? "image/webp" : "image/jpeg";
          const compressed = canvas.toDataURL(outputMime, quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
