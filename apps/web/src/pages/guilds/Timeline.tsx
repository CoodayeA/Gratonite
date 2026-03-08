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

const EVENT_COLORS: Record<string, string> = {
  member_join: 'text-green-400 bg-green-400/10',
  milestone: 'text-yellow-400 bg-yellow-400/10',
  pin: 'text-blue-400 bg-blue-400/10',
  event: 'text-purple-400 bg-purple-400/10',
  custom: 'text-indigo-400 bg-indigo-400/10',
};

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
    return <div className="flex items-center justify-center h-64 text-zinc-400">Loading timeline...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100">
          <Clock className="w-5 h-5" />
          <h2 className="text-xl font-bold">Server Timeline</h2>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-indigo-500"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-zinc-800/60 rounded-lg p-4 space-y-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event title"
            className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm resize-none h-16 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1">Cancel</button>
            <button onClick={handleAddEvent} disabled={!newTitle.trim()} className="bg-indigo-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-indigo-500 disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      )}

      {onThisDay.length > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            On This Day
          </h3>
          {onThisDay.map(e => (
            <div key={e.id} className="text-sm text-zinc-300">
              <span className="text-zinc-500">{new Date(e.createdAt).getFullYear()}</span> - {e.title}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-700" />

        <div className="space-y-4">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.eventType] ?? Star;
            const colorClasses = EVENT_COLORS[event.eventType] ?? 'text-zinc-400 bg-zinc-400/10';

            return (
              <div key={event.id} className="relative flex items-start gap-4 pl-1">
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${colorClasses}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`flex-1 rounded-lg p-3 ${event.eventType === 'milestone' ? 'bg-yellow-400/5 border border-yellow-400/20' : 'bg-zinc-800/40'}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-zinc-100">{event.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                      {canManage && (
                        <button onClick={() => handleDelete(event.id)} className="text-zinc-500 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-xs text-zinc-400 mt-1">{event.description}</p>
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
          className="w-full text-center text-sm text-zinc-400 hover:text-zinc-200 py-2"
        >
          Load more
        </button>
      )}

      {events.length === 0 && (
        <div className="text-center text-zinc-500 py-12">
          No timeline events yet.
          {canManage && ' Click "Add Event" to create the first one.'}
        </div>
      )}
    </div>
  );
}
