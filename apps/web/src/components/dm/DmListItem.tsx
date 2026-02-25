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
  const hasUnread = unreadCount != null && unreadCount > 0;
  const preview =
    lastMessage && lastMessage.length > 36
      ? lastMessage.slice(0, 36) + '\u2026'
      : lastMessage;

  return (
    <NavLink
      to={`/dm/${channelId}`}
      className={({ isActive }) =>
        `dm-list-item${isActive ? ' active' : ''}`
      }
      style={{
        cursor: 'pointer',
      }}
    >
      <Avatar
        name={recipientName}
        hash={recipientAvatar}
        userId={recipientId}
        size={36}
      />
      <div className="dm-list-item-info">
        <span
          className="dm-list-item-name"
          style={hasUnread ? { fontWeight: 700 } : undefined}
        >
          {recipientName}
        </span>
        {preview && (
          <span
            className="dm-list-item-preview"
            style={hasUnread ? { color: 'var(--text, #e8e4e0)' } : undefined}
          >
            {preview}
          </span>
        )}
      </div>
      <div className="dm-list-item-meta">
        {lastMessageAt && (
          <span
            className="dm-list-item-time"
            style={hasUnread ? { color: 'var(--accent, #d4af37)' } : undefined}
          >
            {formatRelativeTime(lastMessageAt)}
          </span>
        )}
        {hasUnread && (
          <span className="dm-list-item-unread-badge">
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
          // TODO: implement DM close/hide
        }}
        title="Close DM"
        aria-label="Close DM"
      >
        &times;
      </button>
    </NavLink>
  );
}
