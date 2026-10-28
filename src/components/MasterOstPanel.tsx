import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Music,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Upload,
  Link as LinkIcon,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Repeat,
  Radio,
  FileAudio,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { MusicSync, Track, PlaybackState } from "../services/musicSync";

export interface MasterOstPanelProps {
  musicSync: MusicSync;
}

export function MasterOstPanel({ musicSync }: MasterOstPanelProps) {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(musicSync.getCurrentState());
  const [tracks, setTracks] = useState<Track[]>(musicSync.getTracks());
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modal / formulário para adicionar link direto
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Renomear faixa
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Confirmação de exclusão
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Progresso em tempo real da faixa ativa
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inscreve no estado e lista de faixas do MusicSync
  useEffect(() => {
    const unsubState = musicSync.onStateChange((state) => {
      setPlaybackState(state);
    });

    const unsubTracks = musicSync.onTracksChange((updatedTracks) => {
      setTracks(updatedTracks);
    });

    return () => {
      unsubState();
      unsubTracks();
    };
  }, [musicSync]);

  // Atualização em tempo real da barra de progresso (somente enquanto estiver reproduzindo)
  useEffect(() => {
    if (!playbackState?.is_playing) {
      setCurrentProgress(playbackState?.paused_position || 0);
      return;
    }

    setCurrentProgress(musicSync.getCurrentAudioTime());
    const timer = setInterval(() => {
      const nextTime = musicSync.getCurrentAudioTime();
      setCurrentProgress((prev) => (Math.abs(prev - nextTime) >= 0.2 ? nextTime : prev));
    }, 350);

    return () => clearInterval(timer);
  }, [playbackState?.is_playing, playbackState?.paused_position, playbackState?.track_url, musicSync]);

  // Faixa atualmente em reprodução
  const activeTrack = useMemo(() => {
    if (!playbackState?.track_url) return null;
    return tracks.find((t) => t.url === playbackState.track_url) || null;
  }, [tracks, playbackState?.track_url]);

  // Faixas filtradas pela busca
  const filteredTracks = useMemo(() => {
    if (!searchTerm.trim()) return tracks;
    const term = searchTerm.toLowerCase();
    return tracks.filter((t) => t.name.toLowerCase().includes(term));
  }, [tracks, searchTerm]);

  // Manipulação de Upload de Arquivos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      await musicSync.uploadTrack(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Erro no upload:", err);
      setUploadError(err.message || "Falha ao enviar arquivo de áudio para o Storage.");
    } finally {
      setIsUploading(false);
    }
  };

  // Manipulação de Inclusão de Link Direto
  const handleAddLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    setIsAddingLink(true);
    setUploadError(null);

    try {
      await musicSync.addLink(linkName, linkUrl);
      setLinkName("");
      setLinkUrl("");
      setShowAddLink(false);
    } catch (err: any) {
      console.error("Erro ao adicionar link:", err);
      setUploadError(err.message || "Erro ao adicionar link externo de áudio.");
    } finally {
      setIsAddingLink(false);
    }
  };

  // Salvar renomeação
  const handleSaveRename = async (trackId: string) => {
    if (!editingName.trim()) return;
    try {
      await musicSync.renameTrack(trackId, editingName);
      setEditingTrackId(null);
      setEditingName("");
    } catch (err: any) {
      alert("Erro ao renomear: " + err.message);
    }
  };

  // Excluir faixa
  const handleDeleteTrack = async (track: Track) => {
    try {
      await musicSync.removeTrack(track);
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert("Erro ao excluir faixa: " + err.message);
    }
  };

  // Formatar segundos em mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isPlaying = Boolean(playbackState?.is_playing);
  const currentVolume = playbackState?.volume ?? 1;
  const isLoop = Boolean(playbackState?.loop);
  const audioDuration = musicSync.getAudioDuration();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 px-3 sm:px-4 pb-12 font-mono text-gray-200">
      {/* DECK PRINCIPAL DE TRANSMISSÃO SONORA */}
      <div
        className={`p-4 sm:p-5 bg-[#0b0b10] border transition-all relative overflow-hidden shadow-[0_14px_35px_rgba(0,0,0,0.85)] ${
          isPlaying ? "border-blood-red/60" : "border-[#252530]"
        }`}
      >
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${
            isPlaying
              ? "bg-gradient-to-r from-transparent via-blood-red to-transparent opacity-100"
              : "bg-[#252530] opacity-50"
          }`}
        />

        {/* Topo do Deck: Status + Ações Rápidas de Adição */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-4 border-b border-[#1c1c25]">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
                isPlaying
                  ? "bg-blood-red/20 border-blood-red/60 text-red-300"
                  : "bg-[#14141c] border-[#2a2a36] text-gray-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPlaying
                    ? "bg-red-500 animate-ping"
                    : "bg-gray-600"
                }`}
              />
              {isPlaying ? "NO AR" : "STANDBY"}
            </span>
            <span className="text-[11px] uppercase font-bold tracking-widest text-gray-400">
              OST • Mesa
            </span>
          </div>

          {/* Botões de Adição de Mídia */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/m4a,.mp3,.ogg,.wav,.m4a"
              onChange={handleFileUpload}
              className="hidden"
              id="master-audio-upload"
            />

            <label
              htmlFor="master-audio-upload"
              className={`min-h-[38px] px-3 py-1.5 text-[11px] uppercase font-bold tracking-wider transition-all border flex items-center gap-1.5 touch-manipulation ${
                isUploading
                  ? "bg-blood-red/30 border-blood-red text-white cursor-not-allowed"
                  : "bg-[#14141c] hover:bg-[#1e1e2a] border-[#2e2e3a] hover:border-blood-red text-gray-200 hover:text-white cursor-pointer"
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blood-red" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-blood-red" />
                  <span>Upload</span>
                </>
              )}
            </label>

            <button
              type="button"
              onClick={() => setShowAddLink(!showAddLink)}
              className={`min-h-[38px] px-3 py-1.5 text-[11px] uppercase font-bold tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                showAddLink
                  ? "bg-blood-red/20 border-blood-red text-white"
                  : "bg-[#14141c] hover:bg-[#1e1e2a] border-[#2e2e3a] hover:border-gray-500 text-gray-300 hover:text-white"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-blood-red" />
              <span>Link</span>
            </button>
          </div>
        </div>

        {/* Visor Principal + Controles de Transporte */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Informações da Trilha Ativa */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center border transition-all ${
                isPlaying
                  ? "bg-blood-red/15 border-blood-red text-blood-red shadow-[0_0_20px_rgba(143,23,28,0.4)]"
                  : "bg-[#07070a] border-[#262632] text-gray-600"
              }`}
            >
              {isPlaying ? (
                <div className="flex items-end gap-1 h-5">
                  <span className="w-1 bg-blood-red animate-[pulse_0.6s_ease-in-out_infinite] h-full" />
                  <span className="w-1 bg-blood-red animate-[pulse_0.9s_ease-in-out_infinite] h-3" />
                  <span className="w-1 bg-blood-red animate-[pulse_0.5s_ease-in-out_infinite] h-4" />
                  <span className="w-1 bg-blood-red animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
                </div>
              ) : (
                <Radio className="w-6 h-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {activeTrack?.name ||
                  (playbackState?.track_url
                    ? "Trilha Remota Ativa"
                    : "Nenhuma faixa selecionada")}
              </h3>
              <div className="text-xs text-gray-400 flex items-center gap-2 mt-1 tabular-nums">
                <span className={isPlaying ? "text-white font-bold" : "text-gray-400"}>
                  {formatTime(currentProgress)}
                </span>
                <span className="text-gray-600">/</span>
                <span>{audioDuration > 0 ? formatTime(audioDuration) : "--:--"}</span>
                {isLoop && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-blood-red/20 border border-blood-red/40 text-red-300 uppercase tracking-wider font-bold">
                    LOOP
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controles de Transporte + Volume */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Play / Pause */}
              {isPlaying ? (
                <button
                  type="button"
                  onClick={() => musicSync.pause()}
                  title="Pausar"
                  className="w-11 h-11 flex items-center justify-center bg-blood-red hover:bg-red-700 border border-blood-red text-white transition-all shadow-[0_0_14px_rgba(143,23,28,0.45)] active:scale-95 cursor-pointer touch-manipulation"
                >
                  <Pause className="w-5 h-5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!playbackState?.track_url && tracks.length === 0}
                  onClick={() => {
                    musicSync.unlockAudio();
                    if (playbackState?.track_url) {
                      musicSync.resume();
                    } else if (tracks[0]) {
                      musicSync.playTrack(tracks[0]);
                    }
                  }}
                  title="Tocar"
                  className="w-11 h-11 flex items-center justify-center bg-[#181822] hover:bg-blood-red border border-[#323242] hover:border-blood-red text-white transition-all active:scale-95 disabled:opacity-40 cursor-pointer touch-manipulation"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              )}

              {/* Stop */}
              <button
                type="button"
                disabled={!playbackState?.track_url && !isPlaying}
                onClick={() => musicSync.stop()}
                title="Parar"
                className="w-11 h-11 flex items-center justify-center bg-[#14141d] hover:bg-[#222230] border border-[#2c2c3a] text-gray-300 hover:text-white transition-all active:scale-95 disabled:opacity-40 cursor-pointer touch-manipulation"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>

              {/* Loop Toggle */}
              <button
                type="button"
                onClick={() => musicSync.setLoop(!isLoop)}
                title={isLoop ? "Desativar Loop" : "Ativar Loop"}
                className={`w-11 h-11 flex items-center justify-center border transition-all active:scale-95 cursor-pointer touch-manipulation ${
                  isLoop
                    ? "bg-blood-red/25 border-blood-red text-red-300 shadow-[0_0_10px_rgba(143,23,28,0.35)]"
                    : "bg-[#14141d] hover:bg-[#222230] border-[#2c2c3a] text-gray-400 hover:text-white"
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Controle de Volume */}
            <div className="flex items-center gap-2.5 bg-[#07070b] border border-[#252532] px-3 h-11 flex-1 sm:flex-initial min-w-[165px]">
              <button
                type="button"
                onClick={() => musicSync.setVolume(currentVolume === 0 ? 0.8 : 0)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer touch-manipulation"
                title={currentVolume === 0 ? "Restaurar Volume" : "Mutar"}
              >
                {currentVolume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-blood-red" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentVolume}
                onChange={(e) => musicSync.setVolume(parseFloat(e.target.value))}
                className="w-full sm:w-24 accent-blood-red cursor-pointer"
                title={`Volume: ${Math.round(currentVolume * 100)}%`}
              />
              <span className="text-[11px] w-8 text-right font-bold text-gray-300 tabular-nums">
                {Math.round(currentVolume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="mt-4">
          <div className="w-full bg-[#060609] h-1.5 overflow-hidden border border-[#1d1d26]">
            <div
              className="bg-blood-red h-full transition-all duration-200 shadow-[0_0_10px_#8f171c]"
              style={{
                width:
                  audioDuration > 0
                    ? `${Math.min(100, (currentProgress / audioDuration) * 100)}%`
                    : isPlaying
                      ? "100%"
                      : "0%",
              }}
            />
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-950/60 border border-blood-red text-red-200 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL FLUTUANTE: ADICIONAR POR LINK DIRETO */}
      {showAddLink && (
        <div
          className="fixed inset-0 z-[350] modal-backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowAddLink(false)}
        >
          <form
            onSubmit={handleAddLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
            className="w-full sm:max-w-md p-5 bg-[#101016]/95 border-t sm:border border-[#2b2b38] flex flex-col gap-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)] animate-sheet-up relative"
          >
            <div className="h-[2px] w-full bg-blood-red absolute top-0 left-0" />
            <div className="sm:hidden flex justify-center -mt-1 pb-1">
              <div className="w-10 h-1 bg-[#323442]" />
            </div>

            <div className="flex items-center justify-between text-xs text-white font-bold uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-blood-red" />
                Adicionar Link de Áudio
              </span>
              <button
                type="button"
                onClick={() => setShowAddLink(false)}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nome da trilha (ex: Combate Final)"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                autoFocus
                className="w-full min-h-[44px] bg-[#08080c] border border-[#262632] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blood-red"
              />
              <input
                type="url"
                required
                placeholder="https://exemplo.com/trilha.mp3"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full min-h-[44px] bg-[#08080c] border border-[#262632] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blood-red"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddLink(false)}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs uppercase font-bold bg-[#16161f] hover:bg-[#20202c] text-gray-300 hover:text-white border border-[#2b2b36] cursor-pointer touch-manipulation"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isAddingLink || !linkUrl.trim()}
                className="flex-1 min-h-[44px] px-4 py-2 text-xs uppercase font-bold bg-blood-red hover:bg-red-700 text-white border border-blood-red disabled:opacity-50 cursor-pointer touch-manipulation"
              >
                {isAddingLink ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEÇÃO: BIBLIOTECA DE FAIXAS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-blood-red" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-white">
              Trilhas ({tracks.length})
            </h3>
          </div>

          {/* Campo de Busca */}
          {tracks.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar trilhas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[38px] bg-[#0a0a0f] border border-[#242430] pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blood-red"
              />
            </div>
          )}
        </div>

        {/* LISTAGEM DE FAIXAS (Grid de 2 colunas no PC, lista no celular) */}
        {filteredTracks.length === 0 ? (
          <div className="p-8 text-center bg-[#0b0b10] border border-dashed border-[#242430] text-gray-500 text-xs">
            {searchTerm
              ? "Nenhuma trilha encontrada."
              : "Nenhuma trilha cadastrada."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {filteredTracks.map((track) => {
              const isThisTrackActive = playbackState?.track_url === track.url;
              const isThisTrackPlaying = isThisTrackActive && isPlaying;
              const isEditing = editingTrackId === track.id;
              const isDeleting = deleteConfirmId === track.id;

              return (
                <div
                  key={track.id}
                  className={`flex items-center justify-between p-2.5 transition-all border ${
                    isThisTrackActive
                      ? "bg-[#150f16] border-blood-red/80 shadow-[inset_3px_0_0_#8f171c]"
                      : "bg-[#0c0c12] hover:bg-[#13131c] border-[#20202a]"
                  }`}
                >
                  {/* Lado Esquerdo: Botão Play 44x44 e Nome */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <button
                      type="button"
                      onClick={() => {
                        musicSync.unlockAudio();
                        if (isThisTrackPlaying) {
                          musicSync.pause();
                        } else if (isThisTrackActive) {
                          musicSync.resume();
                        } else {
                          musicSync.playTrack(track);
                        }
                      }}
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center border transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        isThisTrackPlaying
                          ? "bg-blood-red text-white border-blood-red shadow-[0_0_12px_rgba(143,23,28,0.5)]"
                          : "bg-[#161620] hover:bg-blood-red/20 text-gray-300 hover:text-white border-[#2c2c3a] hover:border-blood-red"
                      }`}
                      aria-label={isThisTrackPlaying ? `Pausar ${track.name}` : `Tocar ${track.name}`}
                    >
                      {isThisTrackPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Nome ou Edição de Nome */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(track.id);
                            if (e.key === "Escape") setEditingTrackId(null);
                          }}
                          className="w-full bg-[#07070a] border border-blood-red px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(track.id)}
                          className="w-8 h-8 flex items-center justify-center text-green-400 hover:text-green-300 bg-[#14141d] border border-[#2a2a36] cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrackId(null)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white bg-[#14141d] border border-[#2a2a36] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs font-bold truncate block ${
                            isThisTrackActive ? "text-white" : "text-gray-200"
                          }`}
                        >
                          {track.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-sans mt-0.5">
                          <span className="uppercase tracking-wider">
                            {track.source === "upload" ? "Storage" : "Link"}
                          </span>
                          {isThisTrackPlaying && (
                            <span className="text-blood-red font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              • Tocando
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lado Direito: Ações (Renomear e Excluir) */}
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTrackId(track.id);
                            setEditingName(track.name);
                          }}
                          title="Renomear"
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1a1a24] transition-colors cursor-pointer touch-manipulation"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(track.id)}
                          title="Remover"
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-[#1a1a24] transition-colors cursor-pointer touch-manipulation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL FLUTUANTE DE CONFIRMAÇÃO PARA EXCLUIR OST (SIM / NÃO) */}
      {deleteConfirmId !== null &&
        (() => {
          const trackToDelete = tracks.find((t) => t.id === deleteConfirmId);
          if (!trackToDelete) return null;
          return (
            <div
              className="fixed inset-0 z-[350] modal-backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setDeleteConfirmId(null)}
            >
              <div
                className="w-full sm:max-w-sm bg-[#101016]/95 border-t sm:border border-[#2b2b38] rounded-none p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative overflow-hidden animate-sheet-up"
                style={{
                  paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-[2px] w-full bg-blood-red absolute top-0 left-0" />
                <div className="sm:hidden flex justify-center -mt-1 pb-2.5">
                  <div className="w-10 h-1 bg-[#323442]" />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-red-950/40 border border-blood-red/50 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Apagar Trilha?
                    </h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {trackToDelete.name}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#9a9aa6] leading-relaxed mb-5 border-b border-[#1e1e28] pb-3.5 font-sans">
                  Deseja realmente apagar esta trilha da biblioteca da mesa?
                </p>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 min-h-[44px] bg-[#16161f] hover:bg-[#222230] active:scale-95 border border-[#2c2c38] text-gray-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 transition-all cursor-pointer touch-manipulation"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrack(trackToDelete)}
                    className="flex-1 min-h-[44px] bg-blood-red hover:bg-red-700 active:scale-95 border border-blood-red text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 transition-all shadow-[0_0_15px_rgba(143,23,28,0.4)] cursor-pointer touch-manipulation"
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
