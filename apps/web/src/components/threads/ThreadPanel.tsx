import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useThreads } from '@/hooks/useThreads';
import { useUiStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { api } from '@/lib/api';
import type { Thread } from '@gratonite/types';

interface ThreadPanelProps {
  channelId: string;
}

export function ThreadPanel({ channelId }: ThreadPanelProps) {
  const { data: threads = [], isLoading } = useThreads(channelId);
  const activeThreadId = useUiStore((s) => s.activeThreadId);
  const closeThreadPanel = useUiStore((s) => s.closeThreadPanel);
  const showThreadList = useUiStore((s) => s.showThreadList);
  const openThread = useUiStore((s) => s.openThread);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);

  const [emojiTarget, setEmojiTarget] = useState<{ messageId: string; x?: number; y?: number } | null>(null);

  const activeThreadFromList = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [threads, activeThreadId],
  );

  const { data: activeThread } = useQuery({
    queryKey: ['thread', activeThreadId],
    queryFn: () => api.threads.get(activeThreadId!),
    enabled: !!activeThreadId && !activeThreadFromList,
  });

  const thread = activeThreadFromList ?? activeThread;

  const handleReply = useCallback((msg: any) => {
    if (activeThreadId) setReplyingTo(activeThreadId, msg);
  }, [activeThreadId, setReplyingTo]);

  const handleOpenEmojiPicker = useCallback((messageId: string, coords?: { x: number; y: number }) => {
    setEmojiTarget({ messageId, x: coords?.x, y: coords?.y });
  }, []);

  function handleOpenThread(threadId: string) {
    api.threads.join(threadId).catch(() => undefined);
    openThread(threadId);
  }

  return (
    <aside className="thread-panel">
      <div className="thread-panel-header">
        <div>
          <h3 className="thread-panel-title">{thread ? thread.name : 'Threads'}</h3>
          {thread && (
            <span className="thread-panel-subtitle">{thread.memberCount} members</span>
          )}
        </div>
        <div className="thread-panel-actions">
          {thread && (
            <button className="thread-panel-back" onClick={showThreadList} title="Back to thread list">
              Back
            </button>
          )}
          <button className="thread-panel-close" onClick={closeThreadPanel} aria-label="Close">
            &times;
          </button>
        </div>
      </div>
      <div className="thread-panel-body">
        {!activeThreadId && (
          <div className="thread-list">
            {isLoading && (
              <div className="thread-list-loading">
                <LoadingSpinner size={20} />
              </div>
            )}
            {!isLoading && threads.length === 0 && (
              <div className="thread-list-empty">No active threads yet.</div>
            )}
            {threads.map((t: Thread) => (
              <button key={t.id} className="thread-list-item" onClick={() => handleOpenThread(t.id)}>
                <div className="thread-list-item-name">{t.name}</div>
                <div className="thread-list-item-meta">
                  {t.messageCount} messages - {t.memberCount} members
                </div>
              </button>
            ))}
          </div>
        )}
        {activeThreadId && (
          <div className="thread-panel-chat">
            <MessageList
              channelId={activeThreadId}
              emptyTitle="No thread messages yet"
              emptySubtitle="Start the thread by sending a message."
              onReply={handleReply}
              onOpenEmojiPicker={handleOpenEmojiPicker}
            />
            <MessageComposer
              channelId={activeThreadId}
              placeholder={`Message #${thread?.name ?? 'thread'}`}
            />
            {emojiTarget && (
              <EmojiPicker
                onSelect={(emoji) => {
                  api.messages.addReaction(activeThreadId, emojiTarget.messageId, emoji).catch(console.error);
                  setEmojiTarget(null);
                }}
                onClose={() => setEmojiTarget(null)}
                x={emojiTarget.x}
                y={emojiTarget.y}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
