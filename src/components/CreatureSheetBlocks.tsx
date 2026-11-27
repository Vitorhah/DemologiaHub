import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  Eye,
  Flame,
  Folder,
  Heart,
  Link2,
  Minus,
  Plus,
  Search,
  Shield,
  Sparkles,
  Table2,
  Tag,
  Trash2,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import type { GameMode } from "../types";
import type {
  MasterLibraryItem,
  MasterLibrarySkillData,
  MasterLibrarySkillItem,
} from "../types/masterLibrary";
import type {
  CatalogRitualOption,
  CreatureAttributeKey,
  CreatureFolder,
  CreatureModeItem,
  CreatureRecord,
  CreatureSheetBlock,
  CreatureTableData,
  ResolvedCreatureRitual,
} from "../types/masterCreatures";
import {
  CREATURE_ATTRIBUTE_LABELS,
  CREATURE_ATTRIBUTE_ORDER,
  addExclusiveSkillToCreature,
  buildCreatureDescriptionPreview,
  calculateCreatureStats,
  createDefaultCreatureSkillData,
  detachLinkedSkillToExclusive,
  extractLibrarySkills,
  getCreatureFolderPathLabel,
  linkLibrarySkillToCreature,
  removeSkillFromCreature,
  resolveCreatureSkills,
  updateExclusiveCreatureSkill,
} from "../utils/masterCreatures";
import {
  getAttributeLimitForLevel,
  getMinimumLevelForAttributes,
  isAttributeOverLimit,
  parseAndValidateLevelChange,
  resolveAttributeUpdateWithProfile,
} from "../utils/levelSystem";
import {
  RITUAL_AFFILIATION_LIST,
  RITUAL_TEST_FORMULA,
  type RitualAffiliationId,
} from "../utils/rituals";
import {
  formatPdiModifierChips,
  getActivePdiBadgesForStat,
  type PdiItem,
} from "../utils/pdi";
import {
  CREATURE_TABLE_MAX_COLS,
  CREATURE_TABLE_MAX_ROWS,
  CREATURE_TABLE_MIN_COLS,
  CREATURE_TABLE_MIN_ROWS,
  addTableColumn,
  addTableRow,
  getSpreadsheetColumnLabel,
  linkRitualToCreature,
  moveCreatureMode,
  normalizeCreatureTableData,
  removeCreatureMode,
  removeTableColumn,
  removeTableRow,
  resolveCreatureRituals,
  toggleCreatureModeActive,
  toggleTableHeaderRow,
  unlinkRitualFromCreature,
  updateTableCell,
  upsertCreatureMode,
} from "../utils/creatureBlocks";
import { SkillFormFields } from "./MasterLibraryFormFields";
import { RitualAffiliationTag } from "./RitualsSection";
import { PdiEditorModal } from "./PdiEditorModal";
import {
  CreatureRichInlineText,
  CreatureRichText,
  CreatureRichTextQuickBar,
} from "./CreatureRichText";

// ============================================================================
// 1. BLOCO DE PERFIL (H2 Nome, LV integrado ao Status, Afiliações, Descrição)
// ============================================================================

export interface CreatureProfileBlockProps {
  creature: CreatureRecord;
  folders: CreatureFolder[];
  ritualCatalog: CatalogRitualOption[];
  isEditing: boolean;
  onUpdateCreature: (updater: (prev: CreatureRecord) => CreatureRecord) => void;
}

