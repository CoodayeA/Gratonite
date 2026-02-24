import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore } from '@/stores/ui.store';
import { usePresenceStore } from '@/stores/presence.store';

type FilterTab = 'all' | 'online' | 'pending' | 'blocked';

interface Relationship {
  userId: string;
  targetId: string;
  type: 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing';
  createdAt: string;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

export function FriendsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiStore((s) => s.openModal);
  const [filter, setFilter] = useState<FilterTab>('all');

  // ── Data fetching ──────────────────────────────────────────────────────

  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll(),
  });

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      ids.add(rel.userId);
      ids.add(rel.targetId);
    }
    return Array.from(ids);
  }, [relationships]);

  const { data: userSummaries = [] } = useQuery<UserSummary[]>({
    queryKey: ['users', 'summaries', userIds],
    queryFn: () => api.users.getSummaries(userIds),
    enabled: userIds.length > 0,
  });

  const usersById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const u of userSummaries) {
      map.set(u.id, u);
    }
    return map;
  }, [userSummaries]);

  // ── Presence (online status) ──────────────────────────────────────────

  const presenceMap = usePresenceStore((s) => s.byUserId);
  const setManyPresences = usePresenceStore((s) => s.setMany);

  // Extract friend user IDs for presence fetching
  const friendUserIds = useMemo(() => {
    return relationships
      .filter((r) => r.type === 'friend')
      .map((r) => r.targetId);
  }, [relationships]);

  // Fetch presences for all friends (re-poll every 30s for freshness)
  const { data: presences } = useQuery({
    queryKey: ['users', 'presences', friendUserIds],
    queryFn: () => api.users.getPresences(friendUserIds),
    enabled: friendUserIds.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Sync fetched presences into the Zustand store
  useEffect(() => {
    if (presences && presences.length > 0) {
      setManyPresences(presences);
    }
  }, [presences, setManyPresences]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.acceptFriendRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.removeFriend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.removeFriend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.unblock(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  // ── Filter logic ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    switch (filter) {
      case 'all':
        return relationships.filter((r) => r.type === 'friend');
      case 'online':
        return relationships.filter((r) => {
          if (r.type !== 'friend') return false;
          const presence = presenceMap.get(r.targetId);
          const status = presence?.status ?? 'offline';
          return status === 'online' || status === 'idle' || status === 'dnd';
        });
      case 'pending':
        return relationships.filter(
          (r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing',
        );
      case 'blocked':
        return relationships.filter((r) => r.type === 'blocked');
      default:
        return [];
    }
  }, [relationships, filter, presenceMap]);

  // ── Helpers ────────────────────────────────────────────────────────────

  function getOtherUser(rel: Relationship): UserSummary | undefined {
    // targetId is typically the "other" user in a relationship row
    return usersById.get(rel.targetId) ?? usersById.get(rel.userId);
  }

  async function handleMessage(userId: string) {
    const channel = await api.relationships.openDm(userId);
    if (channel?.id) {
      navigate('/dm/' + channel.id);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const onlineCount = useMemo(() => {
    return relationships.filter((r) => {
      if (r.type !== 'friend') return false;
      const status = presenceMap.get(r.targetId)?.status ?? 'offline';
      return status === 'online' || status === 'idle' || status === 'dnd';
    }).length;
  }, [relationships, presenceMap]);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: `Online${onlineCount > 0 ? ` — ${onlineCount}` : ''}` },
    { key: 'pending', label: 'Pending' },
    { key: 'blocked', label: 'Blocked' },
  ];

  const emptyMessages: Record<FilterTab, string> = {
    all: 'No friends yet. Add some!',
    online: 'No friends online',
    pending: 'No pending requests',
    blocked: 'No blocked users',
  };

  return (
    <div className="friends-page">
      {/* Header */}
      <div className="friends-header">
        <h2>Friends</h2>
        <button className="friends-add-btn" onClick={() => openModal('add-friend')}>
          Add Friend
        </button>
      </div>

      {/* Filter row */}
      <div className="friends-filter-row">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`friends-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="friends-list">
        {filtered.length === 0 ? (
          <div className="friends-empty">{emptyMessages[filter]}</div>
        ) : (
          filtered.map((rel) => {
            const user = getOtherUser(rel);
            if (!user) return null;

            // Friend rows (All / Online filters)
            if (filter === 'all' || filter === 'online') {
              const friendStatus = presenceMap.get(user.id)?.status ?? 'offline';
              return (
                <div key={user.id} className="friend-row">
                  <div className="friend-row-avatar-wrap">
                    <Avatar name={user.displayName} hash={user.avatarHash} userId={user.id} size={40} />
                    <span className={`friend-presence-dot presence-${friendStatus}`} title={friendStatus} />
                  </div>
                  <div className="friend-row-info">
                    <div className="friend-row-name">{user.displayName}</div>
                    <div className="friend-row-username">@{user.username}</div>
                  </div>
                  <div className="friend-row-actions">
                    <button onClick={() => handleMessage(user.id)}>Message</button>
                    <button title="More options">&#x22EF;</button>
                  </div>
                </div>
              );
            }

            // Pending rows
            if (filter === 'pending') {
              const isIncoming = rel.type === 'pending_incoming';
              return (
                <div key={user.id} className="friend-row">
                  <Avatar name={user.displayName} hash={user.avatarHash} userId={user.id} size={40} />
                  <div className="friend-row-info">
                    <div className="friend-row-name">{user.displayName}</div>
                    <div className="friend-row-username">@{user.username}</div>
                  </div>
                  <span className={`friend-row-badge ${isIncoming ? 'incoming' : 'outgoing'}`}>
                    {isIncoming ? 'Incoming' : 'Outgoing'}
                  </span>
                  <div className="friend-row-actions">
                    {isIncoming ? (
                      <>
                        <button
                          className="accept"
                          onClick={() => acceptMutation.mutate(user.id)}
                          disabled={acceptMutation.isPending}
                        >
                          Accept
                        </button>
                        <button
                          className="decline"
                          onClick={() => declineMutation.mutate(user.id)}
                          disabled={declineMutation.isPending}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => cancelMutation.mutate(user.id)}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Blocked rows
            if (filter === 'blocked') {
              return (
                <div key={user.id} className="friend-row">
                  <Avatar name={user.displayName} hash={user.avatarHash} userId={user.id} size={40} />
                  <div className="friend-row-info">
                    <div className="friend-row-name">{user.displayName}</div>
                    <div className="friend-row-username">@{user.username}</div>
                  </div>
                  <div className="friend-row-actions">
                    <button
                      onClick={() => unblockMutation.mutate(user.id)}
                      disabled={unblockMutation.isPending}
                    >
                      Unblock
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
}
