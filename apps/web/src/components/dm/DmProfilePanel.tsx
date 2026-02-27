import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import type { PresenceStatus } from '@/stores/presence.store';

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
  invisible: 'Offline',
};

const STATUS_COLORS: Record<string, string> = {
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
  invisible: '#747f8d',
};

function formatDate(iso: string | undefined | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Style objects ──────────────────────────────────────────────── */

const styles = {
  panel: {
    width: 340,
    minWidth: 340,
    height: '100%',
    background: '#353348',
    borderLeft: '1px solid #4a4660',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    overflowY: 'auto',
  } as React.CSSProperties,

  banner: {
    height: 120,
    background: 'linear-gradient(135deg, #413d58 0%, #2c2c3e 100%)',
    flexShrink: 0,
  } as React.CSSProperties,

  identity: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px 12px',
    marginTop: -40,
  } as React.CSSProperties,

  avatarWrap: {
    border: '3px solid #d4af37',
    borderRadius: '50%',
    padding: 3,
    background: '#353348',
    marginBottom: 8,
  } as React.CSSProperties,

  displayName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e8e4e0',
    margin: 0,
  } as React.CSSProperties,

  username: {
    fontSize: 13,
    color: '#a8a4b8',
    marginTop: 2,
  } as React.CSSProperties,

  pronouns: {
    fontSize: 12,
    color: '#6e6a80',
    marginTop: 2,
  } as React.CSSProperties,

  section: {
    padding: '10px 16px',
    borderTop: '1px solid #4a4660',
  } as React.CSSProperties,

  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  statusDot: (status: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: STATUS_COLORS[status] ?? '#747f8d',
    flexShrink: 0,
  }),

  statusText: {
    fontSize: 13,
    color: '#a8a4b8',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6e6a80',
    margin: '0 0 6px',
  } as React.CSSProperties,

  sectionValue: {
    fontSize: 13,
    color: '#a8a4b8',
    margin: 0,
    lineHeight: 1.5,
  } as React.CSSProperties,

  collapsibleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: '#6e6a80',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  } as React.CSSProperties,

  chevron: (expanded: boolean): React.CSSProperties => ({
    display: 'inline-block',
    transition: 'transform 0.15s ease',
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    fontSize: 10,
  }),

  collapsibleBody: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,

  empty: {
    fontSize: 13,
    color: '#6e6a80',
    margin: 0,
    fontStyle: 'italic',
  } as React.CSSProperties,

  mutualServerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  } as React.CSSProperties,

  mutualServerName: {
    fontSize: 13,
    color: '#e8e4e0',
  } as React.CSSProperties,

  mutualServerNick: {
    fontSize: 12,
    color: '#6e6a80',
    marginLeft: 'auto',
  } as React.CSSProperties,

  mutualFriendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  } as React.CSSProperties,

  mutualFriendName: {
    fontSize: 13,
    color: '#e8e4e0',
  } as React.CSSProperties,

  mutualFriendUsername: {
    fontSize: 12,
    color: '#6e6a80',
    marginLeft: 'auto',
  } as React.CSSProperties,

  viewFullBtn: {
    display: 'block',
    width: 'calc(100% - 32px)',
    margin: '12px 16px 16px',
    padding: '10px 0',
    background: '#d4af37',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
} as const;

/* ── Component ──────────────────────────────────────────────────── */

