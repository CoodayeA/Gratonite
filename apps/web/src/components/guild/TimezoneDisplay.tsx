/**
 * 119. Timezone Display — Show user's local time on profile.
 * 120. AFK / Away Mode — Auto-reply message display.
 */
import { useState, useEffect } from 'react';
import { Clock, Moon, Globe } from 'lucide-react';
import { api } from '../../lib/api';

export function TimezoneDisplay({ userId }: { userId: string }) {
  const [data, setData] = useState<{ timezone: string | null; localTime: string | null }>({ timezone: null, localTime: null });

  useEffect(() => {
    api.timezone.getUser(userId).then(setData).catch(() => {});
  }, [userId]);

  if (!data.timezone) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <Clock className="w-3 h-3" />
      <span>{data.localTime || data.timezone}</span>
    </div>
  );
}

export function TimezoneSettings() {
  const [timezone, setTimezone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.timezone.get().then(d => { if (d.timezone) setTimezone(d.timezone); }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      await api.timezone.set(tz);
      setTimezone(tz);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const detectTimezone = () => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-300 flex items-center gap-1"><Globe className="w-4 h-4" /> Timezone</label>
      <div className="flex gap-2">
        <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="e.g. America/New_York" className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
        <button onClick={detectTimezone} className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded">Detect</button>
        <button onClick={save} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function AfkDisplay({ userId }: { userId: string }) {
  const [afk, setAfk] = useState<{ message: string; since: string } | null>(null);

  useEffect(() => {
    api.afk.getUser(userId).then(setAfk).catch(() => {});
  }, [userId]);

  if (!afk) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-900/30 border border-yellow-800/50 rounded text-xs text-yellow-300">
      <Moon className="w-3 h-3" />
      <span>AFK: {afk.message}</span>
    </div>
  );
}

export function AfkSettings() {
  const [afk, setAfk] = useState<{ message: string; since: string } | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.afk.get().then(d => { setAfk(d); if (d) setMessage(d.message); }).catch(() => {});
  }, []);

  const toggleAfk = async () => {
    if (afk) {
      await api.afk.clear();
      setAfk(null);
    } else {
      const result = await api.afk.set(message || 'I am currently AFK');
      setAfk(result);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-300 flex items-center gap-1"><Moon className="w-4 h-4" /> AFK / Away Mode</label>
      <div className="flex gap-2">
        <input value={message} onChange={e => setMessage(e.target.value)} placeholder="AFK message..." className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
        <button onClick={toggleAfk} className={`px-3 py-2 text-white text-sm rounded ${afk ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>
          {afk ? 'Disable AFK' : 'Enable AFK'}
        </button>
      </div>
      {afk && <p className="text-xs text-yellow-400">AFK since {new Date(afk.since).toLocaleString()}</p>}
    </div>
  );
}