export const CreatureProfileBlock: React.FC<CreatureProfileBlockProps> =
  React.memo(function CreatureProfileBlock({
    creature,
    folders,
    ritualCatalog,
    isEditing,
    onUpdateCreature,
  }) {
    const [lvInput, setLvInput] = useState(String(creature.lv ?? 1));
    const [lvError, setLvError] = useState<string | null>(null);
    const [showDescPreview, setShowDescPreview] = useState(false);

    useEffect(() => {
      setLvInput(String(creature.lv ?? 1));
      setLvError(null);
    }, [creature.lv, creature.id]);

    const attrLimit = getAttributeLimitForLevel(creature.lv);
    const minRequiredLv = useMemo(
      () => getMinimumLevelForAttributes(creature.variables),
      [creature.variables],
    );

    const applyLevelChange = (rawNext: string | number) => {
      const validation = parseAndValidateLevelChange(rawNext, creature.variables);
      if (!validation.ok || validation.value === undefined) {
        setLvError(validation.error || "LV inválido.");
        return;
      }
      setLvError(null);
      setLvInput(String(validation.value));
      onUpdateCreature((prev) => ({
        ...prev,
        lv: validation.value!,
        updatedAt: Date.now(),
      }));
    };

    const toggleAffiliation = (affId: RitualAffiliationId) => {
      onUpdateCreature((prev) => {
        const exists = prev.affiliations.includes(affId);
        const nextAffs = exists
          ? prev.affiliations.filter((id) => id !== affId)
          : [...prev.affiliations, affId];
        return {
          ...prev,
          affiliations: nextAffs,
          updatedAt: Date.now(),
        };
      });
    };

    const handleInsertDescriptionSnippet = (snippet: string) => {
      onUpdateCreature((prev) => {
        const nextDesc = prev.description
          ? `${prev.description}${prev.description.endsWith(" ") || snippet.startsWith("\n") ? "" : " "}${snippet}`
          : snippet.trimStart();
        return {
          ...prev,
          description: nextDesc,
          descriptionPreview: buildCreatureDescriptionPreview(nextDesc),
          updatedAt: Date.now(),
        };
      });
    };

    if (!isEditing) {
      return (
        <div className="space-y-3" data-testid="creature-block-content-profile">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#12121a] border border-[#262634] text-[#9b9caa]">
                  <Folder size={10} className="text-[var(--op-red-bright)]" />
                  <span>{getCreatureFolderPathLabel(folders, creature.folderId)}</span>
                </span>
                <span
                  data-testid="creature-profile-lv-display"
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a0b0e] border border-[#8f171c]/70 text-white font-bold tabular-nums"
                >
                  <span>LV {creature.lv}</span>
                  <span className="text-[#ff8a90] font-normal">
                    · Teto {attrLimit}
                  </span>
                </span>
              </div>

              <h2
                data-testid="creature-profile-name-h2"
                className="text-lg sm:text-2xl font-bold text-white uppercase tracking-wider break-words leading-tight"
              >
                {creature.name}
              </h2>
            </div>
          </div>

          {creature.affiliations.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="creature-profile-affiliations-view"
            >
              {creature.affiliations.map((affId) => (
                <RitualAffiliationTag key={affId} affiliationId={affId} />
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-[#1c1c26]">
            <CreatureRichText
              text={creature.description}
              emptyText="Sem descrição registrada para esta criatura."
              ritualCatalog={ritualCatalog}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3.5" data-testid="creature-block-content-profile">
        {/* Nome (H2) + LV + Pasta */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_220px] gap-3 items-start">
          <div>
            <label
              htmlFor="creature-profile-name-input"
              className="block text-[10px] uppercase tracking-widest text-[#8e90a0] mb-1"
            >
              Nome da Criatura (H2) *
            </label>
            <input
              id="creature-profile-name-input"
              type="text"
              maxLength={140}
              value={creature.name}
              onChange={(e) =>
                onUpdateCreature((prev) => ({
                  ...prev,
                  name: e.target.value,
                  updatedAt: Date.now(),
                }))
              }
              placeholder="Ex: Devorador da Membrana..."
              data-testid="creature-profile-name-input"
              className="w-full min-h-[46px] bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-3 py-2 text-base sm:text-lg font-bold text-white uppercase tracking-wider outline-none rounded-none"
            />
          </div>

          <div>
            <label
              htmlFor="creature-profile-lv-input"
              className="block text-[10px] uppercase tracking-widest text-[#8e90a0] mb-1"
            >
              Nível (LV) · Teto {attrLimit}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Diminuir LV da criatura"
                data-testid="creature-profile-lv-dec"
                disabled={creature.lv <= minRequiredLv}
                onClick={() => applyLevelChange(creature.lv - 1)}
                className="min-w-[44px] min-h-[46px] bg-[#14141e] hover:bg-[#1e1e2b] border border-[#2a2a38] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
              >
                <Minus size={14} />
              </button>
              <input
                id="creature-profile-lv-input"
                type="number"
                min={minRequiredLv}
                max={99}
                inputMode="numeric"
                value={lvInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setLvInput(val);
                  if (/^\d+$/.test(val.trim())) {
                    applyLevelChange(val);
                  }
                }}
                onBlur={() => {
                  const check = parseAndValidateLevelChange(
                    lvInput,
                    creature.variables,
                  );
                  if (!check.ok) {
                    setLvInput(String(creature.lv));
                  }
                }}
                data-testid="creature-profile-lv-input"
                className="w-16 min-h-[46px] bg-[#0e0e15] border border-[#282838] focus:border-[var(--op-red-bright)] text-center text-base font-bold text-white tabular-nums outline-none rounded-none"
              />
              <button
                type="button"
                aria-label="Aumentar LV da criatura"
                data-testid="creature-profile-lv-inc"
                onClick={() => applyLevelChange(creature.lv + 1)}
                className="min-w-[44px] min-h-[46px] bg-[#14141e] hover:bg-[#1e1e2b] border border-[#2a2a38] text-white flex items-center justify-center cursor-pointer touch-manipulation"
              >
                <Plus size={14} />
              </button>
            </div>
            {lvError && (
              <p className="text-[10px] text-amber-300 mt-1 max-w-[200px]">
                {lvError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="creature-profile-folder-select"
              className="block text-[10px] uppercase tracking-widest text-[#8e90a0] mb-1"
            >
              Pasta na Biblioteca
            </label>
            <select
              id="creature-profile-folder-select"
              value={creature.folderId || ""}
              onChange={(e) =>
                onUpdateCreature((prev) => ({
                  ...prev,
                  folderId: e.target.value || null,
                  updatedAt: Date.now(),
                }))
              }
              data-testid="creature-profile-folder-select"
              className="w-full min-h-[46px] bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-2.5 text-xs text-white outline-none rounded-none"
            >
              <option value="">Criaturas (Raiz)</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {getCreatureFolderPathLabel(folders, folder.id)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Afiliações (reutilizando RitualAffiliationTag) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#8e90a0] flex items-center gap-1.5">
              <Tag size={11} className="text-[var(--op-red-bright)]" />
              <span>Afiliações</span>
            </span>
            {creature.affiliations.length > 0 && (
              <span className="text-[10px] text-[#7a7b8c]">
                {creature.affiliations.length} selecionada
                {creature.affiliations.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            data-testid="creature-profile-affiliations-picker"
          >
            {RITUAL_AFFILIATION_LIST.map((aff) => {
              const selected = creature.affiliations.includes(aff.id);
              return (
                <button
                  key={aff.id}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`creature-profile-aff-toggle-${aff.id}`}
                  onClick={() => toggleAffiliation(aff.id)}
                  className={`min-h-[34px] px-1.5 py-1 border transition-all cursor-pointer touch-manipulation inline-flex items-center gap-1 ${
                    selected
                      ? "bg-[#1a1116] border-white/80 opacity-100"
                      : "bg-[#0e0e15] border-[#222230] opacity-55 hover:opacity-90"
                  }`}
                >
                  <RitualAffiliationTag affiliationId={aff.id} compact />
                  {selected && <Check size={11} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Descrição com formatação rica */}
        <div className="space-y-1.5">
          <label
            htmlFor="creature-profile-desc-input"
            className="block text-[10px] uppercase tracking-widest text-[#8e90a0]"
          >
            Descrição · Formatação (**negrito**, ^^itálico^^, #(Afiliação), ---)
          </label>

          <CreatureRichTextQuickBar
            onInsertSnippet={handleInsertDescriptionSnippet}
            showPreview={showDescPreview}
            onTogglePreview={() => setShowDescPreview((p) => !p)}
          />

          {showDescPreview ? (
            <div className="min-h-[96px] bg-[#0a0a10] border border-[#242432] p-3">
              <CreatureRichText
                text={creature.description}
                emptyText="Digite uma descrição para visualizar a formatação."
                ritualCatalog={ritualCatalog}
              />
            </div>
          ) : (
            <textarea
              id="creature-profile-desc-input"
              rows={4}
              value={creature.description}
              onChange={(e) => {
                const nextDesc = e.target.value;
                onUpdateCreature((prev) => ({
                  ...prev,
                  description: nextDesc,
                  descriptionPreview: buildCreatureDescriptionPreview(nextDesc),
                  updatedAt: Date.now(),
                }));
              }}
              placeholder="Aparência, comportamento, fraquezas... Use **negrito**, ^^itálico^^, #(Membrana) e --- para divisórias."
              data-testid="creature-profile-desc-input"
              className="w-full bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-[#e0e1ec] placeholder-[#5e6070] outline-none resize-y rounded-none leading-relaxed"
            />
          )}
        </div>
      </div>
    );
  });

// ============================================================================
// 2. BLOCO DE STATUS (Atributos oficiais, PV/PE/SAN, LV teto, Badges de Modos)
// ============================================================================

export interface CreatureStatusBlockProps {
  creature: CreatureRecord;
  currentGlobalMode: GameMode;
  isEditing: boolean;
  onUpdateCreature: (updater: (prev: CreatureRecord) => CreatureRecord) => void;
}

export const CreatureStatusBlock: React.FC<CreatureStatusBlockProps> =
  React.memo(function CreatureStatusBlock({
    creature,
    currentGlobalMode,
    isEditing,
    onUpdateCreature,
  }) {
    const isRlMode = currentGlobalMode === "rl";
    const stats = useMemo(
      () => calculateCreatureStats(creature.variables),
      [creature.variables],
    );
    const attrLimit = getAttributeLimitForLevel(creature.lv);
    const activeModesCount = useMemo(
      () => (creature.modes || []).filter((m) => m.active).length,
      [creature.modes],
    );

    const handleAttributeChange = (
      attr: CreatureAttributeKey,
      requestedVal: number,
    ) => {
      onUpdateCreature((prev) => {
        const currentVal = prev.variables[attr] ?? 0;
        const resolved = resolveAttributeUpdateWithProfile({
          currentVal,
          requestedVal,
          lv: prev.lv,
          statKey: attr,
          min: 0,
        });
        const nextVars = { ...prev.variables, [attr]: resolved };
        const { hpMax, peMax, smMax } = calculateCreatureStats(nextVars);
        return {
          ...prev,
          variables: nextVars,
          hpMax,
          peMax,
          smMax,
          updatedAt: Date.now(),
        };
      });
    };

    const handleBumpLv = () => {
      onUpdateCreature((prev) => ({
        ...prev,
        lv: Math.min(99, (prev.lv || 1) + 1),
        updatedAt: Date.now(),
      }));
    };

    return (
      <div className="space-y-3" data-testid="creature-block-content-status">
        {/* Cabeçalho interno: LV + Teto + Modos ativos */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid="creature-status-lv-badge"
              className="px-2 py-0.5 bg-[#180a0d] border border-[#8f171c]/70 text-white font-bold uppercase tabular-nums"
            >
              LV {creature.lv} · Máx/Atrib: {attrLimit}
            </span>
            {activeModesCount > 0 && (
              <span className="px-2 py-0.5 bg-emerald-950/50 border border-emerald-600/50 text-emerald-300 uppercase tabular-nums">
                {activeModesCount} Modo{activeModesCount === 1 ? "" : "s"} ativo
                {activeModesCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={handleBumpLv}
              data-testid="creature-status-bump-lv-btn"
              title="Elevar LV da criatura para aumentar o teto de atributos (+2 por LV)"
              className="min-h-[28px] px-2 bg-[#14141e] hover:bg-[#1e1e2b] border border-[#2a2a38] text-[10px] text-[#c8c9d6] hover:text-white uppercase tracking-wider cursor-pointer"
            >
              +1 LV
            </button>
          )}
        </div>

        {/* Recursos Calculados (Fórmulas Oficiais Demologia) */}
        <div
          className={`grid gap-2 ${
            isRlMode ? "grid-cols-1" : "grid-cols-3"
          }`}
        >
          <div
            data-testid="creature-status-pv"
            className="bg-[#130b0e] border border-[#4f1922] p-2.5"
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-300">
              <Heart size={11} />
              <span>PV</span>
            </div>
            <div className="text-lg font-bold text-white tabular-nums mt-0.5">
              {stats.hpMax}
            </div>
            <div className="text-[9px] text-[#8d747a] tabular-nums">
              20 + VIT×6
            </div>
          </div>

          {!isRlMode && (
            <div
              data-testid="creature-status-pe"
              className="bg-[#0b111b] border border-sky-900/70 p-2.5"
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-sky-300">
                <Zap size={11} />
                <span>PE</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                {stats.peMax}
              </div>
              <div className="text-[9px] text-[#6d8299] tabular-nums">
                5 + AGL×3 + SAN×2
              </div>
            </div>
          )}

          {!isRlMode && (
            <div
              data-testid="creature-status-san"
              className="bg-[#110d1b] border border-violet-900/70 p-2.5"
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-violet-300">
                <Shield size={11} />
                <span>SAN</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                {stats.smMax}
              </div>
              <div className="text-[9px] text-[#7c7296] tabular-nums">
                30 + SAN×4
              </div>
            </div>
          )}
        </div>

        {/* Atributos Oficiais (VIT, AGL, FOR, OCU, INT, SAN) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CREATURE_ATTRIBUTE_ORDER.map((attr) => {
            const val = creature.variables[attr] ?? 0;
            const overLimit = isAttributeOverLimit(val, creature.lv, attr);
            const atLimit = val >= attrLimit;
            const pdiBadges = getActivePdiBadgesForStat(attr, creature.modes);

            return (
              <div
                key={attr}
                data-testid={`creature-stat-card-${attr}`}
                className={`p-2.5 border transition-colors ${
                  overLimit
                    ? "bg-[#1a1308] border-amber-500/70"
                    : "bg-[#101017] border-[#222230]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white tracking-wider">
                    {attr}
                  </span>
                  <span className="text-[9px] text-[#7d7e8f] uppercase truncate">
                    {CREATURE_ATTRIBUTE_LABELS[attr]}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Diminuir ${attr}`}
                      data-testid={`creature-stat-dec-${attr}`}
                      disabled={val <= 0}
                      onClick={() => handleAttributeChange(attr, val - 1)}
                      className="min-w-[34px] min-h-[36px] bg-[#161621] hover:bg-[#222232] border border-[#2a2a3a] text-white flex items-center justify-center cursor-pointer disabled:opacity-35 touch-manipulation"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(attrLimit, val)}
                      inputMode="numeric"
                      aria-label={`Valor de ${attr}`}
                      data-testid={`creature-stat-input-${attr}`}
                      value={val}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        handleAttributeChange(
                          attr,
                          Number.isFinite(parsed) ? parsed : 0,
                        );
                      }}
                      className="w-full min-w-0 min-h-[36px] bg-[#0a0a10] border border-[#262634] focus:border-[var(--op-red-bright)] text-center text-sm font-bold text-white tabular-nums outline-none rounded-none"
                    />
                    <button
                      type="button"
                      aria-label={`Aumentar ${attr}`}
                      data-testid={`creature-stat-inc-${attr}`}
                      disabled={atLimit}
                      title={
                        atLimit
                          ? `Teto de LV ${creature.lv} (${attrLimit}) atingido`
                          : `Aumentar ${attr}`
                      }
                      onClick={() => handleAttributeChange(attr, val + 1)}
                      className="min-w-[34px] min-h-[36px] bg-[#161621] hover:bg-[#222232] border border-[#2a2a3a] text-white flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-baseline justify-between gap-1">
                    <span className="text-xl font-bold text-white tabular-nums">
                      {val}
                    </span>
                    <span className="text-[9px] text-[#6e7080] tabular-nums">
                      / {attrLimit}
                    </span>
                  </div>
                )}

                {pdiBadges.length > 0 && (
                  <div
                    className="mt-1.5 flex flex-wrap gap-1"
                    data-testid={`creature-stat-mode-badges-${attr}`}
                  >
                    {pdiBadges.map((badge) => (
                      <span
                        key={badge.key}
                        title={`Modo ativo: ${badge.pdiName}`}
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tabular-nums border ${
                          badge.type === "buff"
                            ? "bg-emerald-950/60 border-emerald-600/60 text-emerald-300"
                            : "bg-red-950/60 border-red-700/70 text-red-300"
                        }`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}

                {overLimit && (
                  <div className="mt-1 text-[9px] text-amber-300 flex items-center gap-1">
                    <AlertTriangle size={10} className="shrink-0" />
                    <span>Acima do teto LV {creature.lv}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  });

// ============================================================================
// 3. BLOCO DE SKILLS (Reutiliza sistema existente sem duplicar Skills da Biblioteca)
// ============================================================================

export interface CreatureSkillsBlockProps {
  creature: CreatureRecord;
  libraryItems: MasterLibraryItem[];
  isEditing: boolean;
  onUpdateCreature: (updater: (prev: CreatureRecord) => CreatureRecord) => void;
}

export const CreatureSkillsBlock: React.FC<CreatureSkillsBlockProps> =
  React.memo(function CreatureSkillsBlock({
    creature,
    libraryItems,
    isEditing,
    onUpdateCreature,
  }) {
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [panelMode, setPanelMode] = useState<
      null | "new-exclusive" | "edit-exclusive" | "link-library"
    >(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [skillDraft, setSkillDraft] = useState<MasterLibrarySkillData>(() =>
      createDefaultCreatureSkillData(),
    );
    const [formError, setFormError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const resolvedSkills = useMemo(
      () => resolveCreatureSkills(creature.skills, libraryItems),
      [creature.skills, libraryItems],
    );

    const librarySkills = useMemo(
      () => extractLibrarySkills(libraryItems),
      [libraryItems],
    );

    const linkedLibraryIds = useMemo(
      () =>
        new Set(
          creature.skills
            .filter((s) => s.ownership === "linked" && s.librarySkillId)
            .map((s) => s.librarySkillId as string),
        ),
      [creature.skills],
    );

    const filteredLibrarySkills = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return librarySkills;
      return librarySkills.filter((item) => {
        const name = (item.data.name || "").toLowerCase();
        const desc = (item.data.desc || "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }, [librarySkills, search]);

    const toggleExpand = (id: string) => {
      setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSaveSkillForm = (e: React.FormEvent) => {
      e.preventDefault();
      if (!skillDraft.name.trim()) {
        setFormError("Informe o nome da Skill.");
        return;
      }
      setFormError(null);
      if (panelMode === "new-exclusive") {
        onUpdateCreature((prev) => addExclusiveSkillToCreature(prev, skillDraft));
      } else if (panelMode === "edit-exclusive" && editingEntryId) {
        onUpdateCreature((prev) =>
          updateExclusiveCreatureSkill(prev, editingEntryId, skillDraft),
        );
      }
      setPanelMode(null);
      setEditingEntryId(null);
    };

    const handleLinkLibrarySkill = (item: MasterLibrarySkillItem) => {
      const res = linkLibrarySkillToCreature(creature, item);
      if (res.ok === false) {
        setFormError(res.error);
        return;
      }
      setFormError(null);
      onUpdateCreature(() => res.creature);
    };

    return (
      <div className="space-y-3" data-testid="creature-block-content-skills">
        {isEditing && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="creature-skills-new-btn"
              onClick={() => {
                setFormError(null);
                setEditingEntryId(null);
                setSkillDraft(createDefaultCreatureSkillData());
                setPanelMode((p) =>
                  p === "new-exclusive" ? null : "new-exclusive",
                );
              }}
              className={`min-h-[36px] px-2.5 border text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                panelMode === "new-exclusive"
                  ? "bg-[var(--op-red)] border-[#ff8085]/50 text-white"
                  : "bg-[#14141e] hover:bg-[#1e1e2b] border-[#2a2a38] text-white"
              }`}
            >
              <Plus size={13} />
              <span>Criar Skill Própria</span>
            </button>

            <button
              type="button"
              data-testid="creature-skills-link-btn"
              onClick={() => {
                setFormError(null);
                setSearch("");
                setPanelMode((p) =>
                  p === "link-library" ? null : "link-library",
                );
              }}
              className={`min-h-[36px] px-2.5 border text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                panelMode === "link-library"
                  ? "bg-[#1a0b0e] border-[#8f171c] text-white font-bold"
                  : "bg-[#14141e] hover:bg-[#1e1e2b] border-[#2a2a38] text-[#c8c9d6] hover:text-white"
              }`}
            >
              <Link2 size={13} />
              <span>Vincular da Biblioteca ({librarySkills.length})</span>
            </button>
          </div>
        )}

        {formError && (
          <div className="px-2.5 py-2 bg-red-950/50 border border-red-700/70 text-[11px] text-red-200 flex items-center justify-between gap-2">
            <span>{formError}</span>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="p-0.5 text-red-300 hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Painel Inline: Criar / Editar Skill Própria */}
        {isEditing &&
          (panelMode === "new-exclusive" || panelMode === "edit-exclusive") && (
            <form
              onSubmit={handleSaveSkillForm}
              data-testid="creature-skill-inline-form"
              className="bg-[#0b0b12] border border-[#2d2d40] border-l-2 border-l-[var(--op-red)] p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                  {panelMode === "new-exclusive"
                    ? "Nova Skill Exclusiva da Criatura"
                    : "Editar Skill Exclusiva"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPanelMode(null);
                    setEditingEntryId(null);
                  }}
                  className="p-1 text-[#8a8b9c] hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <SkillFormFields
                skill={skillDraft}
                onChange={(field, value) =>
                  setSkillDraft((prev) => ({
                    ...prev,
                    [field]:
                      field === "cost"
                        ? Math.max(0, Number(value) || 0)
                        : value,
                  }))
                }
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e1e2b]">
                <button
                  type="button"
                  onClick={() => {
                    setPanelMode(null);
                    setEditingEntryId(null);
                  }}
                  className="min-h-[38px] px-3 bg-[#151520] border border-[#2a2a38] text-xs uppercase text-[#b4b5c2] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="creature-skill-save-btn"
                  className="min-h-[38px] px-4 bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {panelMode === "new-exclusive"
                    ? "Adicionar Skill"
                    : "Salvar Skill"}
                </button>
              </div>
            </form>
          )}

        {/* Painel Inline: Vincular Skill da Biblioteca */}
        {isEditing && panelMode === "link-library" && (
          <div
            data-testid="creature-skills-library-picker"
            className="bg-[#0b0b12] border border-[#2d2d40] border-l-2 border-l-[var(--op-red)] p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Vincular Skill da Biblioteca (sem duplicar)
              </span>
              <button
                type="button"
                onClick={() => setPanelMode(null)}
                className="p-1 text-[#8a8b9c] hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#727282]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar skill cadastrada na Biblioteca..."
                className="w-full min-h-[38px] bg-[#13131b] border border-[#282836] pl-8 pr-3 text-xs text-white outline-none rounded-none"
              />
            </div>

            {filteredLibrarySkills.length === 0 ? (
              <p className="text-[11px] text-[#7a7b8c] py-2">
                Nenhuma Skill encontrada na Biblioteca.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {filteredLibrarySkills.map((item) => {
                  const already = linkedLibraryIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="p-2 bg-[#12121b] border border-[#222230] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          <CreatureRichInlineText
                            text={item.data.name}
                            tone="dark"
                            interactiveAffiliations={false}
                          />
                        </div>
                        <div className="text-[10px] text-[#8a8b9c] truncate">
                          {item.data.cost > 0 ? `${item.data.cost} PE · ` : ""}
                          <CreatureRichInlineText
                            text={item.data.desc || "Sem descrição"}
                            tone="dark"
                            interactiveAffiliations={false}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => handleLinkLibrarySkill(item)}
                        className={`min-h-[34px] px-2.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 cursor-pointer ${
                          already
                            ? "bg-[#14141c] border-[#262634] text-[#6d6e7f] cursor-default"
                            : "bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] border-[#ff8085]/40 text-white"
                        }`}
                      >
                        {already ? "Vinculada" : "Vincular"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Lista de Skills da Criatura */}
        {resolvedSkills.length === 0 ? (
          <div className="p-4 bg-[#0a0a10] border border-dashed border-[#242432] text-center text-[11px] text-[#787989]">
            Nenhuma Skill vinculada a esta criatura.
          </div>
        ) : (
          <div className="space-y-2">
            {resolvedSkills.map(({ entry, resolvedData, isLibraryMissing }) => {
              const isExpanded = Boolean(expandedIds[entry.id]);
              return (
                <div
                  key={entry.id}
                  data-testid={`creature-skill-row-${entry.id}`}
                  className="bg-[#101018] border border-[#242432]"
                >
                  <div className="p-2.5 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(entry.id)}
                      className="text-left min-w-0 flex-1 flex items-start gap-2 cursor-pointer"
                    >
                      <span className="mt-0.5 text-[#8a8b9c] shrink-0">
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white uppercase tracking-wide break-words">
                            <CreatureRichInlineText
                              text={resolvedData.name}
                              tone="dark"
                              interactiveAffiliations={false}
                            />
                          </span>
                          {resolvedData.cost > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-[#0e1524] border border-sky-800/60 text-sky-300 font-bold tabular-nums">
                              {resolvedData.cost} PE
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 text-[9px] uppercase border ${
                              entry.ownership === "linked"
                                ? "bg-[#121622] border-indigo-700/50 text-indigo-300"
                                : "bg-[#18121a] border-[#382a3e] text-[#c8b6d6]"
                            }`}
                          >
                            {entry.ownership === "linked"
                              ? "Biblioteca"
                              : "Própria"}
                          </span>
                          {isLibraryMissing && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-amber-950/60 border border-amber-700/60 text-amber-300 uppercase">
                              Snapshot
                            </span>
                          )}
                        </div>
                        {!isExpanded && resolvedData.desc && (
                          <div className="text-[11px] text-[#9b9caa] line-clamp-1 mt-0.5">
                            <CreatureRichInlineText
                              text={resolvedData.desc}
                              tone="dark"
                              interactiveAffiliations={false}
                            />
                          </div>
                        )}
                      </div>
                    </button>

                    {isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.ownership === "exclusive" ? (
                          <button
                            type="button"
                            aria-label={`Editar skill ${resolvedData.name}`}
                            onClick={() => {
                              setFormError(null);
                              setEditingEntryId(entry.id);
                              setSkillDraft({ ...resolvedData });
                              setPanelMode("edit-exclusive");
                            }}
                            className="min-w-[32px] min-h-[32px] bg-[#161622] hover:bg-[#222232] border border-[#2a2a38] text-[#b4b5c2] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            <Edit2 size={12} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Desvincular e criar cópia editável exclusiva desta criatura"
                            onClick={() =>
                              onUpdateCreature((prev) =>
                                detachLinkedSkillToExclusive(
                                  prev,
                                  entry.id,
                                  libraryItems,
                                ),
                              )
                            }
                            className="min-w-[32px] min-h-[32px] bg-[#161622] hover:bg-[#222232] border border-[#2a2a38] text-[#b4b5c2] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            <Copy size={12} />
                          </button>
                        )}

                        <button
                          type="button"
                          aria-label={`Remover skill ${resolvedData.name} da criatura`}
                          title={
                            entry.ownership === "linked"
                              ? "Desvincular da criatura (preserva original na Biblioteca)"
                              : "Remover skill própria"
                          }
                          onClick={() =>
                            onUpdateCreature((prev) =>
                              removeSkillFromCreature(prev, entry.id),
                            )
                          }
                          className="min-w-[32px] min-h-[32px] bg-[#1a0b0e] hover:bg-[#2c1116] border border-[#5a1c24] text-red-300 flex items-center justify-center cursor-pointer"
                        >
                          {entry.ownership === "linked" ? (
                            <Unlink size={12} />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[#1c1c28] space-y-2 text-xs">
                      {resolvedData.desc && (
                        <CreatureRichText
                          text={resolvedData.desc}
                          emptyText=""
                          tone="dark"
                          className="!text-xs"
                        />
                      )}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {resolvedData.needsTest && (
                          <span className="px-2 py-0.5 bg-[#151520] border border-[#2a2a3a] text-[#d4d5e2]">
                            Teste: {resolvedData.test || "2d6"}
                            {resolvedData.testVar
                              ? ` + ${resolvedData.testVar}`
                              : ""}
                          </span>
                        )}
                        {resolvedData.damage && (
                          <span className="px-2 py-0.5 bg-[#1a0d10] border border-[#5a1e26] text-red-200">
                            Dano/Efeito: {resolvedData.damage}
                            {resolvedData.damageVar
                              ? ` + ${resolvedData.damageVar}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  });

// ============================================================================
// 4. BLOCO DE RITUAIS (Vincula Biblioteca + Fichas de Players sem duplicar)
// ============================================================================

const RitualDetailModal: React.FC<{
  item: ResolvedCreatureRitual;
  onClose: () => void;
}> = ({ item, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const { ritual, sourceLabel, isSourceMissing } = item;

  return createPortal(
    <div
      className="fixed inset-0 z-[380] bg-black/80 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do ritual ${ritual.name}`}
      data-testid="creature-ritual-detail-modal"
    >
      <div
        className="w-full sm:max-w-lg bg-[#09090e] border border-[#282836] border-t-2 border-t-[var(--op-red)] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.92)] font-mono max-h-[90dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#0e0e16] border-b border-[#1f1f2b] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#8a8b9c]">
              <Flame size={12} className="text-[var(--op-red-bright)]" />
              <span>Ritual Vinculado · {sourceLabel}</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider truncate mt-0.5">
              <CreatureRichInlineText
                text={ritual.name || "Ritual sem nome"}
                tone="dark"
              />
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do ritual"
            className="min-w-[38px] min-h-[38px] bg-[#14141d] hover:bg-[#1e1e2b] border border-[#282836] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#11111a] border border-[#242432] p-2">
              <div className="text-[9px] uppercase text-[#7c7d8e]">Nível / Círculo</div>
              <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
                NV {ritual.level}
              </div>
            </div>
            <div className="bg-[#11111a] border border-[#242432] p-2">
              <div className="text-[9px] uppercase text-[#7c7d8e]">Dificuldade</div>
              <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
                DIF {ritual.difficulty}
              </div>
            </div>
            <div className="bg-[#0d1422] border border-sky-900/60 p-2">
              <div className="text-[9px] uppercase text-sky-300">Custo</div>
              <div className="text-sm font-bold text-white mt-0.5 tabular-nums">
                {ritual.cost} PE
              </div>
            </div>
          </div>

          {ritual.affiliations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ritual.affiliations.map((affId) => (
                <RitualAffiliationTag key={affId} affiliationId={affId} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-[11px]">
            {ritual.needsTest && (
              <span className="px-2 py-1 bg-[#14141e] border border-[#2a2a38] text-[#d4d5e2]">
                Teste: {RITUAL_TEST_FORMULA}
              </span>
            )}
            {ritual.damage && (
              <span className="px-2 py-1 bg-[#1b0c10] border border-[#611a22] text-red-200">
                Dano / Efeito: {ritual.damage}
              </span>
            )}
          </div>

          <div className="bg-[#0e0e15] border border-[#222230] p-3">
            <div className="text-[9px] uppercase tracking-widest text-[#7c7d8e] mb-1.5">
              Descrição do Ritual
            </div>
            <CreatureRichText
              text={ritual.desc || ""}
              emptyText="Sem descrição registrada."
              tone="dark"
              className="!text-xs text-[#d2d3e0]"
            />
          </div>

          {isSourceMissing && (
            <div className="px-3 py-2 bg-amber-950/40 border border-amber-700/60 text-[11px] text-amber-200">
              A origem original deste ritual não está carregada na sessão atual; exibindo cópia de referência salva.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export interface CreatureRitualsBlockProps {
  creature: CreatureRecord;
  ritualCatalog: CatalogRitualOption[];
  isEditing: boolean;
  onUpdateCreature: (updater: (prev: CreatureRecord) => CreatureRecord) => void;
}

export const CreatureRitualsBlock: React.FC<CreatureRitualsBlockProps> =
  React.memo(function CreatureRitualsBlock({
    creature,
    ritualCatalog,
    isEditing,
    onUpdateCreature,
  }) {
    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState<"all" | "library" | "player">(
      "all",
    );
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [detailModalRitual, setDetailModalRitual] =
      useState<ResolvedCreatureRitual | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const resolvedRituals = useMemo(
      () => resolveCreatureRituals(creature.rituals || [], ritualCatalog),
      [creature.rituals, ritualCatalog],
    );

    const linkedKeys = useMemo(
      () =>
        new Set(
          (creature.rituals || []).map(
            (r) => `${r.source}:${r.sourceId}:${r.ritualId ?? ""}`,
          ),
        ),
      [creature.rituals],
    );

    const filteredCatalog = useMemo(() => {
      const q = search.trim().toLowerCase();
      return ritualCatalog.filter((opt) => {
        if (sourceFilter !== "all" && opt.source !== sourceFilter) return false;
        if (!q) return true;
        return (
          (opt.ritual.name || "").toLowerCase().includes(q) ||
          (opt.ritual.desc || "").toLowerCase().includes(q) ||
          opt.sourceLabel.toLowerCase().includes(q)
        );
      });
    }, [ritualCatalog, search, sourceFilter]);

    const handleLinkOption = (opt: CatalogRitualOption) => {
      const res = linkRitualToCreature(creature, opt);
      if (res.ok === false) {
        setErrorMsg(res.error);
        return;
      }
      setErrorMsg(null);
      onUpdateCreature(() => res.creature);
    };

    return (
      <div className="space-y-3" data-testid="creature-block-content-rituals">
        {isEditing && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              data-testid="creature-rituals-link-btn"
              onClick={() => {
                setErrorMsg(null);
                setShowPicker((p) => !p);
              }}
              className={`min-h-[36px] px-3 border text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                showPicker
                  ? "bg-[var(--op-red)] border-[#ff8085]/50 text-white"
                  : "bg-[#14141e] hover:bg-[#1e1e2b] border-[#2a2a38] text-white"
              }`}
            >
              <Link2 size={13} />
              <span>Vincular Ritual ({ritualCatalog.length})</span>
            </button>

            <span className="text-[10px] text-[#7c7d8e]">
              Biblioteca + Fichas de Players
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="px-2.5 py-2 bg-red-950/50 border border-red-700/70 text-[11px] text-red-200 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-0.5 text-red-300 hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {isEditing && showPicker && (
          <div
            data-testid="creature-rituals-picker"
            className="bg-[#0b0b12] border border-[#2d2d40] border-l-2 border-l-[var(--op-red)] p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Importar / Vincular Ritual Existente
              </span>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="p-1 text-[#8a8b9c] hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#727282]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar ritual por nome ou origem..."
                  data-testid="creature-rituals-search-input"
                  className="w-full min-h-[38px] bg-[#13131b] border border-[#282836] pl-8 pr-3 text-xs text-white outline-none rounded-none"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {(
                  [
                    { id: "all", label: "Todos" },
                    { id: "library", label: "Biblioteca" },
                    { id: "player", label: "Players" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSourceFilter(tab.id)}
                    className={`min-h-[38px] px-2.5 text-[10px] uppercase border cursor-pointer ${
                      sourceFilter === tab.id
                        ? "bg-[#1a0b0e] border-[#8f171c] text-white font-bold"
                        : "bg-[#12121a] border-[#262634] text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <p className="text-[11px] text-[#7a7b8c] py-2">
                Nenhum ritual disponível encontrado na Biblioteca ou nas fichas conectadas.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {filteredCatalog.map((opt) => {
                  const already = linkedKeys.has(opt.key);
                  return (
                    <div
                      key={opt.key}
                      data-testid={`creature-ritual-option-${opt.key}`}
                      className="p-2 bg-[#12121b] border border-[#222230] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            <CreatureRichInlineText
                              text={opt.ritual.name || "Ritual sem nome"}
                              tone="dark"
                              interactiveAffiliations={false}
                            />
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#181826] border border-[#2c2c40] text-[#b4b5c2]">
                            NV {opt.ritual.level} · {opt.ritual.cost} PE
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#11161f] border border-[#24324a] text-sky-300 uppercase">
                            {opt.sourceLabel}
                          </span>
                        </div>
                        {opt.ritual.affiliations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {opt.ritual.affiliations.map((aff) => (
                              <RitualAffiliationTag
                                key={aff}
                                affiliationId={aff}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={already}
                        onClick={() => handleLinkOption(opt)}
                        className={`min-h-[34px] px-2.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 cursor-pointer ${
                          already
                            ? "bg-[#14141c] border-[#262634] text-[#6d6e7f] cursor-default"
                            : "bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] border-[#ff8085]/40 text-white"
                        }`}
                      >
                        {already ? "Vinculado" : "Vincular"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Lista de Rituais Vinculados */}
        {resolvedRituals.length === 0 ? (
          <div className="p-4 bg-[#0a0a10] border border-dashed border-[#242432] text-center text-[11px] text-[#787989]">
            Nenhum ritual vinculado a esta criatura.
          </div>
        ) : (
          <div className="space-y-2">
            {resolvedRituals.map((resolved) => {
              const { ref, ritual, sourceLabel, isSourceMissing } = resolved;
              const isExpanded = Boolean(expandedIds[ref.id]);
              return (
                <div
                  key={ref.id}
                  data-testid={`creature-ritual-row-${ref.id}`}
                  className="bg-[#101018] border border-[#242432]"
                >
                  <div className="p-2.5 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((p) => ({
                          ...p,
                          [ref.id]: !p[ref.id],
                        }))
                      }
                      className="text-left min-w-0 flex-1 flex items-start gap-2 cursor-pointer"
                    >
                      <span className="mt-0.5 text-[#8a8b9c] shrink-0">
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white uppercase tracking-wide break-words">
                            <CreatureRichInlineText
                              text={ritual.name || "Ritual sem nome"}
                              tone="dark"
                              interactiveAffiliations={false}
                            />
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#1a0b0e] border border-[#8f171c]/60 text-[#ff8a90] font-bold tabular-nums">
                            NV {ritual.level}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#0e1524] border border-sky-800/60 text-sky-300 font-bold tabular-nums">
                            {ritual.cost} PE
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#14141e] border border-[#2a2a38] text-[#b4b5c2] tabular-nums">
                            DIF {ritual.difficulty}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-[#111520] border border-[#26324a] text-[#9ec5f8] uppercase">
                            {sourceLabel}
                          </span>
                          {isSourceMissing && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-amber-950/60 border border-amber-700/60 text-amber-300 uppercase">
                              Ref. salva
                            </span>
                          )}
                        </div>

                        {ritual.affiliations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ritual.affiliations.map((aff) => (
                              <RitualAffiliationTag
                                key={aff}
                                affiliationId={aff}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDetailModalRitual(resolved)}
                        title="Abrir detalhes completos do ritual"
                        data-testid={`creature-ritual-details-btn-${ref.id}`}
                        className="min-w-[32px] min-h-[32px] px-2 bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#c8c9d6] hover:text-white text-[10px] uppercase inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        <span className="hidden sm:inline">Detalhes</span>
                      </button>

                      {isEditing && (
                        <button
                          type="button"
                          aria-label={`Desvincular ritual ${ritual.name}`}
                          title="Desvincular ritual da criatura (não remove o original)"
                          onClick={() =>
                            onUpdateCreature((prev) =>
                              unlinkRitualFromCreature(prev, ref.id),
                            )
                          }
                          className="min-w-[32px] min-h-[32px] bg-[#1a0b0e] hover:bg-[#2c1116] border border-[#5a1c24] text-red-300 flex items-center justify-center cursor-pointer"
                        >
                          <Unlink size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[#1c1c28] space-y-2 text-xs">
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {ritual.needsTest && (
                          <span className="px-2 py-0.5 bg-[#151520] border border-[#2a2a3a] text-[#d4d5e2]">
                            Teste: {RITUAL_TEST_FORMULA}
                          </span>
                        )}
                        {ritual.damage && (
                          <span className="px-2 py-0.5 bg-[#1a0d10] border border-[#5a1e26] text-red-200">
                            Dano/Efeito: {ritual.damage}
                          </span>
                        )}
                      </div>
                      {ritual.desc && (
                        <CreatureRichText
                          text={ritual.desc}
                          emptyText=""
                          ritualCatalog={ritualCatalog}
                          tone="dark"
                          className="!text-xs"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {detailModalRitual && (
          <RitualDetailModal
            item={detailModalRitual}
            onClose={() => setDetailModalRitual(null)}
          />
        )}
      </div>
    );
  });

// ============================================================================
// 5. BLOCO DE MODOS (Baseado no sistema oficial de PDI — Buffs/Debuffs/Fases)
// ============================================================================

export interface CreatureModesBlockProps {
  creature: CreatureRecord;
  ritualCatalog: CatalogRitualOption[];
  isEditing: boolean;
  onUpdateCreature: (updater: (prev: CreatureRecord) => CreatureRecord) => void;
}

export const CreatureModesBlock: React.FC<CreatureModesBlockProps> =
  React.memo(function CreatureModesBlock({
    creature,
    ritualCatalog,
    isEditing,
    onUpdateCreature,
  }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMode, setEditingMode] = useState<CreatureModeItem | null>(
      null,
    );
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    const modes = creature.modes || [];

    const handleSaveModeFromPdiModal = (savedPdi: PdiItem) => {
      onUpdateCreature((prev) => {
        const existing = (prev.modes || []).find((m) => m.id === savedPdi.id);
        const merged: CreatureModeItem = {
          ...savedPdi,
          ...(existing?.notes ? { notes: existing.notes } : {}),
        };
        return {
          ...prev,
          modes: upsertCreatureMode(prev.modes || [], merged),
          updatedAt: Date.now(),
        };
      });
    };

    const handleDeleteMode = (modeId: string) => {
      onUpdateCreature((prev) => ({
        ...prev,
        modes: removeCreatureMode(prev.modes || [], modeId),
        updatedAt: Date.now(),
      }));
    };

    const handleUpdateModeNotes = (modeId: string, notes: string) => {
      onUpdateCreature((prev) => ({
        ...prev,
        modes: (prev.modes || []).map((m) =>
          m.id === modeId ? { ...m, notes } : m,
        ),
        updatedAt: Date.now(),
      }));
    };

    return (
      <div className="space-y-3" data-testid="creature-block-content-modes">
        {isEditing && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              data-testid="creature-modes-new-btn"
              onClick={() => {
                setEditingMode(null);
                setModalOpen(true);
              }}
              className="min-h-[36px] px-3 bg-[#14141e] hover:bg-[#1e1e2b] border border-[#2a2a38] text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer touch-manipulation"
            >
              <Plus size={13} />
              <span>Novo Modo</span>
            </button>
            <span className="text-[10px] text-[#7c7d8e]">
              Baseado no sistema PDI (Buffs &amp; Debuffs)
            </span>
          </div>
        )}

        {modes.length === 0 ? (
          <div className="p-4 bg-[#0a0a10] border border-dashed border-[#242432] text-center text-[11px] text-[#787989]">
            Nenhum modo/fase cadastrado para esta criatura.
          </div>
        ) : (
          <div className="space-y-2">
            {modes.map((mode, idx) => {
              const chips = formatPdiModifierChips(mode.modifiers);
              const isExpanded = Boolean(expandedIds[mode.id]);
              return (
                <div
                  key={mode.id}
                  data-testid={`creature-mode-row-${mode.id}`}
                  className={`border transition-colors ${
                    mode.active
                      ? "bg-[#0e1513] border-emerald-700/60"
                      : "bg-[#101018] border-[#242432]"
                  }`}
                >
                  <div className="p-2.5 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((p) => ({
                          ...p,
                          [mode.id]: !p[mode.id],
                        }))
                      }
                      className="text-left min-w-0 flex-1 flex items-start gap-2 cursor-pointer"
                    >
                      <span className="mt-0.5 text-[#8a8b9c] shrink-0">
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white uppercase tracking-wide break-words">
                            {mode.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                              mode.active
                                ? "bg-emerald-950/70 border-emerald-600/70 text-emerald-300"
                                : "bg-[#161620] border-[#2b2b38] text-[#8a8b9c]"
                            }`}
                          >
                            {mode.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>

                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {chips.map((chip, cIdx) => (
                              <span
                                key={`${mode.id}_${cIdx}`}
                                className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border tabular-nums ${
                                  chip.type === "buff"
                                    ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                                    : "bg-red-950/60 border-red-700/70 text-red-300"
                                }`}
                              >
                                {chip.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Alternar Ativo/Inativo funciona tanto em Visualizar quanto em Editar */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mode.active}
                        data-testid={`creature-mode-toggle-${mode.id}`}
                        onClick={() =>
                          onUpdateCreature((prev) => ({
                            ...prev,
                            modes: toggleCreatureModeActive(
                              prev.modes || [],
                              mode.id,
                            ),
                            updatedAt: Date.now(),
                          }))
                        }
                        className={`min-h-[32px] px-2 text-[10px] font-bold uppercase border cursor-pointer touch-manipulation ${
                          mode.active
                            ? "bg-emerald-900/60 border-emerald-500/70 text-emerald-200"
                            : "bg-[#151520] border-[#2a2a38] text-[#9b9caa] hover:text-white"
                        }`}
                      >
                        {mode.active ? "ON" : "OFF"}
                      </button>

                      {isEditing && (
                        <>
                          <button
                            type="button"
                            disabled={idx === 0}
                            aria-label={`Mover modo ${mode.name} para cima`}
                            onClick={() =>
                              onUpdateCreature((prev) => ({
                                ...prev,
                                modes: moveCreatureMode(
                                  prev.modes || [],
                                  mode.id,
                                  -1,
                                ),
                                updatedAt: Date.now(),
                              }))
                            }
                            className="min-w-[30px] min-h-[32px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-35"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === modes.length - 1}
                            aria-label={`Mover modo ${mode.name} para baixo`}
                            onClick={() =>
                              onUpdateCreature((prev) => ({
                                ...prev,
                                modes: moveCreatureMode(
                                  prev.modes || [],
                                  mode.id,
                                  1,
                                ),
                                updatedAt: Date.now(),
                              }))
                            }
                            className="min-w-[30px] min-h-[32px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#9b9caa] hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-35"
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Editar modo ${mode.name}`}
                            onClick={() => {
                              setEditingMode(mode);
                              setModalOpen(true);
                            }}
                            className="min-w-[32px] min-h-[32px] bg-[#151520] hover:bg-[#202030] border border-[#2a2a38] text-[#b4b5c2] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remover modo ${mode.name}`}
                            onClick={() => handleDeleteMode(mode.id)}
                            className="min-w-[32px] min-h-[32px] bg-[#1a0b0e] hover:bg-[#2c1116] border border-[#5a1c24] text-red-300 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[#1e1e2b] space-y-2 text-xs">
                      {mode.desc && (
                        <p className="text-[#c8c9d6] whitespace-pre-wrap leading-relaxed">
                          {mode.desc}
                        </p>
                      )}

                      {isEditing ? (
                        <div>
                          <label className="block text-[9px] uppercase tracking-widest text-[#7e8090] mb-1">
                            Comportamento / Notas de Fase (opcional)
                          </label>
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={mode.notes || ""}
                            onChange={(e) =>
                              handleUpdateModeNotes(mode.id, e.target.value)
                            }
                            placeholder="Gatilhos, mudanças táticas ou notas exclusivas deste modo..."
                            className="w-full bg-[#0c0c14] border border-[#262634] focus:border-[var(--op-red-bright)] px-2.5 py-1.5 text-xs text-[#d6d7e4] outline-none resize-y rounded-none"
                          />
                        </div>
                      ) : mode.notes ? (
                        <div className="pt-1.5 border-t border-[#1c1c28]">
                          <CreatureRichText
                            text={mode.notes}
                            ritualCatalog={ritualCatalog}
                          />
                        </div>
                      ) : !mode.desc ? (
                        <p className="text-[11px] text-[#757688] italic">
                          Sem descrição adicional.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <PdiEditorModal
          isOpen={modalOpen}
          initialPdi={editingMode}
          targetName={`Modo · ${creature.name}`}
          onClose={() => {
            setModalOpen(false);
            setEditingMode(null);
          }}
          onSave={handleSaveModeFromPdiModal}
          onDelete={handleDeleteMode}
        />
      </div>
    );
  });

// ============================================================================
// 6. BLOCO DE TEXTO (Conteúdo livre com formatação especial e redimensionamento)
// ============================================================================

export interface CreatureTextBlockProps {
  block: CreatureSheetBlock;
  ritualCatalog: CatalogRitualOption[];
  isEditing: boolean;
  onUpdateTextBlock: (
    blockId: string,
    patch: { title?: string; content?: string },
  ) => void;
}

export const CreatureTextBlock: React.FC<CreatureTextBlockProps> = React.memo(
  function CreatureTextBlock({
    block,
    ritualCatalog,
    isEditing,
    onUpdateTextBlock,
  }) {
    const [showPreview, setShowPreview] = useState(false);

    const handleInsertSnippet = (snippet: string) => {
      const current = block.content || "";
      const next = current
        ? `${current}${current.endsWith(" ") || snippet.startsWith("\n") ? "" : " "}${snippet}`
        : snippet.trimStart();
      onUpdateTextBlock(block.id, { content: next });
    };

    if (!isEditing) {
      return (
        <div
          className="space-y-2 h-full flex flex-col"
          data-testid={`creature-block-content-text-${block.id}`}
        >
          {block.title && (
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider border-b border-[#1d1d29] pb-1.5">
              {block.title}
            </h3>
          )}
          <div className="flex-1">
            <CreatureRichText
              text={block.content || ""}
              emptyText="Bloco de texto vazio."
              ritualCatalog={ritualCatalog}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="space-y-2 h-full flex flex-col"
        data-testid={`creature-block-content-text-${block.id}`}
      >
        <input
          type="text"
          maxLength={100}
          value={block.title || ""}
          onChange={(e) =>
            onUpdateTextBlock(block.id, { title: e.target.value })
          }
          placeholder="Título do bloco (ex: Lore, Fraquezas, Fases, Comportamento)..."
          aria-label="Título do bloco de texto"
          data-testid={`creature-text-block-title-${block.id}`}
          className="w-full min-h-[38px] bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-2.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider outline-none rounded-none"
        />

        <CreatureRichTextQuickBar
          onInsertSnippet={handleInsertSnippet}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((p) => !p)}
        />

        {showPreview ? (
          <div className="flex-1 min-h-[84px] bg-[#0a0a10] border border-[#242432] p-2.5">
            <CreatureRichText
              text={block.content || ""}
              emptyText="Digite conteúdo para visualizar a formatação."
              ritualCatalog={ritualCatalog}
            />
          </div>
        ) : (
          <textarea
            rows={4}
            value={block.content || ""}
            onChange={(e) =>
              onUpdateTextBlock(block.id, { content: e.target.value })
            }
            placeholder="Escreva notas livres, fraquezas, lore... Suporta **negrito**, ^^itálico^^, #(Afiliação) e ---"
            aria-label="Conteúdo do bloco de texto"
            data-testid={`creature-text-block-content-${block.id}`}
            className="w-full flex-1 min-h-[84px] bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-2.5 py-2 text-xs text-[#e0e1ec] placeholder-[#5e6070] outline-none resize-y rounded-none leading-relaxed"
          />
        )}
      </div>
    );
  },
);

// ============================================================================
// 7. BLOCO DE TABELA (Planilha estilo Excel com células formatáveis)
// ============================================================================

export interface CreatureTableBlockProps {
  block: CreatureSheetBlock;
  ritualCatalog: CatalogRitualOption[];
  isEditing: boolean;
  onUpdateTableBlock: (
    blockId: string,
    patch: { title?: string; tableData?: CreatureTableData },
  ) => void;
}

export const CreatureTableBlock: React.FC<CreatureTableBlockProps> = React.memo(
  function CreatureTableBlock({
    block,
    ritualCatalog,
    isEditing,
    onUpdateTableBlock,
  }) {
    const tableData = useMemo(
      () => normalizeCreatureTableData(block.tableData),
      [block.tableData],
    );
    const [showPreview, setShowPreview] = useState(false);
    const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({
      row: 0,
      col: 0,
    });
    const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    const rowCount = tableData.rows.length;
    const colCount = tableData.rows[0]?.length || 1;
    const safeActiveRow = Math.min(activeCell.row, Math.max(0, rowCount - 1));
    const safeActiveCol = Math.min(activeCell.col, Math.max(0, colCount - 1));
    const activeCoord = `${getSpreadsheetColumnLabel(safeActiveCol)}${safeActiveRow + 1}`;

    const commitTableData = (next: CreatureTableData) => {
      onUpdateTableBlock(block.id, { tableData: next });
    };

    const focusCell = (row: number, col: number) => {
      const clampedRow = Math.max(0, Math.min(rowCount - 1, row));
      const clampedCol = Math.max(0, Math.min(colCount - 1, col));
      setActiveCell({ row: clampedRow, col: clampedCol });
      requestAnimationFrame(() => {
        const el = cellInputRefs.current.get(`${clampedRow}:${clampedCol}`);
        if (el) {
          el.focus();
        }
      });
    };

    const handleCellKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowIdx: number,
      colIdx: number,
    ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (rowIdx + 1 < rowCount) {
          focusCell(rowIdx + 1, colIdx);
        } else if (rowCount < CREATURE_TABLE_MAX_ROWS) {
          const next = addTableRow(tableData);
          commitTableData(next);
          setActiveCell({ row: rowIdx + 1, col: colIdx });
          requestAnimationFrame(() => {
            cellInputRefs.current.get(`${rowIdx + 1}:${colIdx}`)?.focus();
          });
        }
        return;
      }

      if (e.key === "ArrowDown") {
        if (rowIdx + 1 < rowCount) {
          e.preventDefault();
          focusCell(rowIdx + 1, colIdx);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        if (rowIdx - 1 >= 0) {
          e.preventDefault();
          focusCell(rowIdx - 1, colIdx);
        }
        return;
      }

      const input = e.currentTarget;
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;

      if (
        e.key === "ArrowRight" &&
        selStart === input.value.length &&
        selEnd === input.value.length &&
        colIdx + 1 < colCount
      ) {
        e.preventDefault();
        focusCell(rowIdx, colIdx + 1);
        return;
      }

      if (
        e.key === "ArrowLeft" &&
        selStart === 0 &&
        selEnd === 0 &&
        colIdx - 1 >= 0
      ) {
        e.preventDefault();
        focusCell(rowIdx, colIdx - 1);
      }
    };

    const handleInsertRichSnippetInActiveCell = (snippet: string) => {
      const currentVal = tableData.rows[safeActiveRow]?.[safeActiveCol] ?? "";
      const nextVal = currentVal
        ? `${currentVal}${currentVal.endsWith(" ") ? "" : " "}${snippet}`
        : snippet.trim();
      commitTableData(
        updateTableCell(tableData, safeActiveRow, safeActiveCol, nextVal),
      );
      requestAnimationFrame(() => {
        cellInputRefs.current.get(`${safeActiveRow}:${safeActiveCol}`)?.focus();
      });
    };

    const renderReadOnlyTable = () => {
      const headerRow =
        tableData.hasHeaderRow && tableData.rows.length > 0
          ? tableData.rows[0]
          : null;
      const bodyRows = tableData.hasHeaderRow
        ? tableData.rows.slice(1)
        : tableData.rows;

      return (
        <div
          className="w-full overflow-x-auto border border-[#242434] bg-[#0a0a10]"
          data-testid={`creature-table-view-${block.id}`}
        >
          <table className="w-full border-collapse text-left text-xs font-mono">
            {headerRow && (
              <thead>
                <tr className="bg-[#180b0f] border-b border-[#521c25]">
                  {headerRow.map((cell, cIdx) => (
                    <th
                      key={`th_${cIdx}`}
                      className="px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-white border-r border-[#2d1e26] last:border-r-0 align-top whitespace-normal break-words min-w-[96px]"
                    >
                      <CreatureRichInlineText
                        text={cell}
                        emptyText={getSpreadsheetColumnLabel(cIdx)}
                        ritualCatalog={ritualCatalog}
                        tone="dark"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-3 py-3 text-center text-[11px] text-[#757688] italic"
                  >
                    Nenhuma linha de dados preenchida.
                  </td>
                </tr>
              ) : (
                bodyRows.map((row, rIdx) => (
                  <tr
                    key={`tr_${rIdx}`}
                    className={`border-b border-[#1d1d2a] last:border-b-0 ${
                      rIdx % 2 === 1 ? "bg-[#0e0e16]" : "bg-[#0a0a10]"
                    }`}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={`td_${rIdx}_${cIdx}`}
                        className="px-2.5 py-2 text-xs text-[#d0d1df] border-r border-[#1f1f2d] last:border-r-0 align-top whitespace-normal break-words min-w-[96px]"
                      >
                        <CreatureRichInlineText
                          text={cell}
                          emptyText="—"
                          ritualCatalog={ritualCatalog}
                          tone="dark"
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    };

    if (!isEditing) {
      return (
        <div
          className="space-y-2 h-full flex flex-col min-w-0"
          data-testid={`creature-block-content-table-${block.id}`}
        >
          {block.title && (
            <div className="flex items-center gap-1.5 border-b border-[#1d1d29] pb-1.5">
              <Table2
                size={13}
                className="text-[var(--op-red-bright)] shrink-0"
              />
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                {block.title}
              </h3>
            </div>
          )}
          <div className="flex-1 min-w-0">{renderReadOnlyTable()}</div>
        </div>
      );
    }

    return (
      <div
        className="space-y-2.5 h-full flex flex-col min-w-0"
        data-testid={`creature-block-content-table-${block.id}`}
      >
        <input
          type="text"
          maxLength={100}
          value={block.title || ""}
          onChange={(e) =>
            onUpdateTableBlock(block.id, { title: e.target.value })
          }
          placeholder="Título da tabela (ex: Tabela de Fases, Ações, Resistências)..."
          aria-label="Título do bloco de tabela"
          data-testid={`creature-table-title-${block.id}`}
          className="w-full min-h-[38px] bg-[#12121a] border border-[#282838] focus:border-[var(--op-red-bright)] px-2.5 py-1.5 text-xs font-bold text-white uppercase tracking-wider outline-none rounded-none"
        />

        {/* Barra de ferramentas estilo planilha (Excel) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-[#0e0e16] border border-[#232332] px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid={`creature-table-active-cell-${block.id}`}
              className="min-h-[28px] px-2 bg-[#1a0b0e] border border-[#7c171d] text-[10px] font-bold text-[#ff9aa0] inline-flex items-center tabular-nums"
              title="Célula ativa na planilha"
            >
              {activeCoord}
            </span>

            <button
              type="button"
              disabled={rowCount >= CREATURE_TABLE_MAX_ROWS}
              data-testid={`creature-table-add-row-${block.id}`}
              onClick={() => commitTableData(addTableRow(tableData))}
              className="min-h-[30px] px-2 bg-[#151520] hover:bg-[#1e1e2c] disabled:opacity-40 border border-[#2a2a38] text-[10px] font-bold uppercase tracking-wider text-white inline-flex items-center gap-1 cursor-pointer touch-manipulation"
            >
              <Plus size={11} className="text-[var(--op-red-bright)]" />
              <span>Linha</span>
            </button>

            <button
              type="button"
              disabled={colCount >= CREATURE_TABLE_MAX_COLS}
              data-testid={`creature-table-add-col-${block.id}`}
              onClick={() => commitTableData(addTableColumn(tableData))}
              className="min-h-[30px] px-2 bg-[#151520] hover:bg-[#1e1e2c] disabled:opacity-40 border border-[#2a2a38] text-[10px] font-bold uppercase tracking-wider text-white inline-flex items-center gap-1 cursor-pointer touch-manipulation"
            >
              <Plus size={11} className="text-[var(--op-red-bright)]" />
              <span>Coluna</span>
            </button>

            <button
              type="button"
              data-testid={`creature-table-toggle-header-${block.id}`}
              onClick={() => commitTableData(toggleTableHeaderRow(tableData))}
              className={`min-h-[30px] px-2 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation ${
                tableData.hasHeaderRow
                  ? "bg-[#190b0f] border-[#8f171c] text-white font-bold"
                  : "bg-[#14141e] border-[#282836] text-[#8d8e9f] hover:text-white"
              }`}
              title="Alternar estilo de cabeçalho na linha 1"
            >
              Cabeçalho: {tableData.hasHeaderRow ? "ON" : "OFF"}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#7c7d8e] tabular-nums hidden sm:inline">
              {rowCount}×{colCount}
            </span>
            <button
              type="button"
              data-testid={`creature-table-preview-toggle-${block.id}`}
              onClick={() => setShowPreview((p) => !p)}
              className={`min-h-[30px] px-2.5 border text-[10px] uppercase tracking-wider cursor-pointer touch-manipulation ${
                showPreview
                  ? "bg-[#190a0d] border-[#8f171c] text-white font-bold"
                  : "bg-[#14141e] hover:bg-[#1d1d2b] border-[#282836] text-[#9b9caa] hover:text-white"
              }`}
            >
              {showPreview ? "Editar Planilha" : "Prévia"}
            </button>
          </div>
        </div>

        {!showPreview && (
          <CreatureRichTextQuickBar
            compact
            showDivider={false}
            label={`Célula ${activeCoord}:`}
            onInsertSnippet={handleInsertRichSnippetInActiveCell}
          />
        )}

        {showPreview ? (
          <div className="flex-1 min-w-0">{renderReadOnlyTable()}</div>
        ) : (
          <div
            className="w-full overflow-x-auto border border-[#282838] bg-[#08080d]"
            data-testid={`creature-table-editor-${block.id}`}
          >
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-[#12121b] border-b border-[#2a2a3a]">
                  <th
                    className="w-11 min-w-[44px] px-1.5 py-1.5 text-center text-[9px] text-[#6d6f80] border-r border-[#262636] select-none"
                    title="Linhas × Colunas"
                  >
                    {rowCount}×{colCount}
                  </th>
                  {Array.from({ length: colCount }, (_, cIdx) => {
                    const colLetter = getSpreadsheetColumnLabel(cIdx);
                    const isColActive = safeActiveCol === cIdx;
                    return (
                      <th
                        key={`col_hdr_${cIdx}`}
                        className={`min-w-[116px] px-1.5 py-1 border-r border-[#242434] last:border-r-0 select-none ${
                          isColActive
                            ? "bg-[#1e0d12] text-[#ff9aa0]"
                            : "text-[#8a8b9d]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold tracking-wider mx-auto">
                            {colLetter}
                          </span>
                          {colCount > CREATURE_TABLE_MIN_COLS && (
                            <button
                              type="button"
                              aria-label={`Remover coluna ${colLetter}`}
                              title={`Remover coluna ${colLetter}`}
                              data-testid={`creature-table-remove-col-${block.id}-${cIdx}`}
                              onClick={() =>
                                commitTableData(
                                  removeTableColumn(tableData, cIdx),
                                )
                              }
                              className="w-5 h-5 flex items-center justify-center text-[#7c7d8e] hover:text-red-300 hover:bg-[#2a1016] cursor-pointer shrink-0"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rIdx) => {
                  const isHeaderStyled = tableData.hasHeaderRow && rIdx === 0;
                  const isRowActive = safeActiveRow === rIdx;
                  return (
                    <tr
                      key={`edit_row_${rIdx}`}
                      className="border-b border-[#1e1e2b] last:border-b-0"
                    >
                      <td
                        className={`w-11 min-w-[44px] px-1 py-0.5 text-center border-r border-[#262636] select-none ${
                          isRowActive
                            ? "bg-[#1e0d12] text-[#ff9aa0]"
                            : "bg-[#101018] text-[#7c7d8e]"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-[10px] font-bold tabular-nums">
                            {rIdx + 1}
                          </span>
                          {rowCount > CREATURE_TABLE_MIN_ROWS && (
                            <button
                              type="button"
                              aria-label={`Remover linha ${rIdx + 1}`}
                              title={`Remover linha ${rIdx + 1}`}
                              data-testid={`creature-table-remove-row-${block.id}-${rIdx}`}
                              onClick={() =>
                                commitTableData(removeTableRow(tableData, rIdx))
                              }
                              className="w-4 h-4 flex items-center justify-center text-[#707184] hover:text-red-300 hover:bg-[#2a1016] cursor-pointer shrink-0"
                            >
                              <X size={9} />
                            </button>
                          )}
                        </div>
                      </td>
                      {row.map((cell, cIdx) => {
                        const isCellActive =
                          safeActiveRow === rIdx && safeActiveCol === cIdx;
                        const cellKey = `${rIdx}:${cIdx}`;
                        return (
                          <td
                            key={`edit_cell_${cellKey}`}
                            className={`p-0 border-r border-[#20202e] last:border-r-0 ${
                              isHeaderStyled
                                ? "bg-[#160b0f]"
                                : rIdx % 2 === 1
                                  ? "bg-[#0d0d14]"
                                  : "bg-[#0a0a10]"
                            }`}
                          >
                            <input
                              ref={(el) => {
                                if (el) {
                                  cellInputRefs.current.set(cellKey, el);
                                } else {
                                  cellInputRefs.current.delete(cellKey);
                                }
                              }}
                              type="text"
                              value={cell}
                              onFocus={() =>
                                setActiveCell({ row: rIdx, col: cIdx })
                              }
                              onChange={(e) =>
                                commitTableData(
                                  updateTableCell(
                                    tableData,
                                    rIdx,
                                    cIdx,
                                    e.target.value,
                                  ),
                                )
                              }
                              onKeyDown={(e) =>
                                handleCellKeyDown(e, rIdx, cIdx)
                              }
                              aria-label={`Célula ${getSpreadsheetColumnLabel(cIdx)}${rIdx + 1}`}
                              data-testid={`creature-table-cell-${block.id}-${rIdx}-${cIdx}`}
                              placeholder={
                                isHeaderStyled
                                  ? `Cabeçalho ${getSpreadsheetColumnLabel(cIdx)}`
                                  : ""
                              }
                              className={`w-full min-h-[34px] px-2 py-1.5 bg-transparent outline-none rounded-none text-xs transition-colors ${
                                isHeaderStyled
                                  ? "font-bold text-white uppercase tracking-wide placeholder-[#68464d]"
                                  : "text-[#e0e1ec] placeholder-[#454656]"
                              } ${
                                isCellActive
                                  ? "ring-1 ring-inset ring-[var(--op-red-bright)] bg-[#190c11]/70"
                                  : "focus:ring-1 focus:ring-inset focus:ring-[var(--op-red-bright)]"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
);
