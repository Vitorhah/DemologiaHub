import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardCopy,
  Copy,
  Lock,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import type {
  CreationDocument,
  CreationElement,
  CreationResizeHandle,
} from "../../types/masterCreations";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  computeResizedElementBox,
} from "../../utils/masterCreations";
import { CreationElementRenderer } from "./CreationElementRenderer";

export interface CreationCanvasWorkspaceProps {
  document: CreationDocument;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommitElementBox: (
    id: string,
    box: { x: number; y: number; width: number; height: number },
  ) => void;
  onInlineTextChange: (id: string, nextText: string) => void;
  onDropImageFile: (file: File, coords: { x: number; y: number }) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
}

const RESIZE_HANDLES: Array<{
  handle: CreationResizeHandle;
  cursor: string;
  style: React.CSSProperties;
}> = [
  { handle: "nw", cursor: "nwse-resize", style: { top: -5, left: -5 } },
  {
    handle: "n",
    cursor: "ns-resize",
    style: { top: -5, left: "50%", transform: "translateX(-50%)" },
  },
  { handle: "ne", cursor: "nesw-resize", style: { top: -5, right: -5 } },
  {
    handle: "e",
    cursor: "ew-resize",
    style: { top: "50%", right: -5, transform: "translateY(-50%)" },
  },
  { handle: "se", cursor: "nwse-resize", style: { bottom: -5, right: -5 } },
  {
    handle: "s",
    cursor: "ns-resize",
    style: { bottom: -5, left: "50%", transform: "translateX(-50%)" },
  },
  { handle: "sw", cursor: "nesw-resize", style: { bottom: -5, left: -5 } },
  {
    handle: "w",
    cursor: "ew-resize",
    style: { top: "50%", left: -5, transform: "translateY(-50%)" },
  },
];

interface ActiveInteraction {
  mode: "drag" | "resize";
  elementId: string;
  handle?: CreationResizeHandle;
  startClientX: number;
  startClientY: number;
  startBox: { x: number; y: number; width: number; height: number };
  currentBox: { x: number; y: number; width: number; height: number };
  lockAspectRatio: boolean;
  aspectRatio: number | null;
  moved: boolean;
}

