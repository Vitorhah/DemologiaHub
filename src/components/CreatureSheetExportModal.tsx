import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  ImagePlus,
  Loader2,
  Monitor,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Table2,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { GameMode } from "../types";
import type { MasterLibraryItem } from "../types/masterLibrary";
import type {
  CatalogRitualOption,
  CreatureBlockType,
  CreatureFolder,
  CreatureRecord,
} from "../types/masterCreatures";
import { CREATURE_BLOCK_META } from "../utils/creatureBlocks";
import {
  CREATURE_EXPORT_LAYOUTS,
  CreatureExportLayout,
  DEFAULT_EXPORT_OVERLAY_OPACITY,
  buildCreatureExportFilename,
  clampExportOverlayOpacity,
  exportCreatureElementToJpg,
  readFileAsDataUrl,
  resolveExportBlockContainerStyle,
  triggerJpgDownload,
  validateExportBackgroundFile,
} from "../utils/creatureExport";
import {
  CreatureModesBlock,
  CreatureProfileBlock,
  CreatureRitualsBlock,
  CreatureSkillsBlock,
  CreatureStatusBlock,
  CreatureTableBlock,
  CreatureTextBlock,
} from "./CreatureSheetBlocks";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

export interface CreatureSheetExportModalProps {
  isOpen: boolean;
  creature: CreatureRecord;
  folders: CreatureFolder[];
  libraryItems: MasterLibraryItem[];
  ritualCatalog: CatalogRitualOption[];
  currentGlobalMode: GameMode;
  onClose: () => void;
}

const NOOP_UPDATE = () => {
  // Export render is strictly read-only (identical to View mode)
};

function getExportBlockIcon(type: CreatureBlockType) {
  switch (type) {
    case "profile":
      return User;
    case "status":
      return SlidersHorizontal;
    case "skills":
      return Sparkles;
    case "rituals":
      return Flame;
    case "modes":
      return Shield;
    case "text":
      return FileText;
    case "table":
      return Table2;
  }
}

export const CreatureSheetExportModal: React.FC<
  CreatureSheetExportModalProps
