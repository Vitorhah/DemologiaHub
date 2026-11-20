export type UltimoSuspiroStatus = "alive" | "dying" | "dead";

export type UltimoSuspiroEventType =
  | "entered"
  | "attempting"
  | "failure"
  | "critical_success"
  | "imminent_death"
  | "coin_flip_available"
  | "coin_flip_won"
  | "coin_flip_lost"
  | "permanent_death"
  | "resurrection";

export type TimingHitQuality = "miss" | "outer" | "center";
export type CoinSide = "cara" | "coroa";

export interface UltimoSuspiroCoinFlipSummary {
  choice: CoinSide;
  landed: CoinSide;
  won: boolean;
  flippedAt: number;
}

export interface UltimoSuspiroRollSummary {
  d1: number;
  d2: number;
  diceSum: number;
  vit: number;
  total: number;
  timingHit: boolean;
  centerHit?: boolean;
  hitQuality?: TimingHitQuality;
  attemptsUsed?: number;
  critChancePct?: number;
  isCritical: boolean;
  healedHp: number;
  rolledAt: number;
}

export interface UltimoSuspiroState {
  status: UltimoSuspiroStatus;
  failures: number;
  maxFailures: 3;
  lastTurnToken?: string;
  updatedAt: number;
  lastRoll?: UltimoSuspiroRollSummary;
  coinFlipPending?: boolean;
  coinFlipUsed?: boolean;
  lastCoinFlip?: UltimoSuspiroCoinFlipSummary;
}

export interface UltimoSuspiroNotification {
  eventType: UltimoSuspiroEventType;
  title: string;
  message: string;
  severity: "danger" | "warning" | "critical" | "dead" | "resurrection" | "attempt";
  badgeText: string;
  characterName: string;
  failures?: number;
  healedHp?: number;
  roll?: UltimoSuspiroRollSummary;
}

export const ULTIMO_SUSPIRO_MAX_FAILURES = 3 as const;

export const TIMING_RING_CONFIG = {
  startRadius: 88,
  targetRadius: 42,
  endRadius: 12,
  tolerance: 15,
  centerTolerance: 8,
  centerBonusRolls: 3,
  durationMs: 1250,
} as const;

export function createDefaultUltimoSuspiroState(now = Date.now()): UltimoSuspiroState {
  return {
    status: "alive",
    failures: 0,
    maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
    updatedAt: now,
  };
}

export function normalizeUltimoSuspiroState(
  raw: unknown,
  hpCurrent?: number,
  now = Date.now(),
): UltimoSuspiroState {
  const safeHp = typeof hpCurrent === "number" && Number.isFinite(hpCurrent) ? hpCurrent : 1;

  if (!raw || typeof raw !== "object") {
    if (safeHp <= 0) {
      return {
        status: "dying",
        failures: 0,
        maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
        updatedAt: now,
      };
    }
    return createDefaultUltimoSuspiroState(now);
  }

  const candidate = raw as Record<string, unknown>;
  const rawStatus = candidate.status;
  const rawFailures = Number(candidate.failures);
  const clampedFailures = Number.isFinite(rawFailures)
    ? Math.max(0, Math.min(ULTIMO_SUSPIRO_MAX_FAILURES, Math.trunc(rawFailures)))
    : 0;
  const updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : now;
  const lastTurnToken =
    typeof candidate.lastTurnToken === "string" && candidate.lastTurnToken.length > 0
      ? candidate.lastTurnToken
      : undefined;
  const lastRoll =
    candidate.lastRoll && typeof candidate.lastRoll === "object"
      ? (candidate.lastRoll as UltimoSuspiroRollSummary)
      : undefined;
  const lastCoinFlip =
    candidate.lastCoinFlip && typeof candidate.lastCoinFlip === "object"
      ? (candidate.lastCoinFlip as UltimoSuspiroCoinFlipSummary)
      : undefined;
  const coinFlipUsed = Boolean(candidate.coinFlipUsed);
  const coinFlipPending = Boolean(candidate.coinFlipPending) && !coinFlipUsed;

  if (rawStatus === "dead") {
    return {
      status: "dead",
      failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken,
      updatedAt,
      lastRoll,
      coinFlipPending: false,
      coinFlipUsed: true,
      lastCoinFlip,
    };
  }

  if (coinFlipPending) {
    return {
      status: "dying",
      failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken,
      updatedAt,
      lastRoll,
      coinFlipPending: true,
      coinFlipUsed: false,
      lastCoinFlip,
    };
  }

  if (clampedFailures >= ULTIMO_SUSPIRO_MAX_FAILURES) {
    return {
      status: "dead",
      failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken,
      updatedAt,
      lastRoll,
      coinFlipPending: false,
      coinFlipUsed: true,
      lastCoinFlip,
    };
  }

  if (rawStatus === "dying" || safeHp <= 0) {
    return {
      status: "dying",
      failures: Math.min(ULTIMO_SUSPIRO_MAX_FAILURES - 1, clampedFailures),
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken,
      updatedAt,
      lastRoll,
      coinFlipPending: false,
      coinFlipUsed,
      lastCoinFlip,
    };
  }

  return {
    status: "alive",
    failures: 0,
    maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
    lastTurnToken,
    updatedAt,
    lastRoll,
    coinFlipPending: false,
    coinFlipUsed: false,
    lastCoinFlip,
  };
}

