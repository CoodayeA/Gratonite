/**
 * ForumView.tsx — Visual grid/card view for GUILD_FORUM channels.
 * Posts display as cards with colorful gradient thumbnails, tags, reply counts.
 * Supports grid (default) and list view modes.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    MessageSquare, CheckCircle, Clock, Plus, ChevronDown, Search,
    Loader2, X, LayoutGrid, List, Lock, ThumbsUp, Tag,
} from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';

type ForumTag = { id: string; name: string; color?: string };
type ForumThread = {
    id: string;
    name: string;
    messageCount?: number;
    createdAt: string;
    lastMessageAt?: string;
    authorId?: string;
    authorName?: string;
    authorAvatarHash?: string | null;
    tags?: string[];
    solved?: boolean;
    locked?: boolean;
};

type SortMode = 'latest' | 'oldest' | 'most-replies';
type ViewMode = 'grid' | 'list';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

/** Derive a visually distinct gradient from a string */
function threadGradient(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40 + (Math.abs(hash >> 8) % 60)) % 360;
    return `linear-gradient(135deg, hsl(${h1},60%,28%) 0%, hsl(${h2},55%,18%) 100%)`;
}

/** One or two initials from a thread name */
function threadInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export default function ForumView({
    channelId,
    channelName,
    forumTags = [],
    onOpenThread,
}: {
    channelId: string;
    channelName: string;
    forumTags: ForumTag[];
    onOpenThread: (threadId: string) => void;
}) {
    const [threads, setThreads] = useState<ForumThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<SortMode>('latest');
    const [sortOpen, setSortOpen] = useState(false);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.threads.list(channelId);
            const mapped: ForumThread[] = (Array.isArray(data) ? data : []).map((t: any) => ({
                id: t.id,
                name: t.name || t.title || 'Untitled',
                messageCount: t.messageCount ?? t.replyCount ?? 0,
                createdAt: t.createdAt,
                lastMessageAt: t.lastMessageAt || t.updatedAt || t.createdAt,
                authorId: t.authorId || t.creatorId,
                authorName: t.authorName || t.creatorName || t.author?.displayName || t.author?.username || 'Unknown',
                authorAvatarHash: t.authorAvatarHash || t.creatorAvatarHash || t.author?.avatarHash ?? null,
                tags: t.tags || [],
                solved: t.solved || t.archived || false,
                locked: t.locked || false,
            }));
            setThreads(mapped);
        } catch {
            setThreads([]);
        }
        setLoading(false);
    }, [channelId]);

    useEffect(() => { fetchThreads(); }, [fetchThreads]);

    const filtered = useMemo(() => {
        return threads
            .filter(t => !filterTag || (t.tags || []).includes(filterTag))
            .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                if (sort === 'latest') return new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime();
                if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                return (b.messageCount || 0) - (a.messageCount || 0);
            });
    }, [threads, filterTag, search, sort]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            const thread = await api.threads.create(channelId, {
                name: newTitle.trim(),
                body: newContent.trim() || undefined,
            } as any);
            setShowCreate(false);
            setNewTitle('');
            setNewContent('');
            setNewTags([]);
            fetchThreads();
            if (thread?.id) onOpenThread(thread.id);
        } catch { /* errors surface via toast in parent */ }
        setCreating(false);
    };

    const sortLabels: Record<SortMode, string> = {
        latest: 'Latest Activity',
        oldest: 'Oldest First',
        'most-replies': 'Most Replies',
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* ── Top bar ── */}
            <div style={{
                padding: '12px 20px', borderBottom: '1px solid var(--stroke)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                background: 'var(--bg-primary)',
            }}>
                {/* Row 1: title + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LayoutGrid size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <h2 style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>
                            #{channelName}
                        </h2>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '20px', background: 'var(--bg-tertiary)', fontWeight: 600 }}>
                            {threads.length} post{threads.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* View mode toggle */}
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)' }}>
                            <button
                                onClick={() => setViewMode('grid')}
                                title="Grid view"
                                style={{
                                    padding: '7px 10px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center',
                                }}
                            ><LayoutGrid size={15} /></button>
                            <button
                                onClick={() => setViewMode('list')}
                                title="List view"
                                style={{
                                    padding: '7px 10px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center',
                                }}
                            ><List size={15} /></button>
                        </div>
                        {/* New Post button */}
                        <button
                            onClick={() => setShowCreate(s => !s)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                background: 'var(--accent-primary)', color: '#fff',
                                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <Plus size={15} /> New Post
                        </button>
                    </div>
                </div>

                {/* Row 2: search + sort + tags */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '120px' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search posts…"
                            style={{
                                width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px',
                                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                                boxSizing: 'border-box', outline: 'none',
                            }}
                        />
                    </div>
                    {/* Sort dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setSortOpen(o => !o)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                                borderRadius: '8px', border: '1px solid var(--stroke)',
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {sortLabels[sort]}
                            <ChevronDown size={13} style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                        </button>
                        {sortOpen && (
                            <div style={{
                                position: 'absolute', top: '38px', left: 0, zIndex: 100,
                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                borderRadius: '10px', padding: '4px', minWidth: '160px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            }}>
                                {(['latest', 'oldest', 'most-replies'] as SortMode[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => { setSort(s); setSortOpen(false); }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '8px 12px', border: 'none', borderRadius: '7px',
                                            background: sort === s ? 'var(--bg-tertiary)' : 'transparent',
                                            color: sort === s ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '13px', fontWeight: sort === s ? 600 : 400,
                                            cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >{sortLabels[s]}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Tag filter chips */}
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                            <button
                                onClick={() => setFilterTag(null)}
                                style={{
                                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                    border: `1px solid ${!filterTag ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                    background: !filterTag ? 'rgba(82,109,245,0.1)' : 'var(--bg-tertiary)',
                                    color: !filterTag ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >All</button>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                                    style={{
                                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: filterTag === tag.id ? `${tag.color || 'var(--accent-primary)'}18` : 'var(--bg-tertiary)',
                                        color: filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── New Post form ── */}
            {showCreate && (
                <div style={{
                    margin: '12px 20px', borderRadius: '12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)',
                    padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create a new post</span>
                        <button
                            onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewTags([]); }}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        ><X size={14} /></button>
                    </div>
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Post title…"
                        autoFocus
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'inherit',
                            marginBottom: '10px', boxSizing: 'border-box', outline: 'none',
                        }}
                    />
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Describe your post… (optional)"
                        rows={4}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                            resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box', outline: 'none',
                        }}
                    />
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setNewTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                                    style={{
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: newTags.includes(tag.id) ? `${tag.color || 'var(--accent-primary)'}18` : 'var(--bg-tertiary)',
                                        color: newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewTags([]); }}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >Cancel</button>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !newTitle.trim()}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none',
                                background: newTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: newTitle.trim() ? '#fff' : 'var(--text-muted)',
                                fontSize: '13px', fontWeight: 700, cursor: newTitle.trim() && !creating ? 'pointer' : 'not-allowed',
                                opacity: creating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            {creating ? <><Loader2 size={14} className="spin" /> Creating…</> : 'Post'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Content area ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }} onClick={() => setSortOpen(false)}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px' }}>
                        <Loader2 size={28} className="spin" style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '14px' }}>Loading posts…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px' }}>
                        <LayoutGrid size={48} style={{ opacity: 0.2 }} />
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {threads.length === 0 ? 'No posts yet' : 'No posts match your filters'}
                        </span>
                        <span style={{ fontSize: '13px', textAlign: 'center', maxWidth: '280px' }}>
                            {threads.length === 0 ? 'Be the first to create a post in this forum!' : 'Try adjusting your search or clearing filters.'}
                        </span>
                        {threads.length === 0 && (
                            <button
                                onClick={() => setShowCreate(true)}
                                style={{ marginTop: '4px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            ><Plus size={16} /> Create First Post</button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <GridView threads={filtered} forumTags={forumTags} onOpenThread={onOpenThread} />
                ) : (
                    <ListView threads={filtered} forumTags={forumTags} onOpenThread={onOpenThread} />
                )}
            </div>
        </div>
    );
}

// ── Grid view ────────────────────────────────────────────────────────────────

function GridView({ threads, forumTags, onOpenThread }: {
    threads: ForumThread[];
    forumTags: ForumTag[];
    onOpenThread: (id: string) => void;
}) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '14px',
        }}>
            {threads.map(thread => (
                <GridCard key={thread.id} thread={thread} forumTags={forumTags} onOpenThread={onOpenThread} />
            ))}
        </div>
    );
}

function GridCard({ thread, forumTags, onOpenThread }: {
    thread: ForumThread;
    forumTags: ForumTag[];
    onOpenThread: (id: string) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const gradient = threadGradient(thread.id + thread.name);
    const initials = threadInitials(thread.name);

    return (
        <div
            onClick={() => onOpenThread(thread.id)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                borderRadius: '12px', overflow: 'hidden',
                background: 'var(--bg-elevated)',
                border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                transform: hovered ? 'translateY(-2px)' : 'none',
                boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
            }}
        >
            {/* Thumbnail */}
            <div style={{
                height: '120px', background: gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '-1px', userSelect: 'none' }}>
                    {initials}
                </span>
                {thread.locked && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                        <Lock size={10} /> Locked
                    </div>
                )}
                {thread.solved && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.8)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                        <CheckCircle size={10} /> Solved
                    </div>
                )}
            </div>

            {/* Card body */}
            <div style={{ padding: '12px' }}>
                {/* Tags */}
                {(thread.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {thread.tags!.slice(0, 3).map(tagId => {
                            const tag = forumTags.find(t => t.id === tagId);
                            return tag ? (
                                <span key={tagId} style={{ padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: `${tag.color || '#5865f2'}22`, color: tag.color || 'var(--accent-primary)', border: `1px solid ${tag.color || 'var(--accent-primary)'}40` }}>
                                    {tag.name}
                                </span>
                            ) : null;
                        })}
                    </div>
                )}

                {/* Title */}
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {thread.name}
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {thread.authorId ? (
                            <Avatar userId={thread.authorId} displayName={thread.authorName || ''} avatarHash={thread.authorAvatarHash} size={20} />
                        ) : (
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                            {thread.authorName || 'Unknown'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MessageSquare size={11} /> {thread.messageCount || 0}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} /> {timeAgo(thread.lastMessageAt || thread.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ threads, forumTags, onOpenThread }: {
    threads: ForumThread[];
    forumTags: ForumTag[];
    onOpenThread: (id: string) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {threads.map(thread => (
                <ListRow key={thread.id} thread={thread} forumTags={forumTags} onOpenThread={onOpenThread} />
            ))}
        </div>
    );
}

function ListRow({ thread, forumTags, onOpenThread }: {
    thread: ForumThread;
    forumTags: ForumTag[];
    onOpenThread: (id: string) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const gradient = threadGradient(thread.id + thread.name);

    return (
        <div
            onClick={() => onOpenThread(thread.id)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 16px', borderRadius: '10px',
                background: hovered ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
            }}
        >
            {/* Mini thumbnail */}
            <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', userSelect: 'none' }}>
                    {threadInitials(thread.name)}
                </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.name}</span>
                    {thread.solved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '10px', fontWeight: 700, color: '#10b981', flexShrink: 0 }}><CheckCircle size={10} /> Solved</span>}
                    {thread.locked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--error)', flexShrink: 0 }}><Lock size={10} /> Locked</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {thread.authorId && <Avatar userId={thread.authorId} displayName={thread.authorName || ''} avatarHash={thread.authorAvatarHash} size={16} />}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{thread.authorName}</span>
                    {(thread.tags || []).slice(0, 2).map(tagId => {
                        const tag = forumTags.find(t => t.id === tagId);
                        return tag ? <span key={tagId} style={{ padding: '1px 6px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: `${tag.color || '#5865f2'}20`, color: tag.color || 'var(--accent-primary)' }}>{tag.name}</span> : null;
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare size={13} /> {thread.messageCount || 0}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> {timeAgo(thread.lastMessageAt || thread.createdAt)}</span>
            </div>
        </div>
    );
}

