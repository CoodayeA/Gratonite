/**
 * ForumView.tsx — Thread-based discussion view for forum channels.
 * Shows threads as cards with tags, sorting, and solved markers.
 */
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Tag, CheckCircle, Clock, Filter, Plus, ChevronDown, Search, Loader2 } from 'lucide-react';
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
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [search, setSearch] = useState('');
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
                authorName: t.authorName || t.author?.displayName || t.author?.username || 'Unknown',
                authorAvatarHash: t.author?.avatarHash ?? null,
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

    const filtered = threads
        .filter(t => !filterTag || (t.tags || []).includes(filterTag))
        .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'latest') return new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime();
            if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return (b.messageCount || 0) - (a.messageCount || 0);
        });

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        setCreating(true);
        try {
            const thread = await api.threads.create(channelId, {
                name: newTitle.trim(),
                firstMessage: newContent.trim() || undefined,
            } as any);
            setShowCreate(false);
            setNewTitle('');
            setNewContent('');
            setNewTags([]);
            fetchThreads();
            if (thread?.id) onOpenThread(thread.id);
        } catch { /* toast handled by caller */ }
        setCreating(false);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={20} color="var(--accent-primary)" />
                        <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>
                            # {channelName}
                        </h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)' }}>
                            {threads.length} thread{threads.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                            borderRadius: '8px', border: 'none', background: 'var(--accent-primary)',
                            color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> New Thread
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search threads..."
                            style={{
                                width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px',
                                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as SortMode)}
                        style={{
                            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                        }}
                    >
                        <option value="latest">Latest Activity</option>
                        <option value="oldest">Oldest First</option>
                        <option value="most-replies">Most Replies</option>
                    </select>
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setFilterTag(null)}
                                style={{
                                    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                    border: `1px solid ${!filterTag ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                    background: !filterTag ? 'rgba(82,109,245,0.1)' : 'var(--bg-tertiary)',
                                    color: !filterTag ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}
                            >All</button>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                                    style={{
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: filterTag === tag.id ? `${tag.color || 'var(--accent-primary)'}15` : 'var(--bg-tertiary)',
                                        color: filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create thread form */}
            {showCreate && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)' }}>
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Thread title..."
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                            marginBottom: '8px', boxSizing: 'border-box',
                        }}
                    />
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="First message (optional)..."
                        rows={3}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                            resize: 'vertical', marginBottom: '8px', boxSizing: 'border-box',
                        }}
                    />
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setNewTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                                    style={{
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: newTags.includes(tag.id) ? `${tag.color || 'var(--accent-primary)'}15` : 'var(--bg-tertiary)',
                                        color: newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleCreate} disabled={creating || !newTitle.trim()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: creating || !newTitle.trim() ? 0.5 : 1 }}>
                            {creating ? 'Creating...' : 'Create Thread'}
                        </button>
                    </div>
                </div>
            )}

            {/* Thread list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        <Loader2 size={24} className="spin" style={{ marginBottom: '8px' }} />
                        <p>Loading threads...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        <MessageSquare size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '15px', fontWeight: 600 }}>No threads yet</p>
                        <p style={{ fontSize: '13px' }}>Start a new thread to begin discussing.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filtered.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => onOpenThread(thread.id)}
                                style={{
                                    padding: '14px 16px', borderRadius: '10px',
                                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--stroke)'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    {thread.authorId && (
                                        <Avatar userId={thread.authorId} displayName={thread.authorName || ''} avatarHash={thread.authorAvatarHash} size={32} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{thread.name}</span>
                                            {thread.solved && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '10px', fontWeight: 700, color: '#10b981' }}>
                                                    <CheckCircle size={10} /> Solved
                                                </span>
                                            )}
                                        </div>
                                        {/* Tags */}
                                        {(thread.tags || []).length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                {thread.tags!.map(tagId => {
                                                    const tag = forumTags.find(t => t.id === tagId);
                                                    return tag ? (
                                                        <span key={tagId} style={{ padding: '1px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, background: `${tag.color || '#5865f2'}20`, color: tag.color || '#5865f2' }}>
                                                            {tag.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span>{thread.authorName}</span>
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
