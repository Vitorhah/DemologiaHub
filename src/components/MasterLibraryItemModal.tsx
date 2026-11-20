import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { X, Save, Trash2, AlertTriangle, BookOpen, Flame, Sparkles } from "lucide-react";
import {
  MASTER_LIBRARY_TYPE_META,
  MasterLibraryFolder,
  MasterLibraryItem,
  MasterLibrarySkillData,
  MasterLibraryTributoData,
} from "../types/masterLibrary";
import {
  RitualItem,
  normalizeRitualCost,
  normalizeRitualDifficulty,
  normalizeRitualLevel,
} from "../utils/rituals";
import {
  createDefaultRitualData,
  createDefaultSkillData,
  createDefaultTributoData,
  getFolderPathLabel,
  normalizeLibrarySkillData,
  normalizeLibraryTributoData,
} from "../utils/masterLibrary";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";
import {
  RitualFormFields,
  SkillFormFields,
  TributoFormFields,
} from "./MasterLibraryFormFields";

export interface MasterLibraryItemModalProps {
  isOpen: boolean;
  mode: "ritual" | "skill" | "tributo" | null;
  initialItem: MasterLibraryItem | null;
  folders: MasterLibraryFolder[];
  defaultFolderId: string | null;
  onClose: () => void;
  onSave: (item: MasterLibraryItem) => Promise<void> | void;
  onDelete?: (itemId: string) => Promise<void> | void;
}

