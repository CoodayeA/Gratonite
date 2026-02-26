import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore, type PresenceStatus } from '@/stores/presence.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SkeletonAvatar, Skeleton } from '@/components/ui/Skeleton';

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  invisible: '#6e6a80',
  offline: '#6e6a80',
};

function formatJoinDate(iso: string | undefined | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// --- Style objects ---

const pageStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  background: '#2c2c3e',
  color: '#e8e4e0',
  overflow: 'hidden',
};

const sidebarStyle: React.CSSProperties = {
  width: 260,
  minWidth: 260,
  background: '#353348',
  borderRight: '1px solid #4a4660',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sidebarHeaderStyle: React.CSSProperties = {
  padding: '16px 16px 12px',
  fontSize: 16,
  fontWeight: 700,
  color: '#e8e4e0',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#25243a',
  border: '1px solid #4a4660',
  borderRadius: 6,
  color: '#e8e4e0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6e6a80',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '12px 16px 6px',
};

const friendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 16px',
  cursor: 'pointer',
  borderRadius: 6,
  transition: 'background 0.15s',
};

const friendNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#e8e4e0',
};

const friendStatusStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#a8a4b8',
};

const mainContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const bannerStyle: React.CSSProperties = {
  height: 180,
  background: 'linear-gradient(135deg, #413d58 0%, #2c2c3e 50%, #353348 100%)',
  position: 'relative',
  flexShrink: 0,
};

const avatarWrapStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -48,
  left: 32,
  width: 96,
  height: 96,
  borderRadius: '50%',
  border: '4px solid #d4af37',
  background: '#2c2c3e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const profileBodyStyle: React.CSSProperties = {
  padding: '60px 32px 32px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
};

const nameGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const displayNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: '#e8e4e0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const verifiedBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#d4af37',
  color: '#1a1a2e',
  fontSize: 11,
  fontWeight: 700,
};

const usernameStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#a8a4b8',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const editBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  background: '#413d58',
  border: '1px solid #4a4660',
  color: '#e8e4e0',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const shareBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  background: 'transparent',
  border: '1px solid #4a4660',
  color: '#a8a4b8',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const bioStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#a8a4b8',
  lineHeight: 1.6,
};

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  flexWrap: 'wrap',
};

const statItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#e8e4e0',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6e6a80',
  textTransform: 'uppercase',
};

const balanceCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #d4af37 0%, #b8962e 100%)',
  borderRadius: 12,
  padding: '20px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const balanceAmountStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1a1a2e',
};

const balanceLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#1a1a2e',
  opacity: 0.7,
  textTransform: 'uppercase',
  fontWeight: 600,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#6e6a80',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 12,
};

const badgesRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
};

const badgeCircleStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: '#413d58',
  border: '1px solid #4a4660',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#a8a4b8',
};

const widgetsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const widgetPillStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  color: '#e8e4e0',
};

const WIDGET_COLORS = [
  '#5865F2', '#ED4245', '#57F287', '#FEE75C',
  '#EB459E', '#d4af37', '#3BA55C', '#5865F2',
];

const portalItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  background: '#25243a',
  borderRadius: 8,
  cursor: 'pointer',
};

const portalIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: '#413d58',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  color: '#d4af37',
};

const portalNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#e8e4e0',
};

const loadingWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  background: '#2c2c3e',
};

