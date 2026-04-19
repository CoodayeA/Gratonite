import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Archive, LayoutTemplate, Check, ShoppingBag, Store, Sparkles, Crown, Star, Gem, Shield, Tag, Music, Wallet, TrendingUp, TrendingDown, ArrowRight, Eye, X } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Skeleton from '../../components/ui/Skeleton';
import { TiltCard, RippleWrapper } from '../../components/ui/Physics';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import { applyEquippedItem, clearEquippedItem } from '../../lib/cosmetics';
import { useUser } from '../../contexts/UserContext';
import Avatar from '../../components/ui/Avatar';


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApiInventoryItem {
    id: string;
    itemId: string;
    name: string;
    type: string;
    source: 'shop' | 'cosmetics';
    rarity: string;
    imageUrl: string | null;
    assetUrl: string | null;
    assetConfig: unknown | null;
    quantity: number;
    equipped: boolean;
    acquiredAt: string;
}

/* ------------------------------------------------------------------ */
/*  Rarity system                                                      */
/* ------------------------------------------------------------------ */

const RARITY: Record<string, { color: string; glow: string; label: string; border: string }> = {
    common:    { color: '#9ca3af', glow: 'rgba(156,163,175,0.25)', label: 'Common',    border: '#6b7280' },
    uncommon:  { color: '#22c55e', glow: 'rgba(34,197,94,0.30)',   label: 'Uncommon',  border: '#16a34a' },
    rare:      { color: '#3b82f6', glow: 'rgba(59,130,246,0.35)',  label: 'Rare',      border: '#2563eb' },
    epic:      { color: '#a855f7', glow: 'rgba(168,85,247,0.35)',  label: 'Epic',      border: '#9333ea' },
    legendary: { color: '#f59e0b', glow: 'rgba(245,158,11,0.40)',  label: 'Legendary', border: '#d97706' },
};

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

type TabKey = 'all' | 'avatar_frame' | 'profile_effect' | 'theme' | 'decoration' | 'nameplate' | 'soundboard' | 'wallet';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; emptyLabel: string }[] = [
    { key: 'all',            label: 'All',          icon: <Archive size={14} />,   emptyLabel: 'items' },
    { key: 'avatar_frame',   label: 'Frames',        icon: <Shield size={14} />,    emptyLabel: 'frame items' },
    { key: 'profile_effect', label: 'Effects',       icon: <Sparkles size={14} />,  emptyLabel: 'effect items' },
    { key: 'theme',          label: 'Themes',        icon: <Star size={14} />,      emptyLabel: 'theme items' },
    { key: 'decoration',     label: 'Canvas',        icon: <Gem size={14} />,       emptyLabel: 'canvas items' },
    { key: 'nameplate',      label: 'Nameplates',    icon: <Tag size={14} />,       emptyLabel: 'nameplate items' },
    { key: 'soundboard',     label: 'Soundboard',    icon: <Music size={14} />,     emptyLabel: 'soundboard items' },
    { key: 'wallet',         label: 'Wallet',        icon: <Wallet size={14} />,    emptyLabel: 'transactions' },
];

/* ------------------------------------------------------------------ */
/*  Keyframe styles (injected once)                                    */
/* ------------------------------------------------------------------ */

