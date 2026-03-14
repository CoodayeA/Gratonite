import { useState, useCallback } from 'react';
import { Monitor, MonitorOff } from 'lucide-react';
import { useToast } from '../ui/ToastManager';

interface Props {
  onStreamStart?: (stream: MediaStream) => void;
  onStreamStop?: () => void;
}

export function ScreenShareButton({ onStreamStart, onStreamStop }: Props) {
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { addToast } = useToast();

  const startScreenShare = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });

      // Listen for user stopping via browser UI
      mediaStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setIsSharing(false);
        setStream(null);
        onStreamStop?.();
      });

      setStream(mediaStream);
      setIsSharing(true);
      onStreamStart?.(mediaStream);
      addToast({ title: 'Screen sharing started', variant: 'success' });
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        addToast({ title: 'Failed to share screen', description: err.message, variant: 'error' });
      }
    }
  }, [onStreamStart, onStreamStop, addToast]);

  const stopScreenShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsSharing(false);
    onStreamStop?.();
  }, [stream, onStreamStop]);

  return (
    <button
      onClick={isSharing ? stopScreenShare : startScreenShare}
      title={isSharing ? 'Stop Screen Share' : 'Share Screen'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: 'none',
        background: isSharing ? 'var(--error)' : 'var(--bg-tertiary)',
        color: isSharing ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {isSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
    </button>
  );
}
