import {
  CUSTOM_AFFILIATION_ID_PREFIX,
  RITUAL_AFFILIATION_LIST,
  RitualAffiliationDefinition,
  isBuiltInRitualAffiliationId,
  isCustomRitualAffiliationIdFormat,
} from "./rituals";

export const CUSTOM_AFFILIATIONS_RECORD_ID = "CUSTOM_AFFILIATIONS_SHARED";
export const CUSTOM_AFFILIATIONS_LOCAL_KEY = "demologia_custom_affiliations_v1";
export const MAX_CUSTOM_AFFILIATION_NAME_LENGTH = 32;

export interface CustomAffiliationRecord extends RitualAffiliationDefinition {
  id: string;
  label: string;
  background: string;
  textColor: string;
  borderColor: string;
  isCustom: true;
  createdAt: number;
  updatedAt: number;
}

export interface CustomAffiliationDraft {
  id?: string;
  label: string;
  background: string;
  textColor: string;
}

export interface CustomAffiliationColorPreset {
  name: string;
  background: string;
  textColor: string;
}

export const CUSTOM_AFFILIATION_PRESETS: readonly CustomAffiliationColorPreset[] = [
  { name: "Abismo", background: "#14141f", textColor: "#e4e4ee" },
  { name: "Sangue Seco", background: "#5c0f16", textColor: "#fce7ea" },
  { name: "Cinza Clínica", background: "#374151", textColor: "#f3f4f6" },
  { name: "Ferrugem", background: "#7c2d12", textColor: "#ffedd5" },
  { name: "Musgo Oculto", background: "#1e3a2f", textColor: "#d1fae5" },
  { name: "Âmbar Pálido", background: "#eab308", textColor: "#141002" },
  { name: "Osso", background: "#d6cfc2", textColor: "#141210" },
  { name: "Índigo Profundo", background: "#1e1b4b", textColor: "#e0e7ff" },
];

export function normalizeAffiliationNameKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const BUILTIN_NAME_KEYS = new Set<string>(
  RITUAL_AFFILIATION_LIST.flatMap((aff) => [
    normalizeAffiliationNameKey(aff.label),
    normalizeAffiliationNameKey(aff.id),
  ])
);

export function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const shortMatch = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const fullMatch = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g)
    .toString(16)
    .padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calcula a razão de contraste WCAG (1 a 21) entre duas cores HEX.
 */
