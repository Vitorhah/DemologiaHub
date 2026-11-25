import React from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Trash2,
  Maximize2,
  Heart,
  Zap,
  Brain,
  Plus,
  Minus,
  MessageSquare,
  Flame,
  EyeOff,
  Dices,
  Tag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
  Check,
  SlidersHorizontal,
  AlertTriangle,
  ArrowLeftRight,
  Play,
  Square,
  SkipBack,
  SkipForward,
  Bell,
  BellOff,
  Layers,
} from "lucide-react";
import { GameMode } from "../types";
import { StatMathInput } from "./StatMathInput";
import { MasterEpEditor } from "./MasterEpEditor";
import { MasterLvEditor } from "./MasterLvEditor";
import { StatusEffectsEditor, StatusPostIt } from "./StatusPostIts";
import { MasterUltimoSuspiroControls } from "./MasterUltimoSuspiroControls";
import { PdiSection } from "./PdiSection";
import { PdiEditorModal } from "./PdiEditorModal";
import { PROFILE_THEME_MAP, ProfileSymbolIcon } from "./CharacterProfileButton";
import {
  STATUS_PRESETS,
  StatusEffect,
  togglePresetStatusEffect,
} from "../utils/statusEffects";
import {
  BatchStatTarget,
  CombatTurnState,
} from "../types/sceneDirector";
import {
  advanceCombatTurn,
  computeBatchStatValue,
  createInitialCombatTurnState,
  reconcileCombatTurnState,
  startCombatRounds,
  stopCombatRounds,
} from "../utils/sceneDirector";
import {
  PdiItem,
  normalizePdis,
  removePdiItem,
  togglePdiActive,
  upsertPdiItem,
} from "../utils/pdi";
import {
  getProfileDefinition,
  normalizeCharacterProfile,
} from "../utils/profiles";
import { normalizeEpValue } from "../utils/epLogic";
import { normalizeLevel } from "../utils/levelSystem";
import { normalizeUltimoSuspiroState } from "../utils/ultimoSuspiro";
import { sanitizeRollHistoryHtml } from "../utils/security";
import { MotionAccordion } from "./MotionPrimitives";
import {
  InitiativeFilterState,
  clearInitiativeSelection,
  createInitialInitiativeFilterState,
  filterInitiativeParticipants,
  invertInitiativeSelection,
  reconcileInitiativeSelection,
  selectAllInitiativeParticipants,
  setInitiativeFilterActive,
  toggleInitiativeParticipant,
} from "../utils/initiativeFilter";

const FILTER_BTN_MOTION =
  "transform-gpu will-change-transform transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.95] select-none touch-manipulation";

const CHECKBOX_BTN_MOTION =
  "transform-gpu will-change-transform transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.88] select-none touch-manipulation";

const CHECK_ICON_MOTION =
  "transform-gpu transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]";

