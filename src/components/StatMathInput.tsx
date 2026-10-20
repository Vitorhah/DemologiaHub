import React, { useState, useEffect, useRef } from 'react';
import { evaluateStatExpression } from '../utils/statMath';

export interface StatMathInputProps {
  value: number;
  onSave: (val: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

export const StatMathInput: React.FC<StatMathInputProps> = ({
  value,
  onSave,
  className = '',
  placeholder,
  min = 0,
  max,
  ariaLabel,
  title,
  disabled = false,
}) => {
  const [localVal, setLocalVal] = useState<string>(String(value ?? 0));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with outer value when not currently focused
  useEffect(() => {
    if (!isFocused) {
      setLocalVal(String(value ?? 0));
    }
  }, [value, isFocused]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const commitValue = () => {
    const parsed = evaluateStatExpression(localVal, value ?? 0, { min, max });

    if (parsed.success && parsed.value !== undefined) {
      setErrorMsg(null);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setLocalVal(String(parsed.value));
      setIsFocused(false);
      onSave(parsed.value);
    } else {
      // Revert to original value and show discreet error tooltip
      setLocalVal(String(value ?? 0));
      setIsFocused(false);
      setErrorMsg(parsed.error || 'Entrada inválida');

      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setErrorMsg(null);
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      setLocalVal(String(value ?? 0));
      setErrorMsg(null);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      e.currentTarget.blur();
    }
  };

  return (
    <span className="relative inline-flex items-center justify-center">
      <input
        type="text"
        inputMode="text"
        value={isFocused ? localVal : (value ?? 0)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || title}
        title={title || 'Editar valor atual (aceita números ou operações como +20, -15, *2)'}
        onFocus={(e) => {
          setIsFocused(true);
          setErrorMsg(null);
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          e.target.select();
        }}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commitValue}
        onKeyDown={handleKeyDown}
        className={`${className} ${
          errorMsg
            ? 'ring-1 ring-red-500/80 border-red-500/90 text-red-300 transition-colors'
            : ''
        }`}
      />

      {/* Discreet Error Tooltip */}
      {errorMsg && (
        <span
          role="alert"
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 bg-[#220c13] text-[#ff7b7b] border border-red-600/70 px-2 py-0.5 text-[10px] font-mono rounded shadow-xl whitespace-nowrap pointer-events-none select-none tracking-tight animate-in fade-in duration-150"
        >
          {errorMsg}
        </span>
      )}
    </span>
  );
};

export default StatMathInput;
