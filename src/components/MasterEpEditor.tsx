import React, { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import {
  EP_MAX,
  EP_MIN,
  normalizeEpValue,
  parseEpInput,
  stepEpValue,
} from "../utils/epLogic";

export interface MasterEpEditorProps {
  value: number;
  characterName?: string;
  isMaster: boolean;
  onConfirm: (nextEp: number) => Promise<{ ok: boolean; error?: string } | void> | void;
  compact?: boolean;
}

/**
 * Controle de edição de EP (Exposição Paranormal) exclusivo do Hub do Mestre.
 * - Inteiros de 0 a 1000 (exibidos com "%")
 * - Botões − / + e digitação direta com confirmação explícita (Enter, botão ✓ ou blur)
 * - Rejeita decimais e textos com feedback discreto
 */
export const MasterEpEditor: React.FC<MasterEpEditorProps> = ({
  value,
  characterName = "personagem",
  isMaster,
  onConfirm,
  compact = false,
}) => {
  const safeValue = normalizeEpValue(value, EP_MIN);
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
    }, 2400);
  };

  const commitValue = async (rawValue: string | number) => {
    if (!isMaster || isSaving) return;

    const parsed = parseEpInput(rawValue);
    if (!parsed.valid || parsed.value === undefined) {
      setDraft(String(safeValue));
      setIsFocused(false);
      showTempError(parsed.error || "Valor inválido");
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
        showTempError(res.error || "Falha ao salvar EP");
      }
    } catch {
      setDraft(String(safeValue));
      showTempError("Erro ao salvar EP");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep = (delta: number) => {
    const next = stepEpValue(safeValue, delta);
    if (next === safeValue) return;
    commitValue(next);
  };

  const isDirty = draft.trim() !== String(safeValue);

  if (compact) {
    return (
      <div className="relative inline-flex flex-col items-start">
        <div className="flex items-center justify-between w-full text-[11px] text-[#9ca3af] mb-1">
          <span className="text-[var(--op-red-bright)] font-bold tracking-wider">EP</span>
          <span className="text-[#dedede] font-bold tabular-nums">{safeValue}%</span>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            disabled={isSaving || safeValue <= EP_MIN}
            onClick={() => handleStep(-1)}
            className="w-7 h-7 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer disabled:opacity-40 touch-manipulation"
            title={`Diminuir EP de ${characterName}`}
            aria-label={`Diminuir EP de ${characterName}`}
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
            aria-label={`EP de ${characterName} (0 a 1000)`}
            title={`EP de ${characterName} (inteiro de 0 a 1000)`}
            className={`w-14 h-7 bg-[#0c0c10] border-y border-[#202028] text-center text-xs text-white font-bold tabular-nums outline-none focus:border-[var(--op-red)] ${
              errorMsg ? "border-red-500 text-red-300" : ""
            }`}
          />
          <button
            type="button"
            disabled={isSaving || safeValue >= EP_MAX}
            onClick={() => handleStep(1)}
            className="w-7 h-7 flex items-center justify-center bg-[#121217] hover:bg-[#1a1a24] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] rounded-none cursor-pointer disabled:opacity-40 touch-manipulation"
            title={`Aumentar EP de ${characterName}`}
            aria-label={`Aumentar EP de ${characterName}`}
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
              title={`Confirmar EP de ${characterName}`}
              aria-label={`Confirmar EP de ${characterName}`}
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
    <div className="bg-[#101015] border border-[#202028] outline outline-1 outline-[#181820] rounded-none p-2 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
          <span className="text-[var(--op-red-bright)]/85">EP</span>
          <span className="text-[#dedede] tabular-nums tracking-normal text-xs">
            {safeValue}%
          </span>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            disabled={isSaving || safeValue <= EP_MIN}
            onClick={() => handleStep(-1)}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all disabled:opacity-40 touch-manipulation"
            title={`Diminuir EP de ${characterName}`}
            aria-label={`Diminuir EP de ${characterName}`}
          >
            <Minus size={12} />
          </button>

          <div className="relative flex items-center">
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
              aria-label={`EP de ${characterName} (0 a 1000)`}
              title={`EP de ${characterName} (inteiro de 0 a 1000)`}
              className={`w-[4.75rem] h-9 sm:h-8 bg-[#0c0c10] border-y border-[#202028] text-white text-xs font-bold text-center pr-5 pl-1.5 rounded-none outline-none tabular-nums focus:border-[var(--op-red)] ${
                errorMsg ? "border-red-500 text-red-300" : ""
              }`}
            />
            <span className="pointer-events-none select-none absolute right-1.5 text-[10px] text-[#828392] font-bold">
              %
            </span>
          </div>

          <button
            type="button"
            disabled={isSaving || safeValue >= EP_MAX}
            onClick={() => handleStep(1)}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14141c] hover:bg-[#1e1e28] active:bg-[#252532] text-[#9ca3af] hover:text-white border border-[#202028] outline outline-1 outline-[#181820] text-xs font-bold rounded-none cursor-pointer transition-all disabled:opacity-40 touch-manipulation"
            title={`Aumentar EP de ${characterName}`}
            aria-label={`Aumentar EP de ${characterName}`}
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
              title={`Confirmar EP de ${characterName}`}
              aria-label={`Confirmar EP de ${characterName}`}
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

export default MasterEpEditor;
