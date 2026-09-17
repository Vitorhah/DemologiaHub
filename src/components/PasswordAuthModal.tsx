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
      const correct = expectedPassword || import.meta.env.VITE_MESTRE_PASSWORD;
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
      className="fixed inset-0 z-[350] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-sm bg-[#131418] border border-[#272932] rounded-none shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[#71717a] hover:text-white hover:bg-white/[0.06] rounded-none transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {/* Cabeçalho Limpo e Direto */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-none bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400 shrink-0">
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
                  className={`w-full bg-[#1a1b22] text-white text-sm px-3.5 py-2.5 rounded-none border transition-colors outline-none placeholder:text-[#52525b] ${
                    hasError
                      ? "border-red-500/80 focus:border-red-500 bg-red-950/20"
                      : "border-[#2e303b] focus:border-red-600 focus:bg-[#1f2029]"
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white p-1 transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {hasError && (
                <div className="mt-2 p-2 bg-red-950/30 border border-red-900/50 rounded-none flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Senha incorreta. Tente novamente.</span>
                </div>
              )}
            </div>

            <div className="pt-1 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-none text-xs font-medium text-[#a1a1aa] hover:text-white hover:bg-white/[0.05] border border-[#2b2d38] transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-none bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:opacity-50 text-white font-medium text-xs transition-colors cursor-pointer"
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
