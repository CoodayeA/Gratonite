import { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { UserBar } from './UserBar';
import type { Channel } from '@gratonite/types';

// Channel type constants (API returns string enums)
const GUILD_VOICE = 'GUILD_VOICE';
const GUILD_CATEGORY = 'GUILD_CATEGORY';

// Stable empty array to avoid creating new references on every selector call
const EMPTY_IDS: string[] = [];

function ChannelIcon({ type }: { type: string | number }) {
  if (type === GUILD_VOICE) return <span className="channel-icon">🔊</span>;
  return <span className="channel-icon">#</span>;
}

export function ChannelSidebar() {
  const { guildId } = useParams<{ guildId: string }>();
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const channels = useChannelsStore((s) => s.channels);
  const channelIds = useChannelsStore((s) =>
    guildId ? s.channelsByGuild.get(guildId) ?? EMPTY_IDS : EMPTY_IDS,
  );
  const openModal = useUiStore((s) => s.openModal);

  // Guild header dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close dropdown when navigating away from guild
  useEffect(() => {
    setDropdownOpen(false);
  }, [guildId]);

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
      <div className="channel-sidebar-header" ref={dropdownRef}>
        <button
          className="channel-sidebar-guild-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <h2 className="channel-sidebar-guild-name">{guild?.name ?? 'Gratonite'}</h2>
          <span className="channel-sidebar-chevron">{dropdownOpen ? '\u25B2' : '\u25BC'}</span>
        </button>

        {dropdownOpen && (
          <div className="channel-sidebar-dropdown">
            <button
              className="dropdown-item"
              onClick={() => { openModal('invite'); setDropdownOpen(false); }}
            >
              Invite People
            </button>
            <div className="dropdown-divider" />
            <button
              className="dropdown-item dropdown-danger"
              onClick={() => { openModal('leave-guild'); setDropdownOpen(false); }}
            >
              Leave Server
            </button>
          </div>
        )}
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

      <UserBar />
    </aside>
  );
}
