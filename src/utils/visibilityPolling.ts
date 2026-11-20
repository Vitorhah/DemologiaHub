/**
 * Coordenador de polling consciente de visibilidade e rede para celular/Android WebView.
 *
 * - Pausa automaticamente intervalos de fallback quando a página está oculta (`document.hidden`)
 *   ou sem rede (`navigator.onLine === false`), reduzindo drenagem de bateria e tráfego redundante.
 * - Ao retornar ao primeiro plano (`visibilitychange`) ou recuperar rede (`online`), dispara
 *   uma re-sincronização única coalescida respeitando janela mínima (`minWakeGapMs`).
 * - Evita re-entrância quando uma chamada anterior ainda está em andamento.
 */

export interface VisibilityDocLike {
  hidden: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface VisibilityWinLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface VisibilityPollerOptions {
  /** Intervalo em milissegundos quando a página está visível e online */
  intervalMs: number;
  /** Intervalo mínimo entre re-sincronizações automáticas ao voltar ao foco (evita rajadas) */
  minWakeGapMs?: number;
  /** Executar imediatamente na inicialização (padrão: true) */
  runImmediately?: boolean;
  /** Ambiente opcional para testes unitários */
  doc?: VisibilityDocLike | null;
  win?: VisibilityWinLike | null;
  nav?: Pick<Navigator, "onLine"> | null;
  now?: () => number;
}

export interface VisibilityPollerHandle {
  /** Dispara a tarefa imediatamente se estiver online (respeitando anti-reentrância) */
  triggerNow: () => void;
  /** Encerra timers e listeners */
  stop: () => void;
}

export function createVisibilityPoller(
  task: () => void | Promise<unknown>,
  options: VisibilityPollerOptions
): VisibilityPollerHandle {
  const {
    intervalMs,
    minWakeGapMs = 1500,
    runImmediately = true,
    doc = typeof document !== "undefined" ? document : null,
    win = typeof window !== "undefined" ? window : null,
    nav = typeof navigator !== "undefined" ? navigator : null,
    now = () => Date.now(),
  } = options;

  let stopped = false;
  let inFlight = false;
  let lastRunAt = 0;
  let timerId: ReturnType<typeof setInterval> | null = null;

  const isVisible = () => (doc ? !doc.hidden : true);
  const isOnline = () => (nav && typeof nav.onLine === "boolean" ? nav.onLine : true);

  const runTask = (force: boolean) => {
    if (stopped || inFlight) return;
    if (!isOnline()) return;
    if (!force && !isVisible()) return;

    const currentTs = now();
    if (!force && lastRunAt > 0 && currentTs - lastRunAt < minWakeGapMs) {
      return;
    }

    lastRunAt = currentTs;
    inFlight = true;
    try {
      const result = task();
      if (result && typeof (result as Promise<unknown>).finally === "function") {
        (result as Promise<unknown>).finally(() => {
          inFlight = false;
        });
      } else {
        inFlight = false;
      }
    } catch {
      inFlight = false;
    }
  };

  const startTimer = () => {
    if (stopped || timerId !== null) return;
    timerId = setInterval(() => {
      if (isVisible() && isOnline()) {
        runTask(false);
      }
    }, Math.max(1000, intervalMs));
  };

  const stopTimer = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const handleVisibilityChange = () => {
    if (stopped) return;
    if (isVisible()) {
      startTimer();
      runTask(false);
    } else {
      stopTimer();
    }
  };

  const handleOnline = () => {
    if (stopped) return;
    if (isVisible()) {
      startTimer();
      runTask(false);
    }
  };

  const handleOffline = () => {
    stopTimer();
  };

  doc?.addEventListener("visibilitychange", handleVisibilityChange);
  win?.addEventListener("online", handleOnline);
  win?.addEventListener("offline", handleOffline);

  if (isVisible() && isOnline()) {
    startTimer();
    if (runImmediately) {
      runTask(true);
    }
  }

  return {
    triggerNow: () => runTask(true),
    stop: () => {
      if (stopped) return;
      stopped = true;
      stopTimer();
      doc?.removeEventListener("visibilitychange", handleVisibilityChange);
      win?.removeEventListener("online", handleOnline);
      win?.removeEventListener("offline", handleOffline);
    },
  };
}

/**
 * Gera uma assinatura determinística leve para listas de fichas/jogadores vindas do Supabase,
 * evitando `JSON.stringify` completo em todo o array a cada ciclo de polling no WebView.
 */
export function buildPlayersRevisionSignature(
  rows: ReadonlyArray<{
    id?: string;
    updated_at?: string | null;
    name?: string;
    hp?: { current?: number; max?: number };
    pe?: { current?: number; max?: number };
    sm?: { current?: number; max?: number };
    ep?: number;
    lv?: number;
    profile?: string;
    statusEffects?: ReadonlyArray<{ id?: string; label?: string }>;
    rituals?: ReadonlyArray<{ id?: number; name?: string }>;
    history?: ReadonlyArray<string>;
    variables?: Record<string, unknown>;
  }>
): string {
  if (!Array.isArray(rows) || rows.length === 0) return "0";
  const parts: string[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const vars = r.variables || {};
    const varKeys = Object.keys(vars);
    let varSig = "";
    for (let k = 0; k < varKeys.length; k++) {
      const key = varKeys[k];
      varSig += `${key}=${String(vars[key])};`;
    }
    const effects = r.statusEffects || [];
    let effSig = "";
    for (let e = 0; e < effects.length; e++) {
      effSig += `${effects[e]?.id ?? ""}:${effects[e]?.label ?? ""},`;
    }
    const lastHist = Array.isArray(r.history) && r.history.length > 0 ? r.history[0] : "";
    const ritualsCount = Array.isArray(r.rituals) ? r.rituals.length : 0;
    parts[i] = [
      r.id ?? "",
      r.updated_at ?? "",
      r.name ?? "",
      `${r.hp?.current ?? ""}/${r.hp?.max ?? ""}`,
      `${r.pe?.current ?? ""}/${r.pe?.max ?? ""}`,
      `${r.sm?.current ?? ""}/${r.sm?.max ?? ""}`,
      r.ep ?? 0,
      r.lv ?? 1,
      r.profile ?? "",
      ritualsCount,
      effSig,
      varSig,
      lastHist,
    ].join("|");
  }
  return `${rows.length}#${parts.join("§")}`;
}
