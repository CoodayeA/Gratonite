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

  return (
    <div className="pinned-panel">
      <div className="pinned-panel-header">
        <h3 className="pinned-panel-title">Pinned Messages</h3>
        <button className="pinned-panel-close" onClick={togglePinnedPanel} aria-label="Close">
          &times;
        </button>
      </div>
      <div className="pinned-panel-list">
        {isLoading && (
          <div className="pinned-panel-loading">
            <LoadingSpinner size={20} />
          </div>
        )}
        {!isLoading && (!pins || pins.length === 0) && (
          <div className="pinned-panel-empty">No pinned messages in this channel.</div>
        )}
        {pins?.map((msg: Message) => {
          const author = (msg as any).author;
          const displayName = author?.displayName ?? 'Unknown';
          const avatarHash = author?.avatarHash ?? null;
          return (
            <div key={msg.id} className="pinned-panel-item">
              <div className="pinned-panel-item-header">
                <Avatar name={displayName} hash={avatarHash} userId={msg.authorId} size={24} />
                <span className="pinned-panel-item-author">{displayName}</span>
                <span className="pinned-panel-item-time">{formatTimestamp(msg.createdAt)}</span>
              </div>
              <div className="pinned-panel-item-content">{msg.content}</div>
              <button className="pinned-panel-item-unpin" onClick={() => handleUnpin(msg.id)}>
                Unpin
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
