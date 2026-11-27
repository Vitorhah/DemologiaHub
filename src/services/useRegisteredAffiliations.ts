import { useSyncExternalStore } from "react";
import {
  getAllRitualAffiliations,
  subscribeRitualAffiliations,
  type RitualAffiliationDefinition,
} from "../utils/rituals";

/**
 * Hook reativo que retorna todas as afiliações registradas (9 oficiais + personalizadas do Mestre)
 * e atualiza automaticamente qualquer componente consumidor quando o Mestre adiciona, edita ou remove uma afiliação.
 */
export function useRegisteredAffiliations(): readonly RitualAffiliationDefinition[] {
  return useSyncExternalStore(
    subscribeRitualAffiliations,
    getAllRitualAffiliations,
    getAllRitualAffiliations
  );
}
