import React, { useState, useMemo } from "react";
import { Send, Check, Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import {
  DIFFICULTY_PRESETS,
  MINIGAME_META,
  MinigameConfig,
  MinigameDifficulty,
  MinigameResultPayload,
  MinigameType,
} from "../../types/minigames";
import { applyDifficultyPreset, clampNumber } from "../../utils/minigamesLogic";

interface PlayerOption {
  id: string;
  name?: string;
}

interface MasterMinigamesPanelProps {
  players: PlayerOption[];
  recentResults: MinigameResultPayload[];
  isSending: boolean;
  onSendMinigame: (
    config: MinigameConfig,
    targetPlayerIds: string[]
  ) => Promise<{ ok: boolean; error?: string }>;
  onClearResults: () => void;
}

function MinigameGeometricIcon({ type, active }: { type: MinigameType; active: boolean }) {
  const stroke = active ? "#22c55e" : "#a1a1aa";
  switch (type) {
    case "timing":
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
          <circle cx="16" cy="16" r="11" stroke="#3f3f46" strokeWidth="2.5" />
          <path d="M 16 5 A 11 11 0 0 1 25 10" stroke="#22c55e" strokeWidth="3" />
          <line x1="16" y1="16" x2="22" y2="9" stroke={stroke} strokeWidth="2" />
          <rect x="14.5" y="14.5" width="3" height="3" fill="#dc2626" />
        </svg>
      );
    case "lockpick":
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
          <rect x="5" y="6" width="5" height="20" stroke="#3f3f46" strokeWidth="1.5" />
          <rect x="13.5" y="6" width="5" height="20" stroke="#3f3f46" strokeWidth="1.5" />
          <rect x="22" y="6" width="5" height="20" stroke="#3f3f46" strokeWidth="1.5" />
          <rect x="6" y="13" width="3" height="12" fill="#22c55e" />
          <rect x="14.5" y="17" width="3" height="8" fill={stroke} />
          <rect x="23" y="15" width="3" height="10" fill="#dc2626" />
        </svg>
      );
    case "emf":
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
          <path d="M 5 22 A 12 12 0 0 1 27 22" stroke="#3f3f46" strokeWidth="3" />
          <path d="M 11 11 A 12 12 0 0 1 21 11" stroke="#22c55e" strokeWidth="3" />
          <line x1="16" y1="23" x2="18" y2="10" stroke={stroke} strokeWidth="2" />
          <rect x="14" y="21" width="4" height="4" fill="#dc2626" />
        </svg>
      );
    case "aim":
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
          <circle cx="16" cy="16" r="10" stroke="#3f3f46" strokeWidth="1.5" />
          <polygon points="16,9 23,16 16,23 9,16" stroke="#22c55e" strokeWidth="1.8" />
          <line x1="4" y1="16" x2="11" y2="16" stroke={stroke} strokeWidth="1.5" />
          <line x1="21" y1="16" x2="28" y2="16" stroke={stroke} strokeWidth="1.5" />
          <line x1="16" y1="4" x2="16" y2="11" stroke={stroke} strokeWidth="1.5" />
          <line x1="16" y1="21" x2="16" y2="28" stroke={stroke} strokeWidth="1.5" />
          <rect x="14.5" y="14.5" width="3" height="3" fill="#dc2626" />
        </svg>
      );
  }
}

