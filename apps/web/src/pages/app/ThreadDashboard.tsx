import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageSquare, Search, Filter, Clock, TrendingUp, Users, ChevronDown, Hash, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

interface ThreadDashboardProps {
  guildId: string;
}

interface ThreadItem {
  id: string;
  name: string;
  channelId: string;
  channelName: string;
  lastActivityAt: string;
  messageCount: number;
  participantCount: number;
  participants: Array<{ id: string; username: string; avatarHash: string | null }>;
  lastMessagePreview: string | null;
  lastMessageAuthor: string | null;
  unread: boolean;
}

interface ChannelOption {
  id: string;
  name: string;
}

type SortMode = 'recent' | 'active' | 'popular';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function AvatarStack({ participants }: { participants: ThreadItem['participants'] }) {
  const shown = participants.slice(0, 3);
  return (
    <div style={{ display: 'flex', marginLeft: '4px' }}>
      {shown.map((p, i) => (
        <div
          key={p.id}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--bg-elevated)',
            marginLeft: i > 0 ? '-8px' : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            zIndex: shown.length - i,
          }}
          title={p.username}
        >
          {p.avatarHash ? (
            <img
              src={`/avatars/${p.id}/${p.avatarHash}.webp`}
              alt={p.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            p.username[0]?.toUpperCase()
          )}
        </div>
      ))}
      {participants.length > 3 && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--bg-elevated)',
            marginLeft: '-8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 600,
            color: 'var(--text-muted)',
          }}
        >
          +{participants.length - 3}
        </div>
      )}
    </div>
  );
}

export default function ThreadDashboard({ guildId }: ThreadDashboardProps) {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [threadsRes, channelsRes] = await Promise.all([
          api.getGuildThreads(guildId),
          api.getGuildChannels(guildId),
        ]);
        if (!cancelled) {
          setThreads(Array.isArray(threadsRes) ? threadsRes : []);
          setChannels(
            Array.isArray(channelsRes)
              ? channelsRes.map((c: any) => ({ id: c.id, name: c.name }))
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setThreads([]);
          setChannels([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [guildId]);

  const filtered = useMemo(() => {
    let result = threads;
    if (selectedChannel !== 'all') {
      result = result.filter((t) => t.channelId === selectedChannel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      if (sortMode === 'recent') return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      if (sortMode === 'popular') return b.messageCount - a.messageCount;
      return b.participantCount - a.participantCount;
    });
    return result;
  }, [threads, selectedChannel, searchQuery, sortMode]);

  const sortLabels: Record<SortMode, string> = { recent: 'Most Recent', active: 'Most Active', popular: 'Most Popular' };
  const sortIcons: Record<SortMode, typeof Clock> = { recent: Clock, active: Users, popular: TrendingUp };

  const handleThreadClick = useCallback((thread: ThreadItem) => {
    navigate(`/app/guilds/${guildId}/channels/${thread.channelId}/threads/${thread.id}`);
  }, [navigate, guildId]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--stroke)',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <MessageSquare size={22} style={{ color: 'var(--accent-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Threads</h1>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            borderRadius: '10px',
            padding: '2px 8px',
          }}>
            {filtered.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '6px 12px',
            flex: '1 1 200px',
            maxWidth: '320px',
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search threads..."
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '100%',
              }}
            />
          </div>

          {/* Channel filter */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowChannelDropdown(!showChannelDropdown); setShowSortDropdown(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Hash size={14} />
              {selectedChannel === 'all' ? 'All Channels' : channels.find((c) => c.id === selectedChannel)?.name || 'Channel'}
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showChannelDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 40,
                    minWidth: '180px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                  }}
                >
                  <button
                    onClick={() => { setSelectedChannel('all'); setShowChannelDropdown(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: selectedChannel === 'all' ? 'var(--accent-primary)' : 'none',
                      color: selectedChannel === 'all' ? '#fff' : 'var(--text-primary)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    All Channels
                  </button>
                  {channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => { setSelectedChannel(ch.id); setShowChannelDropdown(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: selectedChannel === ch.id ? 'var(--accent-primary)' : 'none',
                        color: selectedChannel === ch.id ? '#fff' : 'var(--text-primary)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      # {ch.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowSortDropdown(!showSortDropdown); setShowChannelDropdown(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Filter size={14} />
              {sortLabels[sortMode]}
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 40,
                    minWidth: '160px',
                  }}
                >
                  {(['recent', 'active', 'popular'] as SortMode[]).map((mode) => {
                    const Icon = sortIcons[mode];
                    return (
                      <button
                        key={mode}
                        onClick={() => { setSortMode(mode); setShowSortDropdown(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          border: 'none',
                          background: sortMode === mode ? 'var(--accent-primary)' : 'none',
                          color: sortMode === mode ? '#fff' : 'var(--text-primary)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={14} />
                        {sortLabels[mode]}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 24, height: 24, border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            gap: '12px',
          }}>
            <MessageSquare size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {searchQuery ? 'No threads match your search' : 'No active threads in this server'}
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', opacity: 0.7 }}>
              {searchQuery ? 'Try a different search term' : 'Start a thread in any channel to see it here'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px',
          }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((thread) => (
                <motion.div
                  key={thread.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleThreadClick(thread)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    position: 'relative',
                  }}
                  whileHover={{
                    borderColor: 'var(--accent-primary)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {thread.unread && (
                    <div style={{
                      position: 'absolute',
                      top: '14px',
                      right: '14px',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                    }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Hash size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{thread.channelName}</span>
                  </div>

                  <h3 style={{
                    margin: '0 0 8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingRight: thread.unread ? '16px' : 0,
                  }}>
                    {thread.name}
                  </h3>

                  {thread.lastMessagePreview && (
                    <p style={{
                      margin: '0 0 10px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {thread.lastMessageAuthor && (
                        <span style={{ fontWeight: 600 }}>{thread.lastMessageAuthor}: </span>
                      )}
                      {thread.lastMessagePreview}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <MessageSquare size={11} /> {thread.messageCount}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <Users size={11} /> {thread.participantCount}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {timeAgo(thread.lastActivityAt)}
                      </span>
                    </div>
                    <AvatarStack participants={thread.participants || []} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
