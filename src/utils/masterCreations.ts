import type {
  CreationDocument,
  CreationDocumentSummary,
  CreationElement,
  CreationElementType,
  CreationExportFormat,
  CreationFontFamily,
  CreationHistoryState,
  CreationInfoField,
  CreationLineOrientation,
  CreationLineStyle,
  CreationResizeHandle,
  CreationTextAlign,
} from "../types/masterCreations";

/** Proporção real de uma folha A4 (210mm × 297mm @ 96 DPI = 794 × 1123 px) */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const A4_ASPECT_RATIO = A4_WIDTH_PX / A4_HEIGHT_PX;

export const CREATION_RECORD_PREFIX = "CREATION_DOC_";
export const MAX_CREATION_HISTORY = 40;
export const MAX_CREATION_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_CREATION_INLINE_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const MAX_CREATION_IMAGE_DIMENSION = 1600;
export const MIN_CREATION_ELEMENT_WIDTH = 24;
export const MIN_CREATION_ELEMENT_HEIGHT = 12;

export const CREATION_DEFAULT_PAGE_BG = "#0d0d12";
export const CREATION_DEFAULT_PAGE_BORDER = "#242430";

export const CREATION_PAGE_PRESETS: Array<{
  id: string;
  label: string;
  bg: string;
  border: string;
}> = [
  { id: "dossie-escuro", label: "Dossiê Escuro", bg: "#0d0d12", border: "#242430" },
  { id: "grafite", label: "Grafite Clínico", bg: "#14141b", border: "#2c2c3a" },
  { id: "arquivo-papel", label: "Papel Arquivo", bg: "#e8e3d9", border: "#bfb7a6" },
  { id: "folha-branca", label: "Folha Branca", bg: "#ffffff", border: "#d4d4d8" },
  { id: "sangue-profundo", label: "Selo Rubro", bg: "#14090c", border: "#4d141a" },
];

export const CREATION_FONT_OPTIONS: Array<{
  id: CreationFontFamily;
  label: string;
  cssFamily: string;
}> = [
  {
    id: "mono",
    label: "Técnica (Mono)",
    cssFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
  {
    id: "display",
    label: "Demologia (Girassol)",
    cssFamily: '"Girassol", Georgia, serif',
  },
  {
    id: "sans",
    label: "Moderna (Sans)",
    cssFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "serif",
    label: "Editorial (Serif)",
    cssFamily: 'Georgia, "Times New Roman", Times, serif',
  },
];

export const CREATION_ELEMENT_META: Record<
  CreationElementType,
  {
    label: string;
    shortLabel: string;
    description: string;
    defaultWidth: number;
    defaultHeight: number;
  }
> = {
  text: {
    label: "Texto",
    shortLabel: "Texto",
    description: "Títulos, subtítulos ou parágrafos livres",
    defaultWidth: 360,
    defaultHeight: 88,
  },
  image: {
    label: "Imagem",
    shortLabel: "Imagem",
    description: "Imagem PNG/JPG livre com controle de opacidade",
    defaultWidth: 260,
    defaultHeight: 220,
  },
  line: {
    label: "Linha",
    shortLabel: "Linha",
    description: "Linha horizontal ou vertical personalizável",
    defaultWidth: 320,
    defaultHeight: 20,
  },
  divider: {
    label: "Separador",
    shortLabel: "Separador",
    description: "Divisória técnica com rótulo opcional",
    defaultWidth: 660,
    defaultHeight: 34,
  },
  rect: {
    label: "Retângulo",
    shortLabel: "Retângulo",
    description: "Forma geométrica para fundos, caixas e destaques",
    defaultWidth: 300,
    defaultHeight: 160,
  },
  profile: {
    label: "Perfil",
    shortLabel: "Perfil",
    description: "Identificação visual de sujeito, agente ou entidade",
    defaultWidth: 660,
    defaultHeight: 184,
  },
  description: {
    label: "Descrição",
    shortLabel: "Descrição",
    description: "Bloco narrativo com título e formatação rica",
    defaultWidth: 420,
    defaultHeight: 210,
  },
  info: {
    label: "Informações",
    shortLabel: "Informações",
    description: "Campos estruturados de registro e metadados",
    defaultWidth: 340,
    defaultHeight: 220,
  },
};

export const CREATION_ELEMENT_ORDER: CreationElementType[] = [
  "text",
  "image",
  "profile",
  "description",
  "info",
  "rect",
  "divider",
  "line",
];

export function resolveCreationFontCss(family: CreationFontFamily): string {
  const found = CREATION_FONT_OPTIONS.find((item) => item.id === family);
  return found ? found.cssFamily : CREATION_FONT_OPTIONS[0].cssFamily;
}

export function normalizeHexOrTransparent(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.toLowerCase() === "transparent") return "transparent";
  const shortMatch = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const fullMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }
  return fallback;
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function createCreationId(prefix: string = "el"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getFallbackCreationRecordId(docId: string): string {
  return `${CREATION_RECORD_PREFIX}${docId}`;
}

export function normalizeCreationTitle(raw: unknown): string {
  if (typeof raw !== "string") return "Documento sem título";
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, 120);
  return clean || "Documento sem título";
}

