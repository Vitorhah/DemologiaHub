import React from "react";
import {
  Users,
  Trash2,
  Maximize2,
  Heart,
  Zap,
} from "lucide-react";

export interface MasterPlayersViewProps {
  players: any[];
  extraFichas: any[];
  initiatives: Record<string, number>;
  onKickPlayer: (player: any) => void;
  onOpenInteractiveSheet: (sheetId: string) => void;
  onUpdateStat: (
    player: any,
    stat: "hp" | "pe",
    val: number,
    isExtraSheet?: boolean,
    rawExtraSheetId?: string,
  ) => void;
  viewMode?: "grid" | "list";
}

export function MasterPlayersView({
  players,
  extraFichas,
  initiatives,
  onKickPlayer,
  onOpenInteractiveSheet,
  onUpdateStat,
  viewMode = "grid",
}: MasterPlayersViewProps) {
  const syncedExtrasAsPlayers = extraFichas
    .filter((f) => f.synchronized)
    .map((f) => ({
      id: `EXTRA_FICHA_${f.id}`,
      name: f.name || "Ficha Extra",
      hp: f.hp || { current: 0, max: 100 },
      pe: f.pe || { current: 0, max: 100 },
      variables: f.variables || {},
      history: f.history || (f.notes ? [`<span style="color: #888;">${f.notes}</span>`] : []),
      isExtraSheet: true,
      rawExtraSheetId: f.id,
    }));

  const combined = [...players, ...syncedExtrasAsPlayers].sort(
    (a, b) => (initiatives[b.id] ?? -1) - (initiatives[a.id] ?? -1),
  );

  if (combined.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-10 text-center flex flex-col items-center justify-center border border-[#272935] bg-[#14151c] rounded-none font-sans">
        <Users size={36} className="text-[#626475] mb-3" />
        <h3 className="text-sm font-semibold text-white">
          Nenhum participante conectado
        </h3>
        <p className="text-xs text-[#8f909d] max-w-sm mt-1 leading-relaxed">
          Os jogadores conectados ou fichas extras sincronizadas aparecerão aqui.
        </p>
      </div>
    );
  }

  // MODO LISTA
  if (viewMode === "list") {
    return (
      <div className="max-w-6xl mx-auto px-4 font-mono">
        <div className="bg-[#0a0a0a] border border-[var(--op-border)] rounded-none overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--op-border)] bg-[#111] text-[10px] uppercase font-bold tracking-wider text-gray-500">
                <th className="py-3 px-4 w-16 text-center">Inic.</th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4 w-48">Vida (HP)</th>
                <th className="py-3 px-4 w-48">Esforço (PE)</th>
                <th className="py-3 px-4">Última ação</th>
                <th className="py-3 px-4 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c1c] text-xs">
              {combined.map((p) => {
                const initVal = initiatives[p.id];
                const hpCurrent = p.hp?.current ?? 0;
                const hpMax = p.hp?.max ?? 100;
                const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

                const peCurrent = p.pe?.current ?? 0;
                const peMax = p.pe?.max ?? 100;
                const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-center">
                      {initVal !== undefined ? (
                        <span className="inline-block px-2 py-0.5 bg-[#1f212c] text-white font-semibold rounded-none text-xs">
                          {initVal}
                        </span>
                      ) : (
                        <span className="text-[#555663]">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white truncate max-w-[180px]">
                        {p.name}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {p.isExtraSheet ? (
                          <span className="text-blue-400 font-medium">NPC</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">Jogador</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-[11px] text-[#9a9ba8] mb-1">
                        <span className="text-red-400 font-medium">HP</span>
                        <span>{hpCurrent} / {hpMax}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1b1c24] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full transition-all duration-200"
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          defaultValue={hpCurrent}
                          key={`hp-${p.id}-${hpCurrent}`}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId);
                          }}
                          className="w-16 bg-[#1a1c24] border border-[#2b2d3b] focus:border-red-500 rounded-none px-1.5 py-0.5 text-white text-xs outline-none text-center"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-[11px] text-[#9a9ba8] mb-1">
                        <span className="text-blue-400 font-medium">PE</span>
                        <span>{peCurrent} / {peMax}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1b1c24] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-200"
                          style={{ width: `${pePct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          defaultValue={peCurrent}
                          key={`pe-${p.id}-${peCurrent}`}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId);
                          }}
                          className="w-16 bg-[#1a1c24] border border-[#2b2d3b] focus:border-blue-500 rounded-none px-1.5 py-0.5 text-white text-xs outline-none text-center"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[220px]">
                      {p.history && p.history.length > 0 ? (
                        <div
                          className="text-xs text-[#9c9da9] truncate"
                          dangerouslySetInnerHTML={{ __html: p.history[0] }}
                        />
                      ) : (
                        <span className="text-[#555663] italic">Nenhuma ação recente</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {p.isExtraSheet ? (
                        <button
                          type="button"
                          onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 text-blue-300 text-xs font-medium rounded-none transition-colors cursor-pointer"
                        >
                          <Maximize2 size={12} />
                          <span>Abrir</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onKickPlayer(p)}
                          className="p-1.5 text-[#737482] hover:text-red-400 hover:bg-red-950/30 rounded-none transition-colors cursor-pointer"
                          title="Remover jogador"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // MODO GRADE
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto px-4 font-mono">
      {combined.map((p) => {
        const initVal = initiatives[p.id];
        const hpCurrent = p.hp?.current ?? 0;
        const hpMax = p.hp?.max ?? 100;
        const hpPct = Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) || 0;

        const peCurrent = p.pe?.current ?? 0;
        const peMax = p.pe?.max ?? 100;
        const pePct = Math.max(0, Math.min(100, (peCurrent / peMax) * 100)) || 0;

        return (
          <div
            key={p.id}
            className="bg-[#0a0a0a] border border-[var(--op-border)] rounded-none p-4 flex flex-col justify-between hover:border-gray-500 transition-all"
          >
            <div>
              {/* Header do Card */}
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-white font-bold text-sm truncate uppercase tracking-wider">
                    {p.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {p.isExtraSheet ? (
                      <span className="text-[10px] text-blue-500 font-bold uppercase">NPC</span>
                    ) : (
                      <span className="text-[10px] text-green-500 font-bold uppercase">Player</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {initVal !== undefined && (
                    <div className="px-2 py-0.5 bg-[#111] border border-[var(--op-border)] rounded-none text-center">
                      <span className="text-[9px] text-gray-500 block leading-tight uppercase font-bold">Inic</span>
                      <span className="text-xs font-bold text-white block leading-tight">{initVal}</span>
                    </div>
                  )}

                  {p.isExtraSheet ? (
                    <button
                      type="button"
                      onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                      className="p-1.5 text-blue-400 hover:text-white bg-[#0a1525] hover:bg-[#0a2040] border border-blue-900/40 rounded-none transition-colors cursor-pointer"
                      title="Abrir ficha"
                    >
                      <Maximize2 size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onKickPlayer(p)}
                      className="p-1.5 text-gray-600 hover:text-white hover:bg-[var(--op-red)] rounded-none transition-colors cursor-pointer"
                      title="Remover jogador"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status HP e PE */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {/* HP */}
                <div className="bg-[#111] border border-[#222] rounded-none p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">
                    <span className="text-[var(--op-red-bright)] flex items-center gap-1">
                      <Heart size={10} /> HP
                    </span>
                    <span>{hpCurrent}/{hpMax}</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-none overflow-hidden border border-[#333] mb-2">
                    <div
                      className="h-full bg-[var(--op-red)] rounded-none transition-all duration-200"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Ajustar:</span>
                    <input
                      type="number"
                      defaultValue={hpCurrent}
                      key={`card-hp-${p.id}-${hpCurrent}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        onUpdateStat(p, "hp", val, p.isExtraSheet, p.rawExtraSheetId);
                      }}
                      className="w-14 bg-black border border-[var(--op-border)] focus:border-[var(--op-red)] text-white text-xs text-center py-0.5 rounded-none outline-none"
                    />
                  </div>
                </div>

                {/* PE */}
                <div className="bg-[#111] border border-[#222] rounded-none p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">
                    <span className="text-yellow-500 flex items-center gap-1">
                      <Zap size={10} /> PE
                    </span>
                    <span>{peCurrent}/{peMax}</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-none overflow-hidden border border-[#333] mb-2">
                    <div
                      className="h-full bg-yellow-500 rounded-none transition-all duration-200"
                      style={{ width: `${pePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Ajustar:</span>
                    <input
                      type="number"
                      defaultValue={peCurrent}
                      key={`card-pe-${p.id}-${peCurrent}`}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        onUpdateStat(p, "pe", val, p.isExtraSheet, p.rawExtraSheetId);
                      }}
                      className="w-14 bg-black border border-[var(--op-border)] focus:border-yellow-500 text-white text-xs text-center py-0.5 rounded-none outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Última Ação */}
              {p.history && p.history.length > 0 && (
                <div className="pt-2.5 border-t border-[#222430]">
                  <div className="text-[10px] text-[#737482] mb-0.5">
                    Última ação:
                  </div>
                  <div
                    className="text-xs text-[#9d9ea9] line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: p.history[0] }}
                  />
                </div>
              )}
            </div>

            {p.isExtraSheet && (
              <button
                type="button"
                onClick={() => onOpenInteractiveSheet(p.rawExtraSheetId)}
                className="w-full mt-3 py-1.5 bg-blue-950/30 hover:bg-blue-900/50 border border-blue-800/40 text-blue-300 rounded-none text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Maximize2 size={12} /> Abrir Ficha
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
