import { Outlet } from 'react-router-dom';
import { Profiler } from 'react';
import { GuildRail } from '@/components/sidebar/GuildRail';
import { ChannelSidebar } from '@/components/sidebar/ChannelSidebar';
import { MemberList } from '@/components/members/MemberList';
import { CreateGuildModal } from '@/components/modals/CreateGuildModal';
import { CreateChannelModal } from '@/components/modals/CreateChannelModal';
import { InviteModal } from '@/components/modals/InviteModal';
import { LeaveGuildModal } from '@/components/modals/LeaveGuildModal';
import { DeleteMessageModal } from '@/components/modals/DeleteMessageModal';
import { EditProfileModal } from '@/components/modals/EditProfileModal';
import { EditServerProfileModal } from '@/components/modals/EditServerProfileModal';
import { CreateThreadModal } from '@/components/modals/CreateThreadModal';
import { DmCallOverlay } from '@/components/call/DmCallOverlay';
import { DmIncomingCallModal } from '@/components/call/DmIncomingCallModal';
import { DmInfoPanel } from '@/components/messages/DmInfoPanel';
import { useUiStore } from '@/stores/ui.store';
import { profileRender } from '@/lib/perf';

export function AppLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const memberPanelOpen = useUiStore((s) => s.memberPanelOpen);
  const dmInfoPanelOpen = useUiStore((s) => s.dmInfoPanelOpen);
  const activeModal = useUiStore((s) => s.activeModal);

  const layoutClass = [
    'app-layout',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
    memberPanelOpen ? 'member-panel-open' : '',
    dmInfoPanelOpen ? 'dm-info-panel-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <GuildRail />
      <Profiler id="ChannelSidebar" onRender={profileRender}>
        <ChannelSidebar />
      </Profiler>
      <main className="app-main">
        <Outlet />
      </main>
      {memberPanelOpen && (
        <Profiler id="MemberList" onRender={profileRender}>
          <MemberList />
        </Profiler>
      )}
      <DmInfoPanel recipient={null} />

      {/* Modals */}
      {activeModal === 'create-guild' && <CreateGuildModal />}
      {activeModal === 'create-channel' && <CreateChannelModal />}
      {activeModal === 'invite' && <InviteModal />}
      {activeModal === 'leave-guild' && <LeaveGuildModal />}
      {activeModal === 'delete-message' && <DeleteMessageModal />}
      {activeModal === 'edit-profile' && <EditProfileModal />}
      {activeModal === 'edit-server-profile' && <EditServerProfileModal />}
      {activeModal === 'create-thread' && <CreateThreadModal />}
      <DmCallOverlay />
      <DmIncomingCallModal />
    </div>
  );
}
