/**
 * Lógica pura de validação, formatação e proteção de permissão para
 * EP (Exposição Paranormal) na ficha do Demologia Hub.
 *
 * Regras:
 * - Valor inteiro entre 0 e 1000 (exibido como "EP X%").
 * - Valores abaixo de 0 viram 0; acima de 1000 viram 1000.
 * - Decimais (., ,) e textos são rejeitados.
 * - Apenas o perfil de Mestre pode alterar o EP.
 */

export const EP_MIN = 0;
export const EP_MAX = 1000;

export interface EpParseResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Clampa um número inteiro para o intervalo permitido [0, 1000].
 */
export function clampEp(value: number): number {
  if (!Number.isFinite(value)) return EP_MIN;
  const intVal = Math.trunc(value);
  return Math.max(EP_MIN, Math.min(EP_MAX, intVal));
}

/**
 * Normaliza qualquer valor vindo de persistência (localStorage/Supabase/JSON)
 * garantindo inteiro válido entre 0 e 1000.
 * Rejeita decimais e textos inválidos retornando o fallback normalizado.
 */
export function normalizeEpValue(raw: unknown, fallback = EP_MIN): number {
  const safeFallback =
    typeof fallback === "number" && Number.isFinite(fallback) && Number.isInteger(fallback)
      ? clampEp(fallback)
      : EP_MIN;

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return safeFallback;
    }
    return clampEp(raw);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return safeFallback;
    }
    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return safeFallback;
    }
    return clampEp(parsed);
  }

  return safeFallback;
}

/**
 * Valida entrada direta do Mestre para o campo numérico de EP.
 * Não aceita decimais nem texto; inteiros fora de [0, 1000] são clampados.
 */
export function parseEpInput(rawInput: string | number): EpParseResult {
  if (typeof rawInput === "number") {
    if (!Number.isFinite(rawInput) || !Number.isInteger(rawInput)) {
      return { valid: false, error: "Apenas inteiros (0–1000)" };
    }
    return { valid: true, value: clampEp(rawInput) };
  }

  if (typeof rawInput !== "string") {
    return { valid: false, error: "Valor inválido" };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: "Informe um valor (0–1000)" };
  }

  if (/[.,]/.test(trimmed)) {
    return { valid: false, error: "Decimais não são permitidos" };
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, error: "Digite apenas números inteiros" };
  }

  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return { valid: false, error: "Número inválido" };
  }

  return { valid: true, value: clampEp(parsed) };
}

/**
 * Incrementa ou decrementa o EP garantindo inteiro no intervalo [0, 1000].
 */
export function stepEpValue(current: unknown, delta: number): number {
  const base = normalizeEpValue(current, EP_MIN);
  const safeDelta = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return clampEp(base + safeDelta);
}

/**
 * Formata o EP para exibição discreta na ficha ("EP 125%").
 */
export function formatEpDisplay(ep: unknown): string {
  return `EP ${normalizeEpValue(ep, EP_MIN)}%`;
}

/**
 * Valida permissão e valor antes de qualquer tentativa de edição de EP pelo Hub.
 */
export function resolveMasterEpUpdate(params: {
  isMaster: boolean;
  rawNextEp: string | number;
}): { allowed: boolean; value?: number; error?: string } {
  if (!params.isMaster) {
    return {
      allowed: false,
      error: "Apenas o Mestre pode alterar o EP.",
    };
  }

  const parsed = parseEpInput(params.rawNextEp);
  if (!parsed.valid || parsed.value === undefined) {
    return {
      allowed: false,
      error: parsed.error || "Valor de EP inválido.",
    };
  }

  return {
    allowed: true,
    value: parsed.value,
  };
}

/**
 * Protege o campo `ep` na lógica de salvamento/importação da ficha do jogador:
 * quando não é Mestre, impede qualquer alteração local ou via JSON importado,
 * preservando sempre o EP autoritativo vindo do Mestre/servidor.
 */
export function protectPlayerEpOnSave<T extends Record<string, any>>(
  candidateState: T,
  authoritativeEp: unknown,
  isMaster: boolean,
): T & { ep: number } {
  const safeAuthoritative = normalizeEpValue(authoritativeEp, EP_MIN);
  const safeCandidate = normalizeEpValue(candidateState?.ep, safeAuthoritative);

  return {
    ...candidateState,
    ep: isMaster ? safeCandidate : safeAuthoritative,
  };
}
