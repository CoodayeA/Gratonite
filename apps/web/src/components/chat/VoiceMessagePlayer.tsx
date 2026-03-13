import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface Props {
    url: string;
    duration?: string;
}

// Generate pseudo-random waveform from URL hash so bars are stable per message
function generateBars(url: string, count: number): number[] {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
        hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
        bars.push(4 + (hash % 18));
    }
    return bars;
}

const BAR_COUNT = 30;

export function VoiceMessagePlayer({ url, duration }: Props) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState('0:00');
    const bars = useRef(generateBars(url, BAR_COUNT)).current;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => {
            const pct = audio.duration ? audio.currentTime / audio.duration : 0;
            setProgress(pct);
            const s = Math.floor(audio.currentTime);
            setElapsed(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
        };
        const onEnded = () => { setPlaying(false); setProgress(0); setElapsed('0:00'); };
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.play().catch(() => {});
            setPlaying(true);
        }
    };

    const handleBarClick = (index: number) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const pct = index / BAR_COUNT;
        audio.currentTime = pct * audio.duration;
        setProgress(pct);
        if (!playing) {
            audio.play().catch(() => {});
            setPlaying(true);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-tertiary)', padding: '8px 14px',
            borderRadius: '20px', display: 'inline-flex', alignItems: 'center',
            gap: '10px', marginTop: '4px', border: '1px solid var(--stroke)',
            maxWidth: '320px',
        }}>
            <button
                onClick={toggle}
                style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--accent-primary)', border: 'none',
                    color: 'white', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
            >
                {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
            </button>
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '1.5px',
                    height: '24px', cursor: 'pointer', flex: 1,
                }}
            >
                {bars.map((h, i) => {
                    const filled = i / BAR_COUNT <= progress;
                    return (
                        <div
                            key={i}
                            onClick={() => handleBarClick(i)}
                            style={{
                                width: '3px', height: `${h}px`,
                                background: filled ? 'var(--accent-primary)' : 'var(--text-muted)',
                                borderRadius: '2px', transition: 'background 0.1s',
                                opacity: filled ? 1 : 0.4,
                            }}
                        />
                    );
                })}
            </div>
            <span style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', minWidth: '32px', flexShrink: 0,
            }}>
                {playing ? elapsed : (duration || '0:00')}
            </span>
            <audio ref={audioRef} src={url} preload="metadata" />
        </div>
    );
}
