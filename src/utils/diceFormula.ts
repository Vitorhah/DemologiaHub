export interface CustomRollFormula {
  id: string;
  name: string;
  formula: string;
}

export interface EvaluatedRoll {
  formula: string;
  result: number;
  details: string;
  critical: "crit" | "fumble" | "normal";
  critBonus?: number;
}

export function getDefaultAttributeRollFormula(attrKey: string): string {
  const cleanKey = String(attrKey || "").trim().toUpperCase();
  if (!cleanKey) return "2d6";
  if (cleanKey === "FOR") return "1d4+FOR";
  return `2d6+${cleanKey}`;
}

function evaluateSafeMathExpression(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/(). ]/g, "").trim();
  if (!sanitized) return null;

  const withImplicitMult = sanitized
    .replace(/\)(?=\d|\()/g, ")*")
    .replace(/(\d)(?=\()/g, "$1*");

  const tokens = withImplicitMult.match(/(\d+(?:\.\d+)?|[+\-*/()])/g);
  if (!tokens || tokens.join("") !== withImplicitMult.replace(/\s+/g, "")) {
    return null;
  }

  let pos = 0;

  const parseExpression = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;

    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parseFactor();
    if (left === null) return null;

    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  };

  const parseFactor = (): number | null => {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos];

    if (tok === "+") {
      pos++;
      return parseFactor();
    }
    if (tok === "-") {
      pos++;
      const val = parseFactor();
      return val === null ? null : -val;
    }
    if (tok === "(") {
      pos++;
      const val = parseExpression();
      if (val === null || tokens[pos] !== ")") return null;
      pos++;
      return val;
    }

    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      pos++;
      return Number(tok);
    }

    return null;
  };

  const value = parseExpression();
  if (value === null || pos !== tokens.length || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function evaluateDiceFormula(
  formula: string,
  variables: Record<string, number> = {},
  rng: () => number = Math.random
): EvaluatedRoll | null {
  const trimmed = String(formula || "").trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/(^|[^0-9])d(\d+)/gi, "$11d$2");
  const logDetails: string[] = [];
  const diceGroups: Array<{ count: number; sides: number; rolls: number[] }> = [];
  let stringToEval = normalized.toUpperCase();

  // Substitui variáveis mais longas primeiro para evitar colisões parciais
  const sortedVars = Object.entries(variables || {}).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [key, value] of sortedVars) {
    const upperKey = key.trim().toUpperCase();
    if (!upperKey) continue;
    const escapedKey = upperKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedKey}\\b`, "g");
    if (regex.test(stringToEval)) {
      const numVal = Number(value) || 0;
      logDetails.push(`${upperKey}(${numVal})`);
      stringToEval = stringToEval.replace(regex, `(${numVal})`);
    }
  }

  let invalidDiceSpec = false;
  const diceRegex = /(\d+)D(\d+)/g;
  stringToEval = stringToEval.replace(diceRegex, (match, countStr, sidesStr) => {
    const count = parseInt(countStr, 10);
    const sides = parseInt(sidesStr, 10);
    if (count < 1 || count > 100 || sides < 1 || sides > 10000) {
      invalidDiceSpec = true;
      return "0";
    }
    let sum = 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(rng() * sides) + 1;
      sum += r;
      rolls.push(r);
    }
    diceGroups.push({ count, sides, rolls });
    logDetails.push(`${match}[${rolls.join(",")}]`);
    return String(sum);
  });

  if (invalidDiceSpec) return null;

  // Se sobrou letra/identificador desconhecido na expressão, considere fórmula inválida
  if (/[A-ZÀ-ÿ_]/i.test(stringToEval)) {
    return null;
  }

  const numericResult = evaluateSafeMathExpression(stringToEval);
  if (numericResult === null) return null;

  let critical: "crit" | "fumble" | "normal" = "normal";
  let critBonus = 0;

  // Regra de críticos do sistema:
  // - 2d6 com ambos os dados iguais -> Crítico (+5)
  // - 1d4 com dado = 4 -> Crítico (+5)
  const hasSystem2d6Crit = diceGroups.some(
    (g) => g.count === 2 && g.sides === 6 && g.rolls[0] === g.rolls[1]
  );
  const hasSystem1d4Crit = diceGroups.some(
    (g) => g.count === 1 && g.sides === 4 && g.rolls[0] === 4
  );

  if (hasSystem2d6Crit || hasSystem1d4Crit) {
    critical = "crit";
    critBonus = 5;
    logDetails.push("Crítico(+5)");
  } else {
    const has1d20Crit = diceGroups.some(
      (g) => g.count === 1 && g.sides === 20 && g.rolls[0] === 20
    );
    const has1d20Fumble = diceGroups.some(
      (g) => g.count === 1 && g.sides === 20 && g.rolls[0] === 1
    );
    if (has1d20Crit) critical = "crit";
    else if (has1d20Fumble) critical = "fumble";
  }

  return {
    formula: normalized,
    result: Math.floor(numericResult) + critBonus,
    details: logDetails.length > 0 ? logDetails.join(" | ") : "Valor fixo",
    critical,
    critBonus,
  };
}

export function normalizeCustomFormulas(list: unknown): CustomRollFormula[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (item): item is CustomRollFormula =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as any).formula === "string" &&
        (item as any).formula.trim().length > 0
    )
    .map((item, idx) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : `formula_${idx}_${Date.now()}`,
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : item.formula.trim(),
      formula: item.formula.trim(),
    }));
}

export function upsertCustomFormula(
  list: CustomRollFormula[],
  draft: { id?: string; name?: string; formula: string }
): CustomRollFormula[] {
  const cleanFormula = String(draft.formula || "").trim();
  if (!cleanFormula) return list;
  const cleanName = String(draft.name || "").trim() || cleanFormula;

  if (draft.id) {
    const exists = list.some((f) => f.id === draft.id);
    if (exists) {
      return list.map((f) =>
        f.id === draft.id ? { ...f, name: cleanName, formula: cleanFormula } : f
      );
    }
  }

  const newEntry: CustomRollFormula = {
    id:
      draft.id ||
      `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    formula: cleanFormula,
  };

  return [...list, newEntry];
}

export function removeCustomFormula(
  list: CustomRollFormula[],
  id: string
): CustomRollFormula[] {
  return list.filter((f) => f.id !== id);
}

export function canSelectExtraSheetForRoll(
  isMestreAuth: boolean,
  extraFichasCount: number
): boolean {
  return Boolean(isMestreAuth && extraFichasCount > 0);
}

export function resolveRollActiveFichaId(
  isMestreAuth: boolean,
  activeFichaId: string
): string {
  return isMestreAuth && activeFichaId ? activeFichaId : "main";
}

