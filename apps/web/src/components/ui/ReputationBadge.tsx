import { useState } from 'react';
import { Shield } from 'lucide-react';

interface ReputationBadgeProps {
    accountAge?: string; // ISO date
    verificationLevel?: number; // 0-3
    fameReceived?: number;
    hasWarnings?: boolean;
    achievementCount?: number;
    size?: 'sm' | 'md';
}

function calcScore(props: ReputationBadgeProps): { total: number; breakdown: { label: string; value: number }[] } {
    const breakdown: { label: string; value: number }[] = [];

    // Account age: days/365 * 20, max 20
    const ageDays = props.accountAge
        ? Math.floor((Date.now() - new Date(props.accountAge).getTime()) / 86400000)
        : 0;
    const ageScore = Math.min(20, Math.round((ageDays / 365) * 20));
    breakdown.push({ label: 'Account Age', value: ageScore });

    // Verification: 0-15
    const verifyScore = Math.min(15, (props.verificationLevel ?? 0) * 5);
    breakdown.push({ label: 'Verification', value: verifyScore });

    // Fame: log scale, max 30
    const fame = props.fameReceived ?? 0;
    const fameScore = fame > 0 ? Math.min(30, Math.round(Math.log10(fame + 1) * 15)) : 0;
    breakdown.push({ label: 'FAME Received', value: fameScore });

    // Warnings penalty
    const warningPenalty = props.hasWarnings ? -20 : 0;
    if (warningPenalty !== 0) breakdown.push({ label: 'Warnings', value: warningPenalty });

    // Achievements: max 15
    const achScore = Math.min(15, (props.achievementCount ?? 0));
    breakdown.push({ label: 'Achievements', value: achScore });

    const total = Math.max(0, Math.min(100, ageScore + verifyScore + fameScore + warningPenalty + achScore));
    return { total, breakdown };
}

function getScoreColor(score: number): string {
    if (score < 30) return '#ef4444';
    if (score < 60) return '#f59e0b';
    if (score < 80) return '#10b981';
    return '#f59e0b'; // gold
}

export const ReputationBadge = (props: ReputationBadgeProps) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const { total, breakdown } = calcScore(props);
    const color = getScoreColor(total);
    const sz = props.size === 'sm' ? 16 : 20;

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'default' }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <Shield size={sz} color={color} fill={`${color}30`} />
            <span style={{ fontSize: props.size === 'sm' ? '10px' : '12px', fontWeight: 700, color }}>{total}</span>

            {showTooltip && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: '8px', padding: '12px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 100, minWidth: '180px', whiteSpace: 'nowrap',
                }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Reputation Score: <span style={{ color }}>{total}</span>
                    </div>
                    {breakdown.map(b => (
                        <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                            <span>{b.label}</span>
                            <span style={{ color: b.value < 0 ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>
                                {b.value > 0 ? '+' : ''}{b.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReputationBadge;
