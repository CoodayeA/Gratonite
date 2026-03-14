/**
 * RecentChannels — Item 89: Recently visited channels quick-access list
 * Stores last 10 visited channels in localStorage and shows them in the sidebar.
 */
import { useState, useEffect, useCallback } from 'react';
import { Hash, Volume2, Clock } from 'lucide-react';

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

export const RecentChannels = ({ guildId, onChannelClick }: RecentChannelsProps) => {
  const [channels, setChannels] = useState<RecentChannel[]>([]);

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

  if (channels.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)',
      }}>
        <Clock size={10} />
        Recent
      </div>
      {channels.map(ch => (
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
