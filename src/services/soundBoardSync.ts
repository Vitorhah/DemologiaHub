import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { Howl, Howler } from "howler";
import {
  ActiveVolumeFade,
  createVolumeFade,
  evaluateVolumeFade,
  normalizeTrackUrl,
} from "./ostUtils";
import {
  DEFAULT_SFX_AUTO_FADE_SECONDS,
  MAX_CONCURRENT_SFX,
  SOUND_BOARD_LOCAL_STORAGE_PREFIX,
  SOUND_BOARD_MASTER_VOLUME_STORAGE_KEY,
  SoundBoardBroadcastPlayPayload,
  SoundBoardBroadcastStopPayload,
  SoundBoardBroadcastVolumePayload,
  SoundBoardEffect,
  SoundBoardIconId,
  SoundBoardSnapshot,
  clampSfxVolume,
  computeAutoFadeOutPlan,
  computeEffectiveSfxVolume,
  getSoundBoardRecordId,
  isSoundBoardPlayPayloadValid,
  normalizeSoundBoardEffects,
  normalizeSoundBoardIcon,
  resolveConcurrentSfxActivation,
  validateSoundBoardLink,
} from "../utils/soundBoard";

export type SoundBoardSnapshotCallback = (snapshot: SoundBoardSnapshot) => void;

export type SfxBroadcastSender = (
  event: "sfx_play" | "sfx_stop" | "sfx_stop_all" | "sfx_master_volume",
  payload: Record<string, unknown>,
) => void;

interface ActiveSfxInstance {
  effectId: string;
  url: string;
  effectVolume: number;
  howl: Howl;
  startedAtMs: number;
  durationSeconds: number;
  fadeStartTimer: number | null;
  fadeRafId: number | null;
  fadeFallbackTimer: number | null;
  activeFade: ActiveVolumeFade | null;
  isFadingOut: boolean;
  fadeScheduled: boolean;
}

/**
 * Motor independente de Sound Boards (efeitos sonoros one-shot).
 * Opera em camada sonora completamente separada das OSTs do MusicSync:
 * - Nunca interrompe, pausa ou altera o volume da trilha musical ativa.
 * - Reproduz cada efeito uma única vez (sem loop) com fade-out suave automático ao final.
 * - Permite múltiplos efeitos simultâneos respeitando limite de concorrência (MAX_CONCURRENT_SFX).
 * - Reinicia do início se o mesmo efeito for acionado novamente, sem duplicar instâncias.
 * - Reutiliza o bucket "audio-tracks" e o canal Realtime existente do MusicSync para broadcast aos jogadores.
 */
export class SoundBoardSync {
  private supabase: SupabaseClient;
  private sendBroadcast: SfxBroadcastSender;

  private roomId: string | null = null;
  private isMaster: boolean = false;
  private isDestroyed: boolean = false;

  private effects: SoundBoardEffect[] = [];
  private masterVolume: number = 1.0;
  private lastError: string | null = null;

  private activeInstances: Map<string, ActiveSfxInstance> = new Map();
  private activeOrder: string[] = [];

  private libraryChannel: RealtimeChannel | null = null;
  private subscribers: Set<SoundBoardSnapshotCallback> = new Set();
  private localMutationTs: number = 0;

  constructor(supabaseClient: SupabaseClient, sendBroadcast: SfxBroadcastSender) {
    this.supabase = supabaseClient;
    this.sendBroadcast = sendBroadcast;

    try {
      const savedVol = localStorage.getItem(SOUND_BOARD_MASTER_VOLUME_STORAGE_KEY);
      if (savedVol !== null) {
        this.masterVolume = clampSfxVolume(savedVol, 1);
      }
    } catch {
      this.masterVolume = 1.0;
    }
  }

  // ============================================================================
  // CICLO DE VIDA DA SALA (SEPARADO DO ESTADO DAS OSTS)
  // ============================================================================

  public async joinRoom(roomId: string, isMaster: boolean): Promise<void> {
    if (this.roomId === roomId && !this.isDestroyed) {
      this.isMaster = isMaster;
      if (isMaster && this.effects.length === 0) {
        await this.fetchEffects();
      }
      return;
    }

    if (this.roomId) {
      await this.leaveRoom();
    }

    this.roomId = roomId;
    this.isMaster = isMaster;
    this.isDestroyed = false;

    this.loadLocalCache(roomId);
    this.emitSnapshot();

    if (isMaster) {
      await this.fetchEffects();
      this.setupLibrarySubscription(roomId);
    }
  }

