import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceClipPlayerProps {
  clipUrl: string;
  title: string;
  duration: number;
  author: string;
}

const BAR_COUNT = 40;

function generateBars(seed: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    bars.push(4 + (hash % 20));
  }
  return bars;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceClipPlayer({ clipUrl, title, duration, author }: VoiceClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const bars = useMemo(() => generateBars(clipUrl, BAR_COUNT), [clipUrl]);
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const pct = audio.duration ? audio.currentTime / audio.duration : 0;
      setProgress(pct);
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const container = waveformRef.current;
    if (!audio || !container) return;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * (audio.duration || duration);
    setProgress(pct);
  }, [duration]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--stroke)',
        maxWidth: 360,
      }}
    >
      <audio ref={audioRef} src={clipUrl} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent-primary)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {playing ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" />}
      </button>

      {/* Waveform + Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 160,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
            {author}
          </span>
        </div>

        {/* Waveform bars */}
        <div
          ref={waveformRef}
          onClick={seek}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1.5,
            height: 24,
            cursor: 'pointer',
          }}
        >
          {bars.map((h, i) => {
            const barProgress = i / BAR_COUNT;
            const isActive = barProgress <= progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 1,
                  background: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  opacity: isActive ? 1 : 0.3,
                  transition: 'background 0.1s, opacity 0.1s',
                }}
              />
            );
          })}
        </div>

        {/* Time */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {formatDuration(currentTime)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
