import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  Flame,
  Hourglass,
  Image as ImageIcon,
  Link2,
  Loader2,
  Minus,
  Moon,
  Music,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import type { Track } from "../services/musicSync";
import type { SoundBoardEffect } from "../utils/soundBoard";
import type { HandoutItem } from "../types";
import type {
  BackgroundActionMode,
  BackgroundSourceType,
  BlackoutEasingDirection,
  BlackoutEasingStyle,
  NarrativeScene,
  SceneBuilderNode,
  SceneBuilderNodeParams,
  SceneNodeType,
  TensionClock,
} from "../types/sceneDirector";
import {
  SCENE_NODE_CATALOG,
  SCENE_NODE_TYPE_ORDER,
  clampBlackoutHoldSec,
  clampDurationSec,
  clampFadeTransitionSec,
  clampOstFadeOutSec,
  clampStartTimeSec,
  computeBlackoutTotalSec,
  computeTimelineDurationSec,
  createDefaultSceneNode,
  detectBackgroundMediaType,
  duplicateSceneNode,
  normalizeBlackoutEasingDirection,
  normalizeBlackoutEasingStyle,
  normalizeSceneBuilderNodes,
  parseImportedSceneBuilderNodes,
  removeSceneNode,
  resolveFadeEasingCss,
  roundTenths,
  sampleEasingCurve,
  sanitizeBackgroundUrl,
  serializeSceneBuilderNodes,
  shiftNodeStartTime,
  sortSceneBuilderNodes,
  summarizeSceneNode,
} from "../utils/sceneBuilder";
import { uploadSceneBackgroundMedia } from "../services/sceneBackgroundUpload";

export interface SceneBuilderWorkspaceProps {
  scene: NarrativeScene;
  tracks: Track[];
  soundBoardEffects: SoundBoardEffect[];
  clocks: TensionClock[];
  handouts: HandoutItem[];
  onSaveNodes: (
    sceneId: string,
    nodes: SceneBuilderNode[],
  ) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
  roomId?: string;
  isRlMode?: boolean;
}

const NODE_ICON_MAP: Record<SceneNodeType, React.ComponentType<{ size?: number; className?: string }>> = {
  ost: Music,
  sfx: Volume2,
  mode: Flame,
  clock: Clock,
  handout: FileText,
  delay: Hourglass,
  fade: Film,
  blackout: Moon,
  background: ImageIcon,
};

