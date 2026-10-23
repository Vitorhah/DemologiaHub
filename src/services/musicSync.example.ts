/**
 * EXEMPLO DE USO DO SISTEMA DE MÚSICA SINCRONIZADA (MusicSync)
 * Demologia Hub - RPG Tabletop
 * 
 * Este arquivo demonstra como inicializar e utilizar a classe MusicSync
 * tanto do lado do Jogador (apenas escutando sincronizado) quanto do
 * lado do Mestre (gerenciando faixas e controles de reprodução).
 */

import { supabase } from '../lib/supabase';
import { MusicSync, Track, PlaybackState } from './musicSync';

// ============================================================================
// 1. INICIALIZAÇÃO E ENTRADA NA SALA (JOGADOR E MESTRE)
// ============================================================================

// Cria uma única instância compartilhada de MusicSync conectada ao Supabase
export const musicSync = new MusicSync(supabase);

// Identificador da mesa (pode vir de URL, sessão ou padrão)
const roomId = 'mesa_principal_01';

// O jogador ou mestre entra na sala:
// - Sincroniza o relógio (NTP-lite) com a função server_now()
// - Carrega o estado atual de reprodução
// - Inscreve-se nas alterações Realtime da tabela playback_state
// - Inicia a reprodução silenciosa na posição exata calculada
export async function conectarNaMesa(isMaster: boolean = false) {
  try {
    await musicSync.joinRoom(roomId, isMaster);
    console.log(`[Áudio] Conectado à mesa ${roomId} como ${isMaster ? 'Mestre' : 'Jogador'}`);
  } catch (erro) {
    console.error('[Áudio] Erro ao conectar na mesa:', erro);
  }
}

// ============================================================================
// 2. ESCUTANDO MUDANÇAS DE ESTADO (UI DO MESTRE OU REAÇÕES NO APP)
// ============================================================================

// Inscreve para receber atualizações do estado de reprodução
const unsubscribeState = musicSync.onStateChange((state: PlaybackState | null) => {
  if (!state) {
    console.log('[Áudio] Nenhum áudio ativo na sala.');
    return;
  }

  console.log('[Áudio] Estado atualizado:', {
    tocando: state.is_playing,
    url: state.track_url,
    volume: state.volume,
    loop: state.loop,
    iniciadoEm: state.started_at,
    posicaoPausada: state.paused_position,
  });
});

// Inscreve para receber a lista atualizada de faixas da biblioteca da mesa
const unsubscribeTracks = musicSync.onTracksChange((tracks: Track[]) => {
  console.log(`[Áudio] ${tracks.length} faixa(s) disponível(is) na biblioteca.`);
});

// ============================================================================
// 3. EXEMPLOS DE COMANDOS EXCLUSIVOS DO MESTRE
// ============================================================================

export async function exemplosDoMestre() {
  // A) Upload de arquivo de áudio (mp3, ogg, wav, m4a) para o Storage:
  // const arquivo = inputElement.files[0];
  // const novaFaixa = await musicSync.uploadTrack(arquivo, "Tensão no Sanatório");

  // B) Adicionar faixa por link direto externo (não consome armazenamento):
  const faixaLink = await musicSync.addLink(
    'Invocação do Oculto',
    'https://minha-trilha.com/audio/ritual.mp3'
  );

  // C) Tocar uma faixa na mesa (sincronizada para todos no mesmo instante):
  await musicSync.playTrack(faixaLink);

  // D) Pausar a música da mesa:
  await musicSync.pause();

  // E) Retomar a música do ponto onde foi pausada:
  await musicSync.resume();

  // F) Ajustar volume sincronizado (entre 0 e 1):
  await musicSync.setVolume(0.75); // 75%

  // G) Ativar repetição contínua (loop):
  await musicSync.setLoop(true);

  // H) Parar a reprodução e reiniciar o tempo:
  await musicSync.stop();

  // I) Renomear uma faixa da biblioteca:
  await musicSync.renameTrack(faixaLink.id, 'Invocação do Oculto (Versão Estendida)');

  // J) Remover uma faixa (se for upload do Storage, exclui também o arquivo físico):
  await musicSync.removeTrack(faixaLink);
}

// ============================================================================
// 4. DESCONEXÃO E LIMPEZA
// ============================================================================

export function desconectarDaMesa() {
  unsubscribeState();
  unsubscribeTracks();
  musicSync.leaveRoom();
}
