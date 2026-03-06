import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, Bot, Palette, Star, Users, ArrowRight, X, Shield, MessageSquare, Globe } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { useTheme, AppTheme } from '../../components/ui/ThemeProvider';
import { api, API_BASE } from '../../lib/api';

type Tab = 'portals' | 'bots' | 'themes';

type PortalInfo = {
    id: string;
    name: string;
    description: string;
    bannerUrl: string | null;
    iconHash: string | null;
    members: number;
    online: number;
    tags: string[];
    category: string | null;
    verified: boolean;
    featured: boolean;
    isPinned: boolean;
    isPublic: boolean;
    mutualFriends: { name: string; avatar: string }[];
};

const CATEGORIES = [
    { id: '', label: 'All' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'music', label: 'Music' },
    { id: 'art', label: 'Art' },
    { id: 'tech', label: 'Tech' },
    { id: 'community', label: 'Community' },
    { id: 'anime', label: 'Anime' },
    { id: 'education', label: 'Education' },
    { id: 'other', label: 'Other' },
];

const initialPortals: PortalInfo[] = [];
const SUPPORTED_THEMES: AppTheme[] = ['default', 'glass', 'neobrutalism', 'synthwave', 'y2k', 'memphis', 'artdeco', 'terminal', 'aurora', 'vaporwave', 'nord', 'solarized', 'bubblegum', 'obsidian', 'sakura', 'midnight', 'forest'];

