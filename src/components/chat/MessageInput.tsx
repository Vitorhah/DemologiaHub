import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const MAX_MESSAGE_LENGTH = 2000;

export function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize do textarea até um limite
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 140);
    textarea.style.height = `${Math.max(nextHeight, 42)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      alert(`A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
      return;
    }

    onSendMessage(trimmed);
    setText("");

    // Reseta a altura do textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isTooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = text.trim().length > 0 && !isTooLong && !disabled;

  return (
    <div className="w-full bg-[var(--op-bg-secondary)] border-t border-[var(--op-border)] p-3 sm:p-4 shrink-0 z-20 rounded-none">
      <div className="max-w-5xl mx-auto flex items-end gap-2 sm:gap-3">
        {/* Campo de Texto Multilinha Expansível */}
        <div className="relative flex-1 bg-[var(--op-bg)] border border-[var(--op-border)] focus-within:border-[var(--op-red)] transition-all duration-150 rounded-none">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Digite uma mensagem..."
            maxLength={MAX_MESSAGE_LENGTH + 50}
            className="w-full bg-transparent text-[#ededf2] text-xs sm:text-sm font-mono placeholder:text-[#5d5e6e] px-3.5 py-2.5 outline-none resize-none overflow-y-auto custom-scrollbar leading-relaxed rounded-none"
            style={{ minHeight: "42px", maxHeight: "140px" }}
          />

          {/* Indicador de limite de caracteres quando próximo do fim */}
          {text.length > MAX_MESSAGE_LENGTH * 0.85 && (
            <div
              className={`absolute right-2 bottom-1.5 text-[10px] font-mono select-none ${
                isTooLong ? "text-red-500 font-bold" : "text-[#717282]"
              }`}
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </div>
          )}
        </div>

        {/* Botão de Enviar [➤] */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`h-[42px] px-3.5 sm:px-4 flex items-center justify-center gap-1.5 font-mono text-xs uppercase tracking-wider font-bold rounded-none border transition-all select-none shrink-0 ${
            canSend
              ? "bg-[var(--op-red)] hover:bg-[var(--op-red-bright)] text-white border border-[var(--op-red-dark)] cursor-pointer shadow-[0_0_10px_rgba(181,42,48,0.4)] active:translate-y-0.5"
              : "bg-[var(--op-panel)] text-[#555666] border border-[var(--op-border)] cursor-not-allowed opacity-60"
          }`}
          title={canSend ? "Enviar mensagem (Enter)" : "Digite algo para enviar"}
          aria-label="Enviar Mensagem"
        >
          <Send size={15} />
          <span className="hidden sm:inline-block">Enviar</span>
        </button>
      </div>

      {/* Dica de Teclado no Desktop */}
      <div className="max-w-5xl mx-auto flex items-center justify-between mt-1.5 px-1 text-[10px] font-mono text-[#585966] select-none">
        <span className="hidden sm:inline">
          Pressione <kbd className="text-[#8e90a0] bg-[#14141a] px-1 py-0.5 border border-[var(--op-border)] rounded-none">Enter</kbd> para enviar, <kbd className="text-[#8e90a0] bg-[#14141a] px-1 py-0.5 border border-[var(--op-border)] rounded-none">Shift + Enter</kbd> para nova linha
        </span>
      </div>
    </div>
  );
}
