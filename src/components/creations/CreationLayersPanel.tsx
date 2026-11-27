import React, { useMemo, useState } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Check,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Lock,
  Minus,
  SeparatorHorizontal,
  Square,
  Trash2,
  Unlock,
  User,
} from "lucide-react";
import type {
  CreationElement,
  CreationElementType,
} from "../../types/masterCreations";

export interface CreationLayersPanelProps {
  elements: CreationElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, nextName: string) => void;
  onMoveStep: (id: string, direction: "up" | "down") => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onReorderById: (sourceId: string, targetId: string) => void;
  onDelete: (id: string) => void;
}

export function getCreationElementIcon(type: CreationElementType) {
  switch (type) {
    case "text":
      return AlignLeft;
    case "image":
      return ImageIcon;
    case "line":
      return Minus;
    case "divider":
      return SeparatorHorizontal;
    case "rect":
      return Square;
    case "profile":
      return User;
    case "description":
      return FileText;
    case "info":
      return ListChecks;
  }
}

export const CreationLayersPanel: React.FC<CreationLayersPanelProps> = ({
  elements,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onRename,
  onMoveStep,
  onBringToFront,
  onSendToBack,
  onReorderById,
  onDelete,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Exibe camadas de cima para baixo (zIndex maior no topo, padrão profissional)
  const layersTopFirst = useMemo(
    () => [...elements].sort((a, b) => b.zIndex - a.zIndex),
    [elements],
  );

  const startRename = (el: CreationElement) => {
    setRenamingId(el.id);
    setRenameDraft(el.name);
  };

  const commitRename = (id: string) => {
    const clean = renameDraft.trim();
    if (clean) {
      onRename(id, clean);
    }
    setRenamingId(null);
  };

  if (layersTopFirst.length === 0) {
    return (
      <div
        data-testid="creation-layers-empty"
        className="px-3 py-8 text-center text-xs font-mono text-[#76788a] border border-dashed border-[#242430] bg-[#0b0b10]"
      >
        Nenhuma camada nesta página ainda. Adicione blocos ou imagens na aba{" "}
        <span className="text-[#c6c8d6]">Blocos</span>.
      </div>
    );
  }

  return (
    <div
      data-testid="creation-layers-list"
      className="space-y-1.5 font-mono"
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#7d7f90] px-1 pb-1 border-b border-[#1c1c26]">
        <span>Topo (Frente)</span>
        <span>{layersTopFirst.length} camadas</span>
      </div>

      {layersTopFirst.map((el, visualIndex) => {
        const Icon = getCreationElementIcon(el.type);
        const isSelected = el.id === selectedId;
        const isTopMost = visualIndex === 0;
        const isBottomMost = visualIndex === layersTopFirst.length - 1;
        const isRenaming = renamingId === el.id;

        return (
          <div
            key={el.id}
            data-testid={`creation-layer-item-${el.id}`}
            data-selected={isSelected ? "true" : "false"}
            draggable={!isRenaming}
            onDragStart={() => setDraggedId(el.id)}
            onDragOver={(e) => {
              if (draggedId && draggedId !== el.id) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId && draggedId !== el.id) {
                onReorderById(draggedId, el.id);
              }
              setDraggedId(null);
            }}
            onDragEnd={() => setDraggedId(null)}
            className={`border transition-colors ${
              isSelected
                ? "bg-[#1a0c10] border-[#8f171c]/80 text-white"
                : "bg-[#0e0e14] border-[#1f1f2b] text-[#c0c2cf] hover:border-[#343448]"
            } ${!el.visible ? "opacity-55" : ""}`}
          >
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                type="button"
                onClick={() => onSelect(el.id)}
                data-testid={`creation-layer-select-${el.id}`}
                className="flex-1 min-w-0 flex items-center gap-2 text-left min-h-[36px] cursor-pointer touch-manipulation"
                title={`Selecionar camada ${el.name}`}
              >
                <Icon
                  size={13}
                  className={`shrink-0 ${
                    isSelected ? "text-[var(--op-red-bright)]" : "text-[#7a7c8d]"
                  }`}
                />
                {isRenaming ? (
                  <input
                    type="text"
                    autoFocus
                    value={renameDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(el.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(el.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    aria-label="Novo nome da camada"
                    data-testid={`creation-layer-rename-input-${el.id}`}
                    className="w-full bg-[#09090d] border border-[#8f171c] px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  />
                ) : (
                  <span className="truncate text-xs font-medium">
                    {el.name}
                  </span>
                )}
              </button>

              {isRenaming ? (
                <button
                  type="button"
                  onClick={() => commitRename(el.id)}
                  aria-label="Confirmar nome da camada"
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                >
                  <Check size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(el)}
                  data-testid={`creation-layer-rename-btn-${el.id}`}
                  aria-label={`Renomear camada ${el.name}`}
                  title="Renomear camada"
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#7d7f90] hover:text-white cursor-pointer touch-manipulation"
                >
                  <Edit2 size={12} />
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleVisible(el.id)}
                data-testid={`creation-layer-visible-${el.id}`}
                aria-label={
                  el.visible
                    ? `Ocultar camada ${el.name}`
                    : `Exibir camada ${el.name}`
                }
                title={el.visible ? "Ocultar camada" : "Exibir camada"}
                className={`min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer touch-manipulation ${
                  el.visible
                    ? "text-[#9a9cab] hover:text-white"
                    : "text-[#ef4444]"
                }`}
              >
                {el.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>

              <button
                type="button"
                onClick={() => onToggleLock(el.id)}
                data-testid={`creation-layer-lock-${el.id}`}
                aria-label={
                  el.locked
                    ? `Desbloquear camada ${el.name}`
                    : `Bloquear camada ${el.name}`
                }
                title={el.locked ? "Desbloquear elemento" : "Bloquear elemento"}
                className={`min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer touch-manipulation ${
                  el.locked
                    ? "text-amber-400"
                    : "text-[#7d7f90] hover:text-white"
                }`}
              >
                {el.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>

            {isSelected && (
              <div className="flex items-center justify-between gap-1 px-2 py-1 border-t border-[#2a171c] bg-[#12090c]">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={isTopMost}
                    onClick={() => onBringToFront(el.id)}
                    data-testid={`creation-layer-front-${el.id}`}
                    title="Trazer para frente"
                    aria-label="Trazer camada para frente"
                    className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#b5b7c6] hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer touch-manipulation"
                  >
                    <ArrowUpToLine size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={isTopMost}
                    onClick={() => onMoveStep(el.id, "up")}
                    data-testid={`creation-layer-up-${el.id}`}
                    title="Subir 1 camada"
                    aria-label="Subir camada"
                    className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#b5b7c6] hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer touch-manipulation"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={isBottomMost}
                    onClick={() => onMoveStep(el.id, "down")}
                    data-testid={`creation-layer-down-${el.id}`}
                    title="Descer 1 camada"
                    aria-label="Descer camada"
                    className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#b5b7c6] hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer touch-manipulation"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={isBottomMost}
                    onClick={() => onSendToBack(el.id)}
                    data-testid={`creation-layer-back-${el.id}`}
                    title="Enviar para trás"
                    aria-label="Enviar camada para trás"
                    className="min-w-[30px] min-h-[30px] flex items-center justify-center text-[#b5b7c6] hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer touch-manipulation"
                  >
                    <ArrowDownToLine size={12} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onDelete(el.id)}
                  data-testid={`creation-layer-delete-${el.id}`}
                  title="Remover camada"
                  aria-label={`Remover camada ${el.name}`}
                  className="min-w-[30px] min-h-[30px] flex items-center justify-center text-red-400 hover:bg-red-950/50 cursor-pointer touch-manipulation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
