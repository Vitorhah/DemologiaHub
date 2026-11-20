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
import { StatusEffect } from "../utils/statusEffects";
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
  onRollInitiative?: () => void;
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
}: MasterPlayersViewProps) {
  const [expandedStatusId, setExpandedStatusId] = React.useState<string | null>(null);
  const [expandedPdiId, setExpandedPdiId] = React.useState<string | null>(null);
  const [pdiEditorTarget, setPdiEditorTarget] = React.useState<{
    player: any;
    initialPdi: PdiItem | null;
  } | null>(null);
  const isRlGlobal = currentGlobalMode === "rl";

  const renderFloatingInitiativeButton = () => {
    if (!onRollInitiative || typeof document === "undefined") return null;
    return createPortal(
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate(15);
            } catch {}
          }
          onRollInitiative();
        }}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
        className={`fixed right-5 sm:right-7 z-[90] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-90 hover:scale-105 touch-manipulation select-none ${
          isRlGlobal
            ? "bg-gradient-to-br from-[#9333ea] to-[#581c87] hover:from-[#a855f7] hover:to-[#6b21a8] text-white border border-purple-300/60 shadow-[0_8px_28px_rgba(147,51,234,0.65)]"
            : "bg-gradient-to-br from-[#b52a30] to-[#641015] hover:from-[#d13239] hover:to-[#7a1319] text-white border border-[#ff8085]/50 shadow-[0_8px_28px_rgba(181,42,48,0.65)]"
        }`}
        title="Rolar Iniciativa de Todos (1d20 + AGL)"
        aria-label="Rolar Iniciativa de Todos"
      >
        <Dices size={24} className="transition-transform duration-200 active:rotate-45" />
      </button>,
      document.body
    );
  };
  const syncedExtrasAsPlayers = extraFichas
    .filter((f) => f.synchronized)
    .map((f) => ({
      id: `EXTRA_FICHA_${f.id}`,
      name: f.name || "Ficha Extra",
      hp: f.hp || { current: 0, max: 100 },
      pe: f.pe || { current: 0, max: 100 },
      sm: f.sm || f.san || { current: 100, max: 100 },
      ep: normalizeEpValue(f.ep, 0),
      lv: normalizeLevel(f.lv, f.variables, normalizeCharacterProfile(f.profile)),
      profile: normalizeCharacterProfile(f.profile),
      variables: f.variables || {},
      statusEffects: f.statusEffects || [],
      ultimoSuspiro: normalizeUltimoSuspiroState(f.ultimoSuspiro, f.hp?.current ?? 0),
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
        {renderFloatingInitiativeButton()}
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
                const ultimoSuspiro = normalizeUltimoSuspiroState(p.ultimoSuspiro, hpCurrent);
                const isDead = ultimoSuspiro.status === "dead";

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
        {renderFloatingInitiativeButton()}
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
        const ultimoSuspiro = normalizeUltimoSuspiroState(p.ultimoSuspiro, hpCurrent);
        const isDead = ultimoSuspiro.status === "dead";

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
