import { useState, useEffect } from 'react';
import { Target, Gift, Activity, Wallet, History, MessageSquare, Plus, Minus, Check, ShoppingBag, Info, Zap, Star, Users, Trophy, Loader2 } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/ToastManager';
import { MagneticButton } from '../../components/ui/Physics';
import { api } from '../../lib/api';

const GratoniteDashboard = () => {
    const { hasCustomBg, gratoniteBalance, setGratoniteBalance } = useOutletContext<any>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [claimedToday, setClaimedToday] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [transactions, setTransactions] = useState<{ id: string; type: string; amount: number; date: string; title: string }[]>([]);
    const [loadingTx, setLoadingTx] = useState(true);
    const [txError, setTxError] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Fetch transaction history and wallet on mount
    useEffect(() => {
        setLoadingTx(true);
        setTxError(false);

        Promise.all([
            api.economy.getLedger(20).catch(() => null),
            api.economy.getWallet().catch(() => null),
        ]).then(([ledger, wallet]) => {
            if (ledger) {
                const mapped = ledger.map((entry: any, idx: number) => ({
                    id: entry.id || `${entry.source || 'ledger'}:${entry.createdAt || 'unknown'}:${idx}`,
                    type: mapSourceToType(entry.source),
                    amount: entry.amount ?? 0,
                    date: formatDate(entry.createdAt),
                    title: entry.description || sourceLabel(entry.source),
                }));
                setTransactions(mapped);
            }
            if (wallet) {
                setGratoniteBalance(wallet.balance ?? gratoniteBalance);
                // Check if daily was already claimed today based on ledger
                if (ledger) {
                    const today = new Date().toISOString().slice(0, 10);
                    const dailyClaimed = ledger.some((e: any) =>
                        e.source === 'daily_checkin' && e.createdAt?.startsWith(today)
                    );
                    setClaimedToday(dailyClaimed);
                }
            }
            if (!ledger && !wallet) {
                setTxError(true);
            }
            setLoadingTx(false);
        });
    }, []);

    const handleClaimDaily = async () => {
        if (claimedToday || claiming) return;
        setClaiming(true);
        try {
            const result = await api.economy.claimReward({ source: 'daily_checkin' });
            setClaimedToday(true);
            if (result.wallet) {
                setGratoniteBalance(result.wallet.balance);
            }
            const earned = result.amount ?? 50;
            setTransactions(prev => [{
                id: String(Date.now()),
                type: 'daily',
                amount: earned,
                date: 'Just now',
                title: 'Daily Login Reward'
            }, ...prev]);
            addToast({ title: `Claimed ${earned} Gratonite!`, variant: 'success' });
        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('already') || msg.includes('ALREADY_CLAIMED')) {
                setClaimedToday(true);
                addToast({ title: 'Already claimed today', variant: 'info' });
            } else {
                addToast({ title: 'Failed to claim reward', description: 'Please try again later.', variant: 'error' });
            }
        } finally {
            setClaiming(false);
        }
    };

    const handleLoadMore = async () => {
        setLoadingMore(true);
        try {
            const ledger = await api.economy.getLedger(transactions.length + 20);
            const mapped = ledger.map((entry: any, idx: number) => ({
                id: entry.id || `${entry.source || 'ledger'}:${entry.createdAt || 'unknown'}:${idx}`,
                type: mapSourceToType(entry.source),
                amount: entry.amount ?? 0,
                date: formatDate(entry.createdAt),
                title: entry.description || sourceLabel(entry.source),
            }));
            setTransactions(mapped);
            addToast({ title: 'Transactions loaded', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to load transactions', variant: 'error' });
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`}>
            <header className="top-bar">
                <Wallet size={24} style={{ color: 'var(--accent-primary)' }} />
                <h2>Gratonite Balance & Rewards</h2>
            </header>

            <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                {/* Hero / Balance Section */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-elevated))',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '40px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '32px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'var(--accent-purple)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', zIndex: 1 }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--accent-primary)' }}>
                            <span style={{ fontSize: '40px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>&#8383;</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px' }}>Current Balance</h3>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                                <span style={{ fontSize: '48px', fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{gratoniteBalance.toLocaleString()}</span>
                                <span style={{ fontSize: '18px', color: 'var(--accent-primary)', fontWeight: 600 }}>Gratonites</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', zIndex: 1 }}>
                        <MagneticButton className="auth-button" onClick={() => navigate('/shop')} style={{ margin: 0, width: 'auto', padding: '0 24px', zIndex: 10 }}>Shop Cosmetics</MagneticButton>
                    </div>
                </div>

                {/* How to Earn Gratonite */}
                <div style={{ background: 'linear-gradient(135deg, rgba(82, 109, 245, 0.08), rgba(139, 92, 246, 0.08))', border: '1px solid var(--accent-primary)', borderRadius: '16px', padding: '28px 32px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <Info size={20} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '18px', fontWeight: 700 }}>How to Earn Gratonite</h3>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '600px', lineHeight: 1.6 }}>
                        Gratonite is Gratonite's <strong>community-earned currency</strong> — it cannot be purchased with real money. Every Gratonite you hold was earned through activity, milestones, and community participation. This keeps the economy fair for everyone.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                        {[
                            { icon: <Gift size={20} />, title: 'Daily Login', desc: 'Claim 50\u2013350 Gratonite per day with streak bonuses.', color: '#8b5cf6' },
                            { icon: <MessageSquare size={20} />, title: 'Chat Activity', desc: '+2 Gratonite per message (capped at 200/day).', color: 'var(--accent-primary)' },
                            { icon: <Trophy size={20} />, title: 'Milestones', desc: 'Complete activity milestones for large one-time bonuses.', color: '#f59e0b' },
                            { icon: <Star size={20} />, title: 'FAME Received', desc: 'Each thumbs-up from another user earns +200 Gratonite.', color: '#10b981' },
                            { icon: <Users size={20} />, title: 'Invite Friends', desc: '+500 Gratonite for each friend who joins via your link.', color: '#ec4899' },
                            { icon: <Zap size={20} />, title: 'Events & Contests', desc: 'Participate in community events for exclusive rewards.', color: '#06b6d4' },
                        ].map(item => (
                            <div key={item.title} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px' }}>
                                <div style={{ color: item.color, marginBottom: '8px' }}>{item.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{item.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 400px)', gap: '32px' }}>

                    {/* Left Col: Transactions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <History size={20} color="var(--text-muted)" />
                            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Transaction Ledger</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {loadingTx ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: 'var(--text-muted)', gap: '8px' }}>
                                    <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Loading transactions...</span>
                                </div>
                            ) : txError ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    Failed to load transactions. Try refreshing the page.
                                </div>
                            ) : transactions.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    No transactions yet. Earn Gratonite by chatting, claiming daily rewards, and more!
                                </div>
                            ) : (
                                transactions.map(tx => (
                                    <div key={tx.id} style={{
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {tx.type === 'daily' && <Gift size={18} color="var(--accent-purple)" />}
                                                {tx.type === 'chat' && <MessageSquare size={18} color="var(--text-secondary)" />}
                                                {tx.type === 'purchase' && <ShoppingBag size={18} color="var(--error)" />}
                                                {tx.type === 'milestone' && <Target size={18} color="var(--success)" />}
                                                {tx.type === 'gacha' && <span style={{ fontSize: '18px' }}>&#127922;</span>}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{tx.title}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tx.date}</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            fontWeight: 700, fontFamily: 'var(--font-mono)',
                                            color: tx.amount > 0 ? 'var(--success)' : 'var(--text-primary)',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}>
                                            {tx.amount > 0 ? <Plus size={14} /> : <Minus size={14} />}
                                            {Math.abs(tx.amount)} &#8383;
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {!loadingTx && !txError && (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: loadingMore ? 'wait' : 'pointer', fontWeight: 600, padding: '8px', textAlign: 'center', marginTop: '8px', opacity: loadingMore ? 0.5 : 1 }}
                            >
                                {loadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        )}
                    </div>

                    {/* Right Col: Rewards & Objectives */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Daily Box */}
                        <div style={{
                            background: claimedToday ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
                            border: `1px solid ${claimedToday ? 'var(--stroke)' : 'var(--accent-purple)'}`,
                            borderRadius: '12px', padding: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div>
                                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: claimedToday ? 'var(--text-muted)' : 'var(--text-primary)', marginBottom: '4px' }}>Daily Login Reward</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Log in every day to earn increasing rewards.</p>
                                </div>
                                <Gift size={24} color={claimedToday ? 'var(--text-muted)' : 'var(--accent-purple)'} />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                                {[1, 2, 3, 4, 5, 6, 7].map((day, i) => (
                                    <div key={day} style={{
                                        flex: 1, aspectRatio: '1', borderRadius: '4px',
                                        background: i === 2 ? 'var(--accent-primary)' : i < 2 ? 'var(--success)' : 'var(--bg-elevated)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        opacity: i > 2 ? 0.5 : 1
                                    }}>
                                        <span style={{ fontSize: '10px', fontWeight: 600 }}>D{day}</span>
                                        {i < 2 ? <Check size={12} color="white" /> : <span style={{ fontSize: '10px' }}>{day * 10}</span>}
                                    </div>
                                ))}
                            </div>

                            <MagneticButton
                                className="auth-button"
                                style={{ margin: 0, height: '40px', background: claimedToday ? 'var(--bg-elevated)' : 'var(--accent-primary)', color: claimedToday ? 'var(--text-muted)' : 'white', zIndex: 10 }}
                                disabled={claimedToday || claiming}
                                onClick={handleClaimDaily}
                            >
                                {claiming ? 'Claiming...' : claimedToday ? 'Claimed Today' : 'Claim 50 \u20BF'}
                            </MagneticButton>
                        </div>

                        {/* Milestones */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <Activity size={20} color="var(--text-muted)" />
                                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Active Milestones</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Milestone 1 */}
                                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '14px' }}>Chatterbox</span>
                                        <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 600 }}>+100 &#8383;</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Send 500 messages across any portals.</div>
                                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: '65%', height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        <span>325 / 500</span>
                                        <span>65%</span>
                                    </div>
                                </div>

                                {/* Milestone 2 */}
                                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '14px' }}>Community Leader</span>
                                        <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 600 }}>+500 &#8383;</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Have 10 people join a portal you created.</div>
                                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: '30%', height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        <span>3 / 10</span>
                                        <span>30%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
};

// Helpers
function mapSourceToType(source: string): string {
    if (source === 'daily_checkin') return 'daily';
    if (source === 'chat_message' || source === 'server_engagement') return 'chat';
    if (source === 'shop_purchase') return 'purchase';
    if (source === 'creator_item_purchase') return 'gacha';
    return 'milestone';
}

function sourceLabel(source: string): string {
    const labels: Record<string, string> = {
        daily_checkin: 'Daily Login Reward',
        chat_message: 'Chat Activity Reward',
        server_engagement: 'Server Engagement Reward',
        shop_purchase: 'Shop Purchase',
        creator_item_purchase: 'Creator Item Purchase',
    };
    return labels[source] || source;
}

function formatDate(iso?: string): string {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return d.toLocaleDateString();
}

export default GratoniteDashboard;
