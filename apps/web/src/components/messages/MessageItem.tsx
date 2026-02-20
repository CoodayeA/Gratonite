import type { Message } from '@gratonite/types';
import { Avatar } from '@/components/ui/Avatar';
import { formatTimestamp, formatShortTimestamp } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
}

export function MessageItem({ message, isGrouped }: MessageItemProps) {
  const author = (message as Message & { author?: { displayName: string; avatarHash: string | null } }).author;
  const displayName = author?.displayName ?? 'Unknown';
  const avatarHash = author?.avatarHash ?? null;

  if (isGrouped) {
    return (
      <div className="message-item message-item-grouped">
        <span className="message-timestamp-inline">{formatShortTimestamp(message.createdAt)}</span>
        <div className="message-content">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-item">
      <Avatar
        name={displayName}
        hash={avatarHash}
        userId={message.authorId}
        size={40}
        className="message-avatar"
      />
      <div className="message-body">
        <div className="message-header">
          <span className="message-author">{displayName}</span>
          <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
          {message.editedAt && <span className="message-edited">(edited)</span>}
        </div>
        <div className="message-content">{message.content}</div>
      </div>
    </div>
  );
}
