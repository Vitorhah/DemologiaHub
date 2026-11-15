import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { X, Send, Check, Loader2, AlertTriangle, Sparkles, BookOpen, SlidersHorizontal } from "lucide-react";
import {
  DefaultSixStatuses,
  DefaultStatusKey,
  MasterDataPushPayload,
  MasterPushSkillInput,
  MasterPushTributoInput,
} from "../types/masterDataPush";
import { DEFAULT_STATUS_KEYS } from "../utils/statusVariables";
import {
  computeDemologiaMaxStats,
  createEmptySkillDraft,
  createEmptyTributoDraft,
  extractDefaultSixStatuses,
  sanitizeSixStatuses,
  sanitizeSkillInput,
  sanitizeTributoInput,
} from "../utils/masterDataPush";
import { MotionModalBackdrop, MotionSheetPanel } from "./MotionPrimitives";

interface PlayerTargetOption {
  id: string;
  name?: string;
  variables?: Record<string, any>;
  tributo?: Partial<MasterPushTributoInput>;
}

interface MasterSendDataModalProps {
  isOpen: boolean;
  players: PlayerTargetOption[];
  isSending: boolean;
  onClose: () => void;
  onSubmit: (
    targetPlayerIds: string[],
    payload: MasterDataPushPayload
  ) => Promise<{ ok: boolean; updatedCount: number; error?: string }>;
  onSuccessFeedback?: (message: string) => void;
}