> = ({
  isOpen,
  creature,
  folders,
  libraryItems,
  ritualCatalog,
  currentGlobalMode,
  onClose,
}) => {
  const [layout, setLayout] = useState<CreatureExportLayout>("pc");
  // Ephemeral background image — lives strictly in local component memory and is NEVER saved
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(
    DEFAULT_EXPORT_OVERLAY_OPACITY,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureStageRef = useRef<HTMLDivElement | null>(null);

  // Clear ephemeral image and messages whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setBgDataUrl(null);
      setBgFileName(null);
      setOverlayOpacity(DEFAULT_EXPORT_OVERLAY_OPACITY);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsExporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  const layoutSpec = CREATURE_EXPORT_LAYOUTS[layout];
  const blocks = creature.sheetBlocks || [];
  const exportFilename = useMemo(
    () => buildCreatureExportFilename(creature.name, layout),
    [creature.name, layout],
  );

  const handleSelectBackgroundFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateExportBackgroundFile(file);
    if (validation.ok === false) {
      setErrorMessage(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBgDataUrl(dataUrl);
      setBgFileName(file.name);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Não foi possível carregar a imagem de fundo.",
      );
    }
  };

  const handleRemoveBackground = () => {
    setBgDataUrl(null);
    setBgFileName(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportJpg = async () => {
    if (isExporting) return;
    if (blocks.length === 0) {
      setErrorMessage(
        "A ficha não possui blocos visíveis para exportar. Adicione ao menos um bloco.",
      );
      return;
    }
    const stageEl = captureStageRef.current;
    if (!stageEl) {
      setErrorMessage("Área de renderização indisponível no momento.");
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Allow one animation frame so layout/image updates settle cleanly
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const jpgDataUrl = await exportCreatureElementToJpg(stageEl, {
        width: layoutSpec.widthPx,
        pixelRatio: layoutSpec.pixelRatio,
        quality: 0.93,
        backgroundColor: "#07070b",
      });

      triggerJpgDownload(jpgDataUrl, exportFilename);
      setSuccessMessage(`Arquivo "${exportFilename}" exportado com sucesso.`);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          "Falha ao gerar imagem JPG da ficha. Tente novamente sem fundo externo.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const renderExportStage = () => {
    if (!isOpen || typeof document === "undefined" || !document.body) {
      return null;
    }

    const clampedOverlay = clampExportOverlayOpacity(overlayOpacity);
    const cardSurfaceClass = bgDataUrl
      ? "bg-[#0c0c10]/90 border-[#282838]"
      : "bg-[#0c0c10] border-[#1f1f2b]";

    return createPortal(
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div
          ref={captureStageRef}
          data-testid="creature-export-stage"
          data-export-layout={layout}
          className="font-mono text-[#dedede] relative overflow-hidden"
          style={{
            width: `${layoutSpec.widthPx}px`,
            padding: `${layoutSpec.paddingPx}px`,
            backgroundColor: "#07070b",
            boxSizing: "border-box",
          }}
        >
          {/* Imagem de fundo temporária (nunca persistida) */}
          {bgDataUrl && (
            <>
              <img
                src={bgDataUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: `rgba(7, 7, 11, ${clampedOverlay})`,
                  pointerEvents: "none",
                }}
              />
            </>
          )}

          {/* Renderização fiel ao Modo Visualizar */}
          <div className="relative z-10 flex flex-wrap items-start gap-3 w-full">
            {blocks.map((block) => {
              const meta = CREATURE_BLOCK_META[block.type];
              const Icon = getExportBlockIcon(block.type);
              const containerStyle = resolveExportBlockContainerStyle(
                block,
                layout,
              );

              return (
                <div
                  key={block.id}
                  style={containerStyle}
                  className={`relative border flex flex-col min-w-0 ${cardSurfaceClass}`}
                >
                  {block.type !== "profile" &&
                    block.type !== "text" &&
                    block.type !== "table" && (
                    <div className="px-3.5 py-2 bg-[#0f0f16]/95 border-b border-[#1b1b26] flex items-center gap-1.5">
                      <Icon
                        size={12}
                        className="text-[var(--op-red-bright)] shrink-0"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b4b5c2]">
                        {meta.label}
                      </span>
                    </div>
                  )}

                  <div className="p-3.5 flex-1 min-w-0">
                    {block.type === "profile" && (
                      <CreatureProfileBlock
                        creature={creature}
                        folders={folders}
                        ritualCatalog={ritualCatalog}
                        isEditing={false}
                        onUpdateCreature={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "status" && (
                      <CreatureStatusBlock
                        creature={creature}
                        currentGlobalMode={currentGlobalMode}
                        isEditing={false}
                        onUpdateCreature={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "skills" && (
                      <CreatureSkillsBlock
                        creature={creature}
                        libraryItems={libraryItems}
                        isEditing={false}
                        onUpdateCreature={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "rituals" && (
                      <CreatureRitualsBlock
                        creature={creature}
                        ritualCatalog={ritualCatalog}
                        isEditing={false}
                        onUpdateCreature={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "modes" && (
                      <CreatureModesBlock
                        creature={creature}
                        ritualCatalog={ritualCatalog}
                        isEditing={false}
                        onUpdateCreature={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "text" && (
                      <CreatureTextBlock
                        block={block}
                        ritualCatalog={ritualCatalog}
                        isEditing={false}
                        onUpdateTextBlock={NOOP_UPDATE}
                      />
                    )}
                    {block.type === "table" && (
                      <CreatureTableBlock
                        block={block}
                        ritualCatalog={ritualCatalog}
                        isEditing={false}
                        onUpdateTableBlock={NOOP_UPDATE}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
      {renderExportStage()}

      <AnimatePresence>
        {isOpen && (
          <MotionModalBackdrop
            className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => !isExporting && onClose()}
          >
            <MotionSheetPanel
              role="dialog"
              aria-modal="true"
              aria-labelledby="creature-export-modal-title"
              data-testid="creature-export-modal"
              className="w-full sm:max-w-lg bg-[#0c0c10]/95 border-t sm:border border-[#282834] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.9)] relative overflow-hidden max-h-[90dvh] flex flex-col font-mono"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Barra superior vermelha padrão Demologia */}
              <div className="h-[2px] w-full bg-[var(--op-red)] absolute top-0 left-0" />

              {/* Alça mobile */}
              <div
                className="w-10 h-1 rounded-none bg-[#32323e] mx-auto mt-3 sm:hidden shrink-0"
                aria-hidden="true"
              />

              <button
                type="button"
                disabled={isExporting}
                onClick={onClose}
                aria-label="Fechar janela de exportação"
                data-testid="creature-export-close-btn"
                className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white active:scale-95 transition-all rounded-none cursor-pointer touch-manipulation disabled:opacity-40 z-10"
              >
                <X size={20} />
              </button>

              {/* Cabeçalho */}
              <div className="p-5 sm:p-6 pb-4 flex items-center gap-3 pr-14 shrink-0 border-b border-[#1c1c26]">
                <div className="w-10 h-10 bg-[#140a0c] border border-[#3a161a] flex items-center justify-center shrink-0">
                  <Download className="text-[var(--op-red-bright)]" size={18} />
                </div>
                <div className="min-w-0">
                  <h3
                    id="creature-export-modal-title"
                    className="text-base sm:text-lg font-bold text-white uppercase tracking-[0.14em]"
                  >
                    Exportar Ficha (JPG)
                  </h3>
                  <p className="text-[11px] text-[#8a8a98] mt-0.5 truncate">
                    Visual idêntico ao modo Visualizar · {creature.name || "Sem nome"}
                  </p>
                </div>
              </div>

              {/* Corpo */}
              <div className="p-5 sm:p-6 pt-4 overflow-y-auto space-y-5">
                {/* 1. Escolha de Layout: PC ou Mobile */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b9caa]">
                    // Formato de Layout
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(["pc", "mobile"] as const).map((optionId) => {
                      const spec = CREATURE_EXPORT_LAYOUTS[optionId];
                      const active = layout === optionId;
                      const Icon = optionId === "pc" ? Monitor : Smartphone;
                      return (
                        <button
                          key={optionId}
                          type="button"
                          aria-pressed={active}
                          data-testid={`creature-export-layout-${optionId}`}
                          onClick={() => {
                            setLayout(optionId);
                            setSuccessMessage(null);
                          }}
                          className={`text-left min-h-[68px] p-3 border transition-colors flex flex-col justify-between gap-1 cursor-pointer touch-manipulation ${
                            active
                              ? "bg-[#1a0b0f] border-[var(--op-red-bright)] text-white"
                              : "bg-[#111119] hover:bg-[#171722] border-[#262634] text-[#b4b5c2]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                              <Icon
                                size={14}
                                className={
                                  active
                                    ? "text-[var(--op-red-bright)]"
                                    : "text-[#7c7d90]"
                                }
                              />
                              <span>{spec.label}</span>
                            </span>
                            <span className="text-[9px] text-[#8a8b9c] tabular-nums">
                              {spec.widthPx}px
                            </span>
                          </div>
                          <span className="text-[10px] text-[#888a9a] leading-snug">
                            {optionId === "pc"
                              ? "Múltiplas colunas lado a lado"
                              : "Coluna única vertical"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Imagem de Fundo Opcional (Temporária - Nunca salva) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b9caa]">
                      // Imagem de Fundo (Opcional)
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-amber-300/90 border border-amber-700/40 bg-amber-950/25 px-1.5 py-0.5">
                      Não salva
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleSelectBackgroundFile}
                    data-testid="creature-export-bg-input"
                    className="sr-only"
                    id="creature-export-bg-file"
                  />

                  {!bgDataUrl ? (
                    <label
                      htmlFor="creature-export-bg-file"
                      className="w-full min-h-[54px] px-3.5 py-3 bg-[#101018] hover:bg-[#171723] border border-dashed border-[#2d2d40] hover:border-[var(--op-red-bright)] text-[#b6b7c6] hover:text-white flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer transition-colors touch-manipulation"
                    >
                      <ImagePlus
                        size={15}
                        className="text-[var(--op-red-bright)] shrink-0"
                      />
                      <span>Selecionar imagem de fundo</span>
                    </label>
                  ) : (
                    <div className="bg-[#101018] border border-[#282838] p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 border border-[#2c2c3c] bg-[#07070b] overflow-hidden shrink-0 relative">
                          <img
                            src={bgDataUrl}
                            alt="Prévia do fundo temporário"
                            className="w-full h-full object-cover"
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundColor: `rgba(7, 7, 11, ${clampExportOverlayOpacity(
                                overlayOpacity,
                              )})`,
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-white font-bold truncate">
                            {bgFileName || "Imagem selecionada"}
                          </div>
                          <div className="text-[10px] text-[#8a8b9c]">
                            Aplicada apenas neste JPG — descartada ao fechar
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveBackground}
                          data-testid="creature-export-bg-remove-btn"
                          aria-label="Remover imagem de fundo temporária"
                          className="min-w-[40px] min-h-[40px] bg-[#1a0b0e] hover:bg-[#2b1116] border border-[#5a1c24] text-red-300 flex items-center justify-center cursor-pointer shrink-0 touch-manipulation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9b9caa]">
                          <label htmlFor="creature-export-overlay-range">
                            Escurecimento sobre o fundo
                          </label>
                          <span className="tabular-nums text-white font-bold">
                            {Math.round(overlayOpacity * 100)}%
                          </span>
                        </div>
                        <input
                          id="creature-export-overlay-range"
                          type="range"
                          min={0}
                          max={90}
                          step={2}
                          value={Math.round(overlayOpacity * 100)}
                          onChange={(e) =>
                            setOverlayOpacity(
                              clampExportOverlayOpacity(
                                Number(e.target.value) / 100,
                              ),
                            )
                          }
                          className="w-full accent-[var(--op-red-bright)] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-[#7c7d8e] leading-snug">
                    A imagem de fundo permanece somente nesta janela para compor o
                    arquivo JPG e nunca é salva no banco ou no navegador.
                  </p>
                </div>

                {/* Alertas de erro ou sucesso */}
                {errorMessage && (
                  <div
                    role="alert"
                    className="bg-[#1b0b0e] border border-[#6e1c26] px-3 py-2.5 text-[11px] text-red-200 flex items-center gap-2"
                  >
                    <AlertTriangle size={14} className="shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    data-testid="creature-export-success"
                    className="bg-emerald-950/40 border border-emerald-700/60 px-3 py-2.5 text-[11px] text-emerald-200 flex items-center gap-2"
                  >
                    <CheckCircle2
                      size={14}
                      className="shrink-0 text-emerald-400"
                    />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Resumo do arquivo e ação */}
                <div className="pt-2 border-t border-[#1d1d28] space-y-3">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#8a8b9c]">
                    <span className="uppercase tracking-wider">Arquivo final</span>
                    <span className="text-[#d4d5e2] truncate max-w-[260px]">
                      {exportFilename}
                    </span>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={onClose}
                      className="w-full sm:w-auto min-h-[44px] px-4 bg-[#14141c] hover:bg-[#1c1c28] border border-[#2a2a38] text-xs font-bold uppercase tracking-wider text-[#b4b5c2] hover:text-white cursor-pointer disabled:opacity-50 touch-manipulation"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      disabled={isExporting || blocks.length === 0}
                      onClick={handleExportJpg}
                      data-testid="creature-export-confirm-btn"
                      className="w-full sm:flex-1 min-h-[44px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] active:scale-[0.99] text-white text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 touch-manipulation"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Gerando JPG...</span>
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          <span>Exportar JPG ({layoutSpec.shortLabel})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>
    </>
  );
};
