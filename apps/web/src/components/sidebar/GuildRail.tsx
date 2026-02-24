import { useState, useMemo } from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useVoiceStore } from '@/stores/voice.store';
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
  const statesByChannel = useVoiceStore((s) => s.statesByChannel);
  const unreadCountByChannel = useUnreadStore((s) => s.unreadCountByChannel);
  const openModal = useUiStore((s) => s.openModal);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const navigate = useNavigate();
  const isGuildContext = !!useMatch('/guild/:guildId/*');
  const [hoveredVoiceGuild, setHoveredVoiceGuild] = useState<string | null>(null);

  // Build a map of guildId → voice channel info (channel name + user count)
  const guildVoiceInfo = useMemo(() => {
    const info = new Map<string, Array<{ channelId: string; channelName: string; userCount: number }>>();
    for (const [channelId, voiceStates] of statesByChannel.entries()) {
      if (!voiceStates || voiceStates.length === 0) continue;
      const ch = channels.get(channelId);
      if (!ch?.guildId) continue;
      const existing = info.get(ch.guildId) ?? [];
      existing.push({
        channelId,
        channelName: ch.name ?? 'Voice Channel',
        userCount: voiceStates.length,
      });
      info.set(ch.guildId, existing);
    }
    return info;
  }, [statesByChannel, channels]);

  const handleHomeClick = (e: React.MouseEvent) => {
    if (!isGuildContext) {
      // Already in DM context — toggle sidebar collapse
      e.preventDefault();
      toggleSidebar();
    } else {
      // In guild context — navigate to DM home and ensure sidebar is open
      e.preventDefault();
      if (sidebarCollapsed) toggleSidebar();
      navigate('/');
    }
  };

  return (
    <nav className="guild-rail">
      {/* Home / DM toggle button */}
      <NavLink
        to="/"
        className={`guild-rail-item guild-rail-home ${!isGuildContext ? 'is-dm-home' : ''}`}
        onClick={handleHomeClick}
        title={!isGuildContext ? 'Toggle DM sidebar' : 'Direct Messages'}
      >
        <div className="guild-rail-icon guild-rail-home-icon">
          <img src="/gratonite-icon.png" alt="Gratonite" width={48} height={48} style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
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
          const voiceChannels = guildVoiceInfo.get(id);
          const hasVoice = voiceChannels && voiceChannels.length > 0;
          const totalVoiceUsers = hasVoice ? voiceChannels.reduce((sum, vc) => sum + vc.userCount, 0) : 0;
          return (
            <NavLink
              key={id}
              to={`/guild/${id}`}
              className={({ isActive }) =>
                `guild-rail-item ${isActive ? 'guild-rail-item-active' : ''}`
              }
              onMouseEnter={hasVoice ? () => setHoveredVoiceGuild(id) : undefined}
              onMouseLeave={hasVoice ? () => setHoveredVoiceGuild(null) : undefined}
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
              {hasVoice && (
                <span className="guild-rail-voice-badge" aria-label={`${totalVoiceUsers} in voice`} title="">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </span>
              )}
              {hasVoice && hoveredVoiceGuild === id && (
                <div className="guild-rail-voice-tooltip">
                  <div className="guild-rail-voice-tooltip-title">Voice Active</div>
                  {voiceChannels.map((vc) => (
                    <div key={vc.channelId} className="guild-rail-voice-tooltip-channel">
                      <span className="guild-rail-voice-tooltip-icon">🔊</span>
                      <span className="guild-rail-voice-tooltip-name">{vc.channelName}</span>
                      <span className="guild-rail-voice-tooltip-count">{vc.userCount}</span>
                    </div>
                  ))}
                </div>
              )}
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
