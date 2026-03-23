import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, Smile, Image as ImageIcon, Heart, ThumbsUp, Coffee, Flag, Lightbulb, Cat, Car, Settings, Loader, Star } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { api, API_BASE } from '../../lib/api';
import { getTenorApiKey } from '../../lib/tenor';
import { useDebounce } from '../../hooks/useDebounce';

// ─── Built-in Unicode Emoji Data ──────────────────────────────────────────────
const builtInCategories = [
    {
        id: 'recent', label: 'Recently Used', icon: Clock,
        emojis: [] as string[], // populated from localStorage
    },
    {
        id: 'smileys', label: 'Smileys & Emotion', icon: Smile,
        emojis: [
            '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
            '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
            '🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
            '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
            '😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥',
            '😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿',
            '💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
        ],
    },
    {
        id: 'people', label: 'People & Body', icon: ThumbsUp,
        emojis: [
            '👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
            '🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏',
            '🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻',
            '👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','🫦','👶','🧒','👦','👧','🧑',
            '👱','👨','🧔','👩','🧓','👴','👵',
        ],
    },
    {
        id: 'hearts', label: 'Hearts & Symbols', icon: Heart,
        emojis: [
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞',
            '💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️',
            '🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️',
            '🈳','🈹','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️',
        ],
    },
    {
        id: 'nature', label: 'Animals & Nature', icon: Cat,
        emojis: [
            '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
            '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗',
            '🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🐢',
            '🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲',
            '🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🍄','🪺','🪸',
        ],
    },
    {
        id: 'food', label: 'Food & Drink', icon: Coffee,
        emojis: [
            '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝',
            '🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶','🫑','🥒','🥬','🥦','🧄','🧅','🥜',
            '🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔',
            '🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗',
            '🍿','🧈','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡',
            '🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','🍯','🧃','🥤','🧋','☕','🍵','🫖',
            '🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃',
        ],
    },
    {
        id: 'travel', label: 'Travel & Places', icon: Car,
        emojis: [
            '🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵',
            '🚲','🛴','🛹','🛼','🚁','🛸','🚀','🛩','✈️','🚂','🚃','🚄','🚅','🚆','🚇','🚈',
            '🚉','🚊','🚝','🚞','🛳','⛴','🚢','⛵','🏠','🏡','🏘','🏚','🏗','🏭','🏢','🏬',
            '🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛','⛪','🕌','🕍','🛕','🕋','⛩',
            '⛲','⛺','🌁','🌃','🏙','🌄','🌅','🌆','🌇','🌉','🗼','🗽','🗿','🏰','🏯',
        ],
    },
    {
        id: 'activities', label: 'Activities', icon: Lightbulb,
        emojis: [
            '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥅','⛳',
            '🪃','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🪂',
            '🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴',
            '🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎫','🎟','🎪','🤹','🎭','🎨','🎬','🎤',
            '🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮',
            '🕹','🎰',
        ],
    },
    {
        id: 'objects', label: 'Objects', icon: Flag,
        emojis: [
            '⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','🕹','🗜','💽','💾','💿','📀','📼',
            '📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🎙','🎚','🎛','🧭',
            '⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯','🪔','🧯','🛢',
            '💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒',
            '🛠','⛏','🪚','🔩','⚙️','🪤','🧲','🔫','💣','🧨','🪓','🔪','🗡','⚔️','🛡','🚬',
        ],
    },
];

// ─── Recently Used Emojis (localStorage) ──────────────────────────────────────
const RECENT_KEY = 'gratonite-recent-emojis';
const MAX_RECENT = 32;

