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
  online: 'var(--status-online)',
  idle: 'var(--status-idle)',
  dnd: 'var(--status-dnd)',
  invisible: 'var(--status-offline)',
  offline: 'var(--status-offline)',
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
  background: 'var(--bg)',
  color: 'var(--text)',
  overflow: 'hidden',
};

const sidebarStyle: React.CSSProperties = {
  width: 260,
  minWidth: 260,
  background: 'var(--bg-elevated)',
  borderRight: '1px solid var(--stroke)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sidebarHeaderStyle: React.CSSProperties = {
  padding: '16px 16px 12px',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--stroke)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '12px 16px 6px',
};

const friendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 16px',
  cursor: 'pointer',
  borderRadius: 'var(--radius-sm)',
  transition: 'background 0.15s',
};

const friendNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text)',
};

const friendStatusStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const mainContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const bannerStyle: React.CSSProperties = {
  height: 180,
  background: 'linear-gradient(135deg, var(--bg-soft) 0%, var(--bg) 50%, var(--bg-elevated) 100%)',
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
  border: '4px solid var(--accent)',
  background: 'var(--bg)',
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
  color: 'var(--text)',
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
  background: 'var(--accent)',
  color: 'var(--text-on-gold)',
  fontSize: 11,
  fontWeight: 700,
};

const usernameStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const editBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-soft)',
  border: '1px solid var(--stroke)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const shareBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--stroke)',
  color: 'var(--text-muted)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const bioStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
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
  color: 'var(--text)',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
};

const balanceCardStyle: React.CSSProperties = {
  background: 'var(--gradient-accent)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const balanceAmountStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--text-on-gold)',
};

const balanceLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-on-gold)',
  opacity: 0.7,
  textTransform: 'uppercase',
  fontWeight: 600,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
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
  background: 'var(--bg-soft)',
  border: '1px solid var(--stroke)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-muted)',
};

const widgetsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const widgetPillStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-xl)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
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
  background: 'var(--bg-input)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const portalIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent)',
};

const portalNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text)',
};

const loadingWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  background: 'var(--bg)',
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
    queryFn: () => api.relationships.getAll(),
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

  const { data: creatorCosmetics } = useQuery({
    queryKey: ['cosmetics', 'creator', userId],
    queryFn: () => api.cosmetics.listByCreator(userId),
    enabled: !!userId,
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
            <div style={{ padding: '16px', color: 'var(--text-faint)', fontSize: 13, textAlign: 'center' as const }}>
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
                {(profile as any)?.tier && (profile as any).tier !== 'free' && (
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
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-on-gold)" opacity={0.5}>
                <circle cx="12" cy="12" r="10" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="var(--accent)" fontWeight="bold">G</text>
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

          {/* Creator Cosmetics Showcase */}
          {Array.isArray(creatorCosmetics) && (creatorCosmetics as any[]).length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={sectionTitleStyle}>Creations</div>
                <a
                  href={`/creator/${userId}`}
                  style={{ fontSize: 12, color: 'var(--accent, #d4af37)', textDecoration: 'none' }}
                >
                  View all →
                </a>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {(creatorCosmetics as any[]).slice(0, 4).map((c: any) => (
                  <div
                    key={c.id}
                    title={c.name}
                    style={{
                      width: 52, height: 52, borderRadius: 8,
                      background: '#0d0b1a', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {c.previewImageUrl
                      ? <img src={c.previewImageUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain' as const }} />
                      : <span style={{ fontSize: 22 }}>🎨</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No mutuals</div>
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
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No mutuals</div>
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
