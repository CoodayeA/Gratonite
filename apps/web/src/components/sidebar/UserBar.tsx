import React, { useState, useRef, useEffect, useCallback } from 'react';
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

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  bg: 'var(--bg, #2c2c3e)',
  bgElevated: 'var(--bg-elevated, #353348)',
  bgInput: 'var(--bg-input, #25243a)',
  stroke: 'var(--stroke, #4a4660)',
  accent: 'var(--accent, #d4af37)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
  textFaint: 'var(--text-faint, #6e6a80)',
  textOnGold: 'var(--text-on-gold, #1a1a2e)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const userBarBase = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  borderTop: `1px solid ${V.stroke}`,
  background: 'rgba(8, 12, 20, 0.6)',
  flexShrink: 0,
} as React.CSSProperties;

const userBarCompact = {
  ...userBarBase,
  width: 48,
  minWidth: 48,
  height: 48,
  padding: 0,
  borderTop: 0,
  background: 'transparent',
  justifyContent: 'center',
  overflow: 'visible',
} as React.CSSProperties;

const compactTriggerBase = {
  width: 48,
  height: 48,
  display: 'grid',
  placeItems: 'center',
  background: 'none',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'background 0.15s ease',
} as React.CSSProperties;

const avatarStatusWrap = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as React.CSSProperties;

const userBarInfo = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: 1,
} as React.CSSProperties;

const userBarNames = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
} as React.CSSProperties;

const userBarDisplayname = {
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.2,
} as React.CSSProperties;

const userBarStatus = {
  display: 'block',
  maxWidth: 170,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: 10,
  color: V.textFaint,
} as React.CSSProperties;

const userBarPresenceLabel = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: V.textFaint,
} as React.CSSProperties;

const userBarUsername = {
  fontSize: 11,
  color: V.textFaint,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.2,
} as React.CSSProperties;

const userBarBalance = {
  fontSize: 11,
  color: V.textFaint,
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  marginTop: 2,
  fontWeight: 500,
  transition: 'color 0.15s ease',
} as React.CSSProperties;

const userBarActions = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
} as React.CSSProperties;

const userBarSettingsBase = {
  background: 'none',
  border: 'none',
  color: V.textMuted,
  cursor: 'pointer',
  padding: 4,
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s ease, color 0.15s ease',
} as React.CSSProperties;

const menuBase = {
  position: 'absolute',
  bottom: 'calc(100% + 4px)',
  left: 8,
  right: 8,
  zIndex: 100,
  background: 'rgb(9, 13, 22)',
  border: '1px solid rgba(74, 70, 96, 0.9)',
  borderRadius: 'var(--radius-md)',
  padding: 6,
  boxShadow: '0 18px 36px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(255,255,255,0.02) inset',
} as React.CSSProperties;

const menuCompact = {
  position: 'fixed',
  left: 0,
  right: 'auto',
  top: 0,
  bottom: 'auto',
  width: 240,
  minWidth: 240,
  zIndex: 2000,
  background: '#080c14',
  border: '1px solid rgba(166, 186, 230, 0.16)',
  borderRadius: 'var(--radius-md)',
  padding: 6,
  boxShadow: '0 22px 42px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255,255,255,0.025) inset',
} as React.CSSProperties;

const menuItemBase = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: V.textMuted,
  fontSize: 13,
  fontFamily: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'all 0.1s ease',
} as React.CSSProperties;

const menuGroupLabel = {
  fontSize: 11,
  color: V.textFaint,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '4px 8px 6px',
} as React.CSSProperties;

const presenceGrid = {
  display: 'grid',
  gap: 4,
  marginBottom: 4,
} as React.CSSProperties;

