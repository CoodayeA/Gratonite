import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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

export function UserBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiStore((s) => s.openModal);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const member = useMembersStore((s) =>
    currentGuildId ? s.membersByGuild.get(currentGuildId)?.get(user?.id ?? '') : undefined,
  );

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

  // Close menu on outside click — must be BEFORE the early return to maintain
  // consistent hook count across renders (React rules of hooks)
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // DND state
  const [dndEnabled, setDndEnabled] = useState(false);

  useEffect(() => {
    api.users.getDndSchedule().then((s) => setDndEnabled(s.enabled)).catch(() => {});
  }, []);

  const toggleDnd = useCallback(async () => {
    const next = !dndEnabled;
    setDndEnabled(next);
    try {
      await api.users.updateDndSchedule({ enabled: next });
    } catch {
      setDndEnabled(!next); // revert on failure
    }
  }, [dndEnabled]);

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
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="user-bar" ref={menuRef}>
      {menuOpen && (
        <div className="user-bar-menu">
          <button
            className="user-bar-menu-item"
            onClick={() => {
              openModal('edit-profile');
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
          <button className="user-bar-menu-item" onClick={() => { toggleDnd(); setMenuOpen(false); }}>
            <span className={`dnd-indicator ${dndEnabled ? 'dnd-active' : ''}`} />
            {dndEnabled ? 'Disable Do Not Disturb' : 'Enable Do Not Disturb'}
          </button>
          <div className="user-bar-menu-divider" />
          <button className="user-bar-menu-item user-bar-menu-danger" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      )}

      <div className="user-bar-info">
        <Avatar name={resolved?.displayName ?? user.displayName} hash={resolved?.avatarHash ?? user.avatarHash ?? null} userId={user.id} size={32} />
        <div className="user-bar-names">
          <span className="user-bar-displayname">{resolved?.displayName ?? user.displayName}</span>
          <span className="user-bar-username">@{user.username}</span>
        </div>
      </div>

      <button
        className="user-bar-settings"
        onClick={() => setMenuOpen((prev) => !prev)}
        title="User settings"
        aria-label="User settings"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
