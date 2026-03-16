import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Move, Maximize2, Minimize2 } from 'lucide-react';
import { getSocket, emitOrQueue } from '../../lib/socket';

interface Participant {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  isSpeaking: boolean;
}

interface SpatialRoomProps {
  channelId: string;
  participants: Participant[];
}

interface Position {
  x: number;
  y: number;
}

const AVATAR_SIZE = 48;
const AUDIBLE_RADIUS = 0.35;
const MINIMAP_SIZE = 120;
const GRID_SPACING = 40;

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function SpatialRoom({ channelId, participants }: SpatialRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [localPosition, setLocalPosition] = useState<Position>({ x: 0.5, y: 0.5 });
  const [remotePositions, setRemotePositions] = useState<Map<string, Position>>(new Map());
  const [showMinimap, setShowMinimap] = useState(true);
  const localUserId = useMemo(() => participants[0]?.id ?? '', [participants]);

  // Sync positions from server
  useEffect(() => {
    const handleSync = (data: Record<string, Position>) => {
      const map = new Map<string, Position>();
      for (const [id, pos] of Object.entries(data)) {
        if (id !== localUserId) map.set(id, pos);
      }
      setRemotePositions(map);
    };

    const handleUpdate = (data: { userId: string; x: number; y: number }) => {
      if (data.userId === localUserId) return;
      setRemotePositions(prev => {
        const next = new Map(prev);
        next.set(data.userId, { x: data.x, y: data.y });
        return next;
      });
    };

    const s = getSocket();
    if (!s) return;
    s.on('SPATIAL_POSITIONS_SYNC', handleSync);
    s.on('SPATIAL_POSITION_UPDATE', handleUpdate);
    return () => {
      s.off('SPATIAL_POSITIONS_SYNC', handleSync);
      s.off('SPATIAL_POSITION_UPDATE', handleUpdate);
    };
  }, [localUserId]);

  // Emit local position
  const emitPosition = useCallback(
    (pos: Position) => {
      emitOrQueue('SPATIAL_POSITION_UPDATE', { channelId, x: pos.x, y: pos.y });
    },
    [channelId],
  );

  const moveLocal = useCallback(
    (x: number, y: number) => {
      const clamped = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      setLocalPosition(clamped);
      emitPosition(clamped);
    },
    [emitPosition],
  );

  // Pointer drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      moveLocal((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    },
    [moveLocal],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Arrow key movement
  useEffect(() => {
    const step = 0.02;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const delta = map[e.key];
      if (delta) {
        e.preventDefault();
        setLocalPosition(prev => {
          const next = { x: prev.x + delta[0], y: prev.y + delta[1] };
          const clamped = { x: Math.max(0, Math.min(1, next.x)), y: Math.max(0, Math.min(1, next.y)) };
          emitPosition(clamped);
          return clamped;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [emitPosition]);

  const allPositions = useMemo(() => {
    const map = new Map(remotePositions);
    map.set(localUserId, localPosition);
    return map;
  }, [remotePositions, localPosition, localUserId]);

  const participantMap = useMemo(() => {
    const m = new Map<string, Participant>();
    for (const p of participants) m.set(p.id, p);
    return m;
  }, [participants]);

  const renderAvatar = (
    p: Participant,
    pos: Position,
    isLocal: boolean,
    size: number = AVATAR_SIZE,
    showLabel: boolean = true,
  ) => {
    const dist = isLocal ? 0 : distance(localPosition, pos);
    const inRange = dist <= AUDIBLE_RADIUS;
    const opacity = isLocal ? 1 : inRange ? 1 : 0.4;

    return (
      <motion.div
        key={p.id}
        initial={false}
        animate={{
          left: pos.x * 100 + '%',
          top: pos.y * 100 + '%',
          opacity,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          cursor: isLocal ? 'grab' : 'default',
          zIndex: isLocal ? 10 : 5,
          pointerEvents: isLocal ? 'auto' : 'none',
        }}
        onPointerDown={isLocal ? handlePointerDown : undefined}
      >
        {/* Speaking ring */}
        {p.isSpeaking && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{
              position: 'absolute',
              width: size + 12,
              height: size + 12,
              borderRadius: '50%',
              border: '2px solid var(--accent-primary)',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        )}
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: p.avatarHash
              ? `url(/avatars/${p.id}/${p.avatarHash}.webp) center/cover`
              : 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: size * 0.45,
            border: isLocal ? '2px solid var(--accent-primary)' : '2px solid transparent',
            boxShadow: p.isSpeaking ? '0 0 12px var(--accent-primary)' : 'none',
          }}
        >
          {!p.avatarHash && getInitials(p.displayName || p.username)}
        </div>
        {showLabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-primary)',
              background: 'var(--bg-elevated)',
              padding: '1px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              maxWidth: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.displayName || p.username}
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {/* Grid canvas */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 12,
          background: 'var(--bg-primary)',
          backgroundImage: `
            linear-gradient(var(--stroke) 1px, transparent 1px),
            linear-gradient(90deg, var(--stroke) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SPACING}px ${GRID_SPACING}px`,
        }}
      >
        {/* Audible radius circle */}
        <div
          style={{
            position: 'absolute',
            left: localPosition.x * 100 + '%',
            top: localPosition.y * 100 + '%',
            transform: 'translate(-50%, -50%)',
            width: AUDIBLE_RADIUS * 200 + '%',
            height: AUDIBLE_RADIUS * 200 + '%',
            borderRadius: '50%',
            border: '1px dashed var(--accent-primary)',
            background: 'rgba(88, 101, 242, 0.04)',
            pointerEvents: 'none',
            transition: 'left 0.1s, top 0.1s',
          }}
        />

        {/* Participants */}
        {participants.map(p => {
          const isLocal = p.id === localUserId;
          const pos = allPositions.get(p.id) ?? { x: 0.5, y: 0.5 };
          return renderAvatar(p, pos, isLocal);
        })}

        {/* Controls hint */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-muted)',
            fontSize: 12,
          }}
        >
          <Move size={14} />
          <span>Drag or use arrow keys to move</span>
        </div>
      </div>

      {/* Minimap */}
      {showMinimap && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            width: MINIMAP_SIZE,
            height: MINIMAP_SIZE,
            borderRadius: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--stroke)',
            overflow: 'hidden',
          }}
        >
          {participants.map(p => {
            const pos = allPositions.get(p.id) ?? { x: 0.5, y: 0.5 };
            return (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  left: pos.x * 100 + '%',
                  top: pos.y * 100 + '%',
                  transform: 'translate(-50%, -50%)',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: p.id === localUserId ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Minimap toggle */}
      <button
        onClick={() => setShowMinimap(v => !v)}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--stroke)',
          borderRadius: 6,
          padding: '4px 8px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
        }}
      >
        {showMinimap ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        Map
      </button>
    </div>
  );
}
