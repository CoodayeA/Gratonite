import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, Play } from 'lucide-react';

// ─── Web Audio API sound generators ──────────────────────────────────────────

let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
    if (!sharedCtx || sharedCtx.state === 'closed') {
        sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
}

function playAirhorn(vol: number) {
    const ctx = getAudioCtx();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    g.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.2);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
}

function playCrickets(vol: number) {
    const ctx = getAudioCtx();
    for (let i = 0; i < 6; i++) {
        const t = ctx.currentTime + i * 0.12;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4000 + Math.random() * 800, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }
}

function playDrumRoll(vol: number) {
    const ctx = getAudioCtx();
    for (let i = 0; i < 16; i++) {
        const t = ctx.currentTime + i * 0.04;
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15 * vol * (0.5 + i / 32), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(g);
        g.connect(ctx.destination);
        src.start(t);
    }
}

function playTada(vol: number) {
    const ctx = getAudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.1;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    });
}

function playSadTrombone(vol: number) {
    const ctx = getAudioCtx();
    const notes = [293.66, 277.18, 261.63, 246.94];
    notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.35;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.15 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
    });
}

function playApplause(vol: number) {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
        const env = i < d.length * 0.1 ? i / (d.length * 0.1) : 1 - (i - d.length * 0.1) / (d.length * 0.9);
        d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.25 * vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
}

function playSwoosh(vol: number) {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.2);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.4);
    filter.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0.2 * vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
}

function playBuzzer(vol: number) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 150;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.2 * vol, ctx.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
}

const SOUND_PLAYERS: Record<number, (vol: number) => void> = {
    1: playAirhorn,
    2: playCrickets,
    3: playDrumRoll,
    4: playTada,
    5: playSadTrombone,
    6: playApplause,
    7: playSwoosh,
    8: playBuzzer,
};

const SOUNDBOARD_VOLUME_KEY = 'gratonite_soundboard_volume';

const sounds = [
    { id: 1, name: 'Airhorn', emoji: '📢', color: '#f59e0b' },
    { id: 2, name: 'Crickets', emoji: '🦗', color: '#10b981' },
    { id: 3, name: 'Drum Roll', emoji: '🥁', color: '#3b82f6' },
    { id: 4, name: 'Tada', emoji: '🎉', color: '#ec4899' },
    { id: 5, name: 'Sad Trombone', emoji: '🎺', color: '#8b5cf6' },
    { id: 6, name: 'Applause', emoji: '👏', color: '#f43f5e' },
    { id: 7, name: 'Swoosh', emoji: '💨', color: '#64748b' },
    { id: 8, name: 'Buzzer', emoji: '🚨', color: '#ef4444' },
];

interface SoundboardMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onPlaySound: (sound: { name: string, emoji: string }) => void;
}

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

const SoundboardMenu = ({ isOpen, onPlaySound }: SoundboardMenuProps) => {
    const [pressTimestamps, setPressTimestamps] = useState<number[]>([]);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [volume, setVolume] = useState(() => {
        const stored = localStorage.getItem(SOUNDBOARD_VOLUME_KEY);
        return stored ? parseFloat(stored) : 0.7;
    });

    const isRateLimited = cooldownRemaining > 0;

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (cooldownInterval.current) {
                clearInterval(cooldownInterval.current);
            }
        };
    }, []);

    const startCooldownTimer = useCallback((oldestTimestamp: number) => {
        if (cooldownInterval.current) {
            clearInterval(cooldownInterval.current);
        }
        const updateRemaining = () => {
            const elapsed = Date.now() - oldestTimestamp;
            const remaining = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
            if (remaining <= 0) {
                setCooldownRemaining(0);
                if (cooldownInterval.current) {
                    clearInterval(cooldownInterval.current);
                    cooldownInterval.current = null;
                }
            } else {
                setCooldownRemaining(remaining);
            }
        };
        updateRemaining();
        cooldownInterval.current = setInterval(updateRemaining, 1000);
    }, []);

    const handlePlay = useCallback((sound: { name: string; emoji: string }) => {
        const now = Date.now();
        const recentPresses = pressTimestamps.filter(
            (ts) => now - ts < RATE_LIMIT_WINDOW_MS
        );

        if (recentPresses.length >= RATE_LIMIT_MAX) {
            // Already rate limited; start/refresh the countdown from the oldest recent press
            const oldestRecent = recentPresses[0];
            startCooldownTimer(oldestRecent);
            return;
        }

        const updatedTimestamps = [...recentPresses, now];
        setPressTimestamps(updatedTimestamps);
        // Play audio via Web Audio API
        const player = SOUND_PLAYERS[(sound as any).id ?? 0];
        if (player) player(volume);
        onPlaySound(sound);

        // If this press hits the limit, start the cooldown timer
        if (updatedTimestamps.length >= RATE_LIMIT_MAX) {
            startCooldownTimer(updatedTimestamps[0]);
        }
    }, [pressTimestamps, onPlaySound, startCooldownTimer]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '100%',
            right: '0',
            marginBottom: '12px',
            width: '320px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)' }}>
                <Volume2 size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Guild Soundboard</span>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '300px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {sounds.map(sound => (
                        <button
                            key={sound.id}
                            onClick={() => handlePlay(sound)}
                            disabled={isRateLimited}
                            className="soundboard-btn"
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: isRateLimited ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: isRateLimited ? 0.4 : 1,
                                filter: isRateLimited ? 'grayscale(0.6)' : 'none',
                                pointerEvents: isRateLimited ? 'none' : 'auto'
                            }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: sound.color, opacity: 0.8 }}></div>
                            <div style={{ fontSize: '24px' }}>{sound.emoji}</div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{sound.name}</div>
                            <div className="play-overlay" style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s', backdropFilter: 'blur(2px)'
                            }}>
                                <Play size={24} color="white" fill="white" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {isRateLimited && (
                <div style={{
                    padding: '6px 16px',
                    borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#f59e0b',
                    textAlign: 'center',
                    background: 'rgba(245, 158, 11, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}>
                    Cooldown: {cooldownRemaining}s remaining
                </div>
            )}

            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)' }}>
                <Volume2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                    type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        localStorage.setItem(SOUNDBOARD_VOLUME_KEY, String(v));
                    }}
                    style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
            </div>

            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--stroke)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                Sounds are audible to everyone in #announcements
            </div>

            <style>
                {`
                    .soundboard-btn:hover {
                        transform: translateY(-2px);
                        border-color: var(--accent-primary);
                        box-shadow: 0 4px 12px rgba(82, 109, 245, 0.2);
                    }
                    .soundboard-btn:hover .play-overlay {
                        opacity: 1 !important;
                    }
                    .soundboard-btn:active {
                        transform: translateY(1px);
                    }
                `}
            </style>
        </div>
    );
};

export default SoundboardMenu;
