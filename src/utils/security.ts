/**
 * Camada centralizada de endurecimento de segurança do Demologia Hub:
 * 1. Sanitização estrita de HTML de histórico de rolagens (proteção anti-XSS na ficha e Hub do Mestre).
 * 2. Validação segura de importação JSON (limite de tamanho, proteção contra prototype pollution e XSS).
 * 3. Validação de payloads recebidos via Realtime Broadcast.
 * 4. Comparação em tempo constante e controle anti força-bruta para acesso do Mestre.
 */

const ALLOWED_HTML_TAGS = new Set(["span", "b", "strong", "em", "i", "br", "small"]);

const SAFE_COLOR_REGEX =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|var\(--[a-z0-9-]+\)|[a-z]{3,20})$/i;

const SAFE_FONT_WEIGHT_REGEX = /^(normal|bold|bolder|lighter|[1-9]00)$/i;
const SAFE_FONT_STYLE_REGEX = /^(normal|italic)$/i;

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeInlineStyle(rawStyle: string): string {
  if (!rawStyle) return "";
  // Bloquear qualquer referência a url(), expression(), import ou protocolos
  if (/url\s*\(|expression\s*\(|javascript:|vbscript:|data:|@import/i.test(rawStyle)) {
    return "";
  }

  const declarations = rawStyle.split(";");
  const safeParts: string[] = [];

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val) continue;

    if (prop === "color" && SAFE_COLOR_REGEX.test(val)) {
      safeParts.push(`color: ${val}`);
    } else if (prop === "font-weight" && SAFE_FONT_WEIGHT_REGEX.test(val)) {
      safeParts.push(`font-weight: ${val}`);
    } else if (prop === "font-style" && SAFE_FONT_STYLE_REGEX.test(val)) {
      safeParts.push(`font-style: ${val}`);
    } else if (prop === "opacity") {
      const num = Number(val);
      if (Number.isFinite(num) && num >= 0 && num <= 1) {
        safeParts.push(`opacity: ${num}`);
      }
    }
  }

  return safeParts.join("; ");
}

/**
 * Sanitizador HTML baseado em whitelist estrita para entradas de histórico de rolagem.
 * Funciona tanto em navegador quanto em Node/testes (parser determinístico sem depender de DOM).
 * Remove scripts, iframes, imagens, svgs, atributos `on*`, URLs `javascript:`/`data:` e tags não autorizadas.
 */
export function sanitizeRollHistoryHtml(raw: unknown): string {
  if (typeof raw !== "string") return "";
  if (!raw.trim()) return "";

  // 1. Remover completamente blocos perigosos incluindo seu conteúdo interno
  const withoutDangerousBlocks = raw.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );

  // 2. Percorrer tokens de tags vs texto puro
  const tagRegex = /<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi;
  let output = "";
  let lastIndex = 0;
  const openStack: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(withoutDangerousBlocks)) !== null) {
    // Escapar texto anterior à tag
    if (match.index > lastIndex) {
      output += escapeHtmlText(withoutDangerousBlocks.slice(lastIndex, match.index));
    }
    lastIndex = tagRegex.lastIndex;

    const isClosing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const rawAttrs = match[3] || "";

    if (!ALLOWED_HTML_TAGS.has(tagName)) {
      continue;
    }

    if (tagName === "br") {
      if (!isClosing) output += "<br />";
      continue;
    }

    if (isClosing) {
      const stackIdx = openStack.lastIndexOf(tagName);
      if (stackIdx !== -1) {
        while (openStack.length > stackIdx) {
          const popped = openStack.pop()!;
          output += `</${popped}>`;
        }
      }
      continue;
    }

    // Permitir apenas o atributo `style` sanitizado (em tags inline permitidas)
    let safeStyleAttr = "";
    const styleMatch = rawAttrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (styleMatch) {
      const cleaned = sanitizeInlineStyle(styleMatch[1] ?? styleMatch[2] ?? "");
      if (cleaned) {
        safeStyleAttr = ` style="${cleaned.replace(/"/g, "&quot;")}"`;
      }
    }

    openStack.push(tagName);
    output += `<${tagName}${safeStyleAttr}>`;
  }

  // Escapar texto restante
  if (lastIndex < withoutDangerousBlocks.length) {
    output += escapeHtmlText(withoutDangerousBlocks.slice(lastIndex));
  }

  // Fechar quaisquer tags abertas para impedir quebra do layout pai
  while (openStack.length > 0) {
    output += `</${openStack.pop()!}>`;
  }

  return output;
}

const MAX_IMPORT_JSON_BYTES = 512 * 1024; // 512 KB
const FORBIDDEN_PROTO_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function stripDangerousKeysDeep<T>(value: T, depth = 0): T {
  if (depth > 12 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousKeysDeep(item, depth + 1)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PROTO_KEYS.has(k)) continue;
    clean[k] = stripDangerousKeysDeep(v, depth + 1);
  }
  return clean as T;
}

export interface SheetImportValidationResult {
  ok: boolean;
  sheet?: Record<string, any>;
  error?: string;
}

