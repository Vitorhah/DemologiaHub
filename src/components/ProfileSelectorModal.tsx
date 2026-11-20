import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, AlertTriangle } from "lucide-react";
import {
  CHARACTER_PROFILE_LIST,
  CharacterProfileId,
  getProfileBonusEntries,
  normalizeCharacterProfile,
} from "../utils/profiles";
import {
  getAttributeLimitForLevel,
  getAttributeLimitForStat,
  isAttributeOverLimit,
} from "../utils/levelSystem";
import {
  PROFILE_THEME_MAP,
  ProfileSymbolIcon,
} from "./CharacterProfileButton";

export interface ProfileSelectorModalProps {
  isOpen: boolean;
  currentProfile: CharacterProfileId;
  lv: number;
  variables?: Record<string, number>;
  characterName?: string;
  onSelect: (profile: CharacterProfileId) => void;
  onClose: () => void;
}

export function ProfileSelectorModal({
  isOpen,
  currentProfile,
  lv,
  variables = {},
  characterName,
  onSelect,
  onClose,
}: ProfileSelectorModalProps) {
  const safeCurrent = normalizeCharacterProfile(currentProfile);
  const baseLimit = getAttributeLimitForLevel(lv);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const getOverLimitStatsForProfile = (profileId: CharacterProfileId) => {
    const exceeded: Array<{ stat: string; val: number; limit: number }> = [];
    for (const [stat, rawVal] of Object.entries(variables || {})) {
      const num = Number(rawVal);
      if (!Number.isFinite(num)) continue;
      if (isAttributeOverLimit(num, lv, stat, profileId)) {
        exceeded.push({
          stat,
          val: num,
          limit: getAttributeLimitForStat(lv, stat, profileId),
        });
      }
    }
    return exceeded;
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[375] bg-black/82 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Seleção de Perfil do Personagem"
      data-testid="profile-selector-modal"
    >
      <div
        className="w-full sm:max-w-3xl bg-[#09090e] border border-[#282836] border-t-2 border-t-[#8f171c] rounded-none shadow-[0_24px_70px_rgba(0,0,0,0.92)] max-h-[92dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#0e0e15] border-b border-[#1f1f2b] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#b52a30] font-bold">
              Classificação Operacional // Perfis
            </div>
            <h3 className="font-mono text-sm sm:text-base font-bold uppercase tracking-wider text-white truncate mt-0.5">
              Selecionar Perfil{characterName ? ` — ${characterName}` : ""}
            </h3>
            <p className="text-[11px] font-mono text-[#828392] mt-0.5">
              LV {lv} · Limite base: <span className="text-[#dedede] font-bold">{baseLimit}</span>{" "}
              <span className="hidden sm:inline text-[#646575]">
                (Limite = 3 + ((LV - 1) × 2) + bônus do perfil)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção de perfil"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#14141d] hover:bg-[#1e1e2b] border border-[#282836] text-[#9ca3af] hover:text-white transition-colors cursor-pointer shrink-0 rounded-none"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — 3 Profile Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {CHARACTER_PROFILE_LIST.map((profileDef) => {
              const isSelected = safeCurrent === profileDef.id;
              const theme = PROFILE_THEME_MAP[profileDef.id];
              const bonusEntries = getProfileBonusEntries(profileDef.id);
              const wouldExceed = getOverLimitStatsForProfile(profileDef.id);

              return (
                <button
                  key={profileDef.id}
                  type="button"
                  data-testid={`profile-card-${profileDef.id}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelect(profileDef.id);
                    onClose();
                  }}
                  className={`group text-left flex flex-col justify-between p-4 border border-t-2 transition-all cursor-pointer touch-manipulation rounded-none ${
                    isSelected
                      ? `${theme.selectedBg} ${theme.border} ${theme.topAccent} ${theme.glow}`
                      : `bg-[#0d0d13] border-[#232330] ${theme.hoverBorder} hover:bg-[#12121b] border-t-[#2c2c3c]`
                  }`}
                >
                  <div>
                    {/* Top Row: Symbol + Selection Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div
                        className={`w-12 h-12 flex items-center justify-center border rounded-none ${theme.badgeBg} ${theme.badgeBorder} ${theme.iconText}`}
                      >
                        <ProfileSymbolIcon symbol={profileDef.symbol} size={24} />
                      </div>

                      {isSelected ? (
                        <span
                          data-testid={`profile-selected-badge-${profileDef.id}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest border rounded-none ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}
                        >
                          <Check size={11} />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#6b6c7e] border border-[#20202c] bg-[#0a0a0f] group-hover:text-white group-hover:border-[#343448] transition-colors rounded-none">
                          Selecionar
                        </span>
                      )}
                    </div>

                    {/* Name & Description */}
                    <h4 className="font-mono text-base font-bold uppercase tracking-wider text-white">
                      {profileDef.name}
                    </h4>
                    <p className="text-xs text-[#a2a3b4] leading-relaxed mt-1.5 min-h-[36px]">
                      {profileDef.description}
                    </p>

                    {/* Benefited Attributes & Limit Bonuses */}
                    <div className="mt-4 pt-3 border-t border-[#1e1e2a]">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#7c7d8e] mb-2">
                        Bônus de Limite
                      </div>
                      <div className="space-y-1.5">
                        {bonusEntries.map(({ stat, bonus }) => {
                          const totalLimit = getAttributeLimitForStat(
                            lv,
                            stat,
                            profileDef.id,
                          );
                          return (
                            <div
                              key={stat}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[#09090e] border border-[#1d1d29]"
                            >
                              <span className="font-mono text-xs font-bold tracking-wider text-white">
                                {stat}
                              </span>
                              <div className="flex items-center gap-2 font-mono tabular-nums">
                                <span
                                  className={`px-1.5 py-0.5 text-[11px] font-bold border rounded-none ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}
                                >
                                  +{bonus}
                                </span>
                                <span className="text-[10px] text-[#8d8e9f]">
                                  MÁX {totalLimit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Non-destructive warning if switching leaves any stat over limit */}
                  {wouldExceed.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-amber-900/50 flex items-start gap-1.5 text-[10px] font-mono text-amber-300/90 leading-snug">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>
                        Acima do limite:{" "}
                        {wouldExceed
                          .map((e) => `${e.stat} (${e.val}/${e.limit})`)
                          .join(", ")}
                        . Valores serão mantidos.
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2.5 bg-[#0d0d13] border border-[#1d1d28] text-[11px] font-mono text-[#828392] leading-relaxed">
            Os bônus de perfil aumentam o limite máximo permitido de cada atributo sem adicionar pontos automaticamente. Trocar de perfil preserva todos os atributos já distribuídos.
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
