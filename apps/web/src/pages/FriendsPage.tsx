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

/* ─── CSS variable tokens ─────────────────────────────────────────────── */
const V = {
  bg:          'var(--bg, #2c2c3e)',
  bgElevated:  'var(--bg-elevated, #353348)',
  bgSoft:      'var(--bg-soft, #413d58)',
  bgInput:     'var(--bg-input, #25243a)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
} as const;

export function FriendsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiStore((s) => s.openModal);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.block(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      setSelectedFriendId(null);
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.removeFriend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      setSelectedFriendId(null);
    },
  });

  // ── Filter logic ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list: Relationship[];
    switch (filter) {
      case 'all':
        list = relationships.filter((r) => r.type === 'friend');
        break;
      case 'online':
        list = relationships.filter((r) => {
          if (r.type !== 'friend') return false;
          const presence = presenceMap.get(r.targetId);
          const status = presence?.status ?? 'offline';
          return status === 'online' || status === 'idle' || status === 'dnd';
        });
        break;
      case 'pending':
        list = relationships.filter(
          (r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing',
        );
        break;
      case 'blocked':
        list = relationships.filter((r) => r.type === 'blocked');
        break;
      default:
        list = [];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((rel) => {
        const user = getOtherUser(rel);
        if (!user) return false;
        return (
          user.displayName.toLowerCase().includes(q) ||
          user.username.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [relationships, filter, presenceMap, searchQuery]);

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

  // ── Derived values ────────────────────────────────────────────────────

  const onlineCount = useMemo(() => {
    return relationships.filter((r) => {
      if (r.type !== 'friend') return false;
      const status = presenceMap.get(r.targetId)?.status ?? 'offline';
      return status === 'online' || status === 'idle' || status === 'dnd';
    }).length;
  }, [relationships, presenceMap]);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'online', label: `Online${onlineCount > 0 ? ` \u2014 ${onlineCount}` : ''}` },
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'blocked', label: 'Blocked' },
  ];

  const emptyMessages: Record<FilterTab, string> = {
    all: 'No friends yet. Add some!',
    online: 'No friends online',
    pending: 'No pending requests',
    blocked: 'No blocked users',
  };

  // Selected friend data
  const selectedUser = selectedFriendId ? usersById.get(selectedFriendId) : null;
  const selectedPresence = selectedFriendId ? presenceMap.get(selectedFriendId) : null;
  const selectedStatus = selectedPresence?.status ?? 'offline';

  // Find the relationship for the selected friend
  const selectedRelationship = selectedFriendId
    ? relationships.find(
        (r) => r.targetId === selectedFriendId || r.userId === selectedFriendId,
      )
    : null;

  // Clear selection if user is removed from list
  useEffect(() => {
    if (selectedFriendId && !usersById.has(selectedFriendId)) {
      setSelectedFriendId(null);
    }
  }, [selectedFriendId, usersById]);

  // ── Status helpers ────────────────────────────────────────────────────

  function statusColor(status: string): string {
    switch (status) {
      case 'online':  return '#43b581';
      case 'idle':    return '#faa61a';
      case 'dnd':     return '#f04747';
      default:        return V.textFaint;
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case 'online':  return 'Online';
      case 'idle':    return 'Idle';
      case 'dnd':     return 'Do Not Disturb';
      default:        return 'Offline';
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        color: V.text,
        fontFamily: 'inherit',
      }}
    >
      {/* ═══ Sidebar ═══ */}
      <aside
        style={{
          width: 280,
          minWidth: 280,
          background: V.bgElevated,
          borderRight: `1px solid ${V.stroke}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: 20 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: V.text,
              marginBottom: 12,
            }}
          >
            Friends
          </h2>

          {/* Search bar */}
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${V.stroke}`,
              background: V.bgInput,
              color: V.text,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '0 12px 8px',
            flexWrap: 'wrap',
          }}
        >
          {filters.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  background: isActive ? V.bgSoft : 'transparent',
                  color: isActive ? V.text : V.textMuted,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: V.stroke, margin: '0 12px' }} />

        {/* Friend list (scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 8px',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: V.textFaint,
                fontSize: 13,
              }}
            >
              {emptyMessages[filter]}
            </div>
          ) : (
            filtered.map((rel) => {
              const user = getOtherUser(rel);
              if (!user) return null;

              const isSelected = selectedFriendId === user.id;
              const friendStatus = presenceMap.get(user.id)?.status ?? 'offline';
              const isIncoming = rel.type === 'pending_incoming';
              const isPending = filter === 'pending';
              const isBlocked = filter === 'blocked';

              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedFriendId(user.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? V.bgSoft : 'transparent',
                    transition: 'background 0.15s',
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = V.bgSoft;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Avatar with presence dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar
                      name={user.displayName}
                      hash={user.avatarHash}
                      userId={user.id}
                      size={36}
                    />
                    {!isPending && !isBlocked && (
                      <span
                        title={statusLabel(friendStatus)}
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: statusColor(friendStatus),
                          border: `2px solid ${V.bgElevated}`,
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>

                  {/* Name + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: V.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {user.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: V.textMuted,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {isPending
                        ? isIncoming
                          ? 'Incoming request'
                          : 'Outgoing request'
                        : isBlocked
                          ? 'Blocked'
                          : statusLabel(friendStatus)}
                    </div>
                  </div>

                  {/* Inline action buttons */}
                  <div
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isPending && isIncoming && (
                      <>
                        <button
                          onClick={() => acceptMutation.mutate(user.id)}
                          disabled={acceptMutation.isPending}
                          title="Accept"
                          style={{
                            ...sidebarActionBtnStyle,
                            color: '#43b581',
                          }}
                        >
                          &#x2713;
                        </button>
                        <button
                          onClick={() => declineMutation.mutate(user.id)}
                          disabled={declineMutation.isPending}
                          title="Decline"
                          style={{
                            ...sidebarActionBtnStyle,
                            color: '#f04747',
                          }}
                        >
                          &#x2715;
                        </button>
                      </>
                    )}
                    {isPending && !isIncoming && (
                      <button
                        onClick={() => cancelMutation.mutate(user.id)}
                        disabled={cancelMutation.isPending}
                        title="Cancel"
                        style={{
                          ...sidebarActionBtnStyle,
                          color: '#f04747',
                        }}
                      >
                        &#x2715;
                      </button>
                    )}
                    {isBlocked && (
                      <button
                        onClick={() => unblockMutation.mutate(user.id)}
                        disabled={unblockMutation.isPending}
                        title="Unblock"
                        style={{
                          ...sidebarActionBtnStyle,
                          color: V.textMuted,
                          fontSize: 11,
                        }}
                      >
                        Unblock
                      </button>
                    )}
                    {!isPending && !isBlocked && (
                      <button
                        onClick={() => handleMessage(user.id)}
                        title="Message"
                        style={sidebarActionBtnStyle}
                      >
                        &#x1F4AC;
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main
        style={{
          flex: 1,
          background: V.bg,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Main header */}
        <div
          style={{
            padding: '20px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${V.stroke}`,
            flexShrink: 0,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: V.text,
            }}
          >
            Friends
          </h1>
          <button
            onClick={() => openModal('add-friend')}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: V.accent,
              color: V.textOnGold,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            }}
          >
            Add Friend
          </button>
        </div>

        {/* Main body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '40px 32px',
          }}
        >
          {selectedUser ? (
            /* ─── Profile card ─── */
            <div
              style={{
                maxWidth: 560,
                background: V.bgElevated,
                border: `1px solid ${V.stroke}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Banner area */}
              <div
                style={{
                  height: 100,
                  background: `linear-gradient(135deg, ${V.bgSoft}, ${V.stroke})`,
                  position: 'relative',
                }}
              >
                {/* Large avatar overlapping banner */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -36,
                    left: 24,
                    borderRadius: '50%',
                    border: `4px solid ${V.bgElevated}`,
                    background: V.bgElevated,
                    lineHeight: 0,
                  }}
                >
                  <Avatar
                    name={selectedUser.displayName}
                    hash={selectedUser.avatarHash}
                    userId={selectedUser.id}
                    size={72}
                  />
                  {/* Status dot on large avatar */}
                  {selectedRelationship?.type === 'friend' && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: statusColor(selectedStatus),
                        border: `3px solid ${V.bgElevated}`,
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Profile body */}
              <div style={{ padding: '48px 28px 24px' }}>
                {/* Display name */}
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: V.text,
                    marginBottom: 2,
                  }}
                >
                  {selectedUser.displayName}
                </div>

                {/* Username */}
                <div
                  style={{
                    fontSize: 14,
                    color: V.textMuted,
                    marginBottom: 16,
                  }}
                >
                  @{selectedUser.username}
                </div>

                {/* Status line */}
                {selectedRelationship?.type === 'friend' && (
                  <div
                    style={{
                      fontSize: 13,
                      color: V.textMuted,
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor(selectedStatus),
                      }}
                    />
                    {statusLabel(selectedStatus)}
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: V.stroke,
                    margin: '8px 0 16px',
                  }}
                />

                {/* Bio placeholder */}
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                      color: V.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    About Me
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: V.textFaint,
                      fontStyle: 'italic',
                    }}
                  >
                    No bio set
                  </div>
                </div>

                {/* Mutual servers placeholder */}
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                      color: V.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    Mutual Servers
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: V.textFaint,
                    }}
                  >
                    No mutual servers
                  </div>
                </div>

                {/* Member since */}
                {selectedRelationship && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.5px',
                        color: V.textMuted,
                        marginBottom: 6,
                      }}
                    >
                      Friends Since
                    </div>
                    <div style={{ fontSize: 13, color: V.textFaint }}>
                      {new Date(selectedRelationship.createdAt).toLocaleDateString(
                        undefined,
                        { month: 'long', day: 'numeric', year: 'numeric' },
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selectedRelationship?.type === 'friend' && (
                    <>
                      <button
                        onClick={() => handleMessage(selectedUser.id)}
                        style={{
                          ...profileActionBtnStyle,
                          background: V.accent,
                          color: V.textOnGold,
                        }}
                      >
                        Message
                      </button>
                      <button
                        onClick={() => blockMutation.mutate(selectedUser.id)}
                        disabled={blockMutation.isPending}
                        style={{
                          ...profileActionBtnStyle,
                          background: V.bgSoft,
                          color: V.textMuted,
                        }}
                      >
                        Block
                      </button>
                      <button
                        onClick={() => removeFriendMutation.mutate(selectedUser.id)}
                        disabled={removeFriendMutation.isPending}
                        style={{
                          ...profileActionBtnStyle,
                          background: '#f04747',
                          color: '#fff',
                        }}
                      >
                        Remove Friend
                      </button>
                    </>
                  )}
                  {selectedRelationship?.type === 'pending_incoming' && (
                    <>
                      <button
                        onClick={() => acceptMutation.mutate(selectedUser.id)}
                        disabled={acceptMutation.isPending}
                        style={{
                          ...profileActionBtnStyle,
                          background: V.accent,
                          color: V.textOnGold,
                        }}
                      >
                        Accept Request
                      </button>
                      <button
                        onClick={() => declineMutation.mutate(selectedUser.id)}
                        disabled={declineMutation.isPending}
                        style={{
                          ...profileActionBtnStyle,
                          background: '#f04747',
                          color: '#fff',
                        }}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {selectedRelationship?.type === 'pending_outgoing' && (
                    <button
                      onClick={() => cancelMutation.mutate(selectedUser.id)}
                      disabled={cancelMutation.isPending}
                      style={{
                        ...profileActionBtnStyle,
                        background: '#f04747',
                        color: '#fff',
                      }}
                    >
                      Cancel Request
                    </button>
                  )}
                  {selectedRelationship?.type === 'blocked' && (
                    <button
                      onClick={() => unblockMutation.mutate(selectedUser.id)}
                      disabled={unblockMutation.isPending}
                      style={{
                        ...profileActionBtnStyle,
                        background: V.bgSoft,
                        color: V.textMuted,
                      }}
                    >
                      Unblock
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ─── Empty state ─── */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: V.textFaint,
                textAlign: 'center',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 48, opacity: 0.3 }}>&#x1F465;</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: V.textMuted }}>
                Select a friend
              </div>
              <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
                Choose someone from your friends list to view their profile, or add a
                new friend to get started.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Shared inline styles ────────────────────────────────────────────── */

const sidebarActionBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  background: 'var(--bg-input, #25243a)',
  color: 'var(--text-muted, #a8a4b8)',
  padding: 0,
  lineHeight: 1,
};

const profileActionBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  transition: 'opacity 0.15s',
};
