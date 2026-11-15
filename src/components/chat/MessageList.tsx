import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { ChatMessage, MessageGroupData } from "./types";
import { MessageGroup } from "./MessageGroup";
import {
  classifyMessageListTransition,
  groupChatMessages,
  isScrollNearBottom,
} from "./chatUtils";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  hasOlderMessages?: boolean;
  olderMessagesCount?: number;
  onLoadOlderMessages?: () => void;
}

const SCROLL_DEBOUNCE_MS = 100;

export const MessageList = React.memo(function MessageList({
  messages,
  currentUserId,
  hasOlderMessages = false,
  olderMessagesCount = 0,
  onLoadOlderMessages,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const hasInitializedScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotRef = useRef<{
    firstId: string | null;
    lastId: string | null;
    count: number;
    scrollHeight: number;
  }>({
    firstId: null,
    lastId: null,
    count: 0,
    scrollHeight: 0,
  });

  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

  // Agrupa mensagens consecutivas do mesmo jogador
  const messageGroups = useMemo<MessageGroupData[]>(
    () => groupChatMessages(messages, currentUserId),
    [messages, currentUserId],
  );

  // Rola exclusivamente o contêiner de mensagens (evita saltar o documento/viewport)
  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setUnreadBelowCount(0);
  }, []);

  // Listener de rolagem com debounce para atualizar o botão de retorno sem re-renders a cada frame
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const near = isScrollNearBottom({
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      thresholdPx: 80,
    });
    isNearBottomRef.current = near;
    prevSnapshotRef.current.scrollHeight = el.scrollHeight;

    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    scrollDebounceRef.current = setTimeout(() => {
      scrollDebounceRef.current = null;
      const target = containerRef.current;
      if (!target) return;
      const debouncedNear = isScrollNearBottom({
        scrollHeight: target.scrollHeight,
        scrollTop: target.scrollTop,
        clientHeight: target.clientHeight,
        thresholdPx: 80,
      });
      isNearBottomRef.current = debouncedNear;
      setShowScrollBottomBtn(!debouncedNear);
      if (debouncedNear) {
        setUnreadBelowCount(0);
      }
    }, SCROLL_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, []);

  // Gerencia posicionamento de scroll antes da pintura para impedir "pulos" ao carregar antigas ou iniciar
  useLayoutEffect(() => {
    const el = containerRef.current;
    const prev = prevSnapshotRef.current;
    const transition = classifyMessageListTransition(
      prev.firstId,
      prev.lastId,
      prev.count,
      messages,
    );

    const nextFirstId = messages[0]?.id ?? null;
    const nextLastId = messages[messages.length - 1]?.id ?? null;
    const prevScrollHeight = prev.scrollHeight;

    prevSnapshotRef.current = {
      firstId: nextFirstId,
      lastId: nextLastId,
      count: messages.length,
      scrollHeight: el ? el.scrollHeight : 0,
    };

    if (!el) return;

    if (transition === "empty") {
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setUnreadBelowCount(0);
      return;
    }

    if (transition === "initial" || !hasInitializedScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      prevSnapshotRef.current.scrollHeight = el.scrollHeight;
      hasInitializedScrollRef.current = true;
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setUnreadBelowCount(0);
      return;
    }

    if (transition === "prepended") {
      // Compensa exatamente a altura inserida acima para manter o usuário na mesma mensagem
      const deltaHeight = el.scrollHeight - prevScrollHeight;
      if (deltaHeight > 0) {
        el.scrollTop += deltaHeight;
      }
      prevSnapshotRef.current.scrollHeight = el.scrollHeight;
      return;
    }

    if (transition === "appended") {
      const lastMsg = messages[messages.length - 1];
      const isOwnLastMessage = lastMsg?.senderId === currentUserId;
      const deltaCount = Math.max(1, messages.length - prev.count);

      if (isOwnLastMessage || isNearBottomRef.current) {
        scrollToBottom(true);
      } else {
        setUnreadBelowCount((c) => c + deltaCount);
        setShowScrollBottomBtn(true);
      }
    }
  }, [messages, currentUserId, scrollToBottom]);

  // IntersectionObserver no topo do container para carregar mensagens antigas sob demanda
  useEffect(() => {
    const root = containerRef.current;
    const sentinel = topSentinelRef.current;
    if (
      !root ||
      !sentinel ||
      !hasOlderMessages ||
      !onLoadOlderMessages ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          hasInitializedScrollRef.current &&
          root.scrollHeight > root.clientHeight
        ) {
          prevSnapshotRef.current.scrollHeight = root.scrollHeight;
          onLoadOlderMessages();
        }
      },
      {
        root,
        rootMargin: "120px 0px 0px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlderMessages, onLoadOlderMessages, messages.length]);

  // Mantém a base ancorada quando o teclado virtual ou a caixa de texto redimensiona o container
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (isNearBottomRef.current && hasInitializedScrollRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain [overflow-anchor:none] [contain:content] will-change-transform px-3 sm:px-6 py-4 custom-scrollbar"
      >
        {messageGroups.length === 0 ? (
          /* ESTADO VAZIO MINIMALISTA */
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 select-none font-mono">
            <div className="w-12 h-12 flex items-center justify-center bg-[var(--op-panel)] border border-[var(--op-border)] text-[var(--op-red-bright)] mb-4 rounded-none">
              <MessageSquare size={22} />
            </div>

            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2">
              Chat da Mesa
            </h3>

            <p className="text-xs text-[#787a8c] leading-relaxed max-w-xs">
              Nenhuma mensagem ainda.
              <br />
              <span className="text-[#a4a7bc] text-xs">Seja o primeiro a falar.</span>
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto flex flex-col">
            <div
              ref={topSentinelRef}
              data-testid="chat-top-sentinel"
              aria-hidden={!hasOlderMessages}
              className="w-full py-2 mb-2 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-[#68697a] select-none shrink-0"
            >
              {hasOlderMessages
                ? `Carregando histórico anterior (${olderMessagesCount} restantes)...`
                : "Início do histórico da sessão"}
            </div>
            {messageGroups.map((group, idx) => (
              <MessageGroup
                key={`${group.senderId}-${group.messages[0]?.id || idx}`}
                group={group}
              />
            ))}
            <div className="h-2 shrink-0" />
          </div>
        )}
      </div>

      {showScrollBottomBtn && messageGroups.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 right-3 sm:right-5 z-30 min-h-[44px] px-3 py-2 flex items-center gap-2 bg-[#121218]/95 hover:bg-[#1a1a24] text-[#f1f1f4] border border-[var(--op-red)]/70 shadow-[0_6px_20px_rgba(0,0,0,0.75)] font-mono text-[11px] uppercase tracking-wider font-bold rounded-none cursor-pointer touch-manipulation transition-colors"
          aria-label="Ir para as mensagens mais recentes"
        >
          <ArrowDown size={14} className="text-[var(--op-red-bright)] shrink-0" />
          <span>
            {unreadBelowCount > 0
              ? `${unreadBelowCount} ${unreadBelowCount === 1 ? "nova" : "novas"}`
              : "Ir ao final"}
          </span>
        </button>
      )}
    </>
  );
});


