import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

/**
 * Interface que representa o estado de reprodução sincronizado de uma sala.
 */
export interface PlaybackState {
  id?: string;
  room_id: string;
  track_url: string | null;
  started_at: string | null;
  is_playing: boolean;
  paused_position: number;
  volume: number;
  loop: boolean;
  updated_at?: string;
}

/**
 * Interface que representa uma faixa na biblioteca da mesa.
 */
export interface Track {
  id: string;
  room_id: string;
  name: string;
  url: string;
  source: 'upload' | 'link';
  created_at?: string;
}

export type PlaybackStateCallback = (state: PlaybackState | null) => void;
export type TracksCallback = (tracks: Track[]) => void;

/**
 * Sistema em TypeScript para sincronização de trilha sonora (OST) em mesas de RPG.
 * Utiliza exclusivamente Supabase (PostgreSQL + Realtime + Storage) e a API nativa
 * de áudio do navegador (HTMLAudioElement), sem bibliotecas externas.
 */
export class MusicSync {
  private supabase: SupabaseClient;
  private audio: HTMLAudioElement;
  private preloadAudio: HTMLAudioElement;
  private roomId: string | null = null;
  private isMaster: boolean = false;

  private playbackChannel: RealtimeChannel | null = null;
  private tracksChannel: RealtimeChannel | null = null;

  private clockOffset: number = 0; // Diferença em ms: serverTime - clientMidpoint
  private clockSyncInterval: number | null = null;
  private driftCheckInterval: number | null = null;

  private currentState: PlaybackState | null = null;
  private tracksList: Track[] = [];

  private stateSubscribers: Set<PlaybackStateCallback> = new Set();
  private tracksSubscribers: Set<TracksCallback> = new Set();

  private pendingPlayState: PlaybackState | null = null;
  private unlockListenersAttached: boolean = false;
  private interactionHandler: (() => void) | null = null;

  private isDestroyed: boolean = false;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;

    // Inicialização do elemento de áudio principal
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Elemento auxiliar para pré-carregamento suave
    this.preloadAudio = new Audio();
    this.preloadAudio.preload = 'auto';
    this.preloadAudio.volume = 0;

    // Se a faixa chegar ao final e não for loop, atualiza o estado local
    this.audio.addEventListener('ended', () => {
      if (this.currentState && !this.currentState.loop) {
        if (this.isMaster) {
          this.stop().catch(console.error);
        }
      }
    });