export function getHexContrastRatio(hexA: string, hexB: string): number {
  const a = normalizeHexColor(hexA);
  const b = normalizeHexColor(hexB);
  if (!a || !b) return 1;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Gera uma cor de borda discreta e legível derivada do fundo e do texto.
 */
export function deriveAffiliationBorderColor(
  backgroundHex: string,
  textColorHex: string
): string {
  const bg = normalizeHexColor(backgroundHex) ?? "#262634";
  const fg = normalizeHexColor(textColorHex) ?? "#ffffff";
  const [br, bgG, bb] = hexToRgb(bg);
  const [fr, fgG, fb] = hexToRgb(fg);
  const bgLum = relativeLuminance(bg);

  // Fundos muito claros recebem borda levemente escurecida; escuros recebem realce suave
  if (bgLum > 0.65) {
    return rgbToHex(br * 0.62, bgG * 0.62, bb * 0.62);
  }
  const mix = 0.28;
  return rgbToHex(
    br + (fr - br) * mix,
    bgG + (fgG - bgG) * mix,
    bb + (fb - bb) * mix
  );
}

export function buildCustomAffiliationId(
  label: string,
  existingIds: ReadonlySet<string>
): string {
  const baseSlug = normalizeAffiliationNameKey(label)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const core = baseSlug || "afiliacao";
  let candidate = `${CUSTOM_AFFILIATION_ID_PREFIX}${core}`;
  let suffix = 2;
  while (existingIds.has(candidate) || isBuiltInRitualAffiliationId(candidate)) {
    candidate = `${CUSTOM_AFFILIATION_ID_PREFIX}${core}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function normalizeCustomAffiliation(
  raw: unknown
): CustomAffiliationRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id.trim().toLowerCase() : "";
  const label =
    typeof obj.label === "string"
      ? obj.label.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_AFFILIATION_NAME_LENGTH)
      : "";

  if (!label || !isCustomRitualAffiliationIdFormat(id) || isBuiltInRitualAffiliationId(id)) {
    return null;
  }
  if (/[()]/.test(label)) {
    return null;
  }
  if (BUILTIN_NAME_KEYS.has(normalizeAffiliationNameKey(label))) {
    return null;
  }

  const background = normalizeHexColor(obj.background);
  const textColor = normalizeHexColor(obj.textColor);
  if (!background || !textColor) return null;

  const borderColor =
    normalizeHexColor(obj.borderColor) ??
    deriveAffiliationBorderColor(background, textColor);
  const now = Date.now();
  const createdAt =
    typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt)
      ? obj.createdAt
      : now;
  const updatedAt =
    typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)
      ? obj.updatedAt
      : createdAt;

  return {
    id,
    label,
    background,
    textColor,
    borderColor,
    isCustom: true,
    createdAt,
    updatedAt,
  };
}

export function normalizeCustomAffiliations(
  raw: unknown
): CustomAffiliationRecord[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: CustomAffiliationRecord[] = [];

  for (const entry of raw) {
    const normalized = normalizeCustomAffiliation(entry);
    if (!normalized) continue;
    const nameKey = normalizeAffiliationNameKey(normalized.label);
    if (seenIds.has(normalized.id) || seenNames.has(nameKey)) continue;
    seenIds.add(normalized.id);
    seenNames.add(nameKey);
    out.push(normalized);
  }

  return out;
}

export function upsertCustomAffiliation(
  current: readonly CustomAffiliationRecord[],
  draft: CustomAffiliationDraft
):
  | {
      ok: true;
      affiliation: CustomAffiliationRecord;
      affiliations: CustomAffiliationRecord[];
      isEdit: boolean;
    }
  | { ok: false; error: string } {
  const cleanLabel = (draft.label || "").trim().replace(/\s+/g, " ");
  if (!cleanLabel) {
    return { ok: false, error: "Informe o nome da afiliação." };
  }
  if (cleanLabel.length > MAX_CUSTOM_AFFILIATION_NAME_LENGTH) {
    return {
      ok: false,
      error: `O nome da afiliação deve ter no máximo ${MAX_CUSTOM_AFFILIATION_NAME_LENGTH} caracteres.`,
    };
  }
  if (/[()]/.test(cleanLabel)) {
    return {
      ok: false,
      error: 'O nome da afiliação não pode conter parênteses "(" ou ")".',
    };
  }

  const nameKey = normalizeAffiliationNameKey(cleanLabel);
  if (BUILTIN_NAME_KEYS.has(nameKey)) {
    return {
      ok: false,
      error: `"${cleanLabel}" já existe entre as afiliações oficiais de Demologia.`,
    };
  }

  const editingId =
    typeof draft.id === "string" && draft.id.trim()
      ? draft.id.trim().toLowerCase()
      : null;

  const duplicateCustom = current.find(
    (item) =>
      item.id !== editingId &&
      normalizeAffiliationNameKey(item.label) === nameKey
  );
  if (duplicateCustom) {
    return {
      ok: false,
      error: `Já existe uma afiliação personalizada chamada "${duplicateCustom.label}".`,
    };
  }

  const background = normalizeHexColor(draft.background);
  if (!background) {
    return {
      ok: false,
      error: "Cor de fundo inválida. Use um código HEX válido (ex: #5c0f16).",
    };
  }

  const textColor = normalizeHexColor(draft.textColor);
  if (!textColor) {
    return {
      ok: false,
      error: "Cor de texto inválida. Use um código HEX válido (ex: #ffffff).",
    };
  }

  const now = Date.now();
  const borderColor = deriveAffiliationBorderColor(background, textColor);

  if (editingId) {
    const existing = current.find((item) => item.id === editingId);
    if (!existing) {
      return { ok: false, error: "Afiliação não encontrada para edição." };
    }
    const updated: CustomAffiliationRecord = {
      ...existing,
      label: cleanLabel,
      background,
      textColor,
      borderColor,
      isCustom: true,
      updatedAt: now,
    };
    return {
      ok: true,
      affiliation: updated,
      affiliations: current.map((item) =>
        item.id === editingId ? updated : item
      ),
      isEdit: true,
    };
  }

  const existingIds = new Set(current.map((item) => item.id));
  const created: CustomAffiliationRecord = {
    id: buildCustomAffiliationId(cleanLabel, existingIds),
    label: cleanLabel,
    background,
    textColor,
    borderColor,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ok: true,
    affiliation: created,
    affiliations: [...current, created],
    isEdit: false,
  };
}

export function removeCustomAffiliation(
  current: readonly CustomAffiliationRecord[],
  affiliationId: string
): {
  ok: true;
  removed: CustomAffiliationRecord | null;
  affiliations: CustomAffiliationRecord[];
} {
  const normalizedId = affiliationId.trim().toLowerCase();
  const removed = current.find((item) => item.id === normalizedId) ?? null;
  return {
    ok: true,
    removed,
    affiliations: current.filter((item) => item.id !== normalizedId),
  };
}
