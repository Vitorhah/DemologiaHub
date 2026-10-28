import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, AlertCircle, X } from "lucide-react";

export interface PasswordAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPassword?: string;
}

export function PasswordAuthModal({
  isOpen,
  onClose,
  onSuccess,
  expectedPassword,
}: PasswordAuthModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setHasError(false);
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setHasError(true);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const correct = expectedPassword || import.meta.env.VITE_MESTRE_PASSWORD || "mestre";
      if (password === correct) {
        setHasError(false);
        onSuccess();
      } else {
        setHasError(true);
        setIsSubmitting(false);
      }
    }, 150);
  };

  return (
    <div
      className="fixed inset-0 z-[350] modal-backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[#0c0c10]/95 border-t sm:border border-[#282834] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.9)] relative overflow-hidden animate-sheet-up"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-[var(--op-red)] absolute top-0 left-0" />
        <div className="w-10 h-1 rounded-none bg-[#32323e] mx-auto mt-3 sm:hidden" aria-hidden="true" />

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white active:scale-95 hover:bg-white/[0.06] rounded-none transition-all cursor-pointer touch-manipulation"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3.5 mb-2 pr-10">
            <div className="w-11 h-11 rounded-none bg-[#1c090c] border border-[#6e1318] flex items-center justify-center text-[var(--op-red-bright)] shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-base font-bold text-white uppercase tracking-wider font-mono"
              >
                Acesso do Mestre
              </h2>
              <p className="text-xs text-[#8a8a98] mt-0.5 font-mono">
                Digite a senha para acessar o painel.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="mestre-password-input"
                className="block text-xs font-mono uppercase tracking-wider text-[#9ca3af] mb-1.5"
              >
                Senha
              </label>

              <div className="relative">
                <input
                  id="mestre-password-input"
                  type={showPassword ? "text" : "password"}
                  name="mestre_password"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (hasError) setHasError(false);
                  }}
                  className={`w-full min-h-[44px] bg-[#08080b] text-white text-base sm:text-sm font-mono px-4 py-2.5 pr-12 rounded-none border transition-colors outline-none placeholder:text-[#52525b] ${
                    hasError
                      ? "border-red-500 focus:border-red-400 bg-red-950/20"
                      : "border-[#262632] focus:border-[var(--op-red-bright)]"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8a8a98] hover:text-white transition-colors touch-manipulation cursor-pointer"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {hasError && (
                <div className="mt-2.5 p-3 bg-red-950/40 border border-red-800/60 rounded-none flex items-center gap-2 text-red-300 text-xs font-mono">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>Senha incorreta. Tente novamente.</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 font-mono">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider text-[#9ca3af] hover:text-white bg-[#14141c] hover:bg-[#1e1e28] active:scale-95 border border-[#282834] transition-all cursor-pointer touch-manipulation"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 rounded-none bg-gradient-to-r from-[#b52a30] to-[#7a1015] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white border border-[#ff8085]/40 font-bold uppercase tracking-wider text-xs transition-all cursor-pointer touch-manipulation"
              >
                {isSubmitting ? "Verificando..." : "Entrar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
