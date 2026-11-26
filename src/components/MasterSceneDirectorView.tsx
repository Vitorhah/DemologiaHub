import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  Flame,
  Minus,
  Music,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { Track } from "../services/musicSync";
import type { SoundBoardEffect } from "../utils/soundBoard";
import type { HandoutItem } from "../types";
import type { TabletopCustomPreset } from "../types/tabletopCustomization";
import {
  ClockCategory,
  ClockSegmentCount,
  NarrativeScene,
  SceneBuilderNode,
  SceneDirectorMasterState,
  SceneEscalationLevel,
  SceneModeAction,
  TensionClock,
} from "../types/sceneDirector";
import {
  CLOCK_CATEGORY_META,
  CLOCK_SEGMENT_OPTIONS,
  SCENE_ESCALATION_META,
  isTensionClockComplete,
} from "../utils/sceneDirector";
import { computeTimelineDurationSec } from "../utils/sceneBuilder";
import type { SceneDirectorActionResult } from "../services/useSceneDirectorSync";
import { MotionAccordion } from "./MotionPrimitives";
import { SceneBuilderWorkspace } from "./SceneBuilderWorkspace";

export interface MasterSceneDirectorViewProps {
  masterState: SceneDirectorMasterState;
  syncStatus: "synced" | "syncing" | "offline";
  syncError: string | null;
  tracks: Track[];
  soundBoardEffects?: SoundBoardEffect[];
  handouts?: HandoutItem[];
  savedCustomPresets?: TabletopCustomPreset[];
  currentOstUrl?: string | null;
  runningTimelineSceneId?: string | null;
  onStopTimeline?: () => void;
  onSaveScene: (
    draft: Partial<NarrativeScene> & { title: string },
  ) => Promise<SceneDirectorActionResult>;
  onSaveSceneNodes?: (
    sceneId: string,
    nodes: SceneBuilderNode[],
  ) => Promise<SceneDirectorActionResult>;
  onDuplicateScene: (sceneId: string) => Promise<SceneDirectorActionResult>;
  onDeleteScene: (sceneId: string) => Promise<SceneDirectorActionResult>;
  onActivateScene: (scene: NarrativeScene) => Promise<SceneDirectorActionResult>;
  onDeactivateScene: () => Promise<SceneDirectorActionResult>;
  onToggleSceneVisibility: (
    sceneId: string,
  ) => Promise<SceneDirectorActionResult>;
  onSaveClock: (
    draft: Partial<TensionClock> & { title: string },
  ) => Promise<SceneDirectorActionResult>;
  onStepClock: (
    clockId: string,
    delta: number,
  ) => Promise<SceneDirectorActionResult>;
  onSetClockFilled: (
    clockId: string,
    filled: number,
  ) => Promise<SceneDirectorActionResult>;
  onResetClock: (clockId: string) => Promise<SceneDirectorActionResult>;
  onToggleClockVisibility: (
    clockId: string,
  ) => Promise<SceneDirectorActionResult>;
  onDeleteClock: (clockId: string) => Promise<SceneDirectorActionResult>;
  roomId?: string;
  isRlMode?: boolean;
}

const ESCALATION_LIST: readonly SceneEscalationLevel[] = [
  "investigacao",
  "opressao",
  "ameaca",
  "horror",
];

const CLOCK_CATEGORIES: readonly ClockCategory[] = [
  "ameaca",
  "investigacao",
  "ritual",
  "evento",
];

