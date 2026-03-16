import { useState, useEffect, useCallback } from 'react';
import { Bell, Search, Hash, ExternalLink, Users, Plus, X, ArrowRight, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';

interface ChannelFollowingProps {
  channelId: string;
  guildId: string;
  isAnnouncement?: boolean;
}

interface Follower {
  id: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  channelId: string;
  channelName: string;
  followedAt: string;
}

interface AnnouncementChannel {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
}

interface LocalChannel {
  id: string;
  name: string;
}

export function ChannelFollowing({ channelId, guildId, isAnnouncement }: ChannelFollowingProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [announcementChannels, setAnnouncementChannels] = useState<AnnouncementChannel[]>([]);
  const [localChannels, setLocalChannels] = useState<LocalChannel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<AnnouncementChannel | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [following, setFollowing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (isAnnouncement) {
          const res = await api.getChannelFollowers?.(channelId);
          if (!cancelled) setFollowers(Array.isArray(res) ? res : []);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [channelId, isAnnouncement]);

  const openFollowModal = useCallback(async () => {
    setShowFollowModal(true);
    setSearchQuery('');
    setSelectedSource(null);
    setSelectedDestination('');
    setSearchLoading(true);
    try {
      const [channels, local] = await Promise.all([
        api.discoverAnnouncementChannels?.() || [],
        api.getGuildChannels(guildId),
      ]);
      setAnnouncementChannels(Array.isArray(channels) ? channels : []);
      setLocalChannels(Array.isArray(local) ? local.map((c: any) => ({ id: c.id, name: c.name })) : []);
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, [guildId]);

  const handleFollow = useCallback(async () => {
    if (!selectedSource || !selectedDestination) return;
    setFollowing(true);
    try {
      await api.followChannel?.(selectedSource.id, { webhookChannelId: selectedDestination });
      setShowFollowModal(false);
    } catch { /* ignore */ }
    setFollowing(false);
  }, [selectedSource, selectedDestination]);

  const filteredChannels = announcementChannels.filter((ch) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return ch.name.toLowerCase().includes(q) || ch.guildName.toLowerCase().includes(q);
  });

  // Mode A: Followers panel (announcement channel)
  if (isAnnouncement) {
    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '10px',
        border: '1px solid var(--stroke)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--stroke)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Followers</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-primary)',
              color: 'var(--text-muted)',
              borderRadius: '10px',
              padding: '1px 7px',
            }}>
              {followers.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 18, height: 18, border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }}
            />
          </div>
        ) : followers.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No servers are following this channel yet
          </div>
        ) : (
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {followers.map((f) => (
              <div key={f.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px',
                borderBottom: '1px solid var(--stroke)',
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {f.guildIcon ? (
                    <img src={`/icons/${f.guildId}/${f.guildIcon}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    f.guildName[0]?.toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.guildName}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    #{f.channelName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Mode B: Follow Channel button
  return (
    <>
      <button
        onClick={openFollowModal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '6px',
          border: 'none',
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      >
        <Bell size={13} />
        Follow Channel
      </button>

      {/* Follow Modal */}
      <AnimatePresence>
        {showFollowModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFollowModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-elevated)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '480px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid var(--stroke)',
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Follow a Channel</span>
                </div>
                <button onClick={() => setShowFollowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {/* Search */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '14px',
                }}>
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search announcement channels..."
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

                {searchLoading ? (
                  <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                    <Loader size={18} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <>
                    {/* Source channel list */}
                    <div style={{ marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Announcement Channels
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredChannels.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No announcement channels found
                          </div>
                        ) : (
                          filteredChannels.map((ch) => (
                            <button
                              key={ch.id}
                              onClick={() => setSelectedSource(ch)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: selectedSource?.id === ch.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                background: selectedSource?.id === ch.id ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left',
                              }}
                            >
                              <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                flexShrink: 0,
                              }}>
                                {ch.guildIcon ? (
                                  <img src={`/icons/${ch.guildId}/${ch.guildIcon}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  ch.guildName[0]?.toUpperCase()
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{ch.guildName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <Hash size={10} style={{ verticalAlign: 'middle' }} /> {ch.name}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Destination channel */}
                    {selectedSource && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Post to Channel
                        </span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '8px',
                          padding: '4px 0',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <Hash size={12} /> {selectedSource.name}
                          </div>
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                          <select
                            value={selectedDestination}
                            onChange={(e) => setSelectedDestination(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--stroke)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              outline: 'none',
                            }}
                          >
                            <option value="">Select a channel...</option>
                            {localChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}>#{ch.name}</option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--stroke)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}>
                <button
                  onClick={() => setShowFollowModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--stroke)',
                    background: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFollow}
                  disabled={!selectedSource || !selectedDestination || following}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !selectedSource || !selectedDestination || following ? 'not-allowed' : 'pointer',
                    opacity: !selectedSource || !selectedDestination || following ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {following ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={14} />}
                  Follow
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
