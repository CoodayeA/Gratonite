/**
 * 118. Standup Bot — Daily prompts and summary display.
 */
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Send, Settings, Users, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

export default function StandupBot({ guildId }: { guildId: string }) {
  const [config, setConfig] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ channelId: '', schedule: '09:00', timezone: 'UTC' });
  const { addToast } = useToast();

  const fetch_ = useCallback(async () => {
    try {
      const c = await api.standup.getConfig(guildId);
      setConfig(c);
      if (c) {
        const s = await api.standup.getSummary(guildId);
        setSummary(s);
        setAnswers(Array((s?.questions as string[] || []).length).fill(''));
      }
    } catch { addToast({ title: 'Failed to load standup', variant: 'error' }); }
  }, [guildId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const submitResponse = async () => {
    if (answers.every(a => !a.trim())) return;
    try {
      await api.standup.respond(guildId, answers);
      fetch_();
    } catch { addToast({ title: 'Failed to submit standup', variant: 'error' }); }
  };= async () => {
    try {
      await api.standup.setConfig(guildId, configForm);
      setShowConfig(false);
      fetch_();
    } catch { addToast({ title: 'Failed to save standup config', variant: 'error' }); }
  };= (summary?.questions || config?.questions || []) as string[];

  return (
    <div className="p-4 bg-gray-900 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center gap-2"><ClipboardList className="w-5 h-5 text-orange-400" /> Daily Standup</h3>
        <button onClick={() => setShowConfig(!showConfig)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showConfig && (
        <div className="p-3 bg-gray-800 rounded-lg space-y-2">
          <input value={configForm.channelId} onChange={e => setConfigForm({ ...configForm, channelId: e.target.value })} placeholder="Channel ID" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          <div className="flex gap-2">
            <input value={configForm.schedule} onChange={e => setConfigForm({ ...configForm, schedule: e.target.value })} placeholder="Time (HH:MM)" className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
            <input value={configForm.timezone} onChange={e => setConfigForm({ ...configForm, timezone: e.target.value })} placeholder="Timezone" className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          </div>
          <button onClick={saveConfig} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded">Save Config</button>
        </div>
      )}

      {/* Response form */}
      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q: string, i: number) => (
            <div key={i}>
              <label className="text-sm text-gray-300 block mb-1">{q}</label>
              <textarea value={answers[i] || ''} onChange={e => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 h-16" placeholder="Your response..." />
            </div>
          ))}
          <button onClick={submitResponse} className="flex items-center gap-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded">
            <Send className="w-4 h-4" /> Submit Standup
          </button>
        </div>
      )}

      {/* Today's summary */}
      {summary?.responses?.length > 0 && (
        <div>
          <h4 className="text-sm text-gray-300 font-medium mb-2 flex items-center gap-1">
            <Users className="w-4 h-4" /> Today's Responses ({summary.date})
          </h4>
          <div className="space-y-3">
            {summary.responses.map((r: any) => (
              <div key={r.id} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs text-white">{(r.displayName || r.username || '?')[0]}</div>
                  <span className="text-sm text-white font-medium">{r.displayName || r.username}</span>
                  <span className="text-xs text-gray-500 ml-auto">{new Date(r.createdAt).toLocaleTimeString()}</span>
                </div>
                {(r.answers as string[]).map((a: string, i: number) => (
                  <div key={i} className="mb-1">
                    <p className="text-xs text-gray-400">{questions[i]}</p>
                    <p className="text-sm text-gray-300">{a}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!config && !showConfig && (
        <p className="text-gray-500 text-sm">No standup configured. Click the settings gear to set up daily standups.</p>
      )}
    </div>
  );
}
