import { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { UserBar } from './UserBar';
import type { Channel } from '@gratonite/types';
import { useUnreadStore } from '@/stores/unread.store';

// Channel type constants (API returns string enums)
const GUILD_VOICE = 'GUILD_VOICE';
const GUILD_CATEGORY = 'GUILD_CATEGORY';
const DM = 'DM';
const GROUP_DM = 'GROUP_DM';

// Stable empty array to avoid creating new references on every selector call
const EMPTY_IDS: string[] = [];

function ChannelIcon({ type }: { type: string | number }) {
  if (type === GUILD_VOICE) return <span className="channel-icon">🔊</span>;
  if (type === DM || type === GROUP_DM) return <span className="channel-icon">@</span>;
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
  const unreadByChannel = useUnreadStore((s) => s.unreadByChannel);

  const dmChannels = useMemo(() => {
    return Array.from(channels.values())
      .filter((ch) => ch.type === DM || ch.type === GROUP_DM)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [channels]);

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
        {guildId ? (
          <button
            className="channel-sidebar-guild-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <h2 className="channel-sidebar-guild-name">{guild?.name ?? 'Gratonite'}</h2>
            <span className="channel-sidebar-chevron">{dropdownOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
        ) : (
          <div className="channel-sidebar-guild-btn is-static">
            <h2 className="channel-sidebar-guild-name">Direct Messages</h2>
          </div>
        )}

        {dropdownOpen && guildId && (
          <div className="channel-sidebar-dropdown">
            <button
              className="dropdown-item"
              onClick={() => { openModal('invite'); setDropdownOpen(false); }}
            >
              Invite People
            </button>
            <button
              className="dropdown-item"
              onClick={() => { openModal('edit-server-profile', { guildId }); setDropdownOpen(false); }}
            >
              Server Profile
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
        {!guildId && (
          <>
            <div className="channel-sidebar-section">
              <span className="channel-sidebar-section-title">DMs</span>
            </div>
            {dmChannels.length === 0 && (
              <div className="channel-empty">No direct messages yet.</div>
            )}
            {dmChannels.map((ch) => (
              <NavLink
                key={ch.id}
                to={`/dm/${ch.id}`}
                className={({ isActive }) =>
                  `channel-item ${isActive ? 'channel-item-active' : ''}`
                }
              >
                <ChannelIcon type={ch.type} />
                <span className="channel-name">{ch.name ?? 'Direct Message'}</span>
                {unreadByChannel.has(ch.id) && <span className="channel-unread-dot" />}
              </NavLink>
            ))}
          </>
        )}

        {guildId && (
          <>
        <div className="channel-sidebar-section">
          <span className="channel-sidebar-section-title">Channels</span>
          {guildId && (
            <button
              className="channel-sidebar-add"
              onClick={() => openModal('create-channel', { guildId })}
              title="Create channel"
            >
              +
            </button>
          )}
        </div>
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
            {unreadByChannel.has(ch.id) && <span className="channel-unread-dot" />}
          </NavLink>
        ))}

        {/* Categorized channels */}
        {categories.map((cat) => {
          const children = allChannels.filter((ch) => ch.parentId === cat.id);
          return (
            <div key={cat.id} className="channel-category">
              <div className="channel-category-header">
                <span className="channel-category-name">{cat.name}</span>
                {guildId && (
                  <button
                    className="channel-category-add"
                    onClick={() => openModal('create-channel', { guildId, parentId: cat.id })}
                    title={`Add channel to ${cat.name}`}
                  >
                    +
                  </button>
                )}
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
                  {unreadByChannel.has(ch.id) && <span className="channel-unread-dot" />}
                </NavLink>
              ))}
            </div>
          );
        })}
          </>
        )}
      </div>

      <UserBar />
    </aside>
  );
}