  public async leaveRoom(): Promise<void> {
    this.stopAllLocal();

    if (this.libraryChannel) {
      try {
        await this.supabase.removeChannel(this.libraryChannel);
      } catch {
        // Ignora erro ao remover canal
      }
      this.libraryChannel = null;
    }

    this.roomId = null;
    this.effects = [];
    this.lastError = null;
    this.emitSnapshot();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stopAllLocal();
    this.leaveRoom().catch(() => {});
    this.subscribers.clear();
  }

  public unlockAudio(): void {
    try {
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignora indisponibilidade de WebAudio
    }
  }

  // ============================================================================
  // PERSISTÊNCIA DA BIBLIOTECA DE SOUND BOARDS (SUPABASE + CACHE LOCAL)
  // ============================================================================

  private getLocalStorageKey(roomId: string): string {
    return `${SOUND_BOARD_LOCAL_STORAGE_PREFIX}${roomId || "default-table"}`;
  }

  private loadLocalCache(roomId: string): void {
    try {
      const raw = localStorage.getItem(this.getLocalStorageKey(roomId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.effects)) {
        this.effects = normalizeSoundBoardEffects(parsed.effects, roomId);
      }
      if (parsed?.masterVolume !== undefined) {
        this.masterVolume = clampSfxVolume(parsed.masterVolume, this.masterVolume);
      }
    } catch {
      // Ignora cache corrompido
    }
  }

  private saveLocalCache(): void {
    if (!this.roomId) return;
    try {
      localStorage.setItem(
        this.getLocalStorageKey(this.roomId),
        JSON.stringify({
          effects: this.effects,
          masterVolume: this.masterVolume,
          updatedAt: Date.now(),
        }),
      );
      localStorage.setItem(
        SOUND_BOARD_MASTER_VOLUME_STORAGE_KEY,
        String(this.masterVolume),
      );
    } catch {
      // Ignora restrição de storage
    }
  }

  public async fetchEffects(): Promise<SoundBoardEffect[]> {
    if (!this.roomId) return [];
    const recordId = getSoundBoardRecordId(this.roomId);

    try {
      const { data, error } = await this.supabase
        .from("players")
        .select("data")
        .eq("id", recordId)
        .maybeSingle();

      if (error) throw error;

      if (data?.data && typeof data.data === "object") {
        const remoteUpdatedAt = Number((data.data as any).updatedAt) || 0;
        if (remoteUpdatedAt === 0 || remoteUpdatedAt >= this.localMutationTs) {
          this.effects = normalizeSoundBoardEffects(
            (data.data as any).effects,
            this.roomId,
          );
          if ((data.data as any).masterVolume !== undefined) {
            this.masterVolume = clampSfxVolume(
              (data.data as any).masterVolume,
              this.masterVolume,
            );
          }
          this.saveLocalCache();
          this.emitSnapshot();
        }
      }
      return this.effects;
    } catch (err) {
      console.warn("[SoundBoardSync] Erro ao buscar efeitos sonoros:", err);
      return this.effects;
    }
  }

