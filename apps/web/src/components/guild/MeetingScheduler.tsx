/**
 * 112. Meeting Scheduler — "When are you free?" poll with timezone support.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, Users, Check, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

interface TimeSlot { date: string; startTime: string; endTime: string; }
interface MeetingPoll { id: string; title: string; description: string | null; timeSlots: TimeSlot[]; createdBy: string; createdAt: string; }
interface PollWithVotes extends MeetingPoll { votes: Array<{ userId: string; displayName: string; selectedSlots: number[]; timezone: string | null }>; }

export default function MeetingScheduler({ guildId }: { guildId: string }) {
  const [polls, setPolls] = useState<MeetingPoll[]>([]);
  const [activePoll, setActivePoll] = useState<PollWithVotes | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([{ date: '', startTime: '09:00', endTime: '10:00' }]);

  const fetchPolls = useCallback(async () => {
    try { setPolls(await api.meetingScheduler.list(guildId)); } catch {}
  }, [guildId]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const loadPoll = async (pollId: string) => {
    try { setActivePoll(await api.meetingScheduler.get(guildId, pollId)); } catch {}
  };

  const createPoll = async () => {
    if (!title || slots.some(s => !s.date)) return;
    try {
      await api.meetingScheduler.create(guildId, { title, timeSlots: slots });
      setShowCreate(false);
      setTitle('');
      setSlots([{ date: '', startTime: '09:00', endTime: '10:00' }]);
      fetchPolls();
    } catch {}
  };

  const vote = async (selectedSlots: number[]) => {
    if (!activePoll) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await api.meetingScheduler.vote(guildId, activePoll.id, selectedSlots, tz);
      loadPoll(activePoll.id);
    } catch {}
  };

  if (activePoll) {
    const slotVoteCounts = (activePoll.timeSlots || []).map((_, i) =>
      (activePoll.votes || []).filter(v => (v.selectedSlots as number[]).includes(i)).length
    );
    const maxVotes = Math.max(...slotVoteCounts, 1);

    return (
      <div className="p-4 bg-gray-900 rounded-lg">
        <button onClick={() => setActivePoll(null)} className="text-xs text-gray-400 hover:text-white mb-2">Back to polls</button>
        <h3 className="text-white font-medium mb-3">{activePoll.title}</h3>
        <div className="space-y-2">
          {(activePoll.timeSlots as TimeSlot[]).map((slot, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-white">{slot.date} {slot.startTime} - {slot.endTime}</p>
                <div className="mt-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(slotVoteCounts[i] / maxVotes) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{slotVoteCounts[i]} vote{slotVoteCounts[i] !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => vote([i])} className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <h4 className="text-xs text-gray-400 mb-1">Respondents</h4>
          <div className="flex flex-wrap gap-1">
            {(activePoll.votes || []).map(v => (
              <span key={v.userId} className="px-2 py-0.5 bg-gray-800 text-xs text-gray-300 rounded">{v.displayName}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium flex items-center gap-2"><Clock className="w-5 h-5" /> Meeting Scheduler</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          <Plus className="w-4 h-4" /> New Poll
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          {slots.map((slot, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="date" value={slot.date} onChange={e => { const s = [...slots]; s[i] = { ...s[i], date: e.target.value }; setSlots(s); }} className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600" />
              <input type="time" value={slot.startTime} onChange={e => { const s = [...slots]; s[i] = { ...s[i], startTime: e.target.value }; setSlots(s); }} className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600" />
              <span className="text-gray-500 text-sm">to</span>
              <input type="time" value={slot.endTime} onChange={e => { const s = [...slots]; s[i] = { ...s[i], endTime: e.target.value }; setSlots(s); }} className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600" />
              {slots.length > 1 && <button onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="text-red-400 text-xs">Remove</button>}
            </div>
          ))}
          <button onClick={() => setSlots([...slots, { date: '', startTime: '09:00', endTime: '10:00' }])} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add time slot</button>
          <div className="flex gap-2">
            <button onClick={createPoll} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-400">Cancel</button>
          </div>
        </div>
      )}

      {polls.length === 0 ? (
        <p className="text-gray-500 text-sm">No meeting polls yet.</p>
      ) : (
        <div className="space-y-2">
          {polls.map(p => (
            <button key={p.id} onClick={() => loadPoll(p.id)} className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left">
              <p className="text-sm text-white font-medium">{p.title}</p>
              <p className="text-xs text-gray-500">{(p.timeSlots as TimeSlot[]).length} time slot{(p.timeSlots as TimeSlot[]).length !== 1 ? 's' : ''} - {new Date(p.createdAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
