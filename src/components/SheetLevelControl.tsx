import React, { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import {
  getAttributeLimitForLevel,
  getMinimumLevelForAttributes,
  parseAndValidateLevelChange,
} from "../utils/levelSystem";
import { CharacterProfileId } from "../utils/profiles";

export interface SheetLevelControlProps {
  lv: number;
  variables?: Record<string, unknown> | null;
  profile?: CharacterProfileId | string | null;
  onChangeLv?: (nextLv: number) => void;
  isMaster?: boolean;
  isRlMode?: boolean;
}

export const SheetLevelControl: React.FC<SheetLevelControlProps> = ({
  lv,
  variables,
  profile,
  onChangeLv,
  isMaster = false,
  isRlMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(lv));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minRequiredLv = getMinimumLevelForAttributes(variables, profile);
  const attrLimit = getAttributeLimitForLevel(lv);
  const canEdit = Boolean(isMaster && onChangeLv);

  useEffect(() => {
    if (!canEdit && isEditing) {
      setIsEditing(false);
      setErrorMsg(null);
    }
  }, [canEdit, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(lv));
    }
  }, [lv, isEditing]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const showTempError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMsg(null);
    }, 2600);
  };

  const openEditor = () => {
    if (!canEdit) return;
    setDraft(String(lv));
    setErrorMsg(null);
    setIsEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commitDraft = (closeAfter = true): boolean => {
    if (!canEdit || !onChangeLv) {
      setIsEditing(false);
      return false;
    }
    const result = parseAndValidateLevelChange(draft, variables, profile);
    if (!result.ok || result.value === undefined) {
      showTempError(result.error || "LV inválido.");
      setDraft(String(lv));
      return false;
    }
    setErrorMsg(null);
    if (result.value !== lv) {
      onChangeLv(result.value);
    }
    setDraft(String(result.value));
    if (closeAfter) {
      setIsEditing(false);
    }
    return true;
  };

  const handleStep = (delta: number) => {
    if (!canEdit || !onChangeLv) return;
    const currentParsed = parseInt(draft, 10);
    const base = Number.isFinite(currentParsed) ? currentParsed : lv;
    const candidate = base + delta;
    const result = parseAndValidateLevelChange(candidate, variables, profile);
    if (!result.ok || result.value === undefined) {
      showTempError(result.error || `Mínimo LV ${minRequiredLv}.`);
      return;
    }
    setErrorMsg(null);
    setDraft(String(result.value));
    if (result.value !== lv) {
      onChangeLv(result.value);
    }
  };

  // Close when clicking outside the inline editor
  useEffect(() => {
    if (!isEditing || !canEdit || !onChangeLv) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        const res = parseAndValidateLevelChange(draft, variables, profile);
        if (res.ok && res.value !== undefined && res.value !== lv) {
          onChangeLv(res.value);
        } else if (!res.ok) {
          showTempError(res.error || "LV inválido.");
        }
        setDraft(String(res.ok && res.value !== undefined ? res.value : lv));
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isEditing, canEdit, draft, lv, variables, profile, onChangeLv]);

  const accentLabelClass = isRlMode ? "text-purple-400/75" : "text-[#b52a30]/70";
  const canDecrement = lv > minRequiredLv;

  // Jogadores visualizam o LV em modo estritamente somente leitura (sem toque, sem input, sem cursor de edição)
  if (!canEdit) {
    return (
      <div
        data-testid="sheet-lv-indicator"
        className="pointer-events-none select-none cursor-default inline-flex items-baseline justify-center gap-1.5 font-mono text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]"
      >
        <span className={accentLabelClass}>LV</span>
        <span className="text-[#dedede] tabular-nums">{lv}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {!isEditing ? (
        <button
          type="button"
          data-testid="sheet-lv-indicator"
          onClick={openEditor}
          title={`Editar nível (LV ${lv} · Limite de atributo: ${attrLimit})`}
          aria-label={`Nível ${lv}, limite máximo de atributos ${attrLimit}. Toque para editar.`}
          className="group pointer-events-auto inline-flex items-baseline justify-center gap-1.5 px-1.5 py-1.5 -my-1.5 font-mono text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] bg-transparent border-none outline-none cursor-pointer touch-manipulation select-none transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#b52a30]"
        >
          <span className={`${accentLabelClass} group-hover:opacity-100 transition-opacity`}>
            LV
          </span>
          <span className="text-[#dedede] group-hover:text-white tabular-nums border-b border-transparent group-hover:border-[#b52a30]/60 transition-colors">
            {lv}
          </span>
        </button>
      ) : (
        <div
          data-testid="sheet-lv-editor"
          className={`pointer-events-auto inline-flex items-center gap-1 px-1.5 py-0.5 -my-1.5 bg-[#0a0a0e]/95 border ${
            isRlMode ? "border-purple-500/70" : "border-[#8f171c]/80"
          } shadow-[0_6px_18px_rgba(0,0,0,0.9)] rounded-none`}
        >
          <span
            className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] select-none pr-0.5 ${
              isRlMode ? "text-purple-300" : "text-[#d4444b]"
            }`}
          >
            LV
          </span>

          <button
            type="button"
            data-testid="sheet-lv-dec"
            onClick={() => handleStep(-1)}
            disabled={!canDecrement}
            aria-label="Diminuir LV"
            title={
              canDecrement
                ? "Diminuir LV (-1)"
                : `LV mínimo ${minRequiredLv} pelos atributos atuais`
            }
            className="w-7 h-7 flex items-center justify-center bg-[#14141c] hover:bg-[#20202c] disabled:opacity-35 disabled:cursor-not-allowed text-[#d4d4d8] hover:text-white border border-[#2a2a36] rounded-none cursor-pointer touch-manipulation transition-colors"
          >
            <Minus size={11} />
          </button>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            data-testid="sheet-lv-input"
            aria-label="Nível do personagem (LV)"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft(true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(String(lv));
                setErrorMsg(null);
                setIsEditing(false);
              }
            }}
            className="w-10 h-7 bg-[#060609] border border-[#2b2b38] focus:border-[var(--op-red-bright)] text-center text-xs font-mono font-bold text-white tabular-nums outline-none rounded-none"
          />

          <button
            type="button"
            data-testid="sheet-lv-inc"
            onClick={() => handleStep(1)}
            aria-label="Aumentar LV"
            title="Aumentar LV (+1)"
            className="w-7 h-7 flex items-center justify-center bg-[#14141c] hover:bg-[#20202c] text-[#d4d4d8] hover:text-white border border-[#2a2a36] rounded-none cursor-pointer touch-manipulation transition-colors"
          >
            <Plus size={11} />
          </button>

          <button
            type="button"
            data-testid="sheet-lv-confirm"
            onClick={() => commitDraft(true)}
            aria-label="Confirmar LV"
            title="Confirmar LV"
            className="w-7 h-7 flex items-center justify-center bg-[#8f171c] hover:bg-[#b52a30] text-white border border-[#ff8085]/35 rounded-none cursor-pointer touch-manipulation transition-colors"
          >
            <Check size={12} />
          </button>
        </div>
      )}

      {errorMsg && (
        <span
          role="alert"
          data-testid="sheet-lv-error"
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-[#1a080b] text-[#ff8a8f] border border-[#b52a30]/80 px-2 py-0.5 text-[10px] font-mono tracking-normal normal-case whitespace-nowrap shadow-xl pointer-events-none select-none"
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
};

export default SheetLevelControl;