export const MasterMinigamesPanel: React.FC<MasterMinigamesPanelProps> = ({
  players,
  recentResults,
  isSending,
  onSendMinigame,
  onClearResults,
}) => {
  const [config, setConfig] = useState<MinigameConfig>(() =>
    applyDifficultyPreset("timing", "normal")
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const validPlayerIdsSet = useMemo(
    () => new Set(players.map((p) => p.id)),
    [players]
  );

  const effectiveSelected = useMemo(
    () => selectedIds.filter((id) => validPlayerIdsSet.has(id)),
    [selectedIds, validPlayerIdsSet]
  );

  const handleSelectType = (type: MinigameType) => {
    setConfig((prev) => ({ ...prev, type }));
    setFeedback(null);
  };

  const handleSelectDifficulty = (
    diff: Exclude<MinigameDifficulty, "custom">
  ) => {
    setConfig((prev) => applyDifficultyPreset(prev.type, diff));
    setFeedback(null);
  };

  const updateParam = (field: "rounds" | "speed" | "maxErrors", nextVal: number) => {
    setConfig((prev) => ({
      ...prev,
      difficulty: "custom",
      rounds: field === "rounds" ? clampNumber(nextVal, 1, 12) : prev.rounds,
      speed: field === "speed" ? clampNumber(nextVal, 1, 10) : prev.speed,
      maxErrors: field === "maxErrors" ? clampNumber(nextVal, 1, 10) : prev.maxErrors,
    }));
  };

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setFeedback(null);
  };

  const handleSend = async () => {
    setFeedback(null);
    const res = await onSendMinigame(config, effectiveSelected);
    if (!res.ok) {
      setFeedback({
        type: "error",
        text: res.error || "Não foi possível enviar o minigame.",
      });
    } else {
      const names = players
        .filter((p) => effectiveSelected.includes(p.id))
        .map((p) => p.name || p.id.slice(0, 6))
        .join(", ");
      setFeedback({
        type: "success",
        text: `Minigame "${MINIGAME_META[config.type].label}" enviado para: ${names}.`,
      });
    }
  };

  const minigameTypes: MinigameType[] = ["timing", "lockpick", "emf", "aim"];
  const presetKeys: Exclude<MinigameDifficulty, "custom">[] = [
    "facil",
    "normal",
    "dificil",
    "pesadelo",
  ];

  return (
    <section
      aria-label="Minigames para Players"
      className="bg-[#0c0c10] border border-[#202028] rounded-none p-4 sm:p-5 flex flex-col gap-5 font-mono"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1c24] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Minigames
          </h3>
          <p className="text-xs text-[#8c8d9c] mt-0.5">
            Envie desafios táticos interativos diretamente para a tela de um ou mais players.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 border border-[#2c2c38] bg-[#121218] text-[#a1a1aa]">
          {config.difficulty === "custom"
            ? "Personalizado"
            : DIFFICULTY_PRESETS[config.difficulty].label}
        </span>
      </div>

      {/* 1. Escolher Minigame */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[#9ca3af] mb-2 font-bold">
          1. Escolher Minigame
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {minigameTypes.map((type) => {
            const meta = MINIGAME_META[type];
            const isSelected = config.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                aria-pressed={isSelected}
                className={`p-3 border rounded-none text-left flex items-start gap-3 cursor-pointer touch-manipulation transition-colors ${
                  isSelected
                    ? "bg-[#111914] border-[#22c55e] text-white"
                    : "bg-[#101015] border-[#24242d] hover:border-[#3e3e4a] text-[#d4d4d8]"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  <MinigameGeometricIcon type={type} active={isSelected} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {meta.label}
                  </div>
                  <div className="text-[11px] text-[#8c8d9c] mt-0.5 leading-snug">
                    {meta.shortDesc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Dificuldade + Parâmetros */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold">
            2. Dificuldade (Opcional)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {presetKeys.map((key) => {
              const preset = DIFFICULTY_PRESETS[key];
              const active = config.difficulty === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectDifficulty(key)}
                  aria-pressed={active}
                  className={`min-h-[44px] px-3 py-2 border text-left rounded-none cursor-pointer touch-manipulation transition-colors ${
                    active
                      ? key === "pesadelo"
                        ? "bg-[#220a0d] border-[#ef4444] text-white"
                        : "bg-[#131b16] border-[#22c55e] text-white"
                      : "bg-[#101015] border-[#24242d] hover:border-[#3c3c48] text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {preset.label}
                  </div>
                  <div className="text-[10px] text-[#787989] tabular-nums mt-0.5">
                    {preset.rounds} pts · Vel {preset.speed} · {preset.maxErrors} err
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold">
            3. Parâmetros da Rodada
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Quantidade de rodadas / pontos */}
            <div className="bg-[#09090d] border border-[#22222b] p-3 flex flex-col justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                Rodadas / Pontos
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => updateParam("rounds", config.rounds - 1)}
                  disabled={config.rounds <= 1}
                  aria-label="Diminuir rodadas"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  -
                </button>
                <span className="text-base font-bold text-white tabular-nums">
                  {config.rounds}
                </span>
                <button
                  type="button"
                  onClick={() => updateParam("rounds", config.rounds + 1)}
                  disabled={config.rounds >= 12}
                  aria-label="Aumentar rodadas"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  +
                </button>
              </div>
            </div>

            {/* Velocidade */}
            <div className="bg-[#09090d] border border-[#22222b] p-3 flex flex-col justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                Velocidade (1–10)
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => updateParam("speed", config.speed - 1)}
                  disabled={config.speed <= 1}
                  aria-label="Diminuir velocidade"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  -
                </button>
                <span className="text-base font-bold text-white tabular-nums">
                  {config.speed}
                </span>
                <button
                  type="button"
                  onClick={() => updateParam("speed", config.speed + 1)}
                  disabled={config.speed >= 10}
                  aria-label="Aumentar velocidade"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  +
                </button>
              </div>
            </div>

            {/* Número de chances */}
            <div className="bg-[#09090d] border border-[#22222b] p-3 flex flex-col justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-[#8e90a0]">
                Chances (Erros)
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => updateParam("maxErrors", config.maxErrors - 1)}
                  disabled={config.maxErrors <= 1}
                  aria-label="Diminuir chances"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  -
                </button>
                <span className="text-base font-bold text-white tabular-nums">
                  {config.maxErrors}
                </span>
                <button
                  type="button"
                  onClick={() => updateParam("maxErrors", config.maxErrors + 1)}
                  disabled={config.maxErrors >= 10}
                  aria-label="Aumentar chances"
                  className="w-10 h-10 bg-[#15151c] hover:bg-[#20202a] disabled:opacity-40 border border-[#2c2c38] text-white font-bold cursor-pointer touch-manipulation"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Selecionar Players de Destino */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-bold">
            4. Players Destinatários ({effectiveSelected.length} selecionado
            {effectiveSelected.length === 1 ? "" : "s"})
          </span>
          {players.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(players.map((p) => p.id))}
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
            Nenhum player conectado na mesa no momento. Peça para os jogadores conectarem na aba Conexão.
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
                    data-player-id={p.id}
                    onClick={() => togglePlayer(p.id)}
                    aria-pressed={checked}
                    className={`min-h-[44px] px-3.5 py-2 border text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer touch-manipulation transition-colors ${
                      checked
                        ? "bg-[#111b14] border-[#22c55e] text-white font-bold"
                        : "bg-[#101016] border-[#262632] hover:border-[#3c3c4a] text-[#a1a1aa]"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 border flex items-center justify-center ${
                        checked
                          ? "border-[#22c55e] bg-[#22c55e]/20 text-[#22c55e]"
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

      {/* Send Action + Feedback */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1c1c24]">
        <div className="text-[11px] text-[#787989]">
          O minigame bloqueará a ficha do player até concluir ou esgotar as chances.
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || effectiveSelected.length === 0}
          className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-[#8f171c] to-[#5c0e12] hover:from-[#b52a30] hover:to-[#7a1319] disabled:opacity-50 disabled:cursor-not-allowed border border-[#ff8085]/35 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-all shrink-0"
        >
          {isSending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          <span>{isSending ? "Enviando..." : "Enviar Minigame"}</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-3 py-2.5 text-xs border flex items-center gap-2 ${
            feedback.type === "error"
              ? "bg-red-950/45 border-red-700/60 text-red-300"
              : "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertTriangle size={14} className="shrink-0 text-red-400" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Recent Results Feed */}
      {recentResults.length > 0 && (
        <div className="pt-3 border-t border-[#1c1c24] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-[#8c8d9c] font-bold">
              Resultados Recentes
            </span>
            <button
              type="button"
              onClick={onClearResults}
              className="text-[10px] uppercase tracking-wider text-[#787989] hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={11} />
              <span>Limpar</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentResults.slice(0, 6).map((res) => (
              <div
                key={res.id}
                className={`px-3 py-2 border text-xs flex items-center justify-between gap-2 ${
                  res.success
                    ? "bg-[#0a140d] border-[#22c55e]/45 text-white"
                    : "bg-[#160a0a] border-[#dc2626]/45 text-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{res.playerName}</div>
                  <div className="text-[10px] text-[#9ca3af] uppercase">
                    {MINIGAME_META[res.minigameType]?.label || res.minigameType}
                  </div>
                </div>
                <div
                  className={`font-bold tabular-nums shrink-0 ${
                    res.success ? "text-[#22c55e]" : "text-[#ef4444]"
                  }`}
                >
                  {res.hits}/{res.totalRounds} acertos
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
