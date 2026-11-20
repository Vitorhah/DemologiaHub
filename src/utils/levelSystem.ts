import {
  CharacterProfileId,
  getMaxPossibleProfileBonusForStat,
  getProfileBonusForStat,
  isCharacterProfileId,
} from "./profiles";

/**
 * Sistema de Níveis (LV) & Limites de Atributos — Demologia
 *
 * Fórmula oficial de limite máximo por atributo:
 *   Limite base = 3 + (2 × (LV - 1))
 *   Limite final com Perfil = 3 + (2 × (LV - 1)) + bônus do perfil no atributo
 *
 * Exemplos (base):
 *   LV 1  → 3
 *   LV 2  → 5
 *   LV 3  → 7
 *   LV 6  → 13
 *   LV 10 → 21
 *   LV 11 → 23
 */

export const MIN_LEVEL = 1;
export const BASE_ATTRIBUTE_LIMIT = 3;
export const ATTRIBUTE_LIMIT_STEP = 2;

export interface LevelValidationResult {
  ok: boolean;
  value?: number;
  minRequiredLv: number;
  limit?: number;
  error?: string;
}

export interface SheetLevelMigrationResult<T extends Record<string, any>> {
  sheet: T & { lv: number };
  changed: boolean;
  previousLv: number | null;
  maxAttr: number;
  minRequiredLv: number;
}

/**
 * Calcula o limite máximo base permitido para cada atributo em um dado LV.
 * Continua seguindo `3 + (2 * (LV - 1))` para todos os níveis >= 1 (inclusive > 10).
 */
export function getAttributeLimitForLevel(lv: number): number {
  const safeLv =
    typeof lv === "number" && Number.isFinite(lv)
      ? Math.max(MIN_LEVEL, Math.floor(lv))
      : MIN_LEVEL;
  return BASE_ATTRIBUTE_LIMIT + ATTRIBUTE_LIMIT_STEP * (safeLv - 1);
}

/**
 * Calcula o limite máximo de um atributo específico considerando o LV e o Perfil ativo:
 *   Limite = 3 + ((LV - 1) × 2) + bônus do perfil para o atributo.
 */
export function getAttributeLimitForStat(
  lv: number,
  statKey: string,
  profile?: CharacterProfileId | string | null,
): number {
  const baseLimit = getAttributeLimitForLevel(lv);
  if (!profile) return baseLimit;
  return baseLimit + getProfileBonusForStat(statKey, profile);
}

/**
 * Verifica se o valor atual de um atributo está acima do limite permitido
 * pelo LV e Perfil ativos (ex.: após trocar de perfil).
 */
export function isAttributeOverLimit(
  value: number,
  lv: number,
  statKey: string,
  profile?: CharacterProfileId | string | null,
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return value > getAttributeLimitForStat(lv, statKey, profile);
}

/**
 * Resolve uma tentativa de edição de atributo respeitando LV + Perfil:
 * - Se o atributo já está acima do limite (ex.: após troca de perfil):
 *   - Não permite aumentar acima do valor atual.
 *   - Permite diminuir normalmente (ex.: 10 -> 9 -> 8 -> 7) sem apagar automaticamente.
 *   - Mantém o valor atual se o usuário apenas focar/sair do campo.
 * - Se o atributo está dentro do limite:
 *   - Aplica o teto de `getAttributeLimitForStat(lv, statKey, profile)`.
 */
export function resolveAttributeUpdateWithProfile(params: {
  currentVal: number;
  requestedVal: number;
  lv: number;
  statKey: string;
  profile?: CharacterProfileId | string | null;
  min?: number;
}): number {
  const min = params.min ?? 0;
  const limit = getAttributeLimitForStat(
    params.lv,
    params.statKey,
    params.profile,
  );
  const safeCurrent =
    typeof params.currentVal === "number" && Number.isFinite(params.currentVal)
      ? Math.max(min, Math.round(params.currentVal))
      : min;
  const safeRequested =
    typeof params.requestedVal === "number" && Number.isFinite(params.requestedVal)
      ? Math.max(min, Math.round(params.requestedVal))
      : min;

  if (safeRequested <= limit) {
    return safeRequested;
  }

  if (safeCurrent > limit) {
    // Já está acima do limite: permite apenas reduzir, nunca aumentar
    return safeRequested < safeCurrent ? safeRequested : safeCurrent;
  }

  return limit;
}

/**
 * Extrai o maior valor numérico de atributo presente em `variables`.
 * Ignora entradas não numéricas (ex.: strings de fórmula legadas como "1d4")
 * sem jamais modificá-las.
 */
