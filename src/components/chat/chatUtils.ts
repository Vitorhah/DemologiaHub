import { ChatMessage, MessageGroupData } from "./types";

export const MAX_CHAT_MESSAGES = 250;

export function sanitizeRoomId(roomId: string): string {
  return (roomId || "mesa_principal")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

/**
 * Mescla duas listas de mensagens deduplicando por ID, ordenando cronologicamente
 * e mantendo no máximo MAX_CHAT_MESSAGES mensagens mais recentes.
 */
export function mergeMessages(
  listA: ChatMessage[],
  listB: ChatMessage[],
): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of listA) {
    if (m && m.id) map.set(m.id, m);
  }
  for (const m of listB) {
    if (m && m.id) map.set(m.id, m);
  }
  const sorted = Array.from(map.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  return sorted.length > MAX_CHAT_MESSAGES
    ? sorted.slice(-MAX_CHAT_MESSAGES)
    : sorted;
}

/**
 * Comparação rápida O(1)/O(N) para evitar atualizações e re-renderizações redundantes.
 */
export function areMessagesEqual(
  a: ChatMessage[],
  b: ChatMessage[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const lastIdx = a.length - 1;
  if (
    a[0]?.id !== b[0]?.id ||
    a[lastIdx]?.id !== b[lastIdx]?.id ||
    a[lastIdx]?.timestamp !== b[lastIdx]?.timestamp
  ) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].text !== b[i].text) {
      return false;
    }
  }
  return true;
}

/**
 * Agrupa mensagens consecutivas do mesmo remetente em blocos com até 5 minutos de intervalo.
 */
export function groupChatMessages(
  messages: ChatMessage[],
  currentUserId: string,
): MessageGroupData[] {
  if (!messages.length) return [];

  const groups: MessageGroupData[] = [];
  let currentGroup: MessageGroupData | null = null;

  for (const msg of messages) {
    const isSelf = msg.senderId === currentUserId;

    if (
      currentGroup &&
      currentGroup.senderId === msg.senderId &&
      msg.timestamp - currentGroup.timestamp < 5 * 60 * 1000
    ) {
      currentGroup.messages.push(msg);
      currentGroup.timestamp = msg.timestamp;
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatar: msg.senderAvatar,
        isMaster: msg.isMaster,
        isSelf,
        messages: [msg],
        timestamp: msg.timestamp,
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export const INITIAL_VISIBLE_MESSAGES = 40;
export const OLDER_MESSAGES_BATCH = 30;

/**
 * Verifica se a posição de rolagem está próxima do final do contêiner.
 */
export function isScrollNearBottom(metrics: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  thresholdPx?: number;
}): boolean {
  const threshold = metrics.thresholdPx ?? 80;
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold;
}

/**
 * Retorna a janela mais recente de mensagens visíveis para carregamento sob demanda
 * do histórico anterior sem renderizar todo o log de uma vez.
 */
export function sliceVisibleMessages(
  messages: ChatMessage[],
  visibleCount: number,
): {
  visibleMessages: ChatMessage[];
  hasOlderMessages: boolean;
  olderMessagesCount: number;
} {
  if (messages.length === 0) {
    return {
      visibleMessages: [],
      hasOlderMessages: false,
      olderMessagesCount: 0,
    };
  }

  const safeCount = Math.max(1, visibleCount);
  if (messages.length <= safeCount) {
    return {
      visibleMessages: messages,
      hasOlderMessages: false,
      olderMessagesCount: 0,
    };
  }

  const olderMessagesCount = messages.length - safeCount;
  return {
    visibleMessages: messages.slice(-safeCount),
    hasOlderMessages: true,
    olderMessagesCount,
  };
}

export type MessageListTransition =
  | "empty"
  | "initial"
  | "prepended"
  | "appended"
  | "unchanged";

/**
 * Classifica como a lista de mensagens visíveis mudou para preservar a posição de leitura
 * ao carregar mensagens antigas no topo sem causar pulos automáticos.
 */
export function classifyMessageListTransition(
  prevFirstId: string | null,
  prevLastId: string | null,
  prevCount: number,
  nextMessages: ChatMessage[],
): MessageListTransition {
  if (nextMessages.length === 0) return "empty";
  if (prevCount === 0) return "initial";

  const nextFirstId = nextMessages[0]?.id ?? null;
  const nextLastId = nextMessages[nextMessages.length - 1]?.id ?? null;

  if (nextLastId !== prevLastId) {
    return "appended";
  }
  if (nextFirstId !== prevFirstId || nextMessages.length > prevCount) {
    return "prepended";
  }
  return "unchanged";
}

