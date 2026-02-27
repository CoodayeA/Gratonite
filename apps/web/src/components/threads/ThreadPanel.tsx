import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useThreads } from '@/hooks/useThreads';
import { useUiStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useChannelsStore } from '@/stores/channels.store';
import { api } from '@/lib/api';
import type { Thread } from '@gratonite/types';

interface ThreadPanelProps {
  channelId: string;
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#353348',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid #4a4660',
    flexShrink: 0,
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 7px',
    borderRadius: 'var(--radius-lg)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 12,
    color: '#6e6a80',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  backBtn: {
    background: 'none',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    fontSize: 13,
    fontWeight: 500,
    padding: '5px 14px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  } as React.CSSProperties,
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#a8a4b8',
    fontSize: 22,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    transition: 'color 0.15s, background 0.15s',
  } as React.CSSProperties,
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  } as React.CSSProperties,
  threadList: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: 32,
  } as React.CSSProperties,
  empty: {
    color: '#6e6a80',
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
  } as React.CSSProperties,
  threadItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#2c2c3e',
    border: '1px solid transparent',
    borderRadius: 10,
    padding: '12px 16px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'border-color 0.15s, background 0.15s',
    color: 'inherit',
  } as React.CSSProperties,
  threadItemName: {
    color: '#e8e4e0',
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  threadItemMeta: {
    color: '#6e6a80',
    fontSize: 12,
  } as React.CSSProperties,
  chat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
};

export function ThreadPanel({ channelId }: ThreadPanelProps) {
  const { data: threads = [], isLoading } = useThreads(channelId);
  const activeThreadId = useUiStore((s) => s.activeThreadId);
  const closeThreadPanel = useUiStore((s) => s.closeThreadPanel);
  const showThreadList = useUiStore((s) => s.showThreadList);
  const openThread = useUiStore((s) => s.openThread);
  const openModal = useUiStore((s) => s.openModal);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const parentChannel = useChannelsStore((s) => s.channels.get(channelId));

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
    <aside style={s.panel}>
      <div style={s.header}>
        <div style={s.headerLeft as React.CSSProperties}>
          <h3 style={s.title}>
            {thread ? thread.name : 'Threads'}
            {!thread && threads.length > 0 && (
              <span style={s.countBadge}>{threads.length}</span>
            )}
          </h3>
          {thread && (
            <span style={s.subtitle}>{thread.memberCount} members</span>
          )}
        </div>
        <div style={s.actions}>
          {thread && (
            <button
              style={s.backBtn}
              onClick={showThreadList}
              title="Back to thread list"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#d4af37';
                e.currentTarget.style.color = '#d4af37';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#4a4660';
                e.currentTarget.style.color = '#a8a4b8';
              }}
            >
              Back
            </button>
          )}
          <button
            style={s.closeBtn}
            onClick={closeThreadPanel}
            aria-label="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#e8e4e0';
              e.currentTarget.style.background = '#413d58';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a8a4b8';
              e.currentTarget.style.background = 'none';
            }}
          >
            &times;
          </button>
        </div>
      </div>
      <div style={s.body}>
        {!activeThreadId && (
          <div style={s.threadList as React.CSSProperties}>
            {isLoading && (
              <div style={s.loading}>
                <LoadingSpinner size={20} />
              </div>
            )}
            {!isLoading && threads.length === 0 && (
              <div style={s.empty}>No active threads yet.</div>
            )}
            {threads.map((t: Thread) => (
              <button
                key={t.id}
                style={s.threadItem as React.CSSProperties}
                onClick={() => handleOpenThread(t.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d4af37';
                  e.currentTarget.style.background = '#413d58';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.background = '#2c2c3e';
                }}
              >
                <div style={s.threadItemName}>{t.name}</div>
                <div style={s.threadItemMeta}>
                  {t.messageCount} messages &middot; {t.memberCount} members
                </div>
              </button>
            ))}
          </div>
        )}
        {activeThreadId && (
          <div style={s.chat as React.CSSProperties}>
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
                onAddEmoji={
                  parentChannel?.guildId
                    ? () => openModal('emoji-studio', { guildId: parentChannel.guildId })
                    : undefined
                }
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
