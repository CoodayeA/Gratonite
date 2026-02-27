import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUnreadStore } from '@/stores/unread.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { api } from '@/lib/api';

type Relationship = { userId: string; targetId: string; type: string };
type NotificationFilter = 'all' | 'mentions' | 'reactions' | 'system';

type NotificationItem = {
  id: string;
  kind: 'request' | 'mention' | 'unread';
  title: string;
  body: string;
  meta: string;
  isUnread: boolean;
  channelId?: string;
  userId?: string;
  route?: string;
};

/* ─── Design Tokens ─── */
const T = {
  bg: 'var(--bg, #2c2c3e)',
  bgElevated: 'var(--bgElevated, #353348)',
  bgInput: 'var(--bgInput, #25243a)',
  bgSoft: 'var(--bgSoft, #413d58)',
  stroke: 'var(--stroke, #4a4660)',
  accent: 'var(--accent, #d4af37)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--textMuted, #a8a4b8)',
  textFaint: 'var(--textFaint, #6e6a80)',
  textOnGold: 'var(--textOnGold, #1a1a2e)',
} as const;

/* ─── Helpers ─── */
function readStoredNotificationFilter(): NotificationFilter {
  try {
    const saved = localStorage.getItem('notifications_filter_v1');
    if (saved && ['all', 'mentions', 'reactions', 'system'].includes(saved)) {
      return saved as NotificationFilter;
    }
  } catch {
    // ignore storage access issues
  }
  return 'all';
}

