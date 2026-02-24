import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface SoundTrimmerProps {
  audioUrl: string;
  durationMs: number;
  onSave: (trimStartMs: number, trimEndMs: number) => void;
  onCancel: () => void;
  initialStart?: number;
  initialEnd?: number;
}

const MIN_SELECTION_MS = 1000;
const MAX_SELECTION_MS = 5000;

function formatMs(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  return `${s.toFixed(1)}s`;
}

export function SoundTrimmer({
  audioUrl,
  durationMs,
  onSave,
  onCancel,
  initialStart = 0,
  initialEnd,
}: SoundTrimmerProps) {
  const effectiveEnd = initialEnd ?? Math.min(durationMs, MAX_SELECTION_MS);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(effectiveEnd);
  const [playing, setPlaying] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const toPercent = (ms: number) => (ms / durationMs) * 100;
  const toMs = (pct: number) => (pct / 100) * durationMs;

  const getBarPercent = useCallback(
    (clientX: number) => {
      if (!barRef.current) return 0;
      const rect = barRef.current.getBoundingClientRect();
      return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    },
    [],
  );

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end') => (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = handle;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const pct = getBarPercent(e.clientX);
      const ms = Math.round(toMs(pct));

      if (dragging.current === 'start') {
        const newStart = clamp(ms, 0, end - MIN_SELECTION_MS);
        const clamped = end - newStart > MAX_SELECTION_MS ? end - MAX_SELECTION_MS : newStart;
        setStart(clamp(clamped, 0, end - MIN_SELECTION_MS));
      } else {
        const newEnd = clamp(ms, start + MIN_SELECTION_MS, durationMs);
        const clamped = newEnd - start > MAX_SELECTION_MS ? start + MAX_SELECTION_MS : newEnd;
        setEnd(clamp(clamped, start + MIN_SELECTION_MS, durationMs));
      }
    },
    [start, end, durationMs, getBarPercent],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  function preview() {
    stopPreview();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.currentTime = start / 1000;
    setPlaying(true);

    const checkEnd = () => {
      if (audio.currentTime >= end / 1000) {
        audio.pause();
        setPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', checkEnd);
    audio.addEventListener('ended', () => setPlaying(false), { once: true });
    audio.play().catch(() => setPlaying(false));
  }

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }

  useEffect(() => {
    return () => stopPreview();
  }, []);

  const selectionMs = end - start;

  return (
    <div className="sound-trimmer">
      <div className="sound-trimmer-label">Trim clip (1-5 seconds)</div>
      <div
        ref={barRef}
        className="sound-trimmer-bar"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="sound-trimmer-selection"
          style={{
            left: `${toPercent(start)}%`,
            width: `${toPercent(end - start)}%`,
          }}
        />
        <div
          className="sound-trimmer-handle"
          style={{ left: `${toPercent(start)}%` }}
          onPointerDown={handlePointerDown('start')}
        />
        <div
          className="sound-trimmer-handle"
          style={{ left: `${toPercent(end)}%` }}
          onPointerDown={handlePointerDown('end')}
        />
      </div>
      <div className="sound-trimmer-info">
        <span>{formatMs(start)} - {formatMs(end)}</span>
        <span>{formatMs(selectionMs)} selected</span>
      </div>
      <div className="sound-trimmer-actions">
        <Button variant="ghost" size="sm" onClick={playing ? stopPreview : preview}>
          {playing ? 'Stop' : 'Preview'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(start, end)}>
          Save Trim
        </Button>
      </div>
    </div>
  );
}