export function sanitizeCreationImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)
  ) {
    return trimmed;
  }
  return "";
}

function normalizeInfoFields(raw: unknown): CreationInfoField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .slice(0, 32)
    .map((entry, idx) => ({
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id.trim()
          : `fld_${idx + 1}`,
      label: typeof entry.label === "string" ? entry.label.slice(0, 80) : "",
      value: typeof entry.value === "string" ? entry.value.slice(0, 240) : "",
    }));
}

export function createCreationElement(
  type: CreationElementType,
  options: {
    zIndex?: number;
    offsetIndex?: number;
    overrides?: Partial<CreationElement>;
  } = {},
): CreationElement {
  const meta = CREATION_ELEMENT_META[type];
  const offsetStep = ((options.offsetIndex ?? 0) % 6) * 22;
  const baseX = Math.min(A4_WIDTH_PX - meta.defaultWidth - 24, 64 + offsetStep);
  const baseY = Math.min(A4_HEIGHT_PX - meta.defaultHeight - 24, 72 + offsetStep);

  const base: CreationElement = {
    id: createCreationId(type),
    type,
    name: meta.label,
    x: Math.max(24, baseX),
    y: Math.max(24, baseY),
    width: meta.defaultWidth,
    height: meta.defaultHeight,
    zIndex: options.zIndex ?? 0,
    opacity: 1,
    visible: true,
    locked: false,

    backgroundColor: "transparent",
    borderColor: "#2c2c3a",
    borderWidth: 0,
    borderRadius: 0,
    accentColor: "#b91c1c",
    strokeColor: "#8f171c",
    strokeWidth: 2,
    lineStyle: "solid",
    lineOrientation: "horizontal",

    textColor: "#ececef",
    fontSize: 15,
    fontFamily: "mono",
    fontWeight: "normal",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    lineHeight: 1.45,
    letterSpacing: 0,
    padding: 12,

    textContent: "",
    title: "",
    subtitle: "",
    imageUrl: "",
    imageAspectRatio: null,
    lockAspectRatio: type === "image",
    objectFit: "contain",
    fields: [],
  };

  if (type === "text") {
    base.textContent = "Título ou parágrafo do documento";
    base.fontSize = 18;
    base.fontWeight = "bold";
    base.padding = 10;
  } else if (type === "image") {
    base.backgroundColor = "#12121a";
    base.borderColor = "#2a2a38";
    base.borderWidth = 1;
    base.padding = 0;
  } else if (type === "line") {
    base.strokeColor = "#8f171c";
    base.strokeWidth = 2;
    base.padding = 0;
  } else if (type === "divider") {
    base.title = "SEÇÃO CLASSIFICADA";
    base.strokeColor = "#3a3a4a";
    base.textColor = "#9b9caa";
    base.fontSize = 11;
    base.letterSpacing = 2;
    base.padding = 0;
  } else if (type === "rect") {
    base.backgroundColor = "#14141d";
    base.borderColor = "#303042";
    base.borderWidth = 1;
    base.padding = 0;
  } else if (type === "profile") {
    base.title = "SUJEITO #042";
    base.subtitle = "REGISTRO CONFIDENCIAL · SETOR DE INVESTIGAÇÃO";
    base.textContent =
      "Resumo visual de identificação, histórico breve e observações relevantes.";
    base.backgroundColor = "#12121a";
    base.borderColor = "#2a2a38";
    base.borderWidth = 1;
    base.accentColor = "#b91c1c";
    base.fontSize = 13;
    base.padding = 16;
  } else if (type === "description") {
    base.title = "RELATÓRIO DE OCORRÊNCIA";
    base.textContent =
      "Descreva os eventos observados. Você pode usar **negrito**, ^^itálico^^ e #(Dor).";
    base.backgroundColor = "#12121a";
    base.borderColor = "#2a2a38";
    base.borderWidth = 1;
    base.accentColor = "#8f171c";
    base.fontSize = 13;
    base.padding = 16;
  } else if (type === "info") {
    base.title = "DADOS DO ARQUIVO";
    base.backgroundColor = "#12121a";
    base.borderColor = "#2a2a38";
    base.borderWidth = 1;
    base.accentColor = "#8f171c";
    base.fontSize = 12;
    base.padding = 14;
    base.fields = [
      { id: createCreationId("fld"), label: "PROTOCOLO", value: "DML-014-B" },
      { id: createCreationId("fld"), label: "LOCALIZAÇÃO", value: "Setor Sul" },
      { id: createCreationId("fld"), label: "CLASSIFICAÇÃO", value: "Restrito" },
    ];
  }

  return normalizeCreationElement(
    {
      ...base,
      ...(options.overrides || {}),
      id: options.overrides?.id || base.id,
      type,
    },
    options.zIndex ?? base.zIndex,
  );
}

