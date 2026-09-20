import React from "react";
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
} from "lucide-react";
import { GameMode } from "../types";

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
  viewMode?: "grid" | "list";
  onClearChatHistory?: () => void;
  playerModes?: Record<string, GameMode>;
  currentGlobalMode?: GameMode;
  onTogglePlayerMode?: (playerId: string) => void;
}

export function MasterPlayersView({
  players,
  extraFichas,
  initiatives,
  onKickPlayer,
  onOpenInteractiveSheet,
  onUpdateStat,
  viewMode = "grid",
  onClearChatHistory,
  playerModes = {},
  currentGlobalMode = "demologia",
  onTogglePlayerMode,
}: MasterPlayersViewProps) {
  const syncedExtrasAsPlayers = extraFichas
    .filter((f) => f.synchronized)
    .map((f) => ({
      id: `EXTRA_FICHA_${f.id}`,
      name: f.name || "Ficha Extra",
      hp: f.hp || { current: 0, max: 100 },
      pe: f.pe || { current: 0, max: 100 },
      sm: f.sm || f.san || { current: 100, max: 100 },
      variables: f.variables || {},
      history: f.history || (f.notes ? [`<span style="color: #888;">${f.notes}</span>`] : []),
      isExtraSheet: true,
      rawExtraSheetId: f.id,
    }));

  const combined = [...players, ...syncedExtrasAsPlayers].sort(
    (a, b) => (initiatives[b.id] ?? -1) - (initiatives[a.id] ?? -1),
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
      </div>
    );
  }

  // MODO LISTA
  if (viewMode === "list") {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 font-mono my-4">
        <div className="bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] rounded-none overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#202028] bg-[#101015] text-[11px] uppercase font-bold tracking-wider text-[#828392]">
                <th className="py-3 px-3 sm:px-4 w-16 text-center">Inic</th>
                <th className="py-3 px-3 sm:px-4">Nome</th>
                <th className="py-3 px-3 sm:px-4 w-44">HP</th>
                <th className="py-3 px-3 sm:px-4 w-44">
                  {currentGlobalMode === "rl" ? "SN" : "PE"}
                </th>
                <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Ação recente</th>
                <th className="py-3 px-3 sm:px-4 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181820] text-xs">
              {combined.map((p) => {
                const initVal = initiatives[p.id];
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

                return (
                  <tr key={p.id} className="hover:bg-[#121217] transition-colors">
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
                      <div className="font-bold text-white truncate max-w-[180px] uppercase">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.isExtraSheet ? (
                          <span className="text-[#60a5fa] text-[10px]">NPC</span>
                        ) : (
                          <span className="text-[#4ade80] text-[10px]">Jogador</span>
                        )}
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
                    </td>

                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1">
                        <span className="text-[#ef4444] font-bold">HP</span>
                        <span>{hpCurrent}/{hpMax}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#181820] border border-[#242430] overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-[#8f171c] transition-all duration-200"
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => handleStepStat(p, "hp", -1)}
                          className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                          title="Diminuir HP"
                        >
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          defaultValue={hpCurrent}
                          key={`hp-${p.id}-${hpCurrent}`}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId);
                          }}
                          className="w-12 h-6 bg-[#0c0c10] border-y border-[#202028] text-center text-xs text-white font-bold outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepStat(p, "hp", 1)}
                          className="w-6 h-6 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer text-xs font-bold"
                          title="Aumentar HP"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
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
                          <input
                            type="number"
                            defaultValue={smCurrent}
                            key={`sm-${p.id}-${smCurrent}`}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              onUpdateStat(p, "sm", val, p.isExtraSheet, p.rawExtraSheetId);
                            }}
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
                          <input
                            type="number"
                            defaultValue={peCurrent}
                            key={`pe-${p.id}-${peCurrent}`}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId);
                            }}
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

                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell max-w-[200px]">
                      {p.history && p.history.length > 0 ? (
                        <div
                          className="text-xs text-[#9d9ea9] truncate"
                          dangerouslySetInnerHTML={{ __html: p.history[0] }}
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

        {onClearChatHistory && (
          <div className="mt-6 p-3.5 bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2.5">
              <MessageSquare size={16} className="text-[var(--op-red-bright)] shrink-0" />
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Chat da Mesa Coletivo
                </div>
                <div className="text-[11px] text-[#828392]">
                  Histórico sincronizado em tempo real entre jogadores e mestre.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearChatHistory}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#121218] hover:bg-red-950/50 text-[#9ca3af] hover:text-red-400 border border-[#262632] hover:border-red-900/60 outline outline-1 outline-[#181820] text-xs uppercase tracking-wider transition-all cursor-pointer"
              title="Apagar mensagens do chat da mesa"
            >
              <Trash2 size={13} className="text-red-500" />
              <span>Limpar Histórico do Chat</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // MODO GRADE
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 font-mono my-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {combined.map((p) => {
        const initVal = initiatives[p.id];
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

        return (
          <div
            key={p.id}
            className="bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] hover:outline-[#3c3c4a] rounded-none p-3.5 sm:p-4 flex flex-col justify-between transition-all"
          >
            <div>
              {/* Header do Card */}
              <div className="flex justify-between items-center mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-white font-bold text-sm truncate uppercase tracking-wider">
                      {p.name}
                    </h4>
                    {p.isExtraSheet ? (
                      <span className="text-[10px] text-[#60a5fa] font-bold uppercase shrink-0">
                        NPC
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#4ade80] font-bold uppercase shrink-0">
                        Jogador
                      </span>
                    )}

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
                <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2">
                  <div className="flex items-center justify-between text-[10px] text-[#9ca3af] mb-1 font-bold uppercase tracking-wider">
                    <span className="text-[#ef4444] flex items-center gap-1">
                      <Heart size={10} /> HP
                    </span>
                    <span>{hpCurrent}/{hpMax}</span>
                  </div>
                  <div className="h-1.5 bg-[#181820] border border-[#242430] overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#8f171c] transition-all duration-200"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleStepStat(p, "hp", -1)}
                      className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                      title="Diminuir 1 HP"
                    >
                      <Minus size={10} />
                    </button>
                    <input
                      type="number"
                      defaultValue={hpCurrent}
                      key={`card-hp-${p.id}-${hpCurrent}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId);
                      }}
                      className="w-10 h-6 bg-[#0c0c10] border-y border-[#202028] text-white text-xs font-bold text-center py-0.5 rounded-none outline-none focus:border-[var(--op-red)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepStat(p, "hp", 1)}
                      className="w-6 h-6 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all"
                      title="Aumentar 1 HP"
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
                      <input
                        type="number"
                        defaultValue={smCurrent}
                        key={`card-sm-${p.id}-${smCurrent}`}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onUpdateStat(p, "sm", val, p.isExtraSheet, p.rawExtraSheetId);
                        }}
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
                      <input
                        type="number"
                        defaultValue={peCurrent}
                        key={`card-pe-${p.id}-${peCurrent}`}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId);
                        }}
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

              {/* Última Ação */}
              {p.history && p.history.length > 0 && (
                <div className="pt-2 border-t border-[#1a1a24]">
                  <div
                    className="text-xs text-[#828392] line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: p.history[0] }}
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

      {onClearChatHistory && (
        <div className="mt-8 p-3.5 bg-[#0c0c10] border border-[#202028] outline outline-1 outline-[#181820] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={16} className="text-[var(--op-red-bright)] shrink-0" />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                Chat da Mesa Coletivo
              </div>
              <div className="text-[11px] text-[#828392]">
                Histórico sincronizado em tempo real entre jogadores e mestre.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearChatHistory}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#121218] hover:bg-red-950/50 text-[#9ca3af] hover:text-red-400 border border-[#262632] hover:border-red-900/60 outline outline-1 outline-[#181820] text-xs uppercase tracking-wider transition-all cursor-pointer"
            title="Apagar mensagens do chat da mesa"
          >
            <Trash2 size={13} className="text-red-500" />
            <span>Limpar Histórico do Chat</span>
          </button>
        </div>
      )}
    </div>
  );
}
