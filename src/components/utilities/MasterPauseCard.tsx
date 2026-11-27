import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Gamepad2,
  Loader2,
  Pause,
  Play,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { MINIGAME_META, type MinigameType } from "../../types/minigames";
import type {
  PauseAllowedSettings,
  PauseMutationInput,
  PauseSettingsSectionId,
  SessionPauseState,
  SessionUtilityActionResult,
} from "../../types/sessionUtilities";
import {
  DEFAULT_PAUSE_ALLOWED_SETTINGS,
  PAUSE_MESSAGE_MAX_LENGTH,
  VALID_PAUSE_MINIGAMES,
} from "../../utils/sessionUtilities";
import { CLINICAL_EASE } from "../MotionPrimitives";

export interface MasterPauseCardProps {
  roomId: string;
  pauseState: SessionPauseState | null;
  isPauseActive: boolean;
  isCurrentMasterOwner: boolean;
  isSaving: boolean;
  syncError: string | null;
  onActivateOrUpdate: (
    input: PauseMutationInput,
  ) => Promise<SessionUtilityActionResult>;
  onEndPause: () => Promise<SessionUtilityActionResult>;
}

const SETTING_OPTIONS: {
  id: PauseSettingsSectionId;
  label: string;
  desc: string;
}[] = [
  {
    id: "audio",
    label: "Áudio e Volume",
    desc: "Volume local da página, mudo e som de dados.",
  },
  {
    id: "notifications",
    label: "Notificações",
    desc: "Tempo de exibição e pop-ups de rolagem.",
  },
  {
    id: "visual",
    label: "Conforto Visual",
    desc: "Tamanho do texto, animações, vibração e tela acesa.",
  },
];

