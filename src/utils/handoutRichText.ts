import type { HandoutType } from "../types/handouts";
import { stripCreatureRichTextForPreview } from "./creatureRichText";
import {
  MasterNoteHeadingLevel,
  applyHeadingPrefixToLine,
} from "./masterNotes";

export type HandoutReadingSurface = "paper" | "dark";

const TYPE_ACCESSION_PREFIX: Record<HandoutType, string> = {
  documento: "DOC",
  imagem: "IMG",
  texto: "TXT",
  pista: "PST",
  outro: "ARQ",
};

/**
 * Gera um código arquivístico determinístico a partir do tipo e ID do handout
 * (ex: DOC-4F9A) para reforçar a estética de dossiê classificado sem dados falsos.
 */
export function getHandoutAccessionCode(handout: {
  id: string;
  type: HandoutType;
}): string {
  const prefix = TYPE_ACCESSION_PREFIX[handout.type] || "DOC";
  const raw = (handout.id || "").trim();
  if (!raw) return `${prefix}-0000`;

  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(16).toUpperCase().padStart(4, "0").slice(0, 4);
  return `${prefix}-${suffix}`;
}

/**
 * Define a superfície de leitura inicial mais imersiva para cada tipo de material:
 * documentos e textos abrem em papel arquivístico; imagens e pistas abrem em terminal escuro.
 */
export function getDefaultHandoutReadingSurface(
  type: HandoutType
): HandoutReadingSurface {
  if (type === "documento" || type === "texto") {
    return "paper";
  }
  return "dark";
}

/**
 * Remove marcações de título (#h1..#h6), negrito (**), itálico (^^), divisórias (---)
 * e menções #(Afiliação) para prévias limpas nos cards e busca textual.
 */
export function stripHandoutRichTextForPreview(
  source: string | null | undefined,
  maxLength?: number
): string {
  if (typeof source !== "string" || !source.trim()) return "";
  const withoutHeadings = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*#h[1-6](?:\s+|:\s*)/i, ""))
    .join("\n");
  const cleaned = stripCreatureRichTextForPreview(withoutHeadings);
  if (typeof maxLength === "number" && maxLength > 1 && cleaned.length > maxLength) {
    return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return cleaned;
}

/**
 * Insere ou envolve a seleção atual com formatação inline no editor de Handout.
 */
export function applyHandoutInlineFormat(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  format:
    | { kind: "bold" }
    | { kind: "italic" }
    | { kind: "divider" }
    | { kind: "affiliation"; label: string }
    | { kind: "heading"; level: MasterNoteHeadingLevel }
): { content: string; nextSelectionStart: number; nextSelectionEnd: number } {
  const safeStart = Math.max(0, Math.min(content.length, selectionStart));
  const safeEnd = Math.max(safeStart, Math.min(content.length, selectionEnd));

  if (format.kind === "heading") {
    const res = applyHeadingPrefixToLine(content, safeStart, format.level);
    return {
      content: res.content,
      nextSelectionStart: res.nextCursor,
      nextSelectionEnd: res.nextCursor,
    };
  }

  const before = content.slice(0, safeStart);
  const selected = content.slice(safeStart, safeEnd);
  const after = content.slice(safeEnd);

  if (format.kind === "bold" || format.kind === "italic") {
    const marker = format.kind === "bold" ? "**" : "^^";
    const inner = selected || (format.kind === "bold" ? "texto" : "itálico");
    const inserted = `${marker}${inner}${marker}`;
    const nextContent = `${before}${inserted}${after}`;
    return {
      content: nextContent,
      nextSelectionStart: safeStart + marker.length,
      nextSelectionEnd: safeStart + marker.length + inner.length,
    };
  }

  if (format.kind === "divider") {
    const needsLeadingNl = before.length > 0 && !before.endsWith("\n");
    const needsTrailingNl = after.length > 0 && !after.startsWith("\n");
    const inserted = `${needsLeadingNl ? "\n" : ""}---${needsTrailingNl ? "\n" : "\n"}`;
    const nextContent = `${before}${inserted}${after}`;
    const cursor = safeStart + inserted.length;
    return {
      content: nextContent,
      nextSelectionStart: cursor,
      nextSelectionEnd: cursor,
    };
  }

  const mention = `#(${format.label})`;
  const nextContent = `${before}${mention}${after}`;
  const cursor = safeStart + mention.length;
  return {
    content: nextContent,
    nextSelectionStart: cursor,
    nextSelectionEnd: cursor,
  };
}
