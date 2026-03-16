import { useState, useRef, useCallback, useEffect } from 'react';
import { Video, Square, Circle, Monitor, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenRecorderProps {
  channelId: string;
  onRecordingComplete: (file: File) => void;
}

type Quality = '720p' | '1080p';

const QUALITY_CONSTRAINTS: Record<Quality, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const MAX_DURATION_MS = 5 * 60 * 1000;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function ScreenRecorder({ channelId, onRecordingComplete }: ScreenRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState<Quality>('1080p');
  const [showSettings, setShowSettings] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    timerRef.current = null;
    autoStopRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleStart = useCallback(async () => {
    try {
      const constraints = QUALITY_CONSTRAINTS[quality];
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: constraints.width }, height: { ideal: constraints.height }, frameRate: { ideal: 30 } },
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `recording-${channelId}-${Date.now()}.webm`, { type: 'video/webm' });
        onRecordingComplete(file);
        setRecording(false);
        setElapsed(0);
        cleanup();
      };

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        handleStop();
      });

      recorder.start(1000);
      startTimeRef.current = Date.now();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 200);

      autoStopRef.current = setTimeout(() => {
        handleStop();
      }, MAX_DURATION_MS);
    } catch {
      cleanup();
    }
  }, [quality, channelId, onRecordingComplete, cleanup, handleStop]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <AnimatePresence>
        {recording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              padding: '4px 12px 4px 8px',
            }}
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(elapsed)}
            </span>
            <button
              onClick={handleStop}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ef4444',
                border: 'none',
                borderRadius: '4px',
                width: 20,
                height: 20,
                cursor: 'pointer',
                padding: 0,
              }}
              title="Stop recording"
            >
              <Square size={10} color="#fff" fill="#fff" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            <button
              onClick={handleStart}
              title="Start screen recording"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'none';
              }}
            >
              <Monitor size={18} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Recording settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <Settings size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && !recording && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '6px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: '8px',
              padding: '8px',
              zIndex: 50,
              minWidth: '140px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quality</span>
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {(['720p', '1080p'] as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: quality === q ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: quality === q ? '#fff' : 'var(--text-secondary)',
                    transition: 'background 0.15s',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Max 5 minutes
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
