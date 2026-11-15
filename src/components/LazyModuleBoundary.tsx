import React, { Suspense } from "react";
import { RotateCcw } from "lucide-react";

interface LazyModuleFallbackProps {
  isRlMode?: boolean;
  label?: string;
}

export function LazyModuleFallback({
  isRlMode = false,
  label = "Carregando módulo...",
}: LazyModuleFallbackProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full min-h-[220px] flex items-center justify-center p-6 font-mono select-none"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 border text-xs uppercase tracking-[0.18em] ${
          isRlMode
            ? "bg-[#110d1b]/85 border-purple-500/30 text-purple-200/80"
            : "bg-[#0c0c10]/90 border-[#22222c] text-[var(--op-text-muted)]"
        }`}
      >
        <span
          className={`w-2 h-2 animate-pulse shrink-0 ${
            isRlMode
              ? "bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
              : "bg-[var(--op-red-bright)] shadow-[0_0_8px_#b81d24]"
          }`}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}

interface BoundaryProps {
  children: React.ReactNode;
  isRlMode?: boolean;
  label?: string;
}

interface BoundaryState {
  hasError: boolean;
}

class ModuleErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  declare props: Readonly<BoundaryProps>;
  declare setState: (state: BoundaryState) => void;
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[220px] flex items-center justify-center p-6 font-mono">
          <div className="max-w-sm w-full bg-[#0c0c10] border border-[#2c2c38] p-5 text-center space-y-3">
            <p className="text-xs text-[#c4c5d0] uppercase tracking-wider">
              Falha ao carregar o módulo. Verifique sua conexão e tente novamente.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="min-h-[44px] px-4 py-2 bg-[#1a090c] hover:bg-[#2c0d12] border border-[var(--op-red)]/50 text-white text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
            >
              <RotateCcw size={14} />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function LazyModuleBoundary({
  children,
  isRlMode = false,
  label,
}: BoundaryProps) {
  return (
    <ModuleErrorBoundary isRlMode={isRlMode} label={label}>
      <Suspense fallback={<LazyModuleFallback isRlMode={isRlMode} label={label} />}>
        {children}
      </Suspense>
    </ModuleErrorBoundary>
  );
}
