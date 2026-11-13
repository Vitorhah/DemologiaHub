import React, { useState } from "react";
import { Plus, X, Tag } from "lucide-react";
import {
  StatusEffect,
  STATUS_COLOR_PALETTE,
  STATUS_PRESETS,
  createStatusEffect,
  getStatusColorSwatch,
  togglePresetStatusEffect,
} from "../utils/statusEffects";

interface StatusPostItProps {
  effect: StatusEffect;
  index?: number;
  compact?: boolean;
  onRemove?: (id: string) => void;
}

export const StatusPostIt: React.FC<StatusPostItProps> = ({
  effect,
  index = 0,
  compact = false,
  onRemove,
}) => {
  const swatch = getStatusColorSwatch(effect.color);
  const tilts = [-2.5, 1.8, -1.5, 2.2, -1.8, 1.4];
  const tilt = tilts[index % tilts.length];

  return (
    <div
      style={{
        backgroundColor: swatch.bgHex,
        color: swatch.textHex,
        borderColor: swatch.borderHex,
        transform: `rotate(${tilt}deg)`,
      }}
      className={`relative border shadow-[0_4px_10px_rgba(0,0,0,0.55)] font-mono font-bold uppercase tracking-wider select-none transition-transform duration-150 hover:scale-[1.03] ${
        compact
          ? "pl-2 pr-3 py-1 text-[10px] min-w-[68px] max-w-[125px]"
          : "pl-2.5 pr-3.5 py-1.5 text-[11px] min-w-[82px] max-w-[140px]"
      }`}
      title={effect.note ? `${effect.label}: ${effect.note}` : effect.label}
    >
      {/* Fita adesiva no topo */}
      <span
        aria-hidden="true"
        style={{ backgroundColor: swatch.tapeBg }}
        className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 border border-black/15 shadow-sm"
      />

      <div className="flex items-center justify-between gap-1 pt-0.5">
        <span className="truncate leading-tight">{effect.label}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(effect.id);
            }}
            aria-label={`Remover status ${effect.label}`}
            className="w-4 h-4 flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer shrink-0 rounded-none hover:bg-black/15"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Dobra no canto inferior direito */}
      <span
        aria-hidden="true"
        style={{
          borderTopColor: swatch.foldHex,
          borderRightColor: "transparent",
        }}
        className="pointer-events-none absolute bottom-0 right-0 w-0 h-0 border-t-[8px] border-r-[8px] opacity-85"
      />
    </div>
  );
};

interface StatusEffectsEditorProps {
  effects: StatusEffect[];
  onChange: (nextEffects: StatusEffect[]) => void;
  compact?: boolean;
}

export const StatusEffectsEditor: React.FC<StatusEffectsEditorProps> = ({
  effects = [],
  onChange,
  compact = false,
}) => {
  const [customLabel, setCustomLabel] = useState("");
  const [customColor, setCustomColor] = useState<string>(STATUS_COLOR_PALETTE[0].id);

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customLabel.trim();
    if (!clean) return;
    onChange([...effects, createStatusEffect(clean, customColor)]);
    setCustomLabel("");
  };

  const handleRemove = (id: string) => {
    onChange(effects.filter((ef) => ef.id !== id));
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-[#1e1e28]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9ca3af] flex items-center gap-1.5">
          <Tag size={11} className="text-[var(--op-red-bright)]" />
          Condições & Post-its ({effects.length})
        </span>
      </div>

      {/* Post-its ativos */}
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-2 py-1">
          {effects.map((eff, idx) => (
            <StatusPostIt
              key={eff.id}
              effect={eff}
              index={idx}
              compact={compact}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Presets rápidos */}
      <div className="flex flex-wrap gap-1">
        {STATUS_PRESETS.map((preset) => {
          const isActive = effects.some(
            (e) => e.label.trim().toLowerCase() === preset.label.toLowerCase()
          );
          const swatch = getStatusColorSwatch(preset.color);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(togglePresetStatusEffect(effects, preset))}
              className={`min-h-[30px] px-2 py-1 text-[10px] font-mono uppercase tracking-wider border rounded-none transition-all cursor-pointer touch-manipulation ${
                isActive
                  ? "bg-[#220a0e] text-white border-[var(--op-red-bright)] font-bold"
                  : "bg-[#12121a] text-[#9ca3af] border-[#242432] hover:text-white hover:border-[#3c3c4c]"
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 mr-1 align-middle"
                style={{ backgroundColor: swatch.bgHex }}
              />
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Criação de Status customizado com paleta de cores */}
      <form onSubmit={handleAddCustom} className="space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Status personalizado..."
            className="flex-1 min-w-0 min-h-[36px] bg-[#0c0c10] border border-[#242430] focus:border-[var(--op-red)] px-2.5 py-1 text-xs text-white font-mono outline-none rounded-none"
          />
          <button
            type="submit"
            disabled={!customLabel.trim()}
            className="min-h-[36px] min-w-[38px] px-2.5 bg-[#181822] hover:bg-[#8f171c] disabled:opacity-40 text-white border border-[#2c2c38] rounded-none flex items-center justify-center cursor-pointer transition-colors"
            title="Adicionar condição"
            aria-label="Adicionar condição personalizada"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#6e7080]">
            Cor:
          </span>
          {STATUS_COLOR_PALETTE.map((swatch) => {
            const selected = customColor === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                onClick={() => setCustomColor(swatch.id)}
                title={swatch.name}
                aria-label={`Cor ${swatch.name}`}
                style={{ backgroundColor: swatch.bgHex }}
                className={`w-5 h-5 rounded-none border transition-transform cursor-pointer ${
                  selected
                    ? "border-white scale-115 ring-1 ring-white/70"
                    : "border-black/40 opacity-75 hover:opacity-100"
                }`}
              />
            );
          })}
        </div>
      </form>
    </div>
  );
};