  private setupLibrarySubscription(roomId: string): void {
    const recordId = getSoundBoardRecordId(roomId);
    if (this.libraryChannel) {
      this.supabase.removeChannel(this.libraryChannel).catch(() => {});
      this.libraryChannel = null;
    }

    this.libraryChannel = this.supabase
      .channel(`soundboard_library_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `id=eq.${recordId}`,
        },
        (payload) => {
          const rawData = (payload.new as any)?.data;
          if (!rawData || typeof rawData !== "object" || !this.roomId) return;
          const remoteUpdatedAt = Number(rawData.updatedAt) || 0;
          if (remoteUpdatedAt > 0 && remoteUpdatedAt < this.localMutationTs) {
            return;
          }
          this.effects = normalizeSoundBoardEffects(rawData.effects, this.roomId);
          this.saveLocalCache();
          this.emitSnapshot();
        },
      )
      .subscribe();
  }

  private async persistLibrary(): Promise<void> {
    if (!this.roomId) return;
    const now = Date.now();
    this.localMutationTs = now;
    this.saveLocalCache();

    const recordId = getSoundBoardRecordId(this.roomId);
    try {
      const { error } = await this.supabase.from("players").upsert({
        id: recordId,
        data: {
          room_id: this.roomId,
          effects: this.effects,
          masterVolume: this.masterVolume,
          updatedAt: now,
        },
        updated_at: new Date(now).toISOString(),
      });
      if (error) {
        console.warn("[SoundBoardSync] Aviso ao persistir Sound Boards:", error.message);
      }
    } catch (err) {
      console.warn("[SoundBoardSync] Falha ao sincronizar biblioteca Sound Boards:", err);
    }
  }

  // ============================================================================
  // GERENCIAMENTO (CRUD EXCLUSIVO DO MESTRE, REUTILIZANDO STORAGE DE TRILHAS)
  // ============================================================================

  public async uploadEffect(
    file: File,
    customName?: string,
    icon: SoundBoardIconId = "volume",
  ): Promise<SoundBoardEffect> {
    if (!this.roomId) {
      throw new Error("Nenhuma sala conectada para envio de efeitos sonoros.");
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePath = `${this.roomId}/soundboards/${Date.now()}_${cleanFileName}`;

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

    const effect: SoundBoardEffect = {
      id: `sfx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      room_id: this.roomId,
      name: customName?.trim() || file.name.replace(/\.[^/.]+$/, "") || "Efeito Sonoro",
      url: publicUrlData.publicUrl,
      source: "upload",
      volume: 1.0,
      icon: normalizeSoundBoardIcon(icon),
      created_at: new Date().toISOString(),
    };

    this.effects = [effect, ...this.effects];
    this.lastError = null;
    this.emitSnapshot();
    await this.persistLibrary();
    return effect;
  }