function readStoredNotificationsUiState(): {
  requestsCollapsed: boolean;
  mentionsCollapsed: boolean;
  unreadCollapsed: boolean;
} {
  try {
    const raw = localStorage.getItem('notifications_ui_state_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<'requestsCollapsed' | 'mentionsCollapsed' | 'unreadCollapsed', boolean>>;
      return {
        requestsCollapsed: Boolean(parsed.requestsCollapsed),
        mentionsCollapsed: Boolean(parsed.mentionsCollapsed),
        unreadCollapsed: Boolean(parsed.unreadCollapsed),
      };
    }
  } catch {
    // ignore malformed local state
  }
  return { requestsCollapsed: false, mentionsCollapsed: false, unreadCollapsed: false };
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#d4af37', '#a29bfe'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors[idx],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {avatarInitials(name)}
    </div>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const unreadByChannel = useUnreadStore((s) => s.unreadByChannel);
  const unreadCountByChannel = useUnreadStore((s) => s.unreadCountByChannel);
  const mentionCountByChannel = useUnreadStore((s) => s.mentionCountByChannel);
  const markRead = useUnreadStore((s) => s.markRead);
  const channels = useChannelsStore((s) => s.channels);
  const guilds = useGuildsStore((s) => s.guilds);

  const [filter, setFilter] = useState<NotificationFilter>(() => readStoredNotificationFilter());
  const [requestActionUserId, setRequestActionUserId] = useState<string | null>(null);
  const [requestActionFeedback, setRequestActionFeedback] = useState('');
  const [viewFeedback, setViewFeedback] = useState('');
  const [requestsCollapsed, setRequestsCollapsed] = useState<boolean>(() => readStoredNotificationsUiState().requestsCollapsed);
  const [mentionsCollapsed, setMentionsCollapsed] = useState<boolean>(() => readStoredNotificationsUiState().mentionsCollapsed);
  const [unreadCollapsed, setUnreadCollapsed] = useState<boolean>(() => readStoredNotificationsUiState().unreadCollapsed);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  useEffect(() => {
    try { localStorage.setItem('notifications_filter_v1', filter); } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => {
    localStorage.setItem(
      'notifications_ui_state_v1',
      JSON.stringify({ requestsCollapsed, mentionsCollapsed, unreadCollapsed }),
    );
  }, [requestsCollapsed, mentionsCollapsed, unreadCollapsed]);

  useEffect(() => {
    if (!requestActionFeedback) return;
    const timer = window.setTimeout(() => setRequestActionFeedback(''), 2400);
    return () => window.clearTimeout(timer);
  }, [requestActionFeedback]);

  useEffect(() => {
    if (!viewFeedback) return;
    const timer = window.setTimeout(() => setViewFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [viewFeedback]);

  const { data: relationships = [] } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll() as Promise<Relationship[]>,
  });

  const incomingRequests = useMemo(
    () => relationships.filter((rel) => rel.type === 'pending_incoming'),
    [relationships],
  );

  const requestUserIds = useMemo(
    () => Array.from(new Set(incomingRequests.map((rel) => rel.targetId))).filter(Boolean),
    [incomingRequests],
  );

  const { data: userSummaries = [] } = useQuery({
    queryKey: ['users', 'summaries', requestUserIds],
    queryFn: () => api.users.getSummaries(requestUserIds),
    enabled: requestUserIds.length > 0,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, { username: string; displayName: string }>();
    userSummaries.forEach((u) => map.set(u.id, { username: u.username, displayName: u.displayName }));
    return map;
  }, [userSummaries]);

  const sortedIncomingRequests = useMemo(
    () =>
      [...incomingRequests].sort((a, b) => {
        const aUser = userMap.get(a.targetId);
        const bUser = userMap.get(b.targetId);
        const aName = aUser?.displayName ?? aUser?.username ?? a.targetId;
        const bName = bUser?.displayName ?? bUser?.username ?? b.targetId;
        return String(aName).localeCompare(String(bName));
      }),
    [incomingRequests, userMap],
  );

  const unreadEntries = useMemo(
    () =>
      Array.from(unreadByChannel.values())
        .map((channelId) => ({
          channelId,
          count: unreadCountByChannel.get(channelId) ?? 1,
          mentions: mentionCountByChannel.get(channelId) ?? 0,
          channel: channels.get(channelId),
        }))
        .sort((a, b) => {
          if (b.mentions !== a.mentions) return b.mentions - a.mentions;
          if (b.count !== a.count) return b.count - a.count;
          const aName = a.channel?.name ?? a.channelId;
          const bName = b.channel?.name ?? b.channelId;
          return String(aName).localeCompare(String(bName));
        }),
    [unreadByChannel, unreadCountByChannel, mentionCountByChannel, channels],
  );

  const mentionEntries = unreadEntries.filter((entry) => entry.mentions > 0);
  const totalUnreadCount = unreadEntries.reduce((sum, item) => sum + item.count, 0);
  const totalMentionCount = mentionEntries.reduce((sum, item) => sum + item.mentions, 0);
  const totalBadgeCount = incomingRequests.length + totalMentionCount + totalUnreadCount;

  /* ─── Build flat notification list for left panel ─── */
  const allNotifications = useMemo((): NotificationItem[] => {
    const items: NotificationItem[] = [];

    sortedIncomingRequests.forEach((rel) => {
      const user = userMap.get(rel.targetId);
      const name = user?.displayName ?? user?.username ?? rel.targetId;
      items.push({
        id: `request:${rel.targetId}`,
        kind: 'request',
        title: name,
        body: 'sent you a friend request',
        meta: user?.username ? `@${user.username}` : rel.targetId,
        isUnread: true,
        userId: rel.targetId,
        route: '/#dms',
      });
    });

    mentionEntries.forEach(({ channelId, mentions, channel }) => {
      const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
      const title = channel?.name
        ? isDm ? channel.name : `#${channel.name}`
        : isDm ? 'Direct Message' : 'Channel Activity';
      const guildName = channel?.guildId ? guilds.get(channel.guildId)?.name : undefined;
      const body = `${mentions} mention${mentions === 1 ? '' : 's'} in this conversation`;
      const meta = isDm ? 'Direct message' : guildName ? `${guildName}` : 'Channel';
      const route = channel?.guildId
        ? `/guild/${channel.guildId}/channel/${channelId}`
        : `/dm/${channelId}`;
      items.push({
        id: `mention:${channelId}`,
        kind: 'mention',
        title,
        body,
        meta,
        isUnread: true,
        channelId,
        route,
      });
    });

    unreadEntries
      .filter((e) => e.mentions === 0)
      .forEach(({ channelId, count, channel }) => {
        const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
        const title = channel?.name
          ? isDm ? channel.name : `#${channel.name}`
          : isDm ? 'Direct Message' : 'Channel Activity';
        const guildName = channel?.guildId ? guilds.get(channel.guildId)?.name : undefined;
        const body = `${count} unread message${count === 1 ? '' : 's'}`;
        const meta = isDm ? 'Direct message' : guildName ? `${guildName}` : 'Channel';
        const route = channel?.guildId
          ? `/guild/${channel.guildId}/channel/${channelId}`
          : `/dm/${channelId}`;
        items.push({
          id: `unread:${channelId}`,
          kind: 'unread',
          title,
          body,
          meta,
          isUnread: true,
          channelId,
          route,
        });
      });

    return items;
  }, [sortedIncomingRequests, userMap, mentionEntries, unreadEntries, guilds]);

  const visibleNotifications = useMemo(() => {
    if (filter === 'all') return allNotifications;
    if (filter === 'mentions') return allNotifications.filter((n) => n.kind === 'mention');
    if (filter === 'reactions') return allNotifications.filter((n) => n.kind === 'unread');
    if (filter === 'system') return allNotifications.filter((n) => n.kind === 'request');
    return allNotifications;
  }, [filter, allNotifications]);

  /* ─── Actions ─── */
  async function handleAcceptRequest(userId: string) {
    setRequestActionUserId(userId);
    setRequestActionFeedback('');
    try {
      await api.relationships.acceptFriendRequest(userId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] }),
      ]);
      setRequestActionFeedback('Friend request accepted.');
    } finally {
      setRequestActionUserId(null);
    }
  }

  async function handleIgnoreRequest(userId: string) {
    setRequestActionUserId(userId);
    setRequestActionFeedback('');
    try {
      await api.relationships.removeFriend(userId);
      await queryClient.invalidateQueries({ queryKey: ['relationships'] });
      setRequestActionFeedback('Friend request ignored.');
    } finally {
      setRequestActionUserId(null);
    }
  }

  function clearMentionNotifications() {
    if (mentionEntries.length === 0) return;
    mentionEntries.forEach((entry) => markRead(entry.channelId));
    setViewFeedback(`Cleared ${mentionEntries.length} mention conversation${mentionEntries.length === 1 ? '' : 's'}.`);
  }

  function clearUnreadNotifications() {
    if (unreadEntries.length === 0) return;
    unreadEntries.forEach((entry) => markRead(entry.channelId));
    setViewFeedback(`Cleared ${unreadEntries.length} unread conversation${unreadEntries.length === 1 ? '' : 's'}.`);
  }

  function dismissChannelNotification(channelId: string) {
    markRead(channelId);
    setViewFeedback('Notification dismissed.');
    if (selectedItem?.channelId === channelId) setSelectedItem(null);
  }

  function openNotificationConversation(channelId: string) {
    markRead(channelId);
  }

  function clearAllVisible() {
    mentionEntries.forEach((entry) => markRead(entry.channelId));
    unreadEntries.forEach((entry) => markRead(entry.channelId));
    setSelectedItem(null);
    setViewFeedback('All notifications cleared.');
  }

  function expandAllSections() {
    setRequestsCollapsed(false);
    setMentionsCollapsed(false);
    setUnreadCollapsed(false);
  }

  /* ─── Group labels for the list ─── */
  const requestItems = visibleNotifications.filter((n) => n.kind === 'request');
  const mentionItems = visibleNotifications.filter((n) => n.kind === 'mention');
  const unreadItems = visibleNotifications.filter((n) => n.kind === 'unread');

  /* ─── Derived detail state ─── */
  const detailTimestamp = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  /* ─── Inline group section ─── */
  function GroupSection({
    label,
    items,
    collapsed,
    onToggle,
  }: {
    label: string;
    items: NotificationItem[];
    collapsed: boolean;
    onToggle: () => void;
  }) {
    if (items.length === 0) return null;
    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 4px',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: T.textFaint,
            }}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              color: T.textFaint,
              fontSize: 11,
              cursor: 'pointer',
              padding: '0 2px',
            }}
          >
            {collapsed ? '+' : '−'}
          </button>
        </div>
        {!collapsed && items.map((item) => (
          <NotifRow
            key={item.id}
            item={item}
            isSelected={selectedItem?.id === item.id}
            onSelect={() => setSelectedItem(item)}
          />
        ))}
        <div style={{ height: 1, background: T.stroke, margin: '4px 0' }} />
      </>
    );
  }

  function NotifRow({
    item,
    isSelected,
    onSelect,
  }: {
    item: NotificationItem;
    isSelected: boolean;
    onSelect: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '9px 16px',
          background: isSelected
            ? 'rgba(212,175,55,0.12)'
            : item.isUnread
            ? 'rgba(212,175,55,0.04)'
            : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
      >
        {/* unread dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.isUnread ? T.accent : 'transparent',
            flexShrink: 0,
          }}
        />
        <Avatar name={item.title} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.textMuted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 1,
            }}
          >
            {item.body}
          </div>
        </div>
      </button>
    );
  }

  /* ─── Right panel detail ─── */
  function DetailPanel() {
    if (!selectedItem) {
      return (
        <div
          style={{
            flex: 1,
            background: T.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textFaint,
            fontSize: 14,
            gap: 8,
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.3 }}>🔔</div>
          <div>Select a notification to view details</div>
        </div>
      );
    }

    const isWorking = selectedItem.kind === 'request' && requestActionUserId === selectedItem.userId;

    return (
      <div
        style={{
          flex: 1,
          background: T.bg,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Right header */}
        <div
          style={{
            padding: '0 20px',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            Notification Detail
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedItem.kind !== 'request' && selectedItem.channelId && (
              <button
                type="button"
                style={{
                  border: `1px solid ${T.stroke}`,
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: T.textMuted,
                  fontSize: 12,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (selectedItem.channelId) dismissChannelNotification(selectedItem.channelId);
                }}
              >
                Mark read
              </button>
            )}
            <button
              type="button"
              style={{
                border: `1px solid ${T.stroke}`,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: T.textMuted,
                fontSize: 12,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedItem(null)}
            >
              Delete
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.stroke, flexShrink: 0 }} />

        {/* Detail card area */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <div
            style={{
              borderRadius: 10,
              background: T.bgElevated,
              border: `1px solid ${T.stroke}`,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Avatar + name + timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={selectedItem.title} size={44} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                  {selectedItem.title}
                </div>
                <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
                  {selectedItem.meta} · {detailTimestamp}
                </div>
              </div>
            </div>

            {/* Message body */}
            <div
              style={{
                fontSize: 14,
                color: T.textMuted,
                lineHeight: 1.55,
              }}
            >
              {selectedItem.kind === 'request'
                ? `${selectedItem.title} wants to connect with you. Accept to start chatting.`
                : selectedItem.body}
            </div>

            {/* Actions */}
            {selectedItem.kind === 'request' && selectedItem.userId ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => handleAcceptRequest(selectedItem.userId!)}
                  style={{
                    background: T.accent,
                    color: T.textOnGold,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isWorking ? 'not-allowed' : 'pointer',
                    opacity: isWorking ? 0.6 : 1,
                  }}
                >
                  {isWorking ? 'Working...' : 'Accept'}
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => handleIgnoreRequest(selectedItem.userId!)}
                  style={{
                    background: 'transparent',
                    color: T.textMuted,
                    border: `1px solid ${T.stroke}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 16px',
                    fontSize: 13,
                    cursor: isWorking ? 'not-allowed' : 'pointer',
                    opacity: isWorking ? 0.6 : 1,
                  }}
                >
                  Ignore
                </button>
              </div>
            ) : selectedItem.route ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link
                  to={selectedItem.route}
                  onClick={() => {
                    if (selectedItem.channelId) openNotificationConversation(selectedItem.channelId);
                  }}
                  style={{
                    background: T.accent,
                    color: T.textOnGold,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Reply
                </Link>
              </div>
            ) : null}

            {(requestActionFeedback || viewFeedback) && (
              <div
                role="status"
                aria-live="polite"
                style={{ fontSize: 12, color: T.accent, fontWeight: 500 }}
              >
                {requestActionFeedback || viewFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Tab config ─── */
  const tabs: { id: NotificationFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: totalBadgeCount },
    { id: 'mentions', label: 'Mentions', count: totalMentionCount },
    { id: 'reactions', label: 'Reactions', count: unreadEntries.filter((e) => e.mentions === 0).length },
    { id: 'system', label: 'System', count: incomingRequests.length },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        background: T.bg,
        color: T.text,
        overflow: 'hidden',
      }}
    >
      {/* ─── LEFT PANEL ─── */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          background: T.bgElevated,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: `1px solid ${T.stroke}`,
        }}
      >
        {/* Left header */}
        <div
          style={{
            padding: '0 16px',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              Notifications
            </span>
            {totalBadgeCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(212,175,55,0.18)',
                  color: T.accent,
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 7px',
                  minWidth: 20,
                  textAlign: 'center',
                }}
              >
                {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={clearAllVisible}
              style={{
                background: 'none',
                border: `1px solid ${T.stroke}`,
                borderRadius: 'var(--radius-sm)',
                color: T.textMuted,
                fontSize: 12,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={expandAllSections}
              style={{
                background: 'none',
                border: `1px solid ${T.stroke}`,
                borderRadius: 'var(--radius-sm)',
                color: T.textMuted,
                fontSize: 12,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
            >
              Expand
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '0 12px 10px',
            flexShrink: 0,
          }}
        >
          {tabs.map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 4px',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(212,175,55,0.13)' : 'transparent',
                  color: isActive ? T.accent : T.textMuted,
                  transition: 'background 0.12s, color 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.stroke, flexShrink: 0 }} />

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleNotifications.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                fontSize: 13,
                color: T.textMuted,
                textAlign: 'center',
              }}
            >
              No notifications to show.
            </div>
          ) : (
            <>
              {(filter === 'all' || filter === 'system') && requestItems.length > 0 && (
                <GroupSection
                  label="Friend Requests"
                  items={requestItems}
                  collapsed={requestsCollapsed}
                  onToggle={() => setRequestsCollapsed((v) => !v)}
                />
              )}
              {(filter === 'all' || filter === 'mentions') && mentionItems.length > 0 && (
                <GroupSection
                  label="Mentions"
                  items={mentionItems}
                  collapsed={mentionsCollapsed}
                  onToggle={() => setMentionsCollapsed((v) => !v)}
                />
              )}
              {(filter === 'all' || filter === 'reactions') && unreadItems.length > 0 && (
                <GroupSection
                  label="Unread"
                  items={unreadItems}
                  collapsed={unreadCollapsed}
                  onToggle={() => setUnreadCollapsed((v) => !v)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <DetailPanel />
    </div>
  );
}
