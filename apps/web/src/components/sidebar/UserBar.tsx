import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { api, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useMembersStore } from '@/stores/members.store';
import { resolveProfile } from '@gratonite/profile-resolver';
import { useUnreadStore } from '@/stores/unread.store';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { getActiveStatusText, readProfileEnhancementsPrefs } from '@/lib/profileEnhancements';
import { getAvatarDecorationById } from '@/lib/profileCosmetics';
import { AvatarSprite } from '@/components/ui/AvatarSprite';
import { DEFAULT_AVATAR_STUDIO_PREFS, readAvatarStudioPrefs, subscribeAvatarStudioChanges } from '@/lib/avatarStudio';
import { usePresenceStore, type PresenceStatus } from '@/stores/presence.store';
import { readPresencePreference, savePresencePreference, type PresencePreference } from '@/lib/presencePrefs';
import { getSocket } from '@/lib/socket';

export function UserBar({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiStore((s) => s.openModal);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarStudioPrefs, setAvatarStudioPrefs] = useState(DEFAULT_AVATAR_STUDIO_PREFS);
  const [selectedPresence, setSelectedPresence] = useState<PresencePreference>(() => readPresencePreference());
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const compactTriggerRef = useRef<HTMLButtonElement>(null);
  const [compactMenuPos, setCompactMenuPos] = useState<{ top: number; left: number } | null>(null);
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const member = useMembersStore((s) =>
    currentGuildId ? s.membersByGuild.get(currentGuildId)?.get(user?.id ?? '') : undefined,
  );

  // Fetch Gratonites balance
  const { data: balanceData } = useQuery({
    queryKey: ['gratonites', 'balance'],
    queryFn: () => fetch('/api/v1/gratonites/balance', { credentials: 'include' }).then(r => r.json()),
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });

  const resolved = user
    ? resolveProfile(
      {
        displayName: user.displayName,
        username: user.username,
        avatarHash: user.avatarHash ?? null,
      },
      {
        nickname: member?.profile?.nickname ?? member?.nickname,
        avatarHash: member?.profile?.avatarHash ?? null,
      },
    )
    : null;
  const statusText = user ? getActiveStatusText(readProfileEnhancementsPrefs(user.id)) : '';
  const presenceMap = usePresenceStore((s) => s.byUserId);
  const livePresence = user ? presenceMap.get(user.id)?.status : undefined;
  const effectivePresence: PresenceStatus =
    selectedPresence === 'invisible' ? 'invisible' : (livePresence ?? selectedPresence);
  const visiblePresenceBadge: PresenceStatus = effectivePresence === 'invisible' ? 'offline' : effectivePresence;
  const avatarDecorationHash = user?.avatarDecorationId
    ? getAvatarDecorationById(user.avatarDecorationId)?.assetHash ?? null
    : null;

  // Close menu on outside click — must be BEFORE the early return to maintain
  // consistent hook count across renders (React rules of hooks)
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedInsideRoot = !!rootRef.current?.contains(target);
      const clickedInsideMenu = !!menuRef.current?.contains(target);
      if (!clickedInsideRoot && !clickedInsideMenu) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!compact || !menuOpen) return;

    const updatePos = () => {
      const trigger = compactTriggerRef.current;
      if (!trigger || typeof window === 'undefined') return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 240;
      const gap = 36;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = rect.right + gap;
      if (left + menuWidth > viewportWidth - margin) {
        left = Math.max(margin, viewportWidth - menuWidth - margin);
      }
      let top = rect.top;
      const estimatedMenuHeight = 300;
      if (top + estimatedMenuHeight > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - estimatedMenuHeight - margin);
      }
      setCompactMenuPos({ top: Math.round(top), left: Math.round(left) });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [compact, menuOpen]);

  useEffect(() => {
    if (!user?.id) {
      setAvatarStudioPrefs(DEFAULT_AVATAR_STUDIO_PREFS);
      return;
    }
    setAvatarStudioPrefs(readAvatarStudioPrefs(user.id));
    return subscribeAvatarStudioChanges((changedUserId) => {
      if (changedUserId !== user.id) return;
      setAvatarStudioPrefs(readAvatarStudioPrefs(user.id));
    });
  }, [user?.id]);

  const applyPresence = useCallback(async (status: PresencePreference) => {
    setSelectedPresence(status);
    savePresencePreference(status);
    usePresenceStore.getState().upsert({ userId: user?.id ?? '0', status });
    getSocket()?.emit('PRESENCE_UPDATE', { status });
    try {
      await api.users.updatePresence(status);
    } catch {
      // Realtime emit is best-effort primary path; keep local selection even if REST call fails.
    }
  }, [user?.id]);

  if (!user) return null;

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // Best-effort — proceed with client-side logout regardless
    }
    setAccessToken(null);
    logout();
    useGuildsStore.getState().clear();
    useChannelsStore.getState().clear();
    useMessagesStore.getState().clear();
    useMembersStore.getState().clear();
    useUnreadStore.getState().clear();
    usePresenceStore.getState().clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const menuContent = menuOpen ? (
    <div
      ref={menuRef}
      className={`user-bar-menu ${compact ? 'user-bar-menu-compact' : ''}`}
      style={compact && compactMenuPos ? { top: compactMenuPos.top, left: compactMenuPos.left } : undefined}
    >
          <button
            className="user-bar-menu-item"
            onClick={() => {
              openModal('settings', { type: 'user', initialSection: 'profile' });
              setMenuOpen(false);
            }}
          >
            Edit Profile
          </button>
          <button
            className="user-bar-menu-item"
            onClick={() => {
              navigate('/');
              setMenuOpen(false);
            }}
          >
            Friends & DMs
          </button>
          <div className="user-bar-menu-group-label">Status</div>
          <div className="user-bar-presence-grid">
            {([
              ['online', 'Online'],
              ['idle', 'Away'],
              ['dnd', 'Do Not Disturb'],
              ['invisible', 'Invisible'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={`user-bar-menu-item user-bar-presence-item ${selectedPresence === value ? 'is-active' : ''}`}
                onClick={() => {
                  applyPresence(value);
                  setMenuOpen(false);
                }}
              >
                <span className={`presence-dot presence-${value}`} />
                {label}
              </button>
            ))}
          </div>
          <div className="user-bar-menu-divider" />
          <button className="user-bar-menu-item user-bar-menu-danger" onClick={handleLogout}>
            Log Out
          </button>
        </div>
  ) : null;

  return (
    <div className={`user-bar ${compact ? 'user-bar-compact' : ''}`} ref={rootRef}>
      {compact ? (menuContent && typeof document !== 'undefined' ? createPortal(menuContent, document.body) : null) : menuContent}

      {compact ? (
        <button
          ref={compactTriggerRef}
          className="user-bar-compact-trigger"
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Profile and status"
          aria-label="Profile and status"
        >
          {avatarStudioPrefs.enabled ? (
            <span className="avatar-status-wrap">
              <AvatarSprite config={avatarStudioPrefs.sprite} size={34} className="user-bar-sprite" />
              <span className={`avatar-presence-badge presence-${visiblePresenceBadge}`} />
            </span>
          ) : (
            <Avatar
              name={resolved?.displayName ?? user.displayName}
              hash={resolved?.avatarHash ?? user.avatarHash ?? null}
              decorationHash={avatarDecorationHash}
              userId={user.id}
              size={34}
              presenceStatus={visiblePresenceBadge}
            />
          )}
        </button>
      ) : (
      <div className="user-bar-info">
        {avatarStudioPrefs.enabled ? (
          <span className="avatar-status-wrap">
            <AvatarSprite config={avatarStudioPrefs.sprite} size={34} className="user-bar-sprite" />
            <span className={`avatar-presence-badge presence-${visiblePresenceBadge}`} />
          </span>
        ) : (
          <Avatar
            name={resolved?.displayName ?? user.displayName}
            hash={resolved?.avatarHash ?? user.avatarHash ?? null}
            decorationHash={avatarDecorationHash}
            userId={user.id}
            size={32}
            presenceStatus={visiblePresenceBadge}
          />
        )}
        <div className="user-bar-names">
          <span className="user-bar-displayname">
            <DisplayNameText
              text={resolved?.displayName ?? user.displayName}
              userId={user.id}
              guildId={currentGuildId}
              context={currentGuildId ? 'server' : 'profile'}
            />
          </span>
          {statusText && <span className="user-bar-status" title={statusText}>💭 {statusText}</span>}
          <span className="user-bar-presence-label">
            <span className={`presence-dot presence-${effectivePresence}`} />
            {effectivePresence === 'idle'
              ? 'Away'
              : effectivePresence === 'dnd'
                ? 'Do Not Disturb'
                : effectivePresence === 'invisible'
                  ? 'Invisible'
                  : effectivePresence === 'offline'
                    ? 'Offline'
                    : 'Online'}
          </span>
          <span className="user-bar-username">@{user.username}</span>
          {balanceData && (
            <span className="user-bar-balance" title="Gratonites Currency">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px', color: '#fbbf24' }}>
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                <text x="12" y="16" textAnchor="middle" fontSize="12" fill="currentColor">G</text>
              </svg>
              {balanceData.balance?.toLocaleString() || 0}
            </span>
          )}
        </div>
      </div>
      )}
      {!compact && (
      <div className="user-bar-actions">
        <button
          className="user-bar-settings"
          onClick={() => navigate('/settings')}
          title="Settings"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          className="user-bar-settings"
          onClick={() => setMenuOpen((prev) => !prev)}
          title="User menu"
          aria-label="User menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>
      )}
    </div>
  );
}