export const MasterSceneDirectorView: React.FC<MasterSceneDirectorViewProps> = ({
  masterState,
  syncStatus,
  syncError,
  tracks,
  soundBoardEffects = [],
  handouts = [],
  savedCustomPresets = [],
  runningTimelineSceneId = null,
  onStopTimeline,
  onSaveScene,
  onSaveSceneNodes,
  onDuplicateScene,
  onDeleteScene,
  onActivateScene,
  onDeactivateScene,
  onToggleSceneVisibility,
  onSaveClock,
  onStepClock,
  onSetClockFilled,
  onResetClock,
  onToggleClockVisibility,
  onDeleteClock,
  roomId = "default-table",
  isRlMode = false,
}) => {
  // --- Scene Builder Active Scene ---
  const [builderSceneId, setBuilderSceneId] = useState<string | null>(null);

  // --- Scene Form State ---
  const [sceneFormOpen, setSceneFormOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneTitle, setSceneTitle] = useState("");
  const [sceneAtmosphere, setSceneAtmosphere] = useState("");
  const [sceneEscalation, setSceneEscalation] =
    useState<SceneEscalationLevel>("investigacao");
  const [sceneLinkedTrack, setSceneLinkedTrack] = useState<string>("keep");
  const [sceneModeAction, setSceneModeAction] =
    useState<SceneModeAction>("keep");
  const [scenePrivateNotes, setScenePrivateNotes] = useState("");
  const [sceneVisible, setSceneVisible] = useState(true);
  const [sceneValidationError, setSceneValidationError] = useState<
    string | null
  >(null);
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<
    string | null
  >(null);

  // --- Clock Form State ---
  const [clockFormOpen, setClockFormOpen] = useState(false);
  const [editingClockId, setEditingClockId] = useState<string | null>(null);
  const [clockTitle, setClockTitle] = useState("");
  const [clockCategory, setClockCategory] = useState<ClockCategory>("ameaca");
  const [clockSegments, setClockSegments] = useState<ClockSegmentCount>(6);
  const [clockVisible, setClockVisible] = useState(false);
  const [clockPrivateNote, setClockPrivateNote] = useState("");
  const [clockValidationError, setClockValidationError] = useState<
    string | null
  >(null);
  const [confirmDeleteClockId, setConfirmDeleteClockId] = useState<
    string | null
  >(null);

  // --- Feedback banner ---
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeScene = useMemo(
    () =>
      masterState.activeSceneId
        ? masterState.scenes.find((s) => s.id === masterState.activeSceneId) ||
          null
        : null,
    [masterState.activeSceneId, masterState.scenes],
  );

  const trackLabelByUrl = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tracks) {
      map.set(t.url, t.name);
    }
    return map;
  }, [tracks]);

  const resetSceneForm = () => {
    setEditingSceneId(null);
    setSceneTitle("");
    setSceneAtmosphere("");
    setSceneEscalation("investigacao");
    setSceneLinkedTrack("keep");
    setSceneModeAction("keep");
    setScenePrivateNotes("");
    setSceneVisible(true);
    setSceneValidationError(null);
  };

  const openNewSceneForm = () => {
    resetSceneForm();
    setSceneFormOpen(true);
  };

  const openEditSceneForm = (scene: NarrativeScene) => {
    setEditingSceneId(scene.id);
    setSceneTitle(scene.title);
    setSceneAtmosphere(scene.atmosphere);
    setSceneEscalation(scene.escalation);
    setSceneLinkedTrack(scene.linkedTrackUrl);
    setSceneModeAction(scene.targetGameMode);
    setScenePrivateNotes(scene.privateNotes);
    setSceneVisible(scene.visibleToPlayers);
    setSceneValidationError(null);
    setSceneFormOpen(true);
  };

  const handleSubmitScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneTitle.trim()) {
      setSceneValidationError("Informe um título para a cena.");
      return;
    }
    setSceneValidationError(null);
    const res = await onSaveScene({
      id: editingSceneId || undefined,
      title: sceneTitle.trim(),
      atmosphere: sceneAtmosphere.trim(),
      escalation: sceneEscalation,
      linkedTrackUrl: sceneLinkedTrack,
      targetGameMode: sceneModeAction,
      privateNotes: scenePrivateNotes,
      visibleToPlayers: sceneVisible,
    });
    if (res.ok) {
      setFeedback({
        type: "success",
        text: editingSceneId
          ? `Cena "${sceneTitle.trim()}" atualizada.`
          : `Cena "${sceneTitle.trim()}" criada.`,
      });
      resetSceneForm();
      setSceneFormOpen(false);
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível salvar a cena.",
      });
    }
  };

  const handleTriggerActivateScene = async (scene: NarrativeScene) => {
    const res = await onActivateScene(scene);
    if (res.ok) {
      setFeedback({
        type: "success",
        text: scene.visibleToPlayers
          ? `Cena "${scene.title}" ativada e exibida aos jogadores.`
          : `Cena "${scene.title}" ativada em modo privado (só Mestre).`,
      });
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Erro ao ativar cena.",
      });
    }
  };

  const resetClockForm = () => {
    setEditingClockId(null);
    setClockTitle("");
    setClockCategory("ameaca");
    setClockSegments(6);
    setClockVisible(false);
    setClockPrivateNote("");
    setClockValidationError(null);
  };

  const openNewClockForm = () => {
    resetClockForm();
    setClockFormOpen(true);
  };

  const openEditClockForm = (clock: TensionClock) => {
    setEditingClockId(clock.id);
    setClockTitle(clock.title);
    setClockCategory(clock.category);
    setClockSegments(clock.segments);
    setClockVisible(clock.visibleToPlayers);
    setClockPrivateNote(clock.privateNote);
    setClockValidationError(null);
    setClockFormOpen(true);
  };

  const handleSubmitClock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockTitle.trim()) {
      setClockValidationError("Informe um nome para o relógio.");
      return;
    }
    setClockValidationError(null);
    const res = await onSaveClock({
      id: editingClockId || undefined,
      title: clockTitle.trim(),
      category: clockCategory,
      segments: clockSegments,
      visibleToPlayers: clockVisible,
      privateNote: clockPrivateNote,
    });
    if (res.ok) {
      setFeedback({
        type: "success",
        text: editingClockId
          ? `Relógio "${clockTitle.trim()}" atualizado.`
          : `Relógio "${clockTitle.trim()}" criado.`,
      });
      resetClockForm();
      setClockFormOpen(false);
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível salvar o relógio.",
      });
    }
  };

  const visibleClocksCount = masterState.clocks.filter(
    (c) => c.visibleToPlayers,
  ).length;

  const accentBorderTop = isRlMode
    ? "border-t-purple-500"
    : "border-t-[var(--op-red)]";
  const accentText = isRlMode
    ? "text-[#c084fc]"
    : "text-[var(--op-red-bright)]";
  const primaryBtnClass = isRlMode
    ? "bg-purple-700 hover:bg-purple-600 border-purple-400/50 text-white"
    : "bg-[#8f171c] hover:bg-[#b52a30] border-[#ff8085]/35 text-white";

  const builderScene = useMemo(
    () =>
      builderSceneId
        ? masterState.scenes.find((s) => s.id === builderSceneId) || null
        : null,
    [builderSceneId, masterState.scenes],
  );

  const handleOpenQuickBuilder = async () => {
    const existingTarget = activeScene || masterState.scenes[0];
    if (existingTarget) {
      setBuilderSceneId(existingTarget.id);
      return;
    }
    const defaultId = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const res = await onSaveScene({
      id: defaultId,
      title: "Nova Cena",
      atmosphere: "",
      escalation: "investigacao",
      linkedTrackUrl: "keep",
      targetGameMode: "keep",
      privateNotes: "",
      visibleToPlayers: false,
      timelineNodes: [],
    });
    if (res.ok) {
      setBuilderSceneId(defaultId);
    }
  };

  if (builderScene) {
    return (
      <SceneBuilderWorkspace
        scene={builderScene}
        tracks={tracks}
        soundBoardEffects={soundBoardEffects}
        clocks={masterState.clocks}
        handouts={handouts}
        savedCustomPresets={savedCustomPresets}
        onSaveNodes={async (sceneId, nextNodes) => {
          if (onSaveSceneNodes) {
            return onSaveSceneNodes(sceneId, nextNodes);
          }
          return onSaveScene({
            id: sceneId,
            title: builderScene.title,
            timelineNodes: nextNodes,
          });
        }}
        onClose={() => setBuilderSceneId(null)}
        roomId={roomId}
        isRlMode={isRlMode}
      />
    );
  }

  return (
    <div
      data-testid="master-scene-director-view"
      className="max-w-7xl mx-auto px-3 sm:px-4 my-4 flex flex-col gap-4 font-mono text-gray-200"
    >
      {/* CABEÇALHO DA ABA DIREÇÃO */}
      <header
        className={`bg-[#0c0c10] border border-[#202028] border-t-2 ${accentBorderTop} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Clapperboard size={17} className={`${accentText} shrink-0`} />
            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider truncate">
              Direção de Sessão
            </h2>
          </div>
          <p className="text-xs font-sans text-[#8e90a0] mt-1">
            Orquestre cenas (trilha, modo de jogo e clima) em um clique e
            controle relógios de tensão com visibilidade privada ou pública.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#9a9cad] shrink-0">
          <span className="tabular-nums">
            {masterState.scenes.length} cena
            {masterState.scenes.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {visibleClocksCount}/{masterState.clocks.length} relógios públicos
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            {syncStatus === "offline" ? (
              <CloudOff size={12} className="text-amber-400" />
            ) : (
              <Cloud size={12} className="text-emerald-400" />
            )}
            <span>
              {syncStatus === "syncing"
                ? "Sincronizando"
                : syncStatus === "offline"
                  ? "Local"
                  : "Sincronizado"}
            </span>
          </span>
        </div>
      </header>

      {(feedback || syncError) && (
        <div
          role="status"
          className={`px-3 py-2 text-xs border flex items-center justify-between gap-2 ${
            syncError || feedback?.type === "error"
              ? "bg-red-950/40 border-red-700/60 text-red-200"
              : "bg-emerald-950/35 border-emerald-600/45 text-emerald-200"
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            {syncError || feedback?.type === "error" ? (
              <AlertTriangle size={14} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            )}
            <span className="truncate">{syncError || feedback?.text}</span>
          </span>
          {feedback && (
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
              className="w-7 h-7 flex items-center justify-center text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* GRADE PRINCIPAL: DIRETOR DE CENAS (ESQUERDA) + RELÓGIOS DE TENSÃO (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* COLUNA 1: DIRETOR DE CENAS */}
        <section
          aria-label="Diretor de Cenas"
          className="lg:col-span-7 bg-[#0c0c10] border border-[#202028] p-4 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1c1c25]">
            <div className="flex items-center gap-2">
              <Clapperboard size={15} className={accentText} />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                Diretor de Cenas
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleOpenQuickBuilder()}
                data-testid="director-open-quick-builder-btn"
                className="min-h-[40px] px-3 bg-[#14141e] hover:bg-[#1e1e2c] border border-[#2e2e40] text-[#e2e3ec] hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
              >
                <Sliders size={13} className={accentText} />
                <span>Scene Builder</span>
              </button>

              <button
                type="button"
                onClick={
                  sceneFormOpen
                    ? () => {
                        resetSceneForm();
                        setSceneFormOpen(false);
                      }
                    : openNewSceneForm
                }
                data-testid="director-new-scene-btn"
                className={`min-h-[40px] px-3 text-[11px] font-bold uppercase tracking-wider border rounded-none flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap ${
                  sceneFormOpen
                    ? "bg-[#15151f] border-[#2c2c3c] text-[#c8c9d4] hover:text-white"
                    : primaryBtnClass
                }`}
              >
                {sceneFormOpen ? <X size={13} /> : <Plus size={13} />}
                <span>{sceneFormOpen ? "Cancelar" : "Nova Cena"}</span>
              </button>
            </div>
          </div>

          {/* CENA ATIVA ATUAL */}
          {activeScene && (
            <div
              data-testid="director-active-scene-banner"
              className={`border p-3.5 flex flex-col gap-2.5 ${SCENE_ESCALATION_META[activeScene.escalation].borderClass} ${SCENE_ESCALATION_META[activeScene.escalation].bgTintClass}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#b6b8c7]">
                    <span className="font-bold text-white">Cena em Curso</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        SCENE_ESCALATION_META[activeScene.escalation]
                          .accentTextClass
                      }
                    >
                      {SCENE_ESCALATION_META[activeScene.escalation].label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeScene.visibleToPlayers
                        ? "Visível aos Jogadores"
                        : "Privada (só Mestre)"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mt-1">
                    {activeScene.title}
                  </h4>
                  {activeScene.atmosphere && (
                    <p className="text-xs font-sans text-[#d4d6e2] mt-1 leading-relaxed">
                      {activeScene.atmosphere}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {runningTimelineSceneId === activeScene.id && onStopTimeline && (
                    <button
                      type="button"
                      onClick={onStopTimeline}
                      data-testid="director-stop-timeline-btn"
                      className="min-h-[38px] px-2.5 bg-[#240a0e] hover:bg-[#360e14] border border-[var(--op-red-bright)]/60 text-[10px] font-bold uppercase tracking-wider text-[#ff9aa0] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
                    >
                      <Square size={11} />
                      <span>Parar Timeline</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setBuilderSceneId(activeScene.id)}
                    data-testid="director-active-scene-builder-btn"
                    className="min-h-[38px] px-2.5 bg-[#0e0e14] hover:bg-[#181824] border border-[#2c2c3a] text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
                  >
                    <Sliders size={12} />
                    <span>Builder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void onToggleSceneVisibility(activeScene.id)}
                    data-testid="director-active-scene-visibility-btn"
                    className="min-h-[38px] px-2.5 bg-[#0e0e14] hover:bg-[#181824] border border-[#2c2c3a] text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
                  >
                    {activeScene.visibleToPlayers ? (
                      <>
                        <EyeOff size={12} />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye size={12} />
                        <span>Exibir</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void onDeactivateScene()}
                    data-testid="director-deactivate-scene-btn"
                    className="min-h-[38px] px-2.5 bg-[#121218] hover:bg-red-950/60 border border-[#2c2c3a] hover:border-red-600/60 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-red-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap"
                  >
                    <Square size={11} />
                    <span>Encerrar</span>
                  </button>
                </div>
              </div>

              {activeScene.privateNotes && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-wider text-[#9c9eb0] mb-1">
                    Notas Privadas do Mestre (nunca enviadas aos jogadores)
                  </div>
                  <p className="text-xs font-sans text-[#c4c6d4] whitespace-pre-wrap leading-relaxed">
                    {activeScene.privateNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FORMULÁRIO DE CENA */}
          <MotionAccordion isOpen={sceneFormOpen}>
            <form
              onSubmit={handleSubmitScene}
              data-testid="director-scene-form"
              className="bg-[#08080c] border border-[#242432] p-3.5 flex flex-col gap-3"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                {editingSceneId ? "Editar Cena" : "Criar Preset de Cena"}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="director-scene-title"
                  className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                >
                  Título da Cena *
                </label>
                <input
                  id="director-scene-title"
                  type="text"
                  value={sceneTitle}
                  onChange={(e) => setSceneTitle(e.target.value)}
                  placeholder="Ex: Subsolo do Sanatório — Ala B"
                  maxLength={120}
                  data-testid="director-scene-title-input"
                  className="w-full min-h-[40px] px-3 py-2 bg-[#101018] border border-[#282838] focus:border-[var(--op-red-bright)] outline-none text-xs text-white rounded-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="director-scene-atmosphere"
                  className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                >
                  Clima / Descrição Pública (opcional)
                </label>
                <input
                  id="director-scene-atmosphere"
                  type="text"
                  value={sceneAtmosphere}
                  onChange={(e) => setSceneAtmosphere(e.target.value)}
                  placeholder="Ex: Lâmpadas fluorescentes falhando e cheiro forte de cobre."
                  maxLength={280}
                  data-testid="director-scene-atmosphere-input"
                  className="w-full min-h-[40px] px-3 py-2 bg-[#101018] border border-[#282838] focus:border-[var(--op-red-bright)] outline-none text-xs font-sans text-white rounded-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="director-scene-escalation"
                    className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                  >
                    Escalonamento
                  </label>
                  <select
                    id="director-scene-escalation"
                    value={sceneEscalation}
                    onChange={(e) =>
                      setSceneEscalation(e.target.value as SceneEscalationLevel)
                    }
                    data-testid="director-scene-escalation-select"
                    className="w-full min-h-[40px] px-2.5 bg-[#101018] border border-[#282838] text-xs text-white rounded-none outline-none"
                  >
                    {ESCALATION_LIST.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {SCENE_ESCALATION_META[lvl].shortLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="director-scene-ost"
                    className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                  >
                    OST ao Ativar
                  </label>
                  <select
                    id="director-scene-ost"
                    value={sceneLinkedTrack}
                    onChange={(e) => setSceneLinkedTrack(e.target.value)}
                    data-testid="director-scene-ost-select"
                    className="w-full min-h-[40px] px-2.5 bg-[#101018] border border-[#282838] text-xs text-white rounded-none outline-none"
                  >
                    <option value="keep">Manter OST atual</option>
                    <option value="stop">Silêncio (parar OST)</option>
                    {tracks.map((track) => (
                      <option key={track.id} value={track.url}>
                        {track.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="director-scene-mode"
                    className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                  >
                    Modo da Mesa
                  </label>
                  <select
                    id="director-scene-mode"
                    value={sceneModeAction}
                    onChange={(e) =>
                      setSceneModeAction(e.target.value as SceneModeAction)
                    }
                    data-testid="director-scene-mode-select"
                    className="w-full min-h-[40px] px-2.5 bg-[#101018] border border-[#282838] text-xs text-white rounded-none outline-none"
                  >
                    <option value="keep">Manter modo atual</option>
                    <option value="demologia">Demologia</option>
                    <option value="rl">Real L</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="director-scene-notes"
                  className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                >
                  Notas Privadas do Mestre (exclusivas do Mestre)
                </label>
                <textarea
                  id="director-scene-notes"
                  rows={3}
                  value={scenePrivateNotes}
                  onChange={(e) => setScenePrivateNotes(e.target.value)}
                  placeholder="Pistas escondidas, gatilhos de ameaça, detalhes sensoriais..."
                  maxLength={4000}
                  data-testid="director-scene-notes-input"
                  className="w-full px-3 py-2 bg-[#101018] border border-[#282838] focus:border-[var(--op-red-bright)] outline-none text-xs font-sans text-white rounded-none resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={sceneVisible}
                  onClick={() => setSceneVisible((v) => !v)}
                  data-testid="director-scene-visible-toggle"
                  className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                    sceneVisible
                      ? "bg-[#1a0b0e] border-[var(--op-red)] text-white"
                      : "bg-[#101018] border-[#282836] text-[#8e90a0]"
                  }`}
                >
                  {sceneVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>
                    {sceneVisible
                      ? "Visível aos Jogadores"
                      : "Oculta (só Mestre)"}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetSceneForm();
                      setSceneFormOpen(false);
                    }}
                    className="min-h-[40px] px-3 bg-[#12121a] hover:bg-[#1a1a26] border border-[#282836] text-xs uppercase tracking-wider text-[#9ca3af] hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-testid="director-scene-save-btn"
                    className={`min-h-[40px] px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer inline-flex items-center gap-1.5 ${primaryBtnClass}`}
                  >
                    <Check size={14} />
                    <span>{editingSceneId ? "Salvar Alterações" : "Salvar Cena"}</span>
                  </button>
                </div>
              </div>

              {sceneValidationError && (
                <div role="alert" className="text-xs text-red-300">
                  {sceneValidationError}
                </div>
              )}
            </form>
          </MotionAccordion>

          {/* LISTA DE CENAS */}
          {masterState.scenes.length === 0 ? (
            <div className="bg-[#08080c] border border-dashed border-[#262634] p-6 text-center flex flex-col items-center gap-2.5">
              <Clapperboard size={22} className="text-[#56586a]" />
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Nenhuma cena preparada ainda
              </div>
              <p className="text-xs font-sans text-[#828496] max-w-md">
                Cadastre cenas com trilha sonora, modo de jogo e notas secretas
                para alternar o clima da mesa em um único clique.
              </p>
              {!sceneFormOpen && (
                <button
                  type="button"
                  onClick={openNewSceneForm}
                  className={`mt-1 min-h-[40px] px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer inline-flex items-center gap-1.5 ${primaryBtnClass}`}
                >
                  <Plus size={14} />
                  <span>Criar Primeira Cena</span>
                </button>
              )}
            </div>
          ) : (
            <div
              data-testid="director-scenes-list"
              className="flex flex-col divide-y divide-[#1b1b24] border border-[#1d1d27]"
            >
              {masterState.scenes.map((scene) => {
                const isActive = masterState.activeSceneId === scene.id;
                const escMeta = SCENE_ESCALATION_META[scene.escalation];
                const trackName =
                  scene.linkedTrackUrl === "keep"
                    ? null
                    : scene.linkedTrackUrl === "stop"
                      ? "Silêncio"
                      : trackLabelByUrl.get(scene.linkedTrackUrl) || "OST vinculada";

                return (
                  <div
                    key={scene.id}
                    data-testid={`director-scene-card-${scene.id}`}
                    className={`p-3 flex flex-col gap-2 transition-colors ${
                      isActive ? "bg-[#140a0d]" : "bg-[#09090e] hover:bg-[#0e0e15]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            {scene.title}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                              · Ativa
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8c8e9e] mt-1">
                          <span className={escMeta.accentTextClass}>
                            {escMeta.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {scene.visibleToPlayers ? "Pública" : "Privada"}
                          </span>
                          {trackName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-zinc-300">
                                <Music size={10} />
                                {trackName}
                              </span>
                            </>
                          )}
                          {scene.targetGameMode !== "keep" && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-zinc-300">
                                <Flame size={10} />
                                {scene.targetGameMode === "rl"
                                  ? "Real L"
                                  : "Demologia"}
                              </span>
                            </>
                          )}
                          {(scene.timelineNodes?.length || 0) > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#d4d6e2] tabular-nums">
                                {scene.timelineNodes!.length}{" "}
                                {scene.timelineNodes!.length === 1 ? "node" : "nodes"} ·{" "}
                                {computeTimelineDurationSec(scene.timelineNodes!).toFixed(1)}s
                              </span>
                            </>
                          )}
                        </div>

                        {scene.atmosphere && (
                          <p className="text-xs font-sans text-[#a8aab8] mt-1 line-clamp-2">
                            {scene.atmosphere}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleTriggerActivateScene(scene)}
                          data-testid={`director-activate-scene-${scene.id}`}
                          className={`min-h-[38px] px-3 text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation whitespace-nowrap ${
                            isActive
                              ? "bg-emerald-950/55 border-emerald-500/60 text-emerald-200 hover:bg-emerald-900/60"
                              : primaryBtnClass
                          }`}
                        >
                          <Play size={11} />
                          <span>{isActive ? "Reativar" : "Ativar"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBuilderSceneId(scene.id)}
                          data-testid={`director-open-builder-${scene.id}`}
                          aria-label={`Abrir Scene Builder da cena ${scene.title}`}
                          title="Abrir Scene Builder (Timeline de Nodes)"
                          className="min-h-[38px] px-2.5 bg-[#14141e] hover:bg-[#1d1d2b] border border-[#2a2a3a] text-[#d4d5df] hover:text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer touch-manipulation whitespace-nowrap"
                        >
                          <Sliders size={12} />
                          <span>Builder</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void onToggleSceneVisibility(scene.id)}
                          aria-label={
                            scene.visibleToPlayers
                              ? `Ocultar cena ${scene.title} dos jogadores`
                              : `Exibir cena ${scene.title} aos jogadores`
                          }
                          title={
                            scene.visibleToPlayers
                              ? "Visível aos jogadores"
                              : "Oculta (só Mestre)"
                          }
                          className="w-9 h-[38px] bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#a1a3b3] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          {scene.visibleToPlayers ? (
                            <Eye size={13} />
                          ) : (
                            <EyeOff size={13} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditSceneForm(scene)}
                          aria-label={`Editar cena ${scene.title}`}
                          title="Editar cena"
                          className="w-9 h-[38px] bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#a1a3b3] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => void onDuplicateScene(scene.id)}
                          aria-label={`Duplicar cena ${scene.title}`}
                          title="Duplicar cena"
                          className="w-9 h-[38px] bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#a1a3b3] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          <Copy size={13} />
                        </button>

                        {confirmDeleteSceneId === scene.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteSceneId(null);
                              void onDeleteScene(scene.id);
                            }}
                            aria-label={`Confirmar exclusão da cena ${scene.title}`}
                            className="min-h-[38px] px-2.5 bg-red-950/75 border border-red-500 text-red-200 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            Excluir?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSceneId(scene.id)}
                            aria-label={`Excluir cena ${scene.title}`}
                            title="Excluir cena"
                            className="w-9 h-[38px] bg-[#12121a] hover:bg-red-950/45 border border-[#242432] hover:border-red-700/60 text-[#8e90a0] hover:text-red-300 flex items-center justify-center cursor-pointer touch-manipulation"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* COLUNA 2: RELÓGIOS DE TENSÃO / AMEAÇAS */}
        <section
          aria-label="Relógios de Tensão"
          className="lg:col-span-5 bg-[#0c0c10] border border-[#202028] p-4 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1c1c25]">
            <div className="flex items-center gap-2">
              <Clock size={15} className={accentText} />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                Relógios de Tensão
              </h3>
            </div>

            <button
              type="button"
              onClick={
                clockFormOpen
                  ? () => {
                      resetClockForm();
                      setClockFormOpen(false);
                    }
                  : openNewClockForm
              }
              data-testid="director-new-clock-btn"
              className={`min-h-[40px] px-3 text-[11px] font-bold uppercase tracking-wider border rounded-none flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation whitespace-nowrap ${
                clockFormOpen
                  ? "bg-[#15151f] border-[#2c2c3c] text-[#c8c9d4] hover:text-white"
                  : primaryBtnClass
              }`}
            >
              {clockFormOpen ? <X size={13} /> : <Plus size={13} />}
              <span>{clockFormOpen ? "Cancelar" : "Novo Relógio"}</span>
            </button>
          </div>

          {/* FORMULÁRIO DE RELÓGIO */}
          <MotionAccordion isOpen={clockFormOpen}>
            <form
              onSubmit={handleSubmitClock}
              data-testid="director-clock-form"
              className="bg-[#08080c] border border-[#242432] p-3.5 flex flex-col gap-3"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-white">
                {editingClockId ? "Editar Relógio" : "Novo Relógio Narrativo"}
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="director-clock-title"
                  className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                >
                  Nome do Relógio *
                </label>
                <input
                  id="director-clock-title"
                  type="text"
                  value={clockTitle}
                  onChange={(e) => setClockTitle(e.target.value)}
                  placeholder="Ex: Conclusão do Ritual"
                  maxLength={90}
                  data-testid="director-clock-title-input"
                  className="w-full min-h-[40px] px-3 py-2 bg-[#101018] border border-[#282838] focus:border-[var(--op-red-bright)] outline-none text-xs text-white rounded-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="director-clock-category"
                    className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                  >
                    Categoria
                  </label>
                  <select
                    id="director-clock-category"
                    value={clockCategory}
                    onChange={(e) =>
                      setClockCategory(e.target.value as ClockCategory)
                    }
                    data-testid="director-clock-category-select"
                    className="w-full min-h-[40px] px-2.5 bg-[#101018] border border-[#282838] text-xs text-white rounded-none outline-none"
                  >
                    {CLOCK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CLOCK_CATEGORY_META[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#9a9cad]">
                    Segmentos
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {CLOCK_SEGMENT_OPTIONS.map((seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setClockSegments(seg)}
                        data-testid={`director-clock-seg-${seg}`}
                        className={`min-h-[40px] text-xs font-bold tabular-nums border cursor-pointer ${
                          clockSegments === seg
                            ? isRlMode
                              ? "bg-purple-950/65 border-purple-500 text-white"
                              : "bg-[#240a0e] border-[var(--op-red-bright)] text-white"
                            : "bg-[#101018] border-[#262634] text-[#8e90a0] hover:text-white"
                        }`}
                      >
                        {seg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="director-clock-note"
                  className="text-[10px] uppercase tracking-wider text-[#9a9cad]"
                >
                  Consequência / Nota Privada (só Mestre)
                </label>
                <input
                  id="director-clock-note"
                  type="text"
                  value={clockPrivateNote}
                  onChange={(e) => setClockPrivateNote(e.target.value)}
                  placeholder="O que acontece quando o relógio completar..."
                  maxLength={500}
                  data-testid="director-clock-note-input"
                  className="w-full min-h-[40px] px-3 py-2 bg-[#101018] border border-[#282838] outline-none text-xs font-sans text-white rounded-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={clockVisible}
                  onClick={() => setClockVisible((v) => !v)}
                  data-testid="director-clock-visible-toggle"
                  className={`min-h-[38px] px-3 text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                    clockVisible
                      ? "bg-[#1a0b0e] border-[var(--op-red)] text-white"
                      : "bg-[#101018] border-[#282836] text-[#8e90a0]"
                  }`}
                >
                  {clockVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{clockVisible ? "Público" : "Oculto (Mestre)"}</span>
                </button>

                <button
                  type="submit"
                  data-testid="director-clock-save-btn"
                  className={`min-h-[40px] px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer inline-flex items-center gap-1.5 ${primaryBtnClass}`}
                >
                  <Check size={14} />
                  <span>{editingClockId ? "Salvar" : "Criar Relógio"}</span>
                </button>
              </div>

              {clockValidationError && (
                <div role="alert" className="text-xs text-red-300">
                  {clockValidationError}
                </div>
              )}
            </form>
          </MotionAccordion>

          {/* LISTA DE RELÓGIOS */}
          {masterState.clocks.length === 0 ? (
            <div className="bg-[#08080c] border border-dashed border-[#262634] p-6 text-center flex flex-col items-center gap-2.5">
              <Clock size={22} className="text-[#56586a]" />
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Nenhum relógio ativo
              </div>
              <p className="text-xs font-sans text-[#828496]">
                Acompanhe ameaças, rituais ou investigações com blocos
                progressivos visíveis só para você ou para toda a mesa.
              </p>
              {!clockFormOpen && (
                <button
                  type="button"
                  onClick={openNewClockForm}
                  className={`mt-1 min-h-[40px] px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer inline-flex items-center gap-1.5 ${primaryBtnClass}`}
                >
                  <Plus size={14} />
                  <span>Criar Relógio</span>
                </button>
              )}
            </div>
          ) : (
            <div
              data-testid="director-clocks-list"
              className="flex flex-col gap-2.5"
            >
              {masterState.clocks.map((clock) => {
                const catMeta = CLOCK_CATEGORY_META[clock.category];
                const complete = isTensionClockComplete(clock);
                return (
                  <div
                    key={clock.id}
                    data-testid={`director-clock-card-${clock.id}`}
                    className={`bg-[#09090e] border p-3 flex flex-col gap-2.5 ${
                      complete ? "border-red-500/75" : "border-[#20202b]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            {clock.title}
                          </span>
                          <span
                            data-testid={`director-clock-count-${clock.id}`}
                            className={`text-xs font-bold tabular-nums ${
                              complete ? "text-red-300" : catMeta.textClass
                            }`}
                          >
                            {clock.filled}/{clock.segments}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8c8e9e] mt-0.5">
                          <span className={catMeta.textClass}>
                            {catMeta.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {clock.visibleToPlayers
                              ? "Visível aos Jogadores"
                              : "Oculto (só Mestre)"}
                          </span>
                          {complete && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-red-300 font-bold">
                                Concluído
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void onToggleClockVisibility(clock.id)}
                          data-testid={`director-clock-vis-${clock.id}`}
                          aria-label={
                            clock.visibleToPlayers
                              ? `Ocultar relógio ${clock.title}`
                              : `Exibir relógio ${clock.title} aos jogadores`
                          }
                          title={
                            clock.visibleToPlayers
                              ? "Visível aos jogadores"
                              : "Oculto (só Mestre)"
                          }
                          className={`w-9 h-9 border flex items-center justify-center cursor-pointer touch-manipulation ${
                            clock.visibleToPlayers
                              ? "bg-[#1a0b0e] border-[var(--op-red)]/65 text-white"
                              : "bg-[#12121a] border-[#242432] text-[#8e90a0] hover:text-white"
                          }`}
                        >
                          {clock.visibleToPlayers ? (
                            <Eye size={13} />
                          ) : (
                            <EyeOff size={13} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditClockForm(clock)}
                          aria-label={`Editar relógio ${clock.title}`}
                          title="Editar relógio"
                          className="w-9 h-9 bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#a1a3b3] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        >
                          <Edit2 size={13} />
                        </button>
                        {confirmDeleteClockId === clock.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteClockId(null);
                              void onDeleteClock(clock.id);
                            }}
                            aria-label={`Confirmar exclusão do relógio ${clock.title}`}
                            className="min-h-[36px] px-2 bg-red-950/75 border border-red-500 text-red-200 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            Excluir?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteClockId(clock.id)}
                            aria-label={`Excluir relógio ${clock.title}`}
                            title="Excluir relógio"
                            className="w-9 h-9 bg-[#12121a] hover:bg-red-950/45 border border-[#242432] hover:border-red-700/60 text-[#8e90a0] hover:text-red-300 flex items-center justify-center cursor-pointer touch-manipulation"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SEGMENTOS CLICÁVEIS */}
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${clock.segments}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: clock.segments }).map((_, idx) => {
                        const segNum = idx + 1;
                        const isFilled = idx < clock.filled;
                        return (
                          <button
                            key={segNum}
                            type="button"
                            onClick={() =>
                              void onSetClockFilled(
                                clock.id,
                                segNum === clock.filled ? segNum - 1 : segNum,
                              )
                            }
                            aria-label={`Definir ${clock.title} para ${segNum} de ${clock.segments}`}
                            className={`h-6 border transition-colors cursor-pointer touch-manipulation ${
                              isFilled
                                ? `${catMeta.fillClass} border-transparent`
                                : "bg-[#13131c] border-[#262634] hover:border-[#3c3c52]"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* CONTROLES -1 / +1 / RESET */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void onStepClock(clock.id, -1)}
                          disabled={clock.filled <= 0}
                          data-testid={`director-clock-dec-${clock.id}`}
                          aria-label={`Recuar 1 segmento em ${clock.title}`}
                          className="min-w-[40px] min-h-[38px] px-2.5 bg-[#12121a] hover:bg-[#1a1a26] border border-[#262634] text-zinc-200 disabled:opacity-40 flex items-center justify-center gap-1 text-xs font-bold cursor-pointer touch-manipulation"
                        >
                          <Minus size={13} />
                          <span>1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onStepClock(clock.id, 1)}
                          disabled={clock.filled >= clock.segments}
                          data-testid={`director-clock-inc-${clock.id}`}
                          aria-label={`Avançar 1 segmento em ${clock.title}`}
                          className="min-w-[40px] min-h-[38px] px-2.5 bg-[#1a0b0e] hover:bg-[#2a1015] border border-[var(--op-red)]/65 text-white disabled:opacity-40 flex items-center justify-center gap-1 text-xs font-bold cursor-pointer touch-manipulation"
                        >
                          <Plus size={13} />
                          <span>1</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void onResetClock(clock.id)}
                        disabled={clock.filled === 0}
                        aria-label={`Zerar relógio ${clock.title}`}
                        className="min-h-[38px] px-2.5 bg-[#101018] hover:bg-[#181824] border border-[#242432] text-[10px] uppercase tracking-wider text-[#9a9cad] hover:text-white disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer touch-manipulation"
                      >
                        <RotateCcw size={11} />
                        <span>Zerar</span>
                      </button>
                    </div>

                    {clock.privateNote && (
                      <div className="pt-2 border-t border-[#1b1b24] text-[11px] font-sans text-[#9496a8]">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#6e7082] mr-1.5">
                          Nota:
                        </span>
                        {clock.privateNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
