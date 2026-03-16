import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  LogIn,
  LogOut,
  Settings,
  ChevronDown,
  Timer,
} from 'lucide-react';
import { getSocket, emitOrQueue } from '../../lib/socket';

interface FocusTimerProps {
  channelId: string;
}

interface FocusParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

interface FocusSession {
  id: string;
  phase: 'work' | 'break';
  state: 'active' | 'paused' | 'idle';
  timeRemaining: number; // seconds
  round: number;
  totalRounds: number;
  workDuration: number; // seconds
  breakDuration: number; // seconds
  participants: FocusParticipant[];
}

const WORK_OPTIONS = [15, 25, 30, 45];
const BREAK_OPTIONS = [5, 10, 15];
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function FocusTimer({ channelId }: FocusTimerProps) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [localTime, setLocalTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalRounds, setTotalRounds] = useState(4);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync from server
  useEffect(() => {
    const handleUpdate = (data: FocusSession & { channelId: string }) => {
      if (data.channelId !== channelId) return;
      setSession(data);
      setLocalTime(data.timeRemaining);
    };

    const s = getSocket();
    if (!s) return;
    s.on('FOCUS_SESSION_UPDATE', handleUpdate);
    return () => {
      s.off('FOCUS_SESSION_UPDATE', handleUpdate);
    };
  }, [channelId]);

  // Local countdown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (session?.state === 'active' && localTime > 0) {
      timerRef.current = setInterval(() => {
        setLocalTime(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.state, session?.id]);

  const progress = useMemo(() => {
    if (!session) return 0;
    const total = session.phase === 'work' ? session.workDuration : session.breakDuration;
    return total > 0 ? 1 - localTime / total : 0;
  }, [session, localTime]);

  const dashOffset = useMemo(
    () => RING_CIRCUMFERENCE * (1 - progress),
    [progress],
  );

  const ringColor = useMemo(() => {
    if (!session) return 'var(--accent-primary)';
    return session.phase === 'work' ? '#ed4245' : '#43b581';
  }, [session?.phase]);

  const createSession = useCallback(() => {
    emitOrQueue('FOCUS_SESSION_CREATE', {
      channelId,
      workDuration: workMinutes * 60,
      breakDuration: breakMinutes * 60,
      totalRounds,
    });
    setShowSettings(false);
  }, [channelId, workMinutes, breakMinutes, totalRounds]);

  const togglePause = useCallback(() => {
    if (!session) return;
    emitOrQueue('FOCUS_SESSION_TOGGLE', { channelId, sessionId: session.id });
  }, [channelId, session]);

  const resetSession = useCallback(() => {
    if (!session) return;
    emitOrQueue('FOCUS_SESSION_RESET', { channelId, sessionId: session.id });
  }, [channelId, session]);

  const joinSession = useCallback(() => {
    if (!session) return;
    emitOrQueue('FOCUS_SESSION_JOIN', { channelId, sessionId: session.id });
  }, [channelId, session]);

  const leaveSession = useCallback(() => {
    if (!session) return;
    emitOrQueue('FOCUS_SESSION_LEAVE', { channelId, sessionId: session.id });
  }, [channelId, session]);

  // No active session — show create UI
  if (!session || session.state === 'idle') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: 24,
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--stroke)',
        }}
      >
        <Timer size={40} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          No active focus session
        </span>

        {!showSettings ? (
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start Focus Session
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 260 }}>
            <OptionRow label="Work" options={WORK_OPTIONS} value={workMinutes} onChange={setWorkMinutes} unit="min" />
            <OptionRow label="Break" options={BREAK_OPTIONS} value={breakMinutes} onChange={setBreakMinutes} unit="min" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rounds</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[2, 3, 4, 6].map(n => (
                  <PillButton key={n} active={totalRounds === n} onClick={() => setTotalRounds(n)}>
                    {n}
                  </PillButton>
                ))}
              </div>
            </div>
            <button
              onClick={createSession}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Start
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 24,
        borderRadius: 12,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--stroke)',
      }}
    >
      {/* Phase label */}
      <motion.span
        key={session.phase}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: ringColor,
        }}
      >
        {session.phase === 'work' ? 'Focus' : 'Break'}
      </motion.span>

      {/* Timer ring */}
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={90}
            cy={90}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--stroke)"
            strokeWidth={6}
          />
          {/* Progress ring */}
          <motion.circle
            cx={90}
            cy={90}
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </svg>

        {/* Center text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-primary)',
            }}
          >
            {formatTime(localTime)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Round {session.round}/{session.totalRounds}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={togglePause}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--accent-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {session.state === 'paused' ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button
          onClick={resetSession}
          title="Reset"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid var(--stroke)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Participants */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
          <Users size={14} />
          <span>{session.participants.length} participant{session.participants.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: -4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {session.participants.slice(0, 8).map(p => (
            <div
              key={p.id}
              title={p.displayName || p.username}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid var(--bg-secondary)',
                background: p.avatarHash
                  ? `url(/avatars/${p.id}/${p.avatarHash}.webp) center/cover`
                  : 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                marginLeft: -4,
              }}
            >
              {!p.avatarHash && getInitials(p.displayName || p.username)}
            </div>
          ))}
          {session.participants.length > 8 && (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid var(--bg-secondary)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 10,
                marginLeft: -4,
              }}
            >
              +{session.participants.length - 8}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={joinSession}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--stroke)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LogIn size={12} /> Join
          </button>
          <button
            onClick={leaveSession}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--stroke)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LogOut size={12} /> Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  label,
  options,
  value,
  onChange,
  unit,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(n => (
          <PillButton key={n} active={value === n} onClick={() => onChange(n)}>
            {n}{unit}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 12,
        border: active ? 'none' : '1px solid var(--stroke)',
        background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
