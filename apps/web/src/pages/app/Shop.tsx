import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Sparkles, Gem, ArrowRight, X, Check, Type, Star, Layers, Gift, Eye, Lock, Package, Search, Timer } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Skeleton from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/ToastManager';
import { TiltCard, RippleWrapper, MagneticButton } from '../../components/ui/Physics';
import { api } from '../../lib/api';
import { applyEquippedItem } from '../../lib/cosmetics';
import { useUser } from '../../contexts/UserContext';
import Avatar from '../../components/ui/Avatar';

type ViewType = 'frames' | 'decorations' | 'effects' | 'nameplates';

type ShopItem = {
    id: string;
    type: 'frame' | 'decoration' | 'effect' | 'nameplate';
    name: string;
    price: number;
    image: string;
    rarity: 'epic' | 'legendary' | 'rare' | 'uncommon';
    description?: string;
    color?: string;
    assetConfig?: Record<string, unknown>;
    // Nameplate extras
    nameplateFont?: string;
    nameplateGradient?: string;
    // Decoration extras
    decorationEmoji?: string;
};

const initialShopItems: ShopItem[] = [];

const rarityColor: Record<string, string> = {
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
};

const ItemBadge = ({ item }: { item: ShopItem }) => {
    if (item.rarity === 'legendary') {
        return (
            <span style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#111', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}>
                <Star size={10} fill="#111" /> Popular
            </span>
        );
    }
    if (item.rarity === 'epic') {
        return (
            <span style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}>
                <Sparkles size={10} /> New
            </span>
        );
    }
    return null;
};

