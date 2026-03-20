import { useState, useEffect, useCallback } from 'react';
import { Zap, Gift, Trophy, Flame, Check, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

type Challenge = {
    id: string;
    type: string;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
    reward: number;
};

type StreakInfo = {
    current: number;
    longest: number;
    allCompleted: boolean;
    allClaimed: boolean;
    streakBonus: number;
};

const CHALLENGE_ICONS: Record<string, string> = {
    send_messages: '💬',
    react_to_messages: '👍',
    join_voice: '🎙️',
    visit_servers: '🏠',
    send_reactions: '😄',
    reply_to_messages: '↩️',
    pin_messages: '📌',
};

const DailyChallenges = () => {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [streak, setStreak] = useState<StreakInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [claimingStreak, setClaimingStreak] = useState(false);
    const { addToast } = useToast();

    const fetchChallenges = useCallback(async () => {
        try {
            const data = await api.dailyChallenges.get();
            setChallenges(data.challenges);
            setStreak(data.streak);
        } catch {
            addToast({ title: 'Failed to load challenges', variant: 'error' });
        }
        setLoading(false);
    }, [addToast]);

    useEffect(() => {
        fetchChallenges();
        // Re-fetch every 30 seconds so progress updates are visible
        const interval = setInterval(fetchChallenges, 30_000);
        return () => clearInterval(interval);
    }, [fetchChallenges]);

    const handleClaim = async (challengeId: string) => {
        setClaimingId(challengeId);
        try {
            const result = await api.dailyChallenges.claim(challengeId);
            addToast({ title: `Claimed ${result.reward} coins!`, variant: 'success' });
            setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, claimed: true } : c));
            // Re-fetch to update streak info
            const data = await api.dailyChallenges.get();
            setStreak(data.streak);
        } catch {
            addToast({ title: 'Failed to claim reward', variant: 'error' });
        }
        setClaimingId(null);
    };

    const handleClaimStreak = async () => {
        setClaimingStreak(true);
        try {
            const result = await api.dailyChallenges.claimStreak();
            addToast({ title: `Streak bonus: +${result.streakBonus} coins! (${result.currentStreak}-day streak)`, variant: 'success' });
            setStreak(prev => prev ? {
                ...prev,
                current: result.currentStreak,
                longest: result.longestStreak,
                streakBonus: 0,
                allClaimed: true,
            } : null);
        } catch {
            addToast({ title: 'Failed to claim streak bonus', variant: 'error' });
        }
        setClaimingStreak(false);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <Loader2 className="spin" size={24} />
            </div>
        );
    }

    const completedCount = challenges.filter(c => c.completed).length;
    const totalRewards = challenges.reduce((sum, c) => sum + c.reward, 0);

    return (
        <div style={{ padding: '24px 32px', maxWidth: '640px', margin: '0 auto', height: '100%', overflow: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Zap size={28} style={{ color: 'var(--accent-primary)' }} />
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--text-primary)' }}>Daily Challenges</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                        Complete challenges to earn coins. New challenges every day!
                    </p>
                </div>
            </div>

            {/* Streak banner */}
            {streak && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.1), rgba(255, 69, 0, 0.1))',
                    border: '1px solid rgba(255, 165, 0, 0.2)',
                    borderRadius: '12px', padding: '16px', marginBottom: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Flame size={24} style={{ color: '#ff6b35' }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                                {streak.current}-Day Streak
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Best: {streak.longest} days | {completedCount}/3 completed today
                            </div>
                        </div>
                    </div>
                    {streak.allCompleted && streak.streakBonus > 0 && (
                        <button
                            onClick={handleClaimStreak}
                            disabled={claimingStreak}
                            style={{
                                background: 'linear-gradient(135deg, #ff6b35, #ff9800)',
                                color: '#fff', border: 'none', borderRadius: '8px',
                                padding: '8px 16px', fontWeight: 700, fontSize: '13px',
                                cursor: claimingStreak ? 'default' : 'pointer',
                                opacity: claimingStreak ? 0.7 : 1,
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            <Gift size={14} />
                            +{streak.streakBonus} Bonus
                        </button>
                    )}
                    {streak.allClaimed && streak.allCompleted && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: '#22c55e', fontSize: '13px', fontWeight: 600,
                        }}>
                            <Check size={16} /> All done!
                        </div>
                    )}
                </div>
            )}

            {/* Progress summary */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '20px',
            }}>
                <div style={{
                    flex: 1, background: 'var(--bg-secondary)', borderRadius: '10px',
                    padding: '14px', textAlign: 'center', border: '1px solid var(--stroke)',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-primary)' }}>{completedCount}/3</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Completed</div>
                </div>
                <div style={{
                    flex: 1, background: 'var(--bg-secondary)', borderRadius: '10px',
                    padding: '14px', textAlign: 'center', border: '1px solid var(--stroke)',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24' }}>{totalRewards}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Coins</div>
                </div>
                <div style={{
                    flex: 1, background: 'var(--bg-secondary)', borderRadius: '10px',
                    padding: '14px', textAlign: 'center', border: '1px solid var(--stroke)',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff6b35' }}>
                        <Trophy size={24} style={{ display: 'inline' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {streak?.longest ?? 0} best
                    </div>
                </div>
            </div>

            {/* Challenge cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {challenges.map(challenge => {
                    const pct = Math.min(challenge.progress / challenge.target, 1) * 100;
                    return (
                        <div
                            key={challenge.id}
                            style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: '12px',
                                padding: '16px',
                                border: `1px solid ${challenge.completed ? 'rgba(34, 197, 94, 0.3)' : 'var(--stroke)'}`,
                                transition: 'border-color 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '24px' }}>{CHALLENGE_ICONS[challenge.type] || '🎯'}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                            {challenge.description}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {challenge.progress}/{challenge.target} completed
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {challenge.claimed ? (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            color: '#22c55e', fontSize: '13px', fontWeight: 600,
                                        }}>
                                            <Check size={14} /> Claimed
                                        </div>
                                    ) : challenge.completed ? (
                                        <button
                                            onClick={() => handleClaim(challenge.id)}
                                            disabled={claimingId === challenge.id}
                                            style={{
                                                background: 'var(--accent-primary)',
                                                color: '#fff', border: 'none', borderRadius: '8px',
                                                padding: '6px 14px', fontWeight: 700, fontSize: '13px',
                                                cursor: claimingId === challenge.id ? 'default' : 'pointer',
                                                opacity: claimingId === challenge.id ? 0.7 : 1,
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}
                                        >
                                            <Gift size={14} /> +{challenge.reward}
                                        </button>
                                    ) : (
                                        <div style={{
                                            padding: '6px 14px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)',
                                            fontSize: '13px', fontWeight: 600,
                                            color: '#fbbf24',
                                        }}>
                                            +{challenge.reward}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div style={{
                                height: '6px', borderRadius: '3px',
                                background: 'var(--bg-tertiary)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${pct}%`,
                                    borderRadius: '3px',
                                    background: challenge.completed
                                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                        : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary, var(--accent-primary)))',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info footer */}
            <div style={{
                marginTop: '24px', padding: '12px 16px', borderRadius: '10px',
                background: 'var(--bg-tertiary)', fontSize: '12px', color: 'var(--text-muted)',
                lineHeight: '1.5',
            }}>
                Challenges reset daily at midnight. Complete all 3 to build your streak
                and earn bonus coins! Streak bonuses increase up to 70 coins at 7+ days.
            </div>
        </div>
    );
};

export default DailyChallenges;
