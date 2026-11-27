import React, { useState, useEffect, useMemo } from "react";
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
  ScrollText,
  Monitor,
  Edit2,
} from "lucide-react";
import {
  HANDOUT_TYPE_META,
  HANDOUT_VISIBILITY_META,
  HandoutItem,
} from "../types/handouts";
import {
  HandoutReadingSurface,
  getDefaultHandoutReadingSurface,
  getHandoutAccessionCode,
} from "../utils/handoutRichText";
import { AnimatePresence, motion } from "motion/react";
import {
  CLINICAL_EASE,
  MotionModalBackdrop,
  MotionSheetPanel,
  SNAPPY_SPRING,
} from "./MotionPrimitives";
import { HandoutRichContent } from "./HandoutRichContent";
import { CreatureRichInlineText } from "./CreatureRichText";

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
  const [surface, setSurface] = useState<HandoutReadingSurface>("paper");
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setShowingBack(false);
    setZoom(1);
    setIsFullscreen(false);
    setImageError(false);
    if (handout) {
      setSurface(getDefaultHandoutReadingSurface(handout.type));
    }
  }, [handout?.id, handout?.type]);

  useEffect(() => {
    setImageError(false);
  }, [showingBack, handout?.imageUrl, handout?.backImageUrl]);

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

  const accessionCode = useMemo(
    () =>
      handout
        ? getHandoutAccessionCode({ id: handout.id, type: handout.type })
        : "DOC-0000",
    [handout?.id, handout?.type]
  );

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

  const isPaper = surface === "paper";

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
            data-testid="handout-viewer-modal"
            onClick={(e) => e.stopPropagation()}
            className={`bg-[#08080c] border border-[#262632] shadow-[0_28px_80px_rgba(0,0,0,0.95)] flex flex-col relative overflow-hidden font-mono ${
              isFullscreen
                ? "w-full h-[100dvh] rounded-none border-0"
                : "w-full sm:max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] rounded-none"
            }`}
          >
            <div className="h-[2px] w-full bg-[var(--op-red-bright)] shrink-0" />

            {/* TOP ARCHIVAL INSPECTION BAR */}
            <header className="px-4 py-3 bg-[#0d0d13] border-b border-[#1f1f2b] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] uppercase tracking-[0.16em] text-[#8e90a0]">
                  <span className="text-[#c8c9d6] font-bold tabular-nums">
                    {accessionCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-bold ${typeMeta.accentClass}`}>
                    {typeMeta.shortLabel}
                  </span>
                  {folderName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[160px]">{folderName}</span>
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
                      <span className="text-amber-300 font-bold">
                        {showingBack ? "Verso (Lado B)" : "Frente (Lado A)"}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider truncate mt-0.5">
                  <CreatureRichInlineText
                    text={handout.title}
                    tone="dark"
                    interactiveAffiliations={false}
                  />
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {/* Reading Surface Toggle (Archival Paper vs Clinical Dark) */}
                <div
                  className="inline-flex items-center bg-[#12121a] border border-[#242432] p-0.5"
                  role="group"
                  aria-label="Modo de leitura do documento"
                >
                  <button
                    type="button"
                    data-testid="handout-surface-paper"
                    onClick={() => setSurface("paper")}
                    aria-pressed={isPaper}
                    title="Leitura em Papel Arquivístico"
                    className={`min-h-[36px] px-2.5 text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap touch-manipulation ${
                      isPaper
                        ? "bg-[#e8e0d0] text-[#171310] font-bold"
                        : "text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    <ScrollText size={12} />
                    <span>Papel</span>
                  </button>
                  <button
                    type="button"
                    data-testid="handout-surface-dark"
                    onClick={() => setSurface("dark")}
                    aria-pressed={!isPaper}
                    title="Leitura em Terminal Escuro"
                    className={`min-h-[36px] px-2.5 text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap touch-manipulation ${
                      !isPaper
                        ? "bg-[#220b0f] text-white font-bold"
                        : "text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    <Monitor size={12} />
                    <span>Terminal</span>
                  </button>
                </div>

                {handout.hasBackSide && (
                  <button
                    type="button"
                    data-testid="handout-flip-side-btn"
                    onClick={() => {
                      setShowingBack((prev) => !prev);
                      setZoom(1);
                    }}
                    className="min-h-[40px] px-3 py-1.5 bg-[#18151d] hover:bg-[#241f2b] text-amber-300 border border-amber-500/45 rounded-none text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
                  >
                    <RotateCw size={13} />
                    <span>{showingBack ? "Ver Frente" : "Virar Folha"}</span>
                  </button>
                )}

                {activeImage && !imageError && (
                  <div className="hidden md:flex items-center bg-[#121218] border border-[#242430] p-0.5">
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
                      title="Redefinir zoom"
                      aria-label="Redefinir zoom"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e2a] text-[#9ca3af] hover:text-white border border-[#242430] cursor-pointer transition-colors touch-manipulation"
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
                    className="min-h-[40px] px-3 bg-[#14141c] hover:bg-[#1e1e2a] text-zinc-200 border border-[#242430] text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap touch-manipulation"
                  >
                    <Edit2 size={12} />
                    <span>Editar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar visualizador"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[#14141c] hover:bg-red-950/50 text-[#9ca3af] hover:text-white border border-[#242430] hover:border-red-700/60 cursor-pointer transition-colors touch-manipulation"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* MOBILE ZOOM BAR (if image active) */}
            {activeImage && !imageError && (
              <div className="md:hidden px-4 py-2 bg-[#0c0c12] border-b border-[#1c1c26] flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                  Ampliação da Imagem
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#14141c] border border-[#242430] text-zinc-200 cursor-pointer"
                    aria-label="Diminuir zoom"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    className="min-h-[38px] px-2.5 bg-[#14141c] border border-[#242430] text-[11px] font-bold text-white tabular-nums cursor-pointer"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-[#14141c] border border-[#242430] text-zinc-200 cursor-pointer"
                    aria-label="Aumentar zoom"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* IMMERSIVE DESK CANVAS */}
            <div
              className="flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7 space-y-6 bg-[#060609]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 0%, rgba(143, 23, 28, 0.1) 0%, rgba(6, 6, 9, 0) 58%)",
                paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))",
              }}
            >
              <div className="max-w-3xl mx-auto space-y-6">
                {/* PHYSICAL DOSSIER SHEET / CLINICAL TERMINAL PANEL */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.article
                    key={showingBack ? "back" : "front"}
                    initial={{ opacity: 0, rotateY: showingBack ? -10 : 10, scale: 0.985 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, rotateY: showingBack ? 10 : -10, scale: 0.985 }}
                    transition={{ duration: 0.22, ease: CLINICAL_EASE }}
                    data-testid="handout-document-sheet"
                    data-surface={surface}
                    className={
                      isPaper
                        ? "relative border border-[#b9ab94] shadow-[0_22px_50px_rgba(0,0,0,0.75)] text-[#1d1814] overflow-hidden"
                        : "relative bg-[#0e0e15] border border-[#242434] shadow-[0_22px_50px_rgba(0,0,0,0.75)] text-[#e2e3ee] overflow-hidden"
                    }
                    style={
                      isPaper
                        ? {
                            background:
                              "linear-gradient(180deg, #f4eee1 0%, #eae1cf 52%, #dfd4be 100%)",
                          }
                        : undefined
                    }
                  >
                    {/* Archival Top Classification Ribbon */}
                    <div
                      className={`px-5 sm:px-8 py-3 border-b flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] ${
                        isPaper
                          ? "border-[#c4b7a0] bg-[#e6dcc8]/70 text-[#5c5144]"
                          : "border-[#1f1f2d] bg-[#12121b] text-[#8a8c9e]"
                      }`}
                    >
                      <span className="font-bold tabular-nums">
                        Registro {accessionCode} · {typeMeta.label}
                      </span>
                      <span
                        className={
                          showingBack
                            ? isPaper
                              ? "font-bold text-[#8f171c]"
                              : "font-bold text-amber-300"
                            : isPaper
                              ? "text-[#6b5f50]"
                              : "text-[#9ca3af]"
                        }
                      >
                        {handout.hasBackSide
                          ? showingBack
                            ? "Lado B · Costas do Material"
                            : "Lado A · Frente do Material"
                          : folderName || "Arquivo de Campo"}
                      </span>
                    </div>

                    {/* Inner Document Body */}
                    <div className="px-5 py-6 sm:px-9 sm:py-8 space-y-6">
                      {/* Dossier Masthead (Title + Provenance Description on Front) */}
                      {!showingBack && (
                        <header
                          className={`pb-4 border-b space-y-2 ${
                            isPaper ? "border-[#c4b7a0]" : "border-[#222232]"
                          }`}
                        >
                          <h1
                            className={`text-2xl sm:text-[28px] font-black uppercase tracking-wide leading-tight [text-wrap:balance] ${
                              isPaper ? "text-[#15110e]" : "text-white"
                            }`}
                          >
                            <CreatureRichInlineText
                              text={handout.title}
                              tone={isPaper ? "light" : "dark"}
                            />
                          </h1>
                          {handout.description && (
                            <p
                              className={`text-xs sm:text-[13px] leading-relaxed italic m-0 ${
                                isPaper ? "text-[#584e42]" : "text-[#9ca0b0]"
                              }`}
                            >
                              <CreatureRichInlineText
                                text={handout.description}
                                tone={isPaper ? "light" : "dark"}
                              />
                            </p>
                          )}
                        </header>
                      )}

                      {showingBack && (
                        <div
                          className={`pb-3 border-b flex items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] ${
                            isPaper
                              ? "border-[#c4b7a0] text-[#7a1b1f]"
                              : "border-[#242434] text-amber-300"
                          }`}
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            <FileText size={14} />
                            <span>Verso · Anotações nas Costas</span>
                          </span>
                        </div>
                      )}

                      {/* EVIDENCE IMAGE STAGE */}
                      {activeImage && (
                        <figure className="space-y-2 m-0">
                          <div
                            className={`overflow-auto max-h-[60dvh] flex items-center justify-center p-3 border ${
                              isPaper
                                ? "bg-[#141210] border-[#8b7f6c]"
                                : "bg-[#050508] border-[#1f1f2c]"
                            }`}
                          >
                            {imageError ? (
                              <div className="py-10 px-4 text-center text-xs text-[#9ca3af] space-y-2">
                                <ImageIcon size={24} className="mx-auto opacity-50" />
                                <div>Não foi possível carregar a imagem anexada.</div>
                              </div>
                            ) : (
                              <motion.img
                                src={activeImage}
                                alt={`${handout.title} (${showingBack ? "Verso" : "Frente"})`}
                                referrerPolicy="no-referrer"
                                onError={() => setImageError(true)}
                                animate={{ scale: zoom }}
                                transition={SNAPPY_SPRING}
                                style={{ transformOrigin: "center center" }}
                                className="max-w-full max-h-[54dvh] object-contain select-none"
                              />
                            )}
                          </div>
                          <figcaption
                            className={`text-[11px] italic flex items-center justify-between gap-2 ${
                              isPaper ? "text-[#63584a]" : "text-[#7d7f92]"
                            }`}
                          >
                            <span>
                              Fig. {showingBack ? "02 — Verso do registro" : "01 — Anexo visual principal"}
                            </span>
                            {zoom !== 1 && (
                              <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
                            )}
                          </figcaption>
                        </figure>
                      )}

                      {/* RICH FORMATTED PROSE (Same syntax as Creature Sheets & Master Notes) */}
                      {activeText && (
                        <div className="max-w-prose">
                          <HandoutRichContent
                            text={activeText}
                            surface={surface}
                          />
                        </div>
                      )}

                      {!activeImage && !activeText && (
                        <div
                          className={`py-12 text-center border border-dashed text-xs ${
                            isPaper
                              ? "border-[#bfb29b] text-[#6a5e4f]"
                              : "border-[#242434] text-[#787989]"
                          }`}
                        >
                          <ImageIcon size={24} className="mx-auto mb-2 opacity-50" />
                          {showingBack
                            ? "Nenhum conteúdo registrado nas costas deste material."
                            : "Nenhum conteúdo textual ou visual na frente deste material."}
                        </div>
                      )}
                    </div>

                    {/* Subtle Archival Footer Bar */}
                    {handout.hasBackSide && (
                      <div
                        className={`px-5 sm:px-8 py-3 border-t flex items-center justify-between gap-2 text-[11px] ${
                          isPaper
                            ? "border-[#c4b7a0] bg-[#e6dcc8]/50 text-[#5c5144]"
                            : "border-[#1f1f2d] bg-[#0b0b11] text-[#8a8c9e]"
                        }`}
                      >
                        <span>
                          {showingBack
                            ? "Visualizando o verso da folha."
                            : "Este documento possui conteúdo nas costas."}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowingBack((prev) => !prev);
                            setZoom(1);
                          }}
                          className={`min-h-[34px] px-3 uppercase text-[10px] font-bold tracking-wider border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isPaper
                              ? "bg-[#1a1512] hover:bg-[#2d241f] text-[#f4eee1] border-[#1a1512]"
                              : "bg-[#17151f] hover:bg-[#242030] text-amber-300 border-amber-500/40"
                          }`}
                        >
                          <RotateCw size={11} />
                          <span>{showingBack ? "Voltar para Frente" : "Virar para o Verso"}</span>
                        </button>
                      </div>
                    )}
                  </motion.article>
                </AnimatePresence>

                {/* CLASSIFIED SECRET ANNEX */}
                {showSecretSection && (
                  <section
                    data-testid="handout-secret-annex"
                    className={`border p-5 sm:p-6 space-y-4 ${
                      handout.secretRevealed
                        ? "bg-[#15080b] border-[var(--op-red-bright)]/70"
                        : "bg-[#121017] border-amber-500/45"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="flex flex-wrap items-center gap-2">
                        {handout.secretRevealed ? (
                          <Unlock size={15} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Lock size={15} className="text-amber-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-white">
                          Anexo Restrito · Segredo
                        </span>
                        {isMestre && (
                          <span
                            className={`text-[10px] uppercase font-bold ${
                              handout.secretRevealed ? "text-emerald-400" : "text-amber-300"
                            }`}
                          >
                            · {handout.secretRevealed ? "Revelado aos Jogadores" : "Selado (Somente Mestre)"}
                          </span>
                        )}
                      </div>

                      {isMestre && onToggleRevealSecret && (
                        <button
                          type="button"
                          onClick={() => onToggleRevealSecret(handout.id)}
                          className={`min-h-[38px] px-3 py-1 text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap touch-manipulation ${
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
                      <div className="bg-black/60 border border-white/10 p-2.5 flex justify-center">
                        <img
                          src={handout.secretImageUrl}
                          alt="Anexo visual secreto do Handout"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-[42dvh] object-contain"
                        />
                      </div>
                    )}

                    {handout.secretText && (
                      <div className="max-w-prose">
                        <HandoutRichContent
                          text={handout.secretText}
                          surface="dark"
                        />
                      </div>
                    )}
                  </section>
                )}

                {isMestre && !hasSecretContent && (
                  <div className="text-[11px] text-[#727486] border-t border-[#181822] pt-3">
                    Este handout não possui anexo secreto configurado.
                  </div>
                )}
              </div>
            </div>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};

