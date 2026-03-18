import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { playSound } from '../../utils/SoundManager';

interface IncomingCallProps {
  channelId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  withVideo: boolean;
  onAnswerAudio: () => void;
  onAnswerVideo: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callerName,
  callerAvatar,
  callerId,
  withVideo,
  onAnswerAudio,
  onAnswerVideo,
  onDecline,
}: IncomingCallProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDecline(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDecline]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Play ringtone on mount, repeat every 3s
    playSound('notification');
    ringIntervalRef.current = setInterval(() => {
      playSound('notification');
    }, 3000);

    // Elapsed timer
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    };
  }, []);

  // Auto-dismiss after 60s
  useEffect(() => {
    if (elapsed >= 60) onDecline();
  }, [elapsed, onDecline]);

  return (
    <div className="modal-backdrop" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div role="dialog" aria-modal="true" style={{
        background: 'var(--bg-secondary, #1e1f22)',
        borderRadius: 16,
        padding: '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        minWidth: 320,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Pulsing ring animation */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: -8,
            left: -8,
            right: -8,
            bottom: -8,
            borderRadius: '50%',
            border: '3px solid var(--accent-blue, #5865f2)',
            animation: 'incoming-call-pulse 1.5s ease-in-out infinite',
          }} />
          <Avatar
            userId={callerId}
            displayName={callerName}
            avatarHash={callerAvatar}
            size={80}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
            {callerName}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary, #b5bac1)', marginTop: 4 }}>
            Incoming {withVideo ? 'video' : 'voice'} call...
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <button
            onClick={onDecline}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--error, #ed4245)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            className="hover-scale-pop"
            aria-label="Decline call"
          >
            <PhoneOff size={24} />
          </button>

          <button
            onClick={onAnswerAudio}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--success, #3ba55c)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            className="hover-scale-pop"
            aria-label="Answer with audio"
          >
            <Phone size={24} />
          </button>

          <button
            onClick={onAnswerVideo}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--accent-blue, #5865f2)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            className="hover-scale-pop"
            aria-label="Answer with video"
          >
            <Video size={24} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes incoming-call-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
