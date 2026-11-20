/**
 * Gerenciador de Tela Acesa (Wake Lock) para dispositivos móveis, Android WebView e PC.
 *
 * Estratégia em 2 camadas:
 * 1. Screen Wake Lock API nativa (`navigator.wakeLock.request("screen")`), suportada em
 *    Chrome Android, Edge, Safari iOS 16.4+ e Android WebViews modernos.
 * 2. Fallback leve inline com vídeo silencioso em memória (sem dependências externas)
 *    para Android WebViews antigos que não expõem `navigator.wakeLock`.
 *
 * Também gerencia:
 * - Preferência local por dispositivo em `localStorage` (nunca dados compartilhados)
 * - Reaquisição automática ao retornar do segundo plano (`visibilitychange`)
 * - Reativação silenciosa no primeiro gesto do usuário caso o navegador bloqueie antes da interação
 */

export const WAKE_LOCK_PREF_KEY = "demologia_wake_lock_pref";

export type WakeLockMode = "native" | "fallback" | "unsupported";

export interface WakeLockState {
  enabled: boolean;
  active: boolean;
  mode: WakeLockMode;
  waitingForGesture: boolean;
  errorMessage: string | null;
}

export interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
  removeEventListener?: (type: "release", listener: () => void) => void;
}

export interface WakeLockNavigatorLike {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
}

/**
 * Menor container MP4 silencioso/vazio válido (base64 curto, ~1KB) usado apenas
 * como fallback em Android WebViews antigos sem `navigator.wakeLock`.
 * Reproduzido mudo (`muted`) e inline (`playsInline`) sem interferir no Web Audio da OST.
 */
const SILENT_FALLBACK_MP4_DATA_URI =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSAxZDBmZjhhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlyaWdodCAyMDAzLTIwMTggLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcmdhbmFpemF0aW9uOiBub25lIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAADAAADAAADAAAA";

