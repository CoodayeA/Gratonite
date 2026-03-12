import { useState, useEffect } from 'react';
import { Gift, Clock, Sparkles, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './ToastManager';

interface DailyCheckInProps {
    onBalanceUpdate?: (newBalance: number) => void;
}

const DailyCheckIn = ({ onBalanceUpdate }: DailyCheckInProps) => {
    const { addToast } = useToast();
    const [claimed, setClaimed] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [nextClaimAt, setNextClaimAt] = useState<string | null>(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);

    // On mount, check wallet status without claiming
    useEffect(() => {
        const checkOnly = async () => {
            try {
                const wallet = await api.economy.getWallet();
                if (wallet.lastDailyClaimAt) {
                    const elapsed = Date.now() - new Date(wallet.lastDailyClaimAt).getTime();
                    const cooldown = 24 * 60 * 60 * 1000;
                    if (elapsed < cooldown) {
                        setClaimed(true);
                        setNextClaimAt(new Date(new Date(wallet.lastDailyClaimAt).getTime() + cooldown).toISOString());
                    }
                }
            } catch {
                // OK
            } finally {
                setLoading(false);
            }
        };
        checkOnly();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!nextClaimAt) return;
        const update = () => {
            const diff = new Date(nextClaimAt).getTime() - Date.now();
            if (diff <= 0) {
                setClaimed(false);
                setNextClaimAt(null);
                setCountdown('');
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${h}h ${m}m ${s}s`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [nextClaimAt]);

    const handleClaim = async () => {
        if (claiming || claimed) return;
        setClaiming(true);
        try {
            const result = await api.economy.claimReward({ source: 'daily_checkin' });
            if (result.amount > 0) {
                setClaimed(true);
                onBalanceUpdate?.(result.wallet.balance);
                addToast({
                    title: `+${result.amount} Gratonites!`,
                    description: 'Daily check-in reward claimed!',
                    variant: 'achievement',
                });
                // Set next claim time (24h from now)
                setNextClaimAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
            } else if (result.nextClaimAt) {
                setClaimed(true);
                setNextClaimAt(result.nextClaimAt);
            }
        } catch {
            addToast({ title: 'Failed to claim reward', variant: 'error' });
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return null;

    return (
        <div
            className="glass-panel neo-shadow"
            style={{
                padding: '20px 24px',
                borderRadius: '14px',
                border: '1px solid var(--stroke)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: claimed
                    ? 'var(--bg-tertiary)'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(16,185,129,0.06))',
                width: '100%',
                marginBottom: '24px',
            }}
        >
            <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: claimed
                    ? 'var(--bg-elevated)'
                    : 'linear-gradient(135deg, #f59e0b, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                {claimed ? <Check size={24} style={{ color: '#10b981' }} /> : <Gift size={24} color="#111" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-display)', marginBottom: '2px' }}>
                    {claimed ? 'Reward Claimed!' : 'Daily Reward Available'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {claimed ? (
                        countdown ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> Come back in {countdown}
                            </span>
                        ) : 'Ready to claim again!'
                    ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Sparkles size={12} style={{ color: '#f59e0b' }} /> Claim 100 Gratonites
                        </span>
                    )}
                </div>
            </div>
            {!claimed && (
                <button
                    onClick={handleClaim}
                    disabled={claiming}
                    aria-label="Claim daily reward"
                    style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#111',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: claiming ? 'wait' : 'pointer',
                        opacity: claiming ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: '2px 2px 0 rgba(0,0,0,0.1)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        flexShrink: 0,
                    }}
                    onMouseOver={(e) => {
                        if (!claiming) {
                            e.currentTarget.style.transform = 'translate(-1px, -1px)';
                            e.currentTarget.style.boxShadow = '3px 3px 0 rgba(0,0,0,0.15)';
                        }
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '2px 2px 0 rgba(0,0,0,0.1)';
                    }}
                >
                    <Gift size={14} /> Claim
                </button>
            )}
        </div>
    );
};

export default DailyCheckIn;
