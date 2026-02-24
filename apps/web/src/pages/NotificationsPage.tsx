import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUnreadStore } from '@/stores/unread.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { api } from '@/lib/api';

type Relationship = { userId: string; targetId: string; type: string };
type NotificationFilter = 'all' | 'unread' | 'mentions' | 'requests';

function readStoredNotificationFilter(): NotificationFilter {
  try {
    const saved = localStorage.getItem('notifications_filter_v1');
    if (saved && ['all', 'unread', 'mentions', 'requests'].includes(saved)) {
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
  return {
    requestsCollapsed: false,
    mentionsCollapsed: false,
    unreadCollapsed: false,
  };
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

  useEffect(() => {
    try {
      localStorage.setItem('notifications_filter_v1', filter);
    } catch {
      // ignore storage access issues
    }
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
  const showUnread = filter === 'all' || filter === 'unread';
  const showMentions = filter === 'all' || filter === 'mentions';
  const showRequests = filter === 'all' || filter === 'requests';

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
  }

  function openNotificationConversation(channelId: string) {
    markRead(channelId);
  }

  function resetNotificationsView() {
    setFilter('all');
    setRequestsCollapsed(false);
    setMentionsCollapsed(false);
    setUnreadCollapsed(false);
    try {
      localStorage.removeItem('notifications_filter_v1');
      localStorage.removeItem('notifications_ui_state_v1');
    } catch {
      // ignore storage access issues
    }
    setViewFeedback('Notification view reset.');
  }

  function collapseAllSections() {
    setRequestsCollapsed(true);
    setMentionsCollapsed(true);
    setUnreadCollapsed(true);
  }

  function expandAllSections() {
    setRequestsCollapsed(false);
    setMentionsCollapsed(false);
    setUnreadCollapsed(false);
  }

  function clearVisibleNotifications() {
    const shouldClearMentions = filter === 'all' || filter === 'mentions';
    const shouldClearUnread = filter === 'all' || filter === 'unread';
    let cleared = 0;
    if (shouldClearMentions) {
      cleared += mentionEntries.length;
      mentionEntries.forEach((entry) => markRead(entry.channelId));
    }
    if (shouldClearUnread) {
      const mentionIds = new Set(mentionEntries.map((e) => e.channelId));
      const unreadOnly = unreadEntries.filter((e) => !mentionIds.has(e.channelId));
      cleared += shouldClearMentions ? unreadOnly.length : unreadEntries.length;
      (shouldClearMentions ? unreadOnly : unreadEntries).forEach((entry) => markRead(entry.channelId));
    }
    if (cleared > 0) {
      setViewFeedback(`Cleared ${cleared} visible notification${cleared === 1 ? '' : 's'}.`);
    }
  }

  const allSectionsCollapsed = requestsCollapsed && mentionsCollapsed && unreadCollapsed;
  const anySectionCollapsed = requestsCollapsed || mentionsCollapsed || unreadCollapsed;
  const activeFilterLabel =
    filter === 'all' ? 'All activity'
      : filter === 'unread' ? 'Unread only'
      : filter === 'mentions' ? 'Mentions only'
      : 'Friend requests only';

  const requestCountLabel = incomingRequests.length === 1 ? '1 request' : `${incomingRequests.length} requests`;
  const mentionCountLabel = totalMentionCount === 1 ? '1 mention' : `${totalMentionCount} mentions`;
  const unreadCountLabel = totalUnreadCount === 1 ? '1 unread' : `${totalUnreadCount} unread`;

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-eyebrow">Notifications</div>
        <h1 className="notifications-title">Mentions and Activity</h1>
        <p className="notifications-subtitle">
          Unread conversation activity and incoming friend requests are shown here. Mention-specific filtering will expand as the notification event feed grows.
        </p>
      </header>

      <section className="notifications-panel">
        <div className="discover-inline-meta notifications-filter-row">
          <button
            type="button"
            className={`discover-tag ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`discover-tag ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread <span className="notifications-filter-count">{totalUnreadCount}</span>
          </button>
          <button
            type="button"
            className={`discover-tag ${filter === 'mentions' ? 'active' : ''}`}
            onClick={() => setFilter('mentions')}
          >
            Mentions <span className="notifications-filter-count">{totalMentionCount}</span>
          </button>
          <button
            type="button"
            className={`discover-tag ${filter === 'requests' ? 'active' : ''}`}
            onClick={() => setFilter('requests')}
          >
            Friend Requests <span className="notifications-filter-count">{incomingRequests.length}</span>
          </button>
        </div>
        <div className="notifications-inline-actions" style={{ marginTop: 8 }}>
          {(filter === 'all' || filter === 'unread' || filter === 'mentions') && (
            <button
              type="button"
              className="notifications-request-btn"
              onClick={clearVisibleNotifications}
              disabled={filter === 'mentions' ? mentionEntries.length === 0 : unreadEntries.length === 0}
            >
              Clear visible
            </button>
          )}
          {anySectionCollapsed ? (
            <button type="button" className="notifications-request-btn" onClick={expandAllSections}>
              Expand all
            </button>
          ) : (
            <button type="button" className="notifications-request-btn" onClick={collapseAllSections}>
              Collapse all
            </button>
          )}
          <button type="button" className="notifications-request-btn" onClick={resetNotificationsView}>
            Reset view
          </button>
        </div>
        {(requestActionFeedback || viewFeedback) && (
          <div className="notifications-feedback" style={{ marginTop: 8 }} role="status" aria-live="polite">
            {requestActionFeedback || viewFeedback}
          </div>
        )}
        <div className="notifications-inline-meta" style={{ marginTop: 8 }}>
          <span className="notifications-section-meta">Showing: {activeFilterLabel}</span>
          {allSectionsCollapsed && <span className="notifications-section-meta">All sections collapsed</span>}
        </div>
      </section>

      {showRequests && (
      <section className="notifications-panel">
        <div className="notifications-section-head">
          <div className="notifications-section-title">Incoming Friend Requests</div>
          <div className="notifications-badge-group">
            <button type="button" className="notifications-request-btn" onClick={() => setRequestsCollapsed((v) => !v)}>
              {requestsCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <div className="notifications-section-meta">{requestCountLabel}</div>
          </div>
        </div>
        {!requestsCollapsed && incomingRequests.length === 0 ? (
          <div className="notifications-empty">
            <div>No incoming friend requests right now.</div>
            <div className="notifications-item-meta">
              {filter === 'requests' ? 'Try the All filter to see unread conversation activity too.' : 'Requests will appear here with quick actions.'}
            </div>
          </div>
        ) : !requestsCollapsed ? (
          <div className="notifications-list">
            {sortedIncomingRequests.map((rel) => {
              const user = userMap.get(rel.targetId);
              const isWorking = requestActionUserId === rel.targetId;
              return (
                <div key={`request:${rel.targetId}`} className="notifications-item">
                  <div>
                    <div className="notifications-item-title">
                      {user?.displayName ?? user?.username ?? rel.targetId}
                    </div>
                    <div className="notifications-item-meta">
                      Incoming friend request • {user?.username ? `@${user.username}` : rel.targetId}
                    </div>
                  </div>
                  <div className="notifications-request-actions">
                    <button
                      type="button"
                      className="notifications-request-btn accept"
                      onClick={() => handleAcceptRequest(rel.targetId)}
                      disabled={isWorking}
                    >
                      {isWorking ? 'Working...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="notifications-request-btn"
                      onClick={() => handleIgnoreRequest(rel.targetId)}
                      disabled={isWorking}
                    >
                      Ignore
                    </button>
                    <Link to="/#dms" className="shop-link">Open DMs</Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      )}

      {showMentions && (
      <section className="notifications-panel">
        <div className="notifications-section-head">
          <div className="notifications-section-title">Mentions</div>
          <div className="notifications-badge-group">
            {mentionEntries.length > 0 && (
              <button type="button" className="notifications-request-btn" onClick={clearMentionNotifications}>
                Clear mentions
              </button>
            )}
            <button type="button" className="notifications-request-btn" onClick={() => setMentionsCollapsed((v) => !v)}>
              {mentionsCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <div className="notifications-section-meta">{mentionCountLabel}</div>
          </div>
        </div>
        {!mentionsCollapsed && mentionEntries.length === 0 ? (
          <div className="notifications-empty">
            <div>No unread mentions right now.</div>
            <div className="notifications-item-meta">
              {filter === 'mentions' ? 'Mentions from portal channels and DMs will appear here.' : 'Mentions will appear here when conversations call you out.'}
            </div>
          </div>
        ) : !mentionsCollapsed ? (
          <div className="notifications-list">
            {mentionEntries.map(({ channelId, count, mentions, channel }) => {
              const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
              const route = channel?.guildId ? `/guild/${channel.guildId}/channel/${channelId}` : `/dm/${channelId}`;
              const title = channel?.name
                ? (isDm ? channel.name : `#${channel.name}`)
                : (isDm ? 'Direct Message' : 'Channel Activity');
              const routeLabel = isDm ? 'Open DM' : 'Open Channel';
              const meta = isDm
                ? `DM • ${mentions} mention${mentions === 1 ? '' : 's'}`
                : channel?.guildId
                  ? `Portal channel • ${guilds.get(channel.guildId)?.name ?? channel.guildId} • ${mentions} mention${mentions === 1 ? '' : 's'}`
                  : `Mentions in channel`;
              return (
                <div key={`mention:${channelId}`} className="notifications-item">
                  <div>
                    <Link
                      to={route}
                      className="notifications-item-title notifications-item-link"
                      onClick={() => openNotificationConversation(channelId)}
                    >
                      {title}
                    </Link>
                    <div className="notifications-item-meta">{meta} • {routeLabel}</div>
                  </div>
                  <div className="notifications-badge-group">
                    <span className="notifications-badge notifications-badge-mention">{mentions > 99 ? '99+' : mentions}</span>
                    {count > mentions && (
                      <span className="notifications-badge">{count > 99 ? '99+' : count}</span>
                    )}
                    <button
                      type="button"
                      className="notifications-request-btn"
                      onClick={() => dismissChannelNotification(channelId)}
                      title="Dismiss mention notifications for this conversation"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      )}

      {showUnread && (
      <section className="notifications-panel">
        <div className="notifications-section-head">
          <div className="notifications-section-title">Unread Conversations</div>
          <div className="notifications-badge-group">
            {unreadEntries.length > 0 && (
              <button type="button" className="notifications-request-btn" onClick={clearUnreadNotifications}>
                Clear unread
              </button>
            )}
            <button type="button" className="notifications-request-btn" onClick={() => setUnreadCollapsed((v) => !v)}>
              {unreadCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <div className="notifications-section-meta">{unreadCountLabel}</div>
          </div>
        </div>
        {!unreadCollapsed && unreadEntries.length === 0 ? (
          <div className="notifications-empty">
            <div>No unread activity right now.</div>
            <div className="notifications-item-meta">
              {filter === 'unread' ? 'Switch to All to review requests and mention activity.' : 'You are caught up across DMs and portal channels.'}
            </div>
            <Link to="/" className="shop-link">Return Home</Link>
          </div>
        ) : !unreadCollapsed ? (
          <div className="notifications-list">
            {unreadEntries.map(({ channelId, count, mentions, channel }) => {
              const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
              const route = channel?.guildId ? `/guild/${channel.guildId}/channel/${channelId}` : `/dm/${channelId}`;
              const title = channel?.name
                ? (isDm ? channel.name : `#${channel.name}`)
                : (isDm ? 'Direct Message' : 'Channel Activity');
              const routeLabel = isDm ? 'Open DM' : 'Open Channel';
              const meta = isDm
                ? 'DM conversation'
                : channel?.guildId
                  ? `Portal channel • ${guilds.get(channel.guildId)?.name ?? channel.guildId}`
                  : `Channel ID: ${channelId}`;
              return (
              <div key={channelId} className="notifications-item">
                <div>
                  <Link
                    to={route}
                    className="notifications-item-title notifications-item-link"
                    onClick={() => openNotificationConversation(channelId)}
                  >
                    {title}
                  </Link>
                  <div className="notifications-item-meta">{meta} • {routeLabel}</div>
                </div>
                <div className="notifications-badge-group">
                  {mentions > 0 && (
                    <span className="notifications-badge notifications-badge-mention" title={`${mentions} mention${mentions === 1 ? '' : 's'}`}>
                      @{mentions > 99 ? '99+' : mentions}
                    </span>
                  )}
                  <span className="notifications-badge">{count > 99 ? '99+' : count}</span>
                  <button
                    type="button"
                    className="notifications-request-btn"
                    onClick={() => dismissChannelNotification(channelId)}
                    title="Dismiss unread notifications for this conversation"
                  >
                    Mark read
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        ) : null}
      </section>
      )}
    </div>
  );
}