// Portal Check-in Modal
const PortalCheckinModal = ({ portal, onClose }: { portal: PortalInfo; onClose: () => void }) => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);

    const handleJoin = async () => {
        setJoining(true);
        try {
            await api.guilds.join(portal.id);
            setJoined(true);
            addToast({ title: `Joined ${portal.name}!`, description: 'Welcome to the community.', variant: 'success' });
            navigate(`/guild/${portal.id}`);
        } catch {
            addToast({ title: 'Could not join', description: 'This portal may require an invite or no longer be available.', variant: 'error' });
        } finally {
            setJoining(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }} onClick={onClose}>
            <div style={{ width: '520px', background: 'var(--bg-elevated)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--stroke)', boxShadow: '0 32px 64px rgba(0,0,0,0.6)', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }} onClick={e => e.stopPropagation()}>
                {/* Banner */}
                <div
                    style={{
                        height: '180px',
                        position: 'relative',
                        background: portal.bannerUrl
                            ? `url(${portal.bannerUrl}) center/cover`
                            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.3))',
                    }}
                >
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                        <X size={16} />
                    </button>
                    {portal.verified && (
                        <div style={{ position: 'absolute', top: 16, left: 16, background: 'var(--accent-primary)', borderRadius: '20px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'white' }}>
                            <Shield size={12} /> Verified
                        </div>
                    )}
                    {/* Portal icon */}
                    <div style={{ position: 'absolute', bottom: -28, left: 24, width: '56px', height: '56px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '3px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        {portal.iconHash ? (
                            <img src={`${API_BASE}/files/${portal.iconHash}`} alt={portal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            portal.name.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '40px 28px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{portal.name}</h2>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {portal.tags.map(tag => (
                                <span key={tag} style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>{portal.description}</p>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{portal.members.toLocaleString()}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> Members</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--stroke)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{portal.mutualFriends.length}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare size={12} /> Mutual Friends</span>
                        </div>
                    </div>

                    {/* Mutual friends */}
                    {portal.mutualFriends.length > 0 && (
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--stroke)' }}>
                            <div style={{ display: 'flex' }}>
                                {portal.mutualFriends.map((f, i) => (
                                    <div key={f.name} style={{ width: '28px', height: '28px', borderRadius: '50%', background: f.avatar, border: '2px solid var(--bg-tertiary)', marginLeft: i === 0 ? 0 : '-8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                                        {f.name[0].toUpperCase()}
                                    </div>
                                ))}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{portal.mutualFriends.map(f => f.name).join(' and ')}</strong> {portal.mutualFriends.length === 1 ? 'is' : 'are'} already in this portal
                            </span>
                        </div>
                    )}

                    {/* Public indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                        <Globe size={14} /> {portal.isPublic ? 'Public portal — anyone can join' : 'Limited visibility portal'}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
                        <button
                            onClick={handleJoin}
                            disabled={joining || joined}
                            style={{ flex: 2, padding: '12px', borderRadius: '10px', background: joined ? '#10b981' : 'var(--accent-primary)', border: 'none', color: '#000', cursor: joining || joined ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', transition: 'background 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {joined ? '✓ Joined!' : joining ? 'Joining...' : `Join ${portal.name}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Discover = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('portals');
    const [portalView, setPortalView] = useState<'all' | 'featured'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [joiningPortal, setJoiningPortal] = useState<PortalInfo | null>(null);
    const [portals, setPortals] = useState<PortalInfo[]>(initialPortals);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [tagFilters, setTagFilters] = useState<string[]>([]);
    const [tagInputValue, setTagInputValue] = useState('');
    const [sortOption, setSortOption] = useState<'members' | 'activity' | 'trending'>('members');
    const [_discoverBots, setDiscoverBots] = useState<any[]>([]);
    const [_discoverThemes, setDiscoverThemes] = useState<any[]>([]);
    const { addToast } = useToast();
    const { setTheme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    useEffect(() => {
        api.get<string[]>('/guilds/tags').then(tags => {
            if (Array.isArray(tags)) setAvailableTags(tags);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        Promise.allSettled([
        api.botStore.list({ limit: 20 }).then(res => {
            const items: any[] = Array.isArray(res) ? res : (res as any).items ?? [];
            setDiscoverBots(items);
        }).catch(() => {
            addToast({ title: 'Failed to load bots', description: 'Could not fetch bot listings.', variant: 'error' });
        }),

        api.themes.browse().then(items => {
            setDiscoverThemes(Array.isArray(items) ? items : []);
        }).catch(() => {
            addToast({ title: 'Failed to load themes', description: 'Could not fetch available themes.', variant: 'error' });
        }),
        ]);
    }, []);

    useEffect(() => {
        if (activeTab !== 'portals') return;
        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const rawQuery = searchQuery.trim();
                const hashtag = rawQuery.startsWith('#') ? rawQuery.slice(1) : undefined;
                const textQuery = rawQuery.startsWith('#') ? '' : rawQuery;
                const fetchAllDiscoverableGuilds = async () => {
                    const pageSize = 100;
                    const maxPages = 10;
                    const allGuilds: Awaited<ReturnType<typeof api.guilds.discover>> = [];
                    let offset = 0;
                    for (let page = 0; page < maxPages; page += 1) {
                        const batch = await api.guilds.discover({
                            q: textQuery || undefined,
                            hashtag: hashtag || undefined,
                            featured: portalView === 'featured' ? true : undefined,
                            category: selectedCategory || undefined,
                            tag: tagFilters.length > 0 ? tagFilters[0] : undefined,
                            sort: sortOption,
                            limit: pageSize,
                            offset,
                        });
                        if (batch.length === 0) break;
                        allGuilds.push(...batch);
                        if (batch.length < pageSize) break;
                        offset += pageSize;
                    }
                    return allGuilds;
                };

                const guilds = await fetchAllDiscoverableGuilds();

                const mapped: PortalInfo[] = guilds.map((g) => ({
                    id: g.id,
                    name: g.name,
                    description: g.description ?? '',
                    bannerUrl: g.bannerHash ? `${API_BASE}/files/${g.bannerHash}` : null,
                    iconHash: g.iconHash ?? null,
                    members: g.memberCount,
                    online: 0,
                    tags: g.tags ?? [],
                    category: g.category ?? null,
                    verified: Boolean((g as any).verified),
                    featured: Boolean(g.featured),
                    isPinned: Boolean(g.isPinned),
                    isPublic: g.isPublic !== false,
                    mutualFriends: [],
                }));

                mapped.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                    if (a.featured !== b.featured) return a.featured ? -1 : 1;
                    return b.members - a.members;
                });

                setPortals(mapped);
            } catch {
                addToast({ title: 'Failed to load communities', description: 'Could not fetch discoverable portals.', variant: 'error' });
            } finally {
                setIsLoading(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [activeTab, addToast, portalView, searchQuery, selectedCategory, tagFilters, sortOption]);

    const renderTabs = () => (
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--stroke)', marginBottom: '32px' }}>
            <button
                onClick={() => setActiveTab('portals')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'portals' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'portals' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Compass size={18} /> Portals
            </button>
            <button
                onClick={() => setActiveTab('bots')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'bots' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'bots' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Bot size={18} /> Bots & Integrations
            </button>
            <button
                onClick={() => setActiveTab('themes')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'themes' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'themes' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Palette size={18} /> Themes
            </button>
        </div>
    );

    const addTagFilter = (tag: string) => {
        const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean && !tagFilters.includes(clean)) {
            setTagFilters(prev => [...prev, clean]);
        }
        setTagInputValue('');
    };

    const renderPortals = () => (
        <>
            {/* Filter bar */}
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Category buttons */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Category:</span>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            style={{
                                borderRadius: '999px',
                                border: '1px solid var(--stroke)',
                                padding: '5px 12px',
                                background: selectedCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: selectedCategory === cat.id ? '#111' : 'var(--text-secondary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Popular tags */}
                {availableTags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Tags:</span>
                        {availableTags.slice(0, 12).map(tag => (
                            <button
                                key={tag}
                                onClick={() => {
                                    if (tagFilters.includes(tag)) {
                                        setTagFilters(prev => prev.filter(t => t !== tag));
                                    } else {
                                        setTagFilters(prev => [...prev, tag]);
                                    }
                                }}
                                style={{
                                    borderRadius: '999px',
                                    border: tagFilters.includes(tag) ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                    padding: '4px 10px',
                                    background: tagFilters.includes(tag) ? 'rgba(82,109,245,0.15)' : 'var(--bg-tertiary)',
                                    color: tagFilters.includes(tag) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sort + tag filter row */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as any)}
                        style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                    >
                        <option value="members">Most Members</option>
                        <option value="activity">Active</option>
                        <option value="trending">Trending</option>
                    </select>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
                        <input
                            type="text"
                            value={tagInputValue}
                            onChange={e => setTagInputValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && tagInputValue) { e.preventDefault(); addTagFilter(tagInputValue); } }}
                            placeholder="Filter by tag..."
                            style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '140px' }}
                        />
                        {tagFilters.map(tag => (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'rgba(82,109,245,0.15)', border: '1px solid var(--accent-primary)', borderRadius: '999px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                #{tag}
                                <button onClick={() => setTagFilters(prev => prev.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-primary)', fontSize: '14px', lineHeight: 1 }}>×</button>
                            </span>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        <button
                            onClick={() => setPortalView('all')}
                            style={{
                                borderRadius: '999px', border: '1px solid var(--stroke)', padding: '5px 12px',
                                background: portalView === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: portalView === 'all' ? '#111' : 'var(--text-secondary)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >All</button>
                        <button
                            onClick={() => setPortalView('featured')}
                            style={{
                                borderRadius: '999px', border: '1px solid var(--stroke)', padding: '5px 12px',
                                background: portalView === 'featured' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: portalView === 'featured' ? '#111' : 'var(--text-secondary)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <Star size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />Featured
                        </button>
                    </div>
                </div>
            </div>

            {portals.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <Compass size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No communities to discover yet</p>
                    <p style={{ fontSize: '13px' }}>Public portals will appear here as the community grows.</p>
                </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '40px' }}>
                {portals.map(portal => (
                    <div key={portal.id} className="portal-card hover-lift" onClick={() => setJoiningPortal(portal)} style={{ width: '300px', flex: '0 0 auto', cursor: 'pointer' }}>
                        <div
                            style={{
                                height: '140px',
                                position: 'relative',
                                background: portal.bannerUrl
                                    ? `url(${portal.bannerUrl}) center/cover`
                                    : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.3))',
                            }}
                        >
                            <div style={{ position: 'absolute', bottom: '-20px', left: '16px', width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid var(--stroke)', fontSize: '18px', overflow: 'hidden' }}>
                                {portal.iconHash ? (
                                    <img src={`${API_BASE}/files/${portal.iconHash}`} alt={portal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    portal.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            {portal.isPinned && (
                                <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                                    PINNED
                                </div>
                            )}
                            {portal.category && (
                                <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(82,109,245,0.8)', color: '#fff', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {portal.category}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '28px 16px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '16px', fontWeight: 600 }}>{portal.name}</div>
                                {portal.verified && <Shield size={14} color="var(--accent-primary)" />}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {portal.description}
                            </div>
                            {portal.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {portal.tags.slice(0, 3).map(tag => (
                                        <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '999px', color: 'var(--text-muted)' }}>#{tag}</span>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Users size={12} /> {portal.members.toLocaleString()} members
                                </span>
                                <span style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-primary)', color: '#111', fontWeight: 600, borderRadius: '8px' }}>Join</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    const botNames: string[] = _discoverBots.map((bot: any) => bot.name || 'Unnamed Bot');
    const botEmojis: string[] = _discoverBots.map(() => '🤖');
    const botDescs: string[] = _discoverBots.map((bot: any) => bot.shortDescription || bot.description || 'No description provided.');
    const botPortalCounts: string[] = _discoverBots.map((bot: any) => String(bot.installCount ?? bot.guildCount ?? 0));

    const renderBots = () => (
        <>
            {filteredBotIndices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No bots available yet</p>
                    <p style={{ fontSize: '13px' }}>Bots and integrations will appear here as developers build them.</p>
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {filteredBotIndices.map((i) => ({ bot: botNames[i], i })).map(({ bot, i }) => (
                    <div key={i} className="portal-card hover-lift" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '20px', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--bg-tertiary), rgba(255,255,255,0.05))', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                    {botEmojis[i]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{bot}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        by <span style={{ color: 'var(--accent-primary)' }}>{_discoverBots[i]?.creatorName || _discoverBots[i]?.developerName || 'Verified Creator'}</span>
                                    </p>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Verified</div>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                                {botDescs[i]}
                            </p>
                        </div>
                        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In {botPortalCounts[i]} Portals</span>
                            <button onClick={() => navigate('/bot-store')} className="auth-button" style={{ marginTop: 0, padding: '6px 16px', height: 'auto', width: 'auto', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white' }}>
                                View in Bot Store
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bot size={20} color="var(--accent-primary)" /> Create Your Own Bot
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Build custom commands, set permissions, and publish to the Bot Store.</p>
                </div>
                <button
                    className="auth-button"
                    onClick={() => navigate('/bot-builder')}
                    style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    Bot Builder <ArrowRight size={16} />
                </button>
            </div>
        </>
    );

    const allThemes = (_discoverThemes ?? [])
        .map((theme: any) => {
            const id = String(theme.id || '').trim();
            const normalizedId = (SUPPORTED_THEMES.includes(id as AppTheme) ? (id as AppTheme) : 'default');
            const base = theme.variables || theme.vars || {};
            const bg = base['--bg-app'] || base['background'] || theme.previewBackground || '#111214';
            const accent = base['--accent-primary'] || theme.accent || '#5865f2';
            const tags = Array.isArray(theme.tags) && theme.tags.length > 0 ? theme.tags : ['Community'];
            return {
                id: normalizedId,
                name: theme.name || normalizedId,
                bg,
                accent,
                tags,
                live: true,
            };
        });

    const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

    const q = searchQuery.toLowerCase().trim();
    const filteredBotIndices = q ? botNames.map((b, i) => ({ b, i })).filter(({ b }) => b.toLowerCase().includes(q)).map(({ i }) => i) : botNames.map((_, i) => i);
    const filteredThemes = q ? allThemes.filter(t => t.name.toLowerCase().includes(q) || t.tags.some((tag: string) => tag.toLowerCase().includes(q))) : allThemes;

    const renderThemes = () => (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Click any theme to instantly apply it.</p>
            </div>
            {filteredThemes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No themes match "{searchQuery}"</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {filteredThemes.map((theme) => (
                    <div key={theme.id}
                        onMouseEnter={() => setHoveredTheme(theme.id)}
                        onMouseLeave={() => setHoveredTheme(null)}
                        className="portal-card"
                        style={{ padding: '12px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', transform: hoveredTheme === theme.id ? 'translateY(-4px)' : 'none', boxShadow: hoveredTheme === theme.id ? '0 8px 24px rgba(0,0,0,0.3)' : 'none' }}
                        onClick={() => {
                            setTheme(theme.id as AppTheme);
                            addToast({ title: `"${theme.name}" Applied`, description: 'Your theme has been updated!', variant: 'success' });
                        }}
                    >
                        {/* Theme preview card */}
                        <div style={{ height: '110px', background: theme.bg, borderRadius: 'var(--radius-sm)', marginBottom: '12px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {/* Fake sidebar */}
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '28px', background: 'rgba(0,0,0,0.3)' }} />
                            {/* Fake chat bubbles */}
                            <div style={{ position: 'absolute', left: 36, top: 12, right: 12, height: '12px', background: theme.accent, borderRadius: '6px', opacity: 0.9 }} />
                            <div style={{ position: 'absolute', left: 36, top: 30, right: 28, height: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px' }} />
                            <div style={{ position: 'absolute', left: 36, top: 46, right: 40, height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }} />
                            {/* Fake input */}
                            <div style={{ position: 'absolute', left: 36, bottom: 10, right: 12, height: '18px', background: 'rgba(0,0,0,0.3)', borderRadius: '9px', border: `1px solid ${theme.accent}40` }} />
                            {/* Live indicator */}
                            {hoveredTheme === theme.id && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', background: theme.accent, padding: '6px 16px', borderRadius: '20px' }}>Apply Theme</span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{theme.name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {theme.tags.map((tag: string) => (
                                <span key={tag} style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-secondary)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Palette size={20} color="var(--accent-primary)" /> Create Your Own Theme
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Use the Gratonite Theme Engine to build custom CSS layouts and dynamic backgrounds.</p>
                </div>
                <button
                    className="auth-button"
                    onClick={() => navigate('/theme-builder')}
                    style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    Theme Builder <ArrowRight size={16} />
                </button>
            </div>
        </>
    );

    return (
        <>
            <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Discover</h1>
                    <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '32px' }}>Find communities, bots, and themes to enhance your experience.</p>

                    <div style={{ position: 'relative', marginBottom: '32px' }}>
                        <Search size={20} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', height: '48px', paddingLeft: '48px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px' }}
                            placeholder={`Search for ${activeTab}...`}
                        />
                    </div>

                    {renderTabs()}

                    <div className="discover-content">
                        {isLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px', flexDirection: 'column' }}>
                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                <div style={{ width: '32px', height: '32px', border: '3px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '14px' }}>Loading...</span>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'portals' && renderPortals()}
                                {activeTab === 'bots' && renderBots()}
                                {activeTab === 'themes' && renderThemes()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {joiningPortal && (
                <PortalCheckinModal portal={joiningPortal} onClose={() => setJoiningPortal(null)} />
            )}
        </>
    );
};

export default Discover;
