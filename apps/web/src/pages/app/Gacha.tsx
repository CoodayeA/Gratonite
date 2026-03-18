import { useState, useRef, useEffect, useCallback } from 'react';
import { Package, Sparkles, Gem, HelpCircle, History, Grid, X, Lock, ChevronRight } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { GachaReveal } from '../../components/ui/GachaReveal';
import { MagneticButton, TiltCard } from '../../components/ui/Physics';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type Rarity = 'Legendary' | 'Epic' | 'Rare' | 'Uncommon' | 'Common';

interface ManifestItem {
    id: string;
    name: string;
    file: string;
    rarity: string;
    animated: boolean;
}

interface CollectibleItem {
    id: string;
    name: string;
    rarity: Rarity;
    image: string;
    owned: boolean;
}

interface PullItem {
    id: string;
    name: string;
    rarity: Rarity;
    image: string;
}

interface PullHistoryEntry {
    date: string;
    pulls: PullItem[];
}

const rarityColors: Record<Rarity, string> = {
    Legendary: '#f59e0b',
    Epic: '#8b5cf6',
    Rare: '#526df5',
    Uncommon: '#10b981',
    Common: '#71717a',
};

const capitalizeRarity = (r: string): Rarity => {
    const map: Record<string, Rarity> = {
        legendary: 'Legendary',
        epic: 'Epic',
        rare: 'Rare',
        uncommon: 'Uncommon',
        common: 'Common',
    };
    return map[r] || 'Common';
};

const imagePath = (file: string) => `${import.meta.env.BASE_URL}gacha/${file}`;

const DROP_RATES: { rarity: Rarity; weight: number }[] = [
    { rarity: 'Legendary', weight: 0.015 },
    { rarity: 'Epic', weight: 0.085 },
    { rarity: 'Rare', weight: 0.25 },
    { rarity: 'Uncommon', weight: 0.35 },
    { rarity: 'Common', weight: 0.30 },
];

const pickRarity = (): Rarity => {
    const roll = Math.random();
    let cumulative = 0;
    for (const tier of DROP_RATES) {
        cumulative += tier.weight;
        if (roll < cumulative) return tier.rarity;
    }
    return 'Common';
};

const pickRandomFromRarity = (items: ManifestItem[], rarity: Rarity): ManifestItem | null => {
    const pool = items.filter(i => capitalizeRarity(i.rarity) === rarity);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
};

const generatePulls = (manifestItems: ManifestItem[]): PullItem[] => {
    if (manifestItems.length === 0) return [];

    const pulls: PullItem[] = [];

    // Guaranteed rare or better for first slot
    const guaranteedRarities: Rarity[] = ['Legendary', 'Epic', 'Rare'];
    const guaranteedRarity = guaranteedRarities[Math.random() < 0.015 ? 0 : Math.random() < 0.255 ? 1 : 2];
    const guaranteedItem = pickRandomFromRarity(manifestItems, guaranteedRarity);
    if (guaranteedItem) {
        pulls.push({
            id: guaranteedItem.id,
            name: guaranteedItem.name,
            rarity: capitalizeRarity(guaranteedItem.rarity),
            image: imagePath(guaranteedItem.file),
        });
    }

    // Fill remaining 2 slots with normal drop rates
    while (pulls.length < 3) {
        const rarity = pickRarity();
        const item = pickRandomFromRarity(manifestItems, rarity);
        if (item) {
            pulls.push({
                id: item.id,
                name: item.name,
                rarity: capitalizeRarity(item.rarity),
                image: imagePath(item.file),
            });
        }
    }

    return pulls;
};

const OWNED_STORAGE_KEY = 'gratonite_owned_gacha';
const HISTORY_STORAGE_KEY = 'gratonite_pull_history';

const loadOwnedIds = (): Set<string> => {
    try {
        const raw = localStorage.getItem(OWNED_STORAGE_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set();
};

const saveOwnedIds = (ids: Set<string>) => {
    localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...ids]));
};

const loadPullHistory = (): PullHistoryEntry[] => {
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
};

const savePullHistory = (history: PullHistoryEntry[]) => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
};

const initializeOwnedIds = (): Set<string> => {
    return loadOwnedIds();
};

