import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, Play } from 'lucide-react';

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
