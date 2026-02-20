import { NavLink, useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import type { Channel } from '@gratonite/types';

// Channel type constants
const GUILD_TEXT = 0;
const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;

function ChannelIcon({ type }: { type: number }) {
  if (type === GUILD_VOICE) return <span className="channel-icon">🔊</span>;
  return <span className="channel-icon">#</span>;
}

export function ChannelSidebar() {
  const { guildId } = useParams<{ guildId: string }>();
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const channels = useChannelsStore((s) => s.channels);
  const channelIds = useChannelsStore((s) =>
    guildId ? s.channelsByGuild.get(guildId) ?? [] : [],
  );

  // Fetch channels for this guild
  useGuildChannels(guildId);

  // Group channels by category
  const allChannels = channelIds
    .map((id) => channels.get(id))
    .filter((ch): ch is Channel => ch !== undefined)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const categories = allChannels.filter((ch) => ch.type === GUILD_CATEGORY);
  const uncategorized = allChannels.filter(
    (ch) => ch.type !== GUILD_CATEGORY && !ch.parentId,
  );

  return (
    <aside className="channel-sidebar">
      <div className="channel-sidebar-header">
        <h2 className="channel-sidebar-guild-name">{guild?.name ?? 'Loading...'}</h2>
      </div>

      <div className="channel-sidebar-list">
        {/* Uncategorized channels */}
        {uncategorized.map((ch) => (
          <NavLink
            key={ch.id}
            to={`/guild/${guildId}/channel/${ch.id}`}
            className={({ isActive }) =>
              `channel-item ${isActive ? 'channel-item-active' : ''}`
            }
          >
            <ChannelIcon type={ch.type} />
            <span className="channel-name">{ch.name}</span>
          </NavLink>
        ))}

        {/* Categorized channels */}
        {categories.map((cat) => {
          const children = allChannels.filter((ch) => ch.parentId === cat.id);
          return (
            <div key={cat.id} className="channel-category">
              <div className="channel-category-header">
                <span className="channel-category-name">{cat.name}</span>
              </div>
              {children.map((ch) => (
                <NavLink
                  key={ch.id}
                  to={`/guild/${guildId}/channel/${ch.id}`}
                  className={({ isActive }) =>
                    `channel-item ${isActive ? 'channel-item-active' : ''}`
                  }
                >
                  <ChannelIcon type={ch.type} />
                  <span className="channel-name">{ch.name}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