export function readWakeLockPreference(storage?: Pick<Storage, "getItem"> | null): boolean {
  try {
    const target = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!target) return false;
    return target.getItem(WAKE_LOCK_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeWakeLockPreference(
  enabled: boolean,
  storage?: Pick<Storage, "setItem"> | null
): void {
  try {
    const target = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!target) return;
    target.setItem(WAKE_LOCK_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // Ignorar indisponibilidade de storage em modos privados restritos
  }
}

export function detectWakeLockMode(
  nav?: WakeLockNavigatorLike | null,
  hasVideoFallback: boolean = typeof document !== "undefined"
): WakeLockMode {
  const targetNav =
    nav ?? (typeof navigator !== "undefined" ? (navigator as unknown as WakeLockNavigatorLike) : null);
  if (targetNav?.wakeLock && typeof targetNav.wakeLock.request === "function") {
    return "native";
  }
  return hasVideoFallback ? "fallback" : "unsupported";
}

export interface WakeLockDocLike {
  visibilityState: DocumentVisibilityState;
  body: Pick<HTMLElement, "appendChild"> | null;
  createElement: (tagName: "video") => HTMLVideoElement;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface WakeLockWinLike {
  addEventListener: (
    type: string,
    listener: () => void,
    options?: AddEventListenerOptions | boolean
  ) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface WakeLockControllerDeps {
  nav?: WakeLockNavigatorLike | null;
  doc?: WakeLockDocLike | null;
  win?: WakeLockWinLike | null;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  enableVideoFallback?: boolean;
}

export class WakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private fallbackVideo: HTMLVideoElement | null = null;
  private listeners = new Set<(state: WakeLockState) => void>();
  private state: WakeLockState;
  private readonly nav: WakeLockNavigatorLike | null;
  private readonly doc: WakeLockControllerDeps["doc"];
  private readonly win: WakeLockControllerDeps["win"];
  private readonly storage: WakeLockControllerDeps["storage"];
  private readonly enableVideoFallback: boolean;
  private isAcquiring = false;
  private attached = false;

  constructor(deps: WakeLockControllerDeps = {}) {
    this.nav =
      deps.nav !== undefined
        ? deps.nav
        : typeof navigator !== "undefined"
          ? (navigator as unknown as WakeLockNavigatorLike)
          : null;
    this.doc =
      deps.doc !== undefined
        ? deps.doc
        : typeof document !== "undefined"
          ? document
          : null;
    this.win =
      deps.win !== undefined
        ? deps.win
        : typeof window !== "undefined"
          ? window
          : null;
    this.storage = deps.storage;
    this.enableVideoFallback = deps.enableVideoFallback ?? true;

    const initialEnabled = readWakeLockPreference(this.storage);
    const mode = detectWakeLockMode(this.nav, Boolean(this.doc) && this.enableVideoFallback);

    this.state = {
      enabled: initialEnabled,
      active: false,
      mode,
      waitingForGesture: initialEnabled && mode !== "unsupported",
      errorMessage: null,
    };
  }

  getState(): WakeLockState {
    return { ...this.state };
  }

  subscribe(listener: (state: WakeLockState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(partial: Partial<WakeLockState>) {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private handleVisibilityChange = () => {
    if (!this.doc) return;
    if (this.doc.visibilityState === "visible" && this.state.enabled && !this.state.active) {
      void this.acquire(false);
    }
  };

  private handleUserGesture = () => {
    if (this.state.enabled && !this.state.active) {
      void this.acquire(true);
    }
  };

  private handleSentinelRelease = () => {
    this.sentinel = null;
    if (this.state.enabled) {
      this.emit({
        active: false,
        waitingForGesture: this.doc?.visibilityState === "visible",
      });
    } else {
      this.emit({ active: false, waitingForGesture: false });
    }
  };

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.doc?.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.win?.addEventListener("pointerdown", this.handleUserGesture, { passive: true });
    this.win?.addEventListener("keydown", this.handleUserGesture, { passive: true });

    if (this.state.enabled && (!this.doc || this.doc.visibilityState === "visible")) {
      void this.acquire(false);
    }
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;

    this.doc?.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.win?.removeEventListener("pointerdown", this.handleUserGesture);
    this.win?.removeEventListener("keydown", this.handleUserGesture);
    void this.releaseLockOnly();
  }

  async setEnabled(enabled: boolean): Promise<WakeLockState> {
    writeWakeLockPreference(enabled, this.storage);
    if (!enabled) {
      await this.releaseLockOnly();
      this.emit({
        enabled: false,
        active: false,
        waitingForGesture: false,
        errorMessage: null,
      });
      return this.getState();
    }

    this.emit({
      enabled: true,
      errorMessage: null,
    });
    await this.acquire(true);
    return this.getState();
  }

  async toggle(): Promise<WakeLockState> {
    return this.setEnabled(!this.state.enabled);
  }

  private async releaseLockOnly(): Promise<void> {
    if (this.sentinel) {
      const current = this.sentinel;
      this.sentinel = null;
      try {
        current.removeEventListener?.("release", this.handleSentinelRelease);
        await current.release();
      } catch {
        // Ignorar erros ao liberar sentinel já encerrado
      }
    }

    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        this.fallbackVideo.removeAttribute("src");
        this.fallbackVideo.load();
        if (this.fallbackVideo.parentNode) {
          this.fallbackVideo.parentNode.removeChild(this.fallbackVideo);
        }
      } catch {
        // Ignorar falha de limpeza do elemento fallback
      }
      this.fallbackVideo = null;
    }
  }

  private async tryFallbackVideo(): Promise<boolean> {
    if (!this.enableVideoFallback || !this.doc) return false;
    try {
      if (!this.fallbackVideo) {
        const video = this.doc.createElement("video");
        video.setAttribute("playsinline", "");
        video.setAttribute("muted", "");
        video.setAttribute("loop", "");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute("aria-hidden", "true");
        video.style.position = "fixed";
        video.style.width = "1px";
        video.style.height = "1px";
        video.style.opacity = "0.001";
        video.style.pointerEvents = "none";
        video.style.bottom = "0";
        video.style.right = "0";
        video.src = SILENT_FALLBACK_MP4_DATA_URI;
        this.doc.body?.appendChild(video);
        this.fallbackVideo = video;
      }
      await this.fallbackVideo.play();
      return true;
    } catch {
      await this.releaseLockOnly();
      return false;
    }
  }

  async acquire(fromUserGesture: boolean): Promise<boolean> {
    if (!this.state.enabled) return false;
    if (this.state.active) return true;
    if (this.isAcquiring) return false;
    if (this.doc && this.doc.visibilityState !== "visible") {
      return false;
    }

    this.isAcquiring = true;
    try {
      // Camada 1: Screen Wake Lock API nativa
      if (this.nav?.wakeLock && typeof this.nav.wakeLock.request === "function") {
        try {
          const sentinel = await this.nav.wakeLock.request("screen");
          if (!this.state.enabled) {
            await sentinel.release().catch(() => {});
            return false;
          }
          this.sentinel = sentinel;
          sentinel.addEventListener?.("release", this.handleSentinelRelease);
          this.emit({
            active: true,
            mode: "native",
            waitingForGesture: false,
            errorMessage: null,
          });
          return true;
        } catch (err: any) {
          const name = String(err?.name || "");
          // Se o navegador bloqueou por falta de gesto do usuário, aguardar próximo toque
          if (!fromUserGesture && (name === "NotAllowedError" || name === "SecurityError")) {
            this.emit({
              active: false,
              mode: "native",
              waitingForGesture: true,
              errorMessage: null,
            });
            return false;
          }
          // Tenta fallback leve antes de desistir
          if (fromUserGesture && this.enableVideoFallback) {
            const okFallback = await this.tryFallbackVideo();
            if (okFallback) {
              this.emit({
                active: true,
                mode: "fallback",
                waitingForGesture: false,
                errorMessage: null,
              });
              return true;
            }
          }
          if (fromUserGesture) {
            writeWakeLockPreference(false, this.storage);
          }
          this.emit({
            enabled: fromUserGesture ? false : this.state.enabled,
            active: false,
            mode: "native",
            waitingForGesture: !fromUserGesture,
            errorMessage:
              "O sistema operacional ou modo de economia bloqueou a trava de tela.",
          });
          return false;
        }
      }

      // Camada 2: Fallback silencioso para Android WebViews antigos
      if (this.enableVideoFallback && this.doc) {
        if (!fromUserGesture) {
          this.emit({
            active: false,
            mode: "fallback",
            waitingForGesture: true,
            errorMessage: null,
          });
          return false;
        }
        const okFallback = await this.tryFallbackVideo();
        if (okFallback) {
          this.emit({
            active: true,
            mode: "fallback",
            waitingForGesture: false,
            errorMessage: null,
          });
          return true;
        }
        writeWakeLockPreference(false, this.storage);
        this.emit({
          enabled: false,
          active: false,
          mode: "unsupported",
          waitingForGesture: false,
          errorMessage: "Este navegador/WebView não permite manter a tela acesa.",
        });
        return false;
      }

      if (fromUserGesture) {
        writeWakeLockPreference(false, this.storage);
      }
      this.emit({
        enabled: false,
        active: false,
        mode: "unsupported",
        waitingForGesture: false,
        errorMessage: "Wake Lock indisponível neste dispositivo.",
      });
      return false;
    } finally {
      this.isAcquiring = false;
    }
  }
}