const presenceItemStyle = {
  ...menuItemBase,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as React.CSSProperties;

const presenceItemActive = {
  ...presenceItemStyle,
  background: 'rgba(212, 175, 55, 0.1)',
  color: V.text,
} as React.CSSProperties;

const menuDivider = {
  height: 1,
  background: V.stroke,
  margin: '4px 6px',
} as React.CSSProperties;

const menuDangerBase = {
  ...menuItemBase,
  color: 'var(--danger, #ff6b6b)',
} as React.CSSProperties;

const spriteStyle = {
  borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(8, 12, 20, 0.42)',
} as React.CSSProperties;

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

  // Hover states
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const [hoveredSettings, setHoveredSettings] = useState<number | null>(null);
  const [hoveredBalance, setHoveredBalance] = useState(false);
  const [hoveredCompactTrigger, setHoveredCompactTrigger] = useState(false);

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
      style={compact && compactMenuPos
        ? { ...menuCompact, top: compactMenuPos.top, left: compactMenuPos.left }
        : menuBase
      }
    >
          <button
            style={hoveredMenuItem === 'edit-profile' ? { ...menuItemBase, background: 'rgba(212, 175, 55, 0.08)', color: V.text } : menuItemBase}
            onMouseEnter={() => setHoveredMenuItem('edit-profile')}
            onMouseLeave={() => setHoveredMenuItem(null)}
            onClick={() => {
              openModal('settings', { type: 'user', initialSection: 'profile' });
              setMenuOpen(false);
            }}
          >
            Edit Profile
          </button>
          <button
            style={hoveredMenuItem === 'friends' ? { ...menuItemBase, background: 'rgba(212, 175, 55, 0.08)', color: V.text } : menuItemBase}
            onMouseEnter={() => setHoveredMenuItem('friends')}
            onMouseLeave={() => setHoveredMenuItem(null)}
            onClick={() => {
              navigate('/');
              setMenuOpen(false);
            }}
          >
            Friends & DMs
          </button>
          <div style={menuGroupLabel}>Status</div>
          <div style={presenceGrid}>
            {([
              ['online', 'Online'],
              ['idle', 'Away'],
              ['dnd', 'Do Not Disturb'],
              ['invisible', 'Invisible'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                style={
                  selectedPresence === value
                    ? presenceItemActive
                    : hoveredMenuItem === `presence-${value}`
                      ? { ...presenceItemStyle, background: 'rgba(212, 175, 55, 0.08)', color: V.text }
                      : presenceItemStyle
                }
                onMouseEnter={() => setHoveredMenuItem(`presence-${value}`)}
                onMouseLeave={() => setHoveredMenuItem(null)}
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
          <div style={menuDivider} />
          <button
            style={hoveredMenuItem === 'logout' ? { ...menuDangerBase, background: 'var(--danger-bg, rgba(255,107,107,0.1))' } : menuDangerBase}
            onMouseEnter={() => setHoveredMenuItem('logout')}
            onMouseLeave={() => setHoveredMenuItem(null)}
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
  ) : null;

  return (
    <div style={compact ? userBarCompact : userBarBase} ref={rootRef}>
      {compact ? (menuContent && typeof document !== 'undefined' ? createPortal(menuContent, document.body) : null) : menuContent}

      {compact ? (
        <button
          ref={compactTriggerRef}
          style={hoveredCompactTrigger ? { ...compactTriggerBase, background: 'rgba(255, 255, 255, 0.06)' } : compactTriggerBase}
          onMouseEnter={() => setHoveredCompactTrigger(true)}
          onMouseLeave={() => setHoveredCompactTrigger(false)}
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Profile and status"
          aria-label="Profile and status"
        >
          {avatarStudioPrefs.enabled ? (
            <span style={avatarStatusWrap}>
              <AvatarSprite config={avatarStudioPrefs.sprite} size={34} style={spriteStyle} />
              <span className={`avatar-presence-badge presence-${visiblePresenceBadge}`} />
            </span>
          ) : (
            <Avatar
              name={resolved?.displayName ?? user.displayName ?? user.username}
              hash={resolved?.avatarHash ?? user.avatarHash ?? null}
              decorationHash={avatarDecorationHash}
              userId={user.id}
              size={34}
              presenceStatus={visiblePresenceBadge}
            />
          )}
        </button>
      ) : (
      <div style={userBarInfo}>
        {avatarStudioPrefs.enabled ? (
          <span style={avatarStatusWrap}>
            <AvatarSprite config={avatarStudioPrefs.sprite} size={34} style={spriteStyle} />
            <span className={`avatar-presence-badge presence-${visiblePresenceBadge}`} />
          </span>
        ) : (
          <Avatar
            name={resolved?.displayName ?? user.displayName ?? user.username}
            hash={resolved?.avatarHash ?? user.avatarHash ?? null}
            decorationHash={avatarDecorationHash}
            userId={user.id}
            size={32}
            presenceStatus={visiblePresenceBadge}
          />
        )}
        <div style={userBarNames}>
          <span style={userBarDisplayname}>
            <DisplayNameText
              text={resolved?.displayName ?? user.displayName}
              userId={user.id}
              guildId={currentGuildId}
              context={currentGuildId ? 'server' : 'profile'}
            />
          </span>
          {statusText && <span style={userBarStatus} title={statusText}>💭 {statusText}</span>}
          <span style={userBarPresenceLabel}>
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
          <span style={userBarUsername}>@{user.username}</span>
          {balanceData && (
            <span
              style={hoveredBalance ? { ...userBarBalance, color: V.textMuted } : userBarBalance}
              onMouseEnter={() => setHoveredBalance(true)}
              onMouseLeave={() => setHoveredBalance(false)}
              title="Gratonites Currency"
            >
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
      <div style={userBarActions}>
        <button
          style={hoveredSettings === 0 ? { ...userBarSettingsBase, background: 'rgba(255, 255, 255, 0.06)', color: V.text } : userBarSettingsBase}
          onMouseEnter={() => setHoveredSettings(0)}
          onMouseLeave={() => setHoveredSettings(null)}
          onClick={() => navigate('/settings')}
          title="Settings"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          style={hoveredSettings === 1 ? { ...userBarSettingsBase, background: 'rgba(255, 255, 255, 0.06)', color: V.text } : userBarSettingsBase}
          onMouseEnter={() => setHoveredSettings(1)}
          onMouseLeave={() => setHoveredSettings(null)}
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
