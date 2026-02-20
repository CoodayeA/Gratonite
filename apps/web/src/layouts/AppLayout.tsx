import { Outlet } from 'react-router-dom';
import { GuildRail } from '@/components/sidebar/GuildRail';
import { ChannelSidebar } from '@/components/sidebar/ChannelSidebar';
import { MemberList } from '@/components/members/MemberList';
import { CreateGuildModal } from '@/components/modals/CreateGuildModal';
import { InviteModal } from '@/components/modals/InviteModal';
import { LeaveGuildModal } from '@/components/modals/LeaveGuildModal';
import { useUiStore } from '@/stores/ui.store';

export function AppLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const memberPanelOpen = useUiStore((s) => s.memberPanelOpen);

  const layoutClass = [
    'app-layout',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
    memberPanelOpen ? 'member-panel-open' : '',
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

      {/* Modals */}
      <CreateGuildModal />
      <InviteModal />
      <LeaveGuildModal />
    </div>
  );
}
