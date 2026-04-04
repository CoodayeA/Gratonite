import { useState, useRef, useCallback, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Maximize2, Minimize2, Users } from 'lucide-react';
import { ScreenShareButton } from './ScreenShareButton';

interface Participant {
  id: string;
  name: string;
  avatarHash?: string | null;
  stream?: MediaStream;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

interface VideoCallPanelProps {
  channelId: string;
  participants?: Participant[];
  onLeave: () => void;
  isGroup?: boolean;
}

function ParticipantVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div style={{
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      background: 'var(--bg-tertiary)',
      aspectRatio: '16/9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid var(--stroke)',
    }}>
      {participant.stream && !participant.isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.id === 'self'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'var(--accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', fontWeight: 700, color: '#111',
        }}>
          {participant.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: '8px', left: '8px',
        background: 'rgba(0,0,0,0.7)', borderRadius: '6px',
        padding: '4px 8px', fontSize: '12px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {participant.isMuted && <MicOff size={12} />}
        {participant.name}
      </div>
    </div>
  );
}

export function VideoCallPanel({ channelId, participants = [], onLeave, isGroup }: VideoCallPanelProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Start camera on mount
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        stream = s;
        setLocalStream(s);
      })
      .catch(() => {});

    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    }
    setIsMuted(prev => !prev);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !isCameraOn; });
    }
    setIsCameraOn(prev => !prev);
  }, [localStream, isCameraOn]);

  const toggleFullscreen = useCallback(() => {
    if (!panelRef.current) return;
    if (!isFullscreen) {
      panelRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(prev => !prev);
  }, [isFullscreen]);

  const handleLeave = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    onLeave();
  }, [localStream, onLeave]);

  const allParticipants: Participant[] = [
    { id: 'self', name: 'You', stream: localStream ?? undefined, isMuted, isCameraOff: !isCameraOn },
    ...participants,
  ];

  // Grid layout: 1 col for 1-2, 2 cols for 3-4, 3 cols for 5+
  const gridCols = allParticipants.length <= 2 ? 1 : allParticipants.length <= 4 ? 2 : 3;

  return (
    <div
      ref={panelRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--stroke)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Video size={18} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {isGroup ? 'Group Video Call' : 'Video Call'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Users size={14} />
          {allParticipants.length}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{
        flex: 1, padding: '16px', overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: '12px',
        alignContent: 'center',
      }}>
        {allParticipants.map(p => (
          <ParticipantVideo key={p.id} participant={p} />
        ))}
      </div>

      {/* Controls */}
      <div
        role="toolbar"
        aria-label="Call controls"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', padding: '16px', borderTop: '1px solid var(--stroke)',
        }}
      >
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={isMuted}
          title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: isMuted ? 'var(--error)' : 'var(--bg-tertiary)',
            border: 'none', color: isMuted ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={toggleCamera}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          aria-pressed={!isCameraOn}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: !isCameraOn ? 'var(--error)' : 'var(--bg-tertiary)',
            border: 'none', color: !isCameraOn ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        <ScreenShareButton />

        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--bg-tertiary)', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <button
          onClick={handleLeave}
          aria-label="Leave call"
          title="Leave Call"
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--error)', border: 'none', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
