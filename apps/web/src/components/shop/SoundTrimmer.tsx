import React, { useRef, useState, useCallback, useEffect } from 'react';
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

const styles = {
  container: {
    padding: 16,
    background: 'var(--bg-elevated, #353348)',
    border: '1px solid var(--stroke, #4a4660)',
    borderRadius: 'var(--radius-lg)',
    marginTop: 8,
  } as React.CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text, #e8e4e0)',
    marginBottom: 8,
  } as React.CSSProperties,
  bar: {
    position: 'relative',
    height: 40,
    background: 'var(--bg, #2c2c3e)',
    borderRadius: 'var(--radius-sm)',
    margin: '12px 0',
    touchAction: 'none',
  } as React.CSSProperties,
  selection: {
    position: 'absolute',
    top: 0,
    height: '100%',
    background: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 'var(--radius-sm)',
    pointerEvents: 'none',
  } as React.CSSProperties,
  handle: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 48,
    background: 'var(--accent, #d4af37)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'ew-resize',
    transform: 'translateX(-50%)',
    touchAction: 'none',
    zIndex: 2,
  } as React.CSSProperties,
  handleHover: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 48,
    background: 'var(--accent-hover, #6a2fcf)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'ew-resize',
    transform: 'translateX(-50%)',
    touchAction: 'none',
    zIndex: 2,
  } as React.CSSProperties,
  info: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-muted, #a8a4b8)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  } as React.CSSProperties,
} as const;

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
  const [hoveredHandle, setHoveredHandle] = useState<'start' | 'end' | null>(null);
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
    <div style={styles.container}>
      <div style={styles.label}>Trim clip (1-5 seconds)</div>
      <div
        ref={barRef}
        style={styles.bar}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={{
            ...styles.selection,
            left: `${toPercent(start)}%`,
            width: `${toPercent(end - start)}%`,
          } as React.CSSProperties}
        />
        <div
          style={{
            ...(hoveredHandle === 'start' ? styles.handleHover : styles.handle),
            left: `${toPercent(start)}%`,
          }}
          onPointerDown={handlePointerDown('start')}
          onMouseEnter={() => setHoveredHandle('start')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
        <div
          style={{
            ...(hoveredHandle === 'end' ? styles.handleHover : styles.handle),
            left: `${toPercent(end)}%`,
          }}
          onPointerDown={handlePointerDown('end')}
          onMouseEnter={() => setHoveredHandle('end')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
      </div>
      <div style={styles.info}>
        <span>{formatMs(start)} - {formatMs(end)}</span>
        <span>{formatMs(selectionMs)} selected</span>
      </div>
      <div style={styles.actions}>
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