export const MasterLibraryItemModal: React.FC<MasterLibraryItemModalProps> = ({
  isOpen,
  mode,
  initialItem,
  folders,
  defaultFolderId,
  onClose,
  onSave,
  onDelete,
}) => {
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [ritualDraft, setRitualDraft] = useState<RitualItem>(() =>
    createDefaultRitualData()
  );
  const [skillDraft, setSkillDraft] = useState<MasterLibrarySkillData>(() =>
    createDefaultSkillData()
  );
  const [tributoDraft, setTributoDraft] = useState<MasterLibraryTributoData>(() =>
    createDefaultTributoData()
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveType = initialItem?.type === "ritual" || initialItem?.type === "skill" || initialItem?.type === "tributo"
    ? initialItem.type
    : mode;

  useEffect(() => {
    if (!isOpen || !effectiveType) return;
    setErrorMsg(null);
    setSaving(false);
    setFolderId(initialItem ? initialItem.folderId : defaultFolderId);

    if (effectiveType === "ritual") {
      setRitualDraft(
        initialItem?.type === "ritual"
          ? { ...initialItem.data, affiliations: [...initialItem.data.affiliations] }
          : createDefaultRitualData()
      );
    } else if (effectiveType === "skill") {
      setSkillDraft(
        initialItem?.type === "skill"
          ? { ...initialItem.data }
          : createDefaultSkillData()
      );
    } else if (effectiveType === "tributo") {
      setTributoDraft(
        initialItem?.type === "tributo"
          ? { ...initialItem.data }
          : createDefaultTributoData()
      );
    }
  }, [isOpen, effectiveType, initialItem, defaultFolderId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, saving, onClose]);

  const handleRitualChange = <K extends keyof RitualItem>(
    field: K,
    value: RitualItem[K] | string
  ) => {
    setErrorMsg(null);
    setRitualDraft((prev) => {
      if (field === "level") {
        return { ...prev, level: normalizeRitualLevel(value) };
      }
      if (field === "difficulty") {
        return {
          ...prev,
          difficulty:
            value === "" ? 0 : normalizeRitualDifficulty(value, prev.difficulty),
        };
      }
      if (field === "cost") {
        return { ...prev, cost: value === "" ? 0 : normalizeRitualCost(value) };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSkillChange = <K extends keyof MasterLibrarySkillData>(
    field: K,
    value: MasterLibrarySkillData[K] | string | number | boolean
  ) => {
    setErrorMsg(null);
    setSkillDraft((prev) => {
      if (field === "cost") {
        const parsed = Number(value);
        return {
          ...prev,
          cost: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleTributoChange = <K extends keyof MasterLibraryTributoData>(
    field: K,
    value: string
  ) => {
    setErrorMsg(null);
    setTributoDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveType || saving) return;

    const now = Date.now();
    const baseId =
      initialItem?.id ||
      `lib_${effectiveType}_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = initialItem?.createdAt || now;

    let itemToSave: MasterLibraryItem | null = null;

    if (effectiveType === "ritual") {
      if (!ritualDraft.name.trim()) {
        setErrorMsg("Informe o nome do Ritual.");
        return;
      }
      itemToSave = {
        id: baseId,
        type: "ritual",
        folderId,
        createdAt,
        updatedAt: now,
        data: {
          ...ritualDraft,
          name: ritualDraft.name.trim(),
          desc: ritualDraft.desc.trim(),
          damage: ritualDraft.damage.trim(),
          level: normalizeRitualLevel(ritualDraft.level),
          difficulty: normalizeRitualDifficulty(ritualDraft.difficulty),
          cost: normalizeRitualCost(ritualDraft.cost),
        },
      };
    } else if (effectiveType === "skill") {
      if (!skillDraft.name.trim()) {
        setErrorMsg("Informe o nome da Skill.");
        return;
      }
      const clean = normalizeLibrarySkillData(skillDraft, skillDraft.id || now);
      if (!clean) {
        setErrorMsg("Dados da Skill inválidos.");
        return;
      }
      itemToSave = {
        id: baseId,
        type: "skill",
        folderId,
        createdAt,
        updatedAt: now,
        data: clean,
      };
    } else if (effectiveType === "tributo") {
      if (!tributoDraft.name.trim()) {
        setErrorMsg("Informe o nome do Tributo.");
        return;
      }
      const clean = normalizeLibraryTributoData(tributoDraft);
      if (!clean) {
        setErrorMsg("Dados do Tributo inválidos.");
        return;
      }
      itemToSave = {
        id: baseId,
        type: "tributo",
        folderId,
        createdAt,
        updatedAt: now,
        data: clean,
      };
    }

    if (!itemToSave) return;

    setSaving(true);
    try {
      await onSave(itemToSave);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar arquivo na Biblioteca.");
    } finally {
      setSaving(false);
    }
  };

  const meta = effectiveType ? MASTER_LIBRARY_TYPE_META[effectiveType] : null;
  const HeaderIcon =
    effectiveType === "ritual"
      ? Flame
      : effectiveType === "skill"
        ? Sparkles
        : BookOpen;

  return (
    <AnimatePresence>
      {isOpen && effectiveType && meta && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[365] flex items-end sm:items-center justify-center p-0 sm:p-4 font-mono"
          onClick={() => {
            if (!saving) onClose();
          }}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-library-item-modal-title"
            className="w-full sm:max-w-2xl max-h-[90dvh] bg-[#0c0c10] border-t sm:border border-[#282834] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex flex-col min-h-0 overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-[var(--op-red)] shrink-0" />

            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-b border-[#202028] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <HeaderIcon
                    size={15}
                    className="text-[var(--op-red-bright)] shrink-0"
                  />
                  <h3
                    id="master-library-item-modal-title"
                    className="text-sm font-bold text-white uppercase tracking-wider truncate"
                  >
                    {initialItem
                      ? `Editar ${meta.label}`
                      : `Novo ${meta.label} na Biblioteca`}
                  </h3>
                </div>
                <p className="text-[11px] text-[#8c8d9c] mt-0.5 truncate">
                  {meta.description}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Fechar editor de arquivo"
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
                {/* Folder selector */}
                <div className="bg-[#09090d] border border-[#202028] p-3">
                  <label
                    htmlFor="library-item-folder-select"
                    className="block text-[10px] font-mono uppercase tracking-wider text-[#9a9ba8] mb-1"
                  >
                    Pasta de Destino na Biblioteca
                  </label>
                  <select
                    id="library-item-folder-select"
                    value={folderId || ""}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="input-dark mb-0"
                  >
                    <option value="">Raiz da Biblioteca</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {getFolderPathLabel(folders, f.id)}
                      </option>
                    ))}
                  </select>
                </div>

                {effectiveType === "ritual" && (
                  <RitualFormFields
                    ritual={ritualDraft}
                    onChange={handleRitualChange}
                  />
                )}
                {effectiveType === "skill" && (
                  <SkillFormFields
                    skill={skillDraft}
                    onChange={handleSkillChange}
                  />
                )}
                {effectiveType === "tributo" && (
                  <TributoFormFields
                    tributo={tributoDraft}
                    onChange={handleTributoChange}
                  />
                )}
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
              <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-t border-[#202028] flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  {initialItem && onDelete && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        await onDelete(initialItem.id);
                        onClose();
                      }}
                      className="min-h-[44px] px-3.5 bg-[#1b0a0d] hover:bg-[#2c1015] border border-[#611319] text-red-300 text-xs font-bold uppercase tracking-wider rounded-none transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation"
                    >
                      <Trash2 size={14} />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onClose}
                    className="min-h-[44px] px-4 bg-[#14141c] hover:bg-[#1e1e28] border border-[#2c2c38] text-[#9ca3af] hover:text-white text-xs font-bold uppercase tracking-wider rounded-none transition-colors cursor-pointer touch-manipulation"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] px-5 bg-[#8f171c] hover:bg-[#a91c22] disabled:opacity-50 border border-[#b9272d] text-white text-xs font-bold uppercase tracking-wider rounded-none transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation"
                  >
                    <Save size={14} />
                    <span>{saving ? "Salvando..." : `Salvar ${meta.label}`}</span>
                  </button>
                </div>
              </div>
            </form>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
