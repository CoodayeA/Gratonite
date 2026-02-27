import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useUiStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatTimestamp } from '@/lib/utils';
import type { Message } from '@gratonite/types';

interface PinnedMessagesPanelProps {
  channelId: string;
}

const styles = {
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
    padding: '16px 20px',
    borderBottom: '1px solid #4a4660',
    flexShrink: 0,
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
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
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
  item: {
    background: '#2c2c3e',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  itemAuthor: {
    color: '#d4af37',
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  itemTime: {
    color: '#6e6a80',
    fontSize: 12,
    marginLeft: 'auto',
  } as React.CSSProperties,
  itemContent: {
    color: '#e8e4e0',
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  } as React.CSSProperties,
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  jumpBtn: {
    background: 'none',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  } as React.CSSProperties,
  unpinBtn: {
    background: 'none',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  } as React.CSSProperties,
};

export function PinnedMessagesPanel({ channelId }: PinnedMessagesPanelProps) {
  const togglePinnedPanel = useUiStore((s) => s.togglePinnedPanel);
  const { data: pins, isLoading, refetch } = usePinnedMessages(channelId);
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  async function handleUnpin(messageId: string) {
    try {
      await api.messages.unpin(channelId, messageId);
      updateMessage(channelId, messageId, { pinned: false });
      refetch();
    } catch (err) {
      console.error('[Pins] Failed to unpin:', err);
    }
  }

  const pinCount = pins?.length ?? 0;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Pinned Messages</h3>
          {pinCount > 0 && (
            <span style={styles.countBadge}>{pinCount}</span>
          )}
        </div>
        <button
          style={styles.closeBtn}
          onClick={togglePinnedPanel}
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
      <div style={styles.list}>
        {isLoading && (
          <div style={styles.loading}>
            <LoadingSpinner size={20} />
          </div>
        )}
        {!isLoading && (!pins || pins.length === 0) && (
          <div style={styles.empty}>No pinned messages in this channel.</div>
        )}
        {pins?.map((msg: Message) => {
          const author = (msg as any).author;
          const displayName = author?.displayName ?? 'Unknown';
          const avatarHash = author?.avatarHash ?? null;
          return (
            <div key={msg.id} style={styles.item}>
              <div style={styles.itemTop}>
                <Avatar name={displayName} hash={avatarHash} userId={msg.authorId} size={28} />
                <span style={styles.itemAuthor}>{displayName}</span>
                <span style={styles.itemTime}>{formatTimestamp(msg.createdAt)}</span>
              </div>
              <div style={styles.itemContent}>{msg.content}</div>
              <div style={styles.itemActions}>
                <button
                  style={styles.jumpBtn}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#d4af37';
                    e.currentTarget.style.color = '#d4af37';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#4a4660';
                    e.currentTarget.style.color = '#a8a4b8';
                  }}
                >
                  Jump
                </button>
                <button
                  style={styles.unpinBtn}
                  onClick={() => handleUnpin(msg.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#f04747';
                    e.currentTarget.style.color = '#f04747';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#4a4660';
                    e.currentTarget.style.color = '#a8a4b8';
                  }}
                >
                  Unpin
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