export function getMaxAttributeValue(
  variables?: Record<string, unknown> | null,
): number {
  if (!variables || typeof variables !== "object") return 0;

  let maxVal = 0;
  for (const raw of Object.values(variables)) {
    if (typeof raw === "number") {
      if (Number.isFinite(raw) && raw > maxVal) {
        maxVal = raw;
      }
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed > maxVal) {
          maxVal = parsed;
        }
      }
    }
  }
  return maxVal;
}

/**
 * Calcula o menor LV necessário para comportar um determinado valor de atributo,
 * utilizando a inversa exata de `3 + (2 * (LV - 1))`.
 *
 * Ex.: valor 12 -> LV mínimo 6 (limite 13; LV 5 suporta apenas 11).
 */
export function getMinimumLevelForAttributeValue(maxAttr: number): number {
  if (typeof maxAttr !== "number" || !Number.isFinite(maxAttr) || maxAttr <= BASE_ATTRIBUTE_LIMIT) {
    return MIN_LEVEL;
  }
  return Math.ceil((maxAttr - BASE_ATTRIBUTE_LIMIT) / ATTRIBUTE_LIMIT_STEP) + 1;
}

/**
 * Calcula o menor LV necessário para comportar todos os atributos atuais de uma ficha.
 * Quando `profile` é informado, considera o maior bônus de perfil possível em cada
 * atributo para que trocar de perfil jamais force elevação silenciosa de LV.
 */
export function getMinimumLevelForAttributes(
  variables?: Record<string, unknown> | null,
  profile?: CharacterProfileId | string | null,
): number {
  if (!profile) {
    return getMinimumLevelForAttributeValue(getMaxAttributeValue(variables));
  }
  if (!variables || typeof variables !== "object") return MIN_LEVEL;

  let minLv = MIN_LEVEL;
  for (const [key, raw] of Object.entries(variables)) {
    let parsed: number | null = null;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      parsed = raw;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        if (Number.isFinite(num)) parsed = num;
      }
    }
    if (parsed === null) continue;

    const maxBonus = getMaxPossibleProfileBonusForStat(key);
    const effectiveBase = parsed - maxBonus;
    const reqForStat = getMinimumLevelForAttributeValue(effectiveBase);
    if (reqForStat > minLv) {
      minLv = reqForStat;
    }
  }
  return minLv;
}

function parseRawLevel(rawLv: unknown): number | null {
  if (typeof rawLv === "number") {
    if (!Number.isFinite(rawLv)) return null;
    const floored = Math.floor(rawLv);
    return floored >= MIN_LEVEL ? floored : MIN_LEVEL;
  }
  if (typeof rawLv === "string") {
    const trimmed = rawLv.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(MIN_LEVEL, parsed);
      }
    }
  }
  return null;
}

/**
 * Normaliza o LV de uma ficha garantindo:
 * 1) LV inteiro >= 1 (padrão 1 para fichas novas)
 * 2) Compatibilidade automática: nunca fica abaixo do LV mínimo exigido pelos atributos atuais,
 *    preservando integralmente os atributos existentes.
 */
export function normalizeLevel(
  rawLv: unknown,
  variables?: Record<string, unknown> | null,
  profile?: CharacterProfileId | string | null,
): number {
  const parsed = parseRawLevel(rawLv) ?? MIN_LEVEL;
  const minRequired = getMinimumLevelForAttributes(variables, profile);
  return Math.max(parsed, minRequired);
}

/**
 * Aplica o limite de atributo correspondente ao LV atual (e Perfil opcional).
 * Impede valores acima do teto permitido para o nível.
 */
export function clampAttributeForLevel(
  value: number,
  lv: number,
  options: {
    min?: number;
    statKey?: string;
    profile?: CharacterProfileId | string | null;
  } = {},
): number {
  const min = options.min ?? 0;
  const limit =
    options.statKey && options.profile
      ? getAttributeLimitForStat(lv, options.statKey, options.profile)
      : getAttributeLimitForLevel(lv);
  const safeVal =
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(limit, safeVal));
}

/**
 * Valida uma edição explícita de LV feita pelo usuário.
 * - Exige inteiro >= 1 (rejeita decimais, texto, zero ou negativos)
 * - Impede reduzir o LV abaixo do mínimo exigido pelos atributos atuais da ficha
 *   (evitando qualquer redução ou perda de atributos existentes).
 */
