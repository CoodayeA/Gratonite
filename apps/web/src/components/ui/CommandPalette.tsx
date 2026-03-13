import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Hash, MessageSquare, Settings, Users, Command, CornerDownLeft, Globe, User, Clock, Volume2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useDebounce } from '../../hooks/useDebounce';

type CommandItem = {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
    category: string;
    keywords?: string[];
};

type Guild = {
    id: string;
    name: string;
    iconHash: string | null;
    description: string | null;
    memberCount: number;
};

type DmChannel = {
    id: string;
    recipientIds?: string[];
    recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
};

type ChannelCacheEntry = {
    guildId: string;
    channels: Array<{ id: string; name: string; type: string; parentId: string | null; position: number; topic: string | null }>;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    guilds: Guild[];
    dmChannels: DmChannel[];
    onOpenSettings: () => void;
};

const RECENT_ACTIONS_KEY = 'gratonite-cmd-recent';
const MAX_RECENT = 8;

function getRecentActions(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_ACTIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function trackRecentAction(id: string) {
    const recent = getRecentActions().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/** Fuzzy score: higher is better. Returns -1 for no match. */
function fuzzyScore(query: string, text: string): number {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    const idx = t.indexOf(q);
    if (idx >= 0) return 60 - idx;
    // Check if all chars appear in order
    let qi = 0;
    let score = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            score += (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') ? 3 : 1;
            qi++;
        }
    }
    return qi === q.length ? score : -1;
}

function bestScore(query: string, item: CommandItem): number {
    let best = fuzzyScore(query, item.label);
    if (item.description) best = Math.max(best, fuzzyScore(query, item.description) * 0.8);
    if (item.keywords) {
        for (const k of item.keywords) {
            best = Math.max(best, fuzzyScore(query, k) * 0.9);
        }
    }
    return best;
}

const CommandPalette = ({ isOpen, onClose, guilds, dmChannels, onOpenSettings }: Props) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [channelCache, setChannelCache] = useState<ChannelCacheEntry[]>([]);
    const [userResults, setUserResults] = useState<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>([]);
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const [recentActionIds, setRecentActionIds] = useState<string[]>(getRecentActions());
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const debouncedQuery = useDebounce(query, 300);

    // Load channels for all guilds on mount
    useEffect(() => {
        if (!isOpen) return;
        if (channelCache.length > 0) return;

        const loadChannels = async () => {
            const results: ChannelCacheEntry[] = [];
            for (const guild of guilds) {
                try {
                    const channels = await api.channels.getGuildChannels(guild.id);
                    results.push({ guildId: guild.id, channels: channels as any[] });
                } catch {
                    // skip guilds where channel fetch fails
                }
            }
            setChannelCache(results);
        };
        if (guilds.length > 0) loadChannels();
    }, [isOpen, guilds, channelCache.length]);

    // Show loading indicator while debouncing
    useEffect(() => {
        const rawQuery = query.startsWith('>') ? query.slice(1).trim() : query;
        if (rawQuery.trim().length >= 2 && query !== debouncedQuery) setUserSearchLoading(true);
    }, [query, debouncedQuery]);

    // Debounced user search
    useEffect(() => {
        const rawQuery = debouncedQuery.startsWith('>') ? debouncedQuery.slice(1).trim() : debouncedQuery;
        if (!rawQuery.trim() || rawQuery.trim().length < 2) {
            setUserResults([]);
            setUserSearchLoading(false);
            return;
        }
        setUserSearchLoading(true);
        let cancelled = false;
        (async () => {
            try {
                const results = await api.users.searchUsers(rawQuery.trim());
                if (!cancelled) setUserResults(results);
            } catch {
                if (!cancelled) setUserResults([]);
            } finally {
                if (!cancelled) setUserSearchLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedQuery]);

    const wrapAction = useCallback((id: string, action: () => void) => {
        return () => {
            trackRecentAction(id);
            setRecentActionIds(getRecentActions());
            action();
        };
    }, []);

    // Build command list from real data
    const commands: CommandItem[] = useMemo(() => {
        const items: CommandItem[] = [];

        // -- Static navigation --
        items.push({
            id: 'nav-home',
            label: 'Go to Home',
            description: 'Dashboard & quick actions',
            icon: <Globe size={18} />,
            action: wrapAction('nav-home', () => { navigate('/'); onClose(); }),
            category: 'Navigation',
            keywords: ['home', 'dashboard'],
        });
        items.push({
            id: 'nav-friends',
            label: 'Friends',
            description: 'View friends & pending requests',
            icon: <Users size={18} />,
            action: wrapAction('nav-friends', () => { navigate('/friends'); onClose(); }),
            category: 'Navigation',
            keywords: ['friends', 'people'],
        });
        items.push({
            id: 'nav-discover',
            label: 'Discover',
            description: 'Explore servers',
            icon: <Globe size={18} />,
            action: wrapAction('nav-discover', () => { navigate('/discover'); onClose(); }),
            category: 'Navigation',
            keywords: ['discover', 'explore', 'browse'],
        });

        // -- Settings --
        items.push({
            id: 'settings',
            label: 'Open Settings',
            description: 'Customize your experience',
            icon: <Settings size={18} />,
            action: wrapAction('settings', () => { onOpenSettings(); onClose(); }),
            category: 'Settings',
            keywords: ['settings', 'preferences', 'config', 'account', 'profile', 'privacy', 'appearance'],
        });

        // -- Guilds --
        for (const guild of guilds) {
            const guildChannelEntry = channelCache.find(c => c.guildId === guild.id);
            const defaultChannel = guildChannelEntry?.channels.find(c => c.type === 'text' || c.type === 'TEXT');
            const targetPath = defaultChannel
                ? `/guild/${guild.id}/channel/${defaultChannel.id}`
                : `/guild/${guild.id}`;

            items.push({
                id: `guild-${guild.id}`,
                label: guild.name,
                description: guild.description || `${guild.memberCount} members`,
                icon: <Users size={18} />,
                action: wrapAction(`guild-${guild.id}`, () => { navigate(targetPath); onClose(); }),
                category: 'Servers',
                keywords: [guild.name.toLowerCase()],
            });
        }

        // -- Channels (from all guilds) --
        for (const entry of channelCache) {
            const guild = guilds.find(g => g.id === entry.guildId);
            if (!guild) continue;
            for (const channel of entry.channels) {
                const isVoice = channel.type === 'voice' || channel.type === 'GUILD_VOICE';
                const isText = channel.type === 'text' || channel.type === 'TEXT';
                if (!isText && !isVoice) continue;
                items.push({
                    id: `channel-${channel.id}`,
                    label: isVoice ? `${channel.name}` : `#${channel.name}`,
                    description: `in ${guild.name}`,
                    icon: isVoice ? <Volume2 size={18} /> : <Hash size={18} />,
                    action: wrapAction(`channel-${channel.id}`, () => {
                        const prefix = isVoice ? 'voice' : 'channel';
                        navigate(`/guild/${guild.id}/${prefix}/${channel.id}`);
                        onClose();
                    }),
                    category: 'Channels',
                    keywords: [channel.name.toLowerCase(), guild.name.toLowerCase()],
                });
            }
        }

        // -- DM Channels --
        for (const dm of dmChannels) {
            const recipient = dm.recipients?.[0];
            if (!recipient) continue;
            const displayName = recipient.displayName || recipient.username;
            items.push({
                id: `dm-${dm.id}`,
                label: displayName,
                description: `@${recipient.username}`,
                icon: <MessageSquare size={18} />,
                action: wrapAction(`dm-${dm.id}`, () => { navigate(`/dm/${dm.id}`); onClose(); }),
                category: 'Members',
                keywords: [recipient.username.toLowerCase(), displayName.toLowerCase()],
            });
        }

        // -- User search results (dynamic) --
        for (const user of userResults) {
            if (dmChannels.some(dm => dm.recipients?.some(r => r.id === user.id))) continue;
            items.push({
                id: `user-${user.id}`,
                label: user.displayName || user.username,
                description: `@${user.username}`,
                icon: <User size={18} />,
                action: wrapAction(`user-${user.id}`, async () => {
                    try {
                        const dmChannel = await api.relationships.openDm(user.id);
                        navigate(`/dm/${dmChannel.id}`);
                    } catch {
                        navigate('/friends');
                    }
                    onClose();
                }),
                category: 'Members',
                keywords: [user.username.toLowerCase(), (user.displayName || '').toLowerCase()],
            });
        }

        return items;
    }, [guilds, channelCache, dmChannels, userResults, navigate, onClose, onOpenSettings, wrapAction]);

    // Parse type filter prefix
    const typeFilter = query.startsWith('>') ? query.slice(1).split(' ')[0]?.toLowerCase() : null;
    const searchQuery = typeFilter ? query.slice(1 + (query.slice(1).split(' ')[0]?.length || 0)).trim() : query.trim();

    const filteredCommands = useMemo(() => {
        let pool = commands;

        // Apply type filter
        if (typeFilter) {
            const filterMap: Record<string, string[]> = {
                'channel': ['Channels'],
                'channels': ['Channels'],
                'member': ['Members'],
                'members': ['Members'],
                'user': ['Members'],
                'users': ['Members'],
                'server': ['Servers'],
                'servers': ['Servers'],
                'setting': ['Settings'],
                'settings': ['Settings'],
                'nav': ['Navigation'],
                'navigation': ['Navigation'],
            };
            const categories = filterMap[typeFilter];
            if (categories) {
                pool = pool.filter(cmd => categories.includes(cmd.category));
            }
        }

        if (!searchQuery) return pool;

        // Fuzzy search with scoring
        const scored = pool
            .map(cmd => ({ cmd, score: bestScore(searchQuery, cmd) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        return scored.map(({ cmd }) => cmd);
    }, [commands, typeFilter, searchQuery]);

    // Build recent actions section
    const recentItems = useMemo(() => {
        if (query.trim()) return [];
        return recentActionIds
            .map(id => commands.find(c => c.id === id))
            .filter((c): c is CommandItem => !!c)
            .slice(0, 5);
    }, [recentActionIds, commands, query]);

    // Group by category, with recent actions on top
    const grouped = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        if (recentItems.length > 0) {
            groups['Recent Actions'] = recentItems;
        }
        for (const cmd of filteredCommands) {
            // Skip items already in recent
            if (recentItems.some(r => r.id === cmd.id) && !query.trim()) continue;
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        }
        return groups;
    }, [filteredCommands, recentItems, query]);

    const flatList = useMemo(() => {
        const flat: CommandItem[] = [];
        for (const items of Object.values(grouped)) {
            flat.push(...items);
        }
        return flat;
    }, [grouped]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setUserResults([]);
            setRecentActionIds(getRecentActions());
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, flatList.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatList[selectedIndex]) {
                flatList[selectedIndex].action();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [flatList, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (!isOpen) return null;

    let flatIndex = -1;

    // Category icons
    const categoryIcons: Record<string, React.ReactNode> = {
        'Recent Actions': <Clock size={12} />,
        'Channels': <Hash size={12} />,
        'Members': <User size={12} />,
        'Servers': <Users size={12} />,
        'Settings': <Settings size={12} />,
        'Navigation': <Globe size={12} />,
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: '20vh',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Backdrop */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                animation: 'fadeIn 0.15s ease-out'
            }} />

            {/* Palette */}
            <div
                style={{
                    position: 'relative', width: '100%', maxWidth: '580px',
                    background: 'var(--bg-elevated)',
                    border: '3px solid #000000',
                    boxShadow: '8px 8px 0 #000000',
                    borderRadius: '0px',
                    overflow: 'hidden',
                    animation: 'commandSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onKeyDown={handleKeyDown}
            >
                {/* Search Input */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '16px 20px',
                    borderBottom: '3px solid #000000',
                    background: 'var(--bg-channel)',
                }}>
                    <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='Search servers, channels, users... (prefix ">" to filter by type)'
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: '16px', fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                        }}
                    />
                    <kbd style={{
                        padding: '2px 8px', fontSize: '11px', fontWeight: 700,
                        background: 'var(--bg-tertiary)', border: '2px solid #000000',
                        color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                    }}>ESC</kbd>
                </div>

                {/* Type filter hints */}
                {query === '>' && (
                    <div style={{ padding: '8px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--stroke)' }}>
                        {['channel', 'member', 'server', 'settings', 'nav'].map(t => (
                            <button
                                key={t}
                                onClick={() => setQuery(`>${t} `)}
                                style={{
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    borderRadius: '4px', padding: '3px 8px', fontSize: '11px',
                                    fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
                                }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}

                {/* Results */}
                <div ref={listRef} style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px 0' }}>
                    {Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                            <div style={{
                                padding: '8px 20px 4px',
                                fontSize: '11px', fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                                color: 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                {categoryIcons[category]}
                                {category}
                            </div>

                            {items.map((cmd) => {
                                flatIndex++;
                                const idx = flatIndex;
                                const isSelected = idx === selectedIndex;
                                return (
                                    <div
                                        key={cmd.id}
                                        data-index={idx}
                                        onClick={() => cmd.action()}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '10px 20px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                            color: isSelected ? '#000000' : 'var(--text-primary)',
                                            transition: 'background 0.08s ease',
                                        }}
                                    >
                                        <div style={{
                                            width: '32px', height: '32px', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            background: isSelected ? 'rgba(0,0,0,0.1)' : 'var(--bg-tertiary)',
                                            border: '2px solid #000000',
                                            flexShrink: 0,
                                        }}>
                                            {cmd.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{cmd.label}</div>
                                            {cmd.description && (
                                                <div style={{
                                                    fontSize: '12px', fontWeight: 400,
                                                    color: isSelected ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>{cmd.description}</div>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                                                <CornerDownLeft size={14} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {flatList.length === 0 && (
                        <div style={{
                            padding: '32px 20px', textAlign: 'center',
                            color: 'var(--text-muted)', fontSize: '14px',
                        }}>
                            {userSearchLoading ? 'Searching...' : (
                                <div>
                                    <div>No results for "{query}"</div>
                                    <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                                        {'Try: >channel, >member, >server, or >settings'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '10px 20px', borderTop: '3px solid #000000',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600,
                    background: 'var(--bg-channel)',
                }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <kbd style={{ padding: '1px 4px', border: '1px solid var(--stroke)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>↑↓</kbd> Navigate
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <kbd style={{ padding: '1px 4px', border: '1px solid var(--stroke)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>↵</kbd> Select
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <kbd style={{ padding: '1px 4px', border: '1px solid var(--stroke)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>&gt;</kbd> Filter
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Command size={12} /> <span>K</span>
                    </div>
                </div>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes commandSlideIn {
                    from { opacity: 0; transform: translateY(-20px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default CommandPalette;
