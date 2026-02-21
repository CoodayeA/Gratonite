import { useRef, useEffect, useCallback } from 'react';
import { useMessagesStore } from '@/stores/messages.store';
import { useMessages } from '@/hooks/useMessages';
import { MessageItem } from './MessageItem';
import { shouldGroupMessages } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Message } from '@gratonite/types';

interface MessageListProps {
  channelId: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  intro?: React.ReactNode;
  onReply: (message: Message) => void;
  onOpenEmojiPicker: (messageId: string) => void;
}

export function MessageList({ channelId, emptyTitle, emptySubtitle, intro, onReply, onOpenEmojiPicker }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const messages = useMessagesStore(
    (s) => s.messagesByChannel.get(channelId) ?? [],
  );
  const hasMore = useMessagesStore(
    (s) => s.hasMoreByChannel.get(channelId) ?? true,
  );

  const { fetchNextPage, isFetchingNextPage, isLoading } = useMessages(channelId);

  // Check if scrolled to bottom
  const checkAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // Auto-scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (wasAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [channelId]);

  // Scroll-to-top pagination
  const handleScroll = useCallback(() => {
    checkAtBottom();
    const el = containerRef.current;
    if (!el) return;
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
  }, [checkAtBottom, hasMore, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="message-list-loading">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      {intro}
      {isFetchingNextPage && (
        <div className="message-list-loader">
          <LoadingSpinner size={20} />
        </div>
      )}

      {!hasMore && messages.length > 0 && (
        <div className="message-list-beginning">
          This is the beginning of the conversation.
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="message-list-empty">
          <div className="message-list-empty-title">{emptyTitle ?? 'No messages yet.'}</div>
          <div className="message-list-empty-subtitle">
            {emptySubtitle ?? 'Say something to get the conversation started.'}
          </div>
        </div>
      )}

      {messages.map((msg: Message, i: number) => {
        const prev = i > 0 ? messages[i - 1] : undefined;
        const grouped = shouldGroupMessages(
          prev ? { authorId: prev.authorId, createdAt: prev.createdAt, type: prev.type } : undefined,
          { authorId: msg.authorId, createdAt: msg.createdAt, type: msg.type },
        );

        return (
          <MessageItem key={msg.id} message={msg} isGrouped={grouped} onReply={onReply} onOpenEmojiPicker={onOpenEmojiPicker} />
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
