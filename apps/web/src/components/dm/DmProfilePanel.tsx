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

function formatDate(iso: string | undefined | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DmProfilePanel({ userId }: { userId: string }) {
  const open = useUiStore((s) => s.dmInfoPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const [serversExpanded, setServersExpanded] = useState(true);
  const [friendsExpanded, setFriendsExpanded] = useState(true);

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
    ? { backgroundImage: `url(/api/v1/files/banners/users/${userId}/${bannerHash})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <aside className="dm-profile-panel">
      {/* Banner */}
      <div className="dm-profile-banner" style={bannerStyle} />

      {/* Avatar + Identity */}
      <div className="dm-profile-identity">
        <div className="dm-profile-avatar-wrap">
          <Avatar
            name={profile?.displayName ?? 'User'}
            hash={profile?.avatarHash}
            userId={userId}
            size={80}
            presenceStatus={status}
          />
        </div>
        <h3 className="dm-profile-display-name">{profile?.displayName ?? 'User'}</h3>
        <span className="dm-profile-username">@{profile?.username ?? 'unknown'}</span>
        {profile?.pronouns && (
          <span className="dm-profile-pronouns">{profile.pronouns}</span>
        )}
      </div>

      {/* Status */}
      <div className="dm-profile-section">
        <div className="dm-profile-status-row">
          <span className={`dm-profile-status-dot dm-profile-status-${status}`} />
          <span className="dm-profile-status-text">{STATUS_LABELS[status] ?? 'Offline'}</span>
        </div>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <div className="dm-profile-section">
          <h4 className="dm-profile-section-title">About Me</h4>
          <p className="dm-profile-section-value">{profile.bio}</p>
        </div>
      )}

      {/* Member Since */}
      <div className="dm-profile-section">
        <h4 className="dm-profile-section-title">Member Since</h4>
        <p className="dm-profile-section-value">{formatDate(profile?.createdAt)}</p>
      </div>

      {/* Mutual Servers */}
      <div className="dm-profile-section">
        <button
          type="button"
          className="dm-profile-collapsible-header"
          onClick={() => setServersExpanded((v) => !v)}
        >
          <span className={`dm-profile-chevron ${serversExpanded ? 'expanded' : ''}`}>&#9656;</span>
          <span>Mutual Servers ({mutualServers.length})</span>
        </button>
        {serversExpanded && (
          <div className="dm-profile-collapsible-body">
            {mutualServers.length === 0 ? (
              <p className="dm-profile-empty">No mutual servers</p>
            ) : (
              mutualServers.map((server) => (
                <div key={server.id} className="dm-profile-mutual-server-row">
                  <span className="dm-profile-mutual-server-name">{server.name}</span>
                  {server.nickname && (
                    <span className="dm-profile-mutual-server-nick">{server.nickname}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mutual Friends */}
      <div className="dm-profile-section">
        <button
          type="button"
          className="dm-profile-collapsible-header"
          onClick={() => setFriendsExpanded((v) => !v)}
        >
          <span className={`dm-profile-chevron ${friendsExpanded ? 'expanded' : ''}`}>&#9656;</span>
          <span>Mutual Friends ({mutualFriends.length})</span>
        </button>
        {friendsExpanded && (
          <div className="dm-profile-collapsible-body">
            {mutualFriends.length === 0 ? (
              <p className="dm-profile-empty">No mutual friends</p>
            ) : (
              mutualFriends.map((friend) => (
                <div key={friend.id} className="dm-profile-mutual-friend-row">
                  <Avatar
                    name={friend.displayName}
                    hash={friend.avatarHash}
                    userId={friend.id}
                    size={24}
                  />
                  <span className="dm-profile-mutual-friend-name">{friend.displayName}</span>
                  <span className="dm-profile-mutual-friend-username">@{friend.username}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* View Full Profile */}
      <button
        type="button"
        className="dm-profile-view-full-btn"
        onClick={() => openModal('full-profile', { userId })}
      >
        View Full Profile
      </button>
    </aside>
  );
}
