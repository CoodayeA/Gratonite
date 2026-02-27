import { useEffect, useState, CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface ScheduledEvent {
  id: string;
  guildId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  entityType: 'STAGE' | 'VOICE' | 'EXTERNAL';
  location?: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  creatorId: string;
  interestedCount: number;
  imageUrl?: string;
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#2c2c3e',
    color: '#e8e4e0',
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 12,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
    color: '#a8a4b8',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #4a4660',
  },
  headerTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  createBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 4,
    padding: '12px 24px',
    borderBottom: '1px solid #4a4660',
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#4a4660',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  filterBtnActive: {
    background: '#413d58',
    color: '#e8e4e0',
    borderColor: '#d4af37',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    gap: 8,
    color: '#6e6a80',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  emptyText: {
    margin: 0,
    fontSize: 13,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#353348',
  },
  info: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  eventName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  eventDesc: {
    margin: 0,
    fontSize: 13,
    color: '#a8a4b8',
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as any,
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: 13,
    color: '#6e6a80',
  },
  actions: {
    padding: '0 16px 16px',
    display: 'flex',
    gap: 8,
  },
  rsvpBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rsvpBtnActive: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #d4af37',
    background: 'rgba(212,175,55,0.15)',
    color: '#d4af37',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const getStatusStyle = (status: string): CSSProperties => {
  const base: CSSProperties = {
    padding: '3px 10px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };
  switch (status) {
    case 'ACTIVE':
      return { ...base, background: 'rgba(106, 234, 138, 0.15)', color: '#6aea8a' };
    case 'SCHEDULED':
      return { ...base, background: 'rgba(212, 175, 55, 0.15)', color: '#d4af37' };
    case 'COMPLETED':
      return { ...base, background: 'rgba(110, 106, 128, 0.15)', color: '#6e6a80' };
    case 'CANCELLED':
      return { ...base, background: 'rgba(232, 90, 110, 0.15)', color: '#e85a6e' };
    default:
      return { ...base, background: 'rgba(168, 164, 184, 0.15)', color: '#a8a4b8' };
  }
};

export function EventsPage() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'active' | 'past'>('upcoming');
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchEvents() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/scheduled-events?status=${filter}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch events');
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [guildId, filter]);

  const handleToggleInterested = async (eventId: string) => {
    if (!guildId) return;
    const isInterested = interestedIds.has(eventId);
    try {
      if (isInterested) {
        await api.events.unmarkInterested(guildId, eventId);
        setInterestedIds(prev => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
        setEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, interestedCount: Math.max(0, e.interestedCount - 1) } : e
        ));
      } else {
        await api.events.markInterested(guildId, eventId);
        setInterestedIds(prev => new Set([...prev, eventId]));
        setEvents(prev => prev.map(e =>
          e.id === eventId ? { ...e, interestedCount: e.interestedCount + 1 } : e
        ));
      }
    } catch (err) {
      console.error('RSVP failed:', err);
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

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>
          <p>Unable to load events</p>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Events</h1>
        <button
          style={styles.createBtn}
          onClick={() => navigate(`/events/${guildId}/create`)}
        >
          Create Event
        </button>
      </div>

      <div style={styles.filters}>
        {(['upcoming', 'active', 'past'] as const).map((f) => (
          <button
            key={f}
            style={{
              ...styles.filterBtn,
              ...(filter === f ? styles.filterBtnActive : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {events.length === 0 ? (
          <div style={styles.empty}>
            <h3 style={styles.emptyTitle}>No events</h3>
            <p style={styles.emptyText}>There are no {filter} events scheduled</p>
          </div>
        ) : (
          events.map((event) => {
            const isInterested = interestedIds.has(event.id);
            return (
              <div key={event.id} style={styles.card}>
                {event.imageUrl && (
                  <div style={{ ...styles.image, backgroundImage: `url(${event.imageUrl})` }} />
                )}
                <div style={styles.info}>
                  <span style={getStatusStyle(event.status)}>{event.status}</span>
                  <h3 style={styles.eventName}>{event.name}</h3>
                  {event.description && <p style={styles.eventDesc}>{event.description}</p>}
                  <div style={styles.meta}>
                    <span>&#128336; {formatDate(event.startTime)}</span>
                    {event.entityType === 'EXTERNAL' && event.location && (
                      <span>&#128205; {event.location}</span>
                    )}
                    <span>&#128077; {event.interestedCount} interested</span>
                  </div>
                </div>
                {event.status === 'SCHEDULED' && (
                  <div style={styles.actions}>
                    <button
                      style={isInterested ? styles.rsvpBtnActive : styles.rsvpBtn}
                      onClick={() => handleToggleInterested(event.id)}
                    >
                      {isInterested ? '✓ Interested' : 'Interested'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