    // Tratamento de erro nativo do elemento de áudio
    this.audio.addEventListener('error', (e) => {
      console.warn('[MusicSync] Erro no elemento de áudio:', e);
    });
  }

  // ============================================================================
  // GERENCIAMENTO DA SALA (LIFECYCLE)
  // ============================================================================

  /**
   * Conecta o cliente à sala informada, sincroniza o relógio com o servidor,
   * carrega o estado de reprodução atual e inscreve nos canais Realtime.
   */
  public async joinRoom(roomId: string, isMaster: boolean = false): Promise<void> {
    if (this.roomId === roomId && !this.isDestroyed) {
      this.isMaster = isMaster;
      return;
    }

    // Se já estiver em outra sala, encerra antes de entrar na nova
    if (this.roomId) {
      await this.leaveRoom();
    }

    this.roomId = roomId;
    this.isMaster = isMaster;
    this.isDestroyed = false;

    try {
      // 1. Sincronização inicial de relógio com o PostgreSQL
      await this.syncClock();

      // Inicia intervalo periódico de sincronia de relógio (a cada 60 segundos)
      if (this.clockSyncInterval) clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = window.setInterval(() => {
        this.syncClock().catch((err) => console.warn('[MusicSync] Erro na calibração periódica do relógio:', err));
      }, 60000);

      // Inicia verificação periódica de desvio (drift) a cada 800ms
      if (this.driftCheckInterval) clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = window.setInterval(() => {
        this.checkAndCorrectDrift();
      }, 800);

      // 2. Busca estado de reprodução inicial da sala
      await this.fetchInitialPlaybackState();

      // 3. Busca lista inicial de faixas
      await this.fetchTracks();

      // 4. Inscreve nos canais Realtime do Supabase
      this.setupRealtimeSubscriptions();
    } catch (error) {
      console.error(`[MusicSync] Falha ao conectar na sala ${roomId}:`, error);
    }
  }

  /**
   * Sai da sala atual, silencia o áudio e encerra as assinaturas Realtime.
   */
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
      console.warn('[MusicSync] Erro ao remover canais:', err);
    }

    this.audio.pause();
    this.audio.src = '';
    this.preloadAudio.src = '';
    this.currentState = null;
    this.tracksList = [];
    this.notifyStateSubscribers(null);
    this.notifyTracksSubscribers([]);
  }

  /**
   * Destrói a instância de MusicSync liberando todos os recursos de áudio e conexões.
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.leaveRoom().catch(console.error);
    this.stateSubscribers.clear();
    this.tracksSubscribers.clear();
  }

  // ============================================================================
  // SINCRONIZAÇÃO DE RELÓGIO (NTP-LITE VIA server_now)
  // ============================================================================

  /**
   * Calcula o deslocamento temporal entre o cliente e o servidor Supabase.
   * Utiliza a média do tempo de ida e volta (RTT) para máxima precisão.
   */
  public async syncClock(): Promise<void> {
    try {
      const tRequest = Date.now();
      const { data, error } = await this.supabase.rpc('server_now');
      const tResponse = Date.now();

      if (error) {
        throw error;
      }

      if (data) {
        const serverTimestamp = new Date(data).getTime();
        const midpoint = (tRequest + tResponse) / 2;
        this.clockOffset = serverTimestamp - midpoint;
      }
    } catch (err) {
      console.warn('[MusicSync] RPC server_now indisponível ou falhou. Usando relógio local:', err);
      // Mantém o clockOffset atual ou 0 em caso de falha transitória
    }
  }

  /**
   * Retorna o timestamp estimado atual do servidor em milissegundos.
   */
  public getServerNowMs(): number {
    return Date.now() + this.clockOffset;
  }

  // ============================================================================
  // GERENCIAMENTO DE ÁUDIO E DRIFT
  // ============================================================================

  /**
   * Aplica o estado de reprodução recebido no elemento de áudio nativo.
   */
  private applyPlaybackState(state: PlaybackState | null): void {
    if (this.isDestroyed) return;
    this.currentState = state;
    this.notifyStateSubscribers(state);

    if (!state || !state.track_url) {
      if (!this.audio.paused) {
        this.audio.pause();
      }
      this.audio.currentTime = 0;
      return;
    }

    // Configura propriedades de repetição e volume
    this.audio.loop = Boolean(state.loop);
    this.audio.volume = Math.max(0, Math.min(1, state.volume ?? 1));

    // Se mudou de faixa, altera o src
    if (this.audio.src !== state.track_url) {
      this.audio.src = state.track_url;
      this.audio.load();
    }

    if (!state.is_playing) {
      // Estado pausado
      this.pendingPlayState = null;
      if (!this.audio.paused) {
        this.audio.pause();
      }
      const pausedPos = state.paused_position || 0;
      if (Math.abs(this.audio.currentTime - pausedPos) > 0.1) {
        try {
          this.audio.currentTime = pausedPos;
        } catch {
          // Ignora caso os metadados ainda estejam carregando
        }
      }
      return;
    }

    // Estado reproduzindo: calcula a posição exata de acordo com o relógio
    const currentPosition = this.computeSynchronizedPosition(state);

    if (Math.abs(this.audio.currentTime - currentPosition) > 0.3) {
      try {
        this.audio.currentTime = Math.max(0, currentPosition);
      } catch (err) {
        console.warn('[MusicSync] Ajuste de currentTime aguardando metadados:', err);
      }
    }

    // Tenta reproduzir e lida com eventual bloqueio de autoplay sem exibir nenhuma UI
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        if (err.name === 'NotAllowedError') {
          // Autoplay bloqueado pelo navegador do usuário
          this.pendingPlayState = state;
          this.registerAutoplayUnlock();
        } else {
          console.warn('[MusicSync] Erro ao reproduzir áudio:', err);
        }
      });
    }
  }

  /**
   * Calcula a posição em segundos em que a faixa deveria estar neste exato instante.
   */
  private computeSynchronizedPosition(state: PlaybackState): number {
    if (!state.is_playing || !state.started_at) {
      return state.paused_position || 0;
    }

    const startedAtMs = new Date(state.started_at).getTime();
    const serverNowMs = this.getServerNowMs();
    let elapsedSeconds = (serverNowMs - startedAtMs) / 1000;

    if (elapsedSeconds < 0) {
      elapsedSeconds = 0;
    }

    // Se estiver em loop e a duração do áudio for conhecida, aplica o módulo
    if (state.loop && this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration > 0) {
      elapsedSeconds = elapsedSeconds % this.audio.duration;
    }

    return elapsedSeconds;
  }

  /**
   * Monitora periodicamente a posição do áudio e corrige desvios superiores a 0.3 segundos.
   */
  private checkAndCorrectDrift(): void {
    if (!this.currentState || !this.currentState.is_playing || this.audio.paused) {
      return;
    }

    // Se ainda não carregou metadados, aguarda
    if (isNaN(this.audio.duration) || this.audio.duration === 0) {
      return;
    }

    const targetPos = this.computeSynchronizedPosition(this.currentState);
    const drift = Math.abs(this.audio.currentTime - targetPos);

    if (drift > 0.3) {
      try {
        this.audio.currentTime = targetPos;
      } catch (err) {
        console.warn('[MusicSync] Erro na correção de drift:', err);
      }
    }
  }

  /**
   * Desbloqueio silencioso de autoplay em conformidade com as regras do navegador.
   * Não exibe pop-up, botão ou texto. Escuta o primeiro toque ou tecla na página.
   */
  private registerAutoplayUnlock(): void {
    if (this.unlockListenersAttached) return;
    this.unlockListenersAttached = true;

    const onUserInteraction = () => {
      this.removeAutoplayListeners();
      if (this.pendingPlayState && !this.isDestroyed) {
        const stateToPlay = this.pendingPlayState;
        this.pendingPlayState = null;
        this.applyPlaybackState(stateToPlay);
      }
    };

    this.interactionHandler = onUserInteraction;

    // Registra listeners de interação única com { once: true }
    document.addEventListener('pointerdown', onUserInteraction, { once: true });
    document.addEventListener('keydown', onUserInteraction, { once: true });
    document.addEventListener('touchstart', onUserInteraction, { once: true });
  }

  /**
   * Remove os listeners de desbloqueio de autoplay.
   */
  private removeAutoplayListeners(): void {
    if (this.interactionHandler) {
      document.removeEventListener('pointerdown', this.interactionHandler);
      document.removeEventListener('keydown', this.interactionHandler);
      document.removeEventListener('touchstart', this.interactionHandler);
      this.interactionHandler = null;
    }
    this.unlockListenersAttached = false;
  }

  /**
   * Desbloqueia proativamente o elemento HTMLAudioElement no primeiro toque/clique
   * do usuário na tela inicial, garantindo que futuras transmissões via Realtime
   * toquem imediatamente sem bloqueio de autoplay do navegador/WebView.
   */
  public unlockAudio(): void {
    if (this.isDestroyed) return;
    this.removeAutoplayListeners();

    const activeState = this.pendingPlayState || this.currentState;
    if (activeState && activeState.is_playing && activeState.track_url) {
      this.pendingPlayState = null;
      this.applyPlaybackState(activeState);
      return;
    }

    try {
      const prevVolume = this.audio.volume;
      const prevSrc = this.audio.src;
      const silentWav =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

      this.audio.muted = true;
      if (!prevSrc) {
        this.audio.src = silentWav;
      }

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (!this.currentState?.is_playing) {
              this.audio.pause();
              if (!prevSrc && !this.currentState?.track_url) {
                this.audio.removeAttribute('src');
                this.audio.load();
              } else if (this.currentState?.track_url && this.audio.src !== this.currentState.track_url) {
                this.audio.src = this.currentState.track_url;
                this.audio.currentTime = this.currentState.paused_position || 0;
              }
            }
            this.audio.muted = false;
            this.audio.volume = this.currentState?.volume ?? prevVolume;
          })
          .catch(() => {
            this.audio.muted = false;
            this.audio.volume = this.currentState?.volume ?? prevVolume;
          });
      } else {
        this.audio.muted = false;
      }
    } catch {
      this.audio.muted = false;
    }
  }

  /**
   * Pré-carrega uma faixa de áudio em segundo plano para transição instantânea.
   */
  public preloadTrack(url: string): void {
    try {
      if (url && this.preloadAudio.src !== url) {
        this.preloadAudio.src = url;
        this.preloadAudio.load();
      }
    } catch (err) {
      console.warn('[MusicSync] Falha no preload da faixa:', err);
    }
  }

  // ============================================================================
  // BUSCAS INICIAIS E REALTIME (POSTGRES CHANGES)
  // ============================================================================

  private async fetchInitialPlaybackState(): Promise<void> {
    if (!this.roomId) return;

    try {
      const { data, error } = await this.supabase
        .from('playback_state')
        .select('*')
        .eq('room_id', this.roomId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      } else {
        // Se ainda não existir registro para a sala, cria o padrão se for o Mestre
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
            .from('playback_state')
            .upsert(defaultState, { onConflict: 'room_id' })
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
      console.error('[MusicSync] Erro ao buscar estado inicial de reprodução:', err);
    }
  }

  public async fetchTracks(): Promise<Track[]> {
    if (!this.roomId) return [];

    try {
      const { data, error } = await this.supabase
        .from('tracks')
        .select('*')
        .eq('room_id', this.roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.tracksList = (data || []) as Track[];
      this.notifyTracksSubscribers(this.tracksList);
      return this.tracksList;
    } catch (err) {
      console.error('[MusicSync] Erro ao listar faixas:', err);
      return [];
    }
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.roomId) return;

    const playbackChannelName = `music_playback_${this.roomId}`;
    const tracksChannelName = `music_tracks_${this.roomId}`;

    // 1. Canal de estado de reprodução
    this.playbackChannel = this.supabase
      .channel(playbackChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playback_state',
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            this.applyPlaybackState(payload.new as PlaybackState);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Ao reestabelecer conexão, re-sincroniza o relógio e o estado
          this.syncClock().catch(console.warn);
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[MusicSync] Conexão Realtime de áudio (${status}). Reconectando...`);
          setTimeout(() => {
            if (!this.isDestroyed && this.roomId) {
              this.fetchInitialPlaybackState().catch(console.warn);
            }
          }, 3000);
        }
      });

    // 2. Canal de faixas da biblioteca
    this.tracksChannel = this.supabase
      .channel(tracksChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracks',
          filter: `room_id=eq.${this.roomId}`,
        },
        () => {
          this.fetchTracks().catch(console.warn);
        }
      )
      .subscribe();
  }

  // ============================================================================
  // FUNÇÕES DO MESTRE (CONTROLES E BIBLIOTECA)
  // ============================================================================

  /**
   * Toca uma faixa selecionada na sala sincronizada.
   */
  public async playTrack(track: Track): Promise<void> {
    if (!this.roomId) throw new Error('Nenhuma sala conectada.');

    try {
      const { data: serverTime, error: timeErr } = await this.supabase.rpc('server_now');
      const startedAt = (!timeErr && serverTime) ? serverTime : new Date().toISOString();

      const nextState: Partial<PlaybackState> = {
        room_id: this.roomId,
        track_url: track.url,
        started_at: startedAt,
        is_playing: true,
        paused_position: 0,
        volume: this.currentState?.volume ?? 1.0,
        loop: this.currentState?.loop ?? false,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('playback_state')
        .upsert(nextState, { onConflict: 'room_id' })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao reproduzir faixa:', err);
      throw err;
    }
  }

  /**
   * Pausa a reprodução sincronizada da sala mantendo a posição atual.
   */
  public async pause(): Promise<void> {
    if (!this.roomId || !this.currentState || !this.currentState.is_playing) return;

    try {
      const currentPos = this.computeSynchronizedPosition(this.currentState);

      const nextState: Partial<PlaybackState> = {
        room_id: this.roomId,
        is_playing: false,
        paused_position: Math.max(0, currentPos),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('playback_state')
        .update(nextState)
        .eq('room_id', this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao pausar áudio:', err);
      throw err;
    }
  }

  /**
   * Retoma a reprodução sincronizada da sala a partir da posição pausada.
   */
  public async resume(): Promise<void> {
    if (!this.roomId || !this.currentState || this.currentState.is_playing || !this.currentState.track_url) {
      return;
    }

    try {
      const { data: serverTime, error: timeErr } = await this.supabase.rpc('server_now');
      const nowServerMs = (!timeErr && serverTime)
        ? new Date(serverTime).getTime()
        : this.getServerNowMs();

      const pausedPosMs = (this.currentState.paused_position || 0) * 1000;
      const calculatedStartedAt = new Date(nowServerMs - pausedPosMs).toISOString();

      const nextState: Partial<PlaybackState> = {
        room_id: this.roomId,
        is_playing: true,
        started_at: calculatedStartedAt,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('playback_state')
        .update(nextState)
        .eq('room_id', this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao retomar reprodução:', err);
      throw err;
    }
  }

  /**
   * Para completamente a reprodução da sala e zera o tempo.
   */
  public async stop(): Promise<void> {
    if (!this.roomId) return;

    try {
      const nextState: Partial<PlaybackState> = {
        room_id: this.roomId,
        is_playing: false,
        paused_position: 0,
        started_at: null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('playback_state')
        .update(nextState)
        .eq('room_id', this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao parar reprodução:', err);
      throw err;
    }
  }

  /**
   * Ajusta o volume global sincronizado da sala (valor entre 0 e 1).
   */
  public async setVolume(volume: number): Promise<void> {
    if (!this.roomId) return;
    const clampedVolume = Math.max(0, Math.min(1, volume));

    try {
      const { data, error } = await this.supabase
        .from('playback_state')
        .update({
          volume: clampedVolume,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao atualizar volume:', err);
      throw err;
    }
  }

  /**
   * Ativa ou desativa a repetição contínua (loop) da faixa na sala.
   */
  public async setLoop(loop: boolean): Promise<void> {
    if (!this.roomId) return;

    try {
      const { data, error } = await this.supabase
        .from('playback_state')
        .update({
          loop,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', this.roomId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        this.applyPlaybackState(data as PlaybackState);
      }
    } catch (err) {
      console.error('[MusicSync] Erro ao alternar loop:', err);
      throw err;
    }
  }

  /**
   * Realiza upload de arquivo de áudio (mp3, ogg, wav, m4a) para o Supabase Storage
   * no bucket público 'audio-tracks' sem limite imposto por código.
   */
  public async uploadTrack(file: File, customName?: string): Promise<Track> {
    if (!this.roomId) throw new Error('Nenhuma sala conectada para envio de faixas.');

    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePath = `${this.roomId}/${Date.now()}_${cleanFileName}`;

      // Upload direto para o bucket público
      const { error: uploadError } = await this.supabase.storage
        .from('audio-tracks')
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'audio/mpeg',
        });

      if (uploadError) throw uploadError;

      // Obtém a URL pública do arquivo
      const { data: publicUrlData } = this.supabase.storage
        .from('audio-tracks')
        .getPublicUrl(uniquePath);

      const trackUrl = publicUrlData.publicUrl;
      const trackName = customName?.trim() || file.name.replace(/\.[^/.]+$/, '');

      // Registra a faixa na tabela tracks
      const { data: trackData, error: dbError } = await this.supabase
        .from('tracks')
        .insert({
          room_id: this.roomId,
          name: trackName,
          url: trackUrl,
          source: 'upload',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await this.fetchTracks();
      return trackData as Track;
    } catch (err) {
      console.error('[MusicSync] Erro no upload da faixa:', err);
      throw err;
    }
  }

  /**
   * Adiciona uma faixa externa por link direto (.mp3, .ogg, etc.) sem consumir armazenamento.
   */
  public async addLink(name: string, url: string): Promise<Track> {
    if (!this.roomId) throw new Error('Nenhuma sala conectada.');

    try {
      const cleanUrl = url.trim();
      const cleanName = name.trim() || 'Trilha Sem Nome';

      const { data, error } = await this.supabase
        .from('tracks')
        .insert({
          room_id: this.roomId,
          name: cleanName,
          url: cleanUrl,
          source: 'link',
        })
        .select()
        .single();

      if (error) throw error;

      await this.fetchTracks();
      return data as Track;
    } catch (err) {
      console.error('[MusicSync] Erro ao adicionar link de áudio:', err);
      throw err;
    }
  }

  /**
   * Renomeia uma faixa na biblioteca.
   */
  public async renameTrack(trackId: string, newName: string): Promise<void> {
    try {
      const cleanName = newName.trim();
      if (!cleanName) return;

      const { error } = await this.supabase
        .from('tracks')
        .update({ name: cleanName })
        .eq('id', trackId);

      if (error) throw error;
      await this.fetchTracks();
    } catch (err) {
      console.error('[MusicSync] Erro ao renomear faixa:', err);
      throw err;
    }
  }

  /**
   * Remove uma faixa da biblioteca da mesa.
   * Se for upload do Storage, remove também o arquivo físico do bucket.
   */
  public async removeTrack(track: Track): Promise<void> {
    try {
      // 1. Se for upload do Supabase Storage, tenta extrair o path e excluir
      if (track.source === 'upload' && track.url.includes('/audio-tracks/')) {
        try {
          const parts = track.url.split('/audio-tracks/');
          if (parts[1]) {
            const storagePath = decodeURIComponent(parts[1]);
            await this.supabase.storage.from('audio-tracks').remove([storagePath]);
          }
        } catch (storageErr) {
          console.warn('[MusicSync] Aviso ao excluir arquivo do Storage:', storageErr);
        }
      }

      // 2. Remove da tabela tracks
      const { error } = await this.supabase
        .from('tracks')
        .delete()
        .eq('id', track.id);

      if (error) throw error;

      // 3. Se a faixa excluída for a que está tocando, para o player
      if (this.currentState?.track_url === track.url) {
        await this.stop();
      }

      await this.fetchTracks();
    } catch (err) {
      console.error('[MusicSync] Erro ao excluir faixa:', err);
      throw err;
    }
  }

  // ============================================================================
  // INSCRIÇÕES E SUBSCRIBERS
  // ============================================================================

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

  private notifyStateSubscribers(state: PlaybackState | null): void {
    this.stateSubscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('[MusicSync] Erro no callback de estado:', err);
      }
    });
  }

  private notifyTracksSubscribers(tracks: Track[]): void {
    this.tracksSubscribers.forEach((cb) => {
      try {
        cb(tracks);
      } catch (err) {
        console.error('[MusicSync] Erro no callback de faixas:', err);
      }
    });
  }

  public getCurrentState(): PlaybackState | null {
    return this.currentState;
  }

  public getTracks(): Track[] {
    return this.tracksList;
  }

  public getCurrentAudioTime(): number {
    return this.audio.currentTime;
  }

  public getAudioDuration(): number {
    return this.audio.duration || 0;
  }
}