export const MasterPauseCard: React.FC<MasterPauseCardProps> = ({
  roomId,
  pauseState,
  isPauseActive,
  isCurrentMasterOwner,
  isSaving,
  syncError,
  onActivateOrUpdate,
  onEndPause,
}) => {
  const [message, setMessage] = useState("");
  const [allowedSettings, setAllowedSettings] = useState<PauseAllowedSettings>({
    ...DEFAULT_PAUSE_ALLOWED_SETTINGS,
  });
  const [allowedMinigames, setAllowedMinigames] = useState<MinigameType[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sincroniza formulário com estado ativo do servidor quando já existe Pause ativo
  useEffect(() => {
    if (pauseState && isPauseActive) {
      setMessage(pauseState.message || "");
      setAllowedSettings({ ...pauseState.allowedSettings });
      setAllowedMinigames([...pauseState.allowedMinigames]);
    }
  }, [
    isPauseActive,
    pauseState?.updatedAt,
    pauseState?.message,
  ]);

  const toggleSetting = (id: PauseSettingsSectionId) => {
    setAllowedSettings((prev) => ({ ...prev, [id]: !prev[id] }));
    setFeedback(null);
  };

  const toggleMinigame = (type: MinigameType) => {
    setAllowedMinigames((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await onActivateOrUpdate({
      message,
      allowedSettings,
      allowedMinigames,
    });
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível ativar o Pause.",
      });
    } else {
      setFeedback({
        type: "success",
        text: isPauseActive
          ? "Configurações e mensagem do Pause atualizadas para todos os jogadores da sessão."
          : "Pause ativado. O Hub dos jogadores desta sessão foi bloqueado.",
      });
    }
  };

  const handleEnd = async () => {
    setFeedback(null);
    const res = await onEndPause();
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Falha ao encerrar o Pause.",
      });
    } else {
      setFeedback({
        type: "success",
        text: "Pause encerrado. O Hub foi liberado para os jogadores.",
      });
    }
  };

  const lockedByAnotherMaster = isPauseActive && !isCurrentMasterOwner;

  return (
    <section
      aria-label="Controle de Pause da Sessão"
      data-testid="master-pause-card"
      className={`bg-[#0c0c10] border rounded-none p-4 sm:p-5 flex flex-col gap-4 font-mono relative overflow-hidden ${
        isPauseActive ? "border-[#8f171c]/80" : "border-[#202028]"
      }`}
    >
      {isPauseActive && (
        <div
          className="h-[2px] w-full bg-[var(--op-red-bright)] absolute top-0 left-0"
          aria-hidden="true"
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1c1c24] pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 border flex items-center justify-center shrink-0 ${
              isPauseActive
                ? "bg-[#220a0d] border-[var(--op-red-bright)] text-[var(--op-red-bright)]"
                : "bg-[#160a0d] border-[#8f171c]/50 text-[var(--op-red-bright)]"
            }`}
          >
            <Pause size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Pause da Sessão
              </h3>
              <span
                data-testid="master-pause-status-badge"
                className={`text-[10px] px-2 py-0.5 border uppercase tracking-widest font-bold ${
                  isPauseActive
                    ? "bg-[#220a0d] border-[var(--op-red-bright)] text-[#ff9ca0]"
                    : "bg-[#121218] border-[#262632] text-[#787989]"
                }`}
              >
                {isPauseActive ? "Pause Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-xs text-[#8c8d9c] mt-1">
              Bloqueia temporariamente o Hub dos jogadores desta sessão ({roomId}), mantendo o seu acesso de Mestre liberado.
            </p>
          </div>
        </div>

        {isPauseActive && isCurrentMasterOwner && (
          <button
            type="button"
            onClick={handleEnd}
            disabled={isSaving}
            data-testid="master-pause-end-btn"
            className="min-h-[44px] px-4 py-2 bg-[#14141c] hover:bg-[#1e1e2b] border border-[#3a3a4a] hover:border-white/50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-colors shrink-0 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} className="text-emerald-400" />
            )}
            <span>Encerrar Pause</span>
          </button>
        )}
      </div>

      {lockedByAnotherMaster && (
        <div
          role="alert"
          className="px-3 py-2.5 bg-red-950/35 border border-red-800/60 text-red-200 text-xs flex items-center gap-2"
        >
          <ShieldAlert size={15} className="shrink-0 text-red-400" />
          <span>
            Outro Mestre mantém um Pause ativo nesta sala. Apenas o Mestre responsável pode encerrá-lo.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Mensagem Personalizada */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="master-pause-message-input"
              className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold"
            >
              Mensagem aos Jogadores
            </label>
            <span className="text-[10px] text-[#787989] tabular-nums">
              {message.length}/{PAUSE_MESSAGE_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="master-pause-message-input"
            data-testid="master-pause-message-input"
            rows={2}
            maxLength={PAUSE_MESSAGE_MAX_LENGTH}
            disabled={lockedByAnotherMaster || isSaving}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (feedback) setFeedback(null);
            }}
            placeholder="Escreva o motivo da pausa que aparecerá na tela dos jogadores..."
            className="w-full min-h-[72px] bg-[#08080b] border border-[#262632] focus:border-[var(--op-red-bright)] text-white text-sm sm:text-xs font-mono px-3.5 py-2.5 rounded-none outline-none placeholder:text-[#52525b] resize-y disabled:opacity-50"
          />
        </div>

        {/* Permissões durante o Pause */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Configurações liberadas */}
          <div className="bg-[#09090d] border border-[#1f1f28] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-200 font-bold">
              <Settings size={13} className="text-[var(--op-red-bright)]" />
              <span>Configurações Liberadas</span>
            </div>
            <div className="flex flex-col gap-2">
              {SETTING_OPTIONS.map((opt) => {
                const checked = allowedSettings[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={lockedByAnotherMaster || isSaving}
                    onClick={() => toggleSetting(opt.id)}
                    aria-pressed={checked}
                    data-testid={`pause-allow-setting-${opt.id}`}
                    className={`min-h-[44px] px-3 py-2 border text-left flex items-start gap-2.5 cursor-pointer touch-manipulation transition-colors disabled:opacity-50 ${
                      checked
                        ? "bg-[#1a0a0d] border-[var(--op-red-bright)]/80 text-white"
                        : "bg-[#101016] border-[#24242f] hover:border-[#383848] text-[#9ca3af]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 border flex items-center justify-center shrink-0 ${
                        checked
                          ? "border-[var(--op-red-bright)] bg-[var(--op-red)]/25 text-[#ff8a90]"
                          : "border-[#3f3f4a]"
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-[#828392] font-sans leading-snug mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minigames liberados */}
          <div className="bg-[#09090d] border border-[#1f1f28] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-200 font-bold">
              <Gamepad2 size={13} className="text-[var(--op-red-bright)]" />
              <span>Minigames Liberados</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VALID_PAUSE_MINIGAMES.map((type) => {
                const meta = MINIGAME_META[type];
                const checked = allowedMinigames.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={lockedByAnotherMaster || isSaving}
                    onClick={() => toggleMinigame(type)}
                    aria-pressed={checked}
                    data-testid={`pause-allow-minigame-${type}`}
                    className={`min-h-[44px] px-3 py-2 border text-left flex items-start gap-2.5 cursor-pointer touch-manipulation transition-colors disabled:opacity-50 ${
                      checked
                        ? "bg-[#1a0a0d] border-[var(--op-red-bright)]/80 text-white"
                        : "bg-[#101016] border-[#24242f] hover:border-[#383848] text-[#9ca3af]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 border flex items-center justify-center shrink-0 ${
                        checked
                          ? "border-[var(--op-red-bright)] bg-[var(--op-red)]/25 text-[#ff8a90]"
                          : "border-[#3f3f4a]"
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {meta.label}
                      </div>
                      <div className="text-[10px] text-[#828392] font-sans leading-snug mt-0.5">
                        {meta.shortDesc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#787989] font-sans">
              Os itens desmarcados ficam totalmente bloqueados até o encerramento do Pause.
            </p>
          </div>
        </div>

        {/* Rodapé de Ação */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1c1c24]">
          <div className="text-[11px] text-[#787989]">
            {isPauseActive
              ? "Se você encerrar o modo Mestre ou desconectar, o Pause é liberado automaticamente."
              : "Apenas jogadores conectados a esta mesa serão pausados."}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={isSaving || lockedByAnotherMaster}
              data-testid="master-pause-activate-btn"
              className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#b52a30] to-[#7a1015] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-[#ff8085]/40 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-all"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Pause size={14} />
              )}
              <span>
                {isSaving
                  ? "Sincronizando..."
                  : isPauseActive
                    ? "Atualizar Pause"
                    : "Ativar Pause"}
              </span>
            </button>
          </div>
        </div>
      </form>

      <AnimatePresence initial={false}>
        {(feedback || syncError) && (
          <motion.div
            key={feedback?.text || syncError}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: CLINICAL_EASE }}
            role="status"
            className={`px-3 py-2.5 text-xs border flex items-center gap-2 ${
              feedback?.type === "error" || (!feedback && syncError)
                ? "bg-red-950/45 border-red-700/60 text-red-300"
                : "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
            }`}
          >
            {feedback?.type === "error" || (!feedback && syncError) ? (
              <AlertTriangle size={14} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            )}
            <span>{feedback?.text || syncError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
