import { NavLink } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';

interface DmListItemProps {
  channelId: string;
  recipientName: string;
  recipientAvatar: string | null;
  recipientId: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  channelType: number | string;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d`;

  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

export function DmListItem({
  channelId,
  recipientName,
  recipientAvatar,
  recipientId,
  lastMessage,
  lastMessageAt,
  unreadCount,
}: DmListItemProps) {
  const preview =
    lastMessage && lastMessage.length > 40
      ? lastMessage.slice(0, 40) + '...'
      : lastMessage;

  return (
    <NavLink
      to={`/dm/${channelId}`}
      className={({ isActive }) =>
        `dm-list-item${isActive ? ' active' : ''}`
      }
    >
      <Avatar
        name={recipientName}
        hash={recipientAvatar}
        userId={recipientId}
        size={32}
      />
      <div className="dm-list-item-info">
        <span className="dm-list-item-name">{recipientName}</span>
        {preview && (
          <span className="dm-list-item-preview">{preview}</span>
        )}
      </div>
      <div className="dm-list-item-meta">
        {lastMessageAt && (
          <span className="dm-list-item-time">
            {formatRelativeTime(lastMessageAt)}
          </span>
        )}
        {unreadCount != null && unreadCount > 0 && (
          <span className="channel-unread-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      <button
        type="button"
        className="dm-list-item-close"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('close DM', channelId);
        }}
        title="Close DM"
        aria-label="Close DM"
      >
        &times;
      </button>
    </NavLink>
  );
}