const CardDetailOverlay = ({ item, onClose }: { item: CollectibleItem; onClose: () => void }) => {
    const [mounted, setMounted] = useState(false);
    const color = rarityColors[item.rarity];
    const isLegendary = item.rarity === 'Legendary';
    const isEpic = item.rarity === 'Epic';

    useEffect(() => {
        requestAnimationFrame(() => { requestAnimationFrame(() => setMounted(true)); });
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => { window.removeEventListener('keydown', handleKey); setMounted(false); };
    }, [onClose]);

    const rarityStars: Record<Rarity, number> = { Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
    const stars = rarityStars[item.rarity];

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                width: '320px', borderRadius: '24px', overflow: 'hidden',
                background: 'var(--bg-elevated)',
                border: `2px solid ${color}`,
                boxShadow: `0 0 60px ${color}40, 0 32px 64px rgba(0,0,0,0.8)`,
                transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(40px)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
            }}>
                {/* Legendary animated glow */}
                {isLegendary && (
                    <div style={{
                        position: 'absolute', inset: -4, borderRadius: '28px',
                        background: `conic-gradient(from 0deg, ${color}, #ec4899, #8b5cf6, ${color})`,
                        animation: 'spin 4s linear infinite', zIndex: -1, opacity: 0.6,
                    }} />
                )}

                {/* Card image area */}
                <div style={{
                    height: '280px', position: 'relative', overflow: 'hidden',
                    background: `radial-gradient(circle at 50% 70%, ${color}20, var(--bg-tertiary))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <img
                        src={item.image}
                        alt={item.name}
                        style={{
                            maxWidth: '75%', maxHeight: '75%', objectFit: 'contain',
                            filter: isLegendary ? `drop-shadow(0 0 20px ${color}80)` : isEpic ? `drop-shadow(0 0 12px ${color}60)` : 'none',
                            position: 'relative', zIndex: 1,
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Foil shimmer for legendary/epic */}
                    {(isLegendary || isEpic) && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(125deg, transparent 20%, rgba(255,255,255,0.3) 40%, transparent 60%)',
                            backgroundSize: '200% 200%',
                            animation: 'shimmer 3s infinite linear',
                            pointerEvents: 'none',
                        }} />
                    )}
                    {/* Rarity badge top-right */}
                    <div style={{
                        position: 'absolute', top: 16, right: 16,
                        background: color, color: '#000', padding: '4px 12px',
                        borderRadius: '20px', fontSize: '11px', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                        {item.rarity}
                    </div>
                </div>

                {/* Card info */}
                <div style={{
                    padding: '24px 28px 28px', textAlign: 'center',
                    borderTop: `1px solid ${color}30`,
                    background: 'var(--bg-elevated)',
                }}>
                    {/* Stars */}
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        {Array.from({ length: stars }).map((_, i) => (
                            <span key={i} style={{ color, fontSize: '18px' }}>{'\u2605'}</span>
                        ))}
                    </div>

                    <div style={{
                        fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)',
                        color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.2,
                    }}>
                        {item.name}
                    </div>

                    <div style={{ fontSize: '13px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                        {item.rarity} Gratonite Guy
                    </div>

                    <div style={{
                        display: 'flex', justifyContent: 'center', gap: '24px',
                        fontSize: '12px', color: 'var(--text-muted)',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                #{item.id.slice(0, 6).toUpperCase()}
                            </div>
                            <div>Serial</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--stroke)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {isLegendary ? '1.5%' : item.rarity === 'Epic' ? '8.5%' : item.rarity === 'Rare' ? '25%' : item.rarity === 'Uncommon' ? '35%' : '30%'}
                            </div>
                            <div>Drop Rate</div>
                        </div>
                    </div>
                </div>

                {/* Close hint */}
                <div style={{
                    padding: '12px', textAlign: 'center', fontSize: '11px',
                    color: 'var(--text-muted)', borderTop: '1px solid var(--stroke)',
                    background: 'var(--bg-tertiary)',
                }}>
                    Click anywhere to close
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `}</style>
        </div>
    );
};

