import { Outlet } from 'react-router-dom';
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
import { DmCallOverlay } from '@/components/call/DmCallOverlay';
import { DmIncomingCallModal } from '@/components/call/DmIncomingCallModal';
import { DmInfoPanel } from '@/components/messages/DmInfoPanel';
import { useUiStore } from '@/stores/ui.store';

export function AppLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const memberPanelOpen = useUiStore((s) => s.memberPanelOpen);
  const dmInfoPanelOpen = useUiStore((s) => s.dmInfoPanelOpen);

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
      <ChannelSidebar />
      <main className="app-main">
        <Outlet />
      </main>
      {memberPanelOpen && <MemberList />}
      <DmInfoPanel recipient={null} />

      {/* Modals */}
      <CreateGuildModal />
      <CreateChannelModal />
      <InviteModal />
      <LeaveGuildModal />
      <DeleteMessageModal />
      <EditProfileModal />
      <EditServerProfileModal />
      <DmCallOverlay />
      <DmIncomingCallModal />
    </div>
  );
}