const VALID_ELEMENT_TYPES = new Set<CreationElementType>(CREATION_ELEMENT_ORDER);
const VALID_FONTS = new Set<CreationFontFamily>(["mono", "display", "sans", "serif"]);
const VALID_ALIGNS = new Set<CreationTextAlign>(["left", "center", "right"]);
const VALID_LINE_STYLES = new Set<CreationLineStyle>(["solid", "dashed", "dotted"]);
const VALID_LINE_ORIENTATIONS = new Set<CreationLineOrientation>([
  "horizontal",
  "vertical",
]);

export function normalizeCreationElement(
  raw: Partial<CreationElement>,
  fallbackZIndex: number = 0,
): CreationElement {
  const type: CreationElementType = VALID_ELEMENT_TYPES.has(
    raw.type as CreationElementType,
  )
    ? (raw.type as CreationElementType)
    : "text";
  const meta = CREATION_ELEMENT_META[type];

  const width = clampNumber(
    raw.width,
    MIN_CREATION_ELEMENT_WIDTH,
    A4_WIDTH_PX * 2,
    meta.defaultWidth,
  );
  const height = clampNumber(
    raw.height,
    MIN_CREATION_ELEMENT_HEIGHT,
    A4_HEIGHT_PX * 2,
    meta.defaultHeight,
  );

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : createCreationId(type),
    type,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, 64)
        : meta.label,
    x: clampNumber(raw.x, -A4_WIDTH_PX, A4_WIDTH_PX * 2, 64),
    y: clampNumber(raw.y, -A4_HEIGHT_PX, A4_HEIGHT_PX * 2, 72),
    width: Math.round(width),
    height: Math.round(height),
    zIndex:
      typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex)
        ? Math.round(raw.zIndex)
        : fallbackZIndex,
    opacity: clampNumber(raw.opacity, 0.05, 1, 1),
    visible: raw.visible !== false,
    locked: Boolean(raw.locked),

    backgroundColor: normalizeHexOrTransparent(
      raw.backgroundColor,
      type === "text" || type === "line" || type === "divider"
        ? "transparent"
        : "#12121a",
    ),
    borderColor: normalizeHexOrTransparent(raw.borderColor, "#2c2c3a"),
    borderWidth: clampNumber(raw.borderWidth, 0, 12, 0),
    borderRadius: clampNumber(raw.borderRadius, 0, 48, 0),
    accentColor: normalizeHexOrTransparent(raw.accentColor, "#b91c1c"),
    strokeColor: normalizeHexOrTransparent(raw.strokeColor, "#8f171c"),
    strokeWidth: clampNumber(raw.strokeWidth, 1, 16, 2),
    lineStyle: VALID_LINE_STYLES.has(raw.lineStyle as CreationLineStyle)
      ? (raw.lineStyle as CreationLineStyle)
      : "solid",
    lineOrientation: VALID_LINE_ORIENTATIONS.has(
      raw.lineOrientation as CreationLineOrientation,
    )
      ? (raw.lineOrientation as CreationLineOrientation)
      : "horizontal",

    textColor: normalizeHexOrTransparent(raw.textColor, "#ececef"),
    fontSize: clampNumber(raw.fontSize, 8, 96, 14),
    fontFamily: VALID_FONTS.has(raw.fontFamily as CreationFontFamily)
      ? (raw.fontFamily as CreationFontFamily)
      : "mono",
    fontWeight: raw.fontWeight === "bold" ? "bold" : "normal",
    fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
    textDecoration: raw.textDecoration === "underline" ? "underline" : "none",
    textAlign: VALID_ALIGNS.has(raw.textAlign as CreationTextAlign)
      ? (raw.textAlign as CreationTextAlign)
      : "left",
    lineHeight: clampNumber(raw.lineHeight, 1, 2.6, 1.45),
    letterSpacing: clampNumber(raw.letterSpacing, -2, 12, 0),
    padding: clampNumber(raw.padding, 0, 48, 12),

    textContent:
      typeof raw.textContent === "string" ? raw.textContent.slice(0, 8000) : "",
    title: typeof raw.title === "string" ? raw.title.slice(0, 180) : "",
    subtitle:
      typeof raw.subtitle === "string" ? raw.subtitle.slice(0, 240) : "",
    imageUrl: sanitizeCreationImageUrl(raw.imageUrl),
    imageAspectRatio:
      typeof raw.imageAspectRatio === "number" &&
      Number.isFinite(raw.imageAspectRatio) &&
      raw.imageAspectRatio > 0.05 &&
      raw.imageAspectRatio < 20
        ? raw.imageAspectRatio
        : null,
    lockAspectRatio:
      typeof raw.lockAspectRatio === "boolean"
        ? raw.lockAspectRatio
        : type === "image",
    objectFit: raw.objectFit === "cover" ? "cover" : "contain",
    fields: normalizeInfoFields(raw.fields),
  };
}

