import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { Profiler } from 'react';
import { useEffect } from 'react';
import { GuildRail } from '@/components/sidebar/GuildRail';
import { ChannelSidebar } from '@/components/sidebar/ChannelSidebar';
import { MemberList } from '@/components/members/MemberList';
import { CreateGuildModal } from '@/components/modals/CreateGuildModal';
import { CreateChannelModal } from '@/components/modals/CreateChannelModal';
import { InviteModal } from '@/components/modals/InviteModal';
import { LeaveGuildModal } from '@/components/modals/LeaveGuildModal';
import { DeleteGuildModal } from '@/components/modals/DeleteGuildModal';
import { DeleteChannelModal } from '@/components/modals/DeleteChannelModal';
import { DeleteMessageModal } from '@/components/modals/DeleteMessageModal';
import { CreateThreadModal } from '@/components/modals/CreateThreadModal';
import { EmojiStudioModal } from '@/components/modals/EmojiStudioModal';
import { BugReportModal } from '@/components/modals/BugReportModal';
import { NewDmModal } from '@/components/modals/NewDmModal';
import { AddFriendModal } from '@/components/modals/AddFriendModal';
import { ShortcutsHelpModal } from '@/components/modals/ShortcutsHelpModal';
import { FullProfileOverlay } from '@/components/modals/FullProfileOverlay';
import { useGlobalKeyboardShortcuts } from '@/hooks/useGlobalKeyboardShortcuts';
import { DmCallOverlay } from '@/components/call/DmCallOverlay';
import { DmIncomingCallModal } from '@/components/call/DmIncomingCallModal';
import { OnboardingOverlay } from '@/components/ui/OnboardingOverlay';
import { DmProfilePanel } from '@/components/dm/DmProfilePanel';
import { GroupMembersPanel } from '@/components/dm/GroupMembersPanel';
import { DmTabBar } from '@/components/dm/DmTabBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { useUiStore } from '@/stores/ui.store';
import { profileRender } from '@/lib/perf';

export function AppLayout() {
  const location = useLocation();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const memberPanelOpen = useUiStore((s) => s.memberPanelOpen);
  const dmInfoPanelOpen = useUiStore((s) => s.dmInfoPanelOpen);
  const dmRecipientId = useUiStore((s) => s.dmRecipientId);
  const dmChannelType = useUiStore((s) => s.dmChannelType);
  const dmChannelId = useUiStore((s) => s.dmChannelId);
  const mobileGuildRailOpen = useUiStore((s) => s.mobileGuildRailOpen);
  const mobileChannelSidebarOpen = useUiStore((s) => s.mobileChannelSidebarOpen);
  const closeMobileDrawers = useUiStore((s) => s.closeMobileDrawers);
  const activeModal = useUiStore((s) => s.activeModal);

  const isGuildContext = !!useMatch('/guild/:guildId/*');
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  useGlobalKeyboardShortcuts();

  useEffect(() => {
    closeMobileDrawers();
  }, [location.pathname, location.hash, closeMobileDrawers]);

  useEffect(() => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  }, [isGuildContext]); // eslint-disable-line react-hooks/exhaustive-deps

  const layoutClass = [
    'app-layout',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
    memberPanelOpen ? 'member-panel-open' : '',
    dmInfoPanelOpen ? 'dm-info-panel-open' : '',
    mobileGuildRailOpen ? 'mobile-guild-rail-open' : '',
    mobileChannelSidebarOpen ? 'mobile-channel-sidebar-open' : '',
    !isGuildContext ? 'dm-context' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <div className="layout-rail-shell">
        <GuildRail />
      </div>
      <div className="layout-channel-shell">
        <Profiler id="ChannelSidebar" onRender={profileRender}>
          <ChannelSidebar />
        </Profiler>
      </div>
      <main className="app-main">
        {!isGuildContext && <DmTabBar />}
        <Outlet />
      </main>
      {memberPanelOpen && (
        <Profiler id="MemberList" onRender={profileRender}>
          <MemberList />
        </Profiler>
      )}
      {dmInfoPanelOpen && dmChannelType === 'DM' && dmRecipientId && (
        <DmProfilePanel userId={dmRecipientId} />
      )}
      {dmInfoPanelOpen && dmChannelType === 'GROUP_DM' && dmChannelId && (
        <GroupMembersPanel channelId={dmChannelId} />
      )}
      <button
        type="button"
        className={`mobile-shell-backdrop ${(mobileGuildRailOpen || mobileChannelSidebarOpen) ? 'is-open' : ''}`}
        aria-label="Close navigation"
        onClick={() => { closeMobileDrawers(); }}
      />
      <MobileBottomNav />

      {/* Modals */}
      {activeModal === 'settings' && <SettingsShell />}
      {activeModal === 'create-guild' && <CreateGuildModal />}
      {activeModal === 'create-channel' && <CreateChannelModal />}
      {activeModal === 'invite' && <InviteModal />}
      {activeModal === 'leave-guild' && <LeaveGuildModal />}
      {activeModal === 'delete-guild' && <DeleteGuildModal />}
      {activeModal === 'delete-channel' && <DeleteChannelModal />}
      {activeModal === 'delete-message' && <DeleteMessageModal />}
      {activeModal === 'emoji-studio' && <EmojiStudioModal />}
      {activeModal === 'bug-report' && <BugReportModal />}
      {activeModal === 'create-thread' && <CreateThreadModal />}
      {activeModal === 'new-dm' && <NewDmModal />}
      {activeModal === 'add-friend' && <AddFriendModal />}
      {activeModal === 'shortcuts-help' && <ShortcutsHelpModal />}
      {activeModal === 'full-profile' && <FullProfileOverlay />}
      <DmCallOverlay />
      <DmIncomingCallModal />
      <OnboardingOverlay />
    </div>
  );
}
