import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  DoorOpen,
  Edit2,
  ExternalLink,
  Flame,
  Footprints,
  Ghost,
  Link as LinkIcon,
  Loader2,
  Play,
  Radio,
  RotateCcw,
  Search,
  Skull,
  Sparkles,
  Square,
  Swords,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { SoundBoardSync } from "../services/soundBoardSync";
import {
  SOUND_BOARD_ICON_OPTIONS,
  SoundBoardEffect,
  SoundBoardIconId,
  SoundBoardSnapshot,
} from "../utils/soundBoard";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

export interface MasterSoundBoardPanelProps {
  soundBoard: SoundBoardSync;
  isOstPlaying: boolean;
}

function SoundBoardIcon({
  icon,
  className = "w-5 h-5",
}: {
  icon: SoundBoardIconId;
  className?: string;
}) {
  switch (icon) {
    case "zap":
      return <Zap className={className} />;
    case "flame":
      return <Flame className={className} />;
    case "skull":
      return <Skull className={className} />;
    case "door":
      return <DoorOpen className={className} />;
    case "ghost":
      return <Ghost className={className} />;
    case "swords":
      return <Swords className={className} />;
    case "wind":
      return <Wind className={className} />;
    case "bell":
      return <Bell className={className} />;
    case "radio":
      return <Radio className={className} />;
    case "footprints":
      return <Footprints className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "volume":
    default:
      return <Volume2 className={className} />;
  }
}