export function extractVitAttribute(
  variables?: Record<string, number | string> | null,
): number {
  if (!variables || typeof variables !== "object") return 0;
  const entry = Object.entries(variables).find(
    ([key]) => key.trim().toUpperCase() === "VIT",
  );
  if (!entry) return 0;
  const parsed = Number(entry[1]);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export function rollSecureD6(): number {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    const maxUnbiased = Math.floor(0x100000000 / 6) * 6;
    let value = 0;
    do {
      globalThis.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= maxUnbiased);
    return (value % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

export function rollSecureCoinSide(): CoinSide {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return (buffer[0] & 1) === 0 ? "cara" : "coroa";
  }
  return Math.random() < 0.5 ? "cara" : "coroa";
}

export function evaluateTimingOverlap(
  currentRadius: number,
  targetRadius: number = TIMING_RING_CONFIG.targetRadius,
  tolerance: number = TIMING_RING_CONFIG.tolerance,
  centerTolerance: number = TIMING_RING_CONFIG.centerTolerance,
): { hit: boolean; centerHit: boolean; quality: TimingHitQuality; distance: number } {
  if (!Number.isFinite(currentRadius)) {
    return {
      hit: false,
      centerHit: false,
      quality: "miss",
      distance: Number.POSITIVE_INFINITY,
    };
  }
  const distance = Math.abs(currentRadius - targetRadius);
  const safeCenterTolerance = Math.min(tolerance, Math.max(0, centerTolerance));
  const hit = distance <= tolerance;
  const centerHit = hit && distance <= safeCenterTolerance;
  const quality: TimingHitQuality = centerHit ? "center" : hit ? "outer" : "miss";
  return {
    hit,
    centerHit,
    quality,
    distance,
  };
}

export function rollVitalitySurvivalTest(params: {
  vit: number;
  timingHit: boolean;
  centerHit?: boolean;
  diceRoller?: () => number;
  now?: number;
}): UltimoSuspiroRollSummary {
  const safeVit = Number.isFinite(params.vit) ? Math.trunc(params.vit) : 0;
  const roller = params.diceRoller ?? rollSecureD6;
  const clampDie = (val: number) => Math.max(1, Math.min(6, Math.trunc(val) || 1));

  const timingHit = Boolean(params.timingHit);
  const centerHit = Boolean(timingHit && params.centerHit);
  const hitQuality: TimingHitQuality = centerHit ? "center" : timingHit ? "outer" : "miss";
  const maxAttempts = centerHit ? TIMING_RING_CONFIG.centerBonusRolls : 1;

  let bestD1 = clampDie(roller());
  let bestD2 = clampDie(roller());
  let attemptsUsed = 1;
  let foundDoubles = bestD1 === bestD2;

  // Acertar o meio do alvo concede Vantagem de Precisão (múltiplas chances reais de 2d6 para dados iguais:
  // com 3 tentativas, a chance de crítico sobe de 1/6 ≈ 17% para ~42%, mantendo a regra de dados iguais [d, d]).
  while (timingHit && !foundDoubles && attemptsUsed < maxAttempts) {
    const nextD1 = clampDie(roller());
    const nextD2 = clampDie(roller());
    attemptsUsed += 1;

    if (nextD1 === nextD2) {
      bestD1 = nextD1;
      bestD2 = nextD2;
      foundDoubles = true;
      break;
    }

    if (nextD1 + nextD2 > bestD1 + bestD2) {
      bestD1 = nextD1;
      bestD2 = nextD2;
    }
  }

  const diceSum = bestD1 + bestD2;
  const total = diceSum + safeVit;
  // Regra estrita: sucesso crítico exige timing acertado E dois dados exatamente iguais.
  // VIT soma ao resultado exibido, mas nunca concede sucesso crítico sem dados iguais.
  const isCritical = Boolean(timingHit && foundDoubles);
  const healedHp = isCritical ? diceSum : 0;
  const critChancePct = !timingHit
    ? 0
    : Math.round((1 - Math.pow(5 / 6, maxAttempts)) * 100);

  return {
    d1: bestD1,
    d2: bestD2,
    diceSum,
    vit: safeVit,
    total,
    timingHit,
    centerHit,
    hitQuality,
    attemptsUsed,
    critChancePct,
    isCritical,
    healedHp,
    rolledAt: params.now ?? Date.now(),
  };
}

export function applySurvivalTestResult(params: {
  prevUltimoSuspiro: UltimoSuspiroState;
  currentHp: number;
  maxHp: number;
  testResult: UltimoSuspiroRollSummary;
  turnToken: string;
  now?: number;
}): {
  ultimoSuspiro: UltimoSuspiroState;
  nextHp: number;
  events: UltimoSuspiroEventType[];
  coinFlipAvailable: boolean;
  ignored: boolean;
} {
  const now = params.now ?? Date.now();
  const prev = normalizeUltimoSuspiroState(params.prevUltimoSuspiro, params.currentHp, now);
  const safeMaxHp = Math.max(1, Math.trunc(Number(params.maxHp) || 1));

  // Bloqueia se já não estiver em Último Suspiro, se a moeda da última chance estiver pendente ou se for disparo duplicado
  if (
    prev.status !== "dying" ||
    prev.coinFlipPending ||
    (params.turnToken && prev.lastTurnToken === params.turnToken)
  ) {
    return {
      ultimoSuspiro: prev,
      nextHp: prev.status === "dead" ? 0 : Math.max(0, Math.trunc(params.currentHp || 0)),
      events: [],
      coinFlipAvailable: Boolean(prev.coinFlipPending && !prev.coinFlipUsed),
      ignored: true,
    };
  }

  if (params.testResult.isCritical) {
    const recoveredHp = Math.max(1, Math.min(safeMaxHp, params.testResult.healedHp));
    return {
      ultimoSuspiro: {
        status: "alive",
        failures: 0,
        maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
        lastTurnToken: params.turnToken,
        updatedAt: now,
        lastRoll: params.testResult,
        coinFlipPending: false,
        coinFlipUsed: false,
      },
      nextHp: recoveredHp,
      events: ["critical_success"],
      coinFlipAvailable: false,
      ignored: false,
    };
  }

  const nextFailures = Math.min(ULTIMO_SUSPIRO_MAX_FAILURES, prev.failures + 1);
  if (nextFailures >= ULTIMO_SUSPIRO_MAX_FAILURES) {
    // Ao chegar a 0 turnos restantes pela primeira vez, libera a Última Chance (Cara ou Coroa)
    if (!prev.coinFlipUsed) {
      return {
        ultimoSuspiro: {
          status: "dying",
          failures: ULTIMO_SUSPIRO_MAX_FAILURES,
          maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
          lastTurnToken: params.turnToken,
          updatedAt: now,
          lastRoll: params.testResult,
          coinFlipPending: true,
          coinFlipUsed: false,
        },
        nextHp: 0,
        events: ["failure", "coin_flip_available"],
        coinFlipAvailable: true,
        ignored: false,
      };
    }

    return {
      ultimoSuspiro: {
        status: "dead",
        failures: ULTIMO_SUSPIRO_MAX_FAILURES,
        maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
        lastTurnToken: params.turnToken,
        updatedAt: now,
        lastRoll: params.testResult,
        coinFlipPending: false,
        coinFlipUsed: true,
        lastCoinFlip: prev.lastCoinFlip,
      },
      nextHp: 0,
      events: ["failure", "permanent_death"],
      coinFlipAvailable: false,
      ignored: false,
    };
  }

  const events: UltimoSuspiroEventType[] = ["failure"];
  if (nextFailures === ULTIMO_SUSPIRO_MAX_FAILURES - 1) {
    events.push("imminent_death");
  }

  return {
    ultimoSuspiro: {
      status: "dying",
      failures: nextFailures,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken: params.turnToken,
      updatedAt: now,
      lastRoll: params.testResult,
      coinFlipPending: false,
      coinFlipUsed: Boolean(prev.coinFlipUsed),
      lastCoinFlip: prev.lastCoinFlip,
    },
    nextHp: 0,
    events,
    coinFlipAvailable: false,
    ignored: false,
  };
}

export function resolveLastChanceCoinFlip(params: {
  prevUltimoSuspiro: UltimoSuspiroState;
  choice: CoinSide;
  coinRoller?: () => CoinSide;
  now?: number;
}): {
  ultimoSuspiro: UltimoSuspiroState;
  coinFlip?: UltimoSuspiroCoinFlipSummary;
  won: boolean;
  events: UltimoSuspiroEventType[];
  ignored: boolean;
} {
  const now = params.now ?? Date.now();
  const prev = normalizeUltimoSuspiroState(params.prevUltimoSuspiro, 0, now);

  if (prev.status !== "dying" || !prev.coinFlipPending || prev.coinFlipUsed) {
    return {
      ultimoSuspiro: prev,
      won: false,
      events: [],
      ignored: true,
    };
  }

  const landed = (params.coinRoller ?? rollSecureCoinSide)();
  const won = landed === params.choice;
  const coinFlip: UltimoSuspiroCoinFlipSummary = {
    choice: params.choice,
    landed,
    won,
    flippedAt: now,
  };

  if (won) {
    return {
      ultimoSuspiro: {
        status: "dying",
        failures: ULTIMO_SUSPIRO_MAX_FAILURES - 1,
        maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
        lastTurnToken: `coin_won_${now}`,
        updatedAt: now,
        lastRoll: prev.lastRoll,
        coinFlipPending: false,
        coinFlipUsed: true,
        lastCoinFlip: coinFlip,
      },
      coinFlip,
      won: true,
      events: ["coin_flip_won"],
      ignored: false,
    };
  }

  return {
    ultimoSuspiro: {
      status: "dead",
      failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      lastTurnToken: `coin_lost_${now}`,
      updatedAt: now,
      lastRoll: prev.lastRoll,
      coinFlipPending: false,
      coinFlipUsed: true,
      lastCoinFlip: coinFlip,
    },
    coinFlip,
    won: false,
    events: ["coin_flip_lost", "permanent_death"],
    ignored: false,
  };
}

export function reconcileHpChangeForUltimoSuspiro(params: {
  prevUltimoSuspiro?: UltimoSuspiroState;
  prevHp: number;
  nextHp: number;
  maxHp: number;
  isMaster?: boolean;
  now?: number;
}): {
  ultimoSuspiro: UltimoSuspiroState;
  hpCurrent: number;
  events: UltimoSuspiroEventType[];
  blockedDeadEdit: boolean;
} {
  const now = params.now ?? Date.now();
  const prev = normalizeUltimoSuspiroState(params.prevUltimoSuspiro, params.prevHp, now);
  const rawNextHp = Number.isFinite(params.nextHp) ? Math.trunc(params.nextHp) : 0;

  // Regra: Morte definitiva (3/3) não pode ser revertida por cura normal ou edição manual de PV.
  // Apenas a ação explícita de Ressurreição do Mestre pode reviver o personagem.
  if (prev.status === "dead") {
    return {
      ultimoSuspiro: {
        ...prev,
        status: "dead",
        failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      },
      hpCurrent: 0,
      events: [],
      blockedDeadEdit: rawNextHp > 0,
    };
  }

  // Ativação automática ao atingir 0 PV ou menos
  if (rawNextHp <= 0) {
    if (prev.status === "alive") {
      return {
        ultimoSuspiro: {
          status: "dying",
          failures: 0,
          maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
          updatedAt: now,
        },
        hpCurrent: 0,
        events: ["entered"],
        blockedDeadEdit: false,
      };
    }
    return {
      ultimoSuspiro: {
        ...prev,
        status: "dying",
      },
      hpCurrent: 0,
      events: [],
      blockedDeadEdit: false,
    };
  }

  // PV > 0: se estava em Último Suspiro (0/3..2/3) e recebeu cura antes da morte definitiva, estabiliza e sai do estado
  if (prev.status === "dying") {
    return {
      ultimoSuspiro: {
        status: "alive",
        failures: 0,
        maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
        updatedAt: now,
        lastRoll: prev.lastRoll,
      },
      hpCurrent: rawNextHp,
      events: [],
      blockedDeadEdit: false,
    };
  }

  return {
    ultimoSuspiro: {
      ...prev,
      status: "alive",
      failures: 0,
    },
    hpCurrent: rawNextHp,
    events: [],
    blockedDeadEdit: false,
  };
}

export function advanceUltimoSuspiroTurn(params: {
  prevUltimoSuspiro: UltimoSuspiroState;
  turnToken: string;
  now?: number;
}): {
  ultimoSuspiro: UltimoSuspiroState;
  events: UltimoSuspiroEventType[];
  ignored: boolean;
} {
  const now = params.now ?? Date.now();
  const prev = normalizeUltimoSuspiroState(params.prevUltimoSuspiro, 0, now);

  if (prev.status !== "dying" || (params.turnToken && prev.lastTurnToken === params.turnToken)) {
    return {
      ultimoSuspiro: prev,
      events: [],
      ignored: true,
    };
  }

  const nextFailures = Math.min(ULTIMO_SUSPIRO_MAX_FAILURES, prev.failures + 1);
  if (nextFailures >= ULTIMO_SUSPIRO_MAX_FAILURES) {
    if (!prev.coinFlipUsed && !prev.coinFlipPending) {
      return {
        ultimoSuspiro: {
          ...prev,
          status: "dying",
          failures: ULTIMO_SUSPIRO_MAX_FAILURES,
          lastTurnToken: params.turnToken,
          updatedAt: now,
          coinFlipPending: true,
          coinFlipUsed: false,
        },
        events: ["coin_flip_available"],
        ignored: false,
      };
    }

    return {
      ultimoSuspiro: {
        ...prev,
        status: "dead",
        failures: ULTIMO_SUSPIRO_MAX_FAILURES,
        lastTurnToken: params.turnToken,
        updatedAt: now,
        coinFlipPending: false,
        coinFlipUsed: true,
      },
      events: ["permanent_death"],
      ignored: false,
    };
  }

  return {
    ultimoSuspiro: {
      ...prev,
      status: "dying",
      failures: nextFailures,
      lastTurnToken: params.turnToken,
      updatedAt: now,
    },
    events: nextFailures === ULTIMO_SUSPIRO_MAX_FAILURES - 1 ? ["imminent_death"] : ["failure"],
    ignored: false,
  };
}

export function resolveMasterFinalizeDeath(params: {
  isMaster: boolean;
  prevUltimoSuspiro?: UltimoSuspiroState;
  now?: number;
}): {
  ok: boolean;
  ultimoSuspiro?: UltimoSuspiroState;
  hpCurrent?: number;
  events: UltimoSuspiroEventType[];
  error?: string;
} {
  if (!params.isMaster) {
    return {
      ok: false,
      events: [],
      error: "Apenas o Mestre pode finalizar um personagem diretamente.",
    };
  }
  const now = params.now ?? Date.now();
  return {
    ok: true,
    ultimoSuspiro: {
      status: "dead",
      failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      updatedAt: now,
      lastRoll: params.prevUltimoSuspiro?.lastRoll,
    },
    hpCurrent: 0,
    events: ["permanent_death"],
  };
}

export function resolveMasterRevive(params: {
  isMaster: boolean;
  maxHp: number;
  targetHp?: number;
  now?: number;
}): {
  ok: boolean;
  ultimoSuspiro?: UltimoSuspiroState;
  hpCurrent?: number;
  events: UltimoSuspiroEventType[];
  error?: string;
} {
  if (!params.isMaster) {
    return {
      ok: false,
      events: [],
      error: "Apenas o Mestre pode reviver personagens mortos.",
    };
  }
  const now = params.now ?? Date.now();
  const safeMaxHp = Math.max(1, Math.trunc(Number(params.maxHp) || 1));
  const requestedHp =
    params.targetHp !== undefined && Number.isFinite(params.targetHp)
      ? Math.trunc(params.targetHp)
      : Math.max(1, Math.ceil(safeMaxHp * 0.25));
  const clampedHp = Math.max(1, Math.min(safeMaxHp, requestedHp));

  return {
    ok: true,
    ultimoSuspiro: {
      status: "alive",
      failures: 0,
      maxFailures: ULTIMO_SUSPIRO_MAX_FAILURES,
      updatedAt: now,
    },
    hpCurrent: clampedHp,
    events: ["resurrection"],
  };
}

/**
 * Garante que um jogador comum não consiga reverter MORTE DEFINITIVA
 * via importação JSON, localStorage ou edição direta de estado.
 */
export function protectUltimoSuspiroOnSave<T extends Record<string, any>>(
  candidateState: T,
  authoritativeState: UltimoSuspiroState | undefined,
  isMaster: boolean,
): T {
  const auth = authoritativeState
    ? normalizeUltimoSuspiroState(authoritativeState, authoritativeState.status === "alive" ? 1 : 0)
    : undefined;

  if (!isMaster && auth?.status === "dead") {
    return {
      ...candidateState,
      hp: {
        ...(candidateState.hp || { current: 0, max: 1 }),
        current: 0,
      },
      ultimoSuspiro: {
        ...auth,
        status: "dead",
        failures: ULTIMO_SUSPIRO_MAX_FAILURES,
      },
    };
  }

  return candidateState;
}

export function canCharacterAct(ultimoSuspiro?: UltimoSuspiroState): boolean {
  if (!ultimoSuspiro) return true;
  return ultimoSuspiro.status === "alive";
}

export function canTriggerSurvivalTest(
  ultimoSuspiro: UltimoSuspiroState | undefined,
  isOwnerOrMaster: boolean,
): boolean {
  if (!isOwnerOrMaster || !ultimoSuspiro) return false;
  if (ultimoSuspiro.status !== "dying") return false;
  if (ultimoSuspiro.coinFlipPending && !ultimoSuspiro.coinFlipUsed) return true;
  return ultimoSuspiro.failures < ULTIMO_SUSPIRO_MAX_FAILURES;
}

export function formatUltimoSuspiroNotification(
  eventType: UltimoSuspiroEventType,
  characterName: string,
  details?: {
    failures?: number;
    healedHp?: number;
    roll?: UltimoSuspiroRollSummary;
  },
): UltimoSuspiroNotification {
  const safeName = (characterName || "Personagem").trim() || "Personagem";
  const failures = Math.max(0, Math.min(ULTIMO_SUSPIRO_MAX_FAILURES, details?.failures ?? 0));
  const healedHp = Math.max(0, Math.trunc(details?.healedHp ?? details?.roll?.healedHp ?? 0));
  const rollText = details?.roll
    ? ` [${details.roll.d1}, ${details.roll.d2}] + VIT ${details.roll.vit} = ${details.roll.total}`
    : "";

  switch (eventType) {
    case "entered":
      return {
        eventType,
        title: "ÚLTIMO SUSPIRO",
        message: `${safeName} entrou em estado de morte!`,
        severity: "danger",
        badgeText: "0/3",
        characterName: safeName,
        failures: 0,
      };
    case "attempting":
      return {
        eventType,
        title: "RESISTÊNCIA À MORTE",
        message: `${safeName} está tentando resistir à morte.`,
        severity: "attempt",
        badgeText: `${failures}/3`,
        characterName: safeName,
        failures,
      };
    case "failure":
      return {
        eventType,
        title: "FALHA",
        message: `${safeName} não conseguiu resistir à morte.${rollText}`,
        severity: "warning",
        badgeText: `${failures}/3`,
        characterName: safeName,
        failures,
        roll: details?.roll,
      };
    case "critical_success":
      return {
        eventType,
        title: "SUCESSO CRÍTICO",
        message: `${safeName} resistiu à morte${details?.roll?.centerHit ? " (acerto no centro)" : ""} e recuperou +${healedHp} PV!${rollText}`,
        severity: "critical",
        badgeText: `+${healedHp} PV`,
        characterName: safeName,
        failures: 0,
        healedHp,
        roll: details?.roll,
      };
    case "imminent_death":
      return {
        eventType,
        title: "MORTE IMINENTE",
        message: `${safeName} está em seu último turno!`,
        severity: "danger",
        badgeText: "2/3",
        characterName: safeName,
        failures: 2,
      };
    case "coin_flip_available":
      return {
        eventType,
        title: "ÚLTIMA CHANCE",
        message: `${safeName} chegou a 0 turnos — lance a moeda.`,
        severity: "danger",
        badgeText: "MOEDA",
        characterName: safeName,
        failures: 3,
      };
    case "coin_flip_won":
      return {
        eventType,
        title: "ÚLTIMA CHANCE",
        message: `${safeName} venceu no cara ou coroa e ganhou +1 turno!`,
        severity: "critical",
        badgeText: "+1 TURNO",
        characterName: safeName,
        failures: 2,
      };
    case "coin_flip_lost":
      return {
        eventType,
        title: "ÚLTIMA CHANCE",
        message: `${safeName} perdeu no cara ou coroa.`,
        severity: "dead",
        badgeText: "3/3",
        characterName: safeName,
        failures: 3,
      };
    case "permanent_death":
      return {
        eventType,
        title: "MORTE DEFINITIVA",
        message: `${safeName} morreu.`,
        severity: "dead",
        badgeText: "3/3",
        characterName: safeName,
        failures: 3,
        roll: details?.roll,
      };
    case "resurrection":
      return {
        eventType,
        title: "RESSURREIÇÃO",
        message: `O Mestre trouxe ${safeName} de volta à vida (+${healedHp} PV).`,
        severity: "resurrection",
        badgeText: `+${healedHp} PV`,
        characterName: safeName,
        failures: 0,
        healedHp,
      };
  }
}
