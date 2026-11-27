import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileImage,
  Loader2,
  X,
} from "lucide-react";
import type {
  CreationDocument,
  CreationExportFormat,
} from "../../types/masterCreations";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  buildCreationExportFilename,
} from "../../utils/masterCreations";
import {
  exportElementToImage,
  triggerJpgDownload,
} from "../../utils/creatureExport";
import { MotionModalBackdrop, MotionSheetPanel } from "../MotionPrimitives";
import { CreationElementRenderer } from "./CreationElementRenderer";

export interface CreationExportModalProps {
  isOpen: boolean;
  document: CreationDocument;
  onClose: () => void;
}

export const CreationExportModal: React.FC<CreationExportModalProps> = ({
  isOpen,
  document,
  onClose,
}) => {
  const [format, setFormat] = useState<CreationExportFormat>("jpg");
  const [pixelRatio, setPixelRatio] = useState<number>(2);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsExporting(false);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExporting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isExporting, onClose]);

  const visibleElements = useMemo(
    () =>
      [...document.elements]
        .filter((el) => el.visible)
        .sort((a, b) => a.zIndex - b.zIndex),
    [document.elements],
  );

  const filename = useMemo(
    () => buildCreationExportFilename(document.title, format),
    [document.title, format],
  );

  const handleExport = async () => {
    if (isExporting) return;
    const stageEl = stageRef.current;
    if (!stageEl) {
      setErrorMessage("Área de renderização indisponível no momento.");
      return;
    }
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const dataUrl = await exportElementToImage(stageEl, {
        format,
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        pixelRatio,
        quality: 0.94,
        backgroundColor: document.pageBackground,
      });

      triggerJpgDownload(dataUrl, filename);
      setSuccessMessage(`Documento "${filename}" exportado com sucesso.`);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          "Falha ao gerar imagem A4. Verifique se há imagens externas bloqueadas por CORS.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Palco limpo fora da tela: exatamente 794×1123 (A4) sem menus, seleção ou handles
  const renderExportStage = () => {
    if (!isOpen || typeof window === "undefined" || !window.document?.body) {
      return null;
    }

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
          ref={stageRef}
          data-testid="creation-export-stage"
          style={{
            position: "relative",
            width: `${A4_WIDTH_PX}px`,
            height: `${A4_HEIGHT_PX}px`,
            backgroundColor: document.pageBackground,
            border:
              document.pageBorderColor !== "transparent"
                ? `1px solid ${document.pageBorderColor}`
                : "none",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {visibleElements.map((el) => (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                zIndex: el.zIndex,
              }}
            >
              <CreationElementRenderer element={el} readOnly />
            </div>
          ))}
        </div>
      </div>,
      window.document.body,
    );
  };

  return (
    <>
      {renderExportStage()}
      <AnimatePresence>
        {isOpen && (
          <MotionModalBackdrop
            onClick={() => {
              if (!isExporting) onClose();
            }}
            className="fixed inset-0 z-[260] bg-black/80 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <MotionSheetPanel
              role="dialog"
              aria-modal="true"
              aria-label="Exportar Documento A4"
              data-testid="creation-export-modal"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-[#0d0d13] border border-[#2a2a38] shadow-2xl font-mono text-[#dedede] overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#20202c] bg-[#0a0a0f]">
                <div className="flex items-center gap-2 min-w-0">
                  <FileImage
                    size={16}
                    className="text-[var(--op-red-bright)] shrink-0"
                  />
                  <h3 className="text-xs sm:text-sm uppercase tracking-wider font-bold text-white truncate">
                    Exportar Documento A4
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isExporting}
                  data-testid="creation-export-close-btn"
                  aria-label="Fechar exportação"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#8e90a0] hover:text-white border border-transparent hover:border-[#2a2a38] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="text-xs text-[#9c9eb0] bg-[#111119] border border-[#222230] px-3 py-2.5 space-y-1">
                  <div className="text-white font-bold truncate">
                    {document.title}
                  </div>
                  <div className="text-[11px]">
                    Formato A4 exato ({A4_WIDTH_PX * pixelRatio}×
                    {A4_HEIGHT_PX * pixelRatio}px) · {visibleElements.length}{" "}
                    camada(s) visível(is) · Sem menus do editor
                  </div>
                </div>

                {/* Escolha de formato JPG / PNG */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#8e90a0] block">
                    Formato do Arquivo
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: "jpg",
                          label: "JPG",
                          desc: "Mais leve para compartilhar",
                        },
                        {
                          id: "png",
                          label: "PNG",
                          desc: "Máxima nitidez sem perda",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`creation-export-format-${opt.id}`}
                        onClick={() => setFormat(opt.id)}
                        className={`p-2.5 border text-left transition-colors cursor-pointer touch-manipulation ${
                          format === opt.id
                            ? "bg-[#1c0b0f] border-[#8f171c] text-white"
                            : "bg-[#101018] border-[#252534] text-[#a0a2b2] hover:border-[#3c3c52]"
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-[#8a8c9c] mt-0.5">
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolução */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#8e90a0] block">
                    Resolução de Saída
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { ratio: 2, label: "Alta (2× · 1588×2246)" },
                      { ratio: 1.5, label: "Padrão (1.5× · 1191×1685)" },
                    ].map((opt) => (
                      <button
                        key={opt.ratio}
                        type="button"
                        onClick={() => setPixelRatio(opt.ratio)}
                        className={`min-h-[38px] px-2.5 border text-[11px] cursor-pointer touch-manipulation ${
                          pixelRatio === opt.ratio
                            ? "bg-[#1c0b0f] border-[#8f171c] text-white font-bold"
                            : "bg-[#101018] border-[#252534] text-[#9e9fb0]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-start gap-2 p-2.5 bg-red-950/40 border border-red-800/70 text-red-200 text-xs">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div
                    data-testid="creation-export-success"
                    className="flex items-start gap-2 p-2.5 bg-emerald-950/40 border border-emerald-700/60 text-emerald-200 text-xs"
                  >
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#20202c] bg-[#0a0a0f]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isExporting}
                  className="min-h-[40px] px-3.5 bg-[#12121a] border border-[#2a2a38] text-xs uppercase text-[#b6b8c6] hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  data-testid="creation-export-confirm-btn"
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50 touch-manipulation"
                >
                  {isExporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>
                    {isExporting
                      ? "Gerando A4..."
                      : `Exportar ${format.toUpperCase()}`}
                  </span>
                </button>
              </div>
            </MotionSheetPanel>
          </MotionModalBackdrop>
        )}
      </AnimatePresence>
    </>
  );
};