export function MasterSoundBoardPanel({
  soundBoard,
  isOstPlaying,
}: MasterSoundBoardPanelProps) {
  const [snapshot, setSnapshot] = useState<SoundBoardSnapshot>(() =>
    soundBoard.getSnapshot(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Modal: Adicionar Link Direto
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkIcon, setLinkIcon] = useState<SoundBoardIconId>("volume");
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Modal: Editar (Renomear + Ícone)
  const [editingEffect, setEditingEffect] = useState<SoundBoardEffect | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<SoundBoardIconId>("volume");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal: Confirmação de Exclusão
  const [deleteTarget, setDeleteTarget] = useState<SoundBoardEffect | null>(
    null,
  );

  // Memória rápida do último volume não-mudo para alternância de mute
  const lastNonZeroMasterVolumeRef = useRef<number>(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return soundBoard.onSnapshotChange((next) => {
      setSnapshot(next);
      if (next.masterVolume > 0.01) {
        lastNonZeroMasterVolumeRef.current = next.masterVolume;
      }
    });
  }, [soundBoard]);

  const activeSet = useMemo(
    () => new Set(snapshot.activeIds),
    [snapshot.activeIds],
  );
  const fadingSet = useMemo(
    () => new Set(snapshot.fadingOutIds),
    [snapshot.fadingOutIds],
  );

  const filteredEffects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return snapshot.effects;
    return snapshot.effects.filter((ef) => ef.name.toLowerCase().includes(q));
  }, [snapshot.effects, searchTerm]);

  const activeCount = snapshot.activeIds.length;
  const masterVolumePercent = Math.round(snapshot.masterVolume * 100);
  const displayError = localError || snapshot.lastError;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    setIsUploading(true);
    try {
      await soundBoard.uploadEffect(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setLocalError(
        err?.message || "Falha ao enviar arquivo de efeito sonoro para o Storage.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    setIsAddingLink(true);
    setLocalError(null);
    try {
      await soundBoard.addLinkEffect(linkName, linkUrl, linkIcon);
      setLinkName("");
      setLinkUrl("");
      setLinkIcon("volume");
      setShowAddLink(false);
    } catch (err: any) {
      setLocalError(err?.message || "Não foi possível adicionar o efeito sonoro.");
    } finally {
      setIsAddingLink(false);
    }
  };

  const openEditModal = (effect: SoundBoardEffect) => {
    setEditingEffect(effect);
    setEditName(effect.name);
    setEditIcon(effect.icon);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEffect || !editName.trim()) return;

    setIsSavingEdit(true);
    setLocalError(null);
    try {
      await soundBoard.updateEffectMeta(editingEffect.id, {
        name: editName,
        icon: editIcon,
      });
      setEditingEffect(null);
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao salvar alterações do efeito.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await soundBoard.removeEffect(deleteTarget);
      setDeleteTarget(null);
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao remover efeito sonoro.");
    }
  };

  const toggleMasterMute = () => {
    if (snapshot.masterVolume > 0) {
      lastNonZeroMasterVolumeRef.current = snapshot.masterVolume;
      soundBoard.setMasterVolume(0);
    } else {
      soundBoard.setMasterVolume(
        lastNonZeroMasterVolumeRef.current > 0.05
          ? lastNonZeroMasterVolumeRef.current
          : 1.0,
      );
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="master-soundboard-panel">
      {/* DECK DE CONTROLE DOS SOUND BOARDS (CAMADA INDEPENDENTE DA OST) */}
      <div
        className={`p-4 sm:p-5 bg-[#0b0b10] border transition-colors relative overflow-hidden shadow-[0_14px_35px_rgba(0,0,0,0.85)] ${
          activeCount > 0 ? "border-blood-red/60" : "border-[#252530]"
        }`}
      >
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-200 ${
            activeCount > 0
              ? "bg-gradient-to-r from-transparent via-blood-red to-transparent opacity-100"
              : "bg-[#252530] opacity-50"
          }`}
        />

        {/* Topo do Deck: Status + Ações de Adição */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-4 border-b border-[#1c1c25]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              data-testid="soundboard-status-badge"
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
                activeCount > 0
                  ? "bg-blood-red/20 border-blood-red/60 text-red-300"
                  : "bg-[#14141c] border-[#2a2a36] text-gray-500"
              }`}
            >
              <span className="relative flex w-2 h-2 items-center justify-center">
                {activeCount > 0 && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/75 animate-ping" />
                )}
                <span
                  className={`relative inline-flex w-1.5 h-1.5 rounded-full ${
                    activeCount > 0 ? "bg-red-500" : "bg-gray-600"
                  }`}
                />
              </span>
              {activeCount > 0 ? `ATIVO (${activeCount})` : "PRONTO"}
            </span>

            <span className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">
              SOUND BOARDS • EFEITOS
            </span>

            {isOstPlaying && (
              <span
                data-testid="soundboard-ost-layer-badge"
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#12121a] border border-[#2a2a36] text-gray-400"
              >
                OST EM CAMADA PARALELA
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/aac,audio/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="soundboard-upload-btn"
              className="min-h-[38px] bg-blood-red hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-transform duration-150 transform-gpu active:scale-95 cursor-pointer touch-manipulation"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploading ? "Enviando..." : "Upload"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setShowAddLink(true);
              }}
              data-testid="soundboard-add-link-btn"
              className="min-h-[38px] bg-[#161620] hover:bg-[#1f1f2d] border border-[#2d2d3a] text-gray-200 hover:text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-transform duration-150 transform-gpu active:scale-95 cursor-pointer touch-manipulation"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link</span>
            </button>
          </div>
        </div>

        {/* Controles Gerais: Volume Independente + Parar Todos + Limite Simultâneo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Volume Geral dos Sound Boards */}
          <div className="flex items-center gap-3 flex-1 bg-[#08080c] border border-[#1e1e28] px-3 py-2">
            <button
              type="button"
              onClick={toggleMasterMute}
              title={
                snapshot.masterVolume > 0
                  ? "Silenciar Sound Boards"
                  : "Restaurar volume dos Sound Boards"
              }
              aria-label={
                snapshot.masterVolume > 0
                  ? "Silenciar Sound Boards"
                  : "Restaurar volume dos Sound Boards"
              }
              className="text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {snapshot.masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-blood-red" />
              ) : (
                <Volume2 className="w-4 h-4 text-blood-red" />
              )}
            </button>

            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                <span>Volume Geral dos Efeitos</span>
                <span
                  data-testid="soundboard-master-volume-label"
                  className="text-white font-bold tabular-nums"
                >
                  {masterVolumePercent}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={snapshot.masterVolume}
                onChange={(e) =>
                  soundBoard.setMasterVolume(parseFloat(e.target.value))
                }
                aria-label="Volume geral dos Sound Boards"
                data-testid="soundboard-master-volume"
                className="w-full h-1.5 accent-blood-red cursor-pointer touch-manipulation"
              />
            </div>
          </div>

          {/* Ação Parar Todos + Contador de Simultâneos */}
          <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0">
            <div
              data-testid="soundboard-active-counter"
              className="px-3 py-2 bg-[#08080c] border border-[#1e1e28] text-[11px] uppercase tracking-wider text-gray-400 flex items-center gap-2"
            >
              <span className="text-gray-500">CANAIS:</span>
              <span
                className={`font-bold tabular-nums ${
                  activeCount > 0 ? "text-red-300" : "text-gray-300"
                }`}
              >
                {activeCount} / {snapshot.maxConcurrent}
              </span>
            </div>

            <button
              type="button"
              onClick={() => soundBoard.stopAll()}
              disabled={activeCount === 0}
              data-testid="soundboard-stop-all"
              className={`min-h-[42px] px-4 py-2 border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 transform-gpu active:scale-95 touch-manipulation ${
                activeCount > 0
                  ? "bg-blood-red/20 hover:bg-blood-red text-red-200 hover:text-white border-blood-red cursor-pointer shadow-[0_0_15px_rgba(143,23,28,0.28)]"
                  : "bg-[#12121a] border-[#252530] text-gray-600 cursor-not-allowed"
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar Todos</span>
            </button>
          </div>
        </div>
      </div>

      {/* ALERTA DE ERRO */}
      {displayError && (
        <div className="p-3 bg-red-950/60 border border-blood-red text-red-200 text-xs flex items-center justify-between gap-3">
          <span>{displayError}</span>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              soundBoard.clearError();
            }}
            aria-label="Fechar aviso"
            className="p-1 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GRADE DE CARDS QUADRADOS DOS EFEITOS SONOROS */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1c1c25]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            <Radio className="w-3.5 h-3.5 text-blood-red" />
            <span>
              Efeitos Sonoros{" "}
              <span className="text-gray-500">({snapshot.effects.length})</span>
            </span>
          </div>

          {snapshot.effects.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar efeitos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="soundboard-search"
                className="w-full min-h-[38px] bg-[#0c0c12] border border-[#22222c] pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blood-red"
              />
            </div>
          )}
        </div>

        {filteredEffects.length === 0 ? (
          <div className="text-center py-12 px-4 bg-[#0b0b10] border border-dashed border-[#242430] text-gray-500">
            <Volume2 className="w-7 h-7 mx-auto mb-2.5 opacity-30" />
            <p className="text-xs uppercase tracking-wider font-bold text-gray-400">
              {snapshot.effects.length === 0
                ? "Nenhum efeito no Sound Board"
                : "Nenhum efeito encontrado"}
            </p>
            <p className="text-[11px] font-sans text-gray-500 mt-1 max-w-md mx-auto">
              {snapshot.effects.length === 0
                ? "Envie arquivos de áudio ou adicione links diretos para disparar impactos, portas, trovões e ruídos sem interromper a OST."
                : "Ajuste o termo de busca para localizar o efeito desejado."}
            </p>
          </div>
        ) : (
          <div
            data-testid="soundboard-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          >
            {filteredEffects.map((effect) => {
              const isPlaying = activeSet.has(effect.id);
              const isFading = fadingSet.has(effect.id);
              const effectVolumePercent = Math.round(effect.volume * 100);

              return (
                <div
                  key={effect.id}
                  data-testid={`sfx-card-${effect.id}`}
                  data-playing={isPlaying ? "true" : "false"}
                  className={`relative flex flex-col justify-between min-h-[192px] sm:aspect-square border overflow-hidden transition-colors duration-150 ${
                    isPlaying
                      ? "bg-[#170c10] border-blood-red/85 shadow-[0_0_20px_rgba(143,23,28,0.25)]"
                      : "bg-[#0c0c12] border-[#22222c] hover:border-[#363646]"
                  }`}
                >
                  {/* Barra superior de destaque quando em reprodução */}
                  <div
                    className={`h-[2px] w-full shrink-0 transition-opacity duration-150 ${
                      isPlaying
                        ? "bg-blood-red opacity-100"
                        : "bg-transparent opacity-0"
                    }`}
                  />

                  {/* Cabeçalho do Card: Indicador de Reprodução / Origem + Ações */}
                  <div className="flex items-center justify-between gap-1 px-2.5 pt-2">
                    {isPlaying ? (
                      <span
                        data-testid={`sfx-playing-badge-${effect.id}`}
                        className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-red-300"
                      >
                        <span className="inline-flex items-end gap-[2px] h-2.5">
                          <span className="w-[2px] h-2.5 bg-red-400 animate-pulse" />
                          <span className="w-[2px] h-1.5 bg-blood-red animate-pulse" />
                          <span className="w-[2px] h-2 bg-red-400 animate-pulse" />
                        </span>
                        <span>{isFading ? "FADE" : "TOCANDO"}</span>
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest text-gray-500">
                        {effect.source === "upload" ? "STORAGE" : "LINK"}
                      </span>
                    )}

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(effect)}
                        title="Renomear ou alterar ícone"
                        aria-label={`Editar ${effect.name}`}
                        data-testid={`sfx-edit-${effect.id}`}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1a1a24] transition-colors cursor-pointer touch-manipulation"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(effect)}
                        title="Remover efeito"
                        aria-label={`Remover ${effect.name}`}
                        data-testid={`sfx-delete-${effect.id}`}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-[#1a1a24] transition-colors cursor-pointer touch-manipulation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Corpo Principal Clicável (Dispara ou Reinicia do Início) */}
                  <button
                    type="button"
                    onClick={() => soundBoard.playEffect(effect)}
                    data-testid={`sfx-play-${effect.id}`}
                    aria-label={
                      isPlaying
                        ? `Reiniciar ${effect.name}`
                        : `Tocar ${effect.name}`
                    }
                    className="flex-1 flex flex-col items-center justify-center gap-2 px-3 py-2 text-center cursor-pointer touch-manipulation transform-gpu active:scale-[0.97] transition-transform duration-150 focus:outline-none group"
                  >
                    <div
                      className={`w-11 h-11 flex items-center justify-center border transition-colors duration-150 ${
                        isPlaying
                          ? "bg-blood-red text-white border-blood-red shadow-[0_0_14px_rgba(143,23,28,0.55)]"
                          : "bg-[#14141e] border-[#2b2b38] text-gray-300 group-hover:border-blood-red/70 group-hover:text-white"
                      }`}
                    >
                      <SoundBoardIcon icon={effect.icon} className="w-5 h-5" />
                    </div>

                    <span className="text-xs font-bold text-white leading-snug line-clamp-2 break-words w-full">
                      {effect.name}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border transition-colors ${
                        isPlaying
                          ? "bg-blood-red/25 border-blood-red/70 text-red-200"
                          : "bg-[#12121a] border-[#252532] text-gray-400 group-hover:text-white group-hover:border-blood-red/50"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Reiniciar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Tocar</span>
                        </>
                      )}
                    </span>
                  </button>

                  {/* Rodapé do Card: Volume Individual + Stop Pontual */}
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-2 border-t border-[#1c1c26] bg-[#08080d]">
                    <Volume2 className="w-3 h-3 text-gray-500 shrink-0 hidden sm:block" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={effect.volume}
                      onChange={(e) =>
                        soundBoard.setEffectVolume(
                          effect.id,
                          parseFloat(e.target.value),
                        )
                      }
                      aria-label={`Volume de ${effect.name}`}
                      data-testid={`sfx-volume-${effect.id}`}
                      className="flex-1 min-w-0 h-1.5 accent-blood-red cursor-pointer touch-manipulation"
                    />
                    <span className="text-[10px] text-gray-400 w-7 text-right tabular-nums shrink-0">
                      {effectVolumePercent}%
                    </span>
                    {isPlaying && (
                      <button
                        type="button"
                        onClick={() => soundBoard.stopEffect(effect.id)}
                        title={`Parar ${effect.name}`}
                        aria-label={`Parar ${effect.name}`}
                        data-testid={`sfx-stop-${effect.id}`}
                        className="w-6 h-6 flex items-center justify-center bg-[#181014] hover:bg-blood-red border border-blood-red/60 text-red-200 hover:text-white transition-colors cursor-pointer shrink-0 touch-manipulation"
                      >
                        <Square className="w-2.5 h-2.5 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADICIONAR EFEITO POR LINK DIRETO */}
      <AnimatePresence>
        {showAddLink && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowAddLink(false)}
          >
            <MotionSheetPanel
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[#101016]/95 border-t sm:border border-[#2b2b38] shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative"
            >
              <form
                onSubmit={handleAddLinkSubmit}
                style={{
                  paddingBottom:
                    "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
                }}
                className="p-5 flex flex-col gap-4 relative"
              >
                <div className="h-[2px] w-full bg-blood-red absolute top-0 left-0" />
                <div className="sm:hidden flex justify-center -mt-1 pb-1">
                  <div className="w-10 h-1 bg-[#323442]" />
                </div>

                <div className="flex items-center justify-between text-xs text-white font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-blood-red" />
                    Adicionar Efeito Sonoro
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
                    placeholder="Nome do efeito (ex: Trovão Distante)"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    autoFocus
                    data-testid="sfx-link-name-input"
                    className="w-full min-h-[44px] bg-[#08080c] border border-[#262632] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blood-red"
                  />
                  <input
                    type="text"
                    required
                    placeholder="URL direta do áudio (.mp3, .wav, .ogg)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    data-testid="sfx-link-url-input"
                    className="w-full min-h-[44px] bg-[#08080c] border border-[#262632] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blood-red"
                  />

                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                      Ícone do Card
                    </span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {SOUND_BOARD_ICON_OPTIONS.map((opt) => {
                        const selected = linkIcon === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLinkIcon(opt.id)}
                            title={opt.label}
                            aria-label={opt.label}
                            data-testid={`sfx-icon-opt-${opt.id}`}
                            className={`h-10 flex items-center justify-center border transition-colors cursor-pointer ${
                              selected
                                ? "bg-blood-red/25 border-blood-red text-white"
                                : "bg-[#0a0a0f] border-[#252530] text-gray-400 hover:text-white hover:border-[#3c3c4c]"
                            }`}
                          >
                            <SoundBoardIcon icon={opt.id} className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddLink(false)}
                    className="flex-1 min-h-[44px] bg-[#16161f] hover:bg-[#222230] border border-[#2c2c38] text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer touch-manipulation"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingLink}
                    data-testid="sfx-link-submit-btn"
                    className="flex-1 min-h-[44px] bg-blood-red hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                  >
                    {isAddingLink && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              </form>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR (RENOMEAR + ÍCONE) */}
      <AnimatePresence>
        {editingEffect && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setEditingEffect(null)}
          >
            <MotionSheetPanel
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[#101016]/95 border-t sm:border border-[#2b2b38] shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative"
            >
              <form
                onSubmit={handleSaveEdit}
                style={{
                  paddingBottom:
                    "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
                }}
                className="p-5 flex flex-col gap-4 relative"
              >
                <div className="h-[2px] w-full bg-blood-red absolute top-0 left-0" />
                <div className="sm:hidden flex justify-center -mt-1 pb-1">
                  <div className="w-10 h-1 bg-[#323442]" />
                </div>

                <div className="flex items-center justify-between text-xs text-white font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-blood-red" />
                    Editar Efeito Sonoro
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingEffect(null)}
                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do efeito"
                    autoFocus
                    data-testid="sfx-edit-name-input"
                    className="w-full min-h-[44px] bg-[#08080c] border border-[#262632] px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blood-red"
                  />

                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                      Ícone do Card
                    </span>
                    <div className="grid grid-cols-6 gap-1.5">
                      {SOUND_BOARD_ICON_OPTIONS.map((opt) => {
                        const selected = editIcon === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setEditIcon(opt.id)}
                            title={opt.label}
                            aria-label={opt.label}
                            className={`h-10 flex items-center justify-center border transition-colors cursor-pointer ${
                              selected
                                ? "bg-blood-red/25 border-blood-red text-white"
                                : "bg-[#0a0a0f] border-[#252530] text-gray-400 hover:text-white hover:border-[#3c3c4c]"
                            }`}
                          >
                            <SoundBoardIcon icon={opt.id} className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingEffect(null)}
                    className="flex-1 min-h-[44px] bg-[#16161f] hover:bg-[#222230] border border-[#2c2c38] text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer touch-manipulation"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editName.trim()}
                    data-testid="sfx-edit-submit-btn"
                    className="flex-1 min-h-[44px] bg-blood-red hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                  >
                    {isSavingEdit && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              </form>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO */}
      <AnimatePresence>
        {deleteTarget && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <MotionSheetPanel
              className="w-full sm:max-w-sm bg-[#101016]/95 border-t sm:border border-[#2b2b38] rounded-none p-5 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative overflow-hidden"
              style={{
                paddingBottom:
                  "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
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
                    Apagar Efeito Sonoro?
                  </h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {deleteTarget.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#9a9aa6] leading-relaxed mb-5 border-b border-[#1e1e28] pb-3.5 font-sans">
                Deseja realmente remover este efeito do Sound Board da mesa?
              </p>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 min-h-[44px] bg-[#16161f] hover:bg-[#222230] active:scale-95 border border-[#2c2c38] text-gray-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 transition-all cursor-pointer touch-manipulation"
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  data-testid="sfx-delete-confirm-btn"
                  className="flex-1 min-h-[44px] bg-blood-red hover:bg-red-700 active:scale-95 border border-blood-red text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 px-4 transition-all shadow-[0_0_15px_rgba(143,23,28,0.4)] cursor-pointer touch-manipulation"
                >
                  Sim
                </button>
              </div>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>
    </div>
  );
}
