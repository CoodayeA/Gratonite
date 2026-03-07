import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Sparkles, Gem, ArrowRight, X, Check, Play, Pause, Volume2, Type, Star, Layers } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Skeleton from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/ToastManager';
import { TiltCard, RippleWrapper, MagneticButton } from '../../components/ui/Physics';
import { api } from '../../lib/api';
import { applyEquippedItem } from '../../lib/cosmetics';

type ViewType = 'frames' | 'decorations' | 'effects' | 'nameplates' | 'soundboard';

type ShopItem = {
    id: string;
    type: 'frame' | 'decoration' | 'effect' | 'nameplate' | 'soundboard';
    name: string;
    price: number;
    image: string;
    rarity: 'epic' | 'legendary' | 'rare' | 'uncommon';
    description?: string;
    color?: string;
    // Nameplate extras
    nameplateFont?: string;
    nameplateGradient?: string;
    // Soundboard extras
    soundDuration?: string;
    soundCategory?: string;
    soundEmoji?: string;
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

const Shop = () => {
    const { gratoniteBalance, setGratoniteBalance } = useOutletContext<any>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
    const [purchaseState, setPurchaseState] = useState<'idle' | 'confirming' | 'processing' | 'success' | 'insufficient'>('idle');
    const [isLoading, setIsLoading] = useState(true);
    const [shopItems, setShopItems] = useState<ShopItem[]>(initialShopItems);
    const [view, setView] = useState<ViewType>('frames');
    const [purchasingId, setPurchasingId] = useState<string | null>(null);
    const [playingSound, setPlayingSound] = useState<string | null>(null);
    const [showBundleItems, setShowBundleItems] = useState(false);
    const [equippingPurchased, setEquippingPurchased] = useState(false);
    const bundleItemsRef = useRef<HTMLDivElement>(null);

    const bundleIncludedItems = shopItems.filter(i =>
        ['Aurora Borealis', 'Cherry Blossom', 'Prismatic', 'Cosmic Ping'].includes(i.name)
    );

    useEffect(() => {
        api.shop.getItems().then((items: any[]) => {
            const typeMap: Record<string, ShopItem['type']> = {
                avatar_frame: 'frame', frame: 'frame',
                avatar_decoration: 'decoration', decoration: 'decoration',
                profile_effect: 'effect', effect: 'effect',
                nameplate: 'nameplate',
                soundboard: 'soundboard',
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
                color: item.color ?? 'var(--accent-primary)',
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
        : view === 'nameplates' ? 'nameplate'
        : 'soundboard';

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
                api.users.updateProfile({ nameplateStyle: style }).catch(() => {});
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

    const toggleSound = (id: string) => {
        setPlayingSound(prev => prev === id ? null : id);
        if (playingSound !== id) {
            setTimeout(() => setPlayingSound(null), 3000);
        }
    };

    const tabs: { key: ViewType; label: string; icon: React.ReactNode }[] = [
        { key: 'frames', label: 'Avatar Frames', icon: <Layers size={14} /> },
        { key: 'decorations', label: 'Decorations', icon: <Star size={14} /> },
        { key: 'effects', label: 'Profile Effects', icon: <Sparkles size={14} /> },
        { key: 'nameplates', label: 'Nameplates', icon: <Type size={14} /> },
        { key: 'soundboard', label: 'Soundboard', icon: <Volume2 size={14} /> },
    ];

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
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
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>Includes an animated avatar frame, profile theme, exclusive chat effects, and a Cosmic Ping soundboard clip.</p>
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
                                        {item.soundEmoji || item.decorationEmoji || ''}
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
                {view === 'soundboard' && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                        🔊 Soundboard clips are downloaded to your soundboard and can be triggered in voice channels. Preview them below.
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
                    ) : view === 'soundboard' ? (
                        filteredItems.map(item => (
                            <TiltCard key={item.id} maxTilt={8} scale={1.02}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '20px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-panel)' }}>
                                    {/* Rarity bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        {/* Sound emoji / icon */}
                                        <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: item.image, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                                            {item.soundEmoji}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontWeight: 600, fontSize: '16px', marginBottom: '2px' }}>{item.name}</h3>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>{item.soundCategory}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.soundDuration}</span>
                                            </div>
                                        </div>
                                        {/* Play button */}
                                        <button
                                            onClick={() => toggleSound(item.id)}
                                            style={{ width: '36px', height: '36px', borderRadius: '50%', background: playingSound === item.id ? item.color : 'var(--bg-tertiary)', border: `2px solid ${item.color}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                            {playingSound === item.id ? <Pause size={16} color="white" /> : <Play size={16} color={item.color} />}
                                        </button>
                                    </div>

                                    {/* Waveform visual (static decoration) */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '32px', padding: '0 4px' }}>
                                        {Array.from({ length: 28 }).map((_, i) => {
                                            const h = [4, 8, 12, 20, 28, 16, 10, 24, 18, 6, 22, 14, 8, 30, 12, 20, 6, 16, 28, 10, 18, 24, 8, 14, 20, 6, 12, 18][i] ?? 10;
                                            const active = playingSound === item.id && i < 16;
                                            return (
                                                <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '2px', background: active ? item.color : 'var(--stroke)', transition: 'background 0.3s' }} />
                                            );
                                        })}
                                    </div>

                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.description}</p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Gem size={14} /> {item.price}
                                        </span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <RippleWrapper>
                                                <button
                                                    onClick={() => openModal(item)}
                                                    style={{ background: 'transparent', border: `1px solid ${item.color}`, color: item.color, padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                                    Details
                                                </button>
                                            </RippleWrapper>
                                            <RippleWrapper>
                                                <button
                                                    onClick={() => handleQuickBuy(item)}
                                                    disabled={purchasingId === item.id}
                                                    style={{ background: 'var(--text-primary)', color: 'var(--bg-app)', border: 'none', padding: '6px 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: purchasingId === item.id ? 'wait' : 'pointer' }}>
                                                    {purchasingId === item.id ? '...' : 'Download'}
                                                </button>
                                            </RippleWrapper>
                                        </div>
                                    </div>
                                </div>
                            </TiltCard>
                        ))
                    ) : view === 'nameplates' ? (
                        filteredItems.map(item => (
                            <TiltCard key={item.id} maxTilt={10} scale={1.03}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-panel)' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />

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
                                                YourUsername
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
                        filteredItems.map(item => (
                            <TiltCard key={item.id} maxTilt={12} scale={1.03}>
                                <div className="hover-lift" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: 'var(--border-structural)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden', height: '100%', boxShadow: 'var(--shadow-panel)' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, transparent 100%)', zIndex: 0 }}></div>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: rarityColor[item.rarity] }} />
                                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: 'var(--shadow-hover)' }}>
                                        <div style={{ position: 'absolute', inset: -8, border: `4px solid ${item.color}`, borderRadius: '50%', boxShadow: `0 0 15px ${item.color}80` }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>{item.name}</h3>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1 }}>{item.description}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: 'var(--border-structural)' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-display)' }}><Gem size={16} /> {item.price}</span>
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
                            </TiltCard>
                        ))
                    )}
                </div>
            </div>

            {/* Purchase Modal */}
            {selectedItem && (
                <div className="modal-overlay" style={{ zIndex: 999 }}>
                    <div className="auth-card wide glass-panel" style={{ width: '480px', position: 'relative', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <button
                            onClick={closeModal}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '120px', height: '120px', margin: '0 auto 16px', background: 'var(--bg-tertiary)', borderRadius: '16px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {selectedItem.type === 'frame' ? (
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', position: 'relative' }}>
                                        <div style={{ position: 'absolute', inset: -8, border: `4px solid ${selectedItem.color}`, borderRadius: '50%', boxShadow: `0 0 15px ${selectedItem.color}80` }} />
                                    </div>
                                ) : selectedItem.type === 'decoration' ? (
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
                                ) : selectedItem.type === 'soundboard' ? (
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: selectedItem.image, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                                        {selectedItem.soundEmoji}
                                    </div>
                                ) : (
                                    <div style={{ width: '90%', height: '90%', background: 'var(--bg-primary)', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ height: '50px', background: selectedItem.image, opacity: 0.8 }}></div>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--bg-primary)', position: 'absolute', top: '30px', left: '12px' }}></div>
                                    </div>
                                )}
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

                        {purchaseState === 'success' && selectedItem.type !== 'soundboard' ? (
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
                                    {purchaseState === 'success' ? 'Close' : 'Cancel'}
                                </button>

                                {purchaseState !== 'success' && (
                                    <button
                                        onClick={purchaseState === 'insufficient' ? undefined : confirmPurchase}
                                        className="auth-button"
                                        style={{ flex: 1, margin: 0, opacity: (purchaseState === 'insufficient' || purchaseState === 'processing') ? 0.5 : 1, cursor: (purchaseState === 'insufficient' || purchaseState === 'processing') ? 'not-allowed' : 'pointer' }}
                                        disabled={purchaseState === 'insufficient' || purchaseState === 'processing'}>
                                        {purchaseState === 'insufficient' ? 'Not Enough Gratonite' : purchaseState === 'processing' ? 'Processing...' : selectedItem.type === 'soundboard' ? 'Download Sound' : 'Confirm Purchase'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shop;
