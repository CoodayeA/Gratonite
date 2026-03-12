import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Plus, MessageSquare, ChevronDown, Lock, X, ArrowLeft, Loader2, Clock, User } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

interface ForumPost {
    id: string;
    title: string;
    author: string;
    authorAvatarHash: string | null;
    replies: number;
    locked: boolean;
    createdAt: string;
    lastActivity: string | null;
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

const ForumChannel = () => {
    const { channelId } = useParams<{ channelId: string; guildId: string }>();
    const { addToast } = useToast();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOpen, setSortOpen] = useState(false);
    const [sortBy, setSortBy] = useState<'latest' | 'top'>('latest');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showNewPost, setShowNewPost] = useState(false);
    const [newPostTitle, setNewPostTitle] = useState('');
    const [newPostBody, setNewPostBody] = useState('');
    const [newPostTag, setNewPostTag] = useState('Discussion');

    // Post detail view state
    const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
    const [threadMessages, setThreadMessages] = useState<any[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    const postTags = ['Discussion', 'Help', 'Bug', 'Feature Request', 'Showcase', 'Community', 'Question'];
    const sorts: { label: string; value: 'latest' | 'top' }[] = [
        { label: 'Latest', value: 'latest' },
        { label: 'Top', value: 'top' },
    ];

    const fetchPosts = useCallback(async () => {
        if (!channelId) return;
        setIsLoading(true);
        setError(null);
        try {
            const threads = await api.threads.list(channelId, sortBy);
            const mapped: ForumPost[] = threads.map((t: any) => ({
                id: t.id,
                title: t.name ?? 'Untitled',
                author: t.creatorName ?? 'Unknown',
                authorAvatarHash: t.creatorAvatarHash ?? null,
                replies: t.messageCount ?? 0,
                locked: t.locked ?? false,
                createdAt: t.createdAt,
                lastActivity: t.lastActivity ?? t.createdAt,
            }));
            setPosts(mapped);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load posts';
            setError(msg);
            addToast({ title: 'Failed to load posts', variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [channelId, sortBy]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const handleSubmitPost = async () => {
        if (!newPostTitle.trim() || !channelId) return;
        setIsSubmitting(true);
        try {
            const thread = await api.threads.create(channelId, {
                name: newPostTitle.trim(),
                body: newPostBody.trim() || undefined,
            });
            // Optimistically add to list
            const newPost: ForumPost = {
                id: thread.id,
                title: thread.name ?? newPostTitle.trim(),
                author: 'You',
                authorAvatarHash: null,
                replies: newPostBody.trim() ? 1 : 0,
                locked: false,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
            };
            setPosts(prev => [newPost, ...prev]);
            setNewPostTitle('');
            setNewPostBody('');
            setNewPostTag('Discussion');
            setShowNewPost(false);
            addToast({ title: 'Post Created', description: `Your post "${newPost.title}" has been published.`, variant: 'success' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to create post';
            addToast({ title: 'Error', description: msg, variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPostDetail = async (post: ForumPost) => {
        setSelectedPost(post);
        setMessagesLoading(true);
        setThreadMessages([]);
        try {
            const msgs = await api.threads.listMessages(post.id);
            setThreadMessages(msgs.reverse());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to load messages';
            addToast({ title: 'Error', description: msg, variant: 'error' });
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyContent.trim() || !selectedPost || !channelId) return;
        setIsSendingReply(true);
        try {
            // Send a message in the thread - use the parent channelId with threadId parameter
            const msg = await api.messages.send(channelId, {
                content: replyContent.trim(),
                threadId: selectedPost.id,
            });
            setThreadMessages(prev => [...prev, msg]);
            setReplyContent('');
            // Update reply count locally
            setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, replies: p.replies + 1 } : p));
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to send reply';
            addToast({ title: 'Error', description: errMsg, variant: 'error' });
        } finally {
            setIsSendingReply(false);
        }
    };

    const filteredPosts = posts.filter(p => {
        if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // ── Post Detail View ───────────────────────────────────────
    if (selectedPost) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <header className="channel-header glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => { setSelectedPost(null); setThreadMessages([]); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={20} color="var(--text-muted)" />
                        <h2 style={{ fontSize: '15px', fontWeight: 600 }}>{selectedPost.title}</h2>
                    </div>
                    {selectedPost.locked && (
                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Lock size={12} /> Locked
                        </span>
                    )}
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px' }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {/* Thread info */}
                        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--stroke)' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{selectedPost.title}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={14} /> {selectedPost.author}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={14} /> {timeAgo(selectedPost.createdAt)}
                                </span>
                                <span>{selectedPost.replies} replies</span>
                            </div>
                        </div>

                        {/* Messages */}
                        {messagesLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '12px', flexDirection: 'column' }}>
                                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading messages...</span>
                            </div>
                        ) : threadMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                No messages yet. Be the first to reply!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {threadMessages.map((msg: any, idx: number) => (
                                    <div key={msg.id ?? idx} style={{
                                        padding: '16px 20px',
                                        background: idx === 0 ? 'rgba(82, 109, 245, 0.06)' : 'var(--bg-elevated)',
                                        border: idx === 0 ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                        borderRadius: '10px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                background: 'var(--accent-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px', fontWeight: 600, color: '#fff',
                                            }}>
                                                {(msg.author?.displayName ?? msg.author?.username ?? 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                                {msg.author?.displayName ?? msg.author?.username ?? 'Unknown'}
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {msg.createdAt ? timeAgo(msg.createdAt) : ''}
                                            </span>
                                            {idx === 0 && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', background: 'rgba(82, 109, 245, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                                                    Original Post
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Reply input */}
                        {!selectedPost.locked && (
                            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                <textarea
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder="Write a reply..."
                                    rows={3}
                                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendReply(); }}
                                    style={{
                                        flex: 1, padding: '12px', background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', borderRadius: '10px',
                                        color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical',
                                        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    onClick={handleSendReply}
                                    disabled={!replyContent.trim() || isSendingReply}
                                    className="auth-button"
                                    style={{
                                        margin: 0, width: 'auto', padding: '0 20px', height: '44px',
                                        background: replyContent.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: replyContent.trim() ? '#fff' : 'var(--text-muted)',
                                        opacity: isSendingReply ? 0.7 : 1,
                                        cursor: replyContent.trim() && !isSendingReply ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {isSendingReply ? 'Sending...' : 'Reply'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Post List View ─────────────────────────────────────────
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={20} color="var(--text-muted)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Forum</h2>
                </div>
            </header>

            {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px', flexDirection: 'column' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '14px' }}>Loading posts...</span>
                </div>
            ) : error ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</div>
                    <button onClick={fetchPosts} className="auth-button" style={{ margin: 0, width: 'auto', padding: '0 24px', height: '36px' }}>
                        Retry
                    </button>
                </div>
            ) : (
            <div className="content-padding" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                    <div style={{ marginBottom: '32px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Forum</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Ask questions, share ideas, or start a discussion with the community.</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search posts..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', height: '40px', paddingLeft: '36px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', outline: 'none' }}
                                />
                            </div>
                            <div style={{ position: 'relative' }}>
                                <div onClick={() => setSortOpen(!sortOpen)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '0 16px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                                    Sort: {sorts.find(s => s.value === sortBy)?.label ?? 'Latest'} <ChevronDown size={14} style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                                </div>
                                {sortOpen && (
                                    <div style={{ position: 'absolute', top: '44px', left: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '4px', zIndex: 50, minWidth: '140px' }}>
                                        {sorts.map(s => (
                                            <div key={s.value} onClick={() => { setSortBy(s.value); setSortOpen(false); }} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: sortBy === s.value ? 600 : 400, color: sortBy === s.value ? 'var(--accent-primary)' : 'var(--text-secondary)', background: sortBy === s.value ? 'var(--bg-tertiary)' : 'transparent' }}>{s.label}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setShowNewPost(true)} className="auth-button" style={{ margin: 0, width: 'auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', height: '40px' }}>
                            <Plus size={16} /> New Post
                        </button>
                    </div>

                    {showNewPost && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Post</h3>
                                <button onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostBody(''); setNewPostTag('Discussion'); }} style={{ width: '32px', height: '32px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Post title..."
                                value={newPostTitle}
                                onChange={e => setNewPostTitle(e.target.value)}
                                style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', outline: 'none', marginBottom: '12px', fontSize: '15px', boxSizing: 'border-box' }}
                            />
                            <textarea
                                placeholder="What's on your mind? (optional)"
                                value={newPostBody}
                                onChange={e => setNewPostBody(e.target.value)}
                                rows={4}
                                style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', outline: 'none', marginBottom: '12px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {postTags.map(t => (
                                        <button key={t} onClick={() => setNewPostTag(t)} style={{ padding: '4px 12px', borderRadius: '12px', border: `1px solid ${newPostTag === t ? 'var(--accent-primary)' : 'var(--stroke)'}`, background: newPostTag === t ? 'rgba(82, 109, 245, 0.15)' : 'var(--bg-tertiary)', color: newPostTag === t ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: newPostTag === t ? 600 : 400 }}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleSubmitPost}
                                    disabled={!newPostTitle.trim() || isSubmitting}
                                    className="auth-button"
                                    style={{ margin: 0, width: 'auto', padding: '0 24px', background: newPostTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: newPostTitle.trim() ? '#fff' : 'var(--text-muted)', height: '36px', cursor: newPostTitle.trim() && !isSubmitting ? 'pointer' : 'not-allowed', opacity: (newPostTitle.trim() && !isSubmitting) ? 1 : 0.6 }}
                                >
                                    {isSubmitting ? 'Creating...' : 'Submit Post'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredPosts.map(post => (
                            <div key={post.id}
                                onClick={() => openPostDetail(post)}
                                style={{
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '12px', padding: '16px 24px', display: 'flex', gap: '24px',
                                    cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        {post.locked && <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} /> Locked</span>}
                                        <h3 style={{ fontSize: '17px', fontWeight: 600 }}>{post.title}</h3>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                            Posted by <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-purple)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {post.author.charAt(0).toUpperCase()}
                                                </div>
                                                {post.author}
                                            </span>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {post.lastActivity ? timeAgo(post.lastActivity) : (post.createdAt ? timeAgo(post.createdAt) : '')}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                                    <MessageSquare size={16} />
                                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{post.replies}</span>
                                </div>
                            </div>
                        ))}
                        {filteredPosts.length === 0 && !showNewPost && (
                            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                {posts.length === 0 ? 'No posts yet. Create the first one!' : 'No posts match your search.'}
                            </div>
                        )}
                    </div>

                </div>
            </div>
            )}
        </div>
    );
};

export default ForumChannel;
