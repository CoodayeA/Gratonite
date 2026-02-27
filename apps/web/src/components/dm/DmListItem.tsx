import React, { useState } from 'react';
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

const styles = {
  link: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    gap: 10,
    position: 'relative',
    textDecoration: 'none',
    color: 'var(--text-muted, #a8a4b8)',
    transition: 'background 0.15s ease, color 0.15s ease',
    margin: '1px 0',
    cursor: 'pointer',
  } as React.CSSProperties,
  linkHover: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    gap: 10,
    position: 'relative',
    textDecoration: 'none',
    color: 'var(--text, #e8e4e0)',
    transition: 'background 0.15s ease, color 0.15s ease',
    margin: '1px 0',
    cursor: 'pointer',
    background: 'var(--bg-soft, #413d58)',
  } as React.CSSProperties,
  info: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    gap: 2,
  } as React.CSSProperties,
  name: {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--text, #e8e4e0)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
  } as React.CSSProperties,
  preview: {
    fontSize: 12,
    color: 'var(--text-muted, #a8a4b8)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  } as React.CSSProperties,
  time: {
    fontSize: 10.5,
    color: 'var(--text-faint, #6e6a80)',
    fontWeight: 500,
  } as React.CSSProperties,
  unreadBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent, #d4af37)',
    color: 'var(--text-on-gold, #1a1a2e)',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
  } as React.CSSProperties,
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    opacity: 0,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #a8a4b8)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease, color 0.15s ease',
    lineHeight: 1,
  } as React.CSSProperties,
  closeBtnVisible: {
    position: 'absolute',
    top: 4,
    right: 4,
    opacity: 0.6,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #a8a4b8)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease, color 0.15s ease',
    lineHeight: 1,
  } as React.CSSProperties,
  closeBtnHover: {
    position: 'absolute',
    top: 4,
    right: 4,
    opacity: 1,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: 'var(--text, #e8e4e0)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease, color 0.15s ease',
    lineHeight: 1,
  } as React.CSSProperties,
} as const;

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

  const [hovered, setHovered] = useState(false);
  const [closeBtnHover, setCloseBtnHover] = useState(false);

  return (
    <NavLink
      to={`/dm/${channelId}`}
      style={({ isActive }) => ({
        ...(hovered ? styles.linkHover : styles.link),
        ...(isActive ? {
          background: 'var(--bg-soft, #413d58)',
          color: 'var(--text, #e8e4e0)',
          borderLeft: '2px solid var(--accent, #d4af37)',
          paddingLeft: 10,
        } : {}),
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCloseBtnHover(false); }}
    >
      <Avatar
        name={recipientName}
        hash={recipientAvatar}
        userId={recipientId}
        size={36}
      />
      <div style={styles.info}>
        <span
          style={{
            ...styles.name,
            ...(hasUnread ? { fontWeight: 700 } : {}),
          }}
        >
          {recipientName}
        </span>
        {preview && (
          <span
            style={{
              ...styles.preview,
              ...(hasUnread ? { color: 'var(--text, #e8e4e0)' } : {}),
            }}
          >
            {preview}
          </span>
        )}
      </div>
      <div style={styles.meta}>
        {lastMessageAt && (
          <span
            style={{
              ...styles.time,
              ...(hasUnread ? { color: 'var(--accent, #d4af37)' } : {}),
            }}
          >
            {formatRelativeTime(lastMessageAt)}
          </span>
        )}
        {hasUnread && (
          <span style={styles.unreadBadge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      <button
        type="button"
        style={
          closeBtnHover
            ? styles.closeBtnHover
            : hovered
              ? styles.closeBtnVisible
              : styles.closeBtn
        }
        onMouseEnter={() => setCloseBtnHover(true)}
        onMouseLeave={() => setCloseBtnHover(false)}
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