export interface MasterPlayersViewProps {
  players: any[];
  extraFichas: any[];
  initiatives: Record<string, number>;
  onKickPlayer: (player: any) => void;
  onOpenInteractiveSheet: (sheetId: string) => void;
  onUpdateStat: (
    player: any,
    stat: "hp" | "pe" | "sm",
    val: number,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  onUpdateStatusEffects?: (
    player: any,
    effects: StatusEffect[],
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  onUpdatePdis?: (
    player: any,
    pdis: PdiItem[],
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  onUpdateEp?: (
    player: any,
    nextEp: number,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onUpdateLv?: (
    player: any,
    nextLv: number,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onAdvanceUltimoSuspiroTurn?: (
    player: any,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  onFinalizeUltimoSuspiroDeath?: (
    player: any,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  onRevivePlayer?: (
    player: any,
    targetHp: number,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  isMaster?: boolean;
  viewMode?: "grid" | "list";
  onClearChatHistory?: () => void;
  onRollInitiative?: (selectedIds?: string[]) => void;
  playerModes?: Record<string, GameMode>;
  currentGlobalMode?: GameMode;
  onTogglePlayerMode?: (playerId: string) => void;
  initiativeFilterRef?: React.MutableRefObject<InitiativeFilterState>;
  onNotifyTurn?: (participant: any, round: number) => void;
}

export function MasterPlayersView({
  players,
  extraFichas,
  initiatives,
  onKickPlayer,
  onOpenInteractiveSheet,
  onUpdateStat,
  onUpdateStatusEffects,
  onUpdatePdis,
  onUpdateEp,
  onUpdateLv,
  onAdvanceUltimoSuspiroTurn,
  onFinalizeUltimoSuspiroDeath,
  onRevivePlayer,
  isMaster = false,
  viewMode = "grid",
  onClearChatHistory,
  onRollInitiative,
  playerModes = {},
  currentGlobalMode = "demologia",
  onTogglePlayerMode,
  initiativeFilterRef,
  onNotifyTurn,
}: MasterPlayersViewProps) {
  const [expandedStatusId, setExpandedStatusId] = React.useState<string | null>(null);
  const [expandedPdiId, setExpandedPdiId] = React.useState<string | null>(null);
  const [pdiEditorTarget, setPdiEditorTarget] = React.useState<{
    player: any;
    initialPdi: PdiItem | null;
  } | null>(null);
  const [rollWarning, setRollWarning] = React.useState<string | null>(null);
  const [showQuickSelector, setShowQuickSelector] = React.useState(false);
  const [showBatchPanel, setShowBatchPanel] = React.useState(false);
  const [batchStat, setBatchStat] = React.useState<BatchStatTarget>("hp");
  const [batchDeltaInput, setBatchDeltaInput] = React.useState<string>("-5");
  const [batchFeedback, setBatchFeedback] = React.useState<string | null>(null);
  const [combatTurn, setCombatTurn] = React.useState<CombatTurnState>(() =>
    createInitialCombatTurnState(),
  );
  const [filterState, setFilterState] = React.useState<InitiativeFilterState>(() =>
    initiativeFilterRef?.current ?? createInitialInitiativeFilterState(),
  );
  const isRlGlobal = currentGlobalMode === "rl";

  const syncedExtrasAsPlayers = React.useMemo(
    () =>
      extraFichas
        .filter((f) => f.synchronized)
        .map((f) => ({
          id: `EXTRA_FICHA_${f.id}`,
          name: f.name || "Ficha Extra",
          hp: f.hp || { current: 0, max: 100 },
          pe: f.pe || { current: 0, max: 100 },
          sm: f.sm || f.san || { current: 100, max: 100 },
          ep: normalizeEpValue(f.ep, 0),
          lv: normalizeLevel(
            f.lv,
            f.variables,
            normalizeCharacterProfile(f.profile),
          ),
          profile: normalizeCharacterProfile(f.profile),
          variables: f.variables || {},
          statusEffects: f.statusEffects || [],
          ultimoSuspiro: normalizeUltimoSuspiroState(
            f.ultimoSuspiro,
            f.hp?.current ?? 0,
          ),
          history:
            f.history ||
            (f.notes ? [`<span style="color: #888;">${f.notes}</span>`] : []),
          isExtraSheet: true,
          rawExtraSheetId: f.id,
        })),
    [extraFichas],
  );

  const rawCombined = React.useMemo(
    () => [...players, ...syncedExtrasAsPlayers],
    [players, syncedExtrasAsPlayers],
  );

  const participantIds = React.useMemo(
    () => rawCombined.map((p) => p.id),
    [rawCombined],
  );

  const reconciledFilter = React.useMemo(
    () => reconcileInitiativeSelection(filterState, participantIds),
    [filterState, participantIds],
  );

  React.useEffect(() => {
    if (initiativeFilterRef) {
      initiativeFilterRef.current = reconciledFilter;
    }
    if (reconciledFilter !== filterState) {
      setFilterState(reconciledFilter);
    }
  }, [reconciledFilter, filterState, initiativeFilterRef]);

  const updateFilterState = React.useCallback(
    (updater: (prev: InitiativeFilterState) => InitiativeFilterState) => {
      setFilterState((prev) => {
        const next = updater(prev);
        if (initiativeFilterRef) {
          initiativeFilterRef.current = next;
        }
        return next;
      });
    },
    [initiativeFilterRef],
  );

  const handleToggleParticipant = React.useCallback(
    (participantId: string) => {
      updateFilterState((prev) =>
        toggleInitiativeParticipant(prev, participantId, participantIds),
      );
    },
    [updateFilterState, participantIds],
  );

  const handleSelectAll = React.useCallback(() => {
    updateFilterState((prev) =>
      selectAllInitiativeParticipants(prev, participantIds),
    );
  }, [updateFilterState, participantIds]);

  const handleInvertSelection = React.useCallback(() => {
    updateFilterState((prev) =>
      invertInitiativeSelection(prev, participantIds),
    );
  }, [updateFilterState, participantIds]);

  const handleClearSelection = React.useCallback(() => {
    updateFilterState((prev) =>
      clearInitiativeSelection(prev, participantIds),
    );
  }, [updateFilterState, participantIds]);

  const handleToggleFilterActive = React.useCallback(() => {
    updateFilterState((prev) =>
      setInitiativeFilterActive(prev, !prev.filterActive),
    );
  }, [updateFilterState]);

  const hasFilterControls = isMaster;
  const initiativeFilterActive = reconciledFilter.filterActive;
  const effectiveSelectedIds = reconciledFilter.selectedIds;
  const selectedSet = React.useMemo(
    () => new Set(effectiveSelectedIds),
    [effectiveSelectedIds],
  );
  const getEffectiveInitiative = React.useCallback(
    (id: string) => (selectedSet.has(id) ? initiatives[id] : undefined),
    [selectedSet, initiatives],
  );

  const combined = React.useMemo(
    () =>
      [...rawCombined].sort(
        (a, b) =>
          (getEffectiveInitiative(b.id) ?? -1) -
          (getEffectiveInitiative(a.id) ?? -1),
      ),
    [rawCombined, getEffectiveInitiative],
  );

  const selectedCount = React.useMemo(
    () => combined.filter((p) => selectedSet.has(p.id)).length,
    [combined, selectedSet],
  );
  const hiddenCount = initiativeFilterActive
    ? combined.length - selectedCount
    : 0;
  const displayedParticipants = React.useMemo(
    () =>
      filterInitiativeParticipants(
        combined,
        effectiveSelectedIds,
        Boolean(initiativeFilterActive),
      ),
    [combined, effectiveSelectedIds, initiativeFilterActive],
  );
  const isSubsetSelected =
    combined.length > 0 && selectedCount < combined.length;

  const displayedParticipantIds = React.useMemo(
    () => displayedParticipants.map((p) => p.id),
    [displayedParticipants],
  );

  const reconciledTurn = React.useMemo(
    () => reconcileCombatTurnState(combatTurn, displayedParticipantIds),
    [combatTurn, displayedParticipantIds],
  );

  React.useEffect(() => {
    if (reconciledTurn !== combatTurn) {
      setCombatTurn(reconciledTurn);
    }
  }, [reconciledTurn, combatTurn]);

  const activeTurnParticipant = React.useMemo(() => {
    if (!reconciledTurn.active || !reconciledTurn.activeParticipantId) {
      return null;
    }
    return (
      displayedParticipants.find(
        (p) => p.id === reconciledTurn.activeParticipantId,
      ) || null
    );
  }, [reconciledTurn, displayedParticipants]);

  const notifyParticipantTurn = React.useCallback(
    (nextState: CombatTurnState) => {
      if (
        !nextState.active ||
        !nextState.notifyTurnToPlayers ||
        !nextState.activeParticipantId ||
        !onNotifyTurn
      ) {
        return;
      }
      const target = displayedParticipants.find(
        (p) => p.id === nextState.activeParticipantId,
      );
      if (target) {
        onNotifyTurn(target, nextState.round);
      }
    },
    [displayedParticipants, onNotifyTurn],
  );

  const handleStartRounds = () => {
    const next = startCombatRounds(
      displayedParticipantIds,
      reconciledTurn.notifyTurnToPlayers,
    );
    setCombatTurn(next);
    notifyParticipantTurn(next);
  };

  const handleStepTurn = (direction: 1 | -1) => {
    const next = advanceCombatTurn(
      reconciledTurn,
      displayedParticipantIds,
      direction,
    );
    setCombatTurn(next);
    notifyParticipantTurn(next);
  };

  const handleStopRounds = () => {
    setCombatTurn((prev) => stopCombatRounds(prev));
  };

  const handleApplyBatchStat = (explicitDelta?: number) => {
    const selectedTargets = combined.filter((p) => selectedSet.has(p.id));
    if (selectedTargets.length === 0) {
      setBatchFeedback("Selecione ao menos um participante.");
      return;
    }
    const delta =
      explicitDelta !== undefined
        ? explicitDelta
        : parseInt(batchDeltaInput.trim(), 10);
    if (!Number.isFinite(delta) || delta === 0) {
      setBatchFeedback("Informe um ajuste diferente de zero (ex.: -5 ou +4).");
      return;
    }
    for (const target of selectedTargets) {
      const current =
        batchStat === "sm"
          ? (target.sm?.current ?? target.san?.current ?? 0)
          : (target[batchStat]?.current ?? 0);
      const max =
        batchStat === "sm"
          ? (target.sm?.max ?? target.san?.max ?? 100)
          : (target[batchStat]?.max ?? 100);
      const nextVal = computeBatchStatValue(current, max, delta);
      onUpdateStat(
        target,
        batchStat,
        nextVal,
        target.isExtraSheet,
        target.rawExtraSheetId,
      );
    }
    const statLabel =
      batchStat === "hp" ? "PV" : batchStat === "pe" ? "PE" : "SM";
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    setBatchFeedback(
      `Aplicado ${sign} ${statLabel} em ${selectedTargets.length} participante${selectedTargets.length === 1 ? "" : "s"}.`,
    );
  };

  const handleApplyBatchStatus = (
    preset: (typeof STATUS_PRESETS)[number],
    mode: "add" | "remove",
  ) => {
    if (!onUpdateStatusEffects) return;
    const selectedTargets = combined.filter((p) => selectedSet.has(p.id));
    if (selectedTargets.length === 0) {
      setBatchFeedback("Selecione ao menos um participante.");
      return;
    }
    let changedCount = 0;
    for (const target of selectedTargets) {
      const currentEffects: StatusEffect[] = Array.isArray(target.statusEffects)
        ? target.statusEffects
        : [];
      const alreadyHas = currentEffects.some(
        (e) =>
          e.label.trim().toLowerCase() === preset.label.trim().toLowerCase(),
      );
      if (mode === "add" && !alreadyHas) {
        const nextEffects = togglePresetStatusEffect(currentEffects, preset);
        onUpdateStatusEffects(
          target,
          nextEffects,
          target.isExtraSheet,
          target.rawExtraSheetId,
        );
        changedCount++;
      } else if (mode === "remove" && alreadyHas) {
        const nextEffects = togglePresetStatusEffect(currentEffects, preset);
        onUpdateStatusEffects(
          target,
          nextEffects,
          target.isExtraSheet,
          target.rawExtraSheetId,
        );
        changedCount++;
      }
    }
    setBatchFeedback(
      mode === "add"
        ? `Status "${preset.label}" aplicado em ${changedCount} participante${changedCount === 1 ? "" : "s"}.`
        : `Status "${preset.label}" removido de ${changedCount} participante${changedCount === 1 ? "" : "s"}.`,
    );
  };

  React.useEffect(() => {
    if (selectedCount > 0 && rollWarning) {
      setRollWarning(null);
    }
    if (selectedCount === 0 && showBatchPanel) {
      setShowBatchPanel(false);
    }
  }, [selectedCount, rollWarning, showBatchPanel]);

  React.useEffect(() => {
    if (!initiativeFilterActive && showQuickSelector) {
      setShowQuickSelector(false);
    }
  }, [initiativeFilterActive, showQuickSelector]);

  const handleTriggerRollInitiative = () => {
    if (!onRollInitiative) return;
    if (combined.length > 0 && selectedCount === 0) {
      setRollWarning("Selecione ao menos um jogador para rolar iniciativa.");
      return;
    }
    setRollWarning(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
    onRollInitiative(effectiveSelectedIds);
  };

  const renderFloatingInitiativeButton = () => {
    if (!onRollInitiative || typeof document === "undefined") return null;
    const noSelection = combined.length > 0 && selectedCount === 0;
    const rollLabel = noSelection
      ? "Selecione ao menos um jogador para rolar iniciativa"
      : isSubsetSelected
        ? `Rolar Iniciativa dos ${selectedCount} selecionados (1d20 + AGL)`
        : "Rolar Iniciativa dos Selecionados (1d20 + AGL)";
    return createPortal(
      <button
        type="button"
        onClick={handleTriggerRollInitiative}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
        className={`fixed right-5 sm:right-7 z-[90] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transform-gpu will-change-transform transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-90 hover:scale-105 touch-manipulation select-none ${
          noSelection
            ? "bg-[#1a1a22] text-[#787989] border border-[#323240] shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
            : isRlGlobal
              ? "bg-gradient-to-br from-[#9333ea] to-[#581c87] hover:from-[#a855f7] hover:to-[#6b21a8] text-white border border-purple-300/60 shadow-[0_8px_28px_rgba(147,51,234,0.65)]"
              : "bg-gradient-to-br from-[#b52a30] to-[#641015] hover:from-[#d13239] hover:to-[#7a1319] text-white border border-[#ff8085]/50 shadow-[0_8px_28px_rgba(181,42,48,0.65)]"
        }`}
        title={rollLabel}
        aria-label={rollLabel}
      >
        <Dices size={24} className="transform-gpu transition-transform duration-150 active:rotate-45" />
        {isSubsetSelected && (
          <span
            aria-hidden="true"
            className={`absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 flex items-center justify-center text-[10px] font-mono font-bold border ${
              noSelection
                ? "bg-[#121218] text-[#9ca3af] border-[#3a3a48]"
                : isRlGlobal
                  ? "bg-[#160a24] text-purple-200 border-purple-400/70"
                  : "bg-[#140709] text-white border-[#ff8085]/70"
            }`}
          >
            {selectedCount}
          </span>
        )}
      </button>,
      document.body
    );
  };

  const renderFilterBar = () => {
    if (!hasFilterControls || combined.length === 0) return null;
    const allSelected = selectedCount === combined.length;
    const noneSelected = selectedCount === 0;

    return (
      <section
        aria-label="Filtro de Jogadores da Iniciativa"
        style={{ contain: "layout style" }}
        className="mb-3.5 bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none"
      >
        <div className="px-3 py-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2.5">
          {/* Status & Contadores */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <Filter
                size={13}
                className={
                  initiativeFilterActive
                    ? isRlGlobal
                      ? "text-purple-400"
                      : "text-[var(--op-red-bright)]"
                    : "text-[#787989]"
                }
              />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Filtro de Iniciativa
              </span>
            </div>

            <span
              data-testid="initiative-selection-count"
              className="text-[11px] text-[#c8c9d4] tabular-nums bg-[#121218] border border-[#242430] px-2 py-0.5"
            >
              {selectedCount} / {combined.length} selecionados
            </span>

            {initiativeFilterActive && hiddenCount > 0 && (
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border tabular-nums ${
                  isRlGlobal
                    ? "bg-purple-950/35 text-purple-200 border-purple-500/45"
                    : "bg-[#1c0b0e] text-[#ff8a90] border-[#8f171c]/55"
                }`}
              >
                {hiddenCount} oculto{hiddenCount === 1 ? "" : "s"} (conectado
                {hiddenCount === 1 ? "" : "s"})
              </span>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFilterActive}
              aria-pressed={Boolean(initiativeFilterActive)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-[11px] font-mono font-bold uppercase tracking-wider rounded-none border cursor-pointer ${FILTER_BTN_MOTION} ${
                initiativeFilterActive
                  ? isRlGlobal
                    ? "bg-[#221236] text-purple-100 border-purple-400/70 hover:bg-[#2d1747]"
                    : "bg-[#220a0e] text-[#ff8a90] border-[#8f171c]/80 hover:bg-[#2c0d12]"
                  : "bg-[#121218] text-[#c8c9d4] border-[#262632] hover:bg-[#1a1a24] hover:text-white"
              }`}
            >
              <Filter size={12} />
              <span>
                {initiativeFilterActive ? "Filtro: Ativo" : "Filtro: Inativo"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              disabled={allSelected}
              className={`inline-flex items-center justify-center px-2.5 min-h-[40px] text-[11px] font-mono uppercase tracking-wider rounded-none border border-[#262632] bg-[#121218] text-[#c8c9d4] hover:bg-[#1a1a24] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer ${FILTER_BTN_MOTION}`}
            >
              Selecionar todos
            </button>

            <button
              type="button"
              onClick={handleInvertSelection}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[40px] text-[11px] font-mono uppercase tracking-wider rounded-none border border-[#262632] bg-[#121218] text-[#c8c9d4] hover:bg-[#1a1a24] hover:text-white cursor-pointer ${FILTER_BTN_MOTION}`}
              title="Inverter jogadores selecionados e desmarcados"
            >
              <ArrowLeftRight size={12} />
              <span>Inverter seleção</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={noneSelected}
              className={`inline-flex items-center justify-center px-2.5 min-h-[40px] text-[11px] font-mono uppercase tracking-wider rounded-none border border-[#262632] bg-[#121218] text-[#c8c9d4] hover:bg-[#1a1215] hover:text-[#ff8a90] hover:border-[#8f171c]/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer ${FILTER_BTN_MOTION}`}
            >
              Limpar seleção
            </button>

            {initiativeFilterActive && (
              <button
                type="button"
                onClick={() => setShowQuickSelector((prev) => !prev)}
                aria-expanded={showQuickSelector}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[40px] text-[11px] font-mono uppercase tracking-wider rounded-none border cursor-pointer ${FILTER_BTN_MOTION} ${
                  showQuickSelector
                    ? "bg-[#181822] text-white border-[#3c3c4c]"
                    : "bg-[#121218] text-[#9ca3af] border-[#262632] hover:text-white hover:bg-[#1a1a24]"
                }`}
              >
                <SlidersHorizontal size={12} />
                <span>Ajustar seleção</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setShowBatchPanel((prev) => !prev);
                setBatchFeedback(null);
              }}
              disabled={noneSelected}
              aria-expanded={showBatchPanel}
              data-testid="batch-actions-toggle-btn"
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[40px] text-[11px] font-mono font-bold uppercase tracking-wider rounded-none border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${FILTER_BTN_MOTION} ${
                showBatchPanel
                  ? isRlGlobal
                    ? "bg-[#221236] text-purple-100 border-purple-400/70"
                    : "bg-[#220a0e] text-[#ff8a90] border-[#8f171c]/80"
                  : "bg-[#121218] text-[#c8c9d4] border-[#262632] hover:bg-[#1a1a24] hover:text-white"
              }`}
            >
              <Layers size={12} />
              <span>Ação em Grupo</span>
            </button>
          </div>
        </div>

        {/* Seletor rápido de todos os conectados enquanto o filtro está ativo */}
        <MotionAccordion isOpen={Boolean(initiativeFilterActive && showQuickSelector)}>
          <div className="border-t border-[#1c1c24] bg-[#09090d] px-3 py-2.5 sm:px-4">
            <div className="text-[10px] uppercase tracking-wider text-[#828392] mb-2">
              Participantes conectados — ajuste a seleção antes da próxima rolagem:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {combined.map((p) => {
                const isSelected = selectedSet.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleToggleParticipant(p.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-2 px-2.5 min-h-[38px] text-[11px] font-mono uppercase tracking-wider border rounded-none cursor-pointer ${FILTER_BTN_MOTION} ${
                      isSelected
                        ? isRlGlobal
                          ? "bg-[#1c102c] text-white border-purple-400/70"
                          : "bg-[#1c0b0e] text-white border-[#8f171c]/75"
                        : "bg-[#111116] text-[#828392] border-[#22222c] hover:text-white hover:border-[#383846]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 flex items-center justify-center border shrink-0 transition-[background-color,border-color] duration-150 ${
                        isSelected
                          ? isRlGlobal
                            ? "bg-purple-600 border-purple-300 text-white"
                            : "bg-[#8f171c] border-[#ff8085]/70 text-white"
                          : "bg-[#0c0c10] border-[#383846] text-transparent"
                      }`}
                    >
                      <Check
                        size={10}
                        strokeWidth={3}
                        className={`${CHECK_ICON_MOTION} ${
                          isSelected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                        }`}
                      />
                    </span>
                    <span className="max-w-[140px] truncate">{p.name}</span>
                    <span
                      className={`text-[9px] font-bold ${
                        p.isExtraSheet ? "text-[#60a5fa]" : "text-[#4ade80]"
                      }`}
                    >
                      {p.isExtraSheet ? "NPC" : "JOG"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </MotionAccordion>

        {/* Painel de Ações em Grupo para os participantes selecionados */}
        <MotionAccordion isOpen={Boolean(showBatchPanel && selectedCount > 0)}>
          <div
            data-testid="batch-actions-panel"
            className="border-t border-[#1c1c24] bg-[#09090d] px-3 py-3 sm:px-4 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-[#a8aab8]">
                Ação em Grupo ·{" "}
                <strong className="text-white tabular-nums">
                  {selectedCount}
                </strong>{" "}
                selecionado{selectedCount === 1 ? "" : "s"}
              </div>
              {batchFeedback && (
                <div
                  role="status"
                  data-testid="batch-actions-feedback"
                  className="text-[11px] text-emerald-300"
                >
                  {batchFeedback}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Seletor de atributo PV / PE / SM */}
              <div className="flex items-center border border-[#262632] bg-[#101018]">
                {(
                  [
                    { id: "hp", label: "PV" },
                    { id: "pe", label: "PE" },
                    { id: "sm", label: "SM" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBatchStat(s.id)}
                    data-testid={`batch-stat-${s.id}`}
                    className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      batchStat === s.id
                        ? isRlGlobal
                          ? "bg-purple-950/70 text-white"
                          : "bg-[#260b10] text-white"
                        : "text-[#8e90a0] hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Atalhos rápidos de delta */}
              <div className="flex flex-wrap items-center gap-1">
                {[-10, -5, -2, -1, 1, 2, 5, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleApplyBatchStat(val)}
                    data-testid={`batch-delta-${val > 0 ? `plus-${val}` : `minus-${Math.abs(val)}`}`}
                    className={`min-w-[40px] min-h-[38px] px-2 text-xs font-bold tabular-nums border cursor-pointer touch-manipulation ${
                      val < 0
                        ? "bg-[#1a0a0d] hover:bg-[#2a1015] border-[#6e171d] text-[#ff9a9f]"
                        : "bg-emerald-950/35 hover:bg-emerald-950/65 border-emerald-700/55 text-emerald-300"
                    }`}
                  >
                    {val > 0 ? `+${val}` : val}
                  </button>
                ))}
              </div>

              {/* Ajuste personalizado */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={batchDeltaInput}
                  onChange={(e) => setBatchDeltaInput(e.target.value)}
                  aria-label="Valor de ajuste em grupo"
                  data-testid="batch-custom-delta-input"
                  className="w-16 min-h-[38px] px-2 bg-[#101018] border border-[#282838] text-xs text-white text-center tabular-nums outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleApplyBatchStat()}
                  data-testid="batch-apply-custom-btn"
                  className="min-h-[38px] px-3 bg-[#8f171c] hover:bg-[#b52a30] border border-[#ff8085]/35 text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer touch-manipulation"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {onUpdateStatusEffects && (
              <div className="pt-2 border-t border-[#191923] flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-wider text-[#7e8092]">
                  Aplicar Status em Grupo (clique para adicionar / Shift+clique para remover):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={(e) =>
                        handleApplyBatchStatus(
                          preset,
                          e.shiftKey ? "remove" : "add",
                        )
                      }
                      data-testid={`batch-status-${preset.label.toLowerCase()}`}
                      className="min-h-[34px] px-2.5 bg-[#12121a] hover:bg-[#1c1c28] border border-[#282836] text-[10px] uppercase tracking-wider text-zinc-200 hover:text-white cursor-pointer touch-manipulation"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </MotionAccordion>

        {/* Alerta clínico quando o Mestre tenta rolar com 0 selecionados */}
        <MotionAccordion isOpen={Boolean(rollWarning)}>
          <div
            role="alert"
            className="border-t border-[#8f171c]/55 bg-[#1a0a0d] px-3 py-2 sm:px-4 flex items-center gap-2 text-xs text-[#ff8a90]"
          >
            <AlertTriangle size={14} className="shrink-0 text-[#ff5258]" />
            <span>{rollWarning}</span>
          </div>
        </MotionAccordion>
      </section>
    );
  };

  const renderRoundTrackerBar = () => {
    if (!isMaster || displayedParticipants.length === 0) return null;

    return (
      <section
        aria-label="Controle de Rodadas e Turno Ativo"
        data-testid="combat-round-tracker"
        className={`mb-3.5 bg-[#0c0c10] border rounded-none px-3 py-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2.5 ${
          reconciledTurn.active
            ? isRlGlobal
              ? "border-purple-500/65"
              : "border-[#8f171c]/75"
            : "border-[#202028]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span
            data-testid="combat-round-label"
            className={`text-[11px] font-bold uppercase tracking-wider tabular-nums ${
              reconciledTurn.active
                ? isRlGlobal
                  ? "text-purple-200"
                  : "text-[#ff8a90]"
                : "text-[#9a9cad]"
            }`}
          >
            {reconciledTurn.active
              ? `Rodada ${reconciledTurn.round}`
              : "Controle de Turnos"}
          </span>

          {reconciledTurn.active && activeTurnParticipant ? (
            <>
              <span className="text-[#4a4b5c]" aria-hidden="true">
                ·
              </span>
              <span
                data-testid="combat-active-turn-name"
                className="text-xs font-bold uppercase tracking-wider text-white truncate max-w-[200px]"
              >
                Vez de {activeTurnParticipant.name}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-sans text-[#7e8092]">
              Inicie as rodadas para destacar o turno atual na ordem de iniciativa.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!reconciledTurn.active ? (
            <button
              type="button"
              onClick={handleStartRounds}
              data-testid="combat-start-rounds-btn"
              className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                isRlGlobal
                  ? "bg-purple-700 hover:bg-purple-600 border-purple-400/50 text-white"
                  : "bg-[#8f171c] hover:bg-[#b52a30] border-[#ff8085]/35 text-white"
              }`}
            >
              <Play size={12} />
              <span>Iniciar Rodadas</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleStepTurn(-1)}
                data-testid="combat-prev-turn-btn"
                aria-label="Turno anterior"
                className="min-h-[38px] px-2.5 bg-[#12121a] hover:bg-[#1a1a26] border border-[#262634] text-xs font-bold uppercase tracking-wider text-zinc-200 hover:text-white inline-flex items-center gap-1 cursor-pointer touch-manipulation"
              >
                <SkipBack size={13} />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <button
                type="button"
                onClick={() => handleStepTurn(1)}
                data-testid="combat-next-turn-btn"
                className={`min-h-[38px] px-3 text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                  isRlGlobal
                    ? "bg-purple-700 hover:bg-purple-600 border-purple-400/50 text-white"
                    : "bg-[#8f171c] hover:bg-[#b52a30] border-[#ff8085]/35 text-white"
                }`}
              >
                <span>Próximo Turno</span>
                <SkipForward size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setCombatTurn((prev) => ({
                    ...prev,
                    notifyTurnToPlayers: !prev.notifyTurnToPlayers,
                  }))
                }
                aria-pressed={reconciledTurn.notifyTurnToPlayers}
                title={
                  reconciledTurn.notifyTurnToPlayers
                    ? "Notificando o jogador quando chegar seu turno"
                    : "Aviso de turno desativado (apenas destaque local)"
                }
                className={`min-h-[38px] px-2.5 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer touch-manipulation ${
                  reconciledTurn.notifyTurnToPlayers
                    ? "bg-[#190b0f] border-[var(--op-red)]/60 text-white"
                    : "bg-[#12121a] border-[#262634] text-[#848698]"
                }`}
              >
                {reconciledTurn.notifyTurnToPlayers ? (
                  <Bell size={12} />
                ) : (
                  <BellOff size={12} />
                )}
                <span className="hidden md:inline">Avisar</span>
              </button>

              <button
                type="button"
                onClick={handleStopRounds}
                data-testid="combat-stop-rounds-btn"
                aria-label="Encerrar rodadas"
                className="min-h-[38px] px-2.5 bg-[#12121a] hover:bg-red-950/55 border border-[#262634] hover:border-red-600/60 text-[10px] font-bold uppercase tracking-wider text-[#9a9cad] hover:text-red-200 inline-flex items-center gap-1 cursor-pointer touch-manipulation"
              >
                <Square size={11} />
                <span>Encerrar</span>
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  const renderEmptyFilteredState = () => (
    <div className="bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-6 sm:p-8 text-center flex flex-col items-center justify-center">
      <Filter size={26} className="text-[#626475] mb-2.5" />
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
        Nenhum jogador selecionado no filtro
      </h3>
      <p className="text-xs text-[#828392] max-w-md mt-1.5 leading-relaxed">
        Todos os {combined.length} participante{combined.length === 1 ? "" : "s"} continuam
        conectados normalmente. Selecione jogadores ou desative o filtro para visualizá-los.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleToggleFilterActive}
          className={`inline-flex items-center justify-center px-3.5 min-h-[42px] bg-[#121218] hover:bg-[#1a1a24] text-white border border-[#2e2e3c] text-xs font-mono uppercase tracking-wider rounded-none cursor-pointer ${FILTER_BTN_MOTION}`}
        >
          Desativar filtro
        </button>
        <button
          type="button"
          onClick={handleSelectAll}
          className={`inline-flex items-center justify-center px-3.5 min-h-[42px] text-xs font-mono font-bold uppercase tracking-wider rounded-none border cursor-pointer ${FILTER_BTN_MOTION} ${
            isRlGlobal
              ? "bg-[#221236] hover:bg-[#2d1747] text-purple-100 border-purple-400/70"
              : "bg-[#220a0e] hover:bg-[#2c0d12] text-[#ff8a90] border-[#8f171c]/75"
          }`}
        >
          Selecionar todos
        </button>
      </div>
    </div>
  );

  const handleStepStat = (player: any, stat: "hp" | "pe" | "sm", delta: number) => {
    const current = (player[stat]?.current ?? 0) + delta;
    const max = player[stat]?.max ?? 100;
    const clamped = Math.max(0, Math.min(max * 2, current));
    onUpdateStat(player, stat, clamped, player.isExtraSheet, player.rawExtraSheetId);
  };

  if (combined.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 text-center flex flex-col items-center justify-center bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none font-mono">
        <Users size={32} className="text-[#626475] mb-3" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Nenhum participante conectado
        </h3>
        <p className="text-xs text-[#828392] max-w-sm mt-1 leading-relaxed">
          Jogadores conectados ou fichas extras sincronizadas serão listados aqui.
        </p>

        {onClearChatHistory && (
          <div className="mt-6 pt-6 border-t border-[#1e1e26] w-full flex flex-col items-center">
            <div className="text-[11px] text-[#787989] mb-3">
              Gerenciamento da Sessão
            </div>
            <button
              type="button"
              onClick={onClearChatHistory}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#121218] hover:bg-red-950/40 text-[#9ca3af] hover:text-red-400 border border-[#262632] hover:border-red-900/50 outline outline-1 outline-[#181820] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              <Trash2 size={13} className="text-red-500" />
              <span>Limpar Histórico do Chat</span>
            </button>
          </div>
        )}
        {renderFloatingInitiativeButton()}
      </div>
    );
  }

  // MODO LISTA
  if (viewMode === "list") {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 font-mono my-4">
        {renderFilterBar()}
        {renderRoundTrackerBar()}
        {displayedParticipants.length === 0 ? (
          renderEmptyFilteredState()
        ) : (
        <div className="bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#202028] bg-[#101015] text-[11px] uppercase font-bold tracking-wider text-[#828392]">
                {hasFilterControls && (
                  <th className="py-3 px-2 sm:px-3 w-14 text-center">Sel</th>
                )}
                <th className="py-3 px-3 sm:px-4 w-16 text-center">Inic</th>
                <th className="py-3 px-3 sm:px-4">Nome</th>
                <th className="py-3 px-3 sm:px-4 w-44">HP</th>
                <th className="py-3 px-3 sm:px-4 w-44">
                  {currentGlobalMode === "rl" ? "SN" : "PE"}
                </th>
                {isMaster && onUpdateEp && (
                  <th className="py-3 px-3 sm:px-4 w-40">EP</th>
                )}
                {isMaster && onUpdateLv && (
                  <th className="py-3 px-3 sm:px-4 w-36">LV</th>
                )}
                <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Ação recente</th>
                <th className="py-3 px-3 sm:px-4 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181820] text-xs">
              {displayedParticipants.map((p) => {
                const isSelected = selectedSet.has(p.id);
                const initVal = getEffectiveInitiative(p.id);
                const hpCurrent = p.hp?.current ?? 0;
                const hpMax = p.hp?.max ?? 100;
                const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

                const peCurrent = p.pe?.current ?? 0;
                const peMax = p.pe?.max ?? 100;
                const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

                const smCurrent = p.sm?.current ?? p.san?.current ?? 0;
                const smMax = p.sm?.max ?? p.san?.max ?? 100;
                const smPct = Math.max(0, Math.min(100, (smCurrent / smMax) * 100)) || 0;

                const isPlayerRl = (playerModes[p.id] || currentGlobalMode) === "rl";
                const ultimoSuspiro = normalizeUltimoSuspiroState(p.ultimoSuspiro, hpCurrent);
                const isDead = ultimoSuspiro.status === "dead";
                const isActiveTurn =
                  reconciledTurn.active &&
                  reconciledTurn.activeParticipantId === p.id;

                return (
                  <tr
                    key={p.id}
                    data-active-turn={isActiveTurn ? "true" : undefined}
                    className={`hover:bg-[#121217] transition-[background-color,opacity] duration-150 ${
                      isActiveTurn
                        ? isRlGlobal
                          ? "bg-purple-950/25"
                          : "bg-[#1d0a0e]/70"
                        : ""
                    } ${
                      hasFilterControls && !isSelected ? "opacity-65" : ""
                    }`}
                  >
                    {hasFilterControls && (
                      <td className="py-3 px-2 sm:px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleParticipant(p.id)}
                          aria-pressed={isSelected}
                          aria-label={
                            isSelected
                              ? `Desmarcar ${p.name} da iniciativa`
                              : `Selecionar ${p.name} para iniciativa`
                          }
                          title={
                            isSelected
                              ? "Incluído na rolagem de iniciativa (clique para desmarcar)"
                              : "Fora da rolagem de iniciativa (clique para selecionar)"
                          }
                          className={`inline-flex items-center justify-center w-9 h-9 border rounded-none cursor-pointer ${CHECKBOX_BTN_MOTION} ${
                            isSelected
                              ? isRlGlobal
                                ? "bg-purple-900/50 border-purple-400/75 text-purple-100"
                                : "bg-[#8f171c]/35 border-[#8f171c] text-white"
                              : "bg-[#111116] border-[#2c2c38] text-transparent hover:border-[#4a4a5c]"
                          }`}
                        >
                          <Check
                            size={14}
                            strokeWidth={3}
                            className={`${CHECK_ICON_MOTION} ${
                              isSelected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                            }`}
                          />
                        </button>
                      </td>
                    )}

                    <td className="py-3 px-3 sm:px-4 text-center">
                      {initVal !== undefined ? (
                        <span className="inline-block px-2 py-0.5 bg-[#121217] border border-[#202028] outline outline-1 outline-[#181820] text-white font-bold text-xs">
                          {initVal}
                        </span>
                      ) : (
                        <span className="text-[#555663]">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate max-w-[180px] uppercase">
                          {p.name}
                        </span>
                        {isActiveTurn && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#8f171c] text-white shrink-0">
                            Turno Ativo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.isExtraSheet ? (
                          <span className="text-[#60a5fa] text-[10px]">NPC</span>
                        ) : (
                          <span className="text-[#4ade80] text-[10px]">Jogador</span>
                        )}
                        <span className="text-[10px] font-mono font-bold text-[#9ca3af] tracking-wider uppercase">
                          LV {normalizeLevel(p.lv, p.variables, normalizeCharacterProfile(p.profile))}
                        </span>
                        <button
                          type="button"
                          onClick={() => onTogglePlayerMode && onTogglePlayerMode(p.id)}
                          className={`text-[9px] uppercase font-bold px-1 py-0.2 rounded-none border transition-colors cursor-pointer ${
                            (playerModes[p.id] || currentGlobalMode) === "rl"
                              ? "bg-purple-950/40 text-purple-200 border-purple-400/50 hover:bg-purple-900/50 shadow-[0_0_6px_rgba(168,85,247,0.2)]"
                              : "bg-[#8f171c]/20 text-[#ff7076] border-[#8f171c]/40 hover:bg-[#8f171c]/35"
                          }`}
                          title="Clique para alternar o modo deste jogador"
                        >
                          {(playerModes[p.id] || currentGlobalMode) === "rl" ? "Real L" : "Demologia"}
                        </button>
                      </div>
                      {Array.isArray(p.statusEffects) && p.statusEffects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.statusEffects.map((ef: StatusEffect, idx: number) => (
                            <StatusPostIt
                              key={ef.id}
                              effect={ef}
                              index={idx}
                              compact
                              onRemove={
                                onUpdateStatusEffects
                                  ? (id) =>
                                      onUpdateStatusEffects(
                                        p,
                                        (p.statusEffects || []).filter((item: StatusEffect) => item.id !== id),
                                        p.isExtraSheet,
                                        p.rawExtraSheetId,
                                      )
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                        <span className={`${isDead ? "text-[#71717a]" : "text-[#ef4444]"} font-bold`}>
                          HP
                        </span>
                        <span className={isDead ? "text-[#71717a]" : undefined}>{hpCurrent}/{hpMax}</span>
                      </div>
                      <div
                        className={`h-1.5 w-full border overflow-hidden mb-1.5 ${
                          isDead
                            ? "bg-[#3f3f46] border-[#52525b]"
                            : "bg-[#181820] border-[#242430]"
                        }`}
                      >
                        <div
                          className={`h-full transition-all duration-200 ${
                            isDead ? "bg-[#52525b]" : "bg-[#8f171c]"
                          }`}
                          style={{ width: `${isDead ? 100 : hpPct}%` }}
                        />
                      </div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          disabled={isDead}
                          onClick={() => handleStepStat(p, "hp", -1)}
                          className={`w-6 h-6 flex items-center justify-center bg-[#121217] border border-[#202028] outline outline-1 outline-[#181820] rounded-none text-xs font-bold ${
                            isDead
                              ? "opacity-40 cursor-not-allowed text-[#626370]"
                              : "hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white cursor-pointer"
                          }`}
                          title={isDead ? "Personagem morto — use Reviver" : "Diminuir HP"}
                        >
                          <Minus size={10} />
                        </button>
                        <StatMathInput
                          value={hpCurrent}
                          disabled={isDead}
                          onSave={(val) =>
                            onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId)
                          }
                          className={`w-12 h-6 bg-[#0c0c10] border-y border-[#202028] text-center text-xs font-bold outline-none ${
                            isDead ? "text-[#71717a] cursor-not-allowed" : "text-white"
                          }`}
                        />
                        <button
                          type="button"
                          disabled={isDead}
                          onClick={() => handleStepStat(p, "hp", 1)}
                          className={`w-6 h-6 flex items-center justify-center bg-[#121217] border border-[#202028] outline outline-1 outline-[#181820] rounded-none text-xs font-bold ${
                            isDead
                              ? "opacity-40 cursor-not-allowed text-[#626370]"
                              : "hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white cursor-pointer"
                          }`}
                          title={isDead ? "Personagem morto — use Reviver" : "Aumentar HP"}
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <MasterUltimoSuspiroControls
                        ultimoSuspiro={ultimoSuspiro}
                        maxHp={hpMax}
                        characterName={p.name || "Personagem"}
                        isMaster={isMaster}
                        compact
                        onAdvanceTurn={
                          onAdvanceUltimoSuspiroTurn
                            ? () =>
                                onAdvanceUltimoSuspiroTurn(
                                  p,
                                  p.isExtraSheet,
                                  p.rawExtraSheetId,
                                )
                            : undefined
                        }
                        onFinalizeDeath={
                          onFinalizeUltimoSuspiroDeath
                            ? () =>
                                onFinalizeUltimoSuspiroDeath(
                                  p,
                                  p.isExtraSheet,
                                  p.rawExtraSheetId,
                                )
                            : undefined
                        }
                        onRevive={
                          onRevivePlayer
                            ? (targetHp) =>
                                onRevivePlayer(
                                  p,
                                  targetHp,
                                  p.isExtraSheet,
                                  p.rawExtraSheetId,
                                )
                            : undefined
                        }
                      />
                    </td>

                    {/* Se RL: SN; Se Demologia: PE */}
                    {isPlayerRl ? (
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                          <span className="text-purple-300 font-bold flex items-center gap-1">
                            <Brain size={11} /> SN
                          </span>
                          <span>{smCurrent}/{smMax}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#181820] border border-[#242430] overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-gradient-to-r from-purple-700 to-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)] transition-all duration-200"
                            style={{ width: `${smPct}%` }}
                          />
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleStepStat(p, "sm", -1)}
                            className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                            title="Diminuir SN"
                          >
                            <Minus size={10} />
                          </button>
                          <StatMathInput
                            value={smCurrent}
                            onSave={(val) =>
                              onUpdateStat(p, "sm", val, p.isExtraSheet, p.rawExtraSheetId)
                            }
                            className="w-12 h-6 bg-[#0c0c10] border-y border-[#202028] text-center text-xs text-white font-bold outline-none focus:border-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepStat(p, "sm", 1)}
                            className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                            title="Aumentar SN"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                          <span className="text-yellow-500 font-bold flex items-center gap-1">
                            <Zap size={11} /> PE
                          </span>
                          <span>{peCurrent}/{peMax}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#181820] border border-[#242430] overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-yellow-500 transition-all duration-200"
                            style={{ width: `${pePct}%` }}
                          />
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => handleStepStat(p, "pe", -1)}
                            className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                            title="Diminuir PE"
                          >
                            <Minus size={10} />
                          </button>
                          <StatMathInput
                            value={peCurrent}
                            onSave={(val) =>
                              onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId)
                            }
                            className="w-12 h-6 bg-[#0c0c10] border-y border-[#202028] text-center text-xs text-white font-bold outline-none focus:border-yellow-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepStat(p, "pe", 1)}
                            className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                            title="Aumentar PE"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                    )}

                    {isMaster && onUpdateEp && (
                      <td className="py-3 px-3 sm:px-4">
                        <MasterEpEditor
                          compact
                          isMaster={isMaster}
                          characterName={p.name}
                          value={normalizeEpValue(p.ep, 0)}
                          onConfirm={(nextEp) =>
                            onUpdateEp(p, nextEp, p.isExtraSheet, p.rawExtraSheetId)
                          }
                        />
                      </td>
                    )}

                    {isMaster && onUpdateLv && (
                      <td className="py-3 px-3 sm:px-4">
                        <MasterLvEditor
                          compact
                          isMaster={isMaster}
                          characterName={p.name}
                          value={normalizeLevel(
                            p.lv,
                            p.variables,
                            normalizeCharacterProfile(p.profile)
                          )}
                          variables={p.variables}
                          profile={normalizeCharacterProfile(p.profile)}
                          onConfirm={(nextLv) =>
                            onUpdateLv(p, nextLv, p.isExtraSheet, p.rawExtraSheetId)
                          }
                        />
                      </td>
                    )}

                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell max-w-[200px]">
                      {p.history && p.history.length > 0 ? (
                        <div
                          className="text-xs text-[#9d9ea9] truncate"
                          dangerouslySetInnerHTML={{ __html: sanitizeRollHistoryHtml(p.history[0]) }}
                        />
                      ) : (
                        <span className="text-[#555663] italic">Sem ações recentes</span>
                      )}
                    </td>

                    <td className="py-3 px-3 sm:px-4 text-right">
                      {p.isExtraSheet ? (
                        <button
                          type="button"
                          onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                          className="p-1.5 bg-[#121217] hover:bg-[#1a1a24] text-[#60a5fa] border border-[#202028] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] rounded-none transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Abrir ficha"
                        >
                          <Maximize2 size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onKickPlayer(p)}
                          className="p-1.5 bg-[#121217] hover:bg-[#1a1215] text-[#9ca3af] hover:text-[var(--op-red-bright)] border border-[#202028] hover:border-[var(--op-red)] outline outline-1 outline-[#181820] hover:outline-[var(--op-red-bright)]/40 rounded-none transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Remover participante"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        {renderFloatingInitiativeButton()}
      </div>
    );
  }

  // MODO GRADE
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 font-mono my-4">
      {renderFilterBar()}
      {renderRoundTrackerBar()}
      {displayedParticipants.length === 0 ? (
        renderEmptyFilteredState()
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayedParticipants.map((p) => {
        const isSelected = selectedSet.has(p.id);
        const initVal = getEffectiveInitiative(p.id);
        const hpCurrent = p.hp?.current ?? 0;
        const hpMax = p.hp?.max ?? 100;
        const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

        const peCurrent = p.pe?.current ?? 0;
        const peMax = p.pe?.max ?? 100;
        const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

        const smCurrent = p.sm?.current ?? p.san?.current ?? 0;
        const smMax = p.sm?.max ?? p.san?.max ?? 100;
        const smPct = Math.max(0, Math.min(100, (smCurrent / smMax) * 100)) || 0;

        const isPlayerRl = (playerModes[p.id] || currentGlobalMode) === "rl";
        const ultimoSuspiro = normalizeUltimoSuspiroState(p.ultimoSuspiro, hpCurrent);
        const isDead = ultimoSuspiro.status === "dead";
        const isActiveTurn =
          reconciledTurn.active && reconciledTurn.activeParticipantId === p.id;

        return (
          <div
            key={p.id}
            data-testid={`master-player-card-${p.id}`}
            data-active-turn={isActiveTurn ? "true" : undefined}
            style={{ contain: "layout style" }}
            className={`bg-[#0c0c10] border outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] rounded-none p-3.5 sm:p-4 flex flex-col justify-between transition-[opacity,border-color] duration-150 ease-out ${
              isActiveTurn
                ? isRlGlobal
                  ? "border-purple-400 border-t-2 border-t-purple-400 bg-[#120c1a]"
                  : "border-[var(--op-red-bright)] border-t-2 border-t-[var(--op-red-bright)] bg-[#140a0d]"
                : hasFilterControls && !isSelected
                  ? "border-[#1c1c24] opacity-70"
                  : hasFilterControls && isSubsetSelected && isSelected
                    ? isRlGlobal
                      ? "border-[#202028] border-l-2 border-l-purple-500"
                      : "border-[#202028] border-l-2 border-l-[#8f171c]"
                    : "border-[#202028]"
            }`}
          >
            <div>
              {isActiveTurn && (
                <div
                  data-testid="active-turn-card-banner"
                  className={`mb-2.5 pb-1.5 border-b flex items-center justify-between text-[10px] font-bold uppercase tracking-widest ${
                    isRlGlobal
                      ? "border-purple-500/40 text-purple-200"
                      : "border-[#8f171c]/55 text-[#ff8a90]"
                  }`}
                >
                  <span>Turno Ativo</span>
                  <span className="tabular-nums">Rodada {reconciledTurn.round}</span>
                </div>
              )}
              {/* Header do Card */}
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {hasFilterControls && (
                    <button
                      type="button"
                      onClick={() => handleToggleParticipant(p.id)}
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Desmarcar ${p.name} da iniciativa`
                          : `Selecionar ${p.name} para iniciativa`
                      }
                      title={
                        isSelected
                          ? "Selecionado para iniciativa (clique para desmarcar)"
                          : "Não selecionado para iniciativa (clique para selecionar)"
                      }
                      className={`mt-0.5 inline-flex items-center justify-center w-8 h-8 border rounded-none shrink-0 cursor-pointer ${CHECKBOX_BTN_MOTION} ${
                        isSelected
                          ? isRlGlobal
                            ? "bg-purple-900/50 border-purple-400/75 text-purple-100"
                            : "bg-[#8f171c]/35 border-[#8f171c] text-white"
                          : "bg-[#111116] border-[#2c2c38] text-transparent hover:border-[#4a4a5c]"
                      }`}
                    >
                      <Check
                        size={14}
                        strokeWidth={3}
                        className={`${CHECK_ICON_MOTION} ${
                          isSelected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                        }`}
                      />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-white font-bold text-sm truncate uppercase tracking-wider">
                        {p.name}
                      </h4>
                      {hasFilterControls && !isSelected && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#14141c] text-[#828392] border border-[#262632] shrink-0">
                          Fora da rolagem
                        </span>
                      )}
                    {p.isExtraSheet ? (
                      <span className="text-[10px] text-[#60a5fa] font-bold uppercase shrink-0">
                        NPC
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#4ade80] font-bold uppercase shrink-0">
                        Jogador
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold text-[#9ca3af] uppercase tracking-wider shrink-0">
                      LV {normalizeLevel(p.lv, p.variables, normalizeCharacterProfile(p.profile))}
                    </span>
                    {!isPlayerRl && (() => {
                      const profDef = getProfileDefinition(p.profile);
                      const profTheme = PROFILE_THEME_MAP[profDef.id];
                      return (
                        <span
                          title={`Perfil: ${profDef.name}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border rounded-none shrink-0 ${profTheme.badgeBg} ${profTheme.badgeBorder} ${profTheme.badgeText}`}
                        >
                          <ProfileSymbolIcon symbol={profDef.symbol} size={10} />
                          <span>{profDef.name}</span>
                        </span>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => onTogglePlayerMode && onTogglePlayerMode(p.id)}
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-none border transition-colors cursor-pointer shrink-0 ${
                        (playerModes[p.id] || currentGlobalMode) === "rl"
                          ? "bg-purple-950/40 text-purple-200 border-purple-400/50 hover:bg-purple-900/50 shadow-[0_0_6px_rgba(168,85,247,0.2)]"
                          : "bg-[#8f171c]/20 text-[#ff7076] border-[#8f171c]/40 hover:bg-[#8f171c]/35"
                      }`}
                      title="Alternar modo deste jogador (Demologia / Real L)"
                    >
                      {(playerModes[p.id] || currentGlobalMode) === "rl" ? "Real L" : "Demologia"}
                    </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {initVal !== undefined && (
                    <div className="px-2 py-1 bg-[#121217] border border-[#202028] outline outline-1 outline-[#181820] rounded-none text-center">
                      <span className="text-xs font-bold text-white block leading-none">
                        Inic: {initVal}
                      </span>
                    </div>
                  )}

                  {p.isExtraSheet ? (
                    <button
                      type="button"
                      onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                      className="p-1.5 text-[#60a5fa] hover:text-white bg-[#121217] hover:bg-[#1a1a24] border border-[#202028] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] rounded-none transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Abrir ficha"
                    >
                      <Maximize2 size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onKickPlayer(p)}
                      className="p-1.5 text-[#9ca3af] hover:text-[var(--op-red-bright)] bg-[#121217] hover:bg-[#1a1215] border border-[#202028] hover:border-[var(--op-red)] outline outline-1 outline-[#181820] hover:outline-[var(--op-red-bright)]/40 rounded-none transition-all cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Remover da sessão"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status HP e PE/SN (SN substitui PE no modo RL) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {/* HP */}
                <div
                  className={`bg-[#101015] border outline outline-1 outline-[#181820] rounded-none p-2 ${
                    isDead ? "border-[#3f3f46]" : "border-[#202028]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                    <span className={`${isDead ? "text-[#71717a]" : "text-[#ef4444]"} flex items-center gap-1`}>
                      <Heart size={10} /> HP
                    </span>
                    <span className={isDead ? "text-[#71717a]" : undefined}>{hpCurrent}/{hpMax}</span>
                  </div>
                  <div
                    className={`h-1.5 border overflow-hidden mb-2 ${
                      isDead
                        ? "bg-[#3f3f46] border-[#52525b]"
                        : "bg-[#181820] border-[#242430]"
                    }`}
                  >
                    <div
                      className={`h-full transition-all duration-200 ${
                        isDead ? "bg-[#52525b]" : "bg-[#8f171c]"
                      }`}
                      style={{ width: `${isDead ? 100 : hpPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      disabled={isDead}
                      onClick={() => handleStepStat(p, "hp", -1)}
                      className={`w-6 h-6 flex items-center justify-center bg-[#14141c] border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none transition-all ${
                        isDead
                          ? "opacity-40 cursor-not-allowed text-[#626370]"
                          : "hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white cursor-pointer"
                      }`}
                      title={isDead ? "Personagem morto — use Reviver" : "Diminuir 1 HP"}
                    >
                      <Minus size={10} />
                    </button>
                    <StatMathInput
                      value={hpCurrent}
                      disabled={isDead}
                      onSave={(val) =>
                        onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId)
                      }
                      className={`w-10 h-6 bg-[#0c0c10] border-y border-[#202028] text-xs font-bold text-center py-0.5 rounded-none outline-none focus:border-[var(--op-red)] ${
                        isDead ? "text-[#71717a] cursor-not-allowed" : "text-white"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isDead}
                      onClick={() => handleStepStat(p, "hp", 1)}
                      className={`w-6 h-6 flex items-center justify-center bg-[#14141c] border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none transition-all ${
                        isDead
                          ? "opacity-40 cursor-not-allowed text-[#626370]"
                          : "hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white cursor-pointer"
                      }`}
                      title={isDead ? "Personagem morto — use Reviver" : "Aumentar 1 HP"}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>

                {/* Se RL: SN; Se Demologia: PE */}
                {isPlayerRl ? (
                  <div className="bg-[#101015] border border-purple-900/40 outline outline-1 outline-[#181820] rounded-none p-2">
                    <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                      <span className="text-purple-300 flex items-center gap-1">
                        <Brain size={10} /> SN
                      </span>
                      <span>{smCurrent}/{smMax}</span>
                    </div>
                    <div className="h-1.5 bg-[#181820] border border-[#242430] overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-purple-700 to-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)] transition-all duration-200"
                        style={{ width: `${smPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleStepStat(p, "sm", -1)}
                        className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                        title="Diminuir 1 SN"
                      >
                        <Minus size={10} />
                      </button>
                      <StatMathInput
                        value={smCurrent}
                        onSave={(val) =>
                          onUpdateStat(p, "sm", val, p.isExtraSheet, p.rawExtraSheetId)
                        }
                        className="w-10 h-6 bg-[#0c0c10] border-y border-[#202028] text-white text-xs font-bold text-center py-0.5 rounded-none outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepStat(p, "sm", 1)}
                        className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                        title="Aumentar 1 SN"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2">
                    <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                      <span className="text-yellow-500 flex items-center gap-1">
                        <Zap size={10} /> PE
                      </span>
                      <span>{peCurrent}/{peMax}</span>
                    </div>
                    <div className="h-1.5 bg-[#181820] border border-[#242430] overflow-hidden mb-2">
                      <div
                        className="h-full bg-yellow-500 transition-all duration-200"
                        style={{ width: `${pePct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleStepStat(p, "pe", -1)}
                        className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                        title="Diminuir 1 PE"
                      >
                        <Minus size={10} />
                      </button>
                      <StatMathInput
                        value={peCurrent}
                        onSave={(val) =>
                          onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId)
                        }
                        className="w-10 h-6 bg-[#0c0c10] border-y border-[#202028] text-white text-xs font-bold text-center py-0.5 rounded-none outline-none focus:border-yellow-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepStat(p, "pe", 1)}
                        className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                        title="Aumentar 1 PE"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles de Último Suspiro / Ressurreição do Mestre */}
              <MasterUltimoSuspiroControls
                ultimoSuspiro={ultimoSuspiro}
                maxHp={hpMax}
                characterName={p.name || "Personagem"}
                isMaster={isMaster}
                onAdvanceTurn={
                  onAdvanceUltimoSuspiroTurn
                    ? () =>
                        onAdvanceUltimoSuspiroTurn(
                          p,
                          p.isExtraSheet,
                          p.rawExtraSheetId,
                        )
                    : undefined
                }
                onFinalizeDeath={
                  onFinalizeUltimoSuspiroDeath
                    ? () =>
                        onFinalizeUltimoSuspiroDeath(
                          p,
                          p.isExtraSheet,
                          p.rawExtraSheetId,
                        )
                    : undefined
                }
                onRevive={
                  onRevivePlayer
                    ? (targetHp) =>
                        onRevivePlayer(
                          p,
                          targetHp,
                          p.isExtraSheet,
                          p.rawExtraSheetId,
                        )
                    : undefined
                }
              />

              {/* EP (Exposição Paranormal - exclusivo do Mestre) */}
              {isMaster && onUpdateEp && (
                <MasterEpEditor
                  isMaster={isMaster}
                  characterName={p.name}
                  value={normalizeEpValue(p.ep, 0)}
                  onConfirm={(nextEp) =>
                    onUpdateEp(p, nextEp, p.isExtraSheet, p.rawExtraSheetId)
                  }
                />
              )}

              {/* LV (Nível - exclusivo do Mestre) */}
              {isMaster && onUpdateLv && (
                <MasterLvEditor
                  isMaster={isMaster}
                  characterName={p.name}
                  value={normalizeLevel(p.lv, p.variables, normalizeCharacterProfile(p.profile))}
                  variables={p.variables}
                  profile={normalizeCharacterProfile(p.profile)}
                  onConfirm={(nextLv) =>
                    onUpdateLv(p, nextLv, p.isExtraSheet, p.rawExtraSheetId)
                  }
                />
              )}

              {/* Condições / Status Post-its */}
              {onUpdateStatusEffects && (
                <div className="pt-2 border-t border-[#1a1a24] space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStatusId((prev) => (prev === p.id ? null : p.id))
                    }
                    className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] hover:text-white py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag size={11} className="text-[var(--op-red-bright)]" />
                      Post-its de Condição ({(p.statusEffects || []).length})
                    </span>
                    {expandedStatusId === p.id ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </button>

                  {expandedStatusId !== p.id &&
                    Array.isArray(p.statusEffects) &&
                    p.statusEffects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {p.statusEffects.map((ef: StatusEffect, idx: number) => (
                          <StatusPostIt
                            key={ef.id}
                            effect={ef}
                            index={idx}
                            compact
                            onRemove={(id) =>
                              onUpdateStatusEffects(
                                p,
                                (p.statusEffects || []).filter((item: StatusEffect) => item.id !== id),
                                p.isExtraSheet,
                                p.rawExtraSheetId,
                              )
                            }
                          />
                        ))}
                      </div>
                    )}

                  {expandedStatusId === p.id && (
                    <StatusEffectsEditor
                      effects={p.statusEffects || []}
                      compact
                      onChange={(nextEffects) =>
                        onUpdateStatusEffects(
                          p,
                          nextEffects,
                          p.isExtraSheet,
                          p.rawExtraSheetId,
                        )
                      }
                    />
                  )}
                </div>
              )}

              {/* PDI — Poderes de Intenção (Mestre pode criar/editar/alternar) */}
              {isMaster && onUpdatePdis && !isPlayerRl && (() => {
                const playerPdis = normalizePdis(p.pdis, []);
                const activePdiCount = playerPdis.filter((item) => item.active).length;
                return (
                  <div className="pt-2 border-t border-[#1a1a24] space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPdiId((prev) => (prev === p.id ? null : p.id))
                      }
                      className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] hover:text-white py-1 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={11} className="text-[var(--op-red-bright)]" />
                        PDI ({activePdiCount}/{playerPdis.length})
                      </span>
                      {expandedPdiId === p.id ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>

                    {expandedPdiId !== p.id && activePdiCount > 0 && (
                      <div className="flex flex-wrap gap-1 pb-1">
                        {playerPdis
                          .filter((item) => item.active)
                          .map((item) => (
                            <span
                              key={item.id}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 rounded-none"
                            >
                              {item.name}
                            </span>
                          ))}
                      </div>
                    )}

                    {expandedPdiId === p.id && (
                      <PdiSection
                        pdis={playerPdis}
                        canEdit={isMaster}
                        compact
                        onToggle={(pdiId) =>
                          onUpdatePdis(
                            p,
                            togglePdiActive(playerPdis, pdiId),
                            p.isExtraSheet,
                            p.rawExtraSheetId,
                          )
                        }
                        onAdd={() =>
                          setPdiEditorTarget({ player: p, initialPdi: null })
                        }
                        onEdit={(item) =>
                          setPdiEditorTarget({ player: p, initialPdi: item })
                        }
                        onDelete={(pdiId) =>
                          onUpdatePdis(
                            p,
                            removePdiItem(playerPdis, pdiId),
                            p.isExtraSheet,
                            p.rawExtraSheetId,
                          )
                        }
                      />
                    )}
                  </div>
                );
              })()}

              {/* Última Ação */}
              {p.history && p.history.length > 0 && (
                <div className="pt-2 border-t border-[#1a1a24] mt-2">
                  <div
                    className="text-xs text-[#828392] line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeRollHistoryHtml(p.history[0]) }}
                  />
                </div>
              )}
            </div>

            {p.isExtraSheet && (
              <button
                type="button"
                onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                className="w-full mt-3 py-2 bg-[#121217] hover:bg-[#181820] border border-[#202028] hover:border-[#32323e] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] text-[#60a5fa] rounded-none text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Maximize2 size={12} /> Abrir Ficha
              </button>
            )}
          </div>
        );
      })}
      </div>
      )}
      {renderFloatingInitiativeButton()}

      {isMaster && onUpdatePdis && pdiEditorTarget && (
        <PdiEditorModal
          isOpen={true}
          initialPdi={pdiEditorTarget.initialPdi}
          targetName={pdiEditorTarget.player?.name || "Personagem"}
          onClose={() => setPdiEditorTarget(null)}
          onSave={(draft) => {
            const target = pdiEditorTarget.player;
            const currentPdis = normalizePdis(target?.pdis, []);
            onUpdatePdis(
              target,
              upsertPdiItem(currentPdis, draft),
              target?.isExtraSheet,
              target?.rawExtraSheetId,
            );
          }}
          onDelete={(pdiId) => {
            const target = pdiEditorTarget.player;
            const currentPdis = normalizePdis(target?.pdis, []);
            onUpdatePdis(
              target,
              removePdiItem(currentPdis, pdiId),
              target?.isExtraSheet,
              target?.rawExtraSheetId,
            );
          }}
        />
      )}
    </div>
  );
}
