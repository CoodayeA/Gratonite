import { NavLink } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuilds } from '@/hooks/useGuilds';
import { useUiStore } from '@/stores/ui.store';
import { useUnreadStore } from '@/stores/unread.store';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { UserBar } from '@/components/sidebar/UserBar';

export function GuildRail() {
  // Triggers data fetch + syncs to store
  useGuilds();

  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const channels = useChannelsStore((s) => s.channels);
  const unreadCountByChannel = useUnreadStore((s) => s.unreadCountByChannel);
  const openModal = useUiStore((s) => s.openModal);

  return (
    <nav className="guild-rail">
      {/* Home button */}
      <NavLink to="/" className="guild-rail-item guild-rail-home" end>
        <div className="guild-rail-icon guild-rail-home-icon">
          <img src="/gratonite-icon.png" alt="Gratonite" width={48} height={48} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
        </div>
      </NavLink>

      {/* Messages / DM area */}
      <NavLink to="/friends" className="guild-rail-item guild-rail-utility" title="Messages">
        <div className="guild-rail-icon guild-rail-utility-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </NavLink>

      <div className="guild-rail-divider" />

      <div className="guild-rail-profile-slot" title="Profile and status">
        <UserBar compact />
      </div>

      <NavLink to="/discover" className="guild-rail-item guild-rail-utility" title="Find a new portal to join">
        <div className="guild-rail-icon guild-rail-utility-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <polygon points="10 10 15 9 14 14 9 15 10 10" />
          </svg>
        </div>
      </NavLink>

      <NavLink to="/shop" className="guild-rail-item guild-rail-utility" title="Open shop">
        <div className="guild-rail-icon guild-rail-utility-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 12H7L6 7Z" />
            <path d="M9 7a3 3 0 1 1 6 0" />
          </svg>
        </div>
      </NavLink>

      <button
        className="guild-rail-item guild-rail-add guild-rail-create-join"
        onClick={() => openModal('create-guild')}
        title="Create or join a server"
      >
        <div className="guild-rail-icon guild-rail-add-icon">+</div>
      </button>

      {/* Guild icons */}
      <div className="guild-rail-list">
        {guildOrder.map((id) => {
          const guild = guilds.get(id);
          if (!guild) return null;
          return (
            <NavLink
              key={id}
              to={`/guild/${id}`}
              className={({ isActive }) =>
                `guild-rail-item ${isActive ? 'guild-rail-item-active' : ''}`
              }
            >
              {(() => {
                let guildUnread = 0;
                for (const [channelId, count] of unreadCountByChannel.entries()) {
                  const ch = channels.get(channelId);
                  if (ch?.guildId === guild.id) guildUnread += count;
                }
                return guildUnread > 0 ? (
                  <span className="guild-rail-unread-badge" aria-label={`${guildUnread} unread in ${guild.name}`}>
                    {guildUnread > 99 ? '99+' : guildUnread}
                  </span>
                ) : null;
              })()}
              <GuildIcon
                name={guild.name}
                iconHash={guild.iconHash}
                guildId={guild.id}
                size={48}
              />
            </NavLink>
          );
        })}
      </div>

      <div className="guild-rail-spacer" />
      <div className="guild-rail-divider guild-rail-divider-bottom" />
      <div className="guild-rail-footer">
        <NavLink to="/notifications" className="guild-rail-item guild-rail-utility" title="Notifications">
          <div className="guild-rail-icon guild-rail-utility-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </div>
        </NavLink>
        <NavLink to="/settings" className="guild-rail-item guild-rail-utility" title="Settings">
          <div className="guild-rail-icon guild-rail-utility-icon guild-rail-settings-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
        </NavLink>
      </div>
    </nav>
  );
}
