import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useMembersStore } from '@/stores/members.store';
import { useUnreadStore } from '@/stores/unread.store';
import { usePresenceStore } from '@/stores/presence.store';
import { api, setAccessToken } from '@/lib/api';
import { UserSettingsNav } from './UserSettingsNav';
import { ServerSettingsNav } from './ServerSettingsNav';
import { AccountSection } from './sections/user/AccountSection';
import { ProfileSection } from './sections/user/ProfileSection';
import { AppearanceSection } from './sections/user/AppearanceSection';
import { NotificationsSection } from './sections/user/NotificationsSection';
import { SecuritySection } from './sections/user/SecuritySection';
import { AccessibilitySection } from './sections/user/AccessibilitySection';
import { EarnSection } from './sections/user/EarnSection';
import { OverviewSection } from './sections/server/OverviewSection';
import { MembersSection } from './sections/server/MembersSection';
import { RolesSection } from './sections/server/RolesSection';
import { ChannelsSection } from './sections/server/ChannelsSection';
import { EmojiSection } from './sections/server/EmojiSection';
import { InvitesSection } from './sections/server/InvitesSection';
import { ModerationSection } from './sections/server/ModerationSection';
import { AnalyticsSection } from './sections/server/AnalyticsSection';
import { AutoModSection } from './sections/server/AutoModSection';
import { BotsSection } from './sections/server/BotsSection';
import { WikiSection } from './sections/server/WikiSection';
import { EventsSection } from './sections/server/EventsSection';
import { ScheduledMessagesSection } from './sections/server/ScheduledMessagesSection';
import { SoundboardSection } from './sections/server/SoundboardSection';
import { ServerAppearanceSection } from './sections/server/ServerAppearanceSection';

export function SettingsShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const modalData = useUiStore((s) => s.modalData) as {
    type: 'user' | 'server';
    guildId?: string;
    initialSection?: string;
  } | null | undefined;
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);

  const type = modalData?.type ?? 'user';
  const guildId = modalData?.guildId;
  const initialSection = modalData?.initialSection;

  const [activeSection, setActiveSection] = useState<string>(
    initialSection ?? (type === 'user' ? 'account' : 'overview'),
  );

  const handleLogout = useCallback(async () => {
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
    closeModal();
    navigate('/login', { replace: true });
  }, [logout, queryClient, closeModal, navigate]);

  const handleDeleteServer = useCallback(() => {
    openModal('delete-guild', { guildId });
    closeModal();
  }, [guildId, openModal, closeModal]);

  const handleNavSelect = useCallback(
    (section: string) => {
      if (section === 'logout') {
        void handleLogout();
        return;
      }
      if (section === 'delete-server') {
        handleDeleteServer();
        return;
      }
      setActiveSection(section);
    },
    [handleLogout, handleDeleteServer],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  return (
    <div className="settings-shell-overlay" onClick={closeModal}>
      <div className="settings-shell" onClick={(e) => e.stopPropagation()}>
        <div className="settings-shell-sidebar">
          {type === 'user' ? (
            <UserSettingsNav activeSection={activeSection} onSelect={handleNavSelect} />
          ) : (
            <ServerSettingsNav activeSection={activeSection} onSelect={handleNavSelect} />
          )}
        </div>

        <div className="settings-shell-content">
          {type === 'user' && (
            <>
              {activeSection === 'account' && <AccountSection />}
              {activeSection === 'profile' && <ProfileSection />}
              {activeSection === 'earn' && <EarnSection />}
              {activeSection === 'appearance' && <AppearanceSection />}
              {activeSection === 'notifications' && <NotificationsSection />}
              {activeSection === 'security' && <SecuritySection />}
              {activeSection === 'accessibility' && <AccessibilitySection />}
            </>
          )}

          {type === 'server' && guildId && (
            <>
              {activeSection === 'overview' && <OverviewSection guildId={guildId} />}
              {activeSection === 'members' && <MembersSection guildId={guildId} />}
              {activeSection === 'roles' && <RolesSection guildId={guildId} />}
              {activeSection === 'channels' && <ChannelsSection guildId={guildId} />}
              {activeSection === 'emoji' && <EmojiSection guildId={guildId} />}
              {activeSection === 'invites' && <InvitesSection guildId={guildId} />}
              {activeSection === 'moderation' && <ModerationSection guildId={guildId} />}
              {activeSection === 'analytics' && <AnalyticsSection guildId={guildId} />}
              {activeSection === 'automod' && <AutoModSection guildId={guildId} />}
              {activeSection === 'bots' && <BotsSection guildId={guildId} />}
              {activeSection === 'wiki' && <WikiSection guildId={guildId} />}
              {activeSection === 'events' && <EventsSection guildId={guildId} />}
              {activeSection === 'scheduled-messages' && <ScheduledMessagesSection guildId={guildId} />}
              {activeSection === 'soundboard' && <SoundboardSection guildId={guildId} />}
              {activeSection === 'appearance' && <ServerAppearanceSection guildId={guildId} />}
            </>
          )}
        </div>

        <button
          type="button"
          className="settings-shell-close"
          aria-label="Close settings"
          onClick={closeModal}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