const KEYFRAMES = `
@keyframes inv-pulse-ring {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50%      { transform: scale(1.08); opacity: 1; }
}
@keyframes inv-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
@keyframes inv-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-4px); }
}
@keyframes inv-effect-overlay {
    0%, 100% { opacity: 0.15; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(1.05); }
}
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Inventory = () => {
    const { hasCustomBg, userProfile, setUserProfile } = useOutletContext<any>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<TabKey>('all');
    const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
    const [justSaved, setJustSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [equippingId, setEquippingId] = useState<string | null>(null);
    const [previewItem, setPreviewItem] = useState<ApiInventoryItem | null>(null);
    const [walletData, setWalletData] = useState<{ balance: number; lifetimeEarned: number; lifetimeSpent: number } | null>(null);
    const [ledger, setLedger] = useState<Array<{ id: string; direction: string; amount: number; source: string; description: string | null; createdAt: string }>>([]);
    const [walletLoading, setWalletLoading] = useState(false);
    const mountedRef = useRef(true);

    const loadInventory = useCallback(() => {
        setIsLoading(true);
        api.inventory.get()
            .then(data => {
                if (!mountedRef.current) return;
                setInventory(data.items ?? []);
            })
            .catch(() => {
                if (!mountedRef.current) return;
                addToast({ title: 'Failed to load inventory', description: 'Could not fetch your inventory items.', variant: 'error' });
            })
            .finally(() => {
                if (mountedRef.current) setIsLoading(false);
            });
    }, [addToast]);

    /* inject keyframes once */
    useEffect(() => {
        const id = 'inv-keyframes';
        if (!document.getElementById(id)) {
            const s = document.createElement('style');
            s.id = id;
            s.textContent = KEYFRAMES;
            document.head.appendChild(s);
        }
        return () => { mountedRef.current = false; };
    }, []);

    /* fetch inventory from real API */
    useEffect(() => {
        loadInventory();
    }, [loadInventory]);

    /* fetch wallet data when wallet tab is active */
    useEffect(() => {
        if (activeTab !== 'wallet') return;
        setWalletLoading(true);
        Promise.all([
            api.economy.getWallet(),
            api.economy.getLedger(50),
        ]).then(([wallet, entries]) => {
            if (!mountedRef.current) return;
            setWalletData({ balance: wallet.balance, lifetimeEarned: wallet.lifetimeEarned, lifetimeSpent: wallet.lifetimeSpent });
            setLedger(entries);
        }).catch(() => {
            if (!mountedRef.current) return;
            addToast({ title: 'Failed to load wallet', variant: 'error' });
        }).finally(() => {
            if (mountedRef.current) setWalletLoading(false);
        });
    }, [activeTab, addToast]);

    // Keep inventory in sync after shop/marketplace purchases and when tab regains focus.
    useEffect(() => {
        const onInventoryUpdated = () => loadInventory();
        const onFocus = () => loadInventory();
        window.addEventListener('gratonite:inventory-updated', onInventoryUpdated);
        window.addEventListener('inventory:changed', onInventoryUpdated);
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener('gratonite:inventory-updated', onInventoryUpdated);
            window.removeEventListener('inventory:changed', onInventoryUpdated);
            window.removeEventListener('focus', onFocus);
        };
    }, [loadInventory]);

    /* ---- equip / unequip ---- */
    const handleEquip = async (item: ApiInventoryItem) => {
        if (equippingId) return;
        setEquippingId(item.id);
        const willEquip = !item.equipped;
        try {
            const targetItemId = item.itemId;
            const userId = userProfile?.id || (localStorage.getItem('gratonite-user-id') ?? 'me');
            let response: any = {};
            if (item.source === 'shop') {
                if (willEquip) response = await api.shop.equipItem(targetItemId);
                else await api.shop.unequipItem(targetItemId);
            } else {
                if (willEquip) response = await api.cosmetics.equipCosmetic(targetItemId);
                else await api.cosmetics.unequip(targetItemId);
            }

            if (willEquip) {
                const cfg = (response?.assetConfig ?? item.assetConfig ?? {}) as Record<string, unknown>;
                applyEquippedItem(item.type, cfg, userId);
                // Persist nameplate to user profile
                if (item.type === 'nameplate') {
                    const style = (cfg.nameplateStyle as string) ?? 'none';
                    api.users.updateProfile({ nameplateStyle: style }).catch(() => {});
                }
            } else {
                clearEquippedItem(item.type, userId);
                if (item.type === 'nameplate') {
                    api.users.updateProfile({ nameplateStyle: 'none' }).catch(() => {});
                }
            }

            setInventory(prev => prev.map(i => {
                if (i.type === item.type && i.id !== item.id) return { ...i, equipped: false };
                if (i.id === item.id) return { ...i, equipped: willEquip };
                return i;
            }));
            addToast({ title: willEquip ? 'Item equipped' : 'Item unequipped', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to equip item', description: err?.message ?? 'Please try again.', variant: 'error' });
        } finally {
            setEquippingId(null);
        }
    };

    /* ---- derived ---- */
    const displayItems = activeTab === 'all' ? inventory : inventory.filter(i => i.type === activeTab);

    const equippedItems = useMemo(() => inventory.filter(i => i.equipped), [inventory]);
    const activeFrame     = equippedItems.find(i => i.type === 'avatar_frame');
    const activeEffect    = equippedItems.find(i => i.type === 'profile_effect');
    const activeCanvas    = equippedItems.find(i => i.type === 'decoration');
    const activeTheme     = equippedItems.find(i => i.type === 'theme');
    const activeNameplate = equippedItems.find(i => i.type === 'nameplate');

    /* ---- save handler ---- */
    const handleSave = () => {
        if (!setUserProfile) return;
        setUserProfile({
            ...userProfile,
            avatarFrame:   activeFrame?.name     ?? 'none',
            profileEffect: activeEffect?.name    ?? 'none',
            profileCanvas: activeCanvas?.name    ?? 'none',
            profileTheme:  activeTheme?.name     ?? 'none',
            nameplate:     activeNameplate?.name  ?? 'none',
        });
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    /* ---- rarity helpers ---- */
    const rarityOf = (r: string) => RARITY[r] || RARITY.common;

    const rarityBorderStyle = (item: ApiInventoryItem, equipped: boolean): React.CSSProperties => {
        const r = rarityOf(item.rarity);
        return {
            border: equipped ? `2px solid ${r.color}` : `1px solid ${r.color}25`,
            boxShadow: equipped
                ? `0 0 20px ${r.glow}, 0 0 40px ${r.glow}60, inset 0 0 8px ${r.glow}`
                : `0 4px 12px ${r.glow}20`,
        };
    };

    /* ---- preview image helper ---- */
    const previewBg = (item: ApiInventoryItem) =>
        item.imageUrl ?? item.assetUrl ?? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))';

    /* ---- empty state label ---- */
    const emptyLabel = TABS.find(t => t.key === activeTab)?.emptyLabel ?? 'items';

    /* ================================================================ */
    /*  RENDER                                                          */
    /* ================================================================ */

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ flex: 1, overflowY: 'auto' }}>

            {/* ---- Top Bar ---- */}
            <header className="top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-primary), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(168,85,247,0.25)' }}>
                        <Archive size={18} color="white" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Inventory & Loadout</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '1px' }}>Manage your cosmetics and active look</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <RippleWrapper>
                        <button
                            onClick={() => navigate('/shop')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                border: '1px solid var(--stroke)', padding: '8px 14px',
                                borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            <ShoppingBag size={15} /> Shop
                        </button>
                    </RippleWrapper>
                    <RippleWrapper>
                        <button
                            onClick={() => navigate('/marketplace')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                border: '1px solid var(--stroke)', padding: '8px 14px',
                                borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            <Store size={15} /> Marketplace
                        </button>
                    </RippleWrapper>
                </div>
            </header>

            {/* ---- Content ---- */}
            <div style={{ padding: '32px 48px', maxWidth: '1300px', margin: '0 auto', display: 'flex', gap: '32px' }}>

                {/* ============================================================ */}
                {/*  LEFT COLUMN  --  Preview Card + Loadout Summary              */}
                {/* ============================================================ */}
                <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* -- Profile Preview Card -- */}
                    <div className="glass-panel" style={{
                        borderRadius: '16px',
                        border: '1px solid var(--stroke)',
                        overflow: 'hidden',
                        position: 'relative',
                    }}>
                        {/* Canvas background (full bleed) */}
                        <div
                            style={{
                                position: 'absolute', inset: 0, zIndex: 0,
                                background: activeCanvas ? previewBg(activeCanvas) : 'var(--bg-elevated)',
                                transition: 'background 0.4s ease',
                            }}
                        />

                        {/* Theme tint overlay */}
                        {activeTheme && (
                            <div style={{
                                position: 'absolute', inset: 0, zIndex: 1,
                                background: previewBg(activeTheme),
                                opacity: 0.35,
                                transition: 'background 0.4s ease, opacity 0.4s ease',
                            }} />
                        )}

                        {/* Content (above canvas + theme) */}
                        <div style={{ position: 'relative', zIndex: 2, padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                            {/* Section title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-secondary)' }}>
                                <LayoutTemplate size={16} />
                                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    Preview
                                </span>
                            </div>

                            {/* Avatar area */}
                            <div style={{ position: 'relative', width: '140px', height: '140px', marginBottom: '16px' }}>
                                {/* Frame ring */}
                                <div style={{
                                    position: 'absolute', inset: '-6px',
                                    borderRadius: '50%',
                                    background: activeFrame ? previewBg(activeFrame) : 'var(--border-structural)',
                                    animation: activeFrame ? 'inv-pulse-ring 3s ease-in-out infinite' : 'none',
                                    transition: 'background 0.4s ease',
                                }} />

                                {/* Inner avatar circle */}
                                <div style={{
                                    position: 'absolute', inset: '4px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-elevated)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                    border: '3px solid var(--bg-primary)',
                                }}>
                                    {/* Effect overlay on avatar */}
                                    {activeEffect && (
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: previewBg(activeEffect),
                                            animation: 'inv-effect-overlay 3s ease-in-out infinite',
                                            borderRadius: '50%',
                                            pointerEvents: 'none',
                                        }} />
                                    )}

                                    {/* Avatar placeholder */}
                                    <span style={{
                                        fontSize: '48px',
                                        lineHeight: 1,
                                        zIndex: 1,
                                        userSelect: 'none',
                                    }}>
                                        😸
                                    </span>
                                </div>
                            </div>

                            {/* Username */}
                            <span style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                fontSize: '20px',
                                color: 'var(--text-primary)',
                                marginBottom: '6px',
                            }}>
                                {userProfile?.displayName ?? userProfile?.username ?? 'MeowByte'}
                            </span>

                            {/* Nameplate tag */}
                            {activeNameplate ? (
                                <span style={{
                                    display: 'inline-block',
                                    background: 'var(--accent-primary)',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '1px',
                                    padding: '3px 10px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px',
                                }}>
                                    {activeNameplate.name}
                                </span>
                            ) : (
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                }}>
                                    No nameplate equipped
                                </span>
                            )}
                        </div>
                    </div>

                    {/* -- Loadout Summary Rows -- */}
                    <div className="glass-panel" style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1px solid var(--stroke)',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                    }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Crown size={12} style={{ color: 'var(--accent-primary)' }} /> Active Loadout
                        </div>
                        {([
                            { label: 'Frame',     item: activeFrame,     dot: '#3b82f6' },
                            { label: 'Effect',    item: activeEffect,    dot: '#a855f7' },
                            { label: 'Theme',     item: activeTheme,     dot: '#f59e0b' },
                            { label: 'Canvas',    item: activeCanvas,    dot: '#10b981' },
                            { label: 'Nameplate', item: activeNameplate, dot: '#ec4899' },
                        ] as { label: string; item: ApiInventoryItem | undefined; dot: string }[]).map(({ label, item, dot }) => (
                            <div key={label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: item ? `${dot}08` : 'var(--bg-tertiary)',
                                padding: '9px 12px', borderRadius: '8px',
                                border: item ? `1px solid ${dot}25` : '1px solid transparent',
                                transition: 'background 0.2s, border-color 0.2s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item ? dot : 'var(--text-muted)', opacity: item ? 1 : 0.4, flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                                        {label}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '12px', fontWeight: 700,
                                    color: item ? rarityOf(item.rarity).color : 'var(--text-muted)',
                                    maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {item?.name || '—'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* -- Save Button -- */}
                    <RippleWrapper>
                        <button
                            className="auth-button"
                            style={{
                                width: '100%',
                                background: justSaved
                                    ? 'var(--success)'
                                    : 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '14px',
                                padding: '12px',
                                borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                border: 'none', cursor: 'pointer',
                                transition: 'background 0.3s ease',
                            }}
                            onClick={handleSave}
                        >
                            {justSaved ? <><Check size={16} /> Saved!</> : <><Crown size={16} /> Save Loadout</>}
                        </button>
                    </RippleWrapper>
                </div>

                {/* ============================================================ */}
                {/*  RIGHT COLUMN  --  Tab Bar + Inventory Grid                  */}
                {/* ============================================================ */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Tab bar */}
                    <div style={{
                        display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap',
                        background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px',
                        border: '1px solid var(--stroke)',
                    }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const count = tab.key === 'all' ? inventory.length : tab.key === 'wallet' ? (ledger.length) : inventory.filter(i => i.type === tab.key).length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        flex: 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        background: isActive ? 'var(--bg-elevated)' : 'transparent',
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                        border: 'none',
                                        padding: '8px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isActive ? 'var(--shadow-panel)' : 'none',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        minWidth: 0,
                                    }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    <span style={{
                                        fontSize: '10px',
                                        background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: isActive ? '#fff' : 'var(--text-muted)',
                                        padding: '1px 6px', borderRadius: '10px', fontWeight: 700,
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Wallet view */}
                    {activeTab === 'wallet' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {walletLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <Skeleton variant="card" height="120px" />
                                    <Skeleton variant="card" height="300px" />
                                </div>
                            ) : (
                                <>
                                    {/* Balance card */}
                                    <div className="glass-panel" style={{
                                        padding: '28px', borderRadius: '16px', border: '1px solid var(--stroke)',
                                        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))',
                                        display: 'flex', alignItems: 'center', gap: '24px',
                                    }}>
                                        <div style={{
                                            width: '56px', height: '56px', borderRadius: '16px',
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '4px 4px 0 rgba(0,0,0,0.1)',
                                            flexShrink: 0,
                                        }}>
                                            <Wallet size={28} color="#111" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px', marginBottom: '4px' }}>Current Balance</div>
                                            <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#f59e0b', letterSpacing: '-0.02em' }}>
                                                {(walletData?.balance ?? 0).toLocaleString()} <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>G</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '24px' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Earned</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <TrendingUp size={14} /> {(walletData?.lifetimeEarned ?? 0).toLocaleString()}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Spent</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <TrendingDown size={14} /> {(walletData?.lifetimeSpent ?? 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Earn More link */}
                                    <div
                                        role="button" tabIndex={0}
                                        onClick={() => navigate('/fame')}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/fame'); } }}
                                        className="hover-lift"
                                        style={{
                                            padding: '14px 18px', borderRadius: '10px', cursor: 'pointer',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Star size={18} style={{ color: '#f59e0b' }} />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>Earn More Gratonites</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Give FAME, claim daily rewards, send messages</div>
                                            </div>
                                        </div>
                                        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                                    </div>

                                    {/* Transaction ledger */}
                                    <div className="glass-panel" style={{
                                        borderRadius: '12px', border: '1px solid var(--stroke)', overflow: 'hidden',
                                    }}>
                                        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Archive size={16} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Recent Transactions</span>
                                        </div>
                                        {ledger.length === 0 ? (
                                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>No transactions yet</p>
                                                <p style={{ fontSize: '13px' }}>Your earning and spending history will appear here.</p>
                                            </div>
                                        ) : (
                                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                {ledger.map((entry) => {
                                                    const isEarn = entry.direction === 'earn';
                                                    const date = new Date(entry.createdAt);
                                                    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                                    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                                    return (
                                                        <div key={entry.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: '12px',
                                                            padding: '12px 18px',
                                                            borderBottom: '1px solid var(--stroke)',
                                                        }}>
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '8px',
                                                                background: isEarn ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0,
                                                            }}>
                                                                {isEarn ? <TrendingUp size={16} style={{ color: '#10b981' }} /> : <TrendingDown size={16} style={{ color: '#ef4444' }} />}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {entry.description || entry.source.replace(/_/g, ' ')}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr} at {timeStr}</div>
                                                            </div>
                                                            <div style={{
                                                                fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-display)',
                                                                color: isEarn ? '#10b981' : 'var(--error)',
                                                            }}>
                                                                {isEarn ? '+' : '-'}{entry.amount.toLocaleString()} G
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Inventory grid */}
                    {activeTab !== 'wallet' && <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                        gap: '16px',
                    }}>
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={`inv-skel-${i}`} variant="card" height="220px" />
                            ))
                        ) : displayItems.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No {emptyLabel} yet</p>
                                    <p style={{ fontSize: '13px' }}>Visit the Shop to get some!</p>
                                </div>
                            </div>
                        ) : (
                            displayItems.map(item => {
                                const r = rarityOf(item.rarity);
                                const bg = previewBg(item);
                                const isEquipping = equippingId === item.id;
                                return (
                                    <TiltCard key={item.id} maxTilt={8} scale={1.02}>
                                        <div
                                            className="hover-lift"
                                            style={{
                                                background: 'var(--bg-elevated)',
                                                borderRadius: 'var(--radius-md)',
                                                overflow: 'hidden',
                                                cursor: isEquipping ? 'wait' : 'pointer',
                                                position: 'relative',
                                                ...rarityBorderStyle(item, item.equipped),
                                                transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
                                                opacity: isEquipping ? 0.7 : 1,
                                            }}
                                            onClick={() => !isEquipping && handleEquip(item)}
                                        >
                                            {/* Equipped badge */}
                                            {item.equipped && (
                                                <div style={{
                                                    position: 'absolute', top: '8px', right: '8px',
                                                    background: r.color, color: '#fff',
                                                    padding: '4px', borderRadius: '50%', zIndex: 10,
                                                    boxShadow: `0 0 8px ${r.glow}`,
                                                }}>
                                                    <Check size={14} />
                                                </div>
                                            )}

                                            {/* Item preview area */}
                                            <div style={{
                                                height: '120px',
                                                background: 'var(--bg-tertiary)',
                                                position: 'relative',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden',
                                            }}>
                                                {/* Rarity shimmer strip at bottom of preview */}
                                                <div style={{
                                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
                                                    background: `linear-gradient(90deg, transparent, ${r.color}, transparent)`,
                                                    backgroundSize: '200% 100%',
                                                    animation: 'inv-shimmer 3s linear infinite',
                                                }} />

                                                {(item.type === 'avatar_frame') && (
                                                    <div style={{
                                                        width: '64px', height: '64px', borderRadius: '50%',
                                                        background: bg,
                                                        border: '3px solid var(--bg-primary)',
                                                        boxShadow: `0 0 16px ${r.glow}`,
                                                        animation: 'inv-float 3s ease-in-out infinite',
                                                    }} />
                                                )}

                                                {(item.type === 'profile_effect') && (
                                                    <div style={{
                                                        width: '80%', height: '80%',
                                                        background: bg, opacity: 0.6,
                                                        borderRadius: '12px',
                                                        animation: 'inv-effect-overlay 2.5s ease-in-out infinite',
                                                    }} />
                                                )}

                                                {(item.type === 'theme') && (
                                                    <div style={{
                                                        width: '100%', height: '100%',
                                                        background: bg, opacity: 0.85,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <div style={{
                                                            width: '40px', height: '28px',
                                                            borderRadius: '6px',
                                                            border: '2px solid rgba(255,255,255,0.3)',
                                                            background: 'rgba(255,255,255,0.08)',
                                                        }} />
                                                    </div>
                                                )}

                                                {(item.type === 'decoration') && (
                                                    <div style={{
                                                        width: '100%', height: '100%',
                                                        background: bg, opacity: 0.9,
                                                    }} />
                                                )}

                                                {(item.type === 'nameplate') && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        width: '100%', height: '100%',
                                                    }}>
                                                        <span style={{
                                                            background: 'var(--accent-primary)',
                                                            color: '#fff',
                                                            fontSize: '11px',
                                                            fontWeight: 800,
                                                            letterSpacing: '1.2px',
                                                            padding: '5px 14px',
                                                            borderRadius: '5px',
                                                            boxShadow: `0 0 12px ${r.glow}`,
                                                        }}>
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                )}

                                                {(item.type === 'soundboard') && (
                                                    <div style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                        width: '100%', height: '100%', gap: '8px',
                                                    }}>
                                                        <Music size={32} style={{ color: r.color, opacity: 0.8 }} />
                                                    </div>
                                                )}

                                                {/* Fallback for unknown types */}
                                                {!['avatar_frame', 'profile_effect', 'theme', 'decoration', 'nameplate', 'soundboard'].includes(item.type) && (
                                                    <div style={{
                                                        width: '64px', height: '64px', borderRadius: '12px',
                                                        background: bg,
                                                        boxShadow: `0 0 16px ${r.glow}`,
                                                    }} />
                                                )}
                                            </div>

                                            {/* Item info */}
                                            <div style={{ padding: '12px 14px' }}>
                                                <h4 style={{
                                                    fontWeight: 600, fontSize: '13px', marginBottom: '6px',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                    fontFamily: 'var(--font-display)',
                                                    color: 'var(--text-primary)',
                                                }}>
                                                    {item.name}
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: r.color,
                                                        textTransform: 'uppercase',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.8px',
                                                    }}>
                                                        {r.label}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: 'var(--text-muted)',
                                                        textTransform: 'capitalize',
                                                    }}>
                                                        {item.type.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setPreviewItem(item); }}
                                                        style={{
                                                            flex: '0 0 auto', padding: '6px 8px',
                                                            borderRadius: '6px', border: 'none',
                                                            background: 'var(--bg-tertiary)',
                                                            color: 'var(--text-muted)',
                                                            fontWeight: 600, fontSize: '11px',
                                                            cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                        title="Preview"
                                                    >
                                                        <Eye size={11} />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleEquip(item); }}
                                                        disabled={!!equippingId}
                                                        style={{
                                                            flex: 1, padding: '6px 0',
                                                            borderRadius: '6px', border: 'none',
                                                            background: item.equipped
                                                                ? 'rgba(16,185,129,0.15)'
                                                                : 'var(--bg-tertiary)',
                                                            color: item.equipped ? '#10b981' : 'var(--text-secondary)',
                                                            fontWeight: 600, fontSize: '11px',
                                                            cursor: equippingId ? 'wait' : 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                    >
                                                        {item.equipped ? <><Check size={11} /> Equipped</> : 'Equip'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </TiltCard>
                                );
                            })
                        )}
                    </div>}
                </div>

            </div>

            {/* Cosmetic Preview in Chat Modal */}
            {previewItem && (() => {
                const cfg = (previewItem.assetConfig ?? {}) as Record<string, unknown>;
                const r = rarityOf(previewItem.rarity);
                const frameStyle = cfg.frameStyle as string | undefined;
                const glowColor = (cfg.glowColor as string | undefined) ?? 'var(--accent-primary)';
                const effectType = cfg.effectType as string | undefined;
                const nameplateStyleVal = cfg.nameplateStyle as string | undefined;

                const getFrameCSS = (): React.CSSProperties => {
                    switch (frameStyle) {
                        case 'neon': return { border: `3px solid ${glowColor}`, boxShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}60` };
                        case 'gold': return { border: '3px solid #ffd700', boxShadow: '0 0 10px #ffd70060' };
                        case 'glass': return { border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 0 10px rgba(255,255,255,0.15)' };
                        case 'rainbow': return { border: '3px solid transparent', backgroundImage: `linear-gradient(var(--bg-primary), var(--bg-primary)), linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' };
                        case 'pulse': return { border: `3px solid ${glowColor}`, animation: 'inv-pulse-ring 2s ease-in-out infinite', boxShadow: `0 0 10px ${glowColor}80` };
                        case 'fire': return { border: '3px solid #ff6b35', boxShadow: '0 0 10px #ff6b3580', animation: 'inv-pulse-ring 1.5s ease-in-out infinite' };
                        case 'glitch': return { border: '3px solid #00ffff', boxShadow: '0 0 10px #00ffff80, -2px 0 6px #ff00ff40', animation: 'inv-pulse-ring 2s steps(4) infinite' };
                        default: return { border: `3px solid ${glowColor}`, boxShadow: `0 0 10px ${glowColor}60` };
                    }
                };

                const getEffectOverlay = (): React.CSSProperties | null => {
                    switch (effectType) {
                        case 'sparkle': return { background: `radial-gradient(circle at 30% 20%, ${glowColor}30 0%, transparent 50%), radial-gradient(circle at 70% 80%, ${glowColor}20 0%, transparent 40%)` };
                        case 'glow': return { background: `radial-gradient(circle at center, ${glowColor}15 0%, transparent 70%)` };
                        case 'particles': return { background: `radial-gradient(circle at 20% 30%, ${glowColor}20 0%, transparent 30%), radial-gradient(circle at 80% 70%, ${glowColor}15 0%, transparent 25%), radial-gradient(circle at 50% 10%, ${glowColor}10 0%, transparent 20%)` };
                        default: return null;
                    }
                };

                const nameplateCSS: React.CSSProperties = previewItem.type === 'nameplate' && nameplateStyleVal ? {
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #a855f7))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily: 'var(--font-display)',
                } : {};

                const effectOverlay = previewItem.type === 'profile_effect' ? getEffectOverlay() : null;

                const renderMessageBubble = (label: string, withCosmetic: boolean) => (
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '12px', position: 'relative', overflow: 'hidden' }}>
                            {withCosmetic && effectOverlay && (
                                <div style={{ position: 'absolute', inset: 0, ...effectOverlay, pointerEvents: 'none', zIndex: 1 }} />
                            )}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <Avatar userId={user.id} avatarHash={user.avatarHash} displayName={user.name} size={36} />
                                    {withCosmetic && previewItem.type === 'avatar_frame' && (
                                        <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', ...getFrameCSS(), pointerEvents: 'none' }} />
                                    )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', ...(withCosmetic ? nameplateCSS : {}) }}>
                                            {user.name || 'You'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Today at 12:00 PM</span>
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        This is what your messages will look like!
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreviewItem(null)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{previewItem.name}</h3>
                                <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
                            </div>

                            {/* Item Meta */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 24px', borderBottom: '1px solid var(--stroke)' }}>
                                {/* Art / Image */}
                                <div style={{ width: '80px', height: '80px', borderRadius: '12px', flexShrink: 0, border: `2px solid ${r.border}`, boxShadow: `0 0 16px ${r.glow}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: previewItem.imageUrl ? undefined : `linear-gradient(135deg, ${r.glow}80, transparent)` }}>
                                    {previewItem.imageUrl
                                        ? <img src={previewItem.imageUrl} alt={previewItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <span style={{ fontSize: '32px' }}>{'🎨'}</span>
                                    }
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: r.color, background: `${r.glow}`, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${r.border}`, letterSpacing: '0.6px' }}>{r.label}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '20px' }}>{previewItem.type.replace(/_/g, ' ')}</span>
                                        {previewItem.equipped && <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '20px' }}>Equipped</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Source</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{previewItem.source}</div>
                                        </div>
                                        {previewItem.quantity > 1 && (
                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Quantity</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>×{previewItem.quantity}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Acquired</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(previewItem.acquiredAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div style={{ padding: '16px 24px 0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.6px' }}>Chat Preview</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                                    {renderMessageBubble('Without', false)}
                                    {renderMessageBubble('With This', true)}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', padding: '0 24px 24px' }}>
                                <button onClick={() => setPreviewItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                                <button
                                    onClick={() => { handleEquip(previewItem); setPreviewItem(null); }}
                                    disabled={!!equippingId}
                                    style={{ flex: 2, padding: '10px', borderRadius: '8px', background: previewItem.equipped ? 'rgba(239,68,68,0.15)' : 'var(--accent-primary)', border: 'none', color: previewItem.equipped ? '#ef4444' : '#000', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {previewItem.equipped ? 'Unequip' : 'Equip This Item'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </main>
    );
};

export default Inventory;
