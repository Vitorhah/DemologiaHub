import React from "react";
import { Sword, Brain, Eye } from "lucide-react";
import {
  CharacterProfileId,
  CharacterProfileSymbol,
  getProfileBonusEntries,
  getProfileDefinition,
} from "../utils/profiles";

export interface ProfileThemeTokens {
  iconText: string;
  border: string;
  hoverBorder: string;
  bg: string;
  selectedBg: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  topAccent: string;
  glow: string;
}

export const PROFILE_THEME_MAP: Record<CharacterProfileId, ProfileThemeTokens> = {
  executivo: {
    iconText: "text-red-400",
    border: "border-[#7f1d1d]",
    hoverBorder: "hover:border-red-500/90",
    bg: "bg-[#19090c]/95",
    selectedBg: "bg-[#220a0e]",
    badgeBg: "bg-[#2a0b10]",
    badgeBorder: "border-red-600/65",
    badgeText: "text-red-300",
    topAccent: "border-t-red-600",
    glow: "shadow-[0_0_16px_rgba(220,38,38,0.28)]",
  },
  pensativo: {
    iconText: "text-emerald-400",
    border: "border-emerald-800/85",
    hoverBorder: "hover:border-emerald-500/90",
    bg: "bg-[#081710]/95",
    selectedBg: "bg-[#0a1e15]",
    badgeBg: "bg-emerald-950/80",
    badgeBorder: "border-emerald-600/65",
    badgeText: "text-emerald-300",
    topAccent: "border-t-emerald-500",
    glow: "shadow-[0_0_16px_rgba(22,163,74,0.26)]",
  },
  oculto: {
    iconText: "text-blue-400",
    border: "border-blue-800/85",
    hoverBorder: "hover:border-blue-500/90",
    bg: "bg-[#081120]/95",
    selectedBg: "bg-[#0a172b]",
    badgeBg: "bg-blue-950/80",
    badgeBorder: "border-blue-500/65",
    badgeText: "text-blue-300",
    topAccent: "border-t-blue-500",
    glow: "shadow-[0_0_16px_rgba(37,99,235,0.28)]",
  },
};

export function ProfileSymbolIcon({
  symbol,
  size = 18,
  className = "",
}: {
  symbol: CharacterProfileSymbol;
  size?: number;
  className?: string;
}) {
  if (symbol === "sword") return <Sword size={size} className={className} />;
  if (symbol === "brain") return <Brain size={size} className={className} />;
  return <Eye size={size} className={className} />;
}

export interface CharacterProfileButtonProps {
  profile: CharacterProfileId;
  onClick: () => void;
  compact?: boolean;
}

/**
 * Símbolo interativo do Perfil posicionado no canto superior direito da ficha.
 * Ao clicar, abre o seletor de perfis (Executivo, Pensativo, Oculto).
 */
export function CharacterProfileButton({
  profile,
  onClick,
  compact = false,
}: CharacterProfileButtonProps) {
  const def = getProfileDefinition(profile);
  const theme = PROFILE_THEME_MAP[def.id];
  const bonusSummary = getProfileBonusEntries(def.id)
    .map((b) => `${b.stat} +${b.bonus}`)
    .join(" · ");

  return (
    <button
      type="button"
      data-testid="sheet-profile-button"
      data-profile-id={def.id}
      onClick={onClick}
      aria-label={`Perfil do personagem: ${def.name} (${bonusSummary}). Clique para alterar o perfil.`}
      title={`Perfil: ${def.name} (${bonusSummary}) — Clique para trocar`}
      className={`group flex items-center gap-2 border rounded-none transition-all cursor-pointer touch-manipulation select-none ${
        theme.bg
      } ${theme.border} ${theme.hoverBorder} ${theme.glow} ${
        compact
          ? "min-w-[36px] min-h-[36px] px-2 py-1"
          : "min-w-[44px] min-h-[44px] px-2.5 sm:px-3 py-1.5"
      }`}
    >
      <span
        className={`flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${theme.iconText}`}
      >
        <ProfileSymbolIcon symbol={def.symbol} size={compact ? 15 : 19} />
      </span>
      <span className="hidden sm:flex flex-col items-start leading-tight text-left">
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#8d8e9f]">
          Perfil
        </span>
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white">
          {def.name}
        </span>
      </span>
    </button>
  );
}
