import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Scissors, Circle, Square, Upload, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface VoiceClipButtonProps {
  channelId: string;
  guildId: string;
}

type Mode = 'idle' | 'buffering' | 'recording' | 'uploading';

const MAX_BUFFER_SECONDS = 30;
const MAX_RECORD_SECONDS = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceClipButton({ channelId, guildId }: VoiceClipButtonProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const circularBufferRef = useRef<Blob[]>([]);
  const bufferRecorderRef = useRef<MediaRecorder | null>(null);

  // Start circular buffer to keep last 30s
  const startBuffer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      bufferRecorderRef.current = recorder;
      circularBufferRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          circularBufferRef.current.push(e.data);
          // Keep roughly 30s worth of chunks (1s intervals)
          if (circularBufferRef.current.length > MAX_BUFFER_SECONDS) {
            circularBufferRef.current.shift();
          }
        }
      };

      recorder.start(1000); // 1-second chunks
      setMode('buffering');
    } catch {
      // Mic permission denied
    }
  }, []);

  const stopBuffer = useCallback(() => {
    bufferRecorderRef.current?.stop();
    bufferRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    circularBufferRef.current = [];
    setMode('idle');
  }, []);

  // Clip last 30s from buffer
  const clipLast30 = useCallback(async () => {
    const chunks = [...circularBufferRef.current];
    if (chunks.length === 0) return;

    stopBuffer();
    setMode('uploading');

    const blob = new Blob(chunks, { type: 'audio/webm' });
    await uploadClip(blob, `clip-${Date.now()}`);
    setMode('idle');
  }, [stopBuffer]);

  // Start recording
  const startRecording = useCallback(async () => {
    // Stop buffer if running
    bufferRecorderRef.current?.stop();

    try {
      const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      startTimeRef.current = Date.now();
      setElapsed(0);
      setMode('recording');

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_RECORD_SECONDS) {
          stopRecording();
        }
      }, 500);
    } catch {
      setMode('idle');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setMode('uploading');
        await uploadClip(blob, `recording-${Date.now()}`);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setMode('idle');
        resolve();
      };
      recorder.stop();
    });
  }, []);

  const uploadClip = async (blob: Blob, title: string) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, `${title}.webm`);
      const uploadRes = await api.files.upload(formData);
      const fileUrl = uploadRes?.url ?? uploadRes?.fileUrl;
      if (!fileUrl) return;

      await api.guilds.createClip(guildId, {
        channelId,
        title,
        fileUrl,
        duration: Math.floor(blob.size / 6000), // rough estimate
      });
    } catch {
      // Upload failed silently
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      bufferRecorderRef.current?.stop();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Main button */}
      <button
        onClick={() => {
          if (mode === 'idle') setShowMenu(v => !v);
          else if (mode === 'recording') stopRecording();
          else if (mode === 'buffering') setShowMenu(v => !v);
        }}
        disabled={mode === 'uploading'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          border: 'none',
          background: mode === 'recording' ? '#ed4245' : 'var(--bg-elevated)',
          color: mode === 'recording' ? '#fff' : 'var(--text-secondary)',
          cursor: mode === 'uploading' ? 'wait' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'background 0.15s',
        }}
      >
        {mode === 'uploading' ? (
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <Loader2 size={16} />
          </motion.div>
        ) : mode === 'recording' ? (
          <>
            <Square size={14} fill="#fff" />
            <span>{formatTime(elapsed)}</span>
          </>
        ) : mode === 'buffering' ? (
          <>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Circle size={14} fill="#ed4245" color="#ed4245" />
            </motion.div>
            <span>Buffering</span>
          </>
        ) : (
          <>
            <Scissors size={16} />
            <span>Clip</span>
          </>
        )}
      </button>

      {/* Recording pulse */}
      {mode === 'recording' && (
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#ed4245',
          }}
        />
      )}

      {/* Menu */}
      {showMenu && mode !== 'recording' && mode !== 'uploading' && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 8,
            padding: 4,
            minWidth: 180,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 50,
          }}
        >
          {mode === 'buffering' ? (
            <>
              <MenuButton
                icon={<Scissors size={15} />}
                label="Clip last 30s"
                onClick={() => { setShowMenu(false); clipLast30(); }}
              />
              <MenuButton
                icon={<Circle size={15} />}
                label="Record clip"
                onClick={() => { setShowMenu(false); startRecording(); }}
              />
              <MenuButton
                icon={<Square size={15} />}
                label="Stop buffering"
                onClick={() => { setShowMenu(false); stopBuffer(); }}
                danger
              />
            </>
          ) : (
            <>
              <MenuButton
                icon={<Circle size={15} fill="#ed4245" color="#ed4245" />}
                label="Start buffering (30s)"
                onClick={() => { setShowMenu(false); startBuffer(); }}
              />
              <MenuButton
                icon={<Circle size={15} />}
                label="Record clip"
                onClick={() => { setShowMenu(false); startRecording(); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: danger ? '#ed4245' : 'var(--text-primary)',
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  );
}
