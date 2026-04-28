import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Play, Pause, Square, Clock, Flame, Trophy, Settings, Volume2, Coffee, BookOpen } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { api } from '../../lib/api';

type Phase = 'work' | 'break' | 'idle';
type AmbientSound = 'rain' | 'lofi' | 'library' | 'nature' | 'silence';

const AMBIENT_LABELS: Record<AmbientSound, string> = {
  rain: 'Rain',
  lofi: 'Lo-Fi',
  library: 'Library',
  nature: 'Nature',
  silence: 'Silence',
};

type LeaderboardEntry = {
  userId: string;
  username: string;
  displayName: string;
  totalHours: number;
};

type Settings = {
  pomodoroWork: number;
  pomodoroBreak: number;
  ambientSound: string | null;
};

const StudyRoom = ({ channelId, guildId }: { channelId: string; guildId: string }) => {
  const workDurationId = useId();
  const breakDurationId = useId();
  const [settings, setSettings] = useState<Settings>({ pomodoroWork: 25, pomodoroBreak: 5, ambientSound: null });
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionType, setSessionType] = useState<'pomodoro' | 'freeform'>('pomodoro');
  const [ambient, setAmbient] = useState<AmbientSound>('silence');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    (api.get(`/channels/${channelId}/study`) as Promise<Settings>).then(r => {
      setSettings(r);
      setAmbient((r.ambientSound as AmbientSound) || 'silence');
    }).catch(() => {});
    loadStats();
    loadLeaderboard();
  }, [channelId, guildId]);

  const loadStats = async () => {
    try {
      const weekRes = await api.get(`/guilds/${guildId}/study/stats?period=week`) as { totalHours: number };
      setWeekMinutes(Math.round(weekRes.totalHours * 60));
      // Rough today estimate from week data
      const dayRes = await api.get(`/guilds/${guildId}/study/stats?period=week`) as { totalHours: number };
      setTodayMinutes(Math.round(dayRes.totalHours * 60 / 7));
    } catch {}
  };

  const loadLeaderboard = async () => {
    try {
      const res = await api.get(`/guilds/${guildId}/study/leaderboard`) as LeaderboardEntry[];
      setLeaderboard(res);
    } catch {}
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, phase]);

  const handlePhaseComplete = useCallback(() => {
    setIsRunning(false);
    if (phase === 'work') {
      addToast({ title: 'Work session complete! Time for a break.', variant: 'success' });
      setPhase('break');
      const breakSec = settings.pomodoroBreak * 60;
      setTimeLeft(breakSec);
      setTotalTime(breakSec);
      setIsRunning(true);
    } else if (phase === 'break') {
      addToast({ title: 'Break is over! Ready for another round?', variant: 'info' });
      setPhase('idle');
    }
  }, [phase, settings]);

  const startSession = async () => {
    try {
      await api.post<void>(`/channels/${channelId}/study/start`, { sessionType });
      if (sessionType === 'pomodoro') {
        const workSec = settings.pomodoroWork * 60;
        setTimeLeft(workSec);
        setTotalTime(workSec);
        setPhase('work');
      } else {
        setTimeLeft(0);
        setTotalTime(0);
        setPhase('work');
      }
      setIsRunning(true);
    } catch {
      addToast({ title: 'Failed to start session', variant: 'error' });
    }
  };

  const stopSession = async () => {
    try {
      await api.post<void>(`/channels/${channelId}/study/end`, {});
      setIsRunning(false);
      setPhase('idle');
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
      loadStats();
      loadLeaderboard();
      addToast({ title: 'Session ended!', variant: 'info' });
    } catch {
      addToast({ title: 'Failed to end session', variant: 'error' });
    }
  };

  const togglePause = () => setIsRunning(prev => !prev);

  const saveSettings = async (newSettings: Partial<Settings>) => {
    try {
      const res = await api.put(`/channels/${channelId}/study/settings`, { ...settings, ...newSettings }) as Settings;
      setSettings(res);
      addToast({ title: 'Settings saved', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to save settings', variant: 'error' });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 h-full overflow-auto">
      {/* Timer Widget */}
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#374151" strokeWidth="8" />
            <circle cx="80" cy="80" r="70" fill="none"
              stroke={phase === 'work' ? '#3b82f6' : phase === 'break' ? '#10b981' : '#6b7280'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-mono text-white font-bold">
              {sessionType === 'freeform' && phase === 'work' ? formatTime(timeLeft) : formatTime(timeLeft)}
            </span>
            {phase !== 'idle' && (
              <span className={`text-sm font-medium mt-1 ${phase === 'work' ? 'text-blue-400' : 'text-green-400'}`}>
                {phase === 'work' ? 'Focus' : 'Break'}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {phase === 'idle' ? (
            <>
              <select value={sessionType} onChange={e => setSessionType(e.target.value as 'pomodoro' | 'freeform')}
                className="bg-gray-700 text-gray-300 rounded px-3 py-2 text-sm border border-gray-600">
                <option value="pomodoro">Pomodoro</option>
                <option value="freeform">Freeform</option>
              </select>
              <button onClick={startSession}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Play size={16} /> Start
              </button>
            </>
          ) : (
            <>
              <button onClick={togglePause}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors">
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button onClick={stopSession}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Square size={16} /> Stop
              </button>
            </>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
            <Settings size={16} />
          </button>
        </div>

        {/* Phase indicator */}
        {phase !== 'idle' && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {phase === 'work' ? <BookOpen size={14} /> : <Coffee size={14} />}
            {phase === 'work' ? 'Focus Time' : 'Break Time'}
          </div>
        )}

        {/* Ambient Sound */}
        <div className="w-full max-w-xs">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
            <Volume2 size={14} /> Ambient Sound
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AMBIENT_LABELS) as AmbientSound[]).map(sound => (
              <button key={sound} onClick={() => setAmbient(sound)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${ambient === sound ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                {AMBIENT_LABELS[sound]}
              </button>
            ))}
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="w-full max-w-xs bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-medium text-white mb-3">Timer Settings</h4>
            <label htmlFor={workDurationId} className="block text-xs text-gray-400 mb-1">Work duration (min)</label>
            <input id={workDurationId} type="number" min={1} max={120} value={settings.pomodoroWork}
              onChange={e => setSettings(s => ({ ...s, pomodoroWork: Number(e.target.value) }))}
              className="w-full bg-gray-700 text-white rounded px-3 py-1.5 text-sm mb-2 border border-gray-600" />
            <label htmlFor={breakDurationId} className="block text-xs text-gray-400 mb-1">Break duration (min)</label>
            <input id={breakDurationId} type="number" min={1} max={60} value={settings.pomodoroBreak}
              onChange={e => setSettings(s => ({ ...s, pomodoroBreak: Number(e.target.value) }))}
              className="w-full bg-gray-700 text-white rounded px-3 py-1.5 text-sm mb-3 border border-gray-600" />
            <button onClick={() => saveSettings(settings)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded transition-colors">
              Save Settings
            </button>
          </div>
        )}

        {/* Session stats */}
        <div className="flex gap-6 mt-2">
          <div className="text-center">
            <div className="text-xl font-bold text-white">{todayMinutes}m</div>
            <div className="text-xs text-gray-400">Today</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{weekMinutes}m</div>
            <div className="text-xs text-gray-400">This Week</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="w-full lg:w-72 bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-yellow-400" />
          <h3 className="text-sm font-semibold text-white">Focus Leaderboard</h3>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-gray-500">No sessions yet this week</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.userId} className="flex items-center gap-3 py-1.5">
                <span className={`w-5 text-xs font-bold ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{entry.displayName || entry.username}</div>
                  <div className="text-xs text-gray-500">{Number(entry.totalHours).toFixed(1)}h</div>
                </div>
                {i < 3 && <Flame size={14} className="text-orange-400" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRoom;
