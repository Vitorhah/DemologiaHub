import React, { useState, useMemo } from "react";
import {
  Music,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Trash2,
  Search,
  FileAudio,
} from "lucide-react";

export interface MasterOstPanelProps {
  ostList: any[];
  globalOstState: any;
  setGlobalOstState: (state: any) => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  requiresInteraction: boolean;
  setRequiresInteraction?: (val: boolean) => void;
  fetchOsts: () => void;
  supabase: any;
  globalChannelRef: React.MutableRefObject<any>;
}

export function MasterOstPanel({
  ostList,
  globalOstState,
  setGlobalOstState,
  audioRef,
  requiresInteraction,
  fetchOsts,
  supabase,
  globalChannelRef,
}: MasterOstPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredOsts = useMemo(() => {
    if (!searchTerm.trim()) return ostList;
    const term = searchTerm.toLowerCase();
    return ostList.filter((ost) => {
      const rawName = ost.id.split("_").slice(3).join("_");
      const ostName = decodeURIComponent(rawName).toLowerCase();
      return ostName.includes(term);
    });
  }, [ostList, searchTerm]);

  const broadcastMasterState = async (stateData: any) => {
    setGlobalOstState(stateData);
    await supabase.from("players").upsert({
      id: "MASTER_STATE",
      data: { ost: stateData },
      updated_at: new Date().toISOString(),
    });
    globalChannelRef.current?.send({
      type: "broadcast",
      event: "ost_update",
      payload: stateData,
    }).catch(console.error);
  };

  const handlePlayToggle = () => {
    const isPlaying = !globalOstState?.isPlaying;
    const stateData = {
      ...globalOstState,
      isPlaying,
    };
    broadcastMasterState(stateData);
  };

  const handleReset = () => {
    const stateData = {
      ...globalOstState,
      resetTimestamp: Date.now(),
    };
    broadcastMasterState(stateData);
  };

  const handleSelectTrack = (ost: any) => {
    const rawName = ost.id.split("_").slice(3).join("_");
    const ostName = decodeURIComponent(rawName);
    const stateData = {
      ostId: ost.id,
      name: ostName,
      isPlaying: true,
      volume: globalOstState?.volume ?? 1,
    };
    broadcastMasterState(stateData);
  };

  const handleDelete = async (ostId: string) => {
    await supabase.from("players").delete().eq("id", ostId);
    if (globalOstState?.ostId === ostId) {
      const stateData = {
        ostId: null,
        name: "",
        isPlaying: false,
        volume: globalOstState?.volume ?? 1,
      };
      broadcastMasterState(stateData);
    }
    fetchOsts();
    setDeleteConfirmId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      alert("Arquivo muito grande. O limite máximo é 2.5 MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const cleanFileName = encodeURIComponent(file.name.replace(/\.[^/.]+$/, ""));
      const ostId = `GLOBAL_OST_${Date.now()}_${cleanFileName}`;

      await supabase.from("players").upsert({
        id: ostId,
        data: { base64, name: file.name },
        updated_at: new Date().toISOString(),
      });
      fetchOsts();
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const currentVolume = globalOstState?.volume ?? 1;
  const isCurrentlyPlaying = !!(globalOstState?.isPlaying && globalOstState?.ostId);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 px-4 font-sans">
      {/* Player Principal */}
      <div className="bg-[#14151c] border border-[#262835] rounded-none p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222430]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-none flex items-center justify-center transition-colors ${
              isCurrentlyPlaying
                ? "bg-red-950/50 border border-red-900/60 text-red-400"
                : "bg-[#1c1d27] border border-[#2c2e3d] text-[#71717a]"
            }`}>
              <Music size={18} />
            </div>

            <div>
              <div className="text-[11px] text-[#8e8f9e] font-medium">
                {isCurrentlyPlaying ? "Tocando agora" : "Trilha Sonora"}
              </div>
              <h2 className="text-sm sm:text-base font-semibold text-white truncate max-w-md mt-0.5">
                {globalOstState?.name || "Nenhuma faixa selecionada"}
              </h2>
            </div>
          </div>

          {/* Controles de Reprodução */}
          <div className="flex items-center gap-2">
            {globalOstState?.ostId ? (
              <>
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white rounded-none text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {globalOstState?.isPlaying ? (
                    <>
                      <Pause size={14} /> Pausar
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Tocar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  title="Reiniciar do início"
                  className="p-2 bg-[#1c1d27] hover:bg-[#242633] border border-[#2c2e3d] text-[#a1a1aa] hover:text-white rounded-none transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} />
                </button>

                {globalOstState?.isPlaying && audioRef.current?.paused && !requiresInteraction && (
                  <button
                    type="button"
                    onClick={() => audioRef.current?.play().catch(console.error)}
                    className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 text-amber-300 rounded-none text-xs font-medium hover:bg-amber-900/50 transition-colors"
                  >
                    Tocar no navegador
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-[#71717a]">
                Selecione uma faixa abaixo
              </span>
            )}
          </div>
        </div>

        {/* Controle de Volume */}
        {globalOstState?.ostId && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#8e8f9e]">
              {currentVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span>Volume: {Math.round(currentVolume * 100)}%</span>
            </div>

            <div className="flex-1 max-w-xs flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentVolume}
                onChange={(e) => {
                  const newVol = Number(e.target.value);
                  setGlobalOstState((prev: any) => ({ ...prev, volume: newVol }));
                }}
                onPointerUp={(e) => {
                  const newVol = Number((e.target as HTMLInputElement).value);
                  const stateData = { ...globalOstState, volume: newVol };
                  broadcastMasterState(stateData);
                }}
                className="w-full accent-red-600 bg-[#1f212c] h-1.5 cursor-pointer rounded-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Busca e Upload */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:max-w-md relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            placeholder="Buscar faixa de áudio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#14151c] border border-[#262835] focus:border-red-600 text-xs text-white pl-9 pr-3.5 py-2.5 rounded-none outline-none transition-colors placeholder:text-[#52525b]"
          />
        </div>

        <label className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-none border text-xs font-medium transition-colors cursor-pointer ${
          isUploading
            ? "bg-[#1c1d27] border-red-800 text-red-400"
            : "bg-[#1c1d27] hover:bg-[#252735] border-[#2c2e3d] text-white"
        }`}>
          <Upload size={14} className="text-red-400" />
          <span>{isUploading ? "Enviando áudio..." : "Enviar áudio (.mp3)"}</span>
          <input
            type="file"
            accept=".mp3"
            className="hidden"
            disabled={isUploading}
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* Lista de Faixas */}
      <div className="bg-[#14151c] border border-[#262835] rounded-none overflow-hidden shadow-sm">
        <div className="divide-y divide-[#20222e]">
          {filteredOsts.length === 0 ? (
            <div className="py-12 text-center text-[#71717a] flex flex-col items-center justify-center gap-1.5">
              <FileAudio size={32} className="opacity-40 mb-1" />
              <p className="text-xs font-medium text-[#9a9ba8]">
                {searchTerm ? "Nenhuma faixa encontrada." : "Nenhuma música adicionada ainda."}
              </p>
              <p className="text-[11px] text-[#636472]">
                Envie arquivos de áudio .mp3 para tocar durante a sessão.
              </p>
            </div>
          ) : (
            filteredOsts.map((ost) => {
              const rawName = ost.id.split("_").slice(3).join("_");
              const ostName = decodeURIComponent(rawName) || "Faixa de Áudio";
              const isSelected = globalOstState?.ostId === ost.id;
              const isPlayingThis = isSelected && globalOstState?.isPlaying;

              return (
                <div
                  key={ost.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                    isSelected ? "bg-red-950/20" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 ${
                      isPlayingThis
                        ? "bg-red-950/60 text-red-400"
                        : "bg-[#1c1d27] text-[#71717a]"
                    }`}>
                      <Music size={14} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium truncate ${
                          isSelected ? "text-white" : "text-[#c4c4cc]"
                        }`}>
                          {ostName}
                        </span>
                        {isPlayingThis && (
                          <span className="text-[10px] text-red-400 font-medium bg-red-950/50 px-1.5 py-0.2 rounded-none">
                            Tocando
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected ? (
                      <button
                        type="button"
                        onClick={handlePlayToggle}
                        className={`px-3 py-1.5 text-xs font-medium rounded-none transition-colors cursor-pointer ${
                          isPlayingThis
                            ? "bg-[#242633] text-white"
                            : "bg-red-700 hover:bg-red-600 text-white"
                        }`}
                      >
                        {isPlayingThis ? "Pausar" : "Tocar"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectTrack(ost)}
                        className="px-3 py-1.5 text-xs font-medium text-[#c4c4cc] hover:text-white bg-[#1c1d27] hover:bg-[#252735] border border-[#2c2e3d] rounded-none transition-colors cursor-pointer"
                      >
                        Tocar
                      </button>
                    )}

                    {deleteConfirmId === ost.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(ost.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium rounded-none"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-[#242633] text-[#c4c4cc] text-[11px] rounded-none"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(ost.id)}
                        className="p-1.5 text-[#71717a] hover:text-red-400 hover:bg-red-950/30 rounded-none transition-colors cursor-pointer"
                        title="Excluir faixa"
                        aria-label="Excluir faixa"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
