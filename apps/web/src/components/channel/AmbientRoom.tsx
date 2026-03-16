import { useState, useEffect, useCallback, useRef } from 'react';
import { Coffee, BookOpen, Flame, CloudRain, Waves, TreePine, Moon, Music, Users, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../../lib/socket';

interface AmbientRoomProps {
  channelId: string;
}

type ThemeKey = 'coffee' | 'library' | 'campfire' | 'rain' | 'ocean' | 'forest' | 'night' | 'lofi';
type UserStatus = 'working' | 'break' | 'away';

interface Participant {
  id: string;
  username: string;
  avatarHash: string | null;
  status: UserStatus;
}

interface ThemeConfig {
  key: ThemeKey;
  label: string;
  emoji: string;
  icon: typeof Coffee;
  gradient: string;
  particleColor: string;
  accentColor: string;
}

const THEMES: ThemeConfig[] = [
  { key: 'coffee', label: 'Coffee Shop', emoji: '\u2615', icon: Coffee, gradient: 'linear-gradient(135deg, #3e2723 0%, #5d4037 50%, #6d4c41 100%)', particleColor: 'rgba(255,235,210,0.3)', accentColor: '#d7a86e' },
  { key: 'library', label: 'Library', emoji: '\ud83d\udcda', icon: BookOpen, gradient: 'linear-gradient(135deg, #1b2838 0%, #2c3e50 50%, #34495e 100%)', particleColor: 'rgba(255,248,220,0.2)', accentColor: '#c8a96e' },
  { key: 'campfire', label: 'Campfire', emoji: '\ud83d\udd25', icon: Flame, gradient: 'linear-gradient(135deg, #1a0a00 0%, #3d1c02 50%, #5c2a04 100%)', particleColor: 'rgba(255,165,0,0.35)', accentColor: '#ff9544' },
  { key: 'rain', label: 'Rain', emoji: '\ud83c\udf27\ufe0f', icon: CloudRain, gradient: 'linear-gradient(135deg, #1a2332 0%, #2d3748 50%, #3a4a5c 100%)', particleColor: 'rgba(150,200,255,0.25)', accentColor: '#7eb8da' },
  { key: 'ocean', label: 'Ocean', emoji: '\ud83c\udf0a', icon: Waves, gradient: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #163a5f 100%)', particleColor: 'rgba(100,200,255,0.2)', accentColor: '#4ecdc4' },
  { key: 'forest', label: 'Forest', emoji: '\ud83c\udf32', icon: TreePine, gradient: 'linear-gradient(135deg, #0b1a0e 0%, #1a3a1a 50%, #2d5a27 100%)', particleColor: 'rgba(100,255,100,0.15)', accentColor: '#66bb6a' },
  { key: 'night', label: 'Night', emoji: '\ud83c\udf19', icon: Moon, gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #2a2a5a 100%)', particleColor: 'rgba(200,200,255,0.15)', accentColor: '#9c88ff' },
  { key: 'lofi', label: 'Lofi', emoji: '\ud83c\udfb5', icon: Music, gradient: 'linear-gradient(135deg, #1a1025 0%, #2d1b4e 50%, #3a2560 100%)', particleColor: 'rgba(255,150,255,0.2)', accentColor: '#e040fb' },
];

const STATUS_LABELS: Record<UserStatus, { label: string; color: string }> = {
  working: { label: 'Working', color: '#66bb6a' },
  break: { label: 'Break', color: '#ffa726' },
  away: { label: 'Away', color: '#bdbdbd' },
};

const STATUS_CYCLE: UserStatus[] = ['working', 'break', 'away'];

function AmbientParticles({ theme }: { theme: ThemeConfig }) {
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 5,
    }))
  ).current;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: theme.particleColor,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 10, -10, 0],
            opacity: [0.2, 0.7, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function ParticipantCard({ participant }: { participant: Participant }) {
  const statusInfo = STATUS_LABELS[participant.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '10px',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '10px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: '80px',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            overflow: 'hidden',
          }}
        >
          {participant.avatarHash ? (
            <img
              src={`/avatars/${participant.id}/${participant.avatarHash}.webp`}
              alt={participant.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            participant.username[0]?.toUpperCase()
          )}
        </div>
        <div style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusInfo.color,
          border: '2px solid rgba(0,0,0,0.4)',
        }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {participant.username}
      </span>
      <span style={{ fontSize: '9px', fontWeight: 500, color: statusInfo.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {statusInfo.label}
      </span>
    </motion.div>
  );
}

export function AmbientRoom({ channelId }: AmbientRoomProps) {
  const [joined, setJoined] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('coffee');
  const [myStatus, setMyStatus] = useState<UserStatus>('working');
  const [participants, setParticipants] = useState<Participant[]>([]);

  const theme = THEMES.find((t) => t.key === activeTheme)!;

  useEffect(() => {
    if (!joined) return;
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
    };

    socket.on('ambient_room_update', handleUpdate);
    return () => { socket.off('ambient_room_update', handleUpdate); };
  }, [joined]);

  const handleJoin = useCallback(() => {
    const socket = getSocket();
    if (socket) socket.emit('ambient_room_join', { channelId, status: myStatus });
    setJoined(true);
  }, [channelId, myStatus]);

  const handleLeave = useCallback(() => {
    const socket = getSocket();
    if (socket) socket.emit('ambient_room_leave', { channelId });
    setJoined(false);
    setParticipants([]);
  }, [channelId]);

  const cycleStatus = useCallback(() => {
    const idx = STATUS_CYCLE.indexOf(myStatus);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setMyStatus(next);
    if (joined) {
      const socket = getSocket();
      if (socket) socket.emit('ambient_room_status', { channelId, status: next });
    }
  }, [myStatus, joined, channelId]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: theme.gradient,
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AmbientParticles theme={theme} />

      {/* Ambient gradient overlay animation */}
      <motion.div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at 30% 50%, ${theme.particleColor}, transparent 70%)`,
        }} />
      </motion.div>

      {/* Header */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <theme.icon size={18} style={{ color: theme.accentColor }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {theme.label}
          </span>
          {joined && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '2px 8px',
              color: 'rgba(255,255,255,0.6)',
            }}>
              <Users size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {participants.length}
            </span>
          )}
        </div>

        {joined && (
          <button
            onClick={cycleStatus}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '12px',
              border: `1px solid ${STATUS_LABELS[myStatus].color}`,
              background: 'rgba(0,0,0,0.3)',
              color: STATUS_LABELS[myStatus].color,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {STATUS_LABELS[myStatus].label}
          </button>
        )}
      </div>

      {/* Theme selector */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        gap: '4px',
        padding: '0 16px 12px',
        flexWrap: 'wrap',
      }}>
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTheme(t.key)}
            title={t.label}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: activeTheme === t.key ? `2px solid ${t.accentColor}` : '1px solid rgba(255,255,255,0.1)',
              background: activeTheme === t.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              padding: 0,
            }}
          >
            {t.emoji}
          </button>
        ))}
      </div>

      {/* Participants */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        flex: 1,
        padding: '8px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignContent: 'flex-start',
      }}>
        <AnimatePresence>
          {participants.map((p) => (
            <ParticipantCard key={p.id} participant={p} />
          ))}
        </AnimatePresence>
        {joined && participants.length === 0 && (
          <div style={{
            width: '100%',
            textAlign: 'center',
            padding: '24px 0',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '13px',
          }}>
            You are the first one here. Others will appear as they join.
          </div>
        )}
      </div>

      {/* Join/Leave */}
      <div style={{ position: 'relative', zIndex: 2, padding: '12px 16px' }}>
        {!joined ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleJoin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: theme.accentColor,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <LogIn size={16} />
            Join Room
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLeave}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <LogOut size={16} />
            Leave Room
          </motion.button>
        )}
      </div>
    </div>
  );
}
