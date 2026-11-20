import { useCallback, useEffect, useRef, useState } from "react";
import { WakeLockController, WakeLockState } from "../utils/wakeLock";

export interface UseWakeLockResult extends WakeLockState {
  toggle: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * Hook React para manter a tela do celular/PC acesa durante sessões do Demologia Hub.
 */
export function useWakeLock(): UseWakeLockResult {
  const controllerRef = useRef<WakeLockController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new WakeLockController();
  }

  const [state, setState] = useState<WakeLockState>(() =>
    controllerRef.current!.getState()
  );

  useEffect(() => {
    const ctrl = controllerRef.current!;
    const unsubscribe = ctrl.subscribe(setState);
    ctrl.attach();
    return () => {
      unsubscribe();
      ctrl.detach();
    };
  }, []);

  const toggle = useCallback(async () => {
    await controllerRef.current?.toggle();
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await controllerRef.current?.setEnabled(enabled);
  }, []);

  return {
    ...state,
    toggle,
    setEnabled,
  };
}
