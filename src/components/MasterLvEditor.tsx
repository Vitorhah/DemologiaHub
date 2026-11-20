import React, { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import {
  getAttributeLimitForLevel,
  getMinimumLevelForAttributes,
  normalizeLevel,
  parseAndValidateLevelChange,
} from "../utils/levelSystem";
import { CharacterProfileId } from "../utils/profiles";

export interface MasterLvEditorProps {
  value: number;
  variables?: Record<string, unknown> | null;
  profile?: CharacterProfileId | string | null;
  characterName?: string;
  isMaster: boolean;
  onConfirm: (nextLv: number) => Promise<{ ok: boolean; error?: string } | void> | void;
  compact?: boolean;
}

/**
 * Controle de edição de LV (Nível) exclusivo do Hub do Mestre.
 * - Inteiros >= 1 (progressão ilimitada)
 * - Bloqueia redução abaixo do mínimo exigido pelos atributos atuais
 * - Botões − / + e digitação direta com confirmação explícita (Enter, ✓ ou blur)
 * - Escondido e bloqueado para jogadores comuns
 */
export const MasterLvEditor: React.FC<MasterLvEditorProps> = ({
  value,
  variables,
  profile,
  characterName = "personagem",
  isMaster,
  onConfirm,
  compact = false,
}) => {
  const safeValue = normalizeLevel(value, variables, profile);
  const minRequiredLv = getMinimumLevelForAttributes(variables, profile);
  const attrLimit = getAttributeLimitForLevel(safeValue);

  const [draft, setDraft] = useState<string>(String(safeValue));
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(safeValue));
    }
  }, [safeValue, isFocused]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  if (!isMaster) {
    return null;
  }

  const showTempError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMsg(null);
    }, 2600);
  };

  const commitValue = async (rawValue: string | number) => {
    if (!isMaster || isSaving) return;

    const parsed = parseAndValidateLevelChange(rawValue, variables, profile);
    if (!parsed.ok || parsed.value === undefined) {
      setDraft(String(safeValue));
      setIsFocused(false);
      showTempError(parsed.error || "LV inválido");
      return;
    }

    const nextVal = parsed.value;
    setDraft(String(nextVal));
    setIsFocused(false);
    setErrorMsg(null);

    if (nextVal === safeValue) {
      return;
    }

    try {
      setIsSaving(true);
      const res = await onConfirm(nextVal);
      if (res && res.ok === false) {
        setDraft(String(safeValue));
        showTempError(res.error || "Falha ao salvar LV");
      }
    } catch {
      setDraft(String(safeValue));
      showTempError("Erro ao salvar LV");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep = (delta: number) => {
    const candidate = safeValue + delta;
    if (candidate < minRequiredLv) {
      showTempError(`Mínimo LV ${minRequiredLv} pelos atributos atuais`);
      return;
    }
    commitValue(candidate);
  };

  const isDirty = draft.trim() !== String(safeValue);
  const canDecrement = safeValue > minRequiredLv;

  if (compact) {
    return (
      <div className="relative inline-flex flex-col items-start">
        <div className="flex items-center justify-between w-full text-[11px] text-[#9ca3af] mb-1 gap-2">
          <span className="text-[var(--op-red-bright)] font-bold tracking-wider">LV</span>
          <span className="text-[#9ca3af] text-[10px] tabular-nums">
            MÁX {attrLimit}
          </span>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            disabled={isSaving || !canDecrement}
            onClick={() => handleStep(-1)}
            className="w-7 h-7 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed touch-manipulation"
            title={
              canDecrement
                ? `Diminuir LV de ${characterName}`
                : `LV mínimo ${minRequiredLv} pelos atributos atuais`
            }
            aria-label={`Diminuir LV de ${characterName}`}
          >
            <Minus size={11} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={isFocused ? draft : String(safeValue)}
            disabled={isSaving}
            onFocus={(e) => {
              setIsFocused(true);
              setDraft(String(safeValue));
              setErrorMsg(null);
              e.target.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitValue(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitValue(draft);
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsFocused(false);
                setDraft(String(safeValue));
                setErrorMsg(null);
                e.currentTarget.blur();
              }
            }}
            aria-label={`LV de ${characterName}`}
            title={`LV de ${characterName} (mínimo ${minRequiredLv}, teto de atributos ${attrLimit})`}
            className={`w-11 h-7 bg-[#0c0c10] border-y border-[#202028] text-center text-xs text-white font-bold tabular-nums outline-none focus:border-[var(--op-red)] ${
              errorMsg ? "border-red-500 text-red-300" : ""
            }`}
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleStep(1)}
            className="w-7 h-7 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer disabled:opacity-40 touch-manipulation"
            title={`Aumentar LV de ${characterName}`}
            aria-label={`Aumentar LV de ${characterName}`}
          >
            <Plus size={11} />
          </button>
          {isDirty && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitValue(draft)}
              disabled={isSaving}
              className="ml-1 w-7 h-7 flex items-center justify-center bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[#ff8085]/40 rounded-none cursor-pointer touch-manipulation"
              title={`Confirmar LV de ${characterName}`}
              aria-label={`Confirmar LV de ${characterName}`}
            >
              <Check size={12} />
            </button>
          )}
        </div>
        {errorMsg && (
          <span
            role="alert"
            className="mt-1 text-[10px] text-[#ff7b7b] font-mono leading-tight"
          >
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={`master-lv-editor-${characterName}`}
      className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2 mb-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
          <span className="text-[var(--op-red-bright)]/85">LV</span>
          <span className="text-[#dedede] tabular-nums tracking-normal text-xs">
            {safeValue}
          </span>
          <span className="text-[#78798a] font-normal tracking-wider text-[10px] tabular-nums">
            (MÁX {attrLimit})
          </span>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            disabled={isSaving || !canDecrement}
            onClick={() => handleStep(-1)}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed touch-manipulation"
            title={
              canDecrement
                ? `Diminuir LV de ${characterName}`
                : `LV mínimo ${minRequiredLv} pelos atributos atuais`
            }
            aria-label={`Diminuir LV de ${characterName}`}
          >
            <Minus size={12} />
          </button>

          <input
            type="text"
            inputMode="numeric"
            value={isFocused ? draft : String(safeValue)}
            disabled={isSaving}
            onFocus={(e) => {
              setIsFocused(true);
              setDraft(String(safeValue));
              setErrorMsg(null);
              e.target.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitValue(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitValue(draft);
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsFocused(false);
                setDraft(String(safeValue));
                setErrorMsg(null);
                e.currentTarget.blur();
              }
            }}
            aria-label={`LV de ${characterName}`}
            title={`LV de ${characterName} (mínimo ${minRequiredLv}, limite de atributo ${attrLimit})`}
            className={`w-[4.75rem] h-9 sm:h-8 bg-[#0c0c10] border-y border-[#202028] text-white text-xs font-bold text-center px-1.5 rounded-none outline-none tabular-nums focus:border-[var(--op-red)] ${
              errorMsg ? "border-red-500 text-red-300" : ""
            }`}
          />

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleStep(1)}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all disabled:opacity-40 touch-manipulation"
            title={`Aumentar LV de ${characterName}`}
            aria-label={`Aumentar LV de ${characterName}`}
          >
            <Plus size={12} />
          </button>

          {isDirty && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitValue(draft)}
              disabled={isSaving}
              className="ml-1.5 w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[#ff8085]/40 rounded-none cursor-pointer transition-all active:scale-95 touch-manipulation"
              title={`Confirmar LV de ${characterName}`}
              aria-label={`Confirmar LV de ${characterName}`}
            >
              <Check size={13} />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-1.5 text-[10px] text-[#ff7b7b] font-mono text-right"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default MasterLvEditor;
