import {
  RITUAL_AFFILIATION_LIST,
  type RitualAffiliationDefinition,
  type RitualAffiliationId,
} from "./rituals";

export type RichTextInlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; children: RichTextInlineToken[] }
  | { type: "italic"; children: RichTextInlineToken[] }
  | { type: "affiliation"; affiliationId: RitualAffiliationId; raw: string };

export type RichTextLineBlock =
  | { type: "divider" }
  | { type: "paragraph"; tokens: RichTextInlineToken[] }
  | { type: "empty" };

/**
 * Normaliza texto para comparação exata de nome completo de Afiliação:
 * remove acentos, aplica lowercase e colapsa espaços nas pontas.
 * Nunca faz correspondência parcial (ex: "Do" não corresponde a "Dor").
 */
function normalizeAffiliationLookupKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const AFFILIATION_LOOKUP_MAP: ReadonlyMap<string, RitualAffiliationDefinition> = (() => {
  const map = new Map<string, RitualAffiliationDefinition>();
  for (const def of RITUAL_AFFILIATION_LIST) {
    map.set(normalizeAffiliationLookupKey(def.label), def);
    map.set(normalizeAffiliationLookupKey(def.id), def);
  }
  return map;
})();

/**
 * Busca uma Afiliação registrada pelo nome completo (sem correspondência parcial).
 * Retorna a definição oficial ou `null` caso não exista no registro.
 */
export function findRegisteredAffiliationByName(
  rawName: string,
): RitualAffiliationDefinition | null {
  if (typeof rawName !== "string") return null;
  const key = normalizeAffiliationLookupKey(rawName);
  if (!key) return null;
  return AFFILIATION_LOOKUP_MAP.get(key) ?? null;
}

/**
 * Verifica se uma linha representa uma linha divisória estilo Obsidian ("---").
 */
export function isObsidianDividerLine(line: string): boolean {
  return /^\s*-{3,}\s*$/.test(line);
}

/**
 * Faz o parse inline de:
 * - **negrito**
 * - ^^itálico^^
 * - #(Nome da Afiliação) -> token visual apenas quando corresponde ao nome completo registrado
 *
 * Sem HTML bruto / XSS: produz uma AST segura para renderização direta em React.
 */
export function parseCreatureInlineText(
  input: string,
  depth: number = 0,
): RichTextInlineToken[] {
  if (!input) return [];
  if (depth > 4) {
    return [{ type: "text", value: input }];
  }

  const tokens: RichTextInlineToken[] = [];
  let cursor = 0;
  let textBuffer = "";

  const flushText = () => {
    if (textBuffer) {
      tokens.push({ type: "text", value: textBuffer });
      textBuffer = "";
    }
  };

  while (cursor < input.length) {
    // 1. Negrito: **texto**
    if (input[cursor] === "*" && input[cursor + 1] === "*") {
      const closeIdx = input.indexOf("**", cursor + 2);
      if (closeIdx > cursor + 2) {
        const inner = input.slice(cursor + 2, closeIdx);
        flushText();
        tokens.push({
          type: "bold",
          children: parseCreatureInlineText(inner, depth + 1),
        });
        cursor = closeIdx + 2;
        continue;
      }
    }

    // 2. Itálico: ^^texto^^
    if (input[cursor] === "^" && input[cursor + 1] === "^") {
      const closeIdx = input.indexOf("^^", cursor + 2);
      if (closeIdx > cursor + 2) {
        const inner = input.slice(cursor + 2, closeIdx);
        flushText();
        tokens.push({
          type: "italic",
          children: parseCreatureInlineText(inner, depth + 1),
        });
        cursor = closeIdx + 2;
        continue;
      }
    }

    // 3. Menção de Afiliação: #(Nome da Afiliação)
    if (input[cursor] === "#" && input[cursor + 1] === "(") {
      const closeIdx = input.indexOf(")", cursor + 2);
      if (closeIdx > cursor + 2) {
        const rawMention = input.slice(cursor, closeIdx + 1);
        const candidateName = input.slice(cursor + 2, closeIdx);
        const matched = findRegisteredAffiliationByName(candidateName);
        if (matched) {
          flushText();
          tokens.push({
            type: "affiliation",
            affiliationId: matched.id,
            raw: rawMention,
          });
          cursor = closeIdx + 1;
          continue;
        }
        // Não registrada -> mantém exatamente como texto simples, sem erro
        textBuffer += rawMention;
        cursor = closeIdx + 1;
        continue;
      }
    }

    textBuffer += input[cursor];
    cursor += 1;
  }

  flushText();
  return tokens;
}

/**
 * Converte um texto multilinha em blocos de linhas (parágrafos, linhas vazias e divisórias `---`).
 */
export function parseCreatureRichText(source: string): RichTextLineBlock[] {
  if (!source) return [];
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  return lines.map((line) => {
    if (isObsidianDividerLine(line)) {
      return { type: "divider" };
    }
    if (line.trim() === "") {
      return { type: "empty" };
    }
    return {
      type: "paragraph",
      tokens: parseCreatureInlineText(line),
    };
  });
}

/**
 * Extrai prévia limpa (sem marcações ** / ^^ / ---) para exibição na lista de criaturas.
 */
export function stripCreatureRichTextForPreview(source: string): string {
  if (!source) return "";
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !isObsidianDividerLine(line))
    .join(" ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\^\^([^^]+)\^\^/g, "$1")
    .replace(/#\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
