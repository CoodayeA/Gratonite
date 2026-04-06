import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowLeft, Plus, X, Check, XCircle, Search, Gem } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import { useToast } from '../../components/ui/ToastManager';

type TradeItem = { id: string; name: string; type: string; rarity: string; imageUrl: string | null };

type Trade = {
    id: string;
    proposerId: string;
    recipientId: string;
    status: 'pending' | 'accepted' | 'rejected';
    proposerItems: TradeItem[];
    recipientItems: TradeItem[];
    proposerGratonites: number;
    recipientGratonites: number;
    proposerName?: string;
    recipientName?: string;
    proposerAvatar?: string | null;
    recipientAvatar?: string | null;
    createdAt: string;
};

type InventoryItem = { id: string; name: string; type: string; rarity: string; imageUrl: string | null };
type Friend = { id: string; userId: string; username: string; displayName: string; avatarHash: string | null };

const Trading = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { gratoniteBalance } = useOutletContext<any>();

    const [view, setView] = useState<'list' | 'create'>('list');
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    // Create trade state
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendSearch, setFriendSearch] = useState('');
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [myInventory, setMyInventory] = useState<InventoryItem[]>([]);
    const [myOffer, setMyOffer] = useState<InventoryItem[]>([]);
    const [myGratonites, setMyGratonites] = useState(0);
    const [theirGratonites, setTheirGratonites] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get<Trade[]>('/trades/pending');
                if (Array.isArray(data)) setTrades(data);
            } catch { /* empty */ }
            setLoading(false);
        };
        load();
    }, []);

    const startCreate = async () => {
        setView('create');
        try {
            const [friendsData, invData] = await Promise.all([
                api.get<any[]>('/relationships?type=friend').catch(() => []),
                api.get<any>('/inventory').catch(() => ({ items: [] })),
            ]);
            if (Array.isArray(friendsData)) {
                setFriends(friendsData.map((f: any) => ({
                    id: f.id, userId: f.userId ?? f.id,
                    username: f.username ?? '', displayName: f.displayName ?? f.username ?? 'User',
                    avatarHash: f.avatarHash ?? null,
                })));
            }
            const items = Array.isArray(invData) ? invData : (invData?.items ?? []);
            setMyInventory(items.map((i: any) => ({
                id: i.id ?? i.itemId, name: i.name ?? 'Item', type: i.type ?? 'unknown',
                rarity: i.rarity ?? 'common', imageUrl: i.imageUrl ?? null,
            })));
        } catch { /* empty */ }
    };

    const handlePropose = async () => {
        if (!selectedFriend || submitting) return;
        setSubmitting(true);
        try {
            await api.post('/trades/propose', {
                recipientId: selectedFriend.userId,
                proposerItems: myOffer.map(i => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, imageUrl: i.imageUrl })),
                recipientItems: [],
                proposerGratonites: myGratonites,
                recipientGratonites: theirGratonites,
            });
            addToast({ title: 'Trade Proposed', description: `Sent to ${selectedFriend.displayName}`, variant: 'success' });
            setView('list');
            setSelectedFriend(null);
            setMyOffer([]);
            setMyGratonites(0);
            setTheirGratonites(0);
        } catch (err: any) {
            addToast({ title: 'Failed', description: err?.message ?? 'Could not propose trade', variant: 'error' });
        }
        setSubmitting(false);
    };

    const handleAction = async (tradeId: string, action: 'accept' | 'reject') => {
        try {
            await api.post(`/trades/${tradeId}/${action}`, {});
            setTrades(prev => prev.filter(t => t.id !== tradeId));
            addToast({ title: action === 'accept' ? 'Trade Accepted' : 'Trade Rejected', variant: action === 'accept' ? 'success' : 'info' });
        } catch (err: any) {
            addToast({ title: 'Error', description: err?.message ?? 'Failed', variant: 'error' });
        }
    };

    const filteredFriends = friends.filter(f =>
        f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
        f.username.toLowerCase().includes(friendSearch.toLowerCase())
    );

    const rarityColor: Record<string, string> = { common: '#71717a', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
    const [showConfirm, setShowConfirm] = useState(false);

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            {/* Trade Review Confirmation Modal */}
            {showConfirm && selectedFriend && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', width: 'min(460px, 95vw)', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Review Trade</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            This will be sent to <strong style={{ color: 'var(--text-primary)' }}>{selectedFriend.displayName}</strong>. Please review before sending.
                        </p>
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>You're Offering</div>
                            {myOffer.length === 0 && myGratonites === 0 && (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nothing</p>
                            )}
                            {myOffer.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: rarityColor[item.rarity] ?? '#71717a', flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.rarity}</span>
                                </div>
                            ))}
                            {myGratonites > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: myOffer.length > 0 ? '6px' : 0 }}>
                                    <Gem size={12} color="#10b981" />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>{myGratonites.toLocaleString()} Gratonite</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                                Edit
                            </button>
                            <button
                                onClick={() => { setShowConfirm(false); handlePropose(); }}
                                disabled={submitting}
                                style={{ flex: 2, padding: '10px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <Check size={16} /> {submitting ? 'Sending...' : 'Send Trade Proposal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <button onClick={() => view === 'create' ? setView('list') : navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    <ArrowLeft size={16} /> {view === 'create' ? 'Back to Trades' : 'Back'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowLeftRight size={24} color="var(--accent-primary)" />
                        <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Trading</h1>
                    </div>
                    {view === 'list' && (
                        <button onClick={startCreate} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <Plus size={16} /> New Trade
                        </button>
                    )}
                </div>

                {view === 'list' ? (
                    loading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading trades...</div>
                    ) : trades.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                            <ArrowLeftRight size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <p>No pending trades</p>
                            <button onClick={startCreate} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer' }}>
                                Start a Trade
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {trades.map(trade => (
                                <div key={trade.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Trade with {trade.proposerName ?? trade.recipientName ?? 'User'}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(trade.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>They Offer</div>
                                            {trade.proposerItems.map(item => (
                                                <div key={item.id} style={{ fontSize: '13px', color: rarityColor[item.rarity] ?? 'var(--text-primary)' }}>{item.name}</div>
                                            ))}
                                            {trade.proposerGratonites > 0 && (
                                                <div style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Gem size={12} /> {trade.proposerGratonites}</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>You Offer</div>
                                            {trade.recipientItems.map(item => (
                                                <div key={item.id} style={{ fontSize: '13px', color: rarityColor[item.rarity] ?? 'var(--text-primary)' }}>{item.name}</div>
                                            ))}
                                            {trade.recipientGratonites > 0 && (
                                                <div style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Gem size={12} /> {trade.recipientGratonites}</div>
                                            )}
                                        </div>
                                    </div>
                                    {trade.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleAction(trade.id, 'accept')} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Check size={14} /> Accept
                                            </button>
                                            <button onClick={() => handleAction(trade.id, 'reject')} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: '#ef4444', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div>
                        {/* Friend selector */}
                        {!selectedFriend ? (
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Select a Friend</h3>
                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        value={friendSearch}
                                        onChange={e => setFriendSearch(e.target.value)}
                                        placeholder="Search friends..."
                                        style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {filteredFriends.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setSelectedFriend(f)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-primary)', width: '100%', textAlign: 'left' }}
                                        >
                                            <Avatar userId={f.userId} avatarHash={f.avatarHash} displayName={f.displayName} size={32} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{f.displayName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{f.username}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredFriends.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>No friends found</p>}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    <Avatar userId={selectedFriend.userId} avatarHash={selectedFriend.avatarHash} displayName={selectedFriend.displayName} size={32} />
                                    <span style={{ fontWeight: 600 }}>Trading with {selectedFriend.displayName}</span>
                                    <button onClick={() => setSelectedFriend(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>You Offer</h4>
                                        {myOffer.map(item => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                                <span style={{ fontSize: '13px', color: rarityColor[item.rarity] ?? 'var(--text-primary)' }}>{item.name}</span>
                                                <button onClick={() => setMyOffer(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                                            </div>
                                        ))}
                                        <div style={{ marginTop: '8px' }}>
                                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gratonites</label>
                                            <input type="number" min={0} value={myGratonites} onChange={e => setMyGratonites(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                                        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>You Request</h4>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>The other party will add their items when reviewing.</p>
                                        <div style={{ marginTop: '8px' }}>
                                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gratonites</label>
                                            <input type="number" min={0} value={theirGratonites} onChange={e => setTheirGratonites(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Inventory picker */}
                                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Inventory</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                                    {myInventory.filter(i => !myOffer.find(o => o.id === i.id)).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setMyOffer(prev => [...prev, item])}
                                            style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
                                        >
                                            <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.name}</div>
                                            <div style={{ fontSize: '10px', color: rarityColor[item.rarity] ?? 'var(--text-muted)', textTransform: 'capitalize' }}>{item.rarity}</div>
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setShowConfirm(true)}
                                    disabled={submitting || (myOffer.length === 0 && myGratonites === 0)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: (myOffer.length === 0 && myGratonites === 0) ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: (myOffer.length === 0 && myGratonites === 0) ? 'var(--text-muted)' : '#000', fontWeight: 700, cursor: (myOffer.length === 0 && myGratonites === 0) ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                                >
                                    Review &amp; Propose Trade
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Trading;
