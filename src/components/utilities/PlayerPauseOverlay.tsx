import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BarChart3,
  Gamepad2,
  Lock,
  Pause,
  RotateCcw,
  Settings,
} from "lucide-react";
import {
  MINIGAME_META,
  type MinigameConfig,
  type MinigameType,
} from "../../types/minigames";
import type { SessionPauseState } from "../../types/sessionUtilities";
import { hasAnyAllowedPauseSetting } from "../../utils/sessionUtilities";
import { applyDifficultyPreset } from "../../utils/minigamesLogic";
import type { PlayerSettings } from "../../utils/playerSettings";
import type { UseWakeLockResult } from "../../hooks/useWakeLock";
import { PlayerSettingsView } from "../PlayerSettingsView";
import { CLINICAL_EASE } from "../MotionPrimitives";
import { LazyModuleFallback } from "../LazyModuleBoundary";

const TimingMinigame = React.lazy(() =>
  import("../minigames/TimingMinigame").then((m) => ({
    default: m.TimingMinigame,
  })),
);
const LockpickMinigame = React.lazy(() =>
  import("../minigames/LockpickMinigame").then((m) => ({
    default: m.LockpickMinigame,
  })),
);
const EmfMinigame = React.lazy(() =>
  import("../minigames/EmfMinigame").then((m) => ({
    default: m.EmfMinigame,
  })),
);
const AimMinigame = React.lazy(() =>
  import("../minigames/AimMinigame").then((m) => ({
    default: m.AimMinigame,
  })),
);

export interface PlayerPauseOverlayProps {
  isOpen: boolean;
  pauseState: SessionPauseState | null;
  isRlMode?: boolean;
  playerSettings: PlayerSettings;
  onUpdatePlayerSettings: (patch: Partial<PlayerSettings>) => void;
  onResetPlayerSettings: () => void;
  wakeLock: UseWakeLockResult;
  currentOstVolume: number;
  isOstPlaying: boolean;
  onTestSound: () => void;
  onTestNotification: () => void;
  onRequestMasterAuth: () => void;
  hasAvailablePoll?: boolean;
  onOpenPoll?: () => void;
}

type PauseDrawerTab = "notice" | "settings" | "minigames";