export function UserProfilePage() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const presenceMap = usePresenceStore((s) => s.byUserId);
  const [friendSearch, setFriendSearch] = useState('');

  const userId = paramUserId || currentUser?.id || '';
  const isOwnProfile = userId === currentUser?.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['users', 'profile', userId],
    queryFn: () => api.users.getProfile(userId),
    enabled: !!userId,
  });

  const { data: mutuals, isLoading: mutualsLoading } = useQuery({
    queryKey: ['users', 'mutuals', userId],
    queryFn: () => api.users.getMutuals(userId),
    enabled: !!userId,
  });

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => api.users.getFriends(),
  });

  const { data: wallet } = useQuery({
    queryKey: ['economy', 'wallet'],
    queryFn: async () => {
      const res = await fetch('/api/v1/economy/wallet', { credentials: 'include' });
      if (!res.ok) return { balance: 0 };
      return res.json();
    },
    enabled: isOwnProfile,
  });

  if (profileLoading) {
    return (
      <div style={loadingWrapStyle}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  const presence = presenceMap.get(userId);
  const status: PresenceStatus = (presence?.status as PresenceStatus) ?? 'offline';
  const mutualServers = mutuals?.mutualServers ?? [];
  const mutualFriends = mutuals?.mutualFriends ?? [];
  const friendsList = Array.isArray(friends) ? friends : [];
  const bannerHash = profile?.bannerHash;

  const filteredFriends = friendsList.filter((f: any) =>
    !friendSearch || f.displayName?.toLowerCase().includes(friendSearch.toLowerCase()),
  );

  // Separate online/offline friends
  const onlineFriends = filteredFriends.filter((f: any) => {
    const p = presenceMap.get(f.id);
    return p && p.status !== 'offline' && p.status !== 'invisible';
  });
  const offlineFriends = filteredFriends.filter((f: any) => {
    const p = presenceMap.get(f.id);
    return !p || p.status === 'offline' || p.status === 'invisible';
  });

  const bannerBg: React.CSSProperties = bannerHash
    ? {
        ...bannerStyle,
        backgroundImage: `url(/api/v1/files/banners/users/${userId}/${bannerHash})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : bannerStyle;

  // Use badges computed by the server
  const badges: string[] = (profile as any)?.badges ?? [];

  // Derive widgets from real profile data (profileEnhancements come from the profile endpoint)
  const widgets: string[] = (profile as any)?.widgets ?? [];

  return (
    <div style={pageStyle}>
      {/* Left sidebar - Friends list */}
      <aside style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>Friends</div>
        <div style={{ padding: '0 16px 8px' }}>
          <input
            type="text"
            placeholder="Search friends..."
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {friendsLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <SkeletonAvatar size={32} />
                  <Skeleton width="60%" height={13} />
                </div>
              ))}
            </div>
          )}
          {!friendsLoading && onlineFriends.length > 0 && (
            <>
              <div style={sectionLabelStyle}>Online &mdash; {onlineFriends.length}</div>
              {onlineFriends.map((friend: any) => {
                const fp = presenceMap.get(friend.id);
                const fStatus: PresenceStatus = (fp?.status as PresenceStatus) ?? 'offline';
                return (
                  <div
                    key={friend.id}
                    style={friendItemStyle}
                    onClick={() => navigate(`/profile/${friend.id}`)}
                  >
                    <Avatar
                      name={friend.displayName ?? friend.username}
                      hash={friend.avatarHash}
                      userId={friend.id}
                      size={32}
                      presenceStatus={fStatus}
                    />
                    <div>
                      <div style={friendNameStyle}>{friend.displayName ?? friend.username}</div>
                      <div style={friendStatusStyle}>
                        {fStatus === 'online' ? 'Online' : fStatus === 'idle' ? 'Idle' : fStatus === 'dnd' ? 'Do Not Disturb' : 'Offline'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {!friendsLoading && offlineFriends.length > 0 && (
            <>
              <div style={sectionLabelStyle}>Offline &mdash; {offlineFriends.length}</div>
              {offlineFriends.map((friend: any) => (
                <div
                  key={friend.id}
                  style={friendItemStyle}
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  <Avatar
                    name={friend.displayName ?? friend.username}
                    hash={friend.avatarHash}
                    userId={friend.id}
                    size={32}
                  />
                  <div>
                    <div style={friendNameStyle}>{friend.displayName ?? friend.username}</div>
                    <div style={friendStatusStyle}>Offline</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {!friendsLoading && filteredFriends.length === 0 && (
            <div style={{ padding: '16px', color: '#6e6a80', fontSize: 13, textAlign: 'center' as const }}>
              No friends found
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={mainContentStyle}>
        {/* Banner */}
        <div style={bannerBg}>
          <div style={avatarWrapStyle}>
            <Avatar
              name={profile?.displayName ?? 'User'}
              hash={profile?.avatarHash}
              userId={userId}
              size={88}
              presenceStatus={status}
            />
          </div>
        </div>

        {/* Profile body */}
        <div style={profileBodyStyle}>
          {/* Name row + buttons */}
          <div style={topRowStyle}>
            <div style={nameGroupStyle}>
              <div style={displayNameStyle}>
                {profile?.displayName ?? 'User'}
                {profile?.tier && profile.tier !== 'free' && (
                  <span style={verifiedBadgeStyle} title="Verified">
                    &#10003;
                  </span>
                )}
              </div>
              <div style={usernameStyle}>@{profile?.username ?? 'unknown'}</div>
            </div>
            {isOwnProfile && (
              <div style={buttonRowStyle}>
                <button type="button" style={editBtnStyle} onClick={() => navigate('/settings')}>
                  Edit Profile
                </button>
                <button type="button" style={shareBtnStyle}>
                  Share
                </button>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile?.bio && <p style={bioStyle}>{profile.bio}</p>}

          {/* Stats row */}
          <div style={statsRowStyle}>
            <div style={statItemStyle}>
              <span style={statValueStyle}>{formatJoinDate(profile?.createdAt)}</span>
              <span style={statLabelStyle}>Joined</span>
            </div>
            <div style={statItemStyle}>
              <span style={statValueStyle}>{mutualFriends.length}</span>
              <span style={statLabelStyle}>Mutual Friends</span>
            </div>
            <div style={statItemStyle}>
              <span style={statValueStyle}>{mutualServers.length}</span>
              <span style={statLabelStyle}>Mutual Portals</span>
            </div>
          </div>

          {/* Gratonite Balance */}
          {isOwnProfile && (
            <div style={balanceCardStyle}>
              <div>
                <div style={balanceLabelStyle}>Gratonite Balance</div>
                <div style={{ ...balanceAmountStyle, ...((!wallet) ? { opacity: 0.5 } : {}) }}>
                  {wallet ? wallet.balance.toLocaleString() + ' G' : '— G'}
                </div>
              </div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#1a1a2e" opacity={0.5}>
                <circle cx="12" cy="12" r="10" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#d4af37" fontWeight="bold">G</text>
              </svg>
            </div>
          )}

          {/* Badges */}
          <div>
            <div style={sectionTitleStyle}>Badges</div>
            <div style={badgesRowStyle}>
              {badges.map((badge) => (
                <div key={badge} style={badgeCircleStyle} title={badge}>
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Profile Widgets */}
          <div>
            <div style={sectionTitleStyle}>Profile Widgets</div>
            <div style={widgetsRowStyle}>
              {widgets.map((w, i) => (
                <span
                  key={w}
                  style={{
                    ...widgetPillStyle,
                    background: WIDGET_COLORS[i % WIDGET_COLORS.length] + '33',
                    border: `1px solid ${WIDGET_COLORS[i % WIDGET_COLORS.length]}66`,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Mutual Friends */}
          {!isOwnProfile && (
            <div>
              <div style={sectionTitleStyle}>Mutual Friends</div>
              {mutualsLoading ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonAvatar key={i} size={28} />
                  ))}
                </div>
              ) : mutualFriends.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6e6a80' }}>No mutuals</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {mutualFriends.map((f: any) => (
                    <Avatar key={f.id} name={f.displayName ?? f.username} hash={f.avatarHash} userId={f.id} size={28} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mutual Portals */}
          {!isOwnProfile && (
            <div>
              <div style={sectionTitleStyle}>Mutual Portals</div>
              {mutualsLoading ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonAvatar key={i} size={28} />
                  ))}
                </div>
              ) : mutualServers.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6e6a80' }}>No mutuals</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 } as React.CSSProperties}>
                  {mutualServers.map((server: any) => (
                    <div
                      key={server.id}
                      style={portalItemStyle}
                      onClick={() => navigate(`/guild/${server.id}`)}
                    >
                      <div style={portalIconStyle}>
                        {server.name?.charAt(0)?.toUpperCase() ?? 'P'}
                      </div>
                      <span style={portalNameStyle}>{server.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
