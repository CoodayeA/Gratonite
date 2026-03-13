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
  getAvatarHash: (id: string) => string | null;
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
  getAvatarHash,
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
        background: 'radial-gradient(ellipse at 50% 40%, rgba(20,25,45,0.95) 0%, rgba(12,14,28,0.98) 50%, rgba(8,10,22,1) 100%)',
        borderRadius: 'var(--radius-lg)',
        border: 'var(--border-structural)',
        overflow: 'hidden',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Room name label */}
      <div style={{
        position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
        fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', opacity: 0.7,
        letterSpacing: '0.06em', textTransform: 'uppercase', pointerEvents: 'none', zIndex: 2,
      }}>
        Spatial Audio Room
      </div>

      {/* Clean floor pattern with radial gradient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 50%, rgba(67, 181, 129, 0.04) 0%, transparent 60%)',
      }} />

      {/* Floor grid pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.2 }}>
        <defs>
          <pattern id="spatialGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#spatialGrid)" />
      </svg>

      {/* Distance-based volume indicator rings (I7) */}
      {[0.25, 0.5, 0.75].map((fraction, i) => (
        <div
          key={`ring-${i}`}
          style={{
            position: 'absolute',
            left: `${localPosition.x * 100}%`,
            top: `${localPosition.y * 100}%`,
            width: `${AUDIBLE_RADIUS * 2 * fraction * 100}%`,
            height: `${AUDIBLE_RADIUS * 2 * fraction * 100}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '1px dashed rgba(67, 181, 129, 0.15)',
            pointerEvents: 'none',
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
        >
          <span style={{
            position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '9px', fontWeight: 600, color: 'rgba(67, 181, 129, 0.35)',
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>
            {i === 0 ? 'loud' : i === 1 ? 'medium' : 'quiet'}
          </span>
        </div>
      ))}

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
            {/* Speaking ring + audio wave rings */}
            <div style={{ position: 'relative' }}>
              {p.isSpeaking && (
                <>
                  {/* Outer wave ring 1 */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-16px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(67, 181, 129, 0.15)',
                      animation: 'spatialWaveRing 2s ease-out infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Outer wave ring 2 (delayed) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-16px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(67, 181, 129, 0.15)',
                      animation: 'spatialWaveRing 2s ease-out 0.6s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Outer wave ring 3 (delayed more) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-16px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(67, 181, 129, 0.15)',
                      animation: 'spatialWaveRing 2s ease-out 1.2s infinite',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Inner glow ring */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-5px',
                      borderRadius: '50%',
                      border: '2.5px solid #43b581',
                      animation: 'speakingPulse 1.2s ease-in-out infinite',
                    }}
                  />
                </>
              )}
              <Avatar
                userId={p.id}
                displayName={p.name}
                avatarHash={getAvatarHash(p.id)}
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

      {/* Keyframes for spatial audio wave rings */}
      <style>{`
        @keyframes spatialWaveRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
