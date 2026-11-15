import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { Howl, Howler } from "howler";
import {
  arePlaybackStatesEqual,
  ClockSample,
  computeSignedDrift,
  computeSynchronizedPosition,
  decideDriftCorrection,
  isStalePlaybackState,
  normalizeTrackUrl,
  OstHealthStatus,
  PlaybackState,
  selectBestClockOffset,
} from "./ostUtils";

export type { PlaybackState, OstHealthStatus };

/**
 * Interface que representa uma faixa na biblioteca da mesa.
 */
export interface Track {
  id: string;
  room_id: string;
  name: string;
  url: string;
  source: "upload" | "link";
  created_at?: string;
}

export interface OstStatusSnapshot {
  status: OstHealthStatus;
  error: string | null;
  duration: number;
}

export type PlaybackStateCallback = (state: PlaybackState | null) => void;
export type TracksCallback = (tracks: Track[]) => void;
export type OstStatusCallback = (snapshot: OstStatusSnapshot) => void;

const DRIFT_CHECK_INTERVAL_MS = 1500;
const CLOCK_SYNC_INTERVAL_MS = 60000;
const VOLUME_PERSIST_DEBOUNCE_MS = 220;

/**
 * Sistema otimizado de sincronização de trilha sonora (OST) em mesas de RPG.
 * Usa Howler.js (HTML5 streaming pool + WebAudio unlock) aliado a calibração NTP-lite,
 * correção suave de drift por playbackRate (sem travamentos/re-buffering),
 * e dual-channel Supabase (Broadcast instantâneo + PostgreSQL Realtime).
 */
export class MusicSync {
  private supabase: SupabaseClient;
  private activeHowl: Howl | null = null;
  private activeHowlUrl: string = "";
  private activeHowlLoaded: boolean = false;
  private activeSoundId: number | null = null;
  private activeDuration: number = 0;

  private preloadAudio: HTMLAudioElement;
  private preloadUrl: string = "";

  private roomId: string | null = null;
  private isMaster: boolean = false;

  private playbackChannel: RealtimeChannel | null = null;
  private tracksChannel: RealtimeChannel | null = null;

  private clockOffset: number = 0;
  private clockSyncInterval: number | null = null;
  private driftCheckInterval: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private reconnectTimer: number | null = null;
  private volumePersistTimer: number | null = null;

  private currentState: PlaybackState | null = null;
  private tracksList: Track[] = [];
  private statusSnapshot: OstStatusSnapshot = {
    status: "idle",
    error: null,
    duration: 0,
  };

  private isBuffering: boolean = false;
  private isSeeking: boolean = false;
  private lastHardSeekAtMs: number = 0;
  private lastCommandUpdatedAtMs: number = 0;
  private currentPlaybackRate: number = 1.0;

  private stateSubscribers: Set<PlaybackStateCallback> = new Set();
  private tracksSubscribers: Set<TracksCallback> = new Set();
  private statusSubscribers: Set<OstStatusCallback> = new Set();

  private pendingPlayState: PlaybackState | null = null;
  private unlockListenersAttached: boolean = false;
  private interactionHandler: (() => void) | null = null;

  private isDestroyed: boolean = false;
  private audioUnlocked: boolean = false;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;

    Howler.autoUnlock = true;
    Howler.html5PoolSize = 10;