export function normalizeLayerOrder(
  elements: CreationElement[],
): CreationElement[] {
  return [...elements]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el, idx) => ({ ...el, zIndex: idx }));
}

export function createEmptyCreationDocument(
  masterId: string,
  title?: string,
): CreationDocument {
  const now = new Date().toISOString();
  return {
    id: createCreationId("doc"),
    masterId,
    title: normalizeCreationTitle(title || "Novo Documento A4"),
    pageBackground: CREATION_DEFAULT_PAGE_BG,
    pageBorderColor: CREATION_DEFAULT_PAGE_BORDER,
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeCreationDocument(
  raw: Partial<CreationDocument>,
  fallbackMasterId: string,
): CreationDocument {
  const now = new Date().toISOString();
  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  const normalized = normalizeLayerOrder(
    rawElements.map((item, idx) => normalizeCreationElement(item, idx)),
  );
  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : createCreationId("doc"),
    masterId:
      typeof raw.masterId === "string" && raw.masterId.trim()
        ? raw.masterId.trim()
        : fallbackMasterId,
    title: normalizeCreationTitle(raw.title),
    pageBackground: normalizeHexOrTransparent(
      raw.pageBackground,
      CREATION_DEFAULT_PAGE_BG,
    ),
    pageBorderColor: normalizeHexOrTransparent(
      raw.pageBorderColor,
      CREATION_DEFAULT_PAGE_BORDER,
    ),
    elements: normalized,
    createdAt: typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : now,
  };
}

export function toCreationDocumentSummary(
  doc: CreationDocument,
): CreationDocumentSummary {
  return {
    id: doc.id,
    masterId: doc.masterId,
    title: normalizeCreationTitle(doc.title),
    pageBackground: normalizeHexOrTransparent(
      doc.pageBackground,
      CREATION_DEFAULT_PAGE_BG,
    ),
    elementsCount: Array.isArray(doc.elements) ? doc.elements.length : 0,
    updatedAt: doc.updatedAt,
  };
}

export function sortCreationSummaries(
  list: CreationDocumentSummary[],
): CreationDocumentSummary[] {
  return [...list].sort((a, b) => {
    const tA = Date.parse(a.updatedAt) || 0;
    const tB = Date.parse(b.updatedAt) || 0;
    return tB - tA;
  });
}

// --- Pure Document & Layer Operations ---

export function addElementToDocument(
  doc: CreationDocument,
  type: CreationElementType,
  overrides?: Partial<CreationElement>,
): { doc: CreationDocument; element: CreationElement } {
  const nextZ = doc.elements.length;
  const element = createCreationElement(type, {
    zIndex: nextZ,
    offsetIndex: doc.elements.length,
    overrides,
  });
  return {
    element,
    doc: {
      ...doc,
      elements: normalizeLayerOrder([...doc.elements, element]),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateElementInDocument(
  doc: CreationDocument,
  elementId: string,
  patch: Partial<CreationElement>,
): CreationDocument {
  let changed = false;
  const next = doc.elements.map((el) => {
    if (el.id !== elementId) return el;
    changed = true;
    return normalizeCreationElement(
      { ...el, ...patch, id: el.id, type: el.type },
      el.zIndex,
    );
  });
  if (!changed) return doc;
  return {
    ...doc,
    elements: normalizeLayerOrder(next),
    updatedAt: new Date().toISOString(),
  };
}

export function removeElementFromDocument(
  doc: CreationDocument,
  elementId: string,
): CreationDocument {
  const next = doc.elements.filter((el) => el.id !== elementId);
  if (next.length === doc.elements.length) return doc;
  return {
    ...doc,
    elements: normalizeLayerOrder(next),
    updatedAt: new Date().toISOString(),
  };
}

export function cloneElementForInsert(
  source: CreationElement,
  nextZIndex: number,
  offsetPx: number = 22,
): CreationElement {
  return normalizeCreationElement(
    {
      ...source,
      id: createCreationId(source.type),
      name: `${source.name} (Cópia)`.slice(0, 64),
      x: Math.min(A4_WIDTH_PX - 32, source.x + offsetPx),
      y: Math.min(A4_HEIGHT_PX - 32, source.y + offsetPx),
      locked: false,
      zIndex: nextZIndex,
      fields: source.fields.map((f) => ({
        ...f,
        id: createCreationId("fld"),
      })),
    },
    nextZIndex,
  );
}

export function duplicateElementInDocument(
  doc: CreationDocument,
  elementId: string,
): { doc: CreationDocument; element: CreationElement | null } {
  const source = doc.elements.find((el) => el.id === elementId);
  if (!source) return { doc, element: null };
  const cloned = cloneElementForInsert(source, doc.elements.length);
  return {
    element: cloned,
    doc: {
      ...doc,
      elements: normalizeLayerOrder([...doc.elements, cloned]),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function bringElementToFront(
  doc: CreationDocument,
  elementId: string,
): CreationDocument {
  const ordered = normalizeLayerOrder(doc.elements);
  const idx = ordered.findIndex((el) => el.id === elementId);
  if (idx === -1 || idx === ordered.length - 1) return doc;
  const [target] = ordered.splice(idx, 1);
  ordered.push(target);
  return {
    ...doc,
    elements: ordered.map((el, i) => ({ ...el, zIndex: i })),
    updatedAt: new Date().toISOString(),
  };
}

export function sendElementToBack(
  doc: CreationDocument,
  elementId: string,
): CreationDocument {
  const ordered = normalizeLayerOrder(doc.elements);
  const idx = ordered.findIndex((el) => el.id === elementId);
  if (idx <= 0) return doc;
  const [target] = ordered.splice(idx, 1);
  ordered.unshift(target);
  return {
    ...doc,
    elements: ordered.map((el, i) => ({ ...el, zIndex: i })),
    updatedAt: new Date().toISOString(),
  };
}

export function moveElementLayerStep(
  doc: CreationDocument,
  elementId: string,
  direction: "up" | "down",
): CreationDocument {
  const ordered = normalizeLayerOrder(doc.elements);
  const idx = ordered.findIndex((el) => el.id === elementId);
  if (idx === -1) return doc;
  const targetIdx = direction === "up" ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= ordered.length) return doc;
  const [moved] = ordered.splice(idx, 1);
  ordered.splice(targetIdx, 0, moved);
  return {
    ...doc,
    elements: ordered.map((el, i) => ({ ...el, zIndex: i })),
    updatedAt: new Date().toISOString(),
  };
}

export function reorderElementLayerById(
  doc: CreationDocument,
  sourceId: string,
  targetId: string,
): CreationDocument {
  if (sourceId === targetId) return doc;
  const ordered = normalizeLayerOrder(doc.elements);
  const fromIdx = ordered.findIndex((el) => el.id === sourceId);
  const toIdx = ordered.findIndex((el) => el.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return doc;
  const [moved] = ordered.splice(fromIdx, 1);
  ordered.splice(toIdx, 0, moved);
  return {
    ...doc,
    elements: ordered.map((el, i) => ({ ...el, zIndex: i })),
    updatedAt: new Date().toISOString(),
  };
}

// --- Aspect-Ratio-Aware Resize Geometry ---

export function computeResizedElementBox(
  startBox: { x: number; y: number; width: number; height: number },
  handle: CreationResizeHandle,
  dx: number,
  dy: number,
  options: {
    lockAspectRatio?: boolean;
    aspectRatio?: number | null;
    minWidth?: number;
    minHeight?: number;
  } = {},
): { x: number; y: number; width: number; height: number } {
  const minW = options.minWidth ?? MIN_CREATION_ELEMENT_WIDTH;
  const minH = options.minHeight ?? MIN_CREATION_ELEMENT_HEIGHT;

  let x = startBox.x;
  let y = startBox.y;
  let width = startBox.width;
  let height = startBox.height;

  const affectsWest = handle === "w" || handle === "nw" || handle === "sw";
  const affectsEast = handle === "e" || handle === "ne" || handle === "se";
  const affectsNorth = handle === "n" || handle === "nw" || handle === "ne";
  const affectsSouth = handle === "s" || handle === "sw" || handle === "se";

  if (affectsEast) {
    width = Math.max(minW, startBox.width + dx);
  }
  if (affectsWest) {
    const nextW = Math.max(minW, startBox.width - dx);
    x = startBox.x + (startBox.width - nextW);
    width = nextW;
  }
  if (affectsSouth) {
    height = Math.max(minH, startBox.height + dy);
  }
  if (affectsNorth) {
    const nextH = Math.max(minH, startBox.height - dy);
    y = startBox.y + (startBox.height - nextH);
    height = nextH;
  }

  const ratio =
    options.lockAspectRatio &&
    typeof options.aspectRatio === "number" &&
    Number.isFinite(options.aspectRatio) &&
    options.aspectRatio > 0
      ? options.aspectRatio
      : options.lockAspectRatio && startBox.height > 0
        ? startBox.width / startBox.height
        : null;

  if (ratio) {
    const isHorizontalOnly = handle === "e" || handle === "w";
    const isVerticalOnly = handle === "n" || handle === "s";
    if (isVerticalOnly) {
      width = Math.max(minW, Math.round(height * ratio));
    } else if (isHorizontalOnly) {
      height = Math.max(minH, Math.round(width / ratio));
    } else {
      // Corner drag: drive from dominant axis change
      const widthDeltaRatio = Math.abs(width - startBox.width) / Math.max(1, startBox.width);
      const heightDeltaRatio = Math.abs(height - startBox.height) / Math.max(1, startBox.height);
      if (widthDeltaRatio >= heightDeltaRatio) {
        const nextH = Math.max(minH, Math.round(width / ratio));
        if (affectsNorth) {
          y = startBox.y + (startBox.height - nextH);
        }
        height = nextH;
      } else {
        const nextW = Math.max(minW, Math.round(height * ratio));
        if (affectsWest) {
          x = startBox.x + (startBox.width - nextW);
        }
        width = nextW;
      }
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

// --- Immutable Undo / Redo History ---

export function createCreationHistory(
  initial: CreationDocument,
): CreationHistoryState {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushCreationHistory(
  state: CreationHistoryState,
  nextDoc: CreationDocument,
): CreationHistoryState {
  if (nextDoc === state.present) return state;
  const past = [...state.past, state.present];
  if (past.length > MAX_CREATION_HISTORY) {
    past.splice(0, past.length - MAX_CREATION_HISTORY);
  }
  return {
    past,
    present: nextDoc,
    future: [],
  };
}

export function undoCreationHistory(
  state: CreationHistoryState,
): CreationHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, MAX_CREATION_HISTORY),
  };
}

export function redoCreationHistory(
  state: CreationHistoryState,
): CreationHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    past: [...state.past, state.present].slice(-MAX_CREATION_HISTORY),
    present: next,
    future: state.future.slice(1),
  };
}

// --- Image File Validation & Export Filename ---

const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const ALLOWED_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

export function validateCreationImageFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  const size = typeof file.size === "number" ? file.size : 0;
  if (size <= 0) {
    return { ok: false, error: "O arquivo de imagem selecionado está vazio." };
  }
  if (size > MAX_CREATION_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Imagem muito grande. Utilize arquivos de até 10 MB.",
    };
  }
  const mime = (file.type || "").trim().toLowerCase();
  if (mime) {
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      return {
        ok: false,
        error: "Formato não suportado. Use imagens PNG (recomendado), JPG ou WebP.",
      };
    }
    return { ok: true, mimeType: mime === "image/jpg" ? "image/jpeg" : mime };
  }
  const ext = (file.name || "").split(".").pop()?.trim().toLowerCase() || "";
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return {
      ok: false,
      error: "Formato não suportado. Use imagens PNG (recomendado), JPG ou WebP.",
    };
  }
  return {
    ok: true,
    mimeType:
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg",
  };
}

export function buildCreationExportFilename(
  title: string,
  format: CreationExportFormat,
): string {
  const slug = (title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const base = slug || "documento_a4";
  return `criacao_${base}.${format}`;
}