export function parseAndValidateLevelChange(
  rawInput: string | number,
  variables?: Record<string, unknown> | null,
  profile?: CharacterProfileId | string | null,
): LevelValidationResult {
  const minRequiredLv = getMinimumLevelForAttributes(variables, profile);

  let parsed: number;
  if (typeof rawInput === "number") {
    if (!Number.isFinite(rawInput) || !Number.isInteger(rawInput)) {
      return {
        ok: false,
        minRequiredLv,
        error: "LV deve ser um número inteiro.",
      };
    }
    parsed = rawInput;
  } else if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return {
        ok: false,
        minRequiredLv,
        error: "Informe um LV válido.",
      };
    }
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        minRequiredLv,
        error: "Use apenas inteiros positivos.",
      };
    }
    parsed = parseInt(trimmed, 10);
  } else {
    return {
      ok: false,
      minRequiredLv,
      error: "LV inválido.",
    };
  }

  if (parsed < MIN_LEVEL) {
    return {
      ok: false,
      minRequiredLv,
      error: `LV mínimo é ${MIN_LEVEL}.`,
    };
  }

  if (parsed < minRequiredLv) {
    return {
      ok: false,
      minRequiredLv,
      error: `Atributos atuais exigem no mínimo LV ${minRequiredLv}.`,
    };
  }

  return {
    ok: true,
    value: parsed,
    minRequiredLv,
    limit: getAttributeLimitForLevel(parsed),
  };
}

/**
 * Adequa uma ficha existente para o sistema de níveis de forma não destrutiva:
 * - Identifica o maior atributo existente na ficha
 * - Calcula o menor LV capaz de comportá-lo
 * - Define/eleva apenas `lv` quando necessário
 * - Jamais altera, reduz ou apaga atributos ou qualquer outro campo da ficha.
 */
export function migrateSheetForLevelSystem<T extends Record<string, any>>(
  sheet: T,
): SheetLevelMigrationResult<T> {
  const maxAttr = getMaxAttributeValue(sheet?.variables);
  const sheetProfile = isCharacterProfileId(sheet?.profile)
    ? sheet.profile
    : undefined;
  const minRequiredLv = getMinimumLevelForAttributes(
    sheet?.variables,
    sheetProfile,
  );
  const previousLv = parseRawLevel(sheet?.lv);
  const nextLv = Math.max(previousLv ?? MIN_LEVEL, minRequiredLv);
  const changed = sheet?.lv !== nextLv;

  return {
    sheet: {
      ...sheet,
      lv: nextLv,
    },
    changed,
    previousLv,
    maxAttr,
    minRequiredLv,
  };
}

/**
 * Valida permissão de Mestre e regras de LV antes de qualquer alteração pelo Hub.
 * - Bloqueia qualquer tentativa feita por não-Mestre.
 * - Valida inteiro >= 1 e impede reduzir abaixo do LV mínimo exigido pelos atributos atuais.
 */
export function resolveMasterLevelUpdate(params: {
  isMaster: boolean;
  rawNextLv: string | number;
  variables?: Record<string, unknown> | null;
  profile?: CharacterProfileId | string | null;
}): {
  allowed: boolean;
  value?: number;
  minRequiredLv: number;
  limit?: number;
  error?: string;
} {
  const minRequiredLv = getMinimumLevelForAttributes(
    params.variables,
    params.profile,
  );

  if (!params.isMaster) {
    return {
      allowed: false,
      minRequiredLv,
      error: "Apenas o Mestre pode alterar o LV.",
    };
  }

  const parsed = parseAndValidateLevelChange(
    params.rawNextLv,
    params.variables,
    params.profile,
  );
  if (!parsed.ok || parsed.value === undefined) {
    return {
      allowed: false,
      minRequiredLv: parsed.minRequiredLv,
      error: parsed.error || "Valor de LV inválido.",
    };
  }

  return {
    allowed: true,
    value: parsed.value,
    minRequiredLv: parsed.minRequiredLv,
    limit: parsed.limit,
  };
}

/**
 * Protege o campo `lv` na lógica de salvamento/importação da ficha:
 * - Quando não é Mestre, impede qualquer alteração local ou via JSON importado,
 *   preservando sempre o LV autoritativo vindo do Mestre/servidor (respeitando o mínimo
 *   de compatibilidade para fichas legadas sem nunca reduzir atributos existentes).
 * - Quando é Mestre, normaliza o LV candidato normalmente.
 */
export function protectPlayerLevelOnSave<T extends Record<string, any>>(
  candidateState: T,
  authoritativeLv: unknown,
  isMaster: boolean,
): T & { lv: number } {
  const vars = candidateState?.variables;
  const sheetProfile = isCharacterProfileId(candidateState?.profile)
    ? candidateState.profile
    : undefined;
  const safeAuthoritative = normalizeLevel(authoritativeLv, vars, sheetProfile);
  const safeCandidate = normalizeLevel(candidateState?.lv, vars, sheetProfile);

  return {
    ...candidateState,
    lv: isMaster ? safeCandidate : safeAuthoritative,
  };
}


