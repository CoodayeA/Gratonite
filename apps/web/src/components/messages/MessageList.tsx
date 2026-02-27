import { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMessagesStore } from '@/stores/messages.store';
import { useMessages } from '@/hooks/useMessages';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MessageItem } from './MessageItem';
import { shouldGroupMessages } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { endNamedInteractionAfterPaint } from '@/lib/perf';
import type { Message } from '@gratonite/types';

interface MessageListProps {
  channelId: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  intro?: React.ReactNode;
  onReply: (message: Message) => void;
  onOpenEmojiPicker: (messageId: string, coords?: { x: number; y: number }) => void;
  hideIntroEmpty?: boolean;
}

const EMPTY_MESSAGES: Message[] = [];

const styles = {
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 0 18px',
    scrollBehavior: 'smooth',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--stroke) transparent',
  } as React.CSSProperties,
  loading: {
    display: 'grid',
    placeItems: 'center',
    flex: 1,
    padding: 40,
    color: 'var(--text-muted)',
    fontSize: 14,
  } as React.CSSProperties,
  loader: {
    display: 'flex',
    justifyContent: 'center',
    padding: 12,
  } as React.CSSProperties,
  beginning: {
    textAlign: 'center',
    padding: 16,
    fontSize: 13,
    color: 'var(--text-faint)',
    border: '1px solid rgba(163, 191, 239, 0.1)',
    background: 'rgba(255, 255, 255, 0.015)',
    borderRadius: 'var(--radius-lg)',
    margin: '0 16px 10px',
  } as React.CSSProperties,
  empty: {
    display: 'grid',
    placeItems: 'center',
    flex: 1,
    padding: 40,
    color: 'var(--text-muted)',
    fontSize: 14,
  } as React.CSSProperties,
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
};

export function MessageList({ channelId, emptyTitle, emptySubtitle, intro, onReply, onOpenEmojiPicker, hideIntroEmpty }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const hasLoadedRef = useRef(false);

  const messages = useMessagesStore(
    (s) => s.messagesByChannel.get(channelId) ?? EMPTY_MESSAGES,
  );
  const hasMore = useMessagesStore(
    (s) => s.hasMoreByChannel.get(channelId) ?? false,
  );

  const { fetchNextPage, isFetchingNextPage, isLoading } = useMessages(channelId);
  const { data: relationships = [] } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll() as Promise<Array<{ targetId: string; type: string }>>,
    staleTime: 15_000,
  });
  const blockedIds = new Set(relationships.filter((r) => r.type === 'blocked').map((r) => r.targetId));
  const visibleMessages = messages.filter((m) => !blockedIds.has(String(m.authorId)));

  // Check if scrolled to bottom
  const checkAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  // Auto-scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (wasAtBottomRef.current) {
      if (visibleMessages.length > 0) {
        rowVirtualizer.scrollToIndex(visibleMessages.length - 1, { align: 'end' });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [visibleMessages.length, rowVirtualizer]);

  // Initial scroll to bottom
  useEffect(() => {
    hasLoadedRef.current = false;
    rowVirtualizer.scrollToIndex(visibleMessages.length ? visibleMessages.length - 1 : 0, { align: 'end' });
  }, [channelId]);

  useEffect(() => {
    if (!isLoading) {
      hasLoadedRef.current = true;
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    endNamedInteractionAfterPaint('channel_switch', {
      channelId,
      messageCount: visibleMessages.length,
    });
  }, [channelId, isLoading, visibleMessages.length]);

  // Scroll-to-top pagination
  const handleScroll = useCallback(() => {
    checkAtBottom();
    const el = containerRef.current;
    if (!el) return;
    if (!hasLoadedRef.current) return;
    if (visibleMessages.length === 0) return;
    if (el.scrollTop < 100 && hasMore && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [checkAtBottom, hasMore, isFetchingNextPage, fetchNextPage, visibleMessages.length]);

  if (isLoading) {
    return (
      <div style={styles.loading}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div style={styles.list} ref={containerRef} onScroll={handleScroll}>
      {!hideIntroEmpty && intro}
      {isFetchingNextPage && (
        <div style={styles.loader}>
          <LoadingSpinner size={20} />
        </div>
      )}

      {!hasMore && visibleMessages.length > 0 && (
        <div style={styles.beginning}>
          This is the beginning of the conversation.
        </div>
      )}

      {visibleMessages.length === 0 && !isLoading && !hideIntroEmpty && (
        <div style={styles.empty}>
          <div style={styles.emptyTitle}>{emptyTitle ?? 'No messages yet.'}</div>
          <div style={styles.emptySubtitle}>
            {emptySubtitle ?? 'Say something to get the conversation started.'}
          </div>
        </div>
      )}

      {visibleMessages.length > 0 && (
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const msg = visibleMessages[virtualRow.index];
            if (!msg) return null;
            const prev = virtualRow.index > 0 ? visibleMessages[virtualRow.index - 1] : undefined;
            const grouped = shouldGroupMessages(
              prev ? { authorId: prev.authorId, createdAt: prev.createdAt, type: prev.type } : undefined,
              { authorId: msg.authorId, createdAt: msg.createdAt, type: msg.type },
            );

            return (
              <div
                key={msg.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageItem
                  message={msg}
                  isGrouped={grouped}
                  onReply={onReply}
                  onOpenEmojiPicker={onOpenEmojiPicker}
                />
              </div>
            );
          })}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