const Shop = () => {
    const { gratoniteBalance, setGratoniteBalance } = useOutletContext<any>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useUser();
    const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
    const [purchaseState, setPurchaseState] = useState<'idle' | 'confirming' | 'processing' | 'success' | 'insufficient'>('idle');
    const [isLoading, setIsLoading] = useState(true);
    const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems);
    const [view, setView] = useState<ViewType>('frames');
    const [purchasingId, setPurchasingId] = useState<string | null>(null);
    const [showBundleItems, setShowBundleItems] = useState(false);
    const [equippingPurchased, setEquippingPurchased] = useState(false);
    const bundleItemsRef = useRef<HTMLDivElement>(null);

    // Gift system
    const [giftItem, setGiftItem] = useState<ShopItem | null>(null);
    const [giftFriendSearch, setGiftFriendSearch] = useState('');
    const [giftFriends, setGiftFriends] = useState<Array<{ id: string; userId: string; username: string; displayName: string; avatarHash: string | null }>>([]);
    const [giftSending, setGiftSending] = useState(false);

    // Try-on / preview
    const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);

    // Bundle builder
    const [showBundleBuilder, setShowBundleBuilder] = useState(false);
    const [bundleBuilderItems, setBundleBuilderItems] = useState<ShopItem[]>([]);

    const loadGiftFriends = async () => {
        try {
            const data = await api.get<any[]>('/relationships?type=friend');
            if (Array.isArray(data)) {
                setGiftFriends(data.map((f: any) => ({
                    id: f.id, userId: f.userId ?? f.id,
                    username: f.username ?? '', displayName: f.displayName ?? f.username ?? 'User',
                    avatarHash: f.avatarHash ?? null,
                })));
            }
        } catch { /* empty */ }
    };

    const bundleIncludedItems = shopItems.filter(i =>
        ['Aurora Borealis', 'Cherry Blossom', 'Prismatic Arc', 'Liquid Chrome'].includes(i.name)
    );

    useEffect(() => {
        api.shop.getItems().then((items: any[]) => {
            const typeMap: Record<string, ShopItem['type']> = {
                avatar_frame: 'frame', frame: 'frame',
                avatar_decoration: 'decoration', decoration: 'decoration',
                profile_effect: 'effect', effect: 'effect',
                nameplate: 'nameplate',
            };
            const rarityMap: Record<string, ShopItem['rarity']> = {
                epic: 'epic', legendary: 'legendary', rare: 'rare', uncommon: 'uncommon',
            };
            const mapped: ShopItem[] = items.filter((item: any) => item.id).map((item: any) => ({
                id: item.id,
                type: typeMap[item.type] ?? 'frame',
                name: item.name ?? 'Unknown',
                price: item.price ?? 0,
                image: item.previewImageUrl ?? item.image ?? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                rarity: rarityMap[item.rarity] ?? 'uncommon',
                description: item.description ?? '',
                assetConfig: item.assetConfig ?? {},
                nameplateFont: (item.assetConfig as any)?.nameplateFont,
                nameplateGradient: (item.assetConfig as any)?.nameplateGradient ?? (() => {
                    const style = (item.assetConfig as any)?.nameplateStyle;
                    const gradients: Record<string, string> = {
                        rainbow: 'linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)',
                        fire: 'linear-gradient(90deg, #ff4500, #ff8c00, #ffd700)',
                        ice: 'linear-gradient(90deg, #00bfff, #87ceeb, #e0ffff)',
                        gold: 'linear-gradient(90deg, #ffd700, #daa520, #b8860b)',
                        glitch: 'linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff)',
                        sakura: 'linear-gradient(90deg, #f9a8d4, #fbcfe8, #fff1f2)',
                        neon: 'linear-gradient(90deg, #00ffff, #39ff14, #00ffff)',
                        void: 'linear-gradient(90deg, #7c3aed, #3b0764, #000000)',
                    };
                    return gradients[style] ?? 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))';
                })(),
                decorationEmoji: (() => {
                    const shape = (item.assetConfig as any)?.shape as string | undefined;
                    if (shape) {
                        const emojiMap: Record<string, string> = {
                            crown: '\u{1F451}', star: '\u2B50', flame: '\u{1F525}', bolt: '\u26A1',
                            orb: '\u{1F52E}', shield: '\u{1F6E1}\uFE0F', gem: '\u{1F48E}',
                            lotus: '\u{1F338}', moon: '\u{1F319}', snowflake: '\u2744\uFE0F',
                            comet: '\u2604\uFE0F', sparkles: '\u2728', sun: '\u2600\uFE0F', gear: '\u2699\uFE0F',
                        };
                        return emojiMap[shape] ?? '\u2728';
                    }
                    return (item.assetConfig as any)?.decorationEmoji;
                })(),
                color: item.color ?? (item.assetConfig as any)?.glowColor ?? 'var(--accent-primary)',
            }));
            if (mapped.length > 0) setShopItems(mapped);
            setIsLoading(false);
        }).catch(() => {
            setIsLoading(false);
            addToast({ title: 'Failed to load shop items', description: 'Could not fetch the cosmetics shop.', variant: 'error' });
        });
    }, []);

    const filterType = view === 'frames' ? 'frame'
        : view === 'decorations' ? 'decoration'
        : view === 'effects' ? 'effect'
        : 'nameplate';

    const filteredItems = shopItems.filter(i => i.type === filterType);

    const openModal = (item: ShopItem) => {
        setSelectedItem(item);
        setPurchaseState(gratoniteBalance < item.price ? 'insufficient' : 'idle');
    };

    const confirmPurchase = () => {
        if (!selectedItem) return;
        setPurchaseState('processing');
        api.shop.purchase(String(selectedItem.id), crypto.randomUUID()).then((result: any) => {
            if (result?.wallet?.balance !== undefined) setGratoniteBalance(result.wallet.balance);
            else setGratoniteBalance((b: number) => b - selectedItem.price);
            window.dispatchEvent(new Event('gratonite:inventory-updated'));
            window.dispatchEvent(new Event('inventory:changed'));
            setPurchaseState('success');
        }).catch((err: any) => {
            setPurchaseState('idle');
            addToast({ title: 'Purchase failed', description: err?.message ?? 'Please try again.', variant: 'error' });
        });
    };

    const closeModal = () => {
        setSelectedItem(null);
        setPurchaseState('idle');
        setEquippingPurchased(false);
    };

    const handleEquipNow = async () => {
        if (!selectedItem || equippingPurchased) return;
        setEquippingPurchased(true);
        try {
            const userId = localStorage.getItem('gratonite-user-id') ?? 'me';
            const response = await api.shop.equipItem(String(selectedItem.id));
            const cfg = (response?.assetConfig ?? {}) as Record<string, unknown>;
            const itemType = selectedItem.type === 'frame' ? 'avatar_frame'
                : selectedItem.type === 'effect' ? 'profile_effect'
                : selectedItem.type;
            applyEquippedItem(itemType, cfg, userId);
            if (itemType === 'nameplate') {
                const style = (cfg.nameplateStyle as string) ?? 'none';
                api.users.updateProfile({ nameplateStyle: style }).catch(() => {
                    addToast({ title: 'Failed to apply nameplate style', variant: 'error' });
                });
            }
            addToast({ title: 'Equipped!', description: `${selectedItem.name} is now active.`, variant: 'success' });
            closeModal();
        } catch (err: any) {
            addToast({ title: 'Failed to equip', description: err?.message ?? 'Please try again.', variant: 'error' });
        } finally {
            setEquippingPurchased(false);
        }
    };

    const handleQuickBuy = (item: ShopItem) => {
        if (gratoniteBalance < item.price) {
            addToast({ title: 'Insufficient Gratonite', description: `You need ${item.price - gratoniteBalance} more Gratonite.`, variant: 'error' });
            return;
        }
        setPurchasingId(item.id);
        api.shop.purchase(String(item.id), crypto.randomUUID()).then((result: any) => {
            if (result?.wallet?.balance !== undefined) setGratoniteBalance(result.wallet.balance);
            else setGratoniteBalance((b: number) => b - item.price);
            window.dispatchEvent(new Event('gratonite:inventory-updated'));
            window.dispatchEvent(new Event('inventory:changed'));
            addToast({ title: 'Purchase Successful', description: `${item.name} has been added to your inventory.`, variant: 'achievement' });
            setPurchasingId(null);
        }).catch((err: any) => {
            addToast({ title: 'Purchase failed', description: err?.message ?? 'Please try again.', variant: 'error' });
            setPurchasingId(null);
        });
    };

    const tabs: { key: ViewType; label: string; icon: React.ReactNode }[] = [
        { key: 'frames', label: 'Avatar Frames', icon: <Layers size={14} /> },
        { key: 'decorations', label: 'Decorations', icon: <Star size={14} /> },
        { key: 'effects', label: 'Profile Effects', icon: <Sparkles size={14} /> },
        { key: 'nameplates', label: 'Nameplates', icon: <Type size={14} /> },
    ];

    const handleGift = async (item: ShopItem, recipientId: string) => {
        setGiftSending(true);
        try {
            await api.gifts.send(String(item.id), recipientId);
            setGratoniteBalance((b: number) => b - item.price);
            addToast({ title: 'Gift Sent!', description: `${item.name} has been gifted!`, variant: 'achievement' });
            setGiftItem(null);
        } catch (err: any) {
            addToast({ title: 'Gift Failed', description: err?.message ?? 'Could not send gift', variant: 'error' });
        }
        setGiftSending(false);
    };

    const handleBundlePurchase = async () => {
        if (bundleBuilderItems.length < 2) { addToast({ title: 'Add at least 2 items', variant: 'error' }); return; }
        try {
            const result = await api.bundlePurchase.buy(bundleBuilderItems.map(i => String(i.id)));
            setGratoniteBalance(result.wallet.balance);
            addToast({ title: 'Bundle Purchased!', description: `Saved ${result.savings} Gratonites (${result.discount}% off)`, variant: 'achievement' });
            setBundleBuilderItems([]);
            setShowBundleBuilder(false);
        } catch (err: any) {
            addToast({ title: 'Purchase Failed', description: err?.message ?? 'Could not purchase bundle', variant: 'error' });
        }
    };

    const bundleDiscount = bundleBuilderItems.length >= 5 ? 25 : bundleBuilderItems.length >= 4 ? 20 : bundleBuilderItems.length >= 3 ? 15 : bundleBuilderItems.length >= 2 ? 10 : 0;
    const bundleTotal = bundleBuilderItems.reduce((s, i) => s + i.price, 0);
    const bundleDiscounted = Math.floor(bundleTotal * (1 - bundleDiscount / 100));

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
            <style>{`
                @keyframes shop-rainbow-spin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
                @keyframes shop-pulse-glow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
                @keyframes shop-gradient-pulse { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes shop-twinkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
                @keyframes shop-float-up { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.7; } 100% { transform: translateY(-100px); opacity: 0; } }
                @keyframes shop-matrix-fall { 0% { transform: translateY(-20px); opacity: 0; } 10% { opacity: 0.6; } 100% { transform: translateY(110px); opacity: 0; } }
                @keyframes shop-aurora-shift { 0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.5; } 50% { transform: translateY(-8px) scaleX(1.1); opacity: 0.8; } }
            `}</style>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                            <ShoppingBag size={24} />
                            <h1 style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Cosmetics Shop</h1>
                        </div>
                        <p style={{ color: 'var(--text-secondary)' }}>Spend your Gratonite gems on exclusive profile customizations.</p>
                    </div>

                    <div style={{ background: 'var(--bg-tertiary)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Gem size={20} color="#10b981" />
                        <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{gratoniteBalance.toLocaleString()}</span>
                        <MagneticButton onClick={() => navigate('/gratonite')} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: 'white', fontWeight: 600, marginLeft: '12px', cursor: 'pointer', zIndex: 10 }}>Get More</MagneticButton>
                    </div>
                </header>

                {/* Featured Section */}
                <div style={{ background: 'linear-gradient(135deg, rgba(82, 109, 245, 0.1), rgba(217, 70, 239, 0.1))', padding: '32px', borderRadius: '16px', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
                            <Sparkles size={14} /> New Arrival
                        </div>
                        <h2 style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Astral Projection Bundle</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>Includes Prismatic Arc frame, Aurora Borealis effect, Cherry Blossom decoration, and Liquid Chrome profile effect.</p>
                        <MagneticButton className="auth-button" onClick={() => {
                            setShowBundleItems(prev => !prev);
                            if (!showBundleItems) {
                                setTimeout(() => bundleItemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                            }
                        }} style={{ marginTop: 0, width: 'fit-content', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                            {showBundleItems ? 'Hide Bundle' : 'View Bundle'} <ArrowRight size={18} style={{ transform: showBundleItems ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </MagneticButton>
                    </div>
                    <div style={{ width: '200px', height: '200px', borderRadius: '50%', background: 'linear-gradient(45deg, #6366f1, #d946ef)', border: '8px solid var(--bg-elevated)', boxShadow: '0 0 40px rgba(217, 70, 239, 0.4)' }}></div>
                </div>

                {/* Bundle Items Panel */}
                {showBundleItems && (
                    <div ref={bundleItemsRef} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px', marginBottom: '48px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={18} color="var(--accent-primary)" /> Bundle Includes ({bundleIncludedItems.length} items)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                            {bundleIncludedItems.map(item => (
                                <div key={item.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: item.image, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        {item.decorationEmoji || ''}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{item.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.type} &middot; <span style={{ color: rarityColor[item.rarity] }}>{item.rarity}</span></div>
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                        <Gem size={12} /> {item.price}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(82, 109, 245, 0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={14} color="var(--accent-primary)" />
                            Bundle price: <strong style={{ color: 'var(--accent-primary)' }}>3,200 Gratonite</strong> (save 15% vs. buying individually)
                        </div>
                    </div>
                )}

                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
                    {tabs.map(tab => (
                        <RippleWrapper key={tab.key}>
                            <button
                                onClick={() => setView(tab.key)}
                                style={{
                                    background: view === tab.key ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                                    color: view === tab.key ? 'var(--bg-app)' : 'var(--text-primary)',
                                    border: 'var(--border-structural)',
                                    padding: '8px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    fontSize: '14px',
                                }}>
                                {tab.icon}
                                {tab.label}
                            </button>
                        </RippleWrapper>
                    ))}
                </div>

                {/* Category Description */}
                {view === 'decorations' && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                        ✨ Avatar Decorations appear as overlays around your profile picture — crowns, wings, halos, and more.
                    </p>
                )}
                {view === 'nameplates' && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                        🔤 Nameplates change how your display name appears across the app — gradients, fonts, and glowing effects.
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={`shop-skeleton-${i}`} variant="card" height="300px" />
                        ))
                    ) : filteredItems.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No Items Available</p>
                            <p style={{ fontSize: '13px' }}>No cosmetics are currently available for this category.</p>
                        </div>
                    ) : view === 'nameplates' ? (
                        filteredItems.map(item => (
                            <TiltCard key={item.id} maxTilt={10} scale={1.03}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-panel)' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />
                                    <ItemBadge item={item} />

                                    {/* Nameplate Preview */}
                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--stroke)' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', flexShrink: 0 }} />
                                        <div>
                                            <div style={{
                                                fontWeight: 800,
                                                fontSize: '17px',
                                                background: item.nameplateGradient,
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                backgroundClip: 'text',
                                                fontFamily: item.nameplateFont ?? 'var(--font-display)',
                                                letterSpacing: '0.01em',
                                            }}>
                                                {user?.name || user?.handle || 'You'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Online</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{item.name}</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.description}</p>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: 'var(--border-structural)' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Gem size={16} /> {item.price}</span>
                                        <RippleWrapper>
                                            <button
                                                onClick={() => openModal(item)}
                                                disabled={purchasingId === item.id}
                                                style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}>
                                                {purchasingId === item.id ? '...' : 'Buy'}
                                            </button>
                                        </RippleWrapper>
                                    </div>
                                </div>
                            </TiltCard>
                        ))
                    ) : view === 'decorations' ? (
                        filteredItems.map(item => (
                            <TiltCard key={item.id} maxTilt={12} scale={1.03}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-panel)' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />
                                    <ItemBadge item={item} />

                                    {/* Decoration Preview */}
                                    <div style={{ position: 'relative', width: '100px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
                                        {/* Decoration overlay top */}
                                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '28px', zIndex: 2 }}>
                                            {item.decorationEmoji}
                                        </div>
                                        {/* Avatar circle */}
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', position: 'relative', zIndex: 1, marginTop: '16px' }} />
                                    </div>

                                    <div style={{ textAlign: 'center', width: '100%' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{item.name}</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{item.description}</p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: 'var(--border-structural)' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Gem size={16} /> {item.price}</span>
                                            <RippleWrapper>
                                                <button
                                                    onClick={() => openModal(item)}
                                                    disabled={purchasingId === item.id}
                                                    style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer' }}>
                                                    {purchasingId === item.id ? '...' : 'Buy'}
                                                </button>
                                            </RippleWrapper>
                                        </div>
                                    </div>
                                </div>
                            </TiltCard>
                        ))
                    ) : (
                        filteredItems.map(item => {
                            const cfg = item.assetConfig ?? {};
                            const frameStyle = (cfg as any)?.frameStyle as string | undefined;
                            const glowColor = (cfg as any)?.glowColor as string | undefined ?? item.color;
                            const effectType = (cfg as any)?.effectType as string | undefined;
                            const isFrame = item.type === 'frame';
                            const isEffect = item.type === 'effect';

                            // Frame style to CSS mapping
                            const frameCSS: React.CSSProperties = isFrame ? (() => {
                                switch (frameStyle) {
                                    case 'neon': return { border: `3px solid ${glowColor}`, boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}60, inset 0 0 8px ${glowColor}30` };
                                    case 'gold': return { border: '3px solid #ffd700', boxShadow: '0 0 12px #ffd70060, 0 0 24px #daa52040' };
                                    case 'glass': return { border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 0 12px rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' };
                                    case 'rainbow': return { border: '3px solid transparent', backgroundImage: `linear-gradient(var(--bg-elevated), var(--bg-elevated)), linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', animation: 'shop-rainbow-spin 3s linear infinite' };
                                    case 'pulse': return { border: `3px solid ${glowColor}`, animation: 'shop-pulse-glow 2s ease-in-out infinite', boxShadow: `0 0 12px ${glowColor}80` };
                                    case 'fire': return { border: '3px solid #ff6b35', boxShadow: '0 0 12px #ff6b3580, 0 0 24px #ff450040', animation: 'shop-pulse-glow 1.5s ease-in-out infinite' };
                                    case 'glitch': return { border: '3px solid #00ffff', boxShadow: '0 0 12px #00ffff80, -2px 0 8px #ff00ff40, 2px 0 8px #00ffff40', animation: 'shop-pulse-glow 2s steps(4) infinite' };
                                    default: return { border: `3px solid ${glowColor}`, boxShadow: `0 0 12px ${glowColor}60` };
                                }
                            })() : {};

                            return (
                            <TiltCard key={item.id} maxTilt={12} scale={1.03}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: 'var(--border-structural)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden', height: '100%', boxShadow: 'var(--shadow-panel)' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%)', zIndex: 0 }}></div>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />
                                    <ItemBadge item={item} />

                                    {isFrame ? (
                                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                                            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', ...frameCSS }}></div>
                                        </div>
                                    ) : isEffect ? (
                                        <div style={{ width: '100px', height: '100px', borderRadius: '12px', position: 'relative', zIndex: 1, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                                            {effectType === 'gradient-pulse' && (
                                                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${glowColor}, transparent, ${glowColor})`, backgroundSize: '200% 200%', animation: 'shop-gradient-pulse 3s ease infinite', opacity: 0.8 }} />
                                            )}
                                            {effectType === 'stars' && (
                                                <div style={{ position: 'absolute', inset: 0 }}>
                                                    {[...Array(8)].map((_, i) => (
                                                        <div key={i} style={{ position: 'absolute', width: '4px', height: '4px', borderRadius: '50%', background: glowColor, left: `${12 + (i * 11) % 80}%`, top: `${8 + (i * 17) % 80}%`, animation: `shop-twinkle ${1.5 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`, boxShadow: `0 0 4px ${glowColor}` }} />
                                                    ))}
                                                    <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }} />
                                                </div>
                                            )}
                                            {effectType === 'particles' && (
                                                <div style={{ position: 'absolute', inset: 0 }}>
                                                    {[...Array(6)].map((_, i) => (
                                                        <div key={i} style={{ position: 'absolute', width: '6px', height: '6px', borderRadius: '50%', background: glowColor, left: `${15 + (i * 14) % 70}%`, bottom: `-6px`, animation: `shop-float-up ${2 + (i % 3)}s ease-in-out ${i * 0.4}s infinite`, opacity: 0.7 }} />
                                                    ))}
                                                </div>
                                            )}
                                            {effectType === 'matrix-rain' && (
                                                <div style={{ position: 'absolute', inset: 0, fontFamily: 'monospace', fontSize: '10px', color: '#00ff41', overflow: 'hidden', opacity: 0.6 }}>
                                                    {[...Array(5)].map((_, i) => (
                                                        <div key={i} style={{ position: 'absolute', left: `${10 + i * 18}%`, top: '-20px', animation: `shop-matrix-fall ${1.5 + (i % 3) * 0.5}s linear ${i * 0.3}s infinite`, whiteSpace: 'pre' }}>
                                                            {String.fromCharCode(0x30A0 + Math.random() * 96)}{'\n'}{String.fromCharCode(0x30A0 + Math.random() * 96)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {effectType === 'aurora' && (
                                                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 0%, ${glowColor}40 30%, #00ffaa40 60%, transparent 100%)`, animation: 'shop-aurora-shift 4s ease-in-out infinite', opacity: 0.7 }} />
                                            )}
                                            {effectType === 'liquid-metal' && (
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c0c0c0, #808080, #e0e0e0, #606060, #d0d0d0, #404040)', backgroundSize: '300% 300%', animation: 'shop-gradient-pulse 4s ease-in-out infinite', opacity: 0.9 }} />
                                            )}
                                            {!effectType && (
                                                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${glowColor}40, transparent)`, opacity: 0.6 }} />
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: 'var(--shadow-hover)' }}>
                                            <div style={{ position: 'absolute', inset: -8, border: `4px solid ${item.color}`, borderRadius: '50%', boxShadow: `0 0 15px ${item.color}80` }}></div>
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'center', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>{item.name}</h3>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1 }}>{item.description}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: 'var(--border-structural)' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-display)' }}><Gem size={16} /> {item.price}</span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                                                    title="Try On"
                                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setGiftItem(item); loadGiftFriends(); }}
                                                    title="Gift"
                                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                                                    <Gift size={14} />
                                                </button>
                                                {showBundleBuilder && !bundleBuilderItems.find(b => b.id === item.id) && bundleBuilderItems.length < 5 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setBundleBuilderItems(prev => [...prev, item]); }}
                                                        title="Add to Bundle"
                                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex' }}>
                                                        <Package size={14} />
                                                    </button>
                                                )}
                                                <RippleWrapper>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openModal(item); }}
                                                        disabled={purchasingId === item.id}
                                                        style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: purchasingId === item.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {purchasingId === item.id ? <div className="spinner" style={{ width: 16, height: 16, border: '2px solid transparent', borderTopColor: 'var(--bg-app)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : 'Buy'}
                                                    </button>
                                                </RippleWrapper>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TiltCard>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bundle Builder */}
            {showBundleBuilder && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: '16px', padding: '24px', marginBottom: '32px', maxWidth: '1000px', margin: '0 auto 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Package size={20} color="var(--accent-primary)" /> Build a Bundle (max 5)
                        </h3>
                        <button onClick={() => { setShowBundleBuilder(false); setBundleBuilderItems([]); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', minHeight: '60px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '2px dashed var(--stroke)', marginBottom: '12px' }}>
                        {bundleBuilderItems.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Click "Add to Bundle" on any item below to start building.</span>}
                        {bundleBuilderItems.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>{item.price}</span>
                                <button onClick={() => setBundleBuilderItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                            </div>
                        ))}
                    </div>
                    {bundleBuilderItems.length >= 2 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{bundleTotal}</span>
                                <span style={{ fontWeight: 700, marginLeft: '8px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Gem size={14} /> {bundleDiscounted}</span>
                                <span style={{ fontSize: '12px', color: '#10b981', marginLeft: '8px' }}>Save {bundleDiscount}%</span>
                            </div>
                            <button onClick={handleBundlePurchase} style={{ padding: '8px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                                Purchase Bundle
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Action bar */}
            <div style={{ maxWidth: '1000px', margin: '0 auto 16px', display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setShowBundleBuilder(prev => !prev)}
                    style={{ padding: '8px 16px', borderRadius: '8px', background: showBundleBuilder ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: showBundleBuilder ? '#000' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                    <Package size={14} /> Bundle Builder
                </button>
            </div>

            {/* Gift Modal */}
            {giftItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setGiftItem(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', padding: '24px', width: '400px', maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Gift {giftItem.name}</h3>
                            <button onClick={() => setGiftItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={giftFriendSearch} onChange={e => setGiftFriendSearch(e.target.value)} placeholder="Search friends..." style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {giftFriends.filter(f => f.displayName.toLowerCase().includes(giftFriendSearch.toLowerCase())).map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => handleGift(giftItem, f.userId)}
                                    disabled={giftSending}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-primary)', width: '100%', textAlign: 'left' }}
                                >
                                    <Avatar userId={f.userId} avatarHash={f.avatarHash} displayName={f.displayName} size={28} />
                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{f.displayName}</span>
                                    <Gift size={14} color="var(--accent-primary)" style={{ marginLeft: 'auto' }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Cosmetic Preview in Chat */}
            {previewItem && (() => {
                const previewColor = previewItem.color ?? 'var(--accent-primary)';
                const cfg = previewItem.assetConfig ?? {};
                const frameStyle = (cfg as any)?.frameStyle as string | undefined;
                const glowColor = (cfg as any)?.glowColor as string | undefined ?? previewColor;
                const effectType = (cfg as any)?.effectType as string | undefined;

                const getFrameCSS = (): React.CSSProperties => {
                    switch (frameStyle) {
                        case 'neon': return { border: `3px solid ${glowColor}`, boxShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}60` };
                        case 'gold': return { border: '3px solid #ffd700', boxShadow: '0 0 10px #ffd70060' };
                        case 'glass': return { border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 0 10px rgba(255,255,255,0.15)' };
                        case 'rainbow': return { border: '3px solid transparent', backgroundImage: `linear-gradient(var(--bg-primary), var(--bg-primary)), linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' };
                        case 'pulse': return { border: `3px solid ${glowColor}`, animation: 'shop-pulse-glow 2s ease-in-out infinite', boxShadow: `0 0 10px ${glowColor}80` };
                        case 'fire': return { border: '3px solid #ff6b35', boxShadow: '0 0 10px #ff6b3580', animation: 'shop-pulse-glow 1.5s ease-in-out infinite' };
                        case 'glitch': return { border: '3px solid #00ffff', boxShadow: '0 0 10px #00ffff80, -2px 0 6px #ff00ff40', animation: 'shop-pulse-glow 2s steps(4) infinite' };
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

                const nameplateStyle: React.CSSProperties = previewItem.type === 'nameplate' ? {
                    background: previewItem.nameplateGradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontFamily: previewItem.nameplateFont ?? 'var(--font-display)',
                } : {};

                const effectOverlay = previewItem.type === 'effect' ? getEffectOverlay() : null;

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
                                    {withCosmetic && previewItem.type === 'frame' && (
                                        <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', ...getFrameCSS(), pointerEvents: 'none' }} />
                                    )}
                                    {withCosmetic && previewItem.type === 'decoration' && previewItem.decorationEmoji && (
                                        <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: '14px', pointerEvents: 'none' }}>{previewItem.decorationEmoji}</div>
                                    )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', ...(withCosmetic ? nameplateStyle : {}) }}>
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
                        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', padding: '32px', width: '520px', maxWidth: '95vw' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Preview: {previewItem.name}</h3>
                                <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                {renderMessageBubble('Current', false)}
                                {renderMessageBubble(`With ${previewItem.name}`, true)}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setPreviewItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Close</button>
                                <button onClick={() => { openModal(previewItem); setPreviewItem(null); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Buy & Apply</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Purchase Modal */}
            {selectedItem && (
                <div className="modal-overlay" style={{ zIndex: 999 }}>
                    <div className="auth-card wide glass-panel" style={{ width: 'min(480px, 95vw)', position: 'relative', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button
                            onClick={closeModal}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '120px', height: '120px', margin: '0 auto 16px', background: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {selectedItem.type === 'frame' ? (() => {
                                    const cfg = selectedItem.assetConfig ?? {};
                                    const fs = (cfg as any)?.frameStyle as string | undefined;
                                    const gc = (cfg as any)?.glowColor as string | undefined ?? selectedItem.color;
                                    const modalFrameCSS: React.CSSProperties = (() => {
                                        switch (fs) {
                                            case 'neon': return { border: `4px solid ${gc}`, boxShadow: `0 0 16px ${gc}, 0 0 32px ${gc}60` };
                                            case 'gold': return { border: '4px solid #ffd700', boxShadow: '0 0 16px #ffd70060' };
                                            case 'glass': return { border: '4px solid rgba(255,255,255,0.3)', boxShadow: '0 0 16px rgba(255,255,255,0.15)' };
                                            case 'rainbow': return { border: '4px solid transparent', backgroundImage: `linear-gradient(var(--bg-tertiary), var(--bg-tertiary)), linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' };
                                            case 'pulse': return { border: `4px solid ${gc}`, animation: 'shop-pulse-glow 2s ease-in-out infinite', boxShadow: `0 0 16px ${gc}80` };
                                            case 'fire': return { border: '4px solid #ff6b35', boxShadow: '0 0 16px #ff6b3580, 0 0 32px #ff450040', animation: 'shop-pulse-glow 1.5s ease-in-out infinite' };
                                            case 'glitch': return { border: '4px solid #00ffff', boxShadow: '0 0 16px #00ffff80, -3px 0 10px #ff00ff40, 3px 0 10px #00ffff40', animation: 'shop-pulse-glow 2s steps(4) infinite' };
                                            default: return { border: `4px solid ${gc}`, boxShadow: `0 0 16px ${gc}60` };
                                        }
                                    })();
                                    return (
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', position: 'relative' }}>
                                        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', ...modalFrameCSS }} />
                                    </div>
                                    );
                                })() : selectedItem.type === 'decoration' ? (
                                    <div style={{ position: 'relative', width: '80px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '22px' }}>{selectedItem.decorationEmoji}</div>
                                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', marginTop: '12px' }} />
                                    </div>
                                ) : selectedItem.type === 'nameplate' ? (
                                    <div style={{ padding: '8px 16px', background: 'var(--bg-primary)', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
                                        <div style={{ fontWeight: 800, fontSize: '18px', background: selectedItem.nameplateGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontFamily: selectedItem.nameplateFont ?? 'var(--font-display)' }}>
                                            YourUsername
                                        </div>
                                    </div>
                                ) : (() => {
                                    const cfg = selectedItem.assetConfig ?? {};
                                    const et = (cfg as any)?.effectType as string | undefined;
                                    const gc = (cfg as any)?.glowColor as string | undefined ?? selectedItem.color;
                                    return (
                                    <div style={{ width: '90%', height: '90%', background: 'var(--bg-primary)', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                                        {et === 'gradient-pulse' && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${gc}, transparent, ${gc})`, backgroundSize: '200% 200%', animation: 'shop-gradient-pulse 3s ease infinite', opacity: 0.7 }} />}
                                        {et === 'stars' && <div style={{ position: 'absolute', inset: 0 }}>{[...Array(6)].map((_, i) => <div key={i} style={{ position: 'absolute', width: '3px', height: '3px', borderRadius: '50%', background: gc, left: `${10 + (i * 15) % 80}%`, top: `${10 + (i * 13) % 80}%`, animation: `shop-twinkle ${1.5 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`, boxShadow: `0 0 3px ${gc}` }} />)}</div>}
                                        {et === 'particles' && <div style={{ position: 'absolute', inset: 0 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ position: 'absolute', width: '5px', height: '5px', borderRadius: '50%', background: gc, left: `${12 + (i * 16) % 70}%`, bottom: '-5px', animation: `shop-float-up ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`, opacity: 0.7 }} />)}</div>}
                                        {et === 'matrix-rain' && <div style={{ position: 'absolute', inset: 0, fontFamily: 'monospace', fontSize: '9px', color: '#00ff41', overflow: 'hidden', opacity: 0.5 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ position: 'absolute', left: `${10 + i * 22}%`, top: '-15px', animation: `shop-matrix-fall ${1.5 + (i % 3) * 0.5}s linear ${i * 0.3}s infinite` }}>{String.fromCharCode(0x30A0 + i * 7)}</div>)}</div>}
                                        {et === 'aurora' && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent, ${gc}40, #00ffaa40, transparent)`, animation: 'shop-aurora-shift 4s ease-in-out infinite', opacity: 0.6 }} />}
                                        {et === 'liquid-metal' && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c0c0c0, #808080, #e0e0e0, #606060, #d0d0d0, #404040)', backgroundSize: '300% 300%', animation: 'shop-gradient-pulse 4s ease-in-out infinite', opacity: 0.9 }} />}
                                        {!et && <div style={{ height: '50px', background: selectedItem.image, opacity: 0.8 }} />}
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--bg-primary)', position: 'absolute', top: '30px', left: '12px' }}></div>
                                    </div>
                                    );
                                })()}
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{selectedItem.name}</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedItem.description}</p>
                            <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '10px', background: `${rarityColor[selectedItem.rarity]}22`, color: rarityColor[selectedItem.rarity], textTransform: 'capitalize' }}>
                                {selectedItem.rarity}
                            </span>
                        </div>

                        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Current Balance</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><Gem size={14} color="#10b981" /> {gratoniteBalance.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Item Cost</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--error)' }}>- {selectedItem.price.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '12px 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600 }}>Balance After</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: (gratoniteBalance - selectedItem.price) < 0 ? 'var(--error)' : 'inherit' }}>
                                    <Gem size={14} color="#10b981" /> {(gratoniteBalance - selectedItem.price).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {purchaseState === 'insufficient' && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>
                                Not enough Gratonite. Earn more by chatting or completing milestones.
                            </div>
                        )}

                        {purchaseState === 'success' && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Check size={18} /> Purchase Successful! Added to Inventory.
                            </div>
                        )}

                        {purchaseState === 'success' ? (
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={closeModal} className="auth-button" style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', margin: 0 }}>
                                    Close
                                </button>
                                <button
                                    onClick={handleEquipNow}
                                    disabled={equippingPurchased}
                                    className="auth-button"
                                    style={{ flex: 1, margin: 0, opacity: equippingPurchased ? 0.6 : 1, cursor: equippingPurchased ? 'wait' : 'pointer' }}>
                                    {equippingPurchased ? 'Equipping...' : 'Equip Now'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={closeModal} className="auth-button" style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', margin: 0 }}>
                                    Cancel
                                </button>

                                <button
                                    onClick={purchaseState === 'insufficient' ? undefined : confirmPurchase}
                                    className="auth-button"
                                    style={{ flex: 1, margin: 0, opacity: (purchaseState === 'insufficient' || purchaseState === 'processing') ? 0.5 : 1, cursor: (purchaseState === 'insufficient' || purchaseState === 'processing') ? 'not-allowed' : 'pointer' }}
                                    disabled={purchaseState === 'insufficient' || purchaseState === 'processing'}>
                                    {purchaseState === 'insufficient' ? 'Not Enough Gratonite' : purchaseState === 'processing' ? 'Processing...' : 'Confirm Purchase'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shop;