/**
 * Valida e higieniza um JSON de ficha importado pelo usuário:
 * - Impõe limite de tamanho (512 KB)
 * - Remove chaves de prototype pollution (`__proto__`, `constructor`, `prototype`)
 * - Verifica estrutura mínima (`hp` e `pe` válidos)
 * - Sanitiza todo o `history[]` contra XSS
 */
export function sanitizeImportedSheetJson(rawText: string): SheetImportValidationResult {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return { ok: false, error: "Arquivo JSON vazio." };
  }
  if (rawText.length > MAX_IMPORT_JSON_BYTES) {
    return { ok: false, error: "Arquivo excede o limite seguro de 512 KB." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Erro ao ler o arquivo JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Arquivo JSON inválido para esta ficha." };
  }

  const clean = stripDangerousKeysDeep(parsed as Record<string, any>);
  if (
    !clean.hp ||
    typeof clean.hp !== "object" ||
    !clean.pe ||
    typeof clean.pe !== "object"
  ) {
    return { ok: false, error: "Arquivo JSON inválido para esta ficha." };
  }

  if (Array.isArray(clean.history)) {
    clean.history = clean.history
      .slice(0, 100)
      .map((entry: unknown) => sanitizeRollHistoryHtml(entry))
      .filter((entry: string) => entry.length > 0);
  }

  return { ok: true, sheet: clean };
}

/**
 * Valida payloads de broadcast Realtime antes de mutar o estado local.
 */
export function isValidModeConfigPayload(payload: unknown): payload is {
  globalMode: "demologia" | "rl";
  playerModes?: Record<string, "demologia" | "rl">;
  skipTransition?: boolean;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const obj = payload as Record<string, unknown>;
  if (obj.globalMode !== "demologia" && obj.globalMode !== "rl") return false;
  if (obj.playerModes !== undefined) {
    if (!obj.playerModes || typeof obj.playerModes !== "object" || Array.isArray(obj.playerModes)) {
      return false;
    }
    for (const val of Object.values(obj.playerModes as Record<string, unknown>)) {
      if (val !== "demologia" && val !== "rl") return false;
    }
  }
  if (obj.skipTransition !== undefined && typeof obj.skipTransition !== "boolean") {
    return false;
  }
  return true;
}

export function isValidTargetBroadcastPayload(
  payload: unknown
): payload is { playerId: string; [key: string]: unknown } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const id = (payload as Record<string, unknown>).playerId;
  return typeof id === "string" && id.trim().length > 0 && id.length <= 128;
}

/**
 * Comparação em tempo constante para reduzir vazamento por timing na verificação de senha.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  let diff = lenA ^ lenB;
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < lenA ? a.charCodeAt(i) : 0;
    const codeB = i < lenB ? b.charCodeAt(i) : 0;
    diff |= codeA ^ codeB;
  }
  return diff === 0;
}

// ============================================================
// Proteção anti força-bruta (backoff progressivo no modal Mestre)
// ============================================================

export const MASTER_AUTH_THROTTLE_KEY = "demologia_master_auth_throttle";

export interface MasterAuthThrottleState {
  failedAttempts: number;
  lockedUntil: number;
}

export function computeMasterLockoutMs(failedAttempts: number): number {
  if (failedAttempts < 3) return 0;
  if (failedAttempts === 3) return 5_000;
  if (failedAttempts === 4) return 15_000;
  return 30_000;
}

export function readMasterAuthThrottle(
  storage?: Pick<Storage, "getItem"> | null
): MasterAuthThrottleState {
  try {
    const target = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (!target) return { failedAttempts: 0, lockedUntil: 0 };
    const raw = target.getItem(MASTER_AUTH_THROTTLE_KEY);
    if (!raw) return { failedAttempts: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    const failedAttempts = Number.isFinite(Number(parsed?.failedAttempts))
      ? Math.max(0, Math.floor(Number(parsed.failedAttempts)))
      : 0;
    const lockedUntil = Number.isFinite(Number(parsed?.lockedUntil))
      ? Math.max(0, Number(parsed.lockedUntil))
      : 0;
    return { failedAttempts, lockedUntil };
  } catch {
    return { failedAttempts: 0, lockedUntil: 0 };
  }
}

export function recordMasterAuthFailure(
  nowMs: number = Date.now(),
  storage?: Pick<Storage, "getItem" | "setItem"> | null
): MasterAuthThrottleState {
  const current = readMasterAuthThrottle(storage);
  const nextAttempts = current.failedAttempts + 1;
  const lockoutMs = computeMasterLockoutMs(nextAttempts);
  const nextState: MasterAuthThrottleState = {
    failedAttempts: nextAttempts,
    lockedUntil: lockoutMs > 0 ? nowMs + lockoutMs : 0,
  };
  try {
    const target = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    target?.setItem(MASTER_AUTH_THROTTLE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignorar falha de sessionStorage
  }
  return nextState;
}

export function clearMasterAuthFailures(
  storage?: Pick<Storage, "removeItem"> | null
): void {
  try {
    const target = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    target?.removeItem(MASTER_AUTH_THROTTLE_KEY);
  } catch {
    // Ignorar falha de sessionStorage
  }
}

export function getMasterLockoutRemainingSeconds(
  state: MasterAuthThrottleState,
  nowMs: number = Date.now()
): number {
  const remainingMs = state.lockedUntil - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}