export const CreationCanvasWorkspace: React.FC<CreationCanvasWorkspaceProps> = ({
  document,
  zoom,
  selectedId,
  onSelect,
  onCommitElementBox,
  onInlineTextChange,
  onDropImageFile,
  onDuplicate,
  onCopy,
  onBringToFront,
  onSendToBack,
  onToggleLock,
  onDelete,
}) => {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const interactionRef = useRef<ActiveInteraction | null>(null);
  const rafRef = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Encerra edição inline se seleção mudar
  useEffect(() => {
    if (inlineEditingId && inlineEditingId !== selectedId) {
      setInlineEditingId(null);
    }
  }, [inlineEditingId, selectedId]);

  const visibleElements = useMemo(
    () =>
      [...document.elements]
        .filter((el) => el.visible)
        .sort((a, b) => a.zIndex - b.zIndex),
    [document.elements],
  );

  const selectedElement = useMemo(
    () => document.elements.find((el) => el.id === selectedId) || null,
    [document.elements, selectedId],
  );

  const applyBoxDirectlyToDom = (
    elementId: string,
    box: { x: number; y: number; width: number; height: number },
  ) => {
    const node = elementRefs.current.get(elementId);
    if (!node) return;
    node.style.left = `${box.x}px`;
    node.style.top = `${box.y}px`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const active = interactionRef.current;
      if (!active) return;

      const scale = Math.max(0.2, zoomRef.current);
      const dx = (e.clientX - active.startClientX) / scale;
      const dy = (e.clientY - active.startClientY) / scale;

      if (!active.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        return;
      }
      active.moved = true;

      let nextBox: { x: number; y: number; width: number; height: number };
      if (active.mode === "drag") {
        nextBox = {
          x: Math.round(active.startBox.x + dx),
          y: Math.round(active.startBox.y + dy),
          width: active.startBox.width,
          height: active.startBox.height,
        };
      } else {
        nextBox = computeResizedElementBox(
          active.startBox,
          active.handle || "se",
          dx,
          dy,
          {
            lockAspectRatio: active.lockAspectRatio || e.shiftKey,
            aspectRatio: active.aspectRatio,
          },
        );
      }

      active.currentBox = nextBox;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const cur = interactionRef.current;
          if (cur) {
            applyBoxDirectlyToDom(cur.elementId, cur.currentBox);
          }
        });
      }
    };

    const finishInteraction = () => {
      const active = interactionRef.current;
      if (!active) return;
      interactionRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (active.moved) {
        onCommitElementBox(active.elementId, active.currentBox);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishInteraction);
    window.addEventListener("pointercancel", finishInteraction);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onCommitElementBox]);

  const startDragElement = (e: React.PointerEvent, el: CreationElement) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (inlineEditingId === el.id) return;
    e.stopPropagation();
    onSelect(el.id);
    if (el.locked) return;

    interactionRef.current = {
      mode: "drag",
      elementId: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { x: el.x, y: el.y, width: el.width, height: el.height },
      currentBox: { x: el.x, y: el.y, width: el.width, height: el.height },
      lockAspectRatio: false,
      aspectRatio: null,
      moved: false,
    };
  };

  const startResizeElement = (
    e: React.PointerEvent,
    el: CreationElement,
    handle: CreationResizeHandle,
  ) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation();
    e.preventDefault();
    if (el.locked) return;

    interactionRef.current = {
      mode: "resize",
      elementId: el.id,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { x: el.x, y: el.y, width: el.width, height: el.height },
      currentBox: { x: el.x, y: el.y, width: el.width, height: el.height },
      lockAspectRatio: el.lockAspectRatio,
      aspectRatio: el.imageAspectRatio || (el.height > 0 ? el.width / el.height : null),
      moved: false,
    };
  };

  const handleDragOverPage = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOverFile(true);
    }
  };

  const handleDropOnPage = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const rect = pageRef.current?.getBoundingClientRect();
    let dropX = 120;
    let dropY = 120;
    if (rect && zoom > 0) {
      dropX = Math.max(
        16,
        Math.min(A4_WIDTH_PX - 220, Math.round((e.clientX - rect.left) / zoom - 110)),
      );
      dropY = Math.max(
        16,
        Math.min(A4_HEIGHT_PX - 180, Math.round((e.clientY - rect.top) / zoom - 90)),
      );
    }
    onDropImageFile(file, { x: dropX, y: dropY });
  };

  const scaledWidth = Math.round(A4_WIDTH_PX * zoom);
  const scaledHeight = Math.round(A4_HEIGHT_PX * zoom);

  return (
    <div
      data-testid="creation-canvas-workspace"
      onPointerDown={() => {
        setInlineEditingId(null);
        onSelect(null);
      }}
      onDragOver={handleDragOverPage}
      onDragLeave={() => setIsDragOverFile(false)}
      onDrop={handleDropOnPage}
      className="relative flex-1 min-w-0 min-h-[520px] lg:min-h-[680px] overflow-auto bg-[#07070b] border border-[#1d1d27] px-4 pb-8 pt-14 sm:px-8 sm:pb-10 sm:pt-14 flex justify-center items-start"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      {/* Wrapper de dimensões escaladas para scroll limpo em qualquer zoom */}
      <div
        className="relative shrink-0"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
      >
        {/* Barra rápida flutuante do elemento selecionado */}
        {selectedElement && selectedElement.visible && (
          <div
            data-testid="creation-selection-quickbar"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute -top-11 left-0 z-40 flex items-center gap-1 bg-[#101017] border border-[#2c2c3c] px-1.5 py-1 shadow-xl font-mono"
          >
            <span className="text-[10px] uppercase tracking-wider text-[#9d9fb0] px-1.5 max-w-[130px] truncate border-r border-[#242432]">
              {selectedElement.name}
            </span>
            <button
              type="button"
              onClick={() => onDuplicate(selectedElement.id)}
              data-testid="creation-quick-duplicate"
              title="Duplicar (Ctrl+D)"
              aria-label="Duplicar elemento"
              className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#c2c4d4] hover:text-white hover:bg-white/5 cursor-pointer touch-manipulation"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => onCopy(selectedElement.id)}
              data-testid="creation-quick-copy"
              title="Copiar (Ctrl+C)"
              aria-label="Copiar elemento"
              className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#c2c4d4] hover:text-white hover:bg-white/5 cursor-pointer touch-manipulation"
            >
              <ClipboardCopy size={13} />
            </button>
            <button
              type="button"
              onClick={() => onBringToFront(selectedElement.id)}
              title="Trazer para frente"
              aria-label="Trazer para frente"
              className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#c2c4d4] hover:text-white hover:bg-white/5 cursor-pointer touch-manipulation"
            >
              <ArrowUpToLine size={13} />
            </button>
            <button
              type="button"
              onClick={() => onSendToBack(selectedElement.id)}
              title="Enviar para trás"
              aria-label="Enviar para trás"
              className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#c2c4d4] hover:text-white hover:bg-white/5 cursor-pointer touch-manipulation"
            >
              <ArrowDownToLine size={13} />
            </button>
            <button
              type="button"
              onClick={() => onToggleLock(selectedElement.id)}
              title={selectedElement.locked ? "Desbloquear" : "Bloquear"}
              aria-label={selectedElement.locked ? "Desbloquear" : "Bloquear"}
              className={`min-w-[30px] min-h-[30px] flex items-center justify-center hover:bg-white/5 cursor-pointer touch-manipulation ${
                selectedElement.locked ? "text-amber-400" : "text-[#c2c4d4]"
              }`}
            >
              {selectedElement.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedElement.id)}
              data-testid="creation-quick-delete"
              title="Remover (Delete)"
              aria-label="Remover elemento"
              className="min-w-[30px] min-h-[30px] flex items-center justify-center text-red-400 hover:bg-red-950/50 cursor-pointer touch-manipulation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Folha A4 real (794×1123px) escalada pelo zoom */}
        <div
          ref={pageRef}
          data-testid="creation-a4-page"
          data-a4-width={A4_WIDTH_PX}
          data-a4-height={A4_HEIGHT_PX}
          style={{
            position: "relative",
            width: `${A4_WIDTH_PX}px`,
            height: `${A4_HEIGHT_PX}px`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            backgroundColor: document.pageBackground,
            border:
              document.pageBorderColor !== "transparent"
                ? `1px solid ${document.pageBorderColor}`
                : "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.72)",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {/* Aviso visual ao arrastar PNG do computador para a folha */}
          {isDragOverFile && (
            <div className="absolute inset-0 z-[999] bg-[#1a080c]/80 border-2 border-dashed border-[var(--op-red-bright)] flex flex-col items-center justify-center gap-2 text-white font-mono pointer-events-none">
              <Upload size={28} className="text-[var(--op-red-bright)]" />
              <span className="text-sm uppercase tracking-widest font-bold">
                Solte a imagem PNG na folha A4
              </span>
            </div>
          )}

          {visibleElements.length === 0 && !isDragOverFile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-12 text-center font-mono">
              <div className="border border-dashed border-[#343446]/60 px-6 py-5 max-w-sm">
                <div className="text-xs uppercase tracking-widest text-[#8e90a0]">
                  Folha A4 Pronta
                </div>
                <p className="text-[11px] text-[#6d6f80] mt-1.5 leading-relaxed">
                  Adicione blocos no painel lateral ou arraste uma imagem PNG
                  diretamente para esta página.
                </p>
              </div>
            </div>
          )}

          {visibleElements.map((el) => {
            const isSelected = el.id === selectedId;
            return (
              <div
                key={el.id}
                ref={(node) => {
                  if (node) elementRefs.current.set(el.id, node);
                  else elementRefs.current.delete(el.id);
                }}
                data-testid={`creation-canvas-el-${el.id}`}
                data-element-type={el.type}
                data-selected={isSelected ? "true" : "false"}
                onPointerDown={(e) => startDragElement(e, el)}
                onDoubleClick={(e) => {
                  if (el.type === "text" && !el.locked) {
                    e.stopPropagation();
                    setInlineEditingId(el.id);
                  }
                }}
                style={{
                  position: "absolute",
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  zIndex: el.zIndex,
                  cursor: el.locked
                    ? "default"
                    : inlineEditingId === el.id
                      ? "text"
                      : "move",
                  touchAction: el.locked ? "auto" : "none",
                  outline: isSelected
                    ? el.locked
                      ? "1.5px dashed #f59e0b"
                      : "1.5px solid #dc2626"
                    : "none",
                  outlineOffset: "1px",
                }}
              >
                <CreationElementRenderer
                  element={el}
                  isInlineEditing={inlineEditingId === el.id}
                  onInlineTextChange={(next) => onInlineTextChange(el.id, next)}
                  onInlineEditEnd={() => setInlineEditingId(null)}
                />

                {/* 8 alças de redimensionamento quando selecionado e desbloqueado */}
                {isSelected && !el.locked && inlineEditingId !== el.id && (
                  <>
                    {RESIZE_HANDLES.map(({ handle, cursor, style }) => (
                      <div
                        key={handle}
                        role="presentation"
                        data-testid={`creation-resize-${handle}-${el.id}`}
                        onPointerDown={(e) => startResizeElement(e, el, handle)}
                        style={{
                          position: "absolute",
                          width: "10px",
                          height: "10px",
                          backgroundColor: "#ffffff",
                          border: "1.5px solid #b91c1c",
                          cursor,
                          touchAction: "none",
                          zIndex: 30,
                          ...style,
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