    this.preloadAudio = new Audio();
    this.preloadAudio.preload = "metadata";
    this.preloadAudio.volume = 0;
  }

  // ============================================================================
  // GERENCIAMENTO DA SALA (LIFECYCLE)
  // ============================================================================

  public async joinRoom(roomId: string, isMaster: boolean = false): Promise<void> {
    if (this.roomId === roomId && !this.isDestroyed) {
      this.isMaster = isMaster;
      return;
    }

    if (this.roomId) {
      await this.leaveRoom();
    }

    this.roomId = roomId;
    this.isMaster = isMaster;
    this.isDestroyed = false;

    try {
      // 1. Calibração inicial de relógio multi-amostra (filtra picos de latência)
      await this.syncClock(2);

      if (this.clockSyncInterval) clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = window.setInterval(() => {
        this.syncClock(1).catch((err) =>
          console.warn("[MusicSync] Erro na calibração periódica do relógio:", err),
        );
      }, CLOCK_SYNC_INTERVAL_MS);

      if (this.driftCheckInterval) clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = window.setInterval(() => {
        this.checkAndCorrectDrift();
      }, DRIFT_CHECK_INTERVAL_MS);

      this.attachVisibilityListener();

      // 2. Estado inicial + biblioteca de faixas em paralelo
      await Promise.all([
        this.fetchInitialPlaybackState(),
        this.fetchTracks(),
      ]);

      // 3. Canais Realtime (Broadcast instantâneo + Postgres Changes)
      this.setupRealtimeSubscriptions();
    } catch (error) {
      console.error(`[MusicSync] Falha ao conectar na sala ${roomId}:`, error);
    }
  }

  public async leaveRoom(): Promise<void> {
    this.roomId = null;

    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }

    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.volumePersistTimer) {
      clearTimeout(this.volumePersistTimer);
      this.volumePersistTimer = null;
    }

    this.detachVisibilityListener();
    this.removeAutoplayListeners();

    try {
      if (this.playbackChannel) {
        await this.supabase.removeChannel(this.playbackChannel);
        this.playbackChannel = null;
      }
      if (this.tracksChannel) {
        await this.supabase.removeChannel(this.tracksChannel);
        this.tracksChannel = null;
      }
    } catch (err) {
      console.warn("[MusicSync] Erro ao remover canais:", err);
    }

    this.disposeActiveHowl();
    this.preloadAudio.src = "";
    this.preloadUrl = "";
    this.currentState = null;
    this.tracksList = [];
    this.pendingPlayState = null;
    this.updateStatus("idle", null, 0);
    this.notifyStateSubscribers(null);
    this.notifyTracksSubscribers([]);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.leaveRoom().catch(console.error);
    this.stateSubscribers.clear();
    this.tracksSubscribers.clear();
    this.statusSubscribers.clear();
  }

  // ============================================================================
  // SINCRONIZAÇÃO DE RELÓGIO (NTP-LITE COM FILTRO DE RTT)
  // ============================================================================

  public async syncClock(sampleCount: number = 1): Promise<void> {
    const samples: ClockSample[] = [];
    const iterations = Math.max(1, Math.min(3, sampleCount));

    for (let i = 0; i < iterations; i++) {
      try {
        const tRequest = Date.now();
        const { data, error } = await this.supabase.rpc("server_now");
        const tResponse = Date.now();

        if (error) throw error;

        if (data) {
          const serverTimestamp = new Date(data).getTime();
          if (Number.isFinite(serverTimestamp)) {
            const rttMs = Math.max(0, tResponse - tRequest);
            const midpoint = tRequest + rttMs / 2;
            samples.push({
              offsetMs: serverTimestamp - midpoint,
              rttMs,
            });
          }
        }
      } catch (err) {
        if (i === 0) {
          console.warn(
            "[MusicSync] RPC server_now indisponível ou falhou. Mantendo relógio atual:",
            err,
          );
        }
        break;
      }
    }

    if (samples.length > 0) {
      this.clockOffset = selectBestClockOffset(samples);
    }
  }

  public getServerNowMs(): number {
    return Date.now() + this.clockOffset;
  }

  private nextMonotonicIsoTimestamp(): string {
    const now = this.getServerNowMs();
    const monotonic = Math.max(now, this.lastCommandUpdatedAtMs + 1);
    this.lastCommandUpdatedAtMs = monotonic;
    return new Date(monotonic).toISOString();
  }

  // ============================================================================
  // GERENCIAMENTO DO MOTOR HOWLER & CONTROLE ANTI-TRAVAMENTO
  // ============================================================================

  private getUnderlyingAudioNode(howl: Howl | null = this.activeHowl): HTMLAudioElement | null {
    if (!howl) return null;
    const sounds = (howl as any)._sounds;
    if (Array.isArray(sounds) && sounds.length > 0 && sounds[0]?._node) {
      return sounds[0]._node as HTMLAudioElement;
    }
    return null;
  }

  private disposeActiveHowl(): void {
    if (this.activeHowl) {
      try {
        this.activeHowl.stop();
        this.activeHowl.unload();
      } catch {
        // Ignora falha de unload em estado transitório
      }
    }
    this.activeHowl = null;
    this.activeHowlUrl = "";
    this.activeHowlLoaded = false;
    this.activeSoundId = null;
    this.activeDuration = 0;
    this.isBuffering = false;
    this.isSeeking = false;
    this.currentPlaybackRate = 1.0;
  }

  private setHowlPlaybackRate(rate: number): void {
    if (!this.activeHowl || Math.abs(this.currentPlaybackRate - rate) < 0.005) {
      return;
    }
    this.currentPlaybackRate = rate;
    try {
      const node = this.getUnderlyingAudioNode();
      if (node) {
        if ("preservesPitch" in node) {
          (node as any).preservesPitch = true;
        }
        node.playbackRate = rate;
      } else {
        this.activeHowl.rate(rate);
      }
    } catch {
      // Ignora em navegadores sem suporte a playbackRate em stream
    }
  }

  private performHardSeek(targetSeconds: number): void {
    if (!this.activeHowl || !this.activeHowlLoaded) return;
    const duration = this.activeDuration > 0 ? this.activeDuration : this.activeHowl.duration();
    const clamped =
      duration > 0
        ? Math.max(0, Math.min(duration - 0.05, targetSeconds))
        : Math.max(0, targetSeconds);

    try {
      this.isSeeking = true;
      this.lastHardSeekAtMs = Date.now();
      this.setHowlPlaybackRate(1.0);
      if (this.activeSoundId !== null) {
        this.activeHowl.seek(clamped, this.activeSoundId);
      } else {
        this.activeHowl.seek(clamped);
      }
      // Fallback de segurança caso onseek não dispare em alguns WebViews
      window.setTimeout(() => {
        this.isSeeking = false;
      }, 350);
    } catch (err) {
      this.isSeeking = false;
      console.warn("[MusicSync] Falha ao posicionar faixa:", err);
    }
  }

  private attachHtml5NodeListeners(howl: Howl): void {
    const node = this.getUnderlyingAudioNode(howl);
    if (!node || (node as any).__demologiaListenersAttached) return;
    (node as any).__demologiaListenersAttached = true;

    node.addEventListener("waiting", () => {
      if (this.activeHowl === howl) {
        this.isBuffering = true;
        this.setHowlPlaybackRate(1.0);
        if (this.currentState?.is_playing) {
          this.updateStatus("buffering", null, this.activeDuration);
        }
      }
    });

    node.addEventListener("stalled", () => {
      if (this.activeHowl === howl && this.currentState?.is_playing) {
        this.isBuffering = true;
        this.setHowlPlaybackRate(1.0);
      }
    });

    node.addEventListener("playing", () => {
      if (this.activeHowl === howl) {
        this.isBuffering = false;
        this.isSeeking = false;
        this.updateStatus("playing", null, this.activeDuration);
      }
    });

    node.addEventListener("canplay", () => {
      if (this.activeHowl === howl) {
        this.isBuffering = false;
      }
    });

    node.addEventListener("loadedmetadata", () => {
      if (this.activeHowl === howl && Number.isFinite(node.duration) && node.duration > 0) {
        this.activeDuration = node.duration;
        this.updateStatus(this.statusSnapshot.status, this.statusSnapshot.error, this.activeDuration);
      }
    });
  }

  private createHowlForTrack(normalizedUrl: string, state: PlaybackState): void {
    this.disposeActiveHowl();
    this.activeHowlUrl = normalizedUrl;
    this.activeHowlLoaded = false;
    this.updateStatus("loading", null, 0);

    const safeVolume = Math.max(0, Math.min(1, state.volume ?? 1));

    const howl = new Howl({
      src: [normalizedUrl],
      html5: true,
      preload: true,
      loop: Boolean(state.loop),
      volume: safeVolume,
      onload: () => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        this.activeHowlLoaded = true;
        this.isBuffering = false;
        this.activeDuration = howl.duration() || 0;
        this.attachHtml5NodeListeners(howl);

        const latestState = this.currentState;
        if (!latestState || normalizeTrackUrl(latestState.track_url) !== normalizedUrl) {
          return;
        }

        const targetPos = computeSynchronizedPosition({
          state: latestState,
          serverNowMs: this.getServerNowMs(),
          durationSeconds: this.activeDuration,
        });

        const currentPos = this.getCurrentAudioTime();
        if (Math.abs(currentPos - targetPos) > 0.45) {
          this.performHardSeek(targetPos);
        }

        this.updateStatus(
          latestState.is_playing ? "playing" : "paused",
          null,
          this.activeDuration,
        );
      },
      onplay: (soundId) => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        this.activeSoundId = soundId;
        this.isBuffering = false;
        this.attachHtml5NodeListeners(howl);
        this.updateStatus("playing", null, this.activeDuration || howl.duration() || 0);
      },
      onpause: () => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        this.isBuffering = false;
        this.setHowlPlaybackRate(1.0);
        this.updateStatus("paused", null, this.activeDuration);
      },
      onstop: () => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        this.isBuffering = false;
        this.setHowlPlaybackRate(1.0);
        this.updateStatus("paused", null, this.activeDuration);
      },
      onseek: () => {
        if (this.activeHowl !== howl) return;
        this.isSeeking = false;
      },
      onend: () => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        if (this.currentState && !this.currentState.loop && this.isMaster) {
          this.stop().catch(console.error);
        }
      },
      onloaderror: (_id, err) => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        this.isBuffering = false;
        this.activeHowlLoaded = false;
        console.warn("[MusicSync] Erro ao carregar áudio:", err);
        this.updateStatus(
          "error",
          "Falha ao carregar áudio (link expirado, bloqueado ou formato inválido).",
          0,
        );
      },
      onplayerror: (_id, err) => {
        if (this.activeHowl !== howl || this.isDestroyed) return;
        const msg = String(err || "").toLowerCase();
        const isAutoplayBlocked =
          !this.audioUnlocked ||
          msg.includes("notallowed") ||
          msg.includes("user") ||
          msg.includes("gesture") ||
          msg.includes("play");

        if (isAutoplayBlocked && this.currentState?.is_playing) {
          this.pendingPlayState = this.currentState;
          this.registerAutoplayUnlock();
          this.updateStatus("paused", null, this.activeDuration);
        } else {
          console.warn("[MusicSync] Erro ao reproduzir áudio:", err);
          this.updateStatus(
            "error",
            "Não foi possível iniciar a reprodução desta faixa.",
            this.activeDuration,
          );
        }
      },
    });

    this.activeHowl = howl;
    this.attachHtml5NodeListeners(howl);
  }

  /**
   * Aplica o estado de reprodução recebido sem causar cortes nem seek-loops.
   */
  private applyPlaybackState(state: PlaybackState | null, forceReload = false): void {
    if (this.isDestroyed) return;

    this.currentState = state;
    this.notifyStateSubscribers(state);

    if (!state || !state.track_url) {
      this.pendingPlayState = null;
      this.disposeActiveHowl();
      this.updateStatus("idle", null, 0);
      return;
    }

    const normalizedUrl = normalizeTrackUrl(state.track_url);
    const safeVolume = Math.max(0, Math.min(1, state.volume ?? 1));
    const isNewTrack = forceReload || !this.activeHowl || this.activeHowlUrl !== normalizedUrl;

    if (isNewTrack) {
      this.createHowlForTrack(normalizedUrl, state);
    } else if (this.activeHowl) {
      this.activeHowl.loop(Boolean(state.loop));
      this.activeHowl.volume(safeVolume);
    }

    const howl = this.activeHowl;
    if (!howl) return;

    if (!state.is_playing) {
      this.pendingPlayState = null;
      this.setHowlPlaybackRate(1.0);
      if (howl.playing()) {
        howl.pause();
      }
      const pausedPos = Math.max(0, state.paused_position || 0);
      if (this.activeHowlLoaded && Math.abs(this.getCurrentAudioTime() - pausedPos) > 0.2) {
        this.performHardSeek(pausedPos);
      }
      if (this.statusSnapshot.status !== "error") {
        this.updateStatus("paused", null, this.activeDuration);
      }
      return;
    }

    // Estado ativo (reproduzindo)
    const targetPos = computeSynchronizedPosition({
      state,
      serverNowMs: this.getServerNowMs(),
      durationSeconds: this.activeDuration,
    });

    if (this.activeHowlLoaded) {
      const currentPos = this.getCurrentAudioTime();
      const signedDrift = computeSignedDrift({
        currentTime: currentPos,
        targetTime: targetPos,
        durationSeconds: this.activeDuration,
        loop: Boolean(state.loop),
      });

      if (Math.abs(signedDrift) > 0.8) {
        this.performHardSeek(targetPos);
      }
    }

    if (!howl.playing()) {
      try {
        const sid = howl.play();
        if (typeof sid === "number") {
          this.activeSoundId = sid;
        }
      } catch {
        this.pendingPlayState = state;
        this.registerAutoplayUnlock();
      }
    }
  }

  /**
   * Monitora periodicamente o desvio entre cliente e relógio do servidor.
   * Utiliza ajuste suave de velocidade (0.96x-1.04x) para desvios pequenos/médios,
   * eliminando o travamento e o efeito de "voltar atrás".
   */
  private checkAndCorrectDrift(): void {
    if (
      this.isDestroyed ||
      !this.activeHowl ||
      !this.activeHowlLoaded ||
      !this.currentState ||
      !this.currentState.is_playing ||
      !this.activeHowl.playing()
    ) {
      this.setHowlPlaybackRate(1.0);
      return;
    }

    const duration = this.activeDuration || this.activeHowl.duration() || 0;
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    this.activeDuration = duration;

    const targetPos = computeSynchronizedPosition({
      state: this.currentState,
      serverNowMs: this.getServerNowMs(),
      durationSeconds: duration,
    });

    const currentPos = this.getCurrentAudioTime();
    const signedDrift = computeSignedDrift({
      currentTime: currentPos,
      targetTime: targetPos,
      durationSeconds: duration,
      loop: Boolean(this.currentState.loop),
    });

    const decision = decideDriftCorrection({
      signedDrift,
      isBuffering: this.isBuffering,
      isSeeking: this.isSeeking,
      lastHardSeekAtMs: this.lastHardSeekAtMs,
      nowMs: Date.now(),
    });

    if (decision.action === "seek") {
      this.performHardSeek(targetPos);
    } else {
      this.setHowlPlaybackRate(decision.playbackRate);
    }
  }

  private registerAutoplayUnlock(): void {
    if (this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const onUserInteraction = () => {
      this.unlockAudio();
    };

    this.interactionHandler = onUserInteraction;
    document.addEventListener("pointerdown", onUserInteraction, { once: true });
    document.addEventListener("keydown", onUserInteraction, { once: true });
    document.addEventListener("touchstart", onUserInteraction, { once: true });
  }

  private removeAutoplayListeners(): void {
    if (this.interactionHandler) {
      document.removeEventListener("pointerdown", this.interactionHandler);
      document.removeEventListener("keydown", this.interactionHandler);
      document.removeEventListener("touchstart", this.interactionHandler);
      this.interactionHandler = null;
    }
    this.unlockListenersAttached = false;
  }

  private attachVisibilityListener(): void {
    if (this.visibilityHandler || typeof document === "undefined") return;
    this.visibilityHandler = () => {
      if (!document.hidden && this.roomId && !this.isDestroyed) {
        this.syncClock(1)
          .then(() => this.fetchInitialPlaybackState(true))
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private detachVisibilityListener(): void {
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Desbloqueia proativamente o motor Howler e retoma qualquer faixa pendente.
   */
  public unlockAudio(): void {
    if (this.isDestroyed) return;
    this.audioUnlocked = true;
    this.removeAutoplayListeners();

    try {
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignora se Web Audio Context estiver indisponível
    }

    const activeState = this.pendingPlayState || this.currentState;
    if (activeState && activeState.is_playing && activeState.track_url) {
      this.pendingPlayState = null;
      this.applyPlaybackState(activeState);
    }
  }

  public preloadTrack(url: string): void {
    try {
      const normalized = normalizeTrackUrl(url);
      if (normalized && this.preloadUrl !== normalized) {
        this.preloadUrl = normalized;
        this.preloadAudio.src = normalized;
        this.preloadAudio.load();
      }
    } catch (err) {
      console.warn("[MusicSync] Falha no preload da faixa:", err);
    }
  }

  public retryAudio(): void {
    if (!this.currentState) return;
    this.applyPlaybackState(this.currentState, true);
  }

  // ============================================================================
  // BUSCAS INICIAIS E REALTIME (BROADCAST + POSTGRES CHANGES)
  // ============================================================================

  private async fetchInitialPlaybackState(resyncOnly = false): Promise<void> {
    if (!this.roomId) return;

    try {
      const { data, error } = await this.supabase
        .from("playback_state")
        .select("*")
        .eq("room_id", this.roomId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const incoming = data as PlaybackState;
        if (!resyncOnly || !isStalePlaybackState(this.currentState, incoming)) {
          this.applyPlaybackState(incoming);
        } else if (incoming.is_playing) {
          this.checkAndCorrectDrift();
        }
      } else {
        const defaultState: PlaybackState = {
          room_id: this.roomId,
          track_url: null,
          started_at: null,
          is_playing: false,
          paused_position: 0,
          volume: 1.0,
          loop: false,
        };

        if (this.isMaster) {
          const { data: created, error: createErr } = await this.supabase
            .from("playback_state")
            .upsert(defaultState, { onConflict: "room_id" })
            .select()
            .single();

          if (!createErr && created) {
            this.applyPlaybackState(created as PlaybackState);
            return;
          }
        }
        this.applyPlaybackState(defaultState);
      }
    } catch (err) {
      console.error("[MusicSync] Erro ao buscar estado inicial de reprodução:", err);
    }
  }

  public async fetchTracks(): Promise<Track[]> {
    if (!this.roomId) return [];

    try {
      const { data, error } = await this.supabase
        .from("tracks")
        .select("*")
        .eq("room_id", this.roomId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      this.tracksList = (data || []) as Track[];
      this.notifyTracksSubscribers(this.tracksList);
      return this.tracksList;
    } catch (err) {
      console.error("[MusicSync] Erro ao listar faixas:", err);
      return [];
    }
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.roomId) return;

    const playbackChannelName = `music_playback_${this.roomId}`;
    const tracksChannelName = `music_tracks_${this.roomId}`;

    this.playbackChannel = this.supabase
      .channel(playbackChannelName, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on("broadcast", { event: "ost_sync" }, ({ payload }: { payload: PlaybackState }) => {
        if (payload && typeof payload === "object" && payload.room_id === this.roomId) {
          if (!isStalePlaybackState(this.currentState, payload)) {
            this.applyPlaybackState(payload);
          }
        }
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "playback_state",
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const incoming = payload.new as PlaybackState;
            if (!isStalePlaybackState(this.currentState, incoming)) {
              this.applyPlaybackState(incoming);
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.syncClock(1).catch(console.warn);
        } else if (
          status === "TIMED_OUT" ||
          status === "CLOSED" ||
          status === "CHANNEL_ERROR"
        ) {
          console.warn(
            `[MusicSync] Conexão Realtime de áudio (${status}). Reconectando...`,
          );
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isDestroyed && this.roomId) {
              this.fetchInitialPlaybackState(true).catch(console.warn);
            }
          }, 3000);
        }
      });

    this.tracksChannel = this.supabase
      .channel(tracksChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracks",
          filter: `room_id=eq.${this.roomId}`,
        },
        () => {
          this.fetchTracks().catch(console.warn);
        },
      )
      .subscribe();
  }

  private broadcastPlaybackState(state: PlaybackState): void {
    if (!this.playbackChannel) return;
    this.playbackChannel
      .send({
        type: "broadcast",
        event: "ost_sync",
        payload: state,
      })
      .catch(() => {});
  }

  // ============================================================================
  // FUNÇÕES DO MESTRE (OTIMIZADAS COM RESPOSTA OTIMISTA + BROADCAST INSTANTÂNEO)
  // ============================================================================

  public async playTrack(track: Track): Promise<void> {
    if (!this.roomId) throw new Error("Nenhuma sala conectada.");

    const updatedAt = this.nextMonotonicIsoTimestamp();
    const optimisticState: PlaybackState = {
      id: this.currentState?.id,
      room_id: this.roomId,
      track_url: track.url,
      started_at: updatedAt,
      is_playing: true,
      paused_position: 0,
      volume: this.currentState?.volume ?? 1.0,
      loop: this.currentState?.loop ?? false,
      updated_at: updatedAt,
    };

    // Resposta imediata local + broadcast em <50ms
    this.applyPlaybackState(optimisticState);
    this.broadcastPlaybackState(optimisticState);

    try {
      const { data, error } = await this.supabase
        .from("playback_state")
        .upsert(
          {
            room_id: optimisticState.room_id,
            track_url: optimisticState.track_url,
            started_at: optimisticState.started_at,
            is_playing: optimisticState.is_playing,
            paused_position: optimisticState.paused_position,
            volume: optimisticState.volume,
            loop: optimisticState.loop,
            updated_at: optimisticState.updated_at,
          },
          { onConflict: "room_id" },
        )
        .select()
        .single();

      if (error) throw error;
      if (data && !isStalePlaybackState(this.currentState, data as PlaybackState)) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error("[MusicSync] Erro ao reproduzir faixa:", err);
      throw err;
    }
  }

  public async pause(): Promise<void> {
    if (!this.roomId || !this.currentState || !this.currentState.is_playing) return;

    const currentPos =
      this.activeHowlLoaded && this.activeHowl
        ? this.getCurrentAudioTime()
        : computeSynchronizedPosition({
            state: this.currentState,
            serverNowMs: this.getServerNowMs(),
            durationSeconds: this.activeDuration,
          });

    const updatedAt = this.nextMonotonicIsoTimestamp();
    const optimisticState: PlaybackState = {
      ...this.currentState,
      is_playing: false,
      paused_position: Math.max(0, currentPos),
      updated_at: updatedAt,
    };

    this.applyPlaybackState(optimisticState);
    this.broadcastPlaybackState(optimisticState);

    try {
      const { data, error } = await this.supabase
        .from("playback_state")
        .update({
          is_playing: false,
          paused_position: optimisticState.paused_position,
          updated_at: updatedAt,
        })
        .eq("room_id", this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data && !isStalePlaybackState(this.currentState, data as PlaybackState)) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error("[MusicSync] Erro ao pausar áudio:", err);
      throw err;
    }
  }

  public async resume(): Promise<void> {
    if (
      !this.roomId ||
      !this.currentState ||
      this.currentState.is_playing ||
      !this.currentState.track_url
    ) {
      return;
    }

    const nowServerMs = this.getServerNowMs();
    const pausedPosMs = (this.currentState.paused_position || 0) * 1000;
    const calculatedStartedAt = new Date(nowServerMs - pausedPosMs).toISOString();
    const updatedAt = this.nextMonotonicIsoTimestamp();

    const optimisticState: PlaybackState = {
      ...this.currentState,
      is_playing: true,
      started_at: calculatedStartedAt,
      updated_at: updatedAt,
    };

    this.applyPlaybackState(optimisticState);
    this.broadcastPlaybackState(optimisticState);

    try {
      const { data, error } = await this.supabase
        .from("playback_state")
        .update({
          is_playing: true,
          started_at: calculatedStartedAt,
          updated_at: updatedAt,
        })
        .eq("room_id", this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data && !isStalePlaybackState(this.currentState, data as PlaybackState)) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error("[MusicSync] Erro ao retomar reprodução:", err);
      throw err;
    }
  }

  public async seekTo(seconds: number): Promise<void> {
    if (!this.roomId || !this.currentState || !this.currentState.track_url) return;

    const maxDur = this.activeDuration > 0 ? this.activeDuration : seconds;
    const clampedPos = Math.max(0, Math.min(maxDur, seconds));
    const updatedAt = this.nextMonotonicIsoTimestamp();
    const nowServerMs = this.getServerNowMs();
    const calculatedStartedAt = this.currentState.is_playing
      ? new Date(nowServerMs - clampedPos * 1000).toISOString()
      : this.currentState.started_at;

    const optimisticState: PlaybackState = {
      ...this.currentState,
      paused_position: clampedPos,
      started_at: calculatedStartedAt,
      updated_at: updatedAt,
    };

    this.applyPlaybackState(optimisticState);
    if (this.activeHowlLoaded) {
      this.performHardSeek(clampedPos);
    }
    this.broadcastPlaybackState(optimisticState);

    try {
      const { error } = await this.supabase
        .from("playback_state")
        .update({
          paused_position: clampedPos,
          started_at: calculatedStartedAt,
          updated_at: updatedAt,
        })
        .eq("room_id", this.roomId);

      if (error) throw error;
    } catch (err) {
      console.error("[MusicSync] Erro ao avançar/retroceder faixa:", err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (!this.roomId) return;

    const updatedAt = this.nextMonotonicIsoTimestamp();
    const optimisticState: PlaybackState = {
      room_id: this.roomId,
      track_url: this.currentState?.track_url ?? null,
      is_playing: false,
      paused_position: 0,
      started_at: null,
      volume: this.currentState?.volume ?? 1.0,
      loop: this.currentState?.loop ?? false,
      updated_at: updatedAt,
    };

    this.applyPlaybackState(optimisticState);
    this.broadcastPlaybackState(optimisticState);

    try {
      const { data, error } = await this.supabase
        .from("playback_state")
        .update({
          is_playing: false,
          paused_position: 0,
          started_at: null,
          updated_at: updatedAt,
        })
        .eq("room_id", this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data && !isStalePlaybackState(this.currentState, data as PlaybackState)) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error("[MusicSync] Erro ao parar reprodução:", err);
      throw err;
    }
  }

  /**
   * Ajusta o volume em tempo real localmente e faz debounce da persistência no Supabase
   * para evitar enxurrada de requisições ao arrastar o slider.
   */
  public async setVolume(volume: number): Promise<void> {
    if (!this.roomId) return;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const updatedAt = this.nextMonotonicIsoTimestamp();

    const optimisticState: PlaybackState = {
      ...(this.currentState || {
        room_id: this.roomId,
        track_url: null,
        started_at: null,
        is_playing: false,
        paused_position: 0,
        loop: false,
      }),
      volume: clampedVolume,
      updated_at: updatedAt,
    };

    // Atualiza som e UI instantaneamente sem re-executar play/seek
    this.currentState = optimisticState;
    if (this.activeHowl) {
      this.activeHowl.volume(clampedVolume);
    }
    this.notifyStateSubscribers(optimisticState);

    if (this.volumePersistTimer) {
      clearTimeout(this.volumePersistTimer);
    }

    const targetRoomId = this.roomId;
    this.volumePersistTimer = window.setTimeout(async () => {
      this.volumePersistTimer = null;
      this.broadcastPlaybackState(optimisticState);
      try {
        const { error } = await this.supabase
          .from("playback_state")
          .update({
            volume: clampedVolume,
            updated_at: updatedAt,
          })
          .eq("room_id", targetRoomId);

        if (error) {
          console.warn("[MusicSync] Erro ao salvar volume no Supabase:", error.message);
        }
      } catch (err) {
        console.warn("[MusicSync] Exceção ao salvar volume:", err);
      }
    }, VOLUME_PERSIST_DEBOUNCE_MS);
  }

  public async setLoop(loop: boolean): Promise<void> {
    if (!this.roomId) return;

    const updatedAt = this.nextMonotonicIsoTimestamp();
    const optimisticState: PlaybackState = {
      ...(this.currentState || {
        room_id: this.roomId,
        track_url: null,
        started_at: null,
        is_playing: false,
        paused_position: 0,
        volume: 1.0,
      }),
      loop,
      updated_at: updatedAt,
    };

    this.currentState = optimisticState;
    if (this.activeHowl) {
      this.activeHowl.loop(loop);
    }
    this.notifyStateSubscribers(optimisticState);
    this.broadcastPlaybackState(optimisticState);

    try {
      const { error } = await this.supabase
        .from("playback_state")
        .update({
          loop,
          updated_at: updatedAt,
        })
        .eq("room_id", this.roomId);

      if (error) throw error;
    } catch (err) {
      console.error("[MusicSync] Erro ao alternar loop:", err);
      throw err;
    }
  }

  public async uploadTrack(file: File, customName?: string): Promise<Track> {
    if (!this.roomId) throw new Error("Nenhuma sala conectada para envio de faixas.");

    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniquePath = `${this.roomId}/${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await this.supabase.storage
        .from("audio-tracks")
        .upload(uniquePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "audio/mpeg",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = this.supabase.storage
        .from("audio-tracks")
        .getPublicUrl(uniquePath);

      const trackUrl = publicUrlData.publicUrl;
      const trackName = customName?.trim() || file.name.replace(/\.[^/.]+$/, "");

      const { data: trackData, error: dbError } = await this.supabase
        .from("tracks")
        .insert({
          room_id: this.roomId,
          name: trackName,
          url: trackUrl,
          source: "upload",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await this.fetchTracks();
      return trackData as Track;
    } catch (err) {
      console.error("[MusicSync] Erro no upload da faixa:", err);
      throw err;
    }
  }

  public async addLink(name: string, url: string): Promise<Track> {
    if (!this.roomId) throw new Error("Nenhuma sala conectada.");

    try {
      const cleanUrl = url.trim();
      const cleanName = name.trim() || "Trilha Sem Nome";

      const { data, error } = await this.supabase
        .from("tracks")
        .insert({
          room_id: this.roomId,
          name: cleanName,
          url: cleanUrl,
          source: "link",
        })
        .select()
        .single();

      if (error) throw error;

      await this.fetchTracks();
      return data as Track;
    } catch (err) {
      console.error("[MusicSync] Erro ao adicionar link de áudio:", err);
      throw err;
    }
  }

  public async renameTrack(trackId: string, newName: string): Promise<void> {
    try {
      const cleanName = newName.trim();
      if (!cleanName) return;

      const { error } = await this.supabase
        .from("tracks")
        .update({ name: cleanName })
        .eq("id", trackId);

      if (error) throw error;
      await this.fetchTracks();
    } catch (err) {
      console.error("[MusicSync] Erro ao renomear faixa:", err);
      throw err;
    }
  }

  public async removeTrack(track: Track): Promise<void> {
    try {
      if (track.source === "upload" && track.url.includes("/audio-tracks/")) {
        try {
          const parts = track.url.split("/audio-tracks/");
          if (parts[1]) {
            const storagePath = decodeURIComponent(parts[1]);
            await this.supabase.storage.from("audio-tracks").remove([storagePath]);
          }
        } catch (storageErr) {
          console.warn("[MusicSync] Aviso ao excluir arquivo do Storage:", storageErr);
        }
      }

      const { error } = await this.supabase
        .from("tracks")
        .delete()
        .eq("id", track.id);

      if (error) throw error;

      if (
        normalizeTrackUrl(this.currentState?.track_url) ===
        normalizeTrackUrl(track.url)
      ) {
        await this.stop();
      }

      await this.fetchTracks();
    } catch (err) {
      console.error("[MusicSync] Erro ao excluir faixa:", err);
      throw err;
    }
  }

  // ============================================================================
  // INSCRIÇÕES, STATUS E GETTERS
  // ============================================================================

  private updateStatus(status: OstHealthStatus, error: string | null, duration: number): void {
    const next: OstStatusSnapshot = {
      status,
      error,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    };
    if (
      this.statusSnapshot.status === next.status &&
      this.statusSnapshot.error === next.error &&
      Math.abs(this.statusSnapshot.duration - next.duration) < 0.05
    ) {
      return;
    }
    this.statusSnapshot = next;
    this.statusSubscribers.forEach((cb) => {
      try {
        cb(next);
      } catch (err) {
        console.error("[MusicSync] Erro no callback de status:", err);
      }
    });
  }

  public onStateChange(callback: PlaybackStateCallback): () => void {
    this.stateSubscribers.add(callback);
    callback(this.currentState);
    return () => this.stateSubscribers.delete(callback);
  }

  public onTracksChange(callback: TracksCallback): () => void {
    this.tracksSubscribers.add(callback);
    callback(this.tracksList);
    return () => this.tracksSubscribers.delete(callback);
  }

  public onStatusChange(callback: OstStatusCallback): () => void {
    this.statusSubscribers.add(callback);
    callback(this.statusSnapshot);
    return () => this.statusSubscribers.delete(callback);
  }

  private notifyStateSubscribers(state: PlaybackState | null): void {
    this.stateSubscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error("[MusicSync] Erro no callback de estado:", err);
      }
    });
  }

  private notifyTracksSubscribers(tracks: Track[]): void {
    this.tracksSubscribers.forEach((cb) => {
      try {
        cb(tracks);
      } catch (err) {
        console.error("[MusicSync] Erro no callback de faixas:", err);
      }
    });
  }

  public getCurrentState(): PlaybackState | null {
    return this.currentState;
  }

  public getTracks(): Track[] {
    return this.tracksList;
  }

  public getAudioStatus(): OstStatusSnapshot {
    return this.statusSnapshot;
  }

  public getCurrentAudioTime(): number {
    if (!this.activeHowl) return this.currentState?.paused_position || 0;
    try {
      const pos = this.activeHowl.seek();
      return typeof pos === "number" && Number.isFinite(pos)
        ? pos
        : this.currentState?.paused_position || 0;
    } catch {
      return this.currentState?.paused_position || 0;
    }
  }

  public getAudioDuration(): number {
    if (this.activeDuration > 0) return this.activeDuration;
    if (!this.activeHowl) return 0;
    try {
      const dur = this.activeHowl.duration();
      return Number.isFinite(dur) ? dur : 0;
    } catch {
      return 0;
    }
  }
}