const CollectionModal = ({ items, totalCount, onClose }: { items: CollectibleItem[]; totalCount: number; onClose: () => void }) => {
    const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');
    const [showOwned, setShowOwned] = useState<'all' | 'owned' | 'missing'>('all');
    const [selectedCard, setSelectedCard] = useState<CollectibleItem | null>(null);

    const ownedCount = items.filter(c => c.owned).length;

    const filtered = items.filter(item => {
        if (filterRarity !== 'all' && item.rarity !== filterRarity) return false;
        if (showOwned === 'owned' && !item.owned) return false;
        if (showOwned === 'missing' && item.owned) return false;
        return true;
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: 'min(860px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Full Collection</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{ownedCount}</span> / {totalCount} unlocked
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {/* Filters */}
                <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--stroke)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', marginRight: '16px' }}>
                        {(['all', 'owned', 'missing'] as const).map(f => (
                            <button key={f} onClick={() => setShowOwned(f)}
                                style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', background: showOwned === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: showOwned === f ? '#000' : 'var(--text-secondary)' }}
                            >{f}</button>
                        ))}
                    </div>
                    {(['all', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'] as const).map(r => (
                        <button key={r} onClick={() => setFilterRarity(r)}
                            style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterRarity === r ? (r === 'all' ? 'var(--bg-tertiary)' : rarityColors[r as Rarity]) : 'var(--bg-tertiary)', color: filterRarity === r && r !== 'all' ? 'white' : filterRarity === r ? 'var(--text-primary)' : 'var(--text-secondary)', outline: filterRarity === r && r !== 'all' ? `2px solid ${rarityColors[r as Rarity]}` : 'none' }}
                        >{r}</button>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                        {filtered.map(item => (
                            <TiltCard key={item.id} maxTilt={10} scale={1.04}>
                            <div
                                title={item.owned ? item.name : '???'}
                                onClick={() => { if (item.owned) setSelectedCard(item); }}
                                style={{ background: 'var(--bg-elevated)', border: `1px solid ${item.owned ? rarityColors[item.rarity] + '40' : 'var(--stroke)'}`, borderRadius: '12px', padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', cursor: item.owned ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
                            >
                                {/* Rarity dot */}
                                <div style={{ position: 'absolute', top: 6, right: 6, width: '8px', height: '8px', borderRadius: '50%', background: rarityColors[item.rarity], opacity: item.owned ? 1 : 0.3 }} />

                                <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: item.owned ? 'transparent' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                    {item.owned ? (
                                        <img src={item.image} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <Lock size={20} color="var(--text-muted)" />
                                    )}
                                    {!item.owned && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.3))', borderRadius: '10px' }} />
                                    )}
                                </div>

                                <div style={{ fontSize: '10px', fontWeight: 600, color: item.owned ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.owned ? item.name : '???'}
                                </div>

                                {item.owned && (
                                    <div style={{ fontSize: '9px', color: rarityColors[item.rarity], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.rarity}</div>
                                )}
                            </div>
                            </TiltCard>
                        ))}
                    </div>
                </div>
            </div>

            {selectedCard && <CardDetailOverlay item={selectedCard} onClose={() => setSelectedCard(null)} />}
        </div>
    );
};

const PullHistoryModal = ({ history, onClose }: { history: PullHistoryEntry[]; onClose: () => void }) => {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: 'min(560px, 95vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Pull History</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                    {history.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', padding: '32px 0' }}>No pulls yet. Open a pack to get started!</p>
                    )}
                    {history.map((group, gi) => (
                        <div key={gi} style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>{group.date}</div>
                            {group.pulls.map((pull, pi) => (
                                <div key={`${gi}-${pi}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '10px', border: '1px solid var(--stroke)', marginBottom: '8px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                        <img src={pull.image} alt={pull.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{pull.name}</div>
                                        <div style={{ fontSize: '12px', color: rarityColors[pull.rarity], fontWeight: 700 }}>{pull.rarity}</div>
                                    </div>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: rarityColors[pull.rarity] }} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TEAR_THRESHOLD = 80;
const PARTICLE_COLORS = ['#f59e0b', '#8b5cf6', '#526df5', '#10b981', '#ef4444', '#fff', '#ec4899'];

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
}

const Gacha = () => {
    const { gratoniteBalance, setGratoniteBalance } = useOutletContext<any>();
    const { addToast } = useToast();
    const [packState, setPackState] = useState<'idle' | 'opening' | 'results'>('idle');
    const [showCollection, setShowCollection] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Manifest + data state
    const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);
    const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
    const [currentPulls, setCurrentPulls] = useState<PullItem[]>([]);
    const [pullHistory, setPullHistory] = useState<PullHistoryEntry[]>(loadPullHistory);
    const [manifestLoaded, setManifestLoaded] = useState(false);

    // Server-side collectible cards (DB-backed)
    const [serverCards, setServerCards] = useState<CollectibleItem[]>([]);
    const [serverPacks, setServerPacks] = useState<any[]>([]);

    // Drag-to-tear state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [tearProgress, setTearProgress] = useState(0);
    const [particles, setParticles] = useState<Particle[]>([]);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const toreRef = useRef(false);

    // Load manifest on mount
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}gacha/gacha_manifest.json`)
            .then(res => res.json())
            .then((data: ManifestItem[]) => {
                setManifestItems(data);
                const owned = initializeOwnedIds();
                setOwnedIds(owned);
                setManifestLoaded(true);
            })
            .catch(() => {
                addToast({ title: 'Failed to load gacha manifest', variant: 'error' });
            });

        // Also load server-side collectible cards
        api.collectibleCards.getCollection()
            .then((cards: any[]) => {
                setServerCards(cards.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    rarity: capitalizeRarity(c.rarity),
                    image: c.image,
                    owned: c.owned,
                    count: c.count,
                })));
            })
            .catch(() => { /* server cards not available yet */ });

        api.collectibleCards.getPacks()
            .then((packs: any[]) => setServerPacks(packs))
            .catch(() => { /* no packs yet */ });
    }, []);

    // Build collectibles from manifest + merge server cards
    const manifestCollectibles: CollectibleItem[] = manifestItems.map(item => ({
        id: item.id,
        name: item.name,
        rarity: capitalizeRarity(item.rarity),
        image: imagePath(item.file),
        owned: ownedIds.has(item.id),
    }));

    // Merge: server cards that aren't already in manifest get appended
    const manifestIdSet = new Set(manifestCollectibles.map(c => c.id));
    const extraServerCards = serverCards.filter(c => !manifestIdSet.has(c.id));
    const allCollectibles = [...manifestCollectibles, ...extraServerCards];

    const totalCount = allCollectibles.length;
    const ownedCount = allCollectibles.filter(c => c.owned).length;

    const addPulledItemsToOwned = useCallback((pulls: PullItem[]) => {
        setOwnedIds(prev => {
            const next = new Set(prev);
            for (const p of pulls) next.add(p.id);
            saveOwnedIds(next);
            return next;
        });
    }, []);

    const addToHistory = useCallback((pulls: PullItem[]) => {
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        setPullHistory(prev => {
            const updated = [...prev];
            if (updated.length > 0 && updated[0].date === today) {
                updated[0] = { ...updated[0], pulls: [...pulls, ...updated[0].pulls] };
            } else {
                updated.unshift({ date: today, pulls });
            }
            // Keep last 50 entries max
            const trimmed = updated.slice(0, 50);
            savePullHistory(trimmed);
            return trimmed;
        });
    }, []);

    const openPack = useCallback(async () => {
        if (gratoniteBalance < 500 || !manifestLoaded) return;
        setPackState('opening');

        // If server packs are available, use the server-side open-pack endpoint
        if (serverPacks.length > 0) {
            try {
                const pack = serverPacks[0]; // default pack
                const result = await api.collectibleCards.openPack(pack.id);
                const pulls: PullItem[] = result.cards.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    rarity: capitalizeRarity(c.rarity),
                    image: c.image,
                }));
                setGratoniteBalance((prev: number) => prev - result.coinsSpent);
                setCurrentPulls(pulls);
                addPulledItemsToOwned(pulls);
                addToHistory(pulls);
                // Refresh server collection
                api.collectibleCards.getCollection().then((cards: any[]) => {
                    setServerCards(cards.map((c: any) => ({
                        id: c.id, name: c.name, rarity: capitalizeRarity(c.rarity),
                        image: c.image, owned: c.owned, count: c.count,
                    })));
                }).catch(() => {});
                setTimeout(() => setPackState('results'), 1200);
                return;
            } catch {
                setPackState('idle');
                addToast({ title: 'Purchase failed', description: 'Could not open the card pack.', variant: 'error' });
                return;
            }
        }

        // Fallback: local manifest-based pull with economy spend
        try {
            const result = await api.economy.spend({
                source: 'shop_purchase',
                amount: 500,
                description: 'Gacha Pack Pull x3',
                contextKey: `gacha_${Date.now()}`,
            });
            if (result.wallet) {
                setGratoniteBalance(result.wallet.balance);
            } else {
                setGratoniteBalance((prev: number) => prev - 500);
            }
        } catch {
            // If spend fails, abort the pull
            setPackState('idle');
            addToast({ title: 'Purchase failed', description: 'Could not complete the transaction.', variant: 'error' });
            return;
        }

        const pulls = generatePulls(manifestItems);
        setCurrentPulls(pulls);
        addPulledItemsToOwned(pulls);
        addToHistory(pulls);

        setTimeout(() => setPackState('results'), 1200);
    }, [gratoniteBalance, manifestLoaded, manifestItems, serverPacks, setGratoniteBalance, addPulledItemsToOwned, addToHistory]);

    const triggerTear = useCallback((cx: number, cy: number) => {
        if (toreRef.current) return;
        toreRef.current = true;
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
        setTearProgress(0);
        dragStartRef.current = null;

        // Spawn burst particles at pack position
        const newParticles: Particle[] = Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const speed = 80 + Math.random() * 80;
            return {
                id: Date.now() + i,
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                size: 6 + Math.random() * 10,
            };
        });
        setParticles(newParticles);

        // Screen shake on body
        document.body.style.animation = 'screenShake 0.5s ease';
        setTimeout(() => { document.body.style.animation = ''; }, 500);

        setTimeout(() => setParticles([]), 900);
        setTimeout(() => { toreRef.current = false; }, 200);
        openPack();
    }, [openPack]);

    const handlePackMouseDown = (e: React.MouseEvent) => {
        if (packState !== 'idle' || gratoniteBalance < 500 || !manifestLoaded) return;
        e.preventDefault();
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        toreRef.current = false;
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStartRef.current || toreRef.current) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            setDragOffset({ x: dx * 0.6, y: dy * 0.6 });
            setTearProgress(Math.min(dist / TEAR_THRESHOLD, 1));

            if (dist >= TEAR_THRESHOLD) {
                triggerTear(e.clientX, e.clientY);
            }
        };

        const handleMouseUp = () => {
            if (!toreRef.current) {
                setIsDragging(false);
                setDragOffset({ x: 0, y: 0 });
                setTearProgress(0);
                dragStartRef.current = null;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, triggerTear]);

    const handleRevealClose = () => setPackState('idle');

    const progressPercent = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                            <Package size={28} />
                            <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Gratonite Guys Gacha</h1>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Pull exclusive companions, profile effects, and rare badges.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button onClick={() => setShowHistory(true)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '10px 16px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <History size={18} /> History
                        </button>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Gem size={20} color="#10b981" />
                            <span style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{gratoniteBalance.toLocaleString()}</span>
                        </div>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 2fr', gap: '32px' }}>
                    {/* Pack Opening Area */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                        {packState === 'idle' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                {/* Drag-to-tear pack */}
                                <div
                                    onMouseDown={handlePackMouseDown}
                                    style={{
                                        marginBottom: '24px',
                                        cursor: gratoniteBalance >= 500 && manifestLoaded ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                        userSelect: 'none',
                                        transform: isDragging
                                            ? `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.08}deg)`
                                            : 'translate(0,0) rotate(0deg)',
                                        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25,1,0.5,1)',
                                        willChange: 'transform',
                                    }}
                                >
                                    <TiltCard maxTilt={isDragging ? 0 : 12} scale={1.05}>
                                        <div style={{
                                            width: '180px', height: '180px', borderRadius: '24px',
                                            background: `linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-purple) 100%)`,
                                            boxShadow: isDragging
                                                ? `0 30px 60px rgba(0,0,0,0.5), 0 0 ${tearProgress * 60}px var(--accent-primary)`
                                                : '0 20px 40px rgba(0,0,0,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                                            overflow: 'hidden',
                                        }}>
                                            <Sparkles size={64} color="white" style={{ position: 'absolute', opacity: 0.6 + tearProgress * 0.4 }} />
                                            <Package size={80} color="white" style={{ position: 'relative', zIndex: 1, opacity: 0.8 }} />
                                            {/* Tear progress overlay */}
                                            {tearProgress > 0 && (
                                                <div style={{
                                                    position: 'absolute', inset: 0, borderRadius: '24px',
                                                    background: `rgba(255,255,255,${tearProgress * 0.35})`,
                                                    pointerEvents: 'none',
                                                }} />
                                            )}
                                            {/* Crack lines at high tear progress */}
                                            {tearProgress > 0.5 && (
                                                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                                    <line x1="90" y1="0" x2={90 + dragOffset.x * 0.3} y2="180" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeDasharray="4 4" />
                                                    <line x1="60" y1="40" x2="120" y2="140" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="3 6" />
                                                </svg>
                                            )}
                                        </div>
                                    </TiltCard>
                                </div>

                                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Premium Pack</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>Contains 3 Gratonite Guys items. Guaranteed 1 Rare or better.</p>

                                {gratoniteBalance >= 500 && manifestLoaded ? (
                                    <p style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '20px', opacity: 0.8 }}>
                                        ✦ Drag the pack to tear it open, or click below
                                    </p>
                                ) : null}

                                <MagneticButton onClick={openPack} disabled={gratoniteBalance < 500 || !manifestLoaded} className="auth-button" style={{ width: '100%', fontSize: '18px', padding: '16px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', opacity: gratoniteBalance < 500 || !manifestLoaded ? 0.5 : 1, cursor: gratoniteBalance < 500 || !manifestLoaded ? 'not-allowed' : 'pointer', zIndex: 10 }}>
                                    {!manifestLoaded ? 'Loading...' : gratoniteBalance < 500 ? 'Not enough Gratonite' : <>Open for 500 <Gem size={18} /></>}
                                </MagneticButton>
                            </div>
                        )}

                        {packState === 'opening' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1s infinite' }}>
                                <div style={{ width: '180px', height: '180px', borderRadius: '24px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-purple) 100%)', boxShadow: '0 0 80px var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.1)' }}>
                                    <Sparkles size={80} color="white" />
                                </div>
                                <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '40px' }}>Revealing...</h2>
                            </div>
                        )}

                        {packState === 'results' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-primary)' }}>Pack Opened!</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Check your screen for the reveal...</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Collection Progress */}
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Your Collection Progress</h3>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>{ownedCount} / {totalCount} ({progressPercent}%)</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                                <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-purple))', transition: 'width 0.5s ease' }} />
                            </div>

                            {/* Mini collection preview (owned items) */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                {allCollectibles.filter(c => c.owned).slice(0, 8).map(item => (
                                    <div key={item.id} title={item.name}
                                        style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: `2px solid ${rarityColors[item.rarity]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        <img src={item.image} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                ))}
                                {ownedCount > 8 && (
                                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                        +{ownedCount - 8}
                                    </div>
                                )}
                            </div>

                            <button onClick={() => setShowCollection(true)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                            >
                                <Grid size={16} /> View Full Collection ({totalCount} items) <ChevronRight size={14} />
                            </button>
                        </div>

                        {/* Drop Rates */}
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                <HelpCircle size={18} color="var(--text-muted)" />
                                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Drop Rates</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {([
                                    { label: 'Legendary (GIFs)', rate: '1.5%', color: rarityColors.Legendary },
                                    { label: 'Epic', rate: '8.5%', color: rarityColors.Epic },
                                    { label: 'Rare', rate: '25.0%', color: rarityColors.Rare },
                                    { label: 'Uncommon', rate: '35.0%', color: rarityColors.Uncommon },
                                    { label: 'Common', rate: '30.0%', color: rarityColors.Common },
                                ] as const).map(tier => (
                                    <div key={tier.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: `3px solid ${tier.color}` }}>
                                        <span style={{ color: tier.color, fontWeight: 600, fontSize: '14px' }}>{tier.label}</span>
                                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{tier.rate}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {packState === 'results' && currentPulls.length > 0 && (
                <GachaReveal items={currentPulls.map(p => ({ ...p, rarity: p.rarity as any }))} onClose={handleRevealClose} />
            )}

            {showCollection && <CollectionModal items={allCollectibles} totalCount={totalCount} onClose={() => setShowCollection(false)} />}
            {showHistory && <PullHistoryModal history={pullHistory} onClose={() => setShowHistory(false)} />}

            {/* Tear particle burst — fixed overlay */}
            {particles.map(p => (
                <div
                    key={p.id}
                    style={{
                        position: 'fixed',
                        left: p.x,
                        top: p.y,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        borderRadius: p.size > 10 ? '50%' : '2px',
                        background: p.color,
                        pointerEvents: 'none',
                        zIndex: 9999,
                        transform: 'translate(-50%, -50%)',
                        '--vx': `${p.vx}px`,
                        '--vy': `${p.vy}px`,
                        animation: 'tearParticle 0.85s cubic-bezier(0.22,1,0.36,1) forwards',
                    } as React.CSSProperties}
                />
            ))}

            <style>{`
                @keyframes tearParticle {
                    0%   { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                    60%  { opacity: 1; }
                    100% { transform: translate(calc(-50% + var(--vx)), calc(-50% + var(--vy))) scale(0); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default Gacha;
