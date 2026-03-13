import { useState, useRef, useCallback } from 'react';
import { Gem, Sparkles, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './ToastManager';

interface SpinWheelProps {
    onReward?: (reward: { type: string; amount: number; label: string }) => void;
    onClose?: () => void;
}

const SEGMENTS = [
    { label: '50', amount: 50, type: 'gratonites', color: '#3b82f6', textColor: '#fff' },
    { label: '100', amount: 100, type: 'gratonites', color: '#10b981', textColor: '#fff' },
    { label: 'Nothing', amount: 0, type: 'nothing', color: '#374151', textColor: '#9ca3af' },
    { label: '200', amount: 200, type: 'gratonites', color: '#8b5cf6', textColor: '#fff' },
    { label: 'XP Boost', amount: 0, type: 'xp_boost', color: '#f59e0b', textColor: '#fff' },
    { label: 'Nothing', amount: 0, type: 'nothing', color: '#4b5563', textColor: '#9ca3af' },
    { label: 'Cosmetic', amount: 0, type: 'cosmetic', color: '#ec4899', textColor: '#fff' },
    { label: '500', amount: 500, type: 'gratonites', color: '#f59e0b', textColor: '#000' },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;

export const SpinWheel = ({ onReward, onClose }: SpinWheelProps) => {
    const { addToast } = useToast();
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<typeof SEGMENTS[0] | null>(null);
    const [cooldown, setCooldown] = useState(false);
    const wheelRef = useRef<HTMLDivElement>(null);

    const checkCooldown = useCallback(() => {
        const lastSpin = localStorage.getItem('gratonite_last_spin');
        if (lastSpin) {
            const elapsed = Date.now() - parseInt(lastSpin, 10);
            if (elapsed < 24 * 60 * 60 * 1000) {
                setCooldown(true);
                return true;
            }
        }
        return false;
    }, []);

    useState(() => { checkCooldown(); });

    const spin = async () => {
        if (spinning || cooldown) return;
        if (checkCooldown()) return;

        setSpinning(true);
        setResult(null);

        try {
            const res = await api.post<{ reward: { type: string; amount: number; label: string } }>('/economy/daily-spin', {});
            const rewardData = (res as any)?.reward;

            // Determine winning segment index
            let winIdx = 0;
            if (rewardData) {
                winIdx = SEGMENTS.findIndex(s => s.type === rewardData.type && s.amount === rewardData.amount);
                if (winIdx === -1) winIdx = Math.floor(Math.random() * SEGMENTS.length);
            } else {
                winIdx = Math.floor(Math.random() * SEGMENTS.length);
            }

            // Calculate rotation: multiple full spins + landing on segment
            const targetAngle = 360 - (winIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
            const totalRotation = rotation + 1800 + targetAngle;
            setRotation(totalRotation);

            // Wait for animation
            setTimeout(() => {
                setResult(SEGMENTS[winIdx]);
                setSpinning(false);
                localStorage.setItem('gratonite_last_spin', String(Date.now()));
                setCooldown(true);

                if (rewardData) {
                    onReward?.(rewardData);
                    if (rewardData.amount > 0) {
                        addToast({ title: `+${rewardData.amount} Gratonites!`, description: 'Daily spin reward!', variant: 'achievement' });
                    }
                } else {
                    const seg = SEGMENTS[winIdx];
                    onReward?.({ type: seg.type, amount: seg.amount, label: seg.label });
                    if (seg.amount > 0) {
                        addToast({ title: `+${seg.amount} Gratonites!`, description: 'Daily spin reward!', variant: 'achievement' });
                    }
                }
            }, 4000);
        } catch {
            // Fallback: spin locally
            const winIdx = Math.floor(Math.random() * SEGMENTS.length);
            const targetAngle = 360 - (winIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
            const totalRotation = rotation + 1800 + targetAngle;
            setRotation(totalRotation);

            setTimeout(() => {
                setResult(SEGMENTS[winIdx]);
                setSpinning(false);
                localStorage.setItem('gratonite_last_spin', String(Date.now()));
                setCooldown(true);
            }, 4000);
        }
    };

    const size = 280;
    const cx = size / 2;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '24px', background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', position: 'relative' }}>
            {onClose && (
                <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
            )}

            <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#f59e0b" /> Daily Spin
            </h3>

            {/* Wheel */}
            <div style={{ position: 'relative', width: size, height: size }}>
                {/* Pointer */}
                <div style={{
                    position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                    borderTop: '16px solid var(--accent-primary)', zIndex: 2,
                }} />

                <div
                    ref={wheelRef}
                    style={{
                        width: size, height: size, borderRadius: '50%',
                        border: '4px solid var(--stroke)',
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                        overflow: 'hidden', position: 'relative',
                    }}
                >
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {SEGMENTS.map((seg, i) => {
                            const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180);
                            const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
                            const x1 = cx + cx * Math.cos(startAngle);
                            const y1 = cx + cx * Math.sin(startAngle);
                            const x2 = cx + cx * Math.cos(endAngle);
                            const y2 = cx + cx * Math.sin(endAngle);
                            const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;
                            const midAngle = ((i + 0.5) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
                            const labelR = cx * 0.65;
                            const lx = cx + labelR * Math.cos(midAngle);
                            const ly = cx + labelR * Math.sin(midAngle);

                            return (
                                <g key={i}>
                                    <path
                                        d={`M${cx},${cx} L${x1},${y1} A${cx},${cx} 0 ${largeArc},1 ${x2},${y2} Z`}
                                        fill={seg.color}
                                        stroke="rgba(0,0,0,0.2)"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={lx} y={ly}
                                        fill={seg.textColor}
                                        fontSize="11"
                                        fontWeight="700"
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        transform={`rotate(${(i + 0.5) * SEGMENT_ANGLE}, ${lx}, ${ly})`}
                                    >
                                        {seg.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {result && (
                <div style={{ textAlign: 'center', padding: '12px 24px', background: `${result.color}20`, borderRadius: '12px', border: `1px solid ${result.color}40` }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: result.color }}>
                        {result.type === 'nothing' ? 'Better luck tomorrow!' :
                            result.type === 'gratonites' ? `Won ${result.amount} Gratonites!` :
                                result.type === 'xp_boost' ? 'Won XP Boost!' :
                                    'Won a Random Cosmetic!'}
                    </div>
                </div>
            )}

            <button
                onClick={spin}
                disabled={spinning || cooldown}
                style={{
                    padding: '12px 48px', borderRadius: '12px', fontSize: '16px', fontWeight: 700,
                    background: (spinning || cooldown) ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none', color: (spinning || cooldown) ? 'var(--text-muted)' : '#000',
                    cursor: (spinning || cooldown) ? 'not-allowed' : 'pointer',
                    boxShadow: (spinning || cooldown) ? 'none' : '0 4px 12px rgba(245,158,11,0.3)',
                }}
            >
                {spinning ? 'Spinning...' : cooldown ? 'Come back tomorrow!' : 'SPIN!'}
            </button>
        </div>
    );
};

export default SpinWheel;
