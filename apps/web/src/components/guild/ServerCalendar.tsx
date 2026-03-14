/**
 * 109. Shared Calendar — Server calendar with events and RSVP.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, Users, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  color: string;
  createdBy: string;
}

export default function ServerCalendar({ guildId }: { guildId: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [month, setMonth] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startAt: '', endAt: '', color: '#5865F2' });

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.calendars.list(guildId);
      setEvents(data);
    } catch { /* ignore */ }
  }, [guildId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const createEvent = async () => {
    if (!form.title || !form.startAt) return;
    try {
      await api.calendars.create(guildId, form);
      setShowCreate(false);
      setForm({ title: '', description: '', startAt: '', endAt: '', color: '#5865F2' });
      fetchEvents();
    } catch { /* ignore */ }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await api.calendars.delete(guildId, eventId);
      fetchEvents();
    } catch { /* ignore */ }
  };

  const rsvp = async (eventId: string, status: string) => {
    try {
      await api.calendars.rsvp(guildId, eventId, status);
    } catch { /* ignore */ }
  };

  // Calendar grid
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.startAt.startsWith(dateStr));
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(new Date(year, mo - 1))} className="p-1 text-gray-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-white font-medium">
            {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => setMonth(new Date(year, mo + 1))} className="p-1 text-gray-400 hover:text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600 h-16" />
          <div className="flex gap-2">
            <input type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
            <input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" placeholder="End (optional)" />
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
          </div>
          <div className="flex gap-2">
            <button onClick={createEvent} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 text-gray-400 hover:text-white text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-700 rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-gray-800 px-2 py-1.5 text-center text-xs text-gray-400 font-medium">{d}</div>
        ))}
        {days.map((day, i) => (
          <div key={i} className={`bg-gray-900 min-h-[80px] p-1 ${day ? '' : 'opacity-30'}`}>
            {day && (
              <>
                <span className={`text-xs ${day === new Date().getDate() && mo === new Date().getMonth() && year === new Date().getFullYear() ? 'text-indigo-400 font-bold' : 'text-gray-400'}`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {getEventsForDay(day).map(ev => (
                    <div key={ev.id} className="group flex items-center gap-1 px-1 py-0.5 rounded text-xs truncate cursor-pointer" style={{ backgroundColor: ev.color + '33', color: ev.color }}>
                      <span className="truncate flex-1">{ev.title}</span>
                      <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Upcoming Events</h4>
        <div className="space-y-2">
          {events
            .filter(e => new Date(e.startAt) >= new Date())
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 5)
            .map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: ev.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ev.startAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {['going', 'maybe', 'not_going'].map(s => (
                    <button key={s} onClick={() => rsvp(ev.id, s)} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded capitalize">
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
