import { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface ReminderPickerProps {
  messageId: string;
  channelId: string;
  guildId?: string;
  onClose: () => void;
}

const QUICK_OPTIONS = [
  { label: 'In 30 minutes', minutes: 30 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'In 3 hours', minutes: 180 },
  { label: 'Tomorrow morning', minutes: -1 },
];

function getTomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function ReminderPicker({ messageId, channelId, guildId, onClose }: ReminderPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [note, setNote] = useState('');
  const { addToast } = useToast();

  async function createReminder(remindAt: Date) {
    try {
      await api.post<void>('/reminders', {
        messageId,
        channelId,
        guildId,
        remindAt: remindAt.toISOString(),
        note: note || undefined,
      });
      addToast({ title: 'Reminder set', variant: 'success' });
      onClose();
    } catch {
      addToast({ title: 'Failed to set reminder', variant: 'error' });
    }
  }

  function handleQuickOption(minutes: number) {
    if (minutes === -1) {
      createReminder(getTomorrowMorning());
    } else {
      createReminder(new Date(Date.now() + minutes * 60 * 1000));
    }
  }

  function handleCustomSubmit() {
    if (!customDate || !customTime) {
      addToast({ title: 'Pick a date and time', variant: 'error' });
      return;
    }
    const dt = new Date(`${customDate}T${customTime}`);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      addToast({ title: 'Must be a future date', variant: 'error' });
      return;
    }
    createReminder(dt);
  }

  return (
    <div className="absolute right-0 bottom-8 z-50 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-white flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Set Reminder
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1">
        {QUICK_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => handleQuickOption(opt.minutes)}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
          >
            {opt.label}
          </button>
        ))}

        <button
          onClick={() => setShowCustom(!showCustom)}
          className="w-full text-left px-3 py-1.5 text-sm text-indigo-400 hover:bg-gray-700 rounded"
        >
          Custom date/time...
        </button>
      </div>

      {showCustom && (
        <div className="mt-2 space-y-2 border-t border-gray-700 pt-2">
          <input
            type="date"
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
          />
          <input
            type="time"
            value={customTime}
            onChange={e => setCustomTime(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
          />
          <button
            onClick={handleCustomSubmit}
            className="w-full py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
          >
            Set Reminder
          </button>
        </div>
      )}
    </div>
  );
}
