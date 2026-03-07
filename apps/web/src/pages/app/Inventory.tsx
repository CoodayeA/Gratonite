import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Archive, LayoutTemplate, Check, ShoppingBag, Store, Sparkles, Crown, Star, Gem, Shield, Tag, Music } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Skeleton from '../../components/ui/Skeleton';
import { TiltCard, RippleWrapper } from '../../components/ui/Physics';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import { applyEquippedItem, clearEquippedItem } from '../../lib/cosmetics';


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

type TabKey = 'all' | 'avatar_frame' | 'profile_effect' | 'theme' | 'decoration' | 'nameplate' | 'soundboard';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; emptyLabel: string }[] = [
    { key: 'all',            label: 'All',          icon: <Archive size={14} />,   emptyLabel: 'items' },
    { key: 'avatar_frame',   label: 'Frames',        icon: <Shield size={14} />,    emptyLabel: 'frame items' },
    { key: 'profile_effect', label: 'Effects',       icon: <Sparkles size={14} />,  emptyLabel: 'effect items' },
    { key: 'theme',          label: 'Themes',        icon: <Star size={14} />,      emptyLabel: 'theme items' },
    { key: 'decoration',     label: 'Canvas',        icon: <Gem size={14} />,       emptyLabel: 'canvas items' },
    { key: 'nameplate',      label: 'Nameplates',    icon: <Tag size={14} />,       emptyLabel: 'nameplate items' },
    { key: 'soundboard',     label: 'Soundboard',    icon: <Music size={14} />,     emptyLabel: 'soundboard items' },
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
    const [activeTab, setActiveTab] = useState<TabKey>('all');
    const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
    const [justSaved, setJustSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [equippingId, setEquippingId] = useState<string | null>(null);
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
            border: equipped ? `2px solid ${r.color}` : `2px solid var(--border-structural)`,
            boxShadow: equipped ? `0 0 16px ${r.glow}, inset 0 0 8px ${r.glow}` : 'var(--shadow-panel)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Archive size={24} style={{ color: 'var(--accent-primary)' }} />
                    <h2>Cosmetics Inventory & Loadout</h2>
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
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--stroke)',
                        display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                        {([
                            { label: 'Frame',     item: activeFrame },
                            { label: 'Effect',    item: activeEffect },
                            { label: 'Theme',     item: activeTheme },
                            { label: 'Canvas',    item: activeCanvas },
                            { label: 'Nameplate', item: activeNameplate },
                        ] as { label: string; item: ApiInventoryItem | undefined }[]).map(({ label, item }) => (
                            <div key={label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '8px',
                            }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                                    {label}
                                </span>
                                <span style={{
                                    fontSize: '12px', fontWeight: 600,
                                    color: item ? rarityOf(item.rarity).color : 'var(--text-muted)',
                                }}>
                                    {item?.name || 'None'}
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
                            const count = tab.key === 'all' ? inventory.length : inventory.filter(i => i.type === tab.key).length;
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

                    {/* Inventory grid */}
                    <div style={{
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
                                                <div style={{ marginTop: '8px' }}>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleEquip(item); }}
                                                        disabled={!!equippingId}
                                                        style={{
                                                            width: '100%', padding: '6px 0',
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
                    </div>
                </div>

            </div>
        </main>
    );
};

export default Inventory;
