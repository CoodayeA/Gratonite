import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Clock, Smile, Image as ImageIcon, Heart, ThumbsUp, Coffee, Flag, Lightbulb, Cat, Car, Settings, Loader } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { api, API_BASE } from '../../lib/api';

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

// ─── GIF Support (Tenor API v2) ──────────────────────────────────────────────

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';

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
        setLoading(true);
        const endpoint = query.trim()
            ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=gratonite&limit=20`
            : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=gratonite&limit=20`;
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
}

// ─── Component ────────────────────────────────────────────────────────────────
const EmojiPicker = ({ onSelectEmoji, onSendGif, guildId }: {
    onSelectEmoji: (emoji: string) => void;
    onSendGif?: (url: string, previewUrl: string) => void;
    guildId?: string | null;
}) => {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
    const [activeCategory, setActiveCategory] = useState('recent');
    const [recentEmojis, setRecentEmojis] = useState<string[]>(getRecentEmojis());
    const [serverEmojis, setServerEmojis] = useState<ServerEmoji[]>([]);
    const [gifSearch, setGifSearch] = useState('');
    const { gifs, loading: gifsLoading } = useTenorGifs(activeTab === 'gif' ? gifSearch : '');
    const contentRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Fetch server custom emojis
    useEffect(() => {
        if (!guildId) return;
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setServerEmojis(emojis.map(e => ({
                id: e.id,
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : `https://placehold.co/32/526df5/FFF?text=${e.name.charAt(0).toUpperCase()}`,
                animated: e.animated ?? false,
            })));
        }).catch(() => { addToast({ title: 'Failed to load server emojis', variant: 'error' }); });
    }, [guildId]);

    // Focus search on open
    useEffect(() => {
        setTimeout(() => searchRef.current?.focus(), 100);
    }, []);

    const handleSelectEmoji = (emoji: string) => {
        addRecentEmoji(emoji);
        setRecentEmojis(getRecentEmojis());
        onSelectEmoji(emoji);
    };

    const handleSelectCustomEmoji = (name: string) => {
        const emojiStr = `:${name}:`;
        addRecentEmoji(emojiStr);
        setRecentEmojis(getRecentEmojis());
        onSelectEmoji(emojiStr);
    };

    // Build categories with recent emojis populated
    const categories = builtInCategories.map(cat => {
        if (cat.id === 'recent') return { ...cat, emojis: recentEmojis };
        return cat;
    });

    // Filter emojis by search
    const searchLower = search.toLowerCase().trim();
    const filteredCategories = searchLower
        ? categories.map(cat => ({
            ...cat,
            emojis: cat.emojis.filter(e => e.toLowerCase().includes(searchLower)),
        })).filter(cat => cat.emojis.length > 0)
        : categories.filter(cat => cat.id !== 'recent' || cat.emojis.length > 0);

    const filteredServerEmojis = searchLower
        ? serverEmojis.filter(e => e.name.toLowerCase().includes(searchLower))
        : serverEmojis;


    // Scroll to category
    const scrollToCategory = (catId: string) => {
        setActiveCategory(catId);
        const el = document.getElementById(`emoji-cat-${catId}`);
        if (el && contentRef.current) {
            contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 8, behavior: 'smooth' });
        }
    };

    return (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '0', width: '400px', height: '460px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 100, animation: 'scaleIn 0.2s ease-out' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                <button onClick={() => setActiveTab('emoji')} style={{ background: activeTab === 'emoji' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeTab === 'emoji' ? 'var(--text-primary)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    <Smile size={15} /> Emoji
                </button>
                <button onClick={() => setActiveTab('gif')} style={{ background: activeTab === 'gif' ? 'var(--bg-elevated)' : 'transparent', border: 'none', color: activeTab === 'gif' ? 'var(--text-primary)' : 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    <ImageIcon size={15} /> GIFs
                </button>
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
                        style={{ width: '100%', height: '34px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', paddingLeft: '32px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Content */}
            <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {activeTab === 'emoji' && (
                    <div style={{ padding: '8px 0' }}>
                        {/* Server Custom Emojis */}
                        {filteredServerEmojis.length > 0 && (
                            <div id="emoji-cat-server" style={{ padding: '0 12px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                                    <Settings size={12} /> Server Emojis
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                    {filteredServerEmojis.map(emoji => (
                                        <button
                                            key={emoji.id}
                                            onClick={() => handleSelectCustomEmoji(emoji.name)}
                                            style={{ width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s', position: 'relative' }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                            title={`:${emoji.name}:`}
                                        >
                                            <img src={emoji.url} alt={emoji.name} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'contain' }} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Built-in Categories */}
                        {filteredCategories.map(cat => (
                            <div key={cat.id} id={`emoji-cat-${cat.id}`} style={{ padding: '0 12px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--bg-elevated)', padding: '4px 0', zIndex: 1 }}>
                                    {cat.icon && <cat.icon size={12} />} {cat.label}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                                    {cat.emojis.map((emoji, idx) => (
                                        <button
                                            key={`${cat.id}-${idx}`}
                                            onClick={() => handleSelectEmoji(emoji)}
                                            style={{ width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '6px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, transform 0.1s' }}
                                            onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
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
                )}

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
                                        onMouseOver={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(0.97)'; }}
                                        onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
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
            </div>

            {/* Bottom Category Quick-Jump Bar (emoji tab only) */}
            {activeTab === 'emoji' && !search && (
                <div style={{ height: '36px', borderTop: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: '2px', overflowX: 'auto' }}>
                    {serverEmojis.length > 0 && (
                        <button onClick={() => scrollToCategory('server')} style={{ width: '30px', height: '28px', background: activeCategory === 'server' ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeCategory === 'server' ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.1s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                            onMouseOut={e => { if (activeCategory !== 'server') e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    {categories.filter(c => c.id !== 'recent' || c.emojis.length > 0).map(cat => (
                        <button key={cat.id} onClick={() => scrollToCategory(cat.id)} style={{ width: '30px', height: '28px', background: activeCategory === cat.id ? 'var(--bg-elevated)' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeCategory === cat.id ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.1s' }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                            onMouseOut={e => { if (activeCategory !== cat.id) e.currentTarget.style.background = 'transparent'; }}
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
