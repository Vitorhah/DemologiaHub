/**
 * Utilitário de avaliação de expressões matemáticas restritas para barras de recursos
 * do Demologia Tabletop.
 * 
 * Regras:
 * - Operações permitidas exclusivamente: adição (+), subtração (-) e multiplicação (*)
 * - Expressões relativas ao valor atual: "+20", "-15", "*2"
 * - Expressões binárias entre inteiros: "70+20", "70-15", "70*2"
 * - Números inteiros isolados: "45", "90"
 * - Rejeição estrita de divisão (/), decimais (., ,), letras e outros caracteres inválidos
 * - Sem eval() ou execução de código arbitrário
 * - Suporte opcional a limites mínimo e máximo (clamping)
 */

export interface StatParseResult {
  success: boolean;
  value?: number;
  error?: string;
}

export function evaluateStatExpression(
  rawInput: string | number,
  currentValue: number,
  options: { min?: number; max?: number } = { min: 0 }
): StatParseResult {
  if (typeof rawInput === 'number') {
    if (isNaN(rawInput)) {
      return { success: false, error: 'Número inválido' };
    }
    let val = Math.round(rawInput);
    if (options.min !== undefined) val = Math.max(options.min, val);
    if (options.max !== undefined) val = Math.min(options.max, val);
    return { success: true, value: val };
  }

  if (typeof rawInput !== 'string') {
    return { success: false, error: 'Entrada inválida' };
  }

  const clean = rawInput.trim();
  if (!clean) {
    return { success: false, error: 'Campo vazio' };
  }

  // 1. Rejeição explícita de divisão e casas decimais
  if (/[/.,]/.test(clean)) {
    return { success: false, error: 'Divisões e decimais não permitidos' };
  }

  // 2. Rejeição explícita de letras
  if (/[a-zA-Z]/.test(clean)) {
    return { success: false, error: 'Letras não são permitidas' };
  }

  // 3. Rejeição de caracteres não suportados (permitido apenas dígitos, espaços e +, -, *)
  if (!/^[\d\s+\-*]+$/.test(clean)) {
    return { success: false, error: 'Operador não permitido' };
  }

  const clamp = (val: number): number => {
    let rounded = Math.round(val);
    if (options.min !== undefined) {
      rounded = Math.max(options.min, rounded);
    }
    if (options.max !== undefined) {
      rounded = Math.min(options.max, rounded);
    }
    return rounded;
  };

  // 4. Operação relativa ao valor atual: inicia com +, -, ou * seguido de um inteiro
  // Ex: "+20", "-15", "*2", "+ 20"
  const relativeMatch = clean.match(/^([+\-*])\s*(\d+)$/);
  if (relativeMatch) {
    const op = relativeMatch[1];
    const operand = parseInt(relativeMatch[2], 10);
    if (isNaN(operand)) {
      return { success: false, error: 'Número inválido' };
    }

    let calculated: number;
    if (op === '+') {
      calculated = currentValue + operand;
    } else if (op === '-') {
      calculated = currentValue - operand;
    } else if (op === '*') {
      calculated = currentValue * operand;
    } else {
      return { success: false, error: 'Operador inválido' };
    }

    return { success: true, value: clamp(calculated) };
  }

  // 5. Expressão binária completa entre dois inteiros: "A+B", "A-B", "A*B"
  // Ex: "70+20", "70-15", "70*2", "70 + 20"
  const binaryMatch = clean.match(/^(\d+)\s*([+\-*])\s*(\d+)$/);
  if (binaryMatch) {
    const left = parseInt(binaryMatch[1], 10);
    const op = binaryMatch[2];
    const right = parseInt(binaryMatch[3], 10);

    if (isNaN(left) || isNaN(right)) {
      return { success: false, error: 'Expressão inválida' };
    }

    let calculated: number;
    if (op === '+') {
      calculated = left + right;
    } else if (op === '-') {
      calculated = left - right;
    } else if (op === '*') {
      calculated = left * right;
    } else {
      return { success: false, error: 'Operador inválido' };
    }

    return { success: true, value: clamp(calculated) };
  }

  // 6. Número inteiro isolado: "45", "90", "0"
  const singleNumberMatch = clean.match(/^(\d+)$/);
  if (singleNumberMatch) {
    const val = parseInt(singleNumberMatch[1], 10);
    if (isNaN(val)) {
      return { success: false, error: 'Número inválido' };
    }
    return { success: true, value: clamp(val) };
  }

  return { success: false, error: 'Expressão matemática inválida' };
}
