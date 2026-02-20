import { useEffect, useState } from 'react';
import { useMessagesStore } from '@/stores/messages.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatTypingText } from '@/lib/utils';

interface TypingIndicatorProps {
  channelId: string;
}

const TYPING_TIMEOUT = 10_000; // 10s — entries older than this are stale

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const typingMap = useMessagesStore(
    (s) => s.typingByChannel.get(channelId),
  );
  const clearTyping = useMessagesStore((s) => s.clearTyping);
  const [, setTick] = useState(0); // Force re-render to expire stale entries

  // Periodically clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      typingMap?.forEach((timestamp, userId) => {
        if (now - timestamp > TYPING_TIMEOUT) {
          clearTyping(channelId, userId);
        }
      });
      setTick((t) => t + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [channelId, typingMap, clearTyping]);

  if (!typingMap || typingMap.size === 0) {
    return <div className="typing-indicator" />;
  }

  // Filter out current user and stale entries
  const now = Date.now();
  const activeTypers: string[] = [];
  typingMap.forEach((timestamp, userId) => {
    if (userId !== currentUserId && now - timestamp < TYPING_TIMEOUT) {
      activeTypers.push(userId);
    }
  });

  if (activeTypers.length === 0) {
    return <div className="typing-indicator" />;
  }

  // For MVP we show userIds — ideally we'd resolve to display names
  const text = formatTypingText(activeTypers);

  return (
    <div className="typing-indicator typing-indicator-active">
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
}