  public async addLinkEffect(
    name: string,
    url: string,
    icon: SoundBoardIconId = "volume",
  ): Promise<SoundBoardEffect> {
    if (!this.roomId) {
      throw new Error("Nenhuma sala conectada.");
    }

    const validation = validateSoundBoardLink(name, url);
    if ("error" in validation) {
      throw new Error(validation.error);
    }

    const effect: SoundBoardEffect = {
      id: `sfx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      room_id: this.roomId,
      name: validation.name,
      url: validation.url,
      source: "link",
      volume: 1.0,
      icon: normalizeSoundBoardIcon(icon),
      created_at: new Date().toISOString(),
    };

    this.effects = [effect, ...this.effects];
    this.lastError = null;
    this.emitSnapshot();
    await this.persistLibrary();
    return effect;
  }

  public async updateEffectMeta(
    effectId: string,
    updates: { name?: string; icon?: SoundBoardIconId },
  ): Promise<void> {
    const cleanName = updates.name !== undefined ? updates.name.trim() : undefined;
    if (updates.name !== undefined && !cleanName) return;

    let changed = false;
    this.effects = this.effects.map((item) => {
      if (item.id !== effectId) return item;
      changed = true;
      return {
        ...item,
        ...(cleanName ? { name: cleanName } : {}),
        ...(updates.icon ? { icon: normalizeSoundBoardIcon(updates.icon) } : {}),
      };
    });

    if (!changed) return;
    this.emitSnapshot();
    await this.persistLibrary();
  }

  public async setEffectVolume(effectId: string, volume: number): Promise<void> {
    const clamped = clampSfxVolume(volume, 1);
    let changed = false;
    this.effects = this.effects.map((item) => {
      if (item.id !== effectId) return item;
      changed = true;
      return { ...item, volume: clamped };
    });

    if (!changed) return;

    const active = this.activeInstances.get(effectId);
    if (active) {
      active.effectVolume = clamped;
      if (!active.isFadingOut) {
        active.howl.volume(computeEffectiveSfxVolume(clamped, this.masterVolume));
      }
    }

    this.emitSnapshot();
    await this.persistLibrary();
  }

  public async removeEffect(effect: SoundBoardEffect): Promise<void> {
    this.stopEffect(effect.id);

    if (effect.source === "upload" && effect.url.includes("/audio-tracks/")) {
      try {
        const parts = effect.url.split("/audio-tracks/");
        if (parts[1]) {
          const storagePath = decodeURIComponent(parts[1]);
          await this.supabase.storage.from("audio-tracks").remove([storagePath]);
        }
      } catch (storageErr) {
        console.warn("[SoundBoardSync] Aviso ao remover arquivo do Storage:", storageErr);
      }
    }

    this.effects = this.effects.filter((item) => item.id !== effect.id);
    this.emitSnapshot();
    await this.persistLibrary();
  }

  // ============================================================================
  // CONTROLE DE VOLUME GERAL DOS SOUND BOARDS (INDEPENDENTE DAS OSTS)
  // ============================================================================

  public setMasterVolume(volume: number): void {
    const clamped = clampSfxVolume(volume, 1);
    this.masterVolume = clamped;

    this.activeInstances.forEach((instance) => {
      if (!instance.isFadingOut) {
        instance.howl.volume(
          computeEffectiveSfxVolume(instance.effectVolume, clamped),
        );
      }
    });

    this.saveLocalCache();
    this.emitSnapshot();

    if (this.isMaster && this.roomId) {
      this.sendBroadcast("sfx_master_volume", {
        room_id: this.roomId,
        master_volume: clamped,
      });
      this.persistLibrary().catch(() => {});
    }
  }

  // ============================================================================
  // REPRODUÇÃO ONE-SHOT + FADE-OUT AUTOMÁTICO + CONCORRÊNCIA + BROADCAST
  // ============================================================================

  public playEffect(effect: SoundBoardEffect): void {
    if (!this.isMaster || !this.roomId) return;

    this.unlockAudio();
    this.lastError = null;

    const payload: SoundBoardBroadcastPlayPayload = {
      room_id: this.roomId,
      effect_id: effect.id,
      url: effect.url,
      volume: clampSfxVolume(effect.volume, 1),
      master_volume: this.masterVolume,
      triggered_at: new Date().toISOString(),
      token: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };

    this.startOrRestartLocalInstance(
      effect.id,
      effect.url,
      payload.volume,
      payload.master_volume,
    );

    this.sendBroadcast("sfx_play", payload as unknown as Record<string, unknown>);
  }

  public stopEffect(effectId: string): void {
    const existed = this.activeInstances.has(effectId);
    this.disposeInstance(effectId);

    if (existed && this.isMaster && this.roomId) {
      const payload: SoundBoardBroadcastStopPayload = {
        room_id: this.roomId,
        effect_id: effectId,
      };
      this.sendBroadcast("sfx_stop", payload as unknown as Record<string, unknown>);
    }
  }

  public stopAll(): void {
    this.stopAllLocal();

    if (this.isMaster && this.roomId) {
      const payload: SoundBoardBroadcastStopPayload = {
        room_id: this.roomId,
      };
      this.sendBroadcast(
        "sfx_stop_all",
        payload as unknown as Record<string, unknown>,
      );
    }
  }

  /**
   * Recebe eventos de broadcast enviados pelo Mestre via canal do MusicSync.
   * Nunca modifica a OST em reprodução.
   */
  public handleRemoteBroadcast(
    event: "sfx_play" | "sfx_stop" | "sfx_stop_all" | "sfx_master_volume",
    payload: unknown,
  ): void {
    if (this.isDestroyed || !this.roomId) return;

    if (event === "sfx_play") {
      if (!isSoundBoardPlayPayloadValid(payload, this.roomId)) return;
      this.masterVolume = clampSfxVolume(payload.master_volume, this.masterVolume);
      this.startOrRestartLocalInstance(
        payload.effect_id,
        payload.url,
        clampSfxVolume(payload.volume, 1),
        this.masterVolume,
      );
      return;
    }

    if (event === "sfx_stop") {
      const p = payload as SoundBoardBroadcastStopPayload | null;
      if (!p || p.room_id !== this.roomId || !p.effect_id) return;
      this.disposeInstance(p.effect_id);
      return;
    }

    if (event === "sfx_stop_all") {
      const p = payload as SoundBoardBroadcastStopPayload | null;
      if (!p || p.room_id !== this.roomId) return;
      this.stopAllLocal();
      return;
    }

    if (event === "sfx_master_volume") {
      const p = payload as SoundBoardBroadcastVolumePayload | null;
      if (!p || p.room_id !== this.roomId) return;
      const clamped = clampSfxVolume(p.master_volume, this.masterVolume);
      this.masterVolume = clamped;
      this.activeInstances.forEach((instance) => {
        if (!instance.isFadingOut) {
          instance.howl.volume(
            computeEffectiveSfxVolume(instance.effectVolume, clamped),
          );
        }
      });
      this.emitSnapshot();
    }
  }

  private getClockNow(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  private clearInstanceTimers(instance: ActiveSfxInstance): void {
    if (instance.fadeStartTimer !== null) {
      clearTimeout(instance.fadeStartTimer);
      instance.fadeStartTimer = null;
    }
    if (
      instance.fadeRafId !== null &&
      typeof cancelAnimationFrame !== "undefined"
    ) {
      cancelAnimationFrame(instance.fadeRafId);
      instance.fadeRafId = null;
    }
    if (instance.fadeFallbackTimer !== null) {
      clearTimeout(instance.fadeFallbackTimer);
      instance.fadeFallbackTimer = null;
    }
    instance.activeFade = null;
    instance.isFadingOut = false;
    instance.fadeScheduled = false;
  }

  private disposeInstance(effectId: string, emit = true): void {
    const instance = this.activeInstances.get(effectId);
    if (!instance) return;

    this.clearInstanceTimers(instance);
    this.activeInstances.delete(effectId);
    this.activeOrder = this.activeOrder.filter((id) => id !== effectId);

    try {
      instance.howl.stop();
      instance.howl.unload();
    } catch {
      // Ignora erro de unload transitório
    }

    if (emit) {
      this.emitSnapshot();
    }
  }

  private stopAllLocal(): void {
    const ids = Array.from(this.activeInstances.keys());
    for (const id of ids) {
      this.disposeInstance(id, false);
    }
    this.activeOrder = [];
    this.emitSnapshot();
  }

  private scheduleAutoFadeOut(instance: ActiveSfxInstance, durationSec: number): void {
    if (
      this.isDestroyed ||
      this.activeInstances.get(instance.effectId) !== instance ||
      instance.fadeScheduled
    ) {
      return;
    }

    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    instance.durationSeconds = durationSec;

    const plan = computeAutoFadeOutPlan(
      durationSec,
      DEFAULT_SFX_AUTO_FADE_SECONDS,
    );
    if (!plan.shouldFade) return;

    instance.fadeScheduled = true;

    instance.fadeStartTimer = window.setTimeout(() => {
      instance.fadeStartTimer = null;
      if (
        this.isDestroyed ||
        this.activeInstances.get(instance.effectId) !== instance
      ) {
        return;
      }

      const startVol = computeEffectiveSfxVolume(
        instance.effectVolume,
        this.masterVolume,
      );
      const nowMs = this.getClockNow();
      const fadeDurationSec = (plan.fadeDurationMs / 1000) as any;

      instance.isFadingOut = true;
      instance.activeFade = {
        ...createVolumeFade({
          direction: "out",
          currentVolume: startVol,
          targetVolume: 0,
          durationSeconds: fadeDurationSec,
          nowMs,
          finishAction: "none",
        }),
        durationMs: plan.fadeDurationMs,
      };
      this.emitSnapshot();

      const step = () => {
        if (
          this.isDestroyed ||
          this.activeInstances.get(instance.effectId) !== instance ||
          !instance.activeFade
        ) {
          return;
        }
        const { volume, completed } = evaluateVolumeFade(
          instance.activeFade,
          this.getClockNow(),
        );
        try {
          instance.howl.volume(volume);
        } catch {
          // Ignora falha se instância foi encerrada
        }
        if (completed) {
          instance.fadeRafId = null;
          return;
        }
        if (typeof requestAnimationFrame !== "undefined") {
          instance.fadeRafId = requestAnimationFrame(step);
        }
      };

      if (typeof requestAnimationFrame !== "undefined") {
        instance.fadeRafId = requestAnimationFrame(step);
      }

      instance.fadeFallbackTimer = window.setTimeout(() => {
        if (
          !this.isDestroyed &&
          this.activeInstances.get(instance.effectId) === instance
        ) {
          try {
            instance.howl.volume(0);
          } catch {}
        }
      }, plan.fadeDurationMs + 40);
    }, plan.delayMs);
  }

  private startOrRestartLocalInstance(
    effectId: string,
    rawUrl: string,
    effectVolume: number,
    masterVolume: number,
  ): void {
    const normalizedUrl = rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")
      ? rawUrl
      : normalizeTrackUrl(rawUrl);

    const decision = resolveConcurrentSfxActivation(
      this.activeOrder,
      effectId,
      MAX_CONCURRENT_SFX,
    );

    // Libera os efeitos mais antigos caso o limite de concorrência tenha sido atingido
    for (const evictedId of decision.evictedIds) {
      this.disposeInstance(evictedId, false);
    }

    const effectiveVol = computeEffectiveSfxVolume(effectVolume, masterVolume);
    const existing = this.activeInstances.get(effectId);

    // Se o mesmo efeito já estiver carregado e tocando com a mesma URL, reinicia do início sem duplicar instância
    if (
      decision.action === "restart" &&
      existing &&
      existing.url === normalizedUrl &&
      existing.howl.state() === "loaded"
    ) {
      this.clearInstanceTimers(existing);
      existing.effectVolume = effectVolume;
      existing.startedAtMs = Date.now();
      this.activeOrder = decision.nextOrder;

      try {
        existing.howl.stop();
        existing.howl.volume(effectiveVol);
        existing.howl.seek(0);
        existing.howl.play();
        const dur = existing.durationSeconds || existing.howl.duration() || 0;
        if (dur > 0) {
          this.scheduleAutoFadeOut(existing, dur);
        }
        this.emitSnapshot();
        return;
      } catch {
        this.disposeInstance(effectId, false);
      }
    }

    if (existing) {
      this.disposeInstance(effectId, false);
    }

    this.activeOrder = decision.nextOrder;

    const instance: ActiveSfxInstance = {
      effectId,
      url: normalizedUrl,
      effectVolume,
      howl: null as unknown as Howl,
      startedAtMs: Date.now(),
      durationSeconds: 0,
      fadeStartTimer: null,
      fadeRafId: null,
      fadeFallbackTimer: null,
      activeFade: null,
      isFadingOut: false,
      fadeScheduled: false,
    };

    const howl = new Howl({
      src: [normalizedUrl],
      html5: true,
      preload: true,
      loop: false,
      volume: effectiveVol,
      onload: () => {
        if (this.activeInstances.get(effectId) !== instance || this.isDestroyed) {
          return;
        }
        const dur = howl.duration();
        if (Number.isFinite(dur) && dur > 0) {
          this.scheduleAutoFadeOut(instance, dur);
        }
      },
      onplay: () => {
        if (this.activeInstances.get(effectId) !== instance || this.isDestroyed) {
          return;
        }
        const dur = howl.duration();
        if (Number.isFinite(dur) && dur > 0) {
          this.scheduleAutoFadeOut(instance, dur);
        }
      },
      onend: () => {
        if (this.activeInstances.get(effectId) !== instance) return;
        this.disposeInstance(effectId, true);
      },
      onloaderror: (_id, err) => {
        if (this.activeInstances.get(effectId) !== instance) return;
        console.warn("[SoundBoardSync] Erro ao carregar efeito sonoro:", err);
        this.lastError =
          "Não foi possível carregar este efeito sonoro (URL expirada ou formato inválido).";
        this.disposeInstance(effectId, true);
      },
      onplayerror: (_id, err) => {
        if (this.activeInstances.get(effectId) !== instance) return;
        console.warn("[SoundBoardSync] Erro ao reproduzir efeito sonoro:", err);
        this.lastError = "Falha ao reproduzir o efeito sonoro neste navegador.";
        this.disposeInstance(effectId, true);
      },
    });

    instance.howl = howl;
    this.activeInstances.set(effectId, instance);
    this.emitSnapshot();

    try {
      howl.play();
    } catch {
      this.disposeInstance(effectId, true);
    }
  }

  public clearError(): void {
    if (!this.lastError) return;
    this.lastError = null;
    this.emitSnapshot();
  }

  // ============================================================================
  // ASSINATURA DE ESTADO E SNAPSHOTS
  // ============================================================================

  public getSnapshot(): SoundBoardSnapshot {
    const activeIds: string[] = [];
    const fadingOutIds: string[] = [];

    this.activeInstances.forEach((inst, id) => {
      activeIds.push(id);
      if (inst.isFadingOut) {
        fadingOutIds.push(id);
      }
    });

    return {
      effects: this.effects,
      masterVolume: this.masterVolume,
      activeIds,
      fadingOutIds,
      maxConcurrent: MAX_CONCURRENT_SFX,
      lastError: this.lastError,
    };
  }

  public onSnapshotChange(callback: SoundBoardSnapshotCallback): () => void {
    this.subscribers.add(callback);
    callback(this.getSnapshot());
    return () => this.subscribers.delete(callback);
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error("[SoundBoardSync] Erro no callback de snapshot:", err);
      }
    });
  }
}
