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
        className="w-full sm:max-w-sm bg-[#111217]/95 border-t sm:border border-[#272932] rounded-none shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative overflow-hidden animate-sheet-up"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Alça superior do Bottom Sheet no Mobile */}
        <div className="w-10 h-1 bg-[#323442] mx-auto mt-2.5 sm:hidden" aria-hidden="true" />

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#71717a] hover:text-white active:scale-95 hover:bg-white/[0.06] rounded-none transition-all cursor-pointer touch-manipulation"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="p-5 sm:p-6">
          {/* Cabeçalho Limpo e Direto */}
          <div className="flex items-center gap-3 mb-2 pr-8">
            <div className="w-11 h-11 rounded-none bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400 shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-base font-semibold text-white tracking-tight"
              >
                Acesso do Mestre
              </h2>
              <p className="text-xs text-[#8f9099] mt-0.5">
                Digite a senha para acessar o painel.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="mestre-password-input"
                className="block text-xs font-medium text-[#c4c4cc] mb-1.5"
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
                  className={`w-full min-h-[44px] bg-[#1a1b22] text-white text-base sm:text-sm px-3.5 py-2.5 pr-12 rounded-none border transition-colors outline-none placeholder:text-[#52525b] ${
                    hasError
                      ? "border-red-500/80 focus:border-red-500 bg-red-950/20"
                      : "border-[#2e303b] focus:border-red-600 focus:bg-[#1f2029]"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#71717a] hover:text-white transition-colors touch-manipulation cursor-pointer"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {hasError && (
                <div className="mt-2 p-2.5 bg-red-950/30 border border-red-900/50 rounded-none flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>Senha incorreta. Tente novamente.</span>
                </div>
              )}
            </div>

            <div className="pt-1 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-none text-xs font-medium text-[#a1a1aa] hover:text-white hover:bg-white/[0.05] active:scale-95 border border-[#2b2d38] transition-all cursor-pointer touch-manipulation"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-none bg-red-700 hover:bg-red-600 active:bg-red-800 active:scale-95 disabled:opacity-50 text-white font-medium text-xs transition-all cursor-pointer touch-manipulation"
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
