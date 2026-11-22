import { evaluateDiceFormula } from "./diceFormula";
import { normalizePdis, PdiItem } from "./pdi";

export interface InitiativeFilterState {
  selectedIds: string[];
  knownIds: string[];
  hasCustomSelection: boolean;
  filterActive: boolean;
}

export interface InitiativeRollParticipant {
  id: string;
  variables?: Record<string, any>;
  pdis?: PdiItem[];
}

export function createInitialInitiativeFilterState(): InitiativeFilterState {
  return {
    selectedIds: [],
    knownIds: [],
    hasCustomSelection: false,
    filterActive: false,
  };
}

/**
 * Reconcilia o estado de seleção do filtro quando jogadores entram ou saem da sessão.
 * - Jogadores desconectados são removidos automaticamente da seleção sem gerar inconsistências.
 * - Quando o Mestre ainda está no estado padrão (todos selecionados), novos jogadores entram já selecionados.
 * - Quando o Mestre personalizou a seleção (desmarcou alguém ou limpou), novos jogadores entram
 *   desmarcados para não invadir uma seleção de combate já montada.
 */
export function reconcileInitiativeSelection(
  state: InitiativeFilterState,
  currentParticipantIds: string[]
): InitiativeFilterState {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of currentParticipantIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }

  const knownSet = new Set(state.knownIds);
  const prevSelectedSet = new Set(state.selectedIds);

  const nextSelected: string[] = [];
  for (const id of uniqueIds) {
    const isNew = !knownSet.has(id);
    if (isNew) {
      if (!state.hasCustomSelection) {
        nextSelected.push(id);
      }
    } else if (prevSelectedSet.has(id)) {
      nextSelected.push(id);
    }
  }

  const sameKnown =
    uniqueIds.length === state.knownIds.length &&
    uniqueIds.every((id, idx) => state.knownIds[idx] === id);
  const sameSelected =
    nextSelected.length === state.selectedIds.length &&
    nextSelected.every((id, idx) => state.selectedIds[idx] === id);

  if (sameKnown && sameSelected) {
    return state;
  }

  return {
    ...state,
    selectedIds: nextSelected,
    knownIds: uniqueIds,
  };
}

export function toggleInitiativeParticipant(
  state: InitiativeFilterState,
  participantId: string,
  currentParticipantIds: string[]
): InitiativeFilterState {
  const reconciled = reconcileInitiativeSelection(state, currentParticipantIds);
  if (!reconciled.knownIds.includes(participantId)) {
    return reconciled;
  }
  const exists = reconciled.selectedIds.includes(participantId);
  const nextSelected = exists
    ? reconciled.selectedIds.filter((id) => id !== participantId)
    : [...reconciled.selectedIds, participantId];

  const allSelected =
    reconciled.knownIds.length > 0 &&
    nextSelected.length === reconciled.knownIds.length;

  return {
    ...reconciled,
    selectedIds: nextSelected,
    hasCustomSelection: !allSelected,
  };
}

export function selectAllInitiativeParticipants(
  state: InitiativeFilterState,
  currentParticipantIds: string[]
): InitiativeFilterState {
  const reconciled = reconcileInitiativeSelection(state, currentParticipantIds);
  return {
    ...reconciled,
    selectedIds: [...reconciled.knownIds],
    hasCustomSelection: false,
  };
}

export function clearInitiativeSelection(
  state: InitiativeFilterState,
  currentParticipantIds: string[]
): InitiativeFilterState {
  const reconciled = reconcileInitiativeSelection(state, currentParticipantIds);
  return {
    ...reconciled,
    selectedIds: [],
    hasCustomSelection: true,
  };
}

export function invertInitiativeSelection(
  state: InitiativeFilterState,
  currentParticipantIds: string[]
): InitiativeFilterState {
  const reconciled = reconcileInitiativeSelection(state, currentParticipantIds);
  const selectedSet = new Set(reconciled.selectedIds);
  const nextSelected = reconciled.knownIds.filter((id) => !selectedSet.has(id));
  const allSelected =
    reconciled.knownIds.length > 0 &&
    nextSelected.length === reconciled.knownIds.length;

  return {
    ...reconciled,
    selectedIds: nextSelected,
    hasCustomSelection: !allSelected,
  };
}

export function setInitiativeFilterActive(
  state: InitiativeFilterState,
  active: boolean
): InitiativeFilterState {
  if (state.filterActive === active) return state;
  return {
    ...state,
    filterActive: active,
  };
}

/**
 * Filtra a lista já ordenada de participantes para exibição na aba de Iniciativas do Mestre.
 * Quando o filtro está desativado, todos os participantes permanecem visíveis.
 * Quando ativo, apenas os selecionados são exibidos (sem remover ou alterar dados dos ocultos).
 */
export function filterInitiativeParticipants<T extends { id: string }>(
  orderedParticipants: T[],
  selectedIds: string[],
  filterActive: boolean
): T[] {
  if (!filterActive) return orderedParticipants;
  const selectedSet = new Set(selectedIds);
  return orderedParticipants.filter((p) => selectedSet.has(p.id));
}

/**
 * Rola iniciativa exclusivamente para os participantes selecionados, preservando
 * integralmente a fórmula atual do sistema (1d20+AGL via evaluateDiceFormula + PDIs).
 * Participantes não selecionados não realizam rolagem e não aparecem no mapa retornado.
 */
export function rollFilteredInitiatives(
  participants: InitiativeRollParticipant[],
  selectedIds: string[],
  rng: () => number = Math.random
): Record<string, number> {
  const selectedSet = new Set(selectedIds);
  const newInits: Record<string, number> = {};

  for (const p of participants) {
    if (!selectedSet.has(p.id)) continue;
    const rolled = evaluateDiceFormula(
      "1d20+AGL",
      p.variables || {},
      rng,
      normalizePdis(p.pdis, [])
    );
    if (rolled) {
      newInits[p.id] = rolled.result;
    } else {
      const agl = Number(p.variables?.["AGL"]) || 0;
      const roll = Math.floor(rng() * 20) + 1;
      newInits[p.id] = roll + agl;
    }
  }

  return newInits;
}
