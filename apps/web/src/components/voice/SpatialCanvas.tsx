import { useRef, useCallback, useEffect } from 'react';
import { LiveKitParticipant } from '../../lib/useLiveKit';
import Avatar from '../ui/Avatar';

interface SpatialCanvasProps {
  participants: (LiveKitParticipant & { bgColor: string })[];
  localParticipantId: string | undefined;
  positions: Map<string, { x: number; y: number }>;
  localPosition: { x: number; y: number };
  onLocalPositionChange: (x: number, y: number) => void;
  ownAvatarFrame?: 'none' | 'neon' | 'gold' | 'glass';
}

const AVATAR_SIZE = 56;
const AUDIBLE_RADIUS = 0.35; // normalized

export default function SpatialCanvas({
  participants,
  localParticipantId,
  positions,
  localPosition,
  onLocalPositionChange,
  ownAvatarFrame = 'none',
}: SpatialCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const getContainerRect = useCallback(() => containerRef.current?.getBoundingClientRect(), []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const rect = getContainerRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onLocalPositionChange(x, y);
  }, [getContainerRect, onLocalPositionChange]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Calculate distance between two normalized positions
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '1200px',
        height: '60vh',
        minHeight: '400px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: 'var(--border-structural)',
        overflow: 'hidden',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Audible range circle around local user */}
      <div
        style={{
          position: 'absolute',
          left: `${localPosition.x * 100}%`,
          top: `${localPosition.y * 100}%`,
          width: `${AUDIBLE_RADIUS * 200}%`,
          height: `${AUDIBLE_RADIUS * 200}%`,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '1px solid rgba(67, 181, 129, 0.2)',
          background: 'radial-gradient(circle, rgba(67,181,129,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
          transition: 'left 0.05s linear, top 0.05s linear',
        }}
      />

      {/* Render each participant */}
      {participants.map(p => {
        const isLocal = p.id === localParticipantId;
        const pos = isLocal ? localPosition : (positions.get(p.id) ?? { x: 0.5, y: 0.5 });
        const dist = isLocal ? 0 : distance(localPosition, pos);
        const opacity = isLocal ? 1 : Math.max(0.25, 1 - dist / AUDIBLE_RADIUS);

        return (
          <div
            key={p.id}
            onPointerDown={isLocal ? handlePointerDown : undefined}
            onPointerMove={isLocal ? handlePointerMove : undefined}
            onPointerUp={isLocal ? handlePointerUp : undefined}
            style={{
              position: 'absolute',
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: isLocal ? 'grab' : 'default',
              opacity,
              transition: isLocal ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out, opacity 0.2s',
              zIndex: isLocal ? 10 : 5,
              touchAction: 'none',
            }}
          >
            {/* Speaking ring */}
            <div style={{ position: 'relative' }}>
              {p.isSpeaking && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '-5px',
                    borderRadius: '50%',
                    border: '2.5px solid #43b581',
                    animation: 'speakingPulse 1.2s ease-in-out infinite',
                  }}
                />
              )}
              <Avatar
                userId={p.id}
                displayName={p.name}
                frame={isLocal ? ownAvatarFrame : 'none'}
                size={AVATAR_SIZE}
                style={{
                  boxShadow: p.isSpeaking
                    ? '0 0 12px rgba(67, 181, 129, 0.5)'
                    : '0 2px 8px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: p.isSpeaking ? 'var(--text-primary)' : 'var(--text-secondary)',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {p.name}{isLocal ? ' (You)' : ''}
            </span>
          </div>
        );
      })}

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      >
        Drag your avatar to move &middot; Closer = louder
      </div>
    </div>
  );
}
