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

  // Atualização em tempo real da barra de progresso (a cada 250ms)
  useEffect(() => {
    const timer = setInterval(() => {
      if (playbackState?.is_playing) {
        setCurrentProgress(musicSync.getCurrentAudioTime());
      } else {
        setCurrentProgress(playbackState?.paused_position || 0);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [playbackState, musicSync]);

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
    <div className="max-w-5xl mx-auto flex flex-col gap-5 px-3 sm:px-4 font-mono text-gray-200">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#25252c] pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center bg-black border border-blood-red text-blood-red shadow-[0_0_10px_rgba(143,23,28,0.4)]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-widest uppercase flex items-center gap-2">
              Central de Áudio • OST Sincronizada
            </h2>
            <p className="text-[11px] text-gray-400 font-sans tracking-wide">
              Controle mestre de frequências sonoras da mesa com transmissão em tempo real via PostgreSQL.
            </p>
          </div>
        </div>

        {/* BOTÕES DE ADIÇÃO DE MÍDIA */}
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
            className={`cursor-pointer flex items-center gap-2 px-3 py-2 text-xs uppercase font-bold tracking-wider transition-all border ${
              isUploading
                ? "bg-blood-red/40 border-blood-red text-white cursor-not-allowed"
                : "bg-[#141418] hover:bg-[#1f1f26] border-[#303038] hover:border-blood-red text-white"
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
                <span>Upload de Faixa</span>
              </>
            )}
          </label>

          <button
            type="button"
            onClick={() => setShowAddLink(!showAddLink)}
            className="flex items-center gap-2 px-3 py-2 text-xs uppercase font-bold tracking-wider bg-[#141418] hover:bg-[#1f1f26] border border-[#303038] hover:border-gray-500 text-gray-300 hover:text-white transition-all"
          >
            <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
            <span>Link Direto</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-950/60 border border-blood-red text-red-200 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FORMULÁRIO COLAPSÁVEL: ADICIONAR POR LINK DIRETO */}
      {showAddLink && (
        <form
          onSubmit={handleAddLinkSubmit}
          className="p-4 bg-[#111116] border border-dashed border-[#3a3a46] flex flex-col gap-3"
        >
          <div className="flex items-center justify-between text-xs text-gray-300 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-blood-red" />
              Adicionar Faixa por Link Externo (.mp3, .ogg)
            </span>
            <button
              type="button"
              onClick={() => setShowAddLink(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-gray-400 block mb-1">
                Nome da Trilha
              </label>
              <input
                type="text"
                placeholder="Ex: Tensão - O Ritual Ancestral"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full bg-[#08080b] border border-[#2b2b35] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blood-red"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-gray-400 block mb-1">
                URL do Áudio (HTTP/HTTPS)
              </label>
              <input
                type="url"
                required
                placeholder="https://exemplo.com/audio.mp3"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full bg-[#08080b] border border-[#2b2b35] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blood-red"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddLink(false)}
              className="px-3 py-1.5 text-xs uppercase bg-[#181820] hover:bg-[#20202a] text-gray-400 border border-[#2b2b35]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isAddingLink || !linkUrl.trim()}
              className="px-4 py-1.5 text-xs uppercase font-bold bg-blood-red hover:bg-red-700 text-white border border-blood-red disabled:opacity-50"
            >
              {isAddingLink ? "Cadastrando..." : "Confirmar Faixa"}
            </button>
          </div>
        </form>
      )}

      {/* REPRODUTOR EM DESTAQUE (CONTROLES DO MESTRE) */}
      <div className="p-4 bg-[#0e0e12] border border-[#282832] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blood-red to-transparent opacity-80" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Informações da Trilha Ativa */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 flex items-center justify-center border transition-all ${
              isPlaying
                ? "bg-blood-red/20 border-blood-red text-blood-red shadow-[0_0_15px_rgba(143,23,28,0.5)]"
                : "bg-black border-[#2d2d38] text-gray-500"
            }`}>
              <Music className={`w-6 h-6 ${isPlaying ? "animate-bounce" : ""}`} />
            </div>

            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-widest text-blood-red block">
                {isPlaying ? "Transmissão Ativa • Mesa Sincronizada" : "Reprodução Parada"}
              </span>
              <h3 className="text-sm font-bold text-white truncate max-w-md">
                {activeTrack?.name || (playbackState?.track_url ? "Trilha Remota Ativa" : "Nenhuma trilha selecionada")}
              </h3>
              <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                <span>{formatTime(currentProgress)}</span>
                <span>/</span>
                <span>{audioDuration > 0 ? formatTime(audioDuration) : "--:--"}</span>
                {isLoop && (
                  <span className="text-[10px] text-blood-red uppercase tracking-wider font-bold">
                    • Loop Ativo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Comando e Ajuste de Volume */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Play / Pause */}
            {isPlaying ? (
              <button
                type="button"
                onClick={() => musicSync.pause()}
                title="Pausar Reprodução"
                className="w-10 h-10 flex items-center justify-center bg-[#191922] hover:bg-blood-red border border-[#363642] hover:border-blood-red text-white transition-all shadow-md active:scale-95"
              >
                <Pause className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!playbackState?.track_url && tracks.length === 0}
                onClick={() => {
                  if (playbackState?.track_url) {
                    musicSync.resume();
                  } else if (tracks[0]) {
                    musicSync.playTrack(tracks[0]);
                  }
                }}
                title="Iniciar Reprodução"
                className="w-10 h-10 flex items-center justify-center bg-blood-red hover:bg-red-700 border border-blood-red text-white transition-all shadow-md active:scale-95 disabled:opacity-40"
              >
                <Play className="w-5 h-5 fill-current" />
              </button>
            )}

            {/* Stop */}
            <button
              type="button"
              disabled={!playbackState?.track_url && !isPlaying}
              onClick={() => musicSync.stop()}
              title="Parar e Reiniciar Posição"
              className="w-10 h-10 flex items-center justify-center bg-[#191922] hover:bg-[#252532] border border-[#363642] text-gray-300 hover:text-white transition-all disabled:opacity-40"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => musicSync.setLoop(!isLoop)}
              title={isLoop ? "Desativar Repetição" : "Ativar Repetição"}
              className={`w-10 h-10 flex items-center justify-center border transition-all ${
                isLoop
                  ? "bg-blood-red/30 border-blood-red text-blood-red shadow-[0_0_8px_rgba(143,23,28,0.4)]"
                  : "bg-[#191922] hover:bg-[#252532] border-[#363642] text-gray-400 hover:text-gray-200"
              }`}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Controle de Volume */}
            <div className="flex items-center gap-2 bg-[#121217] border border-[#2b2b35] px-3 py-1.5 ml-1">
              <button
                type="button"
                onClick={() => musicSync.setVolume(currentVolume === 0 ? 0.8 : 0)}
                className="text-gray-400 hover:text-white"
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
                className="w-20 accent-blood-red cursor-pointer"
                title={`Volume: ${Math.round(currentVolume * 100)}%`}
              />
              <span className="text-[10px] w-7 text-right font-bold text-gray-400">
                {Math.round(currentVolume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="mt-4 pt-3 border-t border-[#1e1e26]">
          <div className="w-full bg-[#08080c] h-1.5 overflow-hidden border border-[#202028]">
            <div
              className="bg-blood-red h-full transition-all duration-200 shadow-[0_0_8px_#8f171c]"
              style={{
                width: audioDuration > 0
                  ? `${Math.min(100, (currentProgress / audioDuration) * 100)}%`
                  : isPlaying ? "100%" : "0%",
              }}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO: BIBLIOTECA DE FAIXAS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-blood-red" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-white">
              Biblioteca da Mesa ({tracks.length})
            </h3>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar faixa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0d] border border-[#252530] pl-8 pr-3 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blood-red"
            />
          </div>
        </div>

        {/* LISTAGEM DE FAIXAS */}
        {filteredTracks.length === 0 ? (
          <div className="p-8 text-center bg-[#0d0d11] border border-dashed border-[#262630] text-gray-500 text-xs">
            {searchTerm
              ? "Nenhuma faixa encontrada com o termo informado."
              : "Nenhuma música adicionada ainda. Envie arquivos ou informe links diretos acima."}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
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
                      ? "bg-[#141018] border-blood-red/80 shadow-[inset_3px_0_0_#8f171c]"
                      : "bg-[#0f0f13] hover:bg-[#15151c] border-[#22222b]"
                  }`}
                >
                  {/* Lado Esquerdo: Botão Play e Nome */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isThisTrackPlaying) {
                          musicSync.pause();
                        } else if (isThisTrackActive) {
                          musicSync.resume();
                        } else {
                          musicSync.playTrack(track);
                        }
                      }}
                      className={`w-7 h-7 flex-shrink-0 flex items-center justify-center border transition-all ${
                        isThisTrackPlaying
                          ? "bg-blood-red text-white border-blood-red shadow-[0_0_8px_rgba(143,23,28,0.5)]"
                          : "bg-[#181820] hover:bg-blood-red/20 text-gray-300 hover:text-white border-[#30303c] hover:border-blood-red"
                      }`}
                    >
                      {isThisTrackPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Nome ou Edição de Nome */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(track.id);
                            if (e.key === "Escape") setEditingTrackId(null);
                          }}
                          className="w-full bg-[#08080b] border border-blood-red px-2 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(track.id)}
                          className="p-1 text-green-400 hover:text-green-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTrackId(null)}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs font-bold truncate block ${
                            isThisTrackActive ? "text-white" : "text-gray-300"
                          }`}
                        >
                          {track.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-sans">
                          <span className="uppercase">
                            {track.source === "upload" ? "Storage" : "Link Externo"}
                          </span>
                          {isThisTrackPlaying && (
                            <span className="text-blood-red font-mono font-bold uppercase tracking-wider">
                              • Tocando Agora
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lado Direito: Ações (Renomear e Excluir) */}
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTrackId(track.id);
                          setEditingName(track.name);
                        }}
                        title="Renomear Faixa"
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1c1c24]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-red-950/80 border border-blood-red px-2 py-0.5 text-[10px]">
                        <span className="text-red-200">Excluir?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrack(track)}
                          className="font-bold text-white hover:underline px-1"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-gray-300 hover:text-white px-1"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(track.id)}
                        title="Remover Faixa"
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#1c1c24]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
