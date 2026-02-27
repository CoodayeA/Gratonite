import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';
import { api } from '@/lib/api';
import type { Channel } from '@gratonite/types';

interface ScheduledMessage {
  id: string;
  channelId: string;
  channelName: string;
  guildId: string;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
}

const s = {
  page: {
    padding: 24,
    color: '#e8e4e0',
    minHeight: '100%',
    background: '#2c2c3e',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 64,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#e8e4e0',
  },
  createBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 4,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    marginBottom: 20,
    width: 'fit-content',
  },
  filterBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  filterBtnActive: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#413d58',
    color: '#e8e4e0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(232, 90, 110, 0.1)',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    marginBottom: 16,
    color: '#e85a6e',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 48,
    color: '#6e6a80',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
  },
  card: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  channel: {
    flexShrink: 0,
  },
  channelName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  contentText: {
    margin: 0,
    fontSize: 14,
    color: '#e8e4e0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  time: {
    flexShrink: 0,
  },
  schedule: {
    fontSize: 12,
    color: '#a8a4b8',
  },
  status: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '6px 12px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 12px',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#e85a6e',
    fontSize: 12,
    cursor: 'pointer',
  },
};

export function ScheduledMsgsPage() {
  const { guildId } = useParams();
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'sent' | 'cancelled' | 'all'>('pending');

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedContent, setSchedContent] = useState('');
  const [schedChannelId, setSchedChannelId] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    async function fetchMessages() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/scheduled-messages?status=${filter}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch scheduled messages');
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
  }, [guildId, filter]);

  useEffect(() => {
    if (!showScheduleModal || !guildId) return;
    setChannelsLoading(true);
    api.channels.getGuildChannels(guildId)
      .then((data) => {
        setChannels(data);
        if (data.length > 0 && !schedChannelId && data[0]) {
          setSchedChannelId(data[0].id);
        }
      })
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false));
  }, [showScheduleModal, guildId]);

  const handleCancel = async (messageId: string) => {
    try {
      const res = await fetch(`/api/v1/scheduled-messages/${messageId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel');
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, status: 'cancelled' as const } : m
      ));
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch(`/api/v1/scheduled-messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSchedule = async () => {
    if (!guildId) return;
    if (!schedChannelId) { setSchedError('Please select a channel'); return; }
    if (!schedContent.trim()) { setSchedError('Content is required'); return; }
    if (!schedTime) { setSchedError('Please select a time'); return; }
    setScheduling(true);
    setSchedError(null);
    try {
      await api.scheduledMessages.create(guildId, {
        channelId: schedChannelId,
        content: schedContent.trim(),
        scheduledFor: new Date(schedTime).toISOString(),
      });
      // Refresh list
      const res = await fetch(`/api/v1/guilds/${guildId}/scheduled-messages?status=${filter}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
      setShowScheduleModal(false);
      setSchedContent('');
      setSchedChannelId('');
      setSchedTime('');
    } catch (err) {
      setSchedError(err instanceof Error ? err.message : 'Failed to schedule message');
    } finally {
      setScheduling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#d4af37';
      case 'sent': return '#6aea8a';
      case 'cancelled': return '#e85a6e';
      default: return '#a8a4b8';
    }
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loading}>
          <div style={s.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Scheduled Messages</h1>
        <button style={s.createBtn} onClick={() => setShowScheduleModal(true)}>Schedule Message</button>
      </div>

      <div style={s.filters}>
        <button
          style={filter === 'pending' ? s.filterBtnActive : s.filterBtn}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          style={filter === 'sent' ? s.filterBtnActive : s.filterBtn}
          onClick={() => setFilter('sent')}
        >
          Sent
        </button>
        <button
          style={filter === 'cancelled' ? s.filterBtnActive : s.filterBtn}
          onClick={() => setFilter('cancelled')}
        >
          Cancelled
        </button>
        <button
          style={filter === 'all' ? s.filterBtnActive : s.filterBtn}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {error && <div style={s.error}><p style={{ margin: 0 }}>{error}</p></div>}

      <div style={s.list}>
        {messages.length === 0 ? (
          <div style={s.empty}>
            <h3 style={s.emptyTitle}>No scheduled messages</h3>
            <p style={s.emptyText}>Schedule a message to send later</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={s.card}>
              <div style={s.channel}>
                <span style={s.channelName}># {msg.channelName}</span>
              </div>
              <div style={s.content}>
                <p style={s.contentText}>{msg.content}</p>
              </div>
              <div style={s.time}>
                <span style={s.schedule}>{formatDate(msg.scheduledFor)}</span>
              </div>
              <div style={s.status}>
                <span style={{ color: getStatusColor(msg.status) }}>{msg.status}</span>
              </div>
              <div style={s.actions}>
                {msg.status === 'pending' && (
                  <button
                    style={s.cancelBtn}
                    onClick={() => handleCancel(msg.id)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  style={s.deleteBtn}
                  onClick={() => handleDelete(msg.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowScheduleModal(false)}
        >
          <div
            style={{
              background: '#2c2c3e',
              border: '1px solid #4a4660',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e8e4e0' }}>Schedule Message</h2>

            {schedError && (
              <div style={{ padding: '8px 12px', background: 'rgba(232,90,110,0.15)', color: '#e85a6e', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {schedError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Channel</label>
              {channelsLoading ? (
                <div style={{ fontSize: 13, color: '#a8a4b8' }}>Loading channels...</div>
              ) : (
                <select
                  value={schedChannelId}
                  onChange={(e) => setSchedChannelId(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #4a4660',
                    background: '#25243a',
                    color: '#e8e4e0',
                    fontSize: 14,
                    outline: 'none',
                  }}
                >
                  <option value="">Select a channel</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      # {ch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Message</label>
              <textarea
                value={schedContent}
                onChange={(e) => setSchedContent(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Write your message..."
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #4a4660',
                  background: '#25243a',
                  color: '#e8e4e0',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: 11, color: '#6e6a80', textAlign: 'right' }}>{schedContent.length}/4000</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#a8a4b8' }}>Scheduled Time</label>
              <input
                type="datetime-local"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #4a4660',
                  background: '#25243a',
                  color: '#e8e4e0',
                  fontSize: 14,
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowScheduleModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #4a4660',
                  background: 'transparent',
                  color: '#a8a4b8',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduling}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d4af37',
                  color: '#1a1a2e',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: scheduling ? 'not-allowed' : 'pointer',
                  opacity: scheduling ? 0.7 : 1,
                }}
              >
                {scheduling ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
