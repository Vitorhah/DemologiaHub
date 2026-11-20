import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { X, Send, Check, Loader2, AlertTriangle } from "lucide-react";
import {
  MASTER_LIBRARY_TYPE_META,
  MasterLibraryItem,
} from "../types/masterLibrary";
import { MasterDataPushPayload } from "../types/masterDataPush";
import {
  buildPushPayloadFromLibraryItem,
  getLibraryItemDescription,
  getLibraryItemName,
} from "../utils/masterLibrary";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

export interface LibraryPlayerTarget {
  id: string;
  name?: string;
}

export interface MasterLibrarySendModalProps {
  item: MasterLibraryItem | null;
  players: LibraryPlayerTarget[];
  isSending: boolean;
  onClose: () => void;
  onSendToPlayers: (
    targetPlayerIds: string[],
    payload: MasterDataPushPayload
  ) => Promise<{ ok: boolean; updatedCount: number; error?: string }>;
  onSuccessFeedback?: (message: string) => void;
}

export const MasterLibrarySendModal: React.FC<MasterLibrarySendModalProps> = ({
  item,
  players,
  isSending,
  onClose,
  onSendToPlayers,
  onSuccessFeedback,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setSelectedIds([]);
    setErrorMsg(null);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, isSending, onClose]);

  const validPlayerIdsSet = useMemo(
    () => new Set(players.map((p) => p.id)),
    [players]
  );

  const effectiveSelected = useMemo(
    () => selectedIds.filter((id) => validPlayerIdsSet.has(id)),
    [selectedIds, validPlayerIdsSet]
  );

  const togglePlayer = (playerId: string) => {
    setErrorMsg(null);
    setSelectedIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || isSending) return;
    setErrorMsg(null);

    if (effectiveSelected.length === 0) {
      setErrorMsg("Selecione pelo menos um jogador destinatário.");
      return;
    }

    const payload = buildPushPayloadFromLibraryItem(item);
    const res = await onSendToPlayers(effectiveSelected, payload);
    if (!res.ok) {
      setErrorMsg(res.error || "Não foi possível enviar o arquivo aos jogadores.");
      return;
    }

    const meta = MASTER_LIBRARY_TYPE_META[item.type];
    const names = players
      .filter((p) => effectiveSelected.includes(p.id))
      .map((p) => p.name || p.id.slice(0, 6))
      .join(", ");

    onSuccessFeedback?.(
      `${meta.label} "${getLibraryItemName(item)}" enviado para: ${names}. O arquivo permanece salvo na Biblioteca.`
    );
    onClose();
  };

  const meta = item ? MASTER_LIBRARY_TYPE_META[item.type] : null;
  const itemName = item ? getLibraryItemName(item) : "";
  const itemDesc = item ? getLibraryItemDescription(item) : "";

  return (
    <AnimatePresence>
      {item && meta && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[370] flex items-end sm:items-center justify-center p-0 sm:p-4 font-mono"
          onClick={() => {
            if (!isSending) onClose();
          }}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-library-send-title"
            data-testid="master-library-send-modal"
            className="w-full sm:max-w-lg max-h-[86dvh] bg-[#0c0c10] border-t sm:border border-[#282834] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex flex-col min-h-0 overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-[var(--op-red)] shrink-0" />

            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-b border-[#202028] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3
                  id="master-library-send-title"
                  className="text-sm font-bold text-white uppercase tracking-wider truncate"
                >
                  Enviar {meta.label} aos Jogadores
                </h3>
                <p className="text-[11px] text-[#8c8d9c] mt-0.5 truncate">
                  O arquivo continuará salvo permanentemente na Biblioteca.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                aria-label="Fechar janela de envio"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white hover:bg-white/[0.05] cursor-pointer touch-manipulation shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Item summary */}
                <div className="bg-[#09090d] border border-[#22222c] p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#1d0a0d] border border-[#8f171c]/60 text-[#ff8a90]">
                      {meta.shortTag}
                    </span>
                    <span className="text-xs font-bold text-white uppercase truncate">
                      {itemName}
                    </span>
                  </div>
                  {itemDesc && (
                    <p className="text-[11px] text-[#9b9caa] line-clamp-2">
                      {itemDesc}
                    </p>
                  )}
                  <p className="text-[10px] text-[#787989] pt-1">
                    {item.type === "ritual" &&
                      "Será adicionado na seção Rituais da ficha dos jogadores selecionados."}
                    {item.type === "skill" &&
                      "Será adicionada na seção Habilidades (Skills) dos jogadores selecionados."}
                    {item.type === "pdi" &&
                      "Será adicionado na seção PDI (Poderes de Intenção) dos jogadores selecionados."}
                    {item.type === "tributo" &&
                      "Atualizará o Tributo na ficha dos jogadores selecionados."}
                  </p>
                </div>

                {/* Player picker */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#d4d4d8] font-bold">
                      Jogadores Destinatários ({effectiveSelected.length})
                    </span>
                    {players.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setSelectedIds(players.map((p) => p.id));
                          }}
                          className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-[#2c2c38] bg-[#121218] hover:bg-[#1b1b24] text-[#d4d4d8] cursor-pointer"
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedIds([])}
                          className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-[#2c2c38] bg-[#121218] hover:bg-[#1b1b24] text-[#9ca3af] cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>

                  {players.length === 0 ? (
                    <div className="border border-dashed border-[#2b2b36] bg-[#09090d] p-4 text-xs text-[#787989] text-center">
                      Nenhum jogador conectado no momento.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const nameCounts = new Map<string, number>();
                        players.forEach((pl) => {
                          const key = (pl.name || "").trim().toLowerCase();
                          if (key) nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
                        });
                        return players.map((p) => {
                          const checked = effectiveSelected.includes(p.id);
                          const cleanName = (p.name || "").trim();
                          const isDup =
                            cleanName.length > 0 &&
                            (nameCounts.get(cleanName.toLowerCase()) || 0) > 1;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              data-send-player-id={p.id}
                              onClick={() => togglePlayer(p.id)}
                              aria-pressed={checked}
                              className={`min-h-[44px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer touch-manipulation transition-colors ${
                                checked
                                  ? "bg-[#1a0b0e] border-[#b52a30] text-white font-bold"
                                  : "bg-[#101016] border-[#262632] hover:border-[#3c3c4a] text-[#a1a1aa]"
                              }`}
                            >
                              <span
                                className={`w-4 h-4 border flex items-center justify-center ${
                                  checked
                                    ? "border-[#ff8085] bg-[#8f171c]/40 text-white"
                                    : "border-[#3f3f46]"
                                }`}
                              >
                                {checked && <Check size={11} />}
                              </span>
                              <span>{p.name || p.id.slice(0, 8)}</span>
                              {isDup && (
                                <span className="text-[10px] text-[#71717a] font-normal">
                                  #{p.id.slice(0, 4)}
                                </span>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mx-4 sm:mx-5 mb-2 px-3 py-2.5 text-xs border bg-red-950/45 border-red-700/60 text-red-300 flex items-center gap-2 shrink-0"
                >
                  <AlertTriangle size={14} className="shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Footer */}
              <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-t border-[#202028] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="min-h-[44px] px-5 py-2.5 bg-[#14141c] hover:bg-[#1e1e28] border border-[#2c2c38] text-[#9ca3af] hover:text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer touch-manipulation"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending || players.length === 0}
                  className="min-h-[44px] px-6 py-2.5 bg-[#8f171c] hover:bg-[#a91c22] disabled:opacity-50 border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-colors"
                >
                  {isSending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>
                    {isSending
                      ? "Enviando..."
                      : effectiveSelected.length > 0
                        ? `Enviar (${effectiveSelected.length})`
                        : "Enviar aos Selecionados"}
                  </span>
                </button>
              </div>
            </form>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