export const MasterSendDataModal: React.FC<MasterSendDataModalProps> = ({
  isOpen,
  players,
  isSending,
  onClose,
  onSubmit,
  onSuccessFeedback,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [includeStatuses, setIncludeStatuses] = useState(false);
  const [statuses, setStatuses] = useState<DefaultSixStatuses>(() =>
    extractDefaultSixStatuses(null)
  );

  const [includeSkill, setIncludeSkill] = useState(false);
  const [skillDraft, setSkillDraft] = useState<MasterPushSkillInput>(
    createEmptySkillDraft
  );

  const [includeTributo, setIncludeTributo] = useState(false);
  const [tributoDraft, setTributoDraft] = useState<MasterPushTributoInput>(
    createEmptyTributoDraft
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form state cleanly every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds([]);
    setIncludeStatuses(false);
    setStatuses(extractDefaultSixStatuses(null));
    setIncludeSkill(false);
    setSkillDraft(createEmptySkillDraft());
    setIncludeTributo(false);
    setTributoDraft(createEmptyTributoDraft());
    setErrorMsg(null);
  }, [isOpen]);

  // Close with Escape when not submitting
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isSending, onClose]);

  const validPlayerIdsSet = useMemo(
    () => new Set(players.map((p) => p.id)),
    [players]
  );

  const effectiveSelected = useMemo(
    () => selectedIds.filter((id) => validPlayerIdsSet.has(id)),
    [selectedIds, validPlayerIdsSet]
  );

  const previewMax = useMemo(
    () => computeDemologiaMaxStats(statuses),
    [statuses]
  );

  const togglePlayer = (player: PlayerTargetOption) => {
    setErrorMsg(null);
    setSelectedIds((prev) => {
      const exists = prev.includes(player.id);
      const next = exists
        ? prev.filter((id) => id !== player.id)
        : [...prev, player.id];

      // When selecting the first player and statuses haven't been enabled/edited yet,
      // prefill only the 6 default attributes (ignoring any extra variables).
      if (!exists && prev.length === 0 && !includeStatuses) {
        setStatuses(extractDefaultSixStatuses(player.variables));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setErrorMsg(null);
    const allIds = players.map((p) => p.id);
    setSelectedIds(allIds);
    if (players.length > 0 && !includeStatuses) {
      setStatuses(extractDefaultSixStatuses(players[0].variables));
    }
  };

  const handleStatusChange = (key: DefaultStatusKey, rawVal: number) => {
    const safeVal = Number.isFinite(rawVal) ? Math.max(-99, Math.min(999, Math.round(rawVal))) : 0;
    setIncludeStatuses(true);
    setErrorMsg(null);
    setStatuses((prev) => ({ ...prev, [key]: safeVal }));
  };

  const handleSkillChange = <K extends keyof MasterPushSkillInput>(
    field: K,
    value: MasterPushSkillInput[K]
  ) => {
    setIncludeSkill(true);
    setErrorMsg(null);
    setSkillDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleTributoChange = <K extends keyof MasterPushTributoInput>(
    field: K,
    value: MasterPushTributoInput[K]
  ) => {
    setIncludeTributo(true);
    setErrorMsg(null);
    setTributoDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    setErrorMsg(null);

    if (effectiveSelected.length === 0) {
      setErrorMsg("Selecione pelo menos um player destinatário.");
      return;
    }

    if (!includeSkill && !includeTributo && !includeStatuses) {
      setErrorMsg(
        "Selecione ou preencha pelo menos uma seção (Skill, Tributo ou Status Padrões)."
      );
      return;
    }

    if (includeSkill && !skillDraft.name.trim()) {
      setErrorMsg("Informe o nome da Skill antes de enviar.");
      return;
    }

    if (includeTributo && !tributoDraft.name.trim()) {
      setErrorMsg("Informe o nome do Tributo antes de enviar.");
      return;
    }

    const payload: MasterDataPushPayload = {};
    if (includeSkill) payload.skill = sanitizeSkillInput(skillDraft);
    if (includeTributo) payload.tributo = sanitizeTributoInput(tributoDraft);
    if (includeStatuses) payload.statuses = sanitizeSixStatuses(statuses);

    const res = await onSubmit(effectiveSelected, payload);
    if (!res.ok) {
      setErrorMsg(res.error || "Não foi possível enviar os dados.");
      return;
    }

    const names = players
      .filter((p) => effectiveSelected.includes(p.id))
      .map((p) => p.name || p.id.slice(0, 6))
      .join(", ");

    onSuccessFeedback?.(
      `Dados enviados em lote para: ${names}.`
    );
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalBackdrop
          className="fixed inset-0 z-[360] flex items-end sm:items-center justify-center p-0 sm:p-4 font-mono"
          onClick={() => {
            if (!isSending) onClose();
          }}
        >
          <MotionSheetPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-send-data-title"
            data-testid="master-send-data-modal"
            className="w-full sm:max-w-2xl max-h-[88dvh] bg-[#0c0c10] border-t sm:border border-[#282834] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex flex-col min-h-0 overflow-hidden relative"
            style={{
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-[var(--op-red)] shrink-0" />

            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-b border-[#202028] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2
                  id="master-send-data-title"
                  className="text-sm font-bold text-white uppercase tracking-wider truncate"
                >
                  Enviar Dados para Players
                </h2>
                <p className="text-[11px] text-[#8c8d9c] mt-0.5 truncate">
                  Configure tudo abaixo. As alterações só serão aplicadas quando clicar em Enviar.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                aria-label="Fechar formulário Enviar Dados"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white hover:bg-white/[0.05] cursor-pointer touch-manipulation shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form
              id="master-send-data-form"
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {/* Scrollable Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* 1. Players */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#d4d4d8] font-bold">
                    1. Players Destinatários ({effectiveSelected.length})
                  </span>
                  {players.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-[#2c2c38] bg-[#121218] hover:bg-[#1b1b24] text-[#d4d4d8] cursor-pointer"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="px-2.5 py-1 text-[10px] uppercase tracking-wider border border-[#2c2c38] bg-[#121218] hover:bg-[#1b1b24] text-[#9ca3af] cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                {players.length === 0 ? (
                  <div className="border border-dashed border-[#2b2b36] bg-[#09090d] p-4 text-xs text-[#787989] text-center">
                    Nenhum player conectado no momento.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const nameCounts = new Map<string, number>();
                      players.forEach((pl) => {
                        const key = (pl.name || "").trim().toLowerCase();
                        if (key) nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
                      });
                      return players.map((p) => {
                        const checked = effectiveSelected.includes(p.id);
                        const cleanName = (p.name || "").trim();
                        const isDup =
                          cleanName.length > 0 &&
                          (nameCounts.get(cleanName.toLowerCase()) || 0) > 1;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            data-send-player-id={p.id}
                            onClick={() => togglePlayer(p)}
                            aria-pressed={checked}
                            className={`min-h-[44px] px-3 py-2 border text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer touch-manipulation transition-colors ${
                              checked
                                ? "bg-[#1a0b0e] border-[#b52a30] text-white font-bold"
                                : "bg-[#101016] border-[#262632] hover:border-[#3c3c4a] text-[#a1a1aa]"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 border flex items-center justify-center ${
                                checked
                                  ? "border-[#ff8085] bg-[#8f171c]/40 text-white"
                                  : "border-[#3f3f46]"
                              }`}
                            >
                              {checked && <Check size={11} />}
                            </span>
                            <span>{p.name || p.id.slice(0, 8)}</span>
                            {isDup && (
                              <span className="text-[10px] text-[#71717a] font-normal">
                                #{p.id.slice(0, 4)}
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* 2. 6 Default Statuses (never considers extra variables) */}
              <div
                className={`border p-3.5 sm:p-4 space-y-3 transition-colors ${
                  includeStatuses
                    ? "bg-[#100d10] border-[#8f171c]/70"
                    : "bg-[#09090d] border-[#202028]"
                }`}
              >
                <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <SlidersHorizontal size={14} className="text-[var(--op-red-bright)]" />
                    <span>2. Alterar 6 Status Padrões</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeStatuses}
                    onChange={(e) => {
                      setIncludeStatuses(e.target.checked);
                      setErrorMsg(null);
                    }}
                    aria-label="Incluir alteração dos 6 status padrões"
                    className="w-4 h-4 accent-[#b52a30] cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DEFAULT_STATUS_KEYS.map((key) => (
                    <div
                      key={key}
                      className="bg-[#0b0b10] border border-[#22222c] p-2.5 flex flex-col gap-1.5"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--op-red-bright)]">
                        {key}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(key, statuses[key] - 1)}
                          aria-label={`Diminuir ${key}`}
                          className="w-8 h-9 bg-[#15151d] hover:bg-[#22222c] border border-[#2b2b36] text-white font-bold cursor-pointer touch-manipulation shrink-0"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          aria-label={`Status ${key}`}
                          value={statuses[key]}
                          onChange={(e) =>
                            handleStatusChange(key, Number(e.target.value))
                          }
                          className="w-full min-w-0 h-9 bg-[#07070a] border border-[#24242e] text-white text-center text-sm font-bold outline-none focus:border-[var(--op-red-bright)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleStatusChange(key, statuses[key] + 1)}
                          aria-label={`Aumentar ${key}`}
                          className="w-8 h-9 bg-[#15151d] hover:bg-[#22222c] border border-[#2b2b36] text-white font-bold cursor-pointer touch-manipulation shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-[#8c8d9c] flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                  <span>Fórmulas recalculadas automaticamente:</span>
                  <span className="text-[#d4d4d8] tabular-nums">
                    PV Max: {previewMax.hpMax} · PE Max: {previewMax.peMax} · SAN Max: {previewMax.smMax}
                  </span>
                </div>
              </div>

              {/* 3. Enviar Skill */}
              <div
                className={`border p-3.5 sm:p-4 space-y-3 transition-colors ${
                  includeSkill
                    ? "bg-[#100d10] border-[#8f171c]/70"
                    : "bg-[#09090d] border-[#202028]"
                }`}
              >
                <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <Sparkles size={14} className="text-[var(--op-red-bright)]" />
                    <span>3. Mandar Nova Skill</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeSkill}
                    onChange={(e) => {
                      setIncludeSkill(e.target.checked);
                      setErrorMsg(null);
                    }}
                    aria-label="Incluir nova Skill"
                    className="w-4 h-4 accent-[#b52a30] cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Nome da Skill
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Lâmina Carmesim"
                      value={skillDraft.name}
                      onChange={(e) => handleSkillChange("name", e.target.value)}
                      className="w-full min-h-[40px] bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Custo PE
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={skillDraft.cost}
                      onChange={(e) =>
                        handleSkillChange("cost", Number(e.target.value))
                      }
                      className="w-full min-h-[40px] bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                    Descrição da Skill
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Efeito, alcance ou condição da habilidade..."
                    value={skillDraft.desc}
                    onChange={(e) => handleSkillChange("desc", e.target.value)}
                    className="w-full bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Fórmula de Teste (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2d6+OCU"
                      value={skillDraft.test}
                      onChange={(e) => handleSkillChange("test", e.target.value)}
                      className="w-full min-h-[40px] bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Fórmula de Dano (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1d8+FOR"
                      value={skillDraft.damage}
                      onChange={(e) => handleSkillChange("damage", e.target.value)}
                      className="w-full min-h-[40px] bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[#9ca3af] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skillDraft.needsTest}
                    onChange={(e) => handleSkillChange("needsTest", e.target.checked)}
                    className="accent-[#b52a30] cursor-pointer"
                  />
                  <span>Exigir Teste antes do Dano</span>
                </label>
              </div>

              {/* 4. Enviar Tributo */}
              <div
                className={`border p-3.5 sm:p-4 space-y-3 transition-colors ${
                  includeTributo
                    ? "bg-[#100d10] border-[#8f171c]/70"
                    : "bg-[#09090d] border-[#202028]"
                }`}
              >
                <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <BookOpen size={14} className="text-[var(--op-red-bright)]" />
                    <span>4. Mandar / Atualizar Tributo</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeTributo}
                    onChange={(e) => {
                      setIncludeTributo(e.target.checked);
                      setErrorMsg(null);
                    }}
                    aria-label="Incluir Tributo"
                    className="w-4 h-4 accent-[#b52a30] cursor-pointer"
                  />
                </label>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                    Nome do Tributo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pacto da Cinza"
                    value={tributoDraft.name}
                    onChange={(e) => handleTributoChange("name", e.target.value)}
                    className="w-full min-h-[40px] bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                    Descrição
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Resumo do Tributo..."
                    value={tributoDraft.desc}
                    onChange={(e) => handleTributoChange("desc", e.target.value)}
                    className="w-full bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Efeito Passivo
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Efeito passivo..."
                      value={tributoDraft.passivo}
                      onChange={(e) =>
                        handleTributoChange("passivo", e.target.value)
                      }
                      className="w-full bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8e90a0] mb-1">
                      Efeito Ativo
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Efeito ativo..."
                      value={tributoDraft.ativo}
                      onChange={(e) => handleTributoChange("ativo", e.target.value)}
                      className="w-full bg-[#07070a] border border-[#24242e] focus:border-[var(--op-red-bright)] px-3 py-2 text-xs text-white outline-none rounded-none"
                    />
                  </div>
                </div>
              </div>

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
              <div className="px-4 sm:px-5 py-3.5 bg-[#101016] border-t border-[#202028] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="min-h-[44px] px-5 py-2.5 bg-[#14141c] hover:bg-[#1e1e28] border border-[#2c2c38] text-[#9ca3af] hover:text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer touch-manipulation"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-[#8f171c] to-[#5c0e12] hover:from-[#b52a30] hover:to-[#7a1319] disabled:opacity-50 border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
                >
                  {isSending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>
                    {isSending
                      ? "Enviando..."
                      : effectiveSelected.length > 0
                        ? `Enviar Tudo (${effectiveSelected.length})`
                        : "Enviar Tudo"}
                  </span>
                </button>
              </div>
            </form>
          </MotionSheetPanel>
        </MotionModalBackdrop>
      )}
    </AnimatePresence>
  );
};
