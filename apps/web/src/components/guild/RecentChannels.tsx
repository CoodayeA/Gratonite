/**
 * RecentChannels — Item 89: Recently visited channels quick-access list
 * Stores last 10 visited channels in localStorage and shows them in the sidebar.
 */
import { useState, useEffect, useCallback } from 'react';
import { Hash, Volume2, Clock, ChevronDown } from 'lucide-react';

const COLLAPSED_KEY = 'gratonite:recent-channels-collapsed';

const STORAGE_KEY = 'gratonite:recent-channels';
const MAX_RECENT = 10;

export interface RecentChannel {
  id: string;
  name: string;
  guildId: string;
  type: string;
  visitedAt: number;
}

export function getRecentChannels(): RecentChannel[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecentChannel(channel: Omit<RecentChannel, 'visitedAt'>) {
  const recent = getRecentChannels().filter(c => c.id !== channel.id);
  recent.unshift({ ...channel, visitedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  window.dispatchEvent(new Event('gratonite:recent-channels-updated'));
}

interface RecentChannelsProps {
  guildId?: string;
  onChannelClick: (channelId: string, guildId: string) => void;
}

function getCollapsed(guildId?: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}');
    return !!map[guildId ?? '__global__'];
  } catch {
    return false;
  }
}

function setCollapsed(guildId: string | undefined, value: boolean) {
  try {
    const map = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}');
    map[guildId ?? '__global__'] = value;
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const RecentChannels = ({ guildId, onChannelClick }: RecentChannelsProps) => {
  const [channels, setChannels] = useState<RecentChannel[]>([]);
  const [collapsed, setCollapsedState] = useState(() => getCollapsed(guildId));

  const load = useCallback(() => {
    let recent = getRecentChannels();
    if (guildId) recent = recent.filter(c => c.guildId === guildId);
    setChannels(recent.slice(0, 5));
  }, [guildId]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('gratonite:recent-channels-updated', handler);
    return () => window.removeEventListener('gratonite:recent-channels-updated', handler);
  }, [load]);

  // Re-read collapsed state when guildId changes (switching servers)
  useEffect(() => {
    setCollapsedState(getCollapsed(guildId));
  }, [guildId]);

  if (channels.length === 0) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsedState(next);
    setCollapsed(guildId, next);
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
          padding: '4px 12px', fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--text-muted)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand Recent' : 'Collapse Recent'}
      >
        <Clock size={10} />
        <span style={{ flex: 1 }}>Recent</span>
        <ChevronDown
          size={12}
          style={{
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {!collapsed && channels.map(ch => (
        <div
          key={ch.id}
          onClick={() => onChannelClick(ch.id, ch.guildId)}
          className="channel-item"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px', cursor: 'pointer', fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          {ch.type === 'GUILD_VOICE' ? <Volume2 size={14} /> : <Hash size={14} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
        </div>
      ))}
    </div>
  );
};

export default RecentChannels;
