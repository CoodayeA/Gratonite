import { Outlet } from 'react-router-dom';
import { GuildRail } from '@/components/sidebar/GuildRail';
import { ChannelSidebar } from '@/components/sidebar/ChannelSidebar';
import { useUiStore } from '@/stores/ui.store';

export function AppLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <GuildRail />
      <ChannelSidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