export const SceneBuilderWorkspace: React.FC<SceneBuilderWorkspaceProps> = ({
  scene,
  tracks,
  soundBoardEffects,
  clocks,
  handouts,
  onSaveNodes,
  onClose,
  roomId = "default-table",
  isRlMode = false,
}) => {
  const [nodes, setNodes] = useState<SceneBuilderNode[]>(() =>
    normalizeSceneBuilderNodes(scene.timelineNodes),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const initial = normalizeSceneBuilderNodes(scene.timelineNodes);
    return initial[0]?.id ?? null;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState<1 | 1.5>(1);

  // Preview Playhead state (dry-run visual rehearsal)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const previewRafRef = useRef<number | null>(null);
  const previewStartTsRef = useRef<number>(0);

  // Export / Import inline panel state
  const [jsonPanelMode, setJsonPanelMode] = useState<"export" | "import" | null>(null);
  const [importDraft, setImportDraft] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Background media upload & link validation state
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [bgUploadMessage, setBgUploadMessage] = useState<{
    type: "error" | "warning" | "success";
    text: string;
  } | null>(null);
  const [bgLinkDraft, setBgLinkDraft] = useState("");
  const [bgLinkError, setBgLinkError] = useState<string | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);

  // Local Blackout Preview overlay state (Master-only rehearsal)
  const [localBlackoutOverlay, setLocalBlackoutOverlay] = useState<{
    opacity: number;
    transitionDurationSec: number;
    timingFunction: string;
    phaseLabel: string;
  } | null>(null);
  const localBlackoutRafsRef = useRef<number[]>([]);
  const localBlackoutTimersRef = useRef<number[]>([]);

  const cancelLocalBlackoutPreview = () => {
    for (const raf of localBlackoutRafsRef.current) {
      cancelAnimationFrame(raf);
    }
    localBlackoutRafsRef.current = [];
    for (const tid of localBlackoutTimersRef.current) {
      window.clearTimeout(tid);
    }
    localBlackoutTimersRef.current = [];
    setLocalBlackoutOverlay(null);
  };

  const triggerLocalBlackoutPreview = (node: SceneBuilderNode) => {
    cancelLocalBlackoutPreview();
    const fadeInSec = clampFadeTransitionSec(node.params.fadeInSec, 1);
    const holdSeconds = clampBlackoutHoldSec(node.params.holdSeconds, 2);
    const fadeOutSec = clampFadeTransitionSec(node.params.fadeOutSec, 1);
    const style = normalizeBlackoutEasingStyle(node.params.easingStyle);
    const dir = normalizeBlackoutEasingDirection(node.params.easingDirection);
    const timingFunction = resolveFadeEasingCss(style, dir);

    const scheduleHoldAndFadeOut = (rafOffsetMs: number) => {
      const fadeOutStartMs = Math.round((fadeInSec + holdSeconds) * 1000) + rafOffsetMs;
      const tFadeOut = window.setTimeout(() => {
        setLocalBlackoutOverlay({
          opacity: 0,
          transitionDurationSec: fadeOutSec,
          timingFunction,
          phaseLabel: `Fade Out (${fadeOutSec.toFixed(1)}s)`,
        });
        const tClear = window.setTimeout(() => {
          setLocalBlackoutOverlay(null);
        }, Math.round(fadeOutSec * 1000) + 90);
        localBlackoutTimersRef.current.push(tClear);
      }, fadeOutStartMs);
      localBlackoutTimersRef.current.push(tFadeOut);
    };

    if (fadeInSec > 0) {
      setLocalBlackoutOverlay({
        opacity: 0,
        transitionDurationSec: 0,
        timingFunction,
        phaseLabel: `Fade In (${fadeInSec.toFixed(1)}s)`,
      });
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setLocalBlackoutOverlay({
            opacity: 1,
            transitionDurationSec: fadeInSec,
            timingFunction,
            phaseLabel: `Fade In (${fadeInSec.toFixed(1)}s)`,
          });
        });
        localBlackoutRafsRef.current.push(raf2);
      });
      localBlackoutRafsRef.current.push(raf1);
      scheduleHoldAndFadeOut(34);
    } else {
      setLocalBlackoutOverlay({
        opacity: 1,
        transitionDurationSec: 0,
        timingFunction,
        phaseLabel: `Blackout (${holdSeconds.toFixed(1)}s)`,
      });
      scheduleHoldAndFadeOut(0);
    }
  };

  // Sync if user switches scene while workspace is mounted
  useEffect(() => {
    const next = normalizeSceneBuilderNodes(scene.timelineNodes);
    setNodes(next);
    setSelectedNodeId(next[0]?.id ?? null);
    setDirty(false);
    setPlayheadSec(0);
    setIsPreviewPlaying(false);
    cancelLocalBlackoutPreview();
  }, [scene.id]);

  // Allow ESC to dismiss local blackout preview immediately
  useEffect(() => {
    if (!localBlackoutOverlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelLocalBlackoutPreview();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [localBlackoutOverlay]);

  // Cleanup RAFs & timers on unmount
  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      cancelLocalBlackoutPreview();
    };
  }, []);

  const lookupMaps = useMemo(() => {
    const trackNameByUrl = new Map<string, string>();
    for (const t of tracks) trackNameByUrl.set(t.url, t.name);
    const effectNameById = new Map<string, string>();
    for (const fx of soundBoardEffects) effectNameById.set(fx.id, fx.name);
    const clockTitleById = new Map<string, string>();
    for (const c of clocks) clockTitleById.set(c.id, c.title);
    const handoutTitleById = new Map<string, string>();
    for (const h of handouts) handoutTitleById.set(h.id, h.title);
    return {
      trackNameByUrl,
      effectNameById,
      clockTitleById,
      handoutTitleById,
    };
  }, [tracks, soundBoardEffects, clocks, handouts]);

  const sortedNodes = useMemo(() => sortSceneBuilderNodes(nodes), [nodes]);
  const totalDurationSec = useMemo(
    () => computeTimelineDurationSec(sortedNodes),
    [sortedNodes],
  );
  const rulerMaxSec = useMemo(
    () => Math.max(8, Math.ceil((totalDurationSec + 2) / 2) * 2),
    [totalDurationSec],
  );
  const pxPerSec = zoomScale === 1 ? 76 : 112;
  const timelineCanvasWidth = rulerMaxSec * pxPerSec + 48;

  const selectedNode = useMemo(
    () => sortedNodes.find((n) => n.id === selectedNodeId) || null,
    [sortedNodes, selectedNodeId],
  );

  // Keep local URL draft synced when switching selected node
  useEffect(() => {
    if (selectedNode?.type === "background") {
      setBgLinkDraft(selectedNode.params.backgroundUrl || "");
      setBgLinkError(null);
      setBgUploadMessage(null);
    } else {
      setBgLinkDraft("");
      setBgLinkError(null);
      setBgUploadMessage(null);
    }
  }, [selectedNode?.id]);

  const handleBackgroundFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedNodeId) return;

    setIsUploadingBg(true);
    setBgUploadMessage(null);
    setBgLinkError(null);

    const res = await uploadSceneBackgroundMedia(file, roomId);
    setIsUploadingBg(false);

    if (!res.ok || !res.url) {
      setBgUploadMessage({
        type: "error",
        text: res.error || "Não foi possível enviar a mídia de fundo.",
      });
      return;
    }

    const uploadedUrl = res.url;
    const uploadedType = res.mediaType || detectBackgroundMediaType(uploadedUrl, file.type);
    const uploadedName = res.fileName || file.name.replace(/\.[^/.]+$/, "");

    setBgLinkDraft(uploadedUrl);
    updateSelectedNode((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        backgroundAction: "custom",
        backgroundSource: "upload",
        backgroundUrl: uploadedUrl,
        backgroundMediaType: uploadedType,
        backgroundName: uploadedName,
      },
    }));

    if (res.warning) {
      setBgUploadMessage({ type: "warning", text: res.warning });
    } else {
      setBgUploadMessage({
        type: "success",
        text: `Mídia "${uploadedName}" enviada e vinculada ao bloco.`,
      });
    }
  };

  // Preview Playhead animation loop
  useEffect(() => {
    if (!isPreviewPlaying) {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
      return;
    }
    const endSec = Math.max(totalDurationSec, 2);
    const startOffset = playheadSec >= endSec ? 0 : playheadSec;
    previewStartTsRef.current = performance.now() - startOffset * 1000;

    const tick = (now: number) => {
      const elapsed = (now - previewStartTsRef.current) / 1000;
      if (elapsed >= endSec) {
        setPlayheadSec(roundTenths(endSec));
        setIsPreviewPlaying(false);
        return;
      }
      setPlayheadSec(roundTenths(elapsed));
      previewRafRef.current = requestAnimationFrame(tick);
    };

    previewRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
    };
  }, [isPreviewPlaying, totalDurationSec]);

  const handleAddNode = (type: SceneNodeType) => {
    const overrides: Partial<SceneBuilderNodeParams> = {};
    if (type === "ost" && tracks.length > 0) {
      overrides.ostAction = "play";
      overrides.trackUrl = tracks[0].url;
      overrides.trackName = tracks[0].name;
    } else if (type === "sfx" && soundBoardEffects.length > 0) {
      overrides.effectId = soundBoardEffects[0].id;
      overrides.effectName = soundBoardEffects[0].name;
      overrides.volume = soundBoardEffects[0].volume ?? 1;
    } else if (type === "clock" && clocks.length > 0) {
      overrides.clockId = clocks[0].id;
      overrides.clockTitle = clocks[0].title;
      overrides.clockAction = "advance";
      overrides.amount = 1;
    } else if (type === "handout" && handouts.length > 0) {
      overrides.handoutId = handouts[0].id;
      overrides.handoutTitle = handouts[0].title;
      overrides.handoutAction = "reveal_all";
    }

    const created = createDefaultSceneNode(type, sortedNodes, overrides);
    const next = sortSceneBuilderNodes([...sortedNodes, created]);
    setNodes(next);
    setSelectedNodeId(created.id);
    setDirty(true);
    setFeedback(null);
  };

  const updateSelectedNode = (
    updater: (prev: SceneBuilderNode) => SceneBuilderNode,
  ) => {
    if (!selectedNodeId) return;
    setNodes((prev) =>
      sortSceneBuilderNodes(
        prev.map((n) => (n.id === selectedNodeId ? updater(n) : n)),
      ),
    );
    setDirty(true);
  };

  const handleShiftNode = (nodeId: string, deltaSec: number) => {
    setNodes((prev) => shiftNodeStartTime(prev, nodeId, deltaSec));
    setDirty(true);
  };

  const handleRemoveNode = (nodeId: string | null) => {
    if (!nodeId) return;
    const remaining = removeSceneNode(sortedNodes, nodeId);
    setNodes(remaining);
    setSelectedNodeId(remaining[0]?.id ?? null);
    setMobileInspectorOpen(false);
    setDirty(true);
    setFeedback({ type: "success", text: "Node removido da timeline." });
  };

  const handleDuplicateSelected = () => {
    if (!selectedNodeId) return;
    const res = duplicateSceneNode(sortedNodes, selectedNodeId);
    if (res.created) {
      setNodes(res.nodes);
      setSelectedNodeId(res.created.id);
      setDirty(true);
    }
  };

  const handleTogglePreview = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      return;
    }
    if (playheadSec >= Math.max(totalDurationSec, 2)) {
      setPlayheadSec(0);
    }
    setIsPreviewPlaying(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const res = await onSaveNodes(scene.id, sortedNodes);
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      setFeedback({
        type: "success",
        text: `Timeline salva (${sortedNodes.length} ${sortedNodes.length === 1 ? "node" : "nodes"} · ${totalDurationSec.toFixed(1)}s).`,
      });
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Falha ao salvar a timeline da cena.",
      });
    }
  };

  const handleOpenExport = async () => {
    const serialized = serializeSceneBuilderNodes(sortedNodes);
    setJsonPanelMode((prev) => (prev === "export" ? null : "export"));
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(serialized);
        setFeedback({
          type: "success",
          text: "JSON da timeline copiado para a área de transferência.",
        });
      }
    } catch {
      // Inline export box remains visible for manual copy
    }
  };

  const handleConfirmImport = () => {
    const parsed = parseImportedSceneBuilderNodes(importDraft);
    if (parsed.ok === false) {
      setFeedback({ type: "error", text: parsed.error });
      return;
    }
    setNodes(parsed.nodes);
    setSelectedNodeId(parsed.nodes[0]?.id ?? null);
    setDirty(true);
    setJsonPanelMode(null);
    setImportDraft("");
    setFeedback({
      type: "success",
      text: `${parsed.nodes.length} ${parsed.nodes.length === 1 ? "node importado" : "nodes importados"} na timeline.`,
    });
  };

  const primaryBtnClass = isRlMode
    ? "bg-purple-700 hover:bg-purple-600 border-purple-500/70 text-white"
    : "bg-[var(--op-red)] hover:bg-red-700 border-[var(--op-red-bright)]/60 text-white";

  const renderNodeInspectorContent = (node: SceneBuilderNode) => {
    const meta = SCENE_NODE_CATALOG[node.type];
    const Icon = NODE_ICON_MAP[node.type];

    return (
      <div className="space-y-3 font-mono" data-testid="scene-builder-inspector-fields">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1c1c24]">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={14} className={meta.accentTextClass} />
            <span className={`text-xs font-bold uppercase tracking-wider truncate ${meta.accentTextClass}`}>
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                updateSelectedNode((prev) => ({ ...prev, enabled: !prev.enabled }))
              }
              title={node.enabled ? "Desativar node" : "Ativar node"}
              className={`min-h-[34px] px-2 text-[10px] uppercase tracking-wider border cursor-pointer touch-manipulation inline-flex items-center gap-1 ${
                node.enabled
                  ? "bg-emerald-950/35 border-emerald-500/45 text-emerald-300"
                  : "bg-[#14141c] border-[#262634] text-[#7c7e90]"
              }`}
            >
              {node.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
              <span>{node.enabled ? "Ativo" : "Mudo"}</span>
            </button>
            <button
              type="button"
              onClick={handleDuplicateSelected}
              title="Duplicar node"
              aria-label="Duplicar node"
              className="w-8 h-[34px] bg-[#12121a] hover:bg-[#1a1a26] border border-[#242432] text-[#a1a3b3] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>

        {/* Timing controls */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
              Início (s)
            </label>
            <div className="flex items-center border border-[#262634] bg-[#08080c]">
              <button
                type="button"
                data-testid="inspector-start-minus"
                onClick={() => handleShiftNode(node.id, -0.5)}
                className="w-8 h-9 flex items-center justify-center text-[#9ca3af] hover:text-white hover:bg-[#161622] cursor-pointer touch-manipulation"
                aria-label="Adiantar 0.5 segundo"
              >
                <Minus size={12} />
              </button>
              <input
                type="number"
                step="0.5"
                min="0"
                max="300"
                data-testid="inspector-start-input"
                value={node.startTimeSec}
                onChange={(e) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    startTimeSec: clampStartTimeSec(e.target.value),
                  }))
                }
                className="w-full min-w-0 h-9 bg-transparent text-center text-xs text-white tabular-nums focus:outline-none"
              />
              <button
                type="button"
                data-testid="inspector-start-plus"
                onClick={() => handleShiftNode(node.id, 0.5)}
                className="w-8 h-9 flex items-center justify-center text-[#9ca3af] hover:text-white hover:bg-[#161622] cursor-pointer touch-manipulation"
                aria-label="Atrasar 0.5 segundo"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div>
            {node.type === "blackout" ? (
              <>
                <span className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                  Ciclo Total
                </span>
                <div
                  data-testid="inspector-blackout-total"
                  className="w-full h-9 px-2.5 bg-[#08080c] border border-[#22222c] text-xs text-[#d4d5df] tabular-nums flex items-center justify-between"
                >
                  <span>{computeBlackoutTotalSec(node.params).toFixed(1)}s</span>
                  <span className="text-[9px] uppercase text-[#7c7e90]">auto</span>
                </div>
              </>
            ) : (
              <>
                <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                  Duração (s)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="60"
                  data-testid="inspector-duration-input"
                  value={node.durationSec}
                  onChange={(e) => {
                    const dur = clampDurationSec(e.target.value, node.durationSec);
                    updateSelectedNode((prev) => ({
                      ...prev,
                      durationSec: dur,
                      params:
                        prev.type === "delay"
                          ? { ...prev.params, waitSeconds: dur }
                          : prev.type === "fade"
                            ? { ...prev.params, holdSeconds: dur }
                            : prev.params,
                    }));
                  }}
                  className="w-full h-9 px-2.5 bg-[#08080c] border border-[#262634] text-xs text-white tabular-nums focus:outline-none focus:border-[var(--op-red)]"
                />
              </>
            )}
          </div>
        </div>

        {/* Type-specific params */}
        {node.type === "ost" && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Ação da Trilha
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["play", "stop"] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    data-testid={`ost-action-${act}`}
                    onClick={() =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: { ...prev.params, ostAction: act },
                      }))
                    }
                    className={`min-h-[36px] text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation ${
                      (node.params.ostAction || "play") === act
                        ? "bg-[#26090d] border-[#dc2626] text-white"
                        : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                    }`}
                  >
                    {act === "play" ? "Tocar OST" : "Parar OST"}
                  </button>
                ))}
              </div>
            </div>

            {(node.params.ostAction || "play") === "play" && (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                    Faixa OST
                  </label>
                  <select
                    value={node.params.trackUrl || ""}
                    onChange={(e) => {
                      const url = e.target.value;
                      const found = tracks.find((t) => t.url === url);
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: {
                          ...prev.params,
                          trackUrl: url,
                          trackName: found?.name || "",
                        },
                      }));
                    }}
                    className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-[var(--op-red)]"
                  >
                    <option value="">
                      {tracks.length === 0
                        ? "Nenhuma OST cadastrada na aba Trilhas"
                        : "Selecionar trilha..."}
                    </option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.url}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                    Fade In ({node.params.fadeSeconds || 0}s)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={node.params.fadeSeconds || 0}
                    onChange={(e) =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: {
                          ...prev.params,
                          fadeSeconds: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-[var(--op-red)]"
                  />
                </div>
              </>
            )}

            {node.params.ostAction === "stop" && (() => {
              const fadeOutSec = clampOstFadeOutSec(node.params.ostFadeOutSeconds);
              return (
                <div className="space-y-2" data-testid="ost-stop-fadeout-section">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`ost-fadeout-${node.id}`}
                      className="text-[10px] uppercase tracking-wider text-[#8c8e9e]"
                    >
                      Fade Out
                    </label>
                    <span
                      data-testid="ost-stop-fadeout-value"
                      className="text-[10px] font-bold text-[#ff8a90] tabular-nums"
                    >
                      {fadeOutSec === 0
                        ? "0s · Imediato"
                        : `${Number.isInteger(fadeOutSec) ? fadeOutSec : fadeOutSec.toFixed(1)}s`}
                    </span>
                  </div>

                  <input
                    id={`ost-fadeout-${node.id}`}
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    data-testid="ost-stop-fadeout-slider"
                    value={fadeOutSec}
                    onChange={(e) =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: {
                          ...prev.params,
                          ostFadeOutSeconds: clampOstFadeOutSec(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-[var(--op-red)]"
                  />

                  <div className="grid grid-cols-4 gap-1">
                    {([0, 2, 5, 10] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        data-testid={`ost-stop-fadeout-preset-${sec}`}
                        onClick={() =>
                          updateSelectedNode((prev) => ({
                            ...prev,
                            params: {
                              ...prev.params,
                              ostFadeOutSeconds: sec,
                            },
                          }))
                        }
                        className={`min-h-[34px] text-[10px] font-bold tabular-nums border cursor-pointer touch-manipulation ${
                          fadeOutSec === sec
                            ? "bg-[#26090d] border-[#dc2626] text-white"
                            : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                        }`}
                      >
                        {sec === 0 ? "0s" : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {node.type === "sfx" && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Efeito do Sound Board
              </label>
              <select
                value={node.params.effectId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const found = soundBoardEffects.find((fx) => fx.id === id);
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      effectId: id,
                      effectName: found?.name || "",
                    },
                  }));
                }}
                className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">
                  {soundBoardEffects.length === 0
                    ? "Nenhum efeito no Sound Board"
                    : "Selecionar efeito..."}
                </option>
                {soundBoardEffects.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Volume ({Math.round((node.params.volume ?? 1) * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round((node.params.volume ?? 1) * 100)}
                onChange={(e) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      volume: Number(e.target.value) / 100,
                    },
                  }))
                }
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        )}

        {node.type === "mode" && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
              Modo de Jogo da Mesa
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["demologia", "rl"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    updateSelectedNode((prev) => ({
                      ...prev,
                      params: { ...prev.params, targetMode: m },
                    }))
                  }
                  className={`min-h-[38px] text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation ${
                    (node.params.targetMode || "demologia") === m
                      ? m === "rl"
                        ? "bg-[#221133] border-purple-400 text-purple-100"
                        : "bg-[#26090d] border-[var(--op-red-bright)] text-white"
                      : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                  }`}
                >
                  {m === "rl" ? "Real L" : "Demologia"}
                </button>
              ))}
            </div>
          </div>
        )}

        {node.type === "clock" && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Relógio de Tensão
              </label>
              <select
                value={node.params.clockId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const found = clocks.find((c) => c.id === id);
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      clockId: id,
                      clockTitle: found?.title || "",
                    },
                  }));
                }}
                className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="">
                  {clocks.length === 0
                    ? "Crie um relógio na aba Direção"
                    : "Selecionar relógio..."}
                </option>
                {clocks.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.filled}/{c.segments})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                  Ação
                </label>
                <select
                  value={node.params.clockAction || "advance"}
                  onChange={(e) =>
                    updateSelectedNode((prev) => ({
                      ...prev,
                      params: {
                        ...prev.params,
                        clockAction: e.target.value as SceneBuilderNodeParams["clockAction"],
                      },
                    }))
                  }
                  className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-yellow-500"
                >
                  <option value="advance">Avançar (+)</option>
                  <option value="regress">Recuar (-)</option>
                  <option value="reveal">Exibir p/ jogadores</option>
                  <option value="hide">Ocultar (só Mestre)</option>
                  <option value="reset">Zerar (0)</option>
                </select>
              </div>
              {(node.params.clockAction === "advance" ||
                node.params.clockAction === "regress" ||
                !node.params.clockAction) && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                    Segmentos
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={node.params.amount || 1}
                    onChange={(e) =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: {
                          ...prev.params,
                          amount: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                        },
                      }))
                    }
                    className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white tabular-nums focus:outline-none focus:border-yellow-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {node.type === "handout" && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Documento / Handout
              </label>
              <select
                value={node.params.handoutId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const found = handouts.find((h) => h.id === id);
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      handoutId: id,
                      handoutTitle: found?.title || "",
                    },
                  }));
                }}
                className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">
                  {handouts.length === 0
                    ? "Nenhum handout cadastrado"
                    : "Selecionar handout..."}
                </option>
                {handouts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Ação no Handout
              </label>
              <select
                value={node.params.handoutAction || "reveal_all"}
                onChange={(e) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      handoutAction: e.target.value as "reveal_all" | "reveal_secret",
                    },
                  }))
                }
                className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="reveal_all">Liberar para todos</option>
                <option value="reveal_secret">Revelar segredo oculto</option>
              </select>
            </div>
          </div>
        )}

        {node.type === "delay" && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
              Anotação da Pausa (opcional)
            </label>
            <input
              type="text"
              maxLength={100}
              value={node.params.note || ""}
              onChange={(e) =>
                updateSelectedNode((prev) => ({
                  ...prev,
                  params: { ...prev.params, note: e.target.value },
                }))
              }
              placeholder="Ex.: Silêncio antes do grito"
              className="w-full h-9 px-2.5 bg-[#08080c] border border-[#262634] text-xs text-white placeholder-[#525364] focus:outline-none focus:border-zinc-400"
            />
          </div>
        )}

        {node.type === "fade" && (
          <div className="space-y-2.5" data-testid="inspector-penumbra-section">
            <div className="px-2.5 py-2 bg-[#0b1918] border border-teal-700/50 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-teal-200">
                Modo: Penumbra
              </span>
              <span className="text-[10px] text-teal-300/80 tabular-nums">
                {Math.round((node.params.opacity ?? 0.6) * 100)}%
              </span>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                Intensidade da Penumbra ({Math.round((node.params.opacity ?? 0.6) * 100)}%)
              </label>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                data-testid="penumbra-opacity-slider"
                value={Math.round((node.params.opacity ?? 0.6) * 100)}
                onChange={(e) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    params: {
                      ...prev.params,
                      fadeStyle: "dim",
                      opacity: Number(e.target.value) / 100,
                    },
                  }))
                }
                className="w-full accent-teal-400"
              />
            </div>
          </div>
        )}

        {node.type === "blackout" && (() => {
          const fadeInSec = clampFadeTransitionSec(node.params.fadeInSec, 1);
          const holdSeconds = clampBlackoutHoldSec(node.params.holdSeconds, 2);
          const fadeOutSec = clampFadeTransitionSec(node.params.fadeOutSec, 1);
          const easingStyle = normalizeBlackoutEasingStyle(node.params.easingStyle);
          const easingDirection = normalizeBlackoutEasingDirection(
            node.params.easingDirection,
          );

          const updateBlackoutParams = (patch: Partial<SceneBuilderNodeParams>) => {
            updateSelectedNode((prev) => {
              const nextParams: SceneBuilderNodeParams = {
                ...prev.params,
                ...patch,
              };
              return {
                ...prev,
                durationSec: computeBlackoutTotalSec(nextParams),
                params: nextParams,
              };
            });
          };

          const curvePoints = Array.from({ length: 25 }, (_, i) => {
            const t = i / 24;
            const y = sampleEasingCurve(easingStyle, easingDirection, t);
            const px = 4 + t * 112;
            const py = 40 - y * 34;
            return `${px.toFixed(1)},${py.toFixed(1)}`;
          }).join(" ");

          return (
            <div className="space-y-3" data-testid="inspector-blackout-section">
              {/* Fade In / Duração / Fade Out */}
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label
                    htmlFor={`bo-fadein-${node.id}`}
                    className="block text-[9px] uppercase tracking-wider text-[#8c8e9e] mb-1"
                  >
                    Fade In (s)
                  </label>
                  <input
                    id={`bo-fadein-${node.id}`}
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    data-testid="blackout-fadein-input"
                    value={fadeInSec}
                    onChange={(e) =>
                      updateBlackoutParams({
                        fadeInSec: clampFadeTransitionSec(e.target.value, fadeInSec),
                      })
                    }
                    className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white tabular-nums focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`bo-hold-${node.id}`}
                    className="block text-[9px] uppercase tracking-wider text-[#8c8e9e] mb-1"
                  >
                    Duração (s)
                  </label>
                  <input
                    id={`bo-hold-${node.id}`}
                    type="number"
                    step="0.1"
                    min="0"
                    max="60"
                    data-testid="blackout-hold-input"
                    value={holdSeconds}
                    onChange={(e) =>
                      updateBlackoutParams({
                        holdSeconds: clampBlackoutHoldSec(e.target.value, holdSeconds),
                      })
                    }
                    className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white tabular-nums focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`bo-fadeout-${node.id}`}
                    className="block text-[9px] uppercase tracking-wider text-[#8c8e9e] mb-1"
                  >
                    Fade Out (s)
                  </label>
                  <input
                    id={`bo-fadeout-${node.id}`}
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    data-testid="blackout-fadeout-input"
                    value={fadeOutSec}
                    onChange={(e) =>
                      updateBlackoutParams({
                        fadeOutSec: clampFadeTransitionSec(e.target.value, fadeOutSec),
                      })
                    }
                    className="w-full h-9 px-2 bg-[#08080c] border border-[#262634] text-xs text-white tabular-nums focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Estilo de Animação: Linear, Quad, Exponencial */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                  Estilo de Animação
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "linear", label: "Linear" },
                      { id: "quad", label: "Quad" },
                      { id: "exponential", label: "Exponencial" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`blackout-style-${opt.id}`}
                      onClick={() =>
                        updateBlackoutParams({
                          easingStyle: opt.id as BlackoutEasingStyle,
                        })
                      }
                      className={`min-h-[36px] px-1 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation truncate ${
                        easingStyle === opt.id
                          ? "bg-[#220a0e] border-[var(--op-red-bright)] text-white"
                          : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aceleração: Fade In, Fade Out, InOut */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e]">
                    Aceleração
                  </label>
                  {easingStyle === "linear" && (
                    <span className="text-[9px] text-[#686a7c]">
                      Constante em Linear
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "in", label: "Fade In" },
                      { id: "out", label: "Fade Out" },
                      { id: "inout", label: "InOut" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`blackout-dir-${opt.id}`}
                      onClick={() =>
                        updateBlackoutParams({
                          easingDirection: opt.id as BlackoutEasingDirection,
                        })
                      }
                      className={`min-h-[36px] px-1 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation truncate ${
                        easingDirection === opt.id
                          ? "bg-[#1a1a26] border-white text-white"
                          : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                      } ${easingStyle === "linear" ? "opacity-60" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Curve Preview + Local Test Trigger */}
              <div className="bg-[#08080c] border border-[#1e1e28] p-2 space-y-2">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#7c7e90]">
                  <span>Curva de Escurecimento</span>
                  <span className="text-[#b4b6c4] tabular-nums">
                    {fadeInSec.toFixed(1)}s → {holdSeconds.toFixed(1)}s → {fadeOutSec.toFixed(1)}s
                  </span>
                </div>
                <svg
                  viewBox="0 0 120 44"
                  className="w-full h-11 bg-[#050508] border border-[#181822]"
                  aria-label="Prévia da curva de aceleração do Blackout"
                >
                  <line x1="4" y1="40" x2="116" y2="40" stroke="#22222c" strokeWidth="1" />
                  <line x1="4" y1="6" x2="116" y2="6" stroke="#181822" strokeDasharray="2 2" strokeWidth="1" />
                  <polyline
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    points={curvePoints}
                  />
                </svg>
                <button
                  type="button"
                  data-testid="blackout-preview-btn"
                  onClick={() => triggerLocalBlackoutPreview(node)}
                  className="w-full min-h-[36px] px-2.5 bg-[#12121a] hover:bg-[#1c1c28] border border-[#2f2f40] text-[10px] font-bold uppercase tracking-wider text-white inline-flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  <Play size={11} />
                  <span>Pré-visualizar Blackout (local)</span>
                </button>
              </div>
            </div>
          );
        })()}

        {node.type === "background" && (() => {
          const action: BackgroundActionMode =
            node.params.backgroundAction === "default" ? "default" : "custom";
          const source: BackgroundSourceType =
            node.params.backgroundSource === "upload" ? "upload" : "link";
          const mediaUrl = node.params.backgroundUrl || "";
          const mediaType = mediaUrl
            ? node.params.backgroundMediaType || detectBackgroundMediaType(mediaUrl)
            : null;

          const badgeLabel =
            mediaType === "video"
              ? "MP4 · LOOP"
              : mediaType === "gif"
                ? "GIF · LOOP"
                : "IMAGEM";

          const handleApplyLinkValue = (rawValue: string) => {
            setBgLinkDraft(rawValue);
            const trimmed = rawValue.trim();
            if (!trimmed) {
              setBgLinkError(null);
              updateSelectedNode((prev) => ({
                ...prev,
                params: {
                  ...prev.params,
                  backgroundAction: "custom",
                  backgroundSource: "link",
                  backgroundUrl: "",
                  backgroundMediaType: undefined,
                },
              }));
              return;
            }
            const clean = sanitizeBackgroundUrl(trimmed);
            if (!clean) {
              setBgLinkError("Informe uma URL válida iniciando com https:// ou http://.");
              return;
            }
            setBgLinkError(null);
            const detected = detectBackgroundMediaType(clean);
            updateSelectedNode((prev) => ({
              ...prev,
              params: {
                ...prev.params,
                backgroundAction: "custom",
                backgroundSource: "link",
                backgroundUrl: clean,
                backgroundMediaType: detected,
              },
            }));
          };

          return (
            <div className="space-y-3" data-testid="inspector-background-section">
              {/* Modo do Fundo: Personalizado vs Default */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                  Modo do Fundo
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="bg-action-custom"
                    onClick={() =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: { ...prev.params, backgroundAction: "custom" },
                      }))
                    }
                    className={`min-h-[40px] px-2 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation inline-flex items-center justify-center gap-1.5 ${
                      action === "custom"
                        ? "bg-[#191533] border-indigo-400 text-indigo-100"
                        : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                    }`}
                  >
                    <ImageIcon size={12} />
                    <span>Personalizado</span>
                  </button>
                  <button
                    type="button"
                    data-testid="bg-action-default"
                    onClick={() => {
                      setBgLinkError(null);
                      setBgUploadMessage(null);
                      updateSelectedNode((prev) => ({
                        ...prev,
                        params: { ...prev.params, backgroundAction: "default" },
                      }));
                    }}
                    className={`min-h-[40px] px-2 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation inline-flex items-center justify-center gap-1.5 ${
                      action === "default"
                        ? "bg-[#191533] border-indigo-400 text-indigo-100"
                        : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                    }`}
                  >
                    <RotateCcw size={12} />
                    <span>Default</span>
                  </button>
                </div>
              </div>

              {action === "default" ? (
                <div
                  data-testid="bg-default-info"
                  className="bg-[#08080c] border border-indigo-500/35 px-3 py-2.5 space-y-1"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    Restaurar Fundo Padrão
                  </div>
                  <p className="text-[11px] font-sans text-[#9da0b2] leading-relaxed">
                    Remove qualquer mídia ativa e restaura automaticamente o fundo
                    padrão do modo selecionado na mesa (Demologia ou Real L).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Origem da Mídia: Link vs Upload */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
                      Origem da Mídia
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        data-testid="bg-source-link"
                        onClick={() => {
                          setBgUploadMessage(null);
                          updateSelectedNode((prev) => ({
                            ...prev,
                            params: { ...prev.params, backgroundSource: "link" },
                          }));
                        }}
                        className={`min-h-[38px] px-2 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation inline-flex items-center justify-center gap-1.5 ${
                          source === "link"
                            ? "bg-[#161626] border-indigo-400/80 text-white"
                            : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                        }`}
                      >
                        <Link2 size={12} />
                        <span>Link (URL)</span>
                      </button>
                      <button
                        type="button"
                        data-testid="bg-source-upload"
                        onClick={() => {
                          setBgLinkError(null);
                          updateSelectedNode((prev) => ({
                            ...prev,
                            params: { ...prev.params, backgroundSource: "upload" },
                          }));
                        }}
                        className={`min-h-[38px] px-2 text-[10px] uppercase tracking-wider font-bold border cursor-pointer touch-manipulation inline-flex items-center justify-center gap-1.5 ${
                          source === "upload"
                            ? "bg-[#161626] border-indigo-400/80 text-white"
                            : "bg-[#08080c] border-[#262634] text-[#8c8e9e] hover:text-white"
                        }`}
                      >
                        <Upload size={12} />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>

                  {source === "link" ? (
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`bg-url-${node.id}`}
                        className="block text-[10px] uppercase tracking-wider text-[#8c8e9e]"
                      >
                        Link da Imagem, GIF ou MP4
                      </label>
                      <input
                        id={`bg-url-${node.id}`}
                        type="url"
                        data-testid="bg-url-input"
                        value={bgLinkDraft}
                        onChange={(e) => handleApplyLinkValue(e.target.value)}
                        placeholder="https://.../fundo.mp4 ou .gif ou .png"
                        className="w-full h-10 px-2.5 bg-[#08080c] border border-[#262634] text-xs text-white placeholder-[#525364] focus:outline-none focus:border-indigo-400"
                      />
                      <p className="text-[10px] font-sans text-[#7a7d8f]">
                        Suporta PNG, JPG, WEBP, GIF e MP4/WebM (GIFs e MP4 tocam em loop contínuo).
                      </p>
                      {bgLinkError && (
                        <div
                          role="alert"
                          data-testid="bg-link-error"
                          className="text-[10px] text-red-300 bg-red-950/35 border border-red-700/50 px-2 py-1.5"
                        >
                          {bgLinkError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        ref={bgFileInputRef}
                        type="file"
                        accept="image/*,.gif,video/mp4,video/webm,.mp4,.webm"
                        data-testid="bg-file-input"
                        onChange={handleBackgroundFileSelected}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isUploadingBg}
                        data-testid="bg-upload-trigger-btn"
                        onClick={() => bgFileInputRef.current?.click()}
                        className={`w-full min-h-[44px] px-3 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors touch-manipulation ${
                          isUploadingBg
                            ? "bg-[#12121d] border-indigo-500/40 text-indigo-300 cursor-wait"
                            : "bg-[#141326] hover:bg-[#1e1b3a] border-indigo-500/60 text-indigo-100 cursor-pointer"
                        }`}
                      >
                        {isUploadingBg ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Enviando mídia...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>Selecionar Imagem, GIF ou MP4</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] font-sans text-[#7a7d8f]">
                        Envie PNG, JPG, WEBP, GIF ou MP4/WebM (máx. 25 MB). GIFs e MP4 rodam em loop.
                      </p>
                      {bgUploadMessage && (
                        <div
                          role={bgUploadMessage.type === "error" ? "alert" : "status"}
                          data-testid="bg-upload-message"
                          className={`text-[10px] px-2.5 py-1.5 border ${
                            bgUploadMessage.type === "error"
                              ? "bg-red-950/35 border-red-700/50 text-red-200"
                              : bgUploadMessage.type === "warning"
                                ? "bg-amber-950/35 border-amber-600/50 text-amber-200"
                                : "bg-emerald-950/35 border-emerald-600/50 text-emerald-200"
                          }`}
                        >
                          {bgUploadMessage.text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nome da Mídia (opcional) */}
                  <div>
                    <label
                      htmlFor={`bg-name-${node.id}`}
                      className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1"
                    >
                      Nome do Fundo (opcional)
                    </label>
                    <input
                      id={`bg-name-${node.id}`}
                      type="text"
                      maxLength={80}
                      data-testid="bg-name-input"
                      value={node.params.backgroundName || ""}
                      onChange={(e) =>
                        updateSelectedNode((prev) => ({
                          ...prev,
                          params: {
                            ...prev.params,
                            backgroundName: e.target.value,
                          },
                        }))
                      }
                      placeholder="Ex.: Corredor do Sanatório"
                      className="w-full h-9 px-2.5 bg-[#08080c] border border-[#262634] text-xs text-white placeholder-[#525364] focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {/* Prévia da Mídia */}
                  {mediaUrl && (
                    <div
                      data-testid="bg-media-preview"
                      className="bg-[#050508] border border-[#252536] overflow-hidden"
                    >
                      <div className="relative w-full aspect-video bg-black overflow-hidden">
                        {mediaType === "video" ? (
                          <video
                            key={mediaUrl}
                            src={mediaUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            data-testid="bg-preview-video"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            key={mediaUrl}
                            src={mediaUrl}
                            alt="Prévia do fundo da cena"
                            data-testid="bg-preview-image"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span
                          data-testid="bg-preview-badge"
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/85 border border-indigo-400/50 text-[9px] font-bold uppercase tracking-wider text-indigo-200"
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      <div className="px-2.5 py-1.5 bg-[#0a0a10] border-t border-[#1e1e2b] flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#a5a8ba] truncate">
                          {node.params.backgroundName ||
                            (mediaUrl.startsWith("data:")
                              ? "Mídia incorporada"
                              : mediaUrl)}
                        </span>
                        <button
                          type="button"
                          data-testid="bg-clear-media-btn"
                          onClick={() => {
                            setBgLinkDraft("");
                            setBgLinkError(null);
                            setBgUploadMessage(null);
                            updateSelectedNode((prev) => ({
                              ...prev,
                              params: {
                                ...prev.params,
                                backgroundUrl: "",
                                backgroundMediaType: undefined,
                                backgroundName: "",
                              },
                            }));
                          }}
                          className="min-h-[30px] px-2 bg-[#140a0d] hover:bg-red-950/60 border border-red-800/50 text-[9px] font-bold uppercase tracking-wider text-red-300 hover:text-red-100 inline-flex items-center gap-1 cursor-pointer shrink-0 touch-manipulation"
                        >
                          <Trash2 size={10} />
                          <span>Remover</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Custom label override */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#8c8e9e] mb-1">
            Rótulo na Timeline (opcional)
          </label>
          <input
            type="text"
            maxLength={80}
            value={node.label || ""}
            onChange={(e) =>
              updateSelectedNode((prev) => ({
                ...prev,
                label: e.target.value,
              }))
            }
            placeholder={summarizeSceneNode({ ...node, label: undefined }, lookupMaps)}
            className="w-full h-9 px-2.5 bg-[#08080c] border border-[#262634] text-xs text-white placeholder-[#525364] focus:outline-none focus:border-[#52536a]"
          />
        </div>
      </div>
    );
  };

  const renderUtilitySquareButtons = () => (
    <div className="flex items-center justify-end gap-1.5" data-testid="scene-builder-utility-buttons">
      <button
        type="button"
        data-testid="scene-builder-delete-node-btn"
        disabled={!selectedNodeId}
        onClick={() => handleRemoveNode(selectedNodeId)}
        title="Remover Node selecionado"
        aria-label="Remover Node selecionado"
        className={`w-11 h-11 border flex items-center justify-center font-bold transition-colors touch-manipulation ${
          selectedNodeId
            ? "bg-[#991b1b] hover:bg-[#b91c1c] border-[#ef4444]/70 text-white cursor-pointer"
            : "bg-[#1a0c0e] border-[#32171a] text-[#664145] cursor-not-allowed"
        }`}
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        data-testid="scene-builder-export-btn"
        onClick={() => void handleOpenExport()}
        title="Exportar JSON da timeline"
        aria-label="Exportar JSON da timeline"
        className={`w-11 h-11 border flex items-center justify-center transition-colors cursor-pointer touch-manipulation ${
          jsonPanelMode === "export"
            ? "bg-[#1c1c28] border-white/50 text-white"
            : "bg-[#101016] hover:bg-[#1a1a24] border-[#2a2a38] text-[#d4d5df] hover:text-white"
        }`}
      >
        <Upload size={16} />
      </button>
      <button
        type="button"
        data-testid="scene-builder-import-btn"
        onClick={() =>
          setJsonPanelMode((prev) => (prev === "import" ? null : "import"))
        }
        title="Importar JSON na timeline"
        aria-label="Importar JSON na timeline"
        className={`w-11 h-11 border flex items-center justify-center transition-colors cursor-pointer touch-manipulation ${
          jsonPanelMode === "import"
            ? "bg-[#1c1c28] border-white/50 text-white"
            : "bg-[#101016] hover:bg-[#1a1a24] border-[#2a2a38] text-[#d4d5df] hover:text-white"
        }`}
      >
        <Download size={16} />
      </button>
    </div>
  );

  return (
    <div
      data-testid="scene-builder-workspace"
      className="max-w-7xl mx-auto px-2.5 sm:px-4 pt-3 pb-24 space-y-3 font-mono"
    >
      {/* Top Bar */}
      <div className="bg-[#0c0c10] border border-[#22222c] border-t-2 border-t-[var(--op-red)] p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            data-testid="scene-builder-back-btn"
            onClick={onClose}
            aria-label="Voltar para Direção"
            className="w-10 h-10 bg-[#12121a] hover:bg-[#1b1b26] border border-[#262634] text-[#c4c5d0] hover:text-white flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-[#8c8e9e]">
                Scene Builder
              </span>
              <span className="text-[#4a4b5c]" aria-hidden="true">
                ·
              </span>
              <h2
                data-testid="scene-builder-scene-title"
                className="text-sm sm:text-base font-bold uppercase tracking-wider text-white truncate max-w-[55vw] sm:max-w-md"
              >
                {scene.title}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] tabular-nums mt-0.5">
              <span data-testid="scene-builder-duration-label">
                Duração {totalDurationSec.toFixed(1)}s
              </span>
              <span className="text-[#4a4b5c]" aria-hidden="true">
                ·
              </span>
              <span data-testid="scene-builder-node-count">
                {sortedNodes.length} {sortedNodes.length === 1 ? "node" : "nodes"}
              </span>
              {dirty && (
                <>
                  <span className="text-[#4a4b5c]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-amber-300 uppercase text-[10px]">
                    Alterações não salvas
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            type="button"
            data-testid="scene-builder-preview-btn"
            onClick={handleTogglePreview}
            className={`min-h-[42px] px-3.5 text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation transition-colors ${
              isPreviewPlaying
                ? "bg-[#240b0f] border-[var(--op-red-bright)] text-[#ff9aa0]"
                : "bg-[#12121a] hover:bg-[#1a1a26] border-[#2a2a38] text-white"
            }`}
          >
            {isPreviewPlaying ? <Square size={12} /> : <Play size={12} />}
            <span>{isPreviewPlaying ? "Parar" : "Testar"}</span>
          </button>

          <button
            type="button"
            data-testid="scene-builder-save-btn"
            disabled={saving}
            onClick={() => void handleSave()}
            className={`min-h-[42px] px-4 text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 cursor-pointer touch-manipulation transition-colors ${primaryBtnClass}`}
          >
            <Save size={13} />
            <span>{saving ? "Salvando..." : "Salvar Cena"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          data-testid="scene-builder-feedback"
          className={`px-3.5 py-2 border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "error"
              ? "bg-red-950/40 border-red-700/60 text-red-200"
              : "bg-emerald-950/35 border-emerald-700/50 text-emerald-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <Check size={13} />
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Fechar aviso"
            className="text-current opacity-70 hover:opacity-100 cursor-pointer p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Inline Export / Import JSON Panel */}
      {jsonPanelMode && (
        <div
          data-testid="scene-builder-json-panel"
          className="bg-[#0c0c10] border border-[#2a2a38] p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              {jsonPanelMode === "export"
                ? "Exportar Timeline (JSON)"
                : "Importar Timeline (JSON)"}
            </span>
            <button
              type="button"
              onClick={() => setJsonPanelMode(null)}
              className="text-[#8c8e9e] hover:text-white cursor-pointer p-1"
              aria-label="Fechar painel JSON"
            >
              <X size={14} />
            </button>
          </div>
          {jsonPanelMode === "export" ? (
            <textarea
              readOnly
              rows={5}
              data-testid="scene-builder-export-textarea"
              value={serializeSceneBuilderNodes(sortedNodes)}
              className="w-full bg-[#08080c] border border-[#22222c] p-2.5 text-[11px] text-[#d4d5df] font-mono focus:outline-none"
            />
          ) : (
            <div className="space-y-2">
              <textarea
                rows={5}
                data-testid="scene-builder-import-textarea"
                value={importDraft}
                onChange={(e) => setImportDraft(e.target.value)}
                placeholder='Cole aqui o JSON exportado ({"format":"demologia_scene_builder_v1","nodes":[...]})'
                className="w-full bg-[#08080c] border border-[#22222c] p-2.5 text-[11px] text-white placeholder-[#525364] font-mono focus:outline-none focus:border-[var(--op-red)]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJsonPanelMode(null);
                    setImportDraft("");
                  }}
                  className="min-h-[38px] px-3 bg-[#14141c] border border-[#2a2a38] text-xs uppercase text-[#a1a3b3] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="scene-builder-confirm-import-btn"
                  onClick={handleConfirmImport}
                  className={`min-h-[38px] px-3.5 border text-xs font-bold uppercase cursor-pointer ${primaryBtnClass}`}
                >
                  Aplicar JSON
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          DESKTOP LAYOUT (PC): 3-Zone Skill-Builder Workspace
          Left: Stacked Node Palette | Center: Horizontal Timeline | Right: Inspector
      ===================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-[244px_minmax(0,1fr)_284px] gap-3 items-stretch min-h-[540px]">
        {/* Left: Node Palette (Inspired directly by the stacked bars reference) */}
        <aside
          aria-label="Paleta de Nodes"
          data-testid="scene-builder-palette-desktop"
          className="bg-[#0c0c10] border border-[#22222c] p-3 flex flex-col gap-2"
        >
          <div className="pb-2 border-b border-[#1c1c24] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#b4b6c4]">
              Adicionar Node
            </span>
            <span className="text-[10px] text-[#686a7c]">Clique p/ inserir</span>
          </div>

          <div className="flex flex-col gap-2">
            {SCENE_NODE_TYPE_ORDER.map((type) => {
              const meta = SCENE_NODE_CATALOG[type];
              const Icon = NODE_ICON_MAP[type];
              return (
                <button
                  key={type}
                  type="button"
                  data-testid={`scene-builder-add-node-${type}`}
                  onClick={() => handleAddNode(type)}
                  title={meta.description}
                  className={`w-full min-h-[46px] px-3 border flex items-center justify-between gap-2 text-left transition-colors active:scale-[0.98] cursor-pointer touch-manipulation ${meta.barBgClass} ${meta.barBorderClass} ${meta.barHoverClass}`}
                >
                  <span className="w-7 h-7 bg-black/35 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-white" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white text-right truncate">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-auto pt-3 border-t border-[#1c1c24] text-[10px] text-[#7c7e90] leading-relaxed">
            Os Nodes executam automaticamente a partir de 0.0s no momento em que a cena for ativada.
          </p>
        </aside>

        {/* Center: Horizontal Timeline Canvas */}
        <section
          aria-label="Timeline Horizontal da Cena"
          data-testid="scene-builder-timeline-desktop"
          className="bg-[#0a0a0f] border border-[#22222c] flex flex-col min-w-0 overflow-hidden"
        >
          <div className="px-3.5 py-2.5 bg-[#0c0c10] border-b border-[#1e1e28] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#b4b6c4] min-w-0">
              <span className="font-bold text-white">Timeline</span>
              <span className="text-[#4a4b5c]" aria-hidden="true">
                ·
              </span>
              <span className="text-[#8c8e9e] truncate">
                Disparada ao ativar a cena
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                data-testid="scene-builder-playhead-readout"
                className="text-[11px] font-bold text-[#ff8a90] tabular-nums"
              >
                {playheadSec.toFixed(1)}s
              </span>
              <div className="flex items-center border border-[#262634] bg-[#08080c]">
                {([1, 1.5] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomScale(z)}
                    className={`px-2 py-1 text-[10px] font-bold cursor-pointer ${
                      zoomScale === z
                        ? "bg-[#220a0e] text-white"
                        : "text-[#7c7e90] hover:text-white"
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto relative">
            <div
              style={{ width: `${timelineCanvasWidth}px` }}
              className="min-w-full min-h-full relative flex flex-col"
            >
              {/* Time Ruler */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = Math.max(0, e.clientX - rect.left - 16);
                  setPlayheadSec(clampStartTimeSec(clickX / pxPerSec));
                }}
                className="h-8 bg-[#0c0c12] border-b border-[#22222c] relative cursor-pointer select-none shrink-0"
              >
                {Array.from({ length: rulerMaxSec + 1 }).map((_, sec) => (
                  <div
                    key={sec}
                    style={{ left: `${16 + sec * pxPerSec}px` }}
                    className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
                  >
                    {sec % 2 === 0 && (
                      <span className="text-[10px] text-[#7c7e90] tabular-nums pl-1 pt-1">
                        {sec.toFixed(1)}s
                      </span>
                    )}
                    <span
                      className={`w-px ${sec % 2 === 0 ? "h-2.5 bg-[#3a3a4a]" : "h-1.5 bg-[#242430]"}`}
                    />
                  </div>
                ))}
              </div>

              {/* Grid & Tracks Body */}
              <div className="flex-1 relative py-3 px-4 space-y-2.5">
                {/* Vertical Grid Lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: rulerMaxSec + 1 }).map((_, sec) => (
                    <div
                      key={sec}
                      style={{ left: `${16 + sec * pxPerSec}px` }}
                      className={`absolute top-0 bottom-0 w-px ${
                        sec % 2 === 0 ? "bg-[#1a1a24]" : "bg-[#12121a]"
                      }`}
                    />
                  ))}
                </div>

                {/* Playhead Line */}
                <div
                  style={{ left: `${16 + playheadSec * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#dc2626] z-20 pointer-events-none"
                >
                  <div className="w-2.5 h-2.5 bg-[#dc2626] -translate-x-[4px] -translate-y-1 rotate-45" />
                </div>

                {sortedNodes.length === 0 ? (
                  <div className="relative z-10 py-16 text-center text-xs text-[#7c7e90] max-w-md mx-auto">
                    Nenhum node nesta cena ainda. Clique em um bloco na paleta à esquerda para iniciar a sequência em 0.0s.
                  </div>
                ) : (
                  sortedNodes.map((node) => {
                    const meta = SCENE_NODE_CATALOG[node.type];
                    const Icon = NODE_ICON_MAP[node.type];
                    const isSelected = node.id === selectedNodeId;
                    const isPlayheadInside =
                      isPreviewPlaying &&
                      playheadSec >= node.startTimeSec &&
                      playheadSec <= node.startTimeSec + node.durationSec;
                    const leftPx = node.startTimeSec * pxPerSec;
                    const widthPx = Math.max(150, node.durationSec * pxPerSec);

                    return (
                      <div
                        key={node.id}
                        className="relative h-11 bg-[#0e0e15]/70 border-y border-[#171722] z-10"
                      >
                        <button
                          type="button"
                          data-testid={`timeline-node-block-${node.id}`}
                          onClick={() => setSelectedNodeId(node.id)}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          className={`absolute top-1 bottom-1 px-2.5 border flex items-center gap-2 text-left transition-colors cursor-pointer overflow-hidden ${
                            meta.trackBlockBgClass
                          } ${
                            isSelected
                              ? "border-white ring-1 ring-[var(--op-red-bright)]"
                              : isPlayheadInside
                                ? "border-[var(--op-red-bright)]"
                                : meta.trackBlockBorderClass
                          } ${!node.enabled ? "opacity-45" : ""}`}
                        >
                          <Icon size={13} className={`${meta.accentTextClass} shrink-0`} />
                          <span className="text-[11px] font-bold text-white truncate flex-1">
                            {summarizeSceneNode(node, lookupMaps)}
                          </span>
                          <span className="text-[10px] text-[#b4b6c4] tabular-nums shrink-0">
                            {node.startTimeSec.toFixed(1)}s
                          </span>
                          {node.type === "blackout" && (() => {
                            const fIn = clampFadeTransitionSec(node.params.fadeInSec, 1);
                            const hold = clampBlackoutHoldSec(node.params.holdSeconds, 2);
                            const fOut = clampFadeTransitionSec(node.params.fadeOutSec, 1);
                            const tot = Math.max(0.1, fIn + hold + fOut);
                            return (
                              <span
                                aria-hidden="true"
                                className="absolute left-0 right-0 bottom-0 h-[3px] flex pointer-events-none"
                              >
                                <span
                                  style={{ width: `${(fIn / tot) * 100}%` }}
                                  className="h-full bg-gradient-to-r from-transparent to-[#dc2626]"
                                />
                                <span
                                  style={{ width: `${(hold / tot) * 100}%` }}
                                  className="h-full bg-[#dc2626]"
                                />
                                <span
                                  style={{ width: `${(fOut / tot) * 100}%` }}
                                  className="h-full bg-gradient-to-r from-[#dc2626] to-transparent"
                                />
                              </span>
                            );
                          })()}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Node Inspector + Reference Bottom-Right Square Utilities */}
        <aside
          aria-label="Inspetor do Node"
          data-testid="scene-builder-inspector-desktop"
          className="bg-[#0c0c10] border border-[#22222c] p-3 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3 overflow-y-auto">
            <div className="pb-2 border-b border-[#1c1c24] flex items-center gap-2">
              <Sliders size={13} className="text-[var(--op-red-bright)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Inspetor do Node
              </span>
            </div>

            {selectedNode ? (
              renderNodeInspectorContent(selectedNode)
            ) : (
              <p className="text-xs text-[#7c7e90] leading-relaxed py-6">
                Selecione um Node na timeline para editar o tempo de disparo, faixa, efeito ou ação.
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-[#1c1c24] flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[#686a7c]">
              Ações
            </span>
            {renderUtilitySquareButtons()}
          </div>
        </aside>
      </div>

      {/* =====================================================================
          MOBILE LAYOUT (< lg): Vertical Sequential Timeline + Bottom Node Drawer
      ===================================================================== */}
      <div className="lg:hidden space-y-3">
        {/* Vertical Sequential Timeline */}
        <section
          aria-label="Timeline da Cena Mobile"
          data-testid="scene-builder-timeline-mobile"
          className="bg-[#0c0c10] border border-[#22222c] p-3 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#1c1c24] pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Timeline da Cena
            </span>
            <span className="text-[11px] text-[#8c8e9e] tabular-nums">
              Início: 0.0s {isPreviewPlaying ? `· ${playheadSec.toFixed(1)}s` : ""}
            </span>
          </div>

          {sortedNodes.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#7c7e90]">
              Toque em um Node abaixo para montar a sequência a partir de 0.0s.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedNodes.map((node) => {
                const meta = SCENE_NODE_CATALOG[node.type];
                const Icon = NODE_ICON_MAP[node.type];
                const isSelected = node.id === selectedNodeId;

                return (
                  <div key={node.id} className="flex items-stretch gap-2.5">
                    {/* Left timestamp column */}
                    <div className="w-12 shrink-0 flex flex-col items-end pt-3">
                      <span className="text-[11px] font-bold text-[#a1a3b3] tabular-nums">
                        {node.startTimeSec.toFixed(1)}s
                      </span>
                      <div className="flex-1 w-px bg-[#262634] mr-2 mt-1.5" />
                    </div>

                    {/* Node card */}
                    <div
                      className={`flex-1 min-w-0 border transition-colors ${meta.trackBlockBgClass} ${
                        isSelected
                          ? "border-[var(--op-red-bright)]"
                          : meta.trackBlockBorderClass
                      } ${!node.enabled ? "opacity-50" : ""}`}
                    >
                      <button
                        type="button"
                        data-testid={`mobile-timeline-node-${node.id}`}
                        onClick={() => {
                          if (isSelected) {
                            setMobileInspectorOpen((prev) => !prev);
                          } else {
                            setSelectedNodeId(node.id);
                            setMobileInspectorOpen(false);
                          }
                        }}
                        className="w-full min-h-[48px] px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer touch-manipulation"
                      >
                        <Icon size={16} className={`${meta.accentTextClass} shrink-0`} />
                        <span className="text-xs font-bold text-white truncate flex-1">
                          {summarizeSceneNode(node, lookupMaps)}
                        </span>
                      </button>

                      {isSelected && (
                        <div className="px-3 pb-2.5 pt-1 border-t border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleShiftNode(node.id, -0.5)}
                                className="min-h-[38px] px-2.5 bg-black/45 border border-white/15 text-[11px] text-white tabular-nums cursor-pointer touch-manipulation"
                              >
                                -0.5s
                              </button>
                              <button
                                type="button"
                                onClick={() => handleShiftNode(node.id, 0.5)}
                                className="min-h-[38px] px-2.5 bg-black/45 border border-white/15 text-[11px] text-white tabular-nums cursor-pointer touch-manipulation"
                              >
                                +0.5s
                              </button>
                            </div>

                            <button
                              type="button"
                              data-testid="mobile-toggle-inspector-btn"
                              onClick={() => setMobileInspectorOpen((prev) => !prev)}
                              className="min-h-[38px] px-3 bg-black/55 border border-white/25 text-[11px] font-bold uppercase tracking-wider text-white cursor-pointer touch-manipulation"
                            >
                              {mobileInspectorOpen ? "Fechar" : "Editar"}
                            </button>
                          </div>

                          {mobileInspectorOpen && (
                            <div className="bg-[#0a0a0f] border border-[#262634] p-3">
                              {renderNodeInspectorContent(node)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bottom Docked Node Palette (2-column touch grid + Reference Square Utilities) */}
        <section
          aria-label="Adicionar Node Mobile"
          data-testid="scene-builder-palette-mobile"
          className="bg-[#0c0c10] border border-[#22222c] p-3 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            Adicionar Node
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SCENE_NODE_TYPE_ORDER.map((type) => {
              const meta = SCENE_NODE_CATALOG[type];
              const Icon = NODE_ICON_MAP[type];
              return (
                <button
                  key={type}
                  type="button"
                  data-testid={`mobile-add-node-${type}`}
                  onClick={() => handleAddNode(type)}
                  className={`min-h-[46px] px-2.5 border flex items-center justify-between gap-2 text-left active:scale-[0.98] cursor-pointer touch-manipulation ${meta.barBgClass} ${meta.barBorderClass}`}
                >
                  <span className="w-7 h-7 bg-black/35 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-white" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white text-right truncate">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-[#1c1c24] flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[#7c7e90]">
              {selectedNode ? `Selecionado: ${SCENE_NODE_CATALOG[selectedNode.type].shortLabel}` : "Nenhum node"}
            </span>
            {renderUtilitySquareButtons()}
          </div>
        </section>
      </div>

      {/* Local Master-only Blackout Preview Overlay */}
      {localBlackoutOverlay && (
        <div
          data-testid="scene-builder-blackout-preview"
          onClick={cancelLocalBlackoutPreview}
          role="button"
          tabIndex={0}
          aria-label="Cancelar prévia do Blackout"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
              cancelLocalBlackoutPreview();
            }
          }}
          className="fixed inset-0 z-[999] bg-black cursor-pointer flex items-end justify-center pb-8"
          style={{
            opacity: localBlackoutOverlay.opacity,
            transitionProperty: "opacity",
            transitionDuration: `${localBlackoutOverlay.transitionDurationSec}s`,
            transitionTimingFunction: localBlackoutOverlay.timingFunction,
          }}
        >
          <span className="px-3 py-1.5 bg-[#0c0c10]/90 border border-[#2a2a38] text-[10px] font-mono uppercase tracking-wider text-[#b4b6c4] pointer-events-none">
            Prévia Local · {localBlackoutOverlay.phaseLabel} · Clique ou ESC para sair
          </span>
        </div>
      )}
    </div>
  );
};
