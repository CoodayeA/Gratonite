import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, Pin, Calendar, Star, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

interface TimelineEvent {
  id: string;
  guildId: string;
  eventType: string;
  referenceId: string | null;
  title: string;
  description: string | null;
  iconUrl: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface TimelineProps {
  guildId: string;
  canManage?: boolean;
}

const EVENT_ICONS: Record<string, typeof Clock> = {
  member_join: Users,
  milestone: Star,
  pin: Pin,
  event: Calendar,
  custom: Star,
};

const EVENT_COLOR_STYLES: Record<string, React.CSSProperties> = {
  member_join: { color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)' },
  milestone: { color: '#facc15', backgroundColor: 'rgba(250, 204, 21, 0.1)' },
  pin: { color: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)' },
  event: { color: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.1)' },
  custom: { color: 'var(--accent)', backgroundColor: 'rgba(129, 140, 248, 0.1)' },
};

const DEFAULT_EVENT_STYLE: React.CSSProperties = { color: 'var(--text-secondary)', backgroundColor: 'rgba(161, 161, 170, 0.1)' };

export default function Timeline({ guildId, canManage }: TimelineProps) {
  const { addToast } = useToast();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadEvents();
  }, [guildId]);

  async function loadEvents(before?: string) {
    try {
      const query = before ? `?before=${before}&limit=50` : '?limit=50';
      const data = await api.get<TimelineEvent[]>(`/guilds/${guildId}/timeline${query}`);
      if (before) {
        setEvents(prev => [...prev, ...data]);
      } else {
        setEvents(data);
      }
      setHasMore(data.length === 50);
    } catch {
      addToast({ title: 'Failed to load timeline', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function loadMore() {
    if (events.length === 0) return;
    const oldest = events[events.length - 1];
    loadEvents(oldest.createdAt);
  }

  async function handleAddEvent() {
    if (!newTitle.trim()) return;
    try {
      const event = await api.post<TimelineEvent>(`/guilds/${guildId}/timeline`, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setEvents(prev => [event, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setShowAdd(false);
      addToast({ title: 'Event added', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to add event', variant: 'error' });
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/guilds/${guildId}/timeline/${id}`);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch {
      addToast({ title: 'Failed to delete event', variant: 'error' });
    }
  }

  // "On this day" — events from the same month/day in previous years
  const today = new Date();
  const onThisDay = events.filter(e => {
    const d = new Date(e.createdAt);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() !== today.getFullYear();
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem', color: 'var(--text-secondary)' }}>
        Loading timeline...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Clock style={{ width: '20px', height: '20px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Portal Timeline</h2>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--accent)', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '14px', border: 'none', cursor: 'pointer' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Add Event
          </button>
        )}
      </div>

      {showAdd && (
        <div style={{ backgroundColor: 'rgba(63, 63, 70, 0.6)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event title"
            style={{ width: '100%', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', border: 'none', boxSizing: 'border-box' }}
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{ width: '100%', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', resize: 'none', height: '64px', outline: 'none', border: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={handleAddEvent}
              disabled={!newTitle.trim()}
              style={{ backgroundColor: 'var(--accent)', color: '#fff', borderRadius: '8px', padding: '6px 16px', fontSize: '14px', border: 'none', cursor: 'pointer', opacity: !newTitle.trim() ? 0.4 : 1 }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {onThisDay.length > 0 && (
        <div style={{ backgroundColor: 'rgba(250, 204, 21, 0.05)', border: '1px solid rgba(250, 204, 21, 0.2)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar style={{ width: '16px', height: '16px' }} />
            On This Day
          </h3>
          {onThisDay.map(e => (
            <div key={e.id} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(e.createdAt).getFullYear()}</span> - {e.title}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '20px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--bg-tertiary)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.eventType] ?? Star;
            const colorStyle = EVENT_COLOR_STYLES[event.eventType] ?? DEFAULT_EVENT_STYLE;

            const cardStyle: React.CSSProperties = event.eventType === 'milestone'
              ? { flex: 1, borderRadius: '8px', padding: '12px', backgroundColor: 'rgba(250, 204, 21, 0.05)', border: '1px solid rgba(250, 204, 21, 0.2)' }
              : { flex: 1, borderRadius: '8px', padding: '12px', backgroundColor: 'rgba(63, 63, 70, 0.4)' };

            return (
              <div key={event.id} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '16px', paddingLeft: '4px' }}>
                <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '9999px', flexShrink: 0, ...colorStyle }}>
                  <Icon style={{ width: '16px', height: '16px' }} />
                </div>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{event.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                      {canManage && (
                        <button onClick={() => handleDelete(event.id)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                        </button>
                      )}
                    </div>
                  </div>
                  {event.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{event.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasMore && events.length > 0 && (
        <button
          onClick={loadMore}
          style={{ width: '100%', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Load more
        </button>
      )}

      {events.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>
          No timeline events yet.
          {canManage && ' Click "Add Event" to create the first one.'}
        </div>
      )}
    </div>
  );
}