export const PlayerPauseOverlay: React.FC<PlayerPauseOverlayProps> = ({
  isOpen,
  pauseState,
  isRlMode = false,
  playerSettings,
  onUpdatePlayerSettings,
  onResetPlayerSettings,
  wakeLock,
  currentOstVolume,
  isOstPlaying,
  onTestSound,
  onTestNotification,
  onRequestMasterAuth,
  hasAvailablePoll = false,
  onOpenPoll,
}) => {
  const [activeTab, setActiveTab] = useState<PauseDrawerTab>("notice");
  const [activeMinigameType, setActiveMinigameType] =
    useState<MinigameType | null>(null);
  const [practiceHits, setPracticeHits] = useState(0);
  const [practiceErrors, setPracticeErrors] = useState(0);
  const [practiceOutcome, setPracticeOutcome] = useState<
    "playing" | "win" | "lose"
  >("playing");
  const [practiceRunId, setPracticeRunId] = useState(1);

  const canUseSettings = pauseState
    ? hasAnyAllowedPauseSetting(pauseState.allowedSettings)
    : false;
  const allowedMinigames = pauseState?.allowedMinigames ?? [];
  const canUseMinigames = allowedMinigames.length > 0;

  // Se o Mestre revogar uma permissão enquanto o jogador está naquela aba, retorna ao aviso
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("notice");
      setActiveMinigameType(null);
      return;
    }
    if (activeTab === "settings" && !canUseSettings) {
      setActiveTab("notice");
    }
    if (activeTab === "minigames" && !canUseMinigames) {
      setActiveTab("notice");
      setActiveMinigameType(null);
    }
    if (
      activeMinigameType &&
      !allowedMinigames.includes(activeMinigameType)
    ) {
      setActiveMinigameType(null);
    }
  }, [
    isOpen,
    activeTab,
    canUseSettings,
    canUseMinigames,
    activeMinigameType,
    allowedMinigames,
  ]);

  // Trava scroll da página subjacente enquanto o Pause está ativo
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const practiceConfig: MinigameConfig | null = useMemo(() => {
    if (!activeMinigameType) return null;
    return applyDifficultyPreset(activeMinigameType, "normal");
  }, [activeMinigameType]);

  const startMinigame = useCallback((type: MinigameType) => {
    setActiveMinigameType(type);
    setPracticeHits(0);
    setPracticeErrors(0);
    setPracticeOutcome("playing");
    setPracticeRunId((r) => r + 1);
  }, []);

  const handlePracticeHit = useCallback(
    (nextHits: number) => {
      if (!practiceConfig || practiceOutcome !== "playing") return;
      setPracticeHits(nextHits);
      if (nextHits >= practiceConfig.rounds) {
        setPracticeOutcome("win");
      }
    },
    [practiceConfig, practiceOutcome],
  );

  const handlePracticeMiss = useCallback(
    (nextErrors: number) => {
      if (!practiceConfig || practiceOutcome !== "playing") return;
      setPracticeErrors(nextErrors);
      if (nextErrors >= practiceConfig.maxErrors) {
        setPracticeOutcome("lose");
      }
    },
    [practiceConfig, practiceOutcome],
  );

  const overlay = (
    <AnimatePresence>
      {isOpen && pauseState && (
        <motion.div
          key="session-pause-overlay"
          data-testid="player-pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-pause-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: CLINICAL_EASE }}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[320] bg-[#060609]/92 backdrop-blur-[4px] flex flex-col items-center justify-center p-3 sm:p-5 overflow-y-auto font-mono"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.2, ease: CLINICAL_EASE }}
            className="w-full max-w-2xl max-h-[92dvh] bg-[#0c0c10]/98 border border-[#282834] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.95)] relative flex flex-col overflow-hidden"
          >
            {/* Faixa superior vermelha característica do Demologia */}
            <div className="h-[2px] w-full bg-[var(--op-red)] shrink-0" />

            {/* Cabeçalho do Bloqueio */}
            <div className="px-4 sm:px-6 py-4 bg-[#0f0f15] border-b border-[#20202a] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  data-testid="player-pause-icon"
                  className="w-11 h-11 rounded-none bg-[#1c090c] border border-[#6e1318] flex items-center justify-center text-[var(--op-red-bright)] shrink-0"
                >
                  <Pause size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a8b9a]">
                    Interrupção Temporária · Hub Bloqueado
                  </div>
                  <h2
                    id="session-pause-title"
                    className="text-base font-bold text-white uppercase tracking-wider truncate mt-0.5"
                  >
                    Sessão Pausada
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasAvailablePoll && onOpenPoll && (
                  <button
                    type="button"
                    onClick={onOpenPoll}
                    className="min-h-[40px] px-3 bg-[#1c090c] hover:bg-[#2a0f14] border border-[#8f171c]/70 text-[#ff9ca0] hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation transition-colors"
                  >
                    <BarChart3 size={13} />
                    <span>Enquete</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onRequestMasterAuth}
                  data-testid="pause-master-access-btn"
                  title="Entrar no Painel do Mestre"
                  aria-label="Acesso do Mestre"
                  className="min-h-[40px] px-3 bg-[#14141c] hover:bg-[#1e1e2a] border border-[#282836] text-[#9ca3af] hover:text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation transition-colors"
                >
                  <Lock size={13} />
                  <span className="hidden sm:inline">Mestre</span>
                </button>
              </div>
            </div>

            {/* Navegação de áreas liberadas pelo Mestre (se houver) */}
            {(canUseSettings || canUseMinigames) && (
              <div
                role="tablist"
                aria-label="Ações permitidas durante o Pause"
                className="px-4 sm:px-6 bg-[#0a0a0f] border-b border-[#1d1d26] flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "notice"}
                  data-testid="pause-tab-notice"
                  onClick={() => setActiveTab("notice")}
                  className={`min-h-[44px] px-3.5 text-xs uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer touch-manipulation shrink-0 ${
                    activeTab === "notice"
                      ? "border-[var(--op-red-bright)] text-white"
                      : "border-transparent text-[#828392] hover:text-white"
                  }`}
                >
                  <Pause size={13} />
                  <span>Aviso</span>
                </button>

                {canUseSettings && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "settings"}
                    data-testid="pause-tab-settings"
                    onClick={() => setActiveTab("settings")}
                    className={`min-h-[44px] px-3.5 text-xs uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer touch-manipulation shrink-0 ${
                      activeTab === "settings"
                        ? "border-[var(--op-red-bright)] text-white"
                        : "border-transparent text-[#828392] hover:text-white"
                    }`}
                  >
                    <Settings size={13} />
                    <span>Configurações</span>
                  </button>
                )}

                {canUseMinigames && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "minigames"}
                    data-testid="pause-tab-minigames"
                    onClick={() => setActiveTab("minigames")}
                    className={`min-h-[44px] px-3.5 text-xs uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer touch-manipulation shrink-0 ${
                      activeTab === "minigames"
                        ? "border-[var(--op-red-bright)] text-white"
                        : "border-transparent text-[#828392] hover:text-white"
                    }`}
                  >
                    <Gamepad2 size={13} />
                    <span>Minigames ({allowedMinigames.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* Corpo rolável */}
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1">
              {activeTab === "notice" && (
                <div className="flex flex-col gap-5">
                  {/* Mensagem personalizada do Mestre */}
                  <div
                    data-testid="player-pause-message-box"
                    className="bg-[#08080c] border border-[#262634] border-l-2 border-l-[var(--op-red-bright)] p-4 sm:p-5"
                  >
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#ff8a90] font-bold mb-2">
                      Comunicado do Mestre
                    </div>
                    <p
                      data-testid="player-pause-message"
                      className="text-base sm:text-lg text-white font-sans leading-relaxed whitespace-pre-wrap break-words"
                    >
                      {pauseState.message}
                    </p>
                  </div>

                  {/* Resumo do bloqueio e atalhos para recursos liberados */}
                  <div className="text-xs text-[#8c8d9c] leading-relaxed">
                    Todas as fichas, rolagens, chat e handouts estão temporariamente bloqueados até que o Mestre encerre a pausa.
                  </div>

                  {(canUseSettings || canUseMinigames) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {canUseSettings && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("settings")}
                          className="min-h-[48px] px-4 py-3 bg-[#12121a] hover:bg-[#1a1a26] border border-[#2a2a38] hover:border-[var(--op-red)]/60 text-left flex items-center gap-3 cursor-pointer touch-manipulation transition-colors"
                        >
                          <Settings
                            size={16}
                            className="text-[var(--op-red-bright)] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white uppercase tracking-wider">
                              Abrir Configurações
                            </div>
                            <div className="text-[10px] text-[#8a8b9a] font-sans">
                              Ajustes liberados pelo Mestre
                            </div>
                          </div>
                        </button>
                      )}

                      {canUseMinigames && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("minigames")}
                          className="min-h-[48px] px-4 py-3 bg-[#12121a] hover:bg-[#1a1a26] border border-[#2a2a38] hover:border-[var(--op-red)]/60 text-left flex items-center gap-3 cursor-pointer touch-manipulation transition-colors"
                        >
                          <Gamepad2
                            size={16}
                            className="text-[var(--op-red-bright)] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white uppercase tracking-wider">
                              Jogar Minigames
                            </div>
                            <div className="text-[10px] text-[#8a8b9a] font-sans">
                              {allowedMinigames.length}{" "}
                              {allowedMinigames.length === 1
                                ? "minigame liberado"
                                : "minigames liberados"}
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "settings" && canUseSettings && (
                <div data-testid="pause-settings-panel" className="flex flex-col gap-3">
                  <div className="text-[11px] text-[#8c8d9c] bg-[#08080c] border border-[#20202a] px-3 py-2">
                    Exibindo apenas as configurações autorizadas pelo Mestre durante a pausa.
                  </div>
                  <PlayerSettingsView
                    settings={playerSettings}
                    onUpdateSettings={onUpdatePlayerSettings}
                    onResetSettings={onResetPlayerSettings}
                    wakeLock={wakeLock}
                    currentOstVolume={currentOstVolume}
                    isOstPlaying={isOstPlaying}
                    isRlMode={isRlMode}
                    onTestSound={onTestSound}
                    onTestNotification={onTestNotification}
                    allowedSections={pauseState.allowedSettings}
                    compactEmbedded
                  />
                </div>
              )}

              {activeTab === "minigames" && canUseMinigames && (
                <div data-testid="pause-minigames-panel" className="flex flex-col gap-4">
                  {!activeMinigameType || !practiceConfig ? (
                    <>
                      <div className="text-[11px] text-[#8c8d9c]">
                        Escolha um dos minigames liberados pelo Mestre para passar o tempo durante a pausa (modo livre, sem impacto na ficha):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {allowedMinigames.map((type) => {
                          const meta = MINIGAME_META[type];
                          return (
                            <button
                              key={type}
                              type="button"
                              data-testid={`pause-launch-minigame-${type}`}
                              onClick={() => startMinigame(type)}
                              className="min-h-[64px] p-3.5 bg-[#0e0e14] hover:bg-[#171014] border border-[#262634] hover:border-[var(--op-red-bright)] text-left flex flex-col justify-between gap-1 cursor-pointer touch-manipulation transition-colors"
                            >
                              <div className="text-xs font-bold text-white uppercase tracking-wider">
                                {meta.label}
                              </div>
                              <div className="text-[11px] text-[#8c8d9c] font-sans leading-snug">
                                {meta.shortDesc}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#20202a]">
                        <button
                          type="button"
                          onClick={() => setActiveMinigameType(null)}
                          className="min-h-[38px] px-3 bg-[#14141c] hover:bg-[#1e1e2a] border border-[#282836] text-xs text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation"
                        >
                          <ArrowLeft size={13} />
                          <span>Voltar</span>
                        </button>

                        <div className="flex items-center gap-4 text-xs tabular-nums">
                          <span className="text-[#22c55e] font-bold">
                            Acertos: {practiceHits}/{practiceConfig.rounds}
                          </span>
                          <span className="text-[#ef4444] font-bold">
                            Erros: {practiceErrors}/{practiceConfig.maxErrors}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#a1a1aa] text-center">
                        {MINIGAME_META[activeMinigameType].playerInstruction}
                      </p>

                      {practiceOutcome === "playing" ? (
                        <Suspense
                          fallback={
                            <LazyModuleFallback label="Carregando minigame..." />
                          }
                        >
                          <div key={`${activeMinigameType}-${practiceRunId}`}>
                            {activeMinigameType === "timing" && (
                              <TimingMinigame
                                config={practiceConfig}
                                hits={practiceHits}
                                errors={practiceErrors}
                                finished={false}
                                onHit={handlePracticeHit}
                                onMiss={handlePracticeMiss}
                              />
                            )}
                            {activeMinigameType === "lockpick" && (
                              <LockpickMinigame
                                config={practiceConfig}
                                hits={practiceHits}
                                errors={practiceErrors}
                                finished={false}
                                onHit={handlePracticeHit}
                                onMiss={handlePracticeMiss}
                              />
                            )}
                            {activeMinigameType === "emf" && (
                              <EmfMinigame
                                config={practiceConfig}
                                hits={practiceHits}
                                errors={practiceErrors}
                                finished={false}
                                onHit={handlePracticeHit}
                                onMiss={handlePracticeMiss}
                              />
                            )}
                            {activeMinigameType === "aim" && (
                              <AimMinigame
                                config={practiceConfig}
                                hits={practiceHits}
                                errors={practiceErrors}
                                finished={false}
                                onHit={handlePracticeHit}
                                onMiss={handlePracticeMiss}
                              />
                            )}
                          </div>
                        </Suspense>
                      ) : (
                        <div
                          className={`border p-5 text-center space-y-3 ${
                            practiceOutcome === "win"
                              ? "bg-[#0a140d] border-[#22c55e]/60"
                              : "bg-[#160a0a] border-[#dc2626]/60"
                          }`}
                        >
                          <h3
                            className={`text-sm font-bold uppercase tracking-[0.2em] ${
                              practiceOutcome === "win"
                                ? "text-[#22c55e]"
                                : "text-[#ef4444]"
                            }`}
                          >
                            {practiceOutcome === "win" ? "Concluído" : "Tentativas Esgotadas"}
                          </h3>
                          <p className="text-xs text-[#d4d4d8] tabular-nums">
                            Acertos: <strong className="text-white">{practiceHits}</strong> /{" "}
                            {practiceConfig.rounds}
                          </p>
                          <div className="flex flex-wrap justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => startMinigame(activeMinigameType)}
                              className="min-h-[44px] px-4 bg-[#18181f] hover:bg-[#23232e] border border-[#3a3a48] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer touch-manipulation"
                            >
                              <RotateCcw size={13} />
                              <span>Jogar Novamente</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
};