export function DmProfilePanel({ userId }: { userId: string }) {
  const open = useUiStore((s) => s.dmInfoPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const [serversExpanded, setServersExpanded] = useState(true);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [hoveredFriend, setHoveredFriend] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['users', 'profile', userId],
    queryFn: () => api.users.getProfile(userId),
    enabled: !!userId,
  });

  const { data: mutuals } = useQuery({
    queryKey: ['users', 'mutuals', userId],
    queryFn: () => api.users.getMutuals(userId),
    enabled: !!userId,
  });

  const { data: presences } = useQuery({
    queryKey: ['users', 'presences', [userId]],
    queryFn: () => api.users.getPresences([userId]),
    enabled: !!userId,
  });

  if (!open) return null;

  const presence = presences?.[0];
  const status: PresenceStatus = (presence?.status as PresenceStatus) ?? 'offline';
  const mutualServers = mutuals?.mutualServers ?? [];
  const mutualFriends = mutuals?.mutualFriends ?? [];
  const bannerHash = profile?.bannerHash;

  // Build banner style — use banner image if available, otherwise accent gradient
  const bannerStyle: React.CSSProperties = bannerHash
    ? { ...styles.banner, backgroundImage: `url(/api/v1/files/banners/users/${userId}/${bannerHash})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : styles.banner;

  return (
    <aside style={styles.panel}>
      {/* Banner */}
      <div style={bannerStyle} />

      {/* Avatar + Identity */}
      <div style={styles.identity}>
        <div style={styles.avatarWrap}>
          <Avatar
            name={profile?.displayName ?? 'User'}
            hash={profile?.avatarHash}
            userId={userId}
            size={80}
            presenceStatus={status}
          />
        </div>
        <h3 style={styles.displayName}>{profile?.displayName ?? 'User'}</h3>
        <span style={styles.username}>@{profile?.username ?? 'unknown'}</span>
        {profile?.pronouns && (
          <span style={styles.pronouns}>{profile.pronouns}</span>
        )}
      </div>

      {/* Status */}
      <div style={styles.section}>
        <div style={styles.statusRow}>
          <span style={styles.statusDot(status)} />
          <span style={styles.statusText}>{STATUS_LABELS[status] ?? 'Offline'}</span>
        </div>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>About Me</h4>
          <p style={styles.sectionValue}>{profile.bio}</p>
        </div>
      )}

      {/* Member Since */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Member Since</h4>
        <p style={styles.sectionValue}>{formatDate(profile?.createdAt)}</p>
      </div>

      {/* Mutual Servers */}
      <div style={styles.section}>
        <button
          type="button"
          style={styles.collapsibleHeader}
          onClick={() => setServersExpanded((v) => !v)}
        >
          <span style={styles.chevron(serversExpanded)}>&#9656;</span>
          <span>Mutual Servers ({mutualServers.length})</span>
        </button>
        {serversExpanded && (
          <div style={styles.collapsibleBody}>
            {mutualServers.length === 0 ? (
              <p style={styles.empty}>No mutual servers</p>
            ) : (
              mutualServers.map((server) => (
                <div
                  key={server.id}
                  style={{
                    ...styles.mutualServerRow,
                    background: hoveredServer === server.id ? '#413d58' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredServer(server.id)}
                  onMouseLeave={() => setHoveredServer(null)}
                >
                  <span style={styles.mutualServerName}>{server.name}</span>
                  {server.nickname && (
                    <span style={styles.mutualServerNick}>{server.nickname}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mutual Friends */}
      <div style={styles.section}>
        <button
          type="button"
          style={styles.collapsibleHeader}
          onClick={() => setFriendsExpanded((v) => !v)}
        >
          <span style={styles.chevron(friendsExpanded)}>&#9656;</span>
          <span>Mutual Friends ({mutualFriends.length})</span>
        </button>
        {friendsExpanded && (
          <div style={styles.collapsibleBody}>
            {mutualFriends.length === 0 ? (
              <p style={styles.empty}>No mutual friends</p>
            ) : (
              mutualFriends.map((friend) => (
                <div
                  key={friend.id}
                  style={{
                    ...styles.mutualFriendRow,
                    background: hoveredFriend === friend.id ? '#413d58' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredFriend(friend.id)}
                  onMouseLeave={() => setHoveredFriend(null)}
                >
                  <Avatar
                    name={friend.displayName}
                    hash={friend.avatarHash}
                    userId={friend.id}
                    size={24}
                  />
                  <span style={styles.mutualFriendName}>{friend.displayName}</span>
                  <span style={styles.mutualFriendUsername}>@{friend.username}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* View Full Profile */}
      <button
        type="button"
        style={styles.viewFullBtn}
        onClick={() => openModal('full-profile', { userId })}
      >
        View Full Profile
      </button>
    </aside>
  );
}
