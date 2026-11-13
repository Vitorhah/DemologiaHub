export interface StatusEffect {
  id: string;
  label: string;
  color: string; // key from STATUS_COLOR_PALETTE or hex
  note?: string;
}

export interface StatusColorSwatch {
  id: string;
  name: string;
  bgHex: string;
  textHex: string;
  borderHex: string;
  foldHex: string;
  tapeBg: string;
}

export const STATUS_COLOR_PALETTE: StatusColorSwatch[] = [
  {
    id: "amber",
    name: "Amarelo Post-it",
    bgHex: "#fef08a",
    textHex: "#1c1917",
    borderHex: "#ca8a04",
    foldHex: "#eab308",
    tapeBg: "rgba(255, 255, 255, 0.42)",
  },
  {
    id: "crimson",
    name: "Carmesim",
    bgHex: "#fecdd3",
    textHex: "#4c0519",
    borderHex: "#be123c",
    foldHex: "#f43f5e",
    tapeBg: "rgba(255, 255, 255, 0.4)",
  },
  {
    id: "emerald",
    name: "Veneno / Esmeralda",
    bgHex: "#bbf7d0",
    textHex: "#052e16",
    borderHex: "#15803d",
    foldHex: "#22c55e",
    tapeBg: "rgba(255, 255, 255, 0.42)",
  },
  {
    id: "orange",
    name: "Chama / Laranja",
    bgHex: "#fed7aa",
    textHex: "#431407",
    borderHex: "#c2410c",
    foldHex: "#f97316",
    tapeBg: "rgba(255, 255, 255, 0.42)",
  },
  {
    id: "purple",
    name: "Paranormal / Roxo",
    bgHex: "#e9d5ff",
    textHex: "#2e1065",
    borderHex: "#7e22ce",
    foldHex: "#a855f7",
    tapeBg: "rgba(255, 255, 255, 0.42)",
  },
  {
    id: "sky",
    name: "Tático / Azul",
    bgHex: "#bae6fd",
    textHex: "#082f49",
    borderHex: "#0369a1",
    foldHex: "#38bdf8",
    tapeBg: "rgba(255, 255, 255, 0.45)",
  },
  {
    id: "slate",
    name: "Cinza / Neutro",
    bgHex: "#e4e4e7",
    textHex: "#18181b",
    borderHex: "#52525b",
    foldHex: "#a1a1aa",
    tapeBg: "rgba(255, 255, 255, 0.45)",
  },
  {
    id: "dark",
    name: "Escuro / Cego",
    bgHex: "#27272a",
    textHex: "#f4f4f5",
    borderHex: "#71717a",
    foldHex: "#52525b",
    tapeBg: "rgba(255, 255, 255, 0.22)",
  },
];

export const STATUS_PRESETS: { label: string; color: string }[] = [
  { label: "Envenenado", color: "emerald" },
  { label: "Atordoado", color: "amber" },
  { label: "Sangrando", color: "crimson" },
  { label: "Queimando", color: "orange" },
  { label: "Amedrontado", color: "purple" },
  { label: "Exausto", color: "slate" },
  { label: "Fortalecido", color: "sky" },
  { label: "Cego", color: "dark" },
];

const COLOR_ALIASES: Record<string, string> = {
  red: "crimson",
  vermelho: "crimson",
  green: "emerald",
  verde: "emerald",
  yellow: "amber",
  amarelo: "amber",
  blue: "sky",
  azul: "sky",
  violet: "purple",
  roxo: "purple",
  laranja: "orange",
  gray: "slate",
  grey: "slate",
  cinza: "slate",
  black: "dark",
  preto: "dark",
};

export function getStatusColorSwatch(colorId?: string): StatusColorSwatch {
  if (!colorId) return STATUS_COLOR_PALETTE[0];
  const lower = colorId.trim().toLowerCase();
  const normalizedId = COLOR_ALIASES[lower] || lower;
  const byId = STATUS_COLOR_PALETTE.find(
    (s) => s.id.toLowerCase() === normalizedId
  );
  if (byId) return byId;
  if (colorId.startsWith("#")) {
    return {
      id: colorId,
      name: "Custom",
      bgHex: colorId,
      textHex: "#111827",
      borderHex: "#374151",
      foldHex: "rgba(0,0,0,0.22)",
      tapeBg: "rgba(255, 255, 255, 0.38)",
    };
  }
  return STATUS_COLOR_PALETTE[0];
}

export function createStatusEffect(
  label: string,
  color = "amber",
  note?: string
): StatusEffect {
  return {
    id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: label.trim(),
    color,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
}

/**
 * Alterna um preset de status na lista: se já existir (case-insensitive), remove;
 * caso contrário, adiciona.
 */
export function togglePresetStatusEffect(
  current: StatusEffect[] = [],
  preset: { label: string; color: string }
): StatusEffect[] {
  const existingIdx = current.findIndex(
    (e) => e.label.trim().toLowerCase() === preset.label.trim().toLowerCase()
  );
  if (existingIdx >= 0) {
    return current.filter((_, idx) => idx !== existingIdx);
  }
  return [...current, createStatusEffect(preset.label, preset.color)];
}

/**
 * Divide os Post-its de status entre lateral esquerda e direita da logo do HUD.
 */
export function splitStatusEffectsForHud(effects: StatusEffect[] = []): {
  leftEffects: StatusEffect[];
  rightEffects: StatusEffect[];
} {
  const safe = Array.isArray(effects) ? effects : [];
  const leftEffects: StatusEffect[] = [];
  const rightEffects: StatusEffect[] = [];

  safe.forEach((eff, idx) => {
    if (idx % 2 === 0) {
      leftEffects.push(eff);
    } else {
      rightEffects.push(eff);
    }
  });

  return { leftEffects, rightEffects };
}
