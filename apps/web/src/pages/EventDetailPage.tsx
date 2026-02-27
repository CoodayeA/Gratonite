import { useState, CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const S = {
  page: {
    display: 'flex',
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--bg-purple-dark)',
    borderRight: '1px solid var(--stroke)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTitle: {
    padding: '20px 16px 8px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  sidebarSection: {
    padding: '8px 16px 4px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 8px',
  },
  sidebarEvent: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    marginBottom: 4,
    cursor: 'pointer',
    background: 'var(--bg-soft)',
  },
  sidebarEventName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 2,
  },
  sidebarEventDate: {
    fontSize: 11,
    color: 'var(--accent)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  banner: {
    height: 180,
    background: 'linear-gradient(135deg, var(--bg-purple-velvet), var(--bg-purple-dark))',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 20,
    position: 'relative',
    flexShrink: 0,
  },
  bannerBadge: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    background: 'var(--gold-subtle)',
    border: '1px solid var(--border-gold)',
    color: 'var(--accent)',
    borderRadius: 'var(--radius-pill)',
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  infoRow: {
    display: 'flex',
    gap: 16,
  },
  infoCard: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  description: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 20,
  },
  descTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 10,
  },
  descBody: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  rsvpRow: {
    display: 'flex',
    gap: 12,
  },
  rsvpBtnGold: {
    flex: 1,
    height: 42,
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  rsvpBtnGhost: {
    flex: 1,
    height: 42,
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid var(--stroke)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  attendeesSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  attendeesLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  attendeesRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-soft)',
    border: '2px solid var(--stroke)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '16px 24px 0',
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function EventDetailPage() {
  const { guildId, eventId } = useParams<{ guildId: string; eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rsvp, setRsvp] = useState<'going' | 'maybe' | 'declined' | null>(null);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', guildId, eventId],
    queryFn: () => api.events.get(guildId!, eventId!),
    enabled: !!guildId && !!eventId,
  });

  const { data: allEvents } = useQuery({
    queryKey: ['events', guildId],
    queryFn: () => api.events.list(guildId!),
    enabled: !!guildId,
  });

  const markInterested = useMutation({
    mutationFn: () => api.events.markInterested(guildId!, eventId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', guildId, eventId] }),
  });

  const unmarkInterested = useMutation({
    mutationFn: () => api.events.unmarkInterested(guildId!, eventId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', guildId, eventId] }),
  });

  function handleRsvp(choice: 'going' | 'maybe' | 'declined') {
    if (rsvp === choice) {
      setRsvp(null);
      unmarkInterested.mutate();
    } else {
      setRsvp(choice);
      if (choice === 'going') markInterested.mutate();
    }
  }

  if (isLoading) {
    return (
      <div style={S.page}>
        <div style={S.loading}>Loading event…</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={S.page}>
        <div style={S.loading}>Event not found.</div>
      </div>
    );
  }

  const sidebarEvents = (allEvents ?? []).filter((e: any) => e.id !== eventId).slice(0, 8);

  return (
    <div style={S.page}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTitle}>Events</div>
        <div style={S.sidebarSection}>Upcoming Events</div>
        <div style={S.sidebarList}>
          {sidebarEvents.map((e: any) => (
            <div
              key={e.id}
              style={S.sidebarEvent}
              onClick={() => navigate(`/events/${guildId}/${e.id}`)}
            >
              <div style={S.sidebarEventName}>{e.name}</div>
              <div style={S.sidebarEventDate}>{formatDate(e.startTime)}</div>
            </div>
          ))}
          {sidebarEvents.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
              No other events
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        <button style={S.backBtn} onClick={() => navigate(`/events/${guildId}`)}>
          ← Back to Events
        </button>
        <div style={S.banner}>
          <span style={S.bannerBadge}>{event.status ?? 'UPCOMING'}</span>
          <div style={S.bannerTitle}>{event.name}</div>
          <div style={S.bannerSubtitle}>
            {event.creatorId ? `Hosted by ${event.creatorId} · ` : ''}Event
          </div>
        </div>

        <div style={S.content}>
          {/* Info row */}
          <div style={S.infoRow}>
            <div style={S.infoCard}>
              <div style={S.infoCardLabel}>Date</div>
              <div style={S.infoCardValue}>{formatDate(event.startTime)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(event.startTime)}</div>
            </div>
            <div style={S.infoCard}>
              <div style={S.infoCardLabel}>Location / Type</div>
              <div style={S.infoCardValue}>{event.location ?? event.entityType ?? '—'}</div>
            </div>
            <div style={S.infoCard}>
              <div style={S.infoCardLabel}>Interested</div>
              <div style={S.infoCardValue}>{event.interestedCount ?? 0} Going</div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div style={S.description}>
              <div style={S.descTitle}>About This Event</div>
              <div style={S.descBody}>{event.description}</div>
            </div>
          )}

          {/* RSVP */}
          <div style={S.rsvpRow}>
            <button
              style={{ ...S.rsvpBtnGold, opacity: rsvp === 'going' ? 1 : 0.75 }}
              onClick={() => handleRsvp('going')}
            >
              {rsvp === 'going' ? '✓ Going' : 'Going'}
            </button>
            <button
              style={{ ...S.rsvpBtnGhost, borderColor: rsvp === 'maybe' ? 'var(--accent)' : undefined }}
              onClick={() => handleRsvp('maybe')}
            >
              Maybe
            </button>
            <button
              style={{ ...S.rsvpBtnGhost, borderColor: rsvp === 'declined' ? 'var(--danger)' : undefined }}
              onClick={() => handleRsvp('declined')}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