function getRecentEmojis(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function addRecentEmoji(emoji: string) {
    const recent = getRecentEmojis().filter(e => e !== emoji);
    recent.unshift(emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// ─── Favorite Emojis (localStorage) ───────────────────────────────────────────
const FAVORITES_KEY = 'gratonite-emoji-favorites';

function getFavoriteEmojis(): string[] {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function toggleFavoriteEmoji(emoji: string): string[] {
    const favs = getFavoriteEmojis();
    const idx = favs.indexOf(emoji);
    if (idx >= 0) {
        favs.splice(idx, 1);
    } else {
        favs.push(emoji);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return favs;
}

// ─── Frequently Used Emojis (localStorage) ────────────────────────────────────
const FREQ_KEY = 'emojiUsage';
const MAX_FREQUENT = 16;

type EmojiUsageData = Record<string, { count: number; lastUsed: number }>;

function getEmojiUsage(): EmojiUsageData {
    try {
        const raw = localStorage.getItem(FREQ_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function trackEmojiUsage(emoji: string) {
    const usage = getEmojiUsage();
    const existing = usage[emoji] || { count: 0, lastUsed: 0 };
    usage[emoji] = { count: existing.count + 1, lastUsed: Date.now() };
    localStorage.setItem(FREQ_KEY, JSON.stringify(usage));
}

function getFrequentEmojis(): string[] {
    const usage = getEmojiUsage();
    return Object.entries(usage)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, MAX_FREQUENT)
        .map(([emoji]) => emoji);
}

// ─── GIF Support (Tenor API v2) — requires VITE_TENOR_API_KEY ───────────────

interface TenorGif {
    id: string;
    title: string;
    media_formats: {
        gif: { url: string };
        tinygif: { url: string };
    };
}

function useTenorGifs(searchQuery: string) {
    const [gifs, setGifs] = useState<TenorGif[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchGifs = useCallback((query: string) => {
        const key = getTenorApiKey();
        if (!key) {
            setGifs([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const endpoint = query.trim()
            ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}&client_key=gratonite&limit=20`
            : `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(key)}&client_key=gratonite&limit=20`;
        fetch(endpoint)
            .then(r => r.json())
            .then(data => {
                setGifs((data.results || []) as TenorGif[]);
            })
            .catch(() => setGifs([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchGifs(searchQuery), searchQuery.trim() ? 300 : 0);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [searchQuery, fetchGifs]);

    return { gifs, loading };
}

// ─── Custom Server Emoji Type ─────────────────────────────────────────────────
interface ServerEmoji {
    id: string;
    name: string;
    url: string;
    animated?: boolean;
    categoryId?: string | null;
}

interface EmojiCategoryInfo {
    id: string;
    name: string;
    sortOrder: number;
}

// ─── Sticker Type ─────────────────────────────────────────────────────────────
interface Sticker {
    id: string;
    name: string;
    url: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
const EmojiPicker = ({ onSelectEmoji, onSendGif, onStickerSelect, guildId }: {
    onSelectEmoji: (emoji: string) => void;
    onSendGif?: (url: string, previewUrl: string) => void;
    onStickerSelect?: (sticker: Sticker) => void;
    guildId?: string | null;
}) => {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 150);
    const [activeTab, setActiveTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
    const [activeCategory, setActiveCategory] = useState('recent');
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [stickersLoading, setStickersLoading] = useState(false);
    const [recentEmojis, setRecentEmojis] = useState<string[]>(getRecentEmojis());
    const [frequentEmojis, setFrequentEmojis] = useState<string[]>(getFrequentEmojis());
    const [favoriteEmojis, setFavoriteEmojis] = useState<string[]>(getFavoriteEmojis());
    const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);
    const [serverEmojis, setServerEmojis] = useState<ServerEmoji[]>([]);
    const [emojiCats, setEmojiCats] = useState<EmojiCategoryInfo[]>([]);
    const [gifSearch, setGifSearch] = useState('');
    const tenorEnabled = !!getTenorApiKey();
    const { gifs, loading: gifsLoading } = useTenorGifs(activeTab === 'gif' && tenorEnabled ? gifSearch : '');
    const contentRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Fetch server custom emojis and categories
    useEffect(() => {
        if (!guildId) return;
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setServerEmojis(emojis.map(e => ({
                id: e.id,
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : `https://placehold.co/32/526df5/FFF?text=${e.name.charAt(0).toUpperCase()}`,
                animated: e.animated ?? false,
                categoryId: e.categoryId || null,
            })));
        }).catch(() => { addToast({ title: 'Failed to load server emojis', variant: 'error' }); });
        api.guilds.getEmojiCategories(guildId).then(setEmojiCats).catch(() => {});
    }, [guildId]);

    // Fetch stickers when sticker tab is active
    useEffect(() => {
        if (activeTab !== 'sticker') return;
        setStickersLoading(true);
        const promises: Promise<any[]>[] = [
            api.get<any[]>('/stickers/default').catch(() => []),
        ];
        if (guildId) {
            promises.push(api.get<any[]>(`/guilds/${guildId}/stickers`).catch(() => []));
        }
        Promise.all(promises).then(results => {
            const all = results.flat().map((s: any) => ({
                id: s.id,
                name: s.name,
                url: s.assetUrl || '',
            }));
            setStickers(all);
        }).finally(() => setStickersLoading(false));
    }, [activeTab, guildId]);

    // Focus search on open
    useEffect(() => {
        setTimeout(() => searchRef.current?.focus(), 100);
    }, []);

    const handleSelectEmoji = (emoji: string) => {
        addRecentEmoji(emoji);
        trackEmojiUsage(emoji);
        setRecentEmojis(getRecentEmojis());
        setFrequentEmojis(getFrequentEmojis());
        onSelectEmoji(emoji);
    };

    const handleSelectCustomEmoji = (name: string) => {
        const emojiStr = `:${name}:`;
        addRecentEmoji(emojiStr);
        trackEmojiUsage(emojiStr);
        setRecentEmojis(getRecentEmojis());
        setFrequentEmojis(getFrequentEmojis());
        onSelectEmoji(emojiStr);
    };

    // Build categories with recent emojis populated
    const categories = builtInCategories.map(cat => {
        if (cat.id === 'recent') return { ...cat, emojis: recentEmojis };
        return cat;
    });

    // Filter emojis by debounced search
    const searchLower = debouncedSearch.toLowerCase().trim();
    const filteredCategories = searchLower
        ? categories.map(cat => ({
            ...cat,
            emojis: cat.emojis.filter(e => e.toLowerCase().includes(searchLower)),
        })).filter(cat => cat.emojis.length > 0)
        : categories.filter(cat => cat.id !== 'recent' || cat.emojis.length > 0);

    const filteredServerEmojis = searchLower
        ? serverEmojis.filter(e => e.name.toLowerCase().includes(searchLower))
        : serverEmojis;

    // Build flat emoji list for keyboard navigation
    const flatEmojis: { emoji: string; isCustom: boolean }[] = [];
    if (activeTab === 'emoji') {
        if (!searchLower && frequentEmojis.length > 0) {
            frequentEmojis.forEach(e => flatEmojis.push({ emoji: e, isCustom: e.startsWith(':') }));
        }
        if (!searchLower && favoriteEmojis.length > 0 && !favoritesCollapsed) {
            favoriteEmojis.forEach(e => flatEmojis.push({ emoji: e, isCustom: e.startsWith(':') }));
        }
        filteredServerEmojis.forEach(e => flatEmojis.push({ emoji: `:${e.name}:`, isCustom: true }));
        filteredCategories.forEach(cat => {
            cat.emojis.forEach(e => flatEmojis.push({ emoji: e, isCustom: e.startsWith(':') }));
        });
    }

    // Reset focused index when search or tab changes
    useEffect(() => { setFocusedIndex(-1); }, [search, activeTab]);

    const GRID_COLS = 8;
    const handleKeyboardNav = useCallback((e: React.KeyboardEvent) => {
        if (activeTab !== 'emoji' || flatEmojis.length === 0) return;
        const total = flatEmojis.length;
        let idx = focusedIndex;

        if (e.key === 'ArrowRight') { e.preventDefault(); idx = idx < total - 1 ? idx + 1 : 0; }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); idx = idx > 0 ? idx - 1 : total - 1; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + GRID_COLS, total - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx >= GRID_COLS ? idx - GRID_COLS : idx; }
        else if (e.key === 'Enter' && idx >= 0) {
            e.preventDefault();
            const item = flatEmojis[idx];
            if (item.isCustom) handleSelectCustomEmoji(item.emoji.slice(1, -1));
            else handleSelectEmoji(item.emoji);
            return;
        } else return;

        setFocusedIndex(idx);
        // Scroll focused emoji into view
        const btn = contentRef.current?.querySelector(`[data-emoji-idx="${idx}"]`) as HTMLElement | null;
        btn?.scrollIntoView({ block: 'nearest' });
    }, [activeTab, flatEmojis, focusedIndex, handleSelectEmoji, handleSelectCustomEmoji]);

    // Scroll to category
    const scrollToCategory = (catId: string) => {
        setActiveCategory(catId);
        const el = document.getElementById(`emoji-cat-${catId}`);
        if (el && contentRef.current) {
            contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 8, behavior: 'smooth' });
        }
    };

    return (
        <div className="emoji-picker" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '0', width: '400px', height: '460px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 100, animation: 'scaleIn 0.2s ease-out' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                <button onClick={() => setActiveTab('emoji')} style={{ background: activeTab === 'emoji' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeTab === 'emoji' ? 'var(--text-primary)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    <Smile size={15} /> Emoji
                </button>
                {tenorEnabled && (
                <button onClick={() => setActiveTab('gif')} style={{ background: activeTab === 'gif' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeTab === 'gif' ? 'var(--text-primary)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    <ImageIcon size={15} /> GIFs
                </button>
                )}
                {onStickerSelect && (
                    <button onClick={() => setActiveTab('sticker')} style={{ background: activeTab === 'sticker' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeTab === 'sticker' ? 'var(--text-primary)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: '15px' }}>&#127915;</span> Stickers
                    </button>
                )}
            </div>

            {/* Search */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--stroke)' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={activeTab === 'emoji' ? "Search emojis..." : "Search Tenor GIFs..."}
                        value={activeTab === 'emoji' ? search : gifSearch}
                        onChange={e => activeTab === 'emoji' ? setSearch(e.target.value) : setGifSearch(e.target.value)}
                        onKeyDown={handleKeyboardNav}
                        style={{ width: '100%', height: '34px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', paddingLeft: '32px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Content */}
            <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {activeTab === 'emoji' && (() => {
                    let eidx = 0;
                    const focusBorder = '2px solid var(--accent-primary)';
                    return (
                    <div style={{ padding: '8px 0' }}>
                        {/* Frequently Used */}
                        {!searchLower && frequentEmojis.length > 0 && (
                            <div id="emoji-cat-frequent" style={{ padding: '0 12px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--bg-elevated)', padding: '4px 0', zIndex: 1 }}>
                                    <Star size={12} /> Frequently Used
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                                    {frequentEmojis.map((emoji, idx) => {
                                        const gi = eidx++;
                                        return (
                                        <button
                                            key={`freq-${idx}`}
                                            data-emoji-idx={gi}
                                            onClick={() => emoji.startsWith(':') ? handleSelectCustomEmoji(emoji.slice(1, -1)) : handleSelectEmoji(emoji)}
                                            style={{ width: '36px', height: '36px', background: gi === focusedIndex ? 'var(--bg-tertiary)' : 'transparent', border: gi === focusedIndex ? focusBorder : 'none', borderRadius: '6px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, transform 0.1s', transform: gi === focusedIndex ? 'scale(1.15)' : 'scale(1)' }}
                                            className="emoji-grid-item"
                                        >
                                            {emoji.startsWith(':') ? (
                                                (() => {
                                                    const name = emoji.slice(1, -1);
                                                    const match = serverEmojis.find(e => e.name === name);
                                                    return match
                                                        ? <img src={match.url} alt={name} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }} />
                                                        : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emoji}</span>;
                                                })()
                                            ) : emoji}
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Favorites */}
                        {!searchLower && favoriteEmojis.length > 0 && (
                            <div id="emoji-cat-favorites" style={{ padding: '0 12px', marginBottom: '12px' }}>
                                <div
                                    onClick={() => setFavoritesCollapsed(!favoritesCollapsed)}
                                    style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--bg-elevated)', padding: '4px 0', zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                                    <Star size={12} fill="currentColor" /> Favorites
                                    <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 'auto' }}>{favoritesCollapsed ? '+' : '-'}</span>
                                </div>
                                {!favoritesCollapsed && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                                        {favoriteEmojis.map((emoji, idx) => {
                                            const gi = eidx++;
                                            return (
                                            <button
                                                key={`fav-${idx}`}
                                                data-emoji-idx={gi}
                                                onClick={() => emoji.startsWith(':') ? handleSelectCustomEmoji(emoji.slice(1, -1)) : handleSelectEmoji(emoji)}
                                                onContextMenu={(e) => { e.preventDefault(); setFavoriteEmojis(toggleFavoriteEmoji(emoji)); }}
                                                style={{ width: '36px', height: '36px', background: gi === focusedIndex ? 'var(--bg-tertiary)' : 'transparent', border: gi === focusedIndex ? focusBorder : 'none', borderRadius: '6px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, transform 0.1s', position: 'relative', transform: gi === focusedIndex ? 'scale(1.15)' : 'scale(1)' }}
                                                className="emoji-grid-item"
                                                title="Right-click to remove from favorites"
                                            >
                                                {emoji.startsWith(':') ? (
                                                    (() => {
                                                        const name = emoji.slice(1, -1);
                                                        const match = serverEmojis.find(e => e.name === name);
                                                        return match
                                                            ? <img src={match.url} alt={name} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }} />
                                                            : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emoji}</span>;
                                                    })()
                                                ) : emoji}
                                            </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Server Custom Emojis — grouped by category */}
                        {filteredServerEmojis.length > 0 && (() => {
                            // Group server emojis by category
                            const uncategorized = filteredServerEmojis.filter(e => !e.categoryId);
                            const catGroups = emojiCats
                                .map(cat => ({ cat, emojis: filteredServerEmojis.filter(e => e.categoryId === cat.id) }))
                                .filter(g => g.emojis.length > 0);

                            const renderGroup = (label: string, emojis: ServerEmoji[], key: string) => (
                                <div key={key} id={`emoji-cat-server-${key}`} style={{ padding: '0 12px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                                        <Settings size={12} /> {label}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                        {emojis.map(emoji => {
                                            const gi = eidx++;
                                            return (
                                            <button
                                                key={emoji.id}
                                                data-emoji-idx={gi}
                                                onClick={() => handleSelectCustomEmoji(emoji.name)}
                                                style={{ width: '36px', height: '36px', background: gi === focusedIndex ? 'var(--bg-tertiary)' : 'transparent', border: gi === focusedIndex ? focusBorder : 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s', position: 'relative' }}
                                                className="hover-bg-tertiary"
                                                title={`:${emoji.name}:`}
                                            >
                                                <img src={emoji.url} alt={emoji.name} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }} />
                                            </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );

                            return (
                                <>
                                    {uncategorized.length > 0 && renderGroup('Server Emojis', uncategorized, 'uncategorized')}
                                    {catGroups.map(g => renderGroup(g.cat.name, g.emojis, g.cat.id))}
                                </>
                            );
                        })()}

                        {/* Built-in Categories */}
                        {filteredCategories.map(cat => (
                            <div key={cat.id} id={`emoji-cat-${cat.id}`} style={{ padding: '0 12px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--bg-elevated)', padding: '4px 0', zIndex: 1 }}>
                                    {cat.icon && <cat.icon size={12} />} {cat.label}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                                    {cat.emojis.map((emoji, idx) => {
                                        const gi = eidx++;
                                        return (
                                        <button
                                            key={`${cat.id}-${idx}`}
                                            data-emoji-idx={gi}
                                            onClick={() => emoji.startsWith(':') ? handleSelectCustomEmoji(emoji.slice(1, -1)) : handleSelectEmoji(emoji)}
                                            onContextMenu={(e) => { e.preventDefault(); setFavoriteEmojis(toggleFavoriteEmoji(emoji)); }}
                                            style={{ width: '36px', height: '36px', background: gi === focusedIndex ? 'var(--bg-tertiary)' : 'transparent', border: gi === focusedIndex ? focusBorder : 'none', borderRadius: '6px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, transform 0.1s', position: 'relative', transform: gi === focusedIndex ? 'scale(1.15)' : 'scale(1)' }}
                                            className="emoji-grid-item"
                                            title={favoriteEmojis.includes(emoji) ? 'Right-click to unfavorite' : 'Right-click to favorite'}
                                        >
                                            {emoji.startsWith(':') ? (
                                                (() => {
                                                    const name = emoji.slice(1, -1);
                                                    const match = serverEmojis.find(e => e.name === name);
                                                    return match
                                                        ? <img src={match.url} alt={name} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }} />
                                                        : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emoji}</span>;
                                                })()
                                            ) : emoji}
                                            {favoriteEmojis.includes(emoji) && (
                                                <Star size={8} fill="var(--accent-primary)" color="var(--accent-primary)" style={{ position: 'absolute', top: '2px', right: '2px' }} />
                                            )}
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {filteredCategories.length === 0 && filteredServerEmojis.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', padding: '0 20px' }}>
                                <Smile size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                                <p style={{ fontSize: '13px' }}>No emojis found for "{search}"</p>
                            </div>
                        )}
                    </div>
                    );
                })()}

                {activeTab === 'gif' && (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '200px' }}>
                        {gifsLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                                <Loader size={24} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                            </div>
                        )}
                        {!gifsLoading && gifs.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 0' }}>
                                <ImageIcon size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {gifSearch.trim() ? `No GIFs found for "${gifSearch}"` : 'No trending GIFs available'}
                                </p>
                            </div>
                        )}
                        {!gifsLoading && gifs.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {gifs.map(gif => (
                                    <button
                                        key={gif.id}
                                        onClick={() => onSendGif?.(gif.media_formats.gif.url, gif.media_formats.tinygif.url)}
                                        style={{ background: 'transparent', border: 'none', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', padding: 0, transition: 'opacity 0.15s, transform 0.15s' }}
                                        className="gif-grid-item"
                                        title={gif.title || 'GIF'}
                                    >
                                        <img
                                            src={gif.media_formats.tinygif.url}
                                            alt={gif.title || 'GIF'}
                                            loading="lazy"
                                            style={{ width: '100%', display: 'block', borderRadius: '8px', objectFit: 'cover', minHeight: '80px', maxHeight: '160px', background: 'var(--bg-tertiary)' }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                        <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.5 }}>
                            Powered by Tenor
                        </div>
                    </div>
                )}

                {activeTab === 'sticker' && (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '200px' }}>
                        {stickersLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                                <Loader size={24} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                            </div>
                        )}
                        {!stickersLoading && stickers.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 0' }}>
                                <span style={{ fontSize: '32px', opacity: 0.3, marginBottom: '12px' }}>&#127915;</span>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No stickers available</p>
                            </div>
                        )}
                        {!stickersLoading && stickers.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {stickers.map(sticker => (
                                    <button
                                        key={sticker.id}
                                        onClick={() => onStickerSelect?.(sticker)}
                                        style={{ background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '4px', transition: 'background 0.15s' }}
                                        className="hover-bg-tertiary"
                                        title={sticker.name}
                                    >
                                        <img src={sticker.url} alt={sticker.name} loading="lazy" style={{ width: '80px', height: '80px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Category Quick-Jump Bar (emoji tab only) */}
            {activeTab === 'emoji' && !search && (
                <div style={{ height: '36px', borderTop: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: '2px', overflowX: 'auto' }}>
                    {serverEmojis.length > 0 && (
                        <button onClick={() => scrollToCategory('server')} style={{ width: '36px', height: '36px', background: activeCategory === 'server' ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeCategory === 'server' ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.1s' }}
                            className="emoji-cat-btn"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    {categories.filter(c => c.id !== 'recent' || c.emojis.length > 0).map(cat => (
                        <button key={cat.id} onClick={() => scrollToCategory(cat.id)} style={{ width: '36px', height: '36px', background: activeCategory === cat.id ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeCategory === cat.id ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.1s' }}
                            className="emoji-cat-btn"
                        >
                            <cat.icon size={14} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmojiPicker;
