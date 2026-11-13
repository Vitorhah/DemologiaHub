import React, { useState, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  HANDOUT_TYPE_META,
  HANDOUT_VISIBILITY_META,
  HandoutItem,
} from "../types/handouts";
import { AnimatePresence, motion } from "motion/react";
import {
  CLINICAL_EASE,
  MotionModalBackdrop,
  MotionSheetPanel,
  SNAPPY_SPRING,
} from "./MotionPrimitives";

interface HandoutViewerModalProps {
  handout: HandoutItem | null;
  isMestre: boolean;
  folderName?: string | null;
  onClose: () => void;
  onToggleRevealSecret?: (handoutId: string) => void;
  onEdit?: (handout: HandoutItem) => void;
}

export const HandoutViewerModal: React.FC<HandoutViewerModalProps> = ({
  handout,
  isMestre,
  folderName,
  onClose,
  onToggleRevealSecret,
  onEdit,
}) => {
  const [showingBack, setShowingBack] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setShowingBack(false);
    setZoom(1);
    setIsFullscreen(false);
  }, [handout?.id]);

  useEffect(() => {
    if (!handout) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handout, isFullscreen, onClose]);

  const typeMeta = handout
    ? HANDOUT_TYPE_META[handout.type] || HANDOUT_TYPE_META.documento
    : HANDOUT_TYPE_META.documento;
  const visMeta = handout
    ? HANDOUT_VISIBILITY_META[handout.visibility] || HANDOUT_VISIBILITY_META.private
    : HANDOUT_VISIBILITY_META.private;

  const activeText = handout ? (showingBack ? handout.backText : handout.content) : "";
  const activeImage = handout ? (showingBack ? handout.backImageUrl : handout.imageUrl) : "";

  const hasSecretContent = Boolean(
    handout &&
      ((handout.secretText && handout.secretText.trim()) ||
        (handout.secretImageUrl && handout.secretImageUrl.trim()))
  );
  const showSecretSection = Boolean(
    handout && (isMestre ? hasSecretContent : handout.secretRevealed && hasSecretContent)
  );

  const handleZoomIn = () => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleZoomReset = () => setZoom(1);

  return (
    <AnimatePresence>
      {handout && (
        <MotionModalBackdrop
          className={`fixed inset-0 z-[320] flex items-center justify-center ${
            isFullscreen ? "p-0" : "p-0 sm:p-4"
          }`}
          onClick={onClose}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-label={`Visualizador de Handout: ${handout.title}`}
            onClick={(e) => e.stopPropagation()}
            className={`bg-[#0b0b0f] border border-[#242430] shadow-[0_24px_70px_rgba(0,0,0,0.92)] flex flex-col relative overflow-hidden font-mono ${
              isFullscreen
                ? "w-full h-[100dvh] rounded-none border-0"
                : "w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] rounded-none"
            }`}
          >
            <div className="h-[2px] w-full bg-[var(--op-red-bright)] shrink-0" />

        {/* TOP HEADER */}
        <header className="px-4 py-3 bg-[#0e0e14] border-b border-[#1e1e28] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-[#8e90a0]">
              <span className={`font-bold ${typeMeta.accentClass}`}>
                {typeMeta.shortLabel}
              </span>
              {folderName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{folderName}</span>
                </>
              )}
              {isMestre && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={visMeta.colorClass}>{visMeta.shortLabel}</span>
                </>
              )}
              {handout.hasBackSide && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300">
                    {showingBack ? "Verso / Costas" : "Frente"}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider truncate mt-0.5">
              {handout.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {handout.hasBackSide && (
              <button
                type="button"
                onClick={() => {
                  setShowingBack((prev) => !prev);
                  setZoom(1);
                }}
                className="min-h-[38px] px-3 py-1.5 bg-[#181822] hover:bg-[#242432] text-amber-300 border border-amber-500/40 rounded-none text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
              >
                <RotateCw size={13} />
                <span>{showingBack ? "Ver Frente" : "Virar Papel (Ver Costas)"}</span>
              </button>
            )}

            {activeImage && (
              <div className="hidden sm:flex items-center bg-[#121218] border border-[#242430] p-0.5">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-8 h-8 flex items-center justify-center text-[#9ca3af] hover:text-white cursor-pointer"
                  title="Diminuir zoom"
                  aria-label="Diminuir zoom"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="px-2 h-8 text-[10px] font-bold text-zinc-200 hover:text-white tabular-nums cursor-pointer"
                  title="Resetar zoom (100%)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-8 h-8 flex items-center justify-center text-[#9ca3af] hover:text-white cursor-pointer"
                  title="Aumentar zoom"
                  aria-label="Aumentar zoom"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="w-8 h-8 flex items-center justify-center text-[#9ca3af] hover:text-white cursor-pointer border-l border-[#242430]"
                  title="Redefinir visualização"
                  aria-label="Redefinir zoom"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e2a] text-[#9ca3af] hover:text-white border border-[#242430] cursor-pointer transition-colors"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              aria-label={isFullscreen ? "Sair da tela cheia" : "Modo tela cheia"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {isMestre && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(handout);
                }}
                className="min-h-[38px] px-3 bg-[#14141c] hover:bg-[#1e1e2a] text-zinc-200 border border-[#242430] text-[11px] uppercase tracking-wider cursor-pointer"
              >
                Editar
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualizador"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#14141c] hover:bg-red-950/50 text-[#9ca3af] hover:text-white border border-[#242430] hover:border-red-700/60 cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* MOBILE ZOOM BAR (if image active) */}
        {activeImage && (
          <div className="sm:hidden px-4 py-2 bg-[#0c0c12] border-b border-[#1c1c26] flex items-center justify-between gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
              Zoom da Imagem
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleZoomOut}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#14141c] border border-[#242430] text-zinc-200 cursor-pointer"
                aria-label="Diminuir zoom"
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="min-h-[36px] px-2.5 bg-[#14141c] border border-[#242430] text-[11px] font-bold text-white tabular-nums cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-[#14141c] border border-[#242430] text-zinc-200 cursor-pointer"
                aria-label="Aumentar zoom"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        )}

        {/* CONTENT BODY */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#08080c]"
          style={{
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))",
          }}
        >
          {handout.description && !showingBack && (
            <p className="text-xs text-[#9ca3af] font-sans leading-relaxed border-b border-[#1a1a24] pb-3">
              {handout.description}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={showingBack ? "back" : "front"}
              initial={{ opacity: 0, scale: 0.985, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: -6 }}
              transition={{ duration: 0.18, ease: CLINICAL_EASE }}
              className="space-y-5"
            >
              {/* SIDE HEADER INDICATOR */}
              {handout.hasBackSide && (
                <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-amber-300/90 bg-[#141218] border border-amber-500/25 px-3 py-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <FileText size={13} />
                    {showingBack ? "Lado B — Costas do Papel / Verso" : "Lado A — Frente do Documento"}
                  </span>
                  <span className="text-[10px] text-[#8e90a0]">
                    {showingBack ? "Verso" : "Frente"}
                  </span>
                </div>
              )}

              {/* IMAGE VIEWER WITH ZOOM */}
              {activeImage && (
                <div className="bg-[#050507] border border-[#1e1e28] overflow-auto max-h-[62dvh] flex items-center justify-center p-3">
                  <motion.img
                    src={activeImage}
                    alt={`${handout.title} (${showingBack ? "Verso" : "Frente"})`}
                    referrerPolicy="no-referrer"
                    animate={{ scale: zoom }}
                    transition={SNAPPY_SPRING}
                    style={{
                      transformOrigin: "center center",
                    }}
                    className="max-w-full max-h-[56dvh] object-contain select-none"
                  />
                </div>
              )}

              {/* DOCUMENT / TEXT CONTENT */}
              {activeText && (
                <div className="bg-[#101016] border border-[#22222c] p-4 sm:p-5">
                  <div className="text-sm text-[#e4e4ec] font-sans leading-relaxed whitespace-pre-wrap select-text">
                    {activeText}
                  </div>
                </div>
              )}

              {!activeImage && !activeText && (
                <div className="py-10 text-center border border-dashed border-[#22222c] text-xs text-[#787989]">
                  <ImageIcon size={24} className="mx-auto mb-2 opacity-50" />
                  {showingBack
                    ? "Nenhum conteúdo registrado nas costas deste material."
                    : "Nenhum conteúdo textual ou visual na frente deste material."}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* SECRET REVELATION SECTION */}
          {showSecretSection && (
            <div
              className={`border p-4 sm:p-5 space-y-3 ${
                handout.secretRevealed
                  ? "bg-[#1a090d] border-[var(--op-red-bright)]/60"
                  : "bg-[#121016] border-amber-500/45"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  {handout.secretRevealed ? (
                    <Unlock size={15} className="text-emerald-400" />
                  ) : (
                    <Lock size={15} className="text-amber-400" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Informação Oculta / Segredo
                  </span>
                  {isMestre && (
                    <span
                      className={`text-[10px] uppercase font-bold ${
                        handout.secretRevealed ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      · {handout.secretRevealed ? "Revelado aos Jogadores" : "Oculto dos Jogadores"}
                    </span>
                  )}
                </div>

                {isMestre && onToggleRevealSecret && (
                  <button
                    type="button"
                    onClick={() => onToggleRevealSecret(handout.id)}
                    className={`min-h-[36px] px-3 py-1 text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer transition-colors ${
                      handout.secretRevealed
                        ? "bg-[#181822] hover:bg-[#242432] text-zinc-200 border-zinc-600"
                        : "bg-[#8f171c] hover:bg-[#b81d24] text-white border-[#ff8085]/50"
                    }`}
                  >
                    {handout.secretRevealed ? (
                      <>
                        <EyeOff size={13} />
                        <span>Ocultar Segredo</span>
                      </>
                    ) : (
                      <>
                        <Eye size={13} />
                        <span>Revelar para Jogadores</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {handout.secretImageUrl && (
                <div className="bg-black/60 border border-white/10 p-2 flex justify-center">
                  <img
                    src={handout.secretImageUrl}
                    alt="Segredo do Handout"
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[40dvh] object-contain"
                  />
                </div>
              )}

              {handout.secretText && (
                <div className="text-sm text-white font-sans leading-relaxed whitespace-pre-wrap select-text">
                  {handout.secretText}
                </div>
              )}
            </div>
          )}

          {/* MASTER HINT WHEN SECRET NOT YET FILLED */}
          {isMestre && !hasSecretContent && (
            <div className="text-[11px] text-[#6e7080] border-t border-[#181822] pt-3">
              Este handout não possui segredo oculto configurado.
            </div>
          )}
        </div>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
