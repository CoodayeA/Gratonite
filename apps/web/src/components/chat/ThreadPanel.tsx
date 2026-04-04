import { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Send, Smile, Filter, Clock, Archive, Search, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import { onThreadCreate } from '../../lib/socket';
import Avatar from '../ui/Avatar';
import { useToast } from '../ui/ToastManager';
import { SkeletonMessageList } from '../ui/SkeletonLoader';

type Message = {
    id: number;
    apiId?: string;
    author: string;
    avatar: string | React.ReactNode;
    time: string;
    content: string;
    bgColor?: string;
    createdAt?: number | string | null;
    authorId?: string;
    authorAvatarHash?: string | null;
};

interface ThreadPanelProps {
    originalMessage: Message | null;
    channelId: string;
    onClose: () => void;
    onJumpToParent?: () => void;
}

const ARCHIVE_OPTIONS = [
    { value: 60, label: '1 Hour' },
    { value: 1440, label: '24 Hours' },
    { value: 4320, label: '3 Days' },
    { value: 10080, label: '1 Week' },
];

type ThreadListItem = {
    id: string;
    name: string;
    messageCount: number;
    createdAt: string;
    archived: boolean;
    creatorId?: string;
    lastActivityAt?: string;
};

type ThreadFilterTab = 'active' | 'archived' | 'mine';
type ThreadSortOption = 'recent' | 'created' | 'replies';

const ThreadPanel = ({ originalMessage, channelId, onClose, onJumpToParent }: ThreadPanelProps) => {
    const { addToast } = useToast();
    const [replies, setReplies] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const [archiveAfter, setArchiveAfter] = useState(1440);
    const [showThreadList, setShowThreadList] = useState(false);
    const [threadList, setThreadList] = useState<ThreadListItem[]>([]);
    const [threadListLoading, setThreadListLoading] = useState(false);
    const [threadFilterTab, setThreadFilterTab] = useState<ThreadFilterTab>('active');
    const [threadSort, setThreadSort] = useState<ThreadSortOption>('recent');
    const [threadSearchQuery, setThreadSearchQuery] = useState('');

    const EMOJI_LIST = ['😄','😂','❤️','🔥','👍','👎','😮','🎉','💀','🚀','✨','💯','👀','😢','🤔','😡'];

    const { user: ctxUser } = useUser();
    const currentUserName = ctxUser.name || ctxUser.handle || 'You';

    const handleEmojiClick = (emoji: string) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [replies]);

    // Load existing thread replies on mount
    useEffect(() => {
        if (!originalMessage?.apiId || !channelId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setReplies([]);
        setThreadId(null);

        api.threads.list(channelId)
            .then(async (threads: any[]) => {
                const existing = threads.find(
                    (t: any) => t.originMessageId === originalMessage.apiId
                );
                if (existing) {
                    setThreadId(existing.id);
                    const msgs = await api.threads.listMessages(existing.id);
                    const converted: Message[] = (msgs as any[]).map((m: any, i: number) => ({
                        id: i + 1,
                        apiId: m.id,
                        author: m.author?.displayName || m.author?.username || 'Unknown',
                        avatar: (m.author?.displayName || m.author?.username || '?').charAt(0).toUpperCase(),
                        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        content: m.content || '',
                        createdAt: m.createdAt,
                        authorId: m.authorId,
                        authorAvatarHash: m.author?.avatarHash ?? null,
                    }));
                    setReplies(converted);
                }
            })
            .catch(() => { /* thread may not exist yet */ })
            .finally(() => setIsLoading(false));
    }, [originalMessage?.apiId, channelId]);

    // Fetch thread list when thread list view is toggled
    useEffect(() => {
        if (!showThreadList || !channelId) return;
        setThreadListLoading(true);
        api.threads.list(channelId)
            .then((threads: any[]) => {
                const items: ThreadListItem[] = threads.map((t: any) => ({
                    id: t.id,
                    name: t.name || 'Untitled Thread',
                    messageCount: t.messageCount ?? 0,
                    createdAt: t.createdAt,
                    archived: t.archived ?? false,
                    creatorId: t.creatorId,
                    lastActivityAt: t.lastActivityAt || t.updatedAt || t.createdAt,
                }));
                setThreadList(items);
            })
            .catch(() => setThreadList([]))
            .finally(() => setThreadListLoading(false));
    }, [showThreadList, channelId]);

    // Listen for new threads created via socket
    useEffect(() => {
        if (!channelId) return;
        const unsub = onThreadCreate((data) => {
            if (data.channelId !== channelId) return;
            setThreadList(prev => {
                if (prev.some(t => t.id === data.id)) return prev;
                return [{
                    id: data.id,
                    name: data.name || 'Untitled Thread',
                    messageCount: 0,
                    createdAt: data.createdAt || new Date().toISOString(),
                    archived: false,
                    creatorId: data.creatorId,
                    lastActivityAt: data.createdAt || new Date().toISOString(),
                }, ...prev];
            });
        });
        return unsub;
    }, [channelId]);

    const filteredThreads = threadList
        .filter(t => {
            if (threadFilterTab === 'active') return !t.archived;
            if (threadFilterTab === 'archived') return t.archived;
            if (threadFilterTab === 'mine') return t.creatorId === ctxUser.id;
            return true;
        })
        .filter(t => {
            if (!threadSearchQuery.trim()) return true;
            return t.name.toLowerCase().includes(threadSearchQuery.trim().toLowerCase());
        })
        .sort((a, b) => {
            if (threadSort === 'recent') return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
            if (threadSort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (threadSort === 'replies') return b.messageCount - a.messageCount;
            return 0;
        });

    // Escape key to close (but not when emoji picker is open)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showEmojiPicker) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showEmojiPicker]);

    if (!originalMessage) return null;

    const handleSend = async () => {
        if (inputValue.trim() === '' || !channelId || !originalMessage?.apiId) return;
        if (isSending) return;
        setIsSending(true);

        try {
            let currentThreadId = threadId;

            // Create thread on first reply if none exists
            if (!currentThreadId) {
                const thread = await api.threads.create(channelId, {
                    name: `Thread: ${(originalMessage.content || '').slice(0, 50) || 'message'}`,
                    messageId: originalMessage.apiId,
                    archiveAfter: archiveAfter * 60,
                });
                currentThreadId = (thread as any).id;
                setThreadId(currentThreadId);
            }

            const content = inputValue.trim();
            const msg = await api.messages.send(channelId, {
                content: content || undefined,
                threadId: currentThreadId!,
            });

            const newReply: Message = {
                id: Date.now(),
                apiId: (msg as any).id,
                author: currentUserName,
                avatar: currentUserName.charAt(0).toUpperCase(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: (msg as any).content || content,
                createdAt: Date.now(),
                authorId: ctxUser.id,
                authorAvatarHash: ctxUser.avatarHash,
            };
            setReplies(prev => [...prev, newReply]);
            setInputValue('');
            setShowEmojiPicker(false);
        } catch (err: any) {
            // Surface the error to the user
            const detail = err?.message || err?.code || 'Unknown error';
            addToast({ title: 'Failed to send thread reply', description: detail, variant: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="thread-panel">
            <div className="thread-header" style={{ flexDirection: 'column', alignItems: 'stretch', height: 'auto', padding: '8px 12px 0', gap: 0 }}>
                {/* Breadcrumb: Return to channel */}
                <button
                    onClick={onClose}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600,
                        padding: '4px 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                    title="Return to channel"
                >
                    <ArrowLeft size={12} />
                    Return to channel
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--stroke)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Thread</h3>
                        {replies.length > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 7px', borderRadius: '10px' }}>
                                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {onJumpToParent && (
                            <button
                                onClick={onJumpToParent}
                                className="message-action-btn"
                                style={{ width: '28px', height: '28px' }}
                                title="Jump to original message"
                            >
                                <ArrowUpRight size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setShowThreadList(prev => !prev)}
                            className="message-action-btn"
                            style={{ width: '28px', height: '28px', color: showThreadList ? 'var(--accent-primary)' : undefined }}
                            title="All Threads"
                        >
                            <Filter size={16} />
                        </button>
                        <button onClick={onClose} className="message-action-btn" style={{ width: '28px', height: '28px' }} title="Close (Esc)">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Thread List View */}
            {showThreadList && (
                <div style={{ borderBottom: '1px solid var(--stroke)', padding: '8px 12px', background: 'rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                        {([['active', 'Active'], ['archived', 'Archived'], ['mine', 'My Threads']] as const).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setThreadFilterTab(key)}
                                style={{
                                    padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    background: threadFilterTab === key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: threadFilterTab === key ? '#fff' : 'var(--text-secondary)',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                        <select
                            value={threadSort}
                            onChange={e => setThreadSort(e.target.value as ThreadSortOption)}
                            style={{ marginLeft: 'auto', padding: '3px 6px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}
                        >
                            <option value="recent">Recent Activity</option>
                            <option value="created">Creation Date</option>
                            <option value="replies">Most Replies</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '4px 8px', border: '1px solid var(--stroke)' }}>
                        <Search size={12} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search threads..."
                            value={threadSearchQuery}
                            onChange={e => setThreadSearchQuery(e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 0' }}
                        />
                        {threadSearchQuery && (
                            <button onClick={() => setThreadSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                                <X size={10} />
                            </button>
                        )}
                    </div>
                    {threadListLoading ? (
                        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading threads...</div>
                    ) : filteredThreads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>No threads found</div>
                    ) : (
                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {filteredThreads.map(t => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '12px' }}>
                                    {t.archived ? <Archive size={12} color="var(--text-muted)" /> : <MessageSquare size={12} color="var(--accent-primary)" />}
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{t.name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{t.messageCount} replies</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="thread-content">
                {/* Original Message */}
                <div className="message" style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.2)' }}>
                    <Avatar
                        userId={originalMessage.authorId || String(originalMessage.id)}
                        displayName={originalMessage.author}
                        avatarHash={(originalMessage as any).authorAvatarHash}
                        size={40}
                    />
                    <div className="msg-content">
                        <div className="msg-header">
                            <span className="msg-author">{originalMessage.author}</span>
                            <span className="msg-timestamp">{originalMessage.time}</span>
                        </div>
                        <div className="msg-body">
                            {originalMessage.content}
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <SkeletonMessageList count={4} />
                ) : (
                    <>
                        <div style={{ padding: '16px 16px 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                        </div>
                        {replies.length === 0 && (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                No replies yet. Start the conversation.
                            </div>
                        )}

                        {/* Replies */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {replies.map(reply => (
                                <div key={reply.apiId || reply.id} className="message" style={{ padding: '8px 16px' }}>
                                    <Avatar
                                        userId={reply.authorId || String(reply.id)}
                                        displayName={reply.author}
                                        avatarHash={reply.authorAvatarHash}
                                        size={30}
                                    />
                                    <div className="msg-content">
                                        <div className="msg-header" style={{ fontSize: '13px' }}>
                                            <span className="msg-author">{reply.author}</span>
                                            <span className="msg-timestamp" title={reply.createdAt ? new Date(typeof reply.createdAt === 'string' ? reply.createdAt : reply.createdAt).toLocaleString() : reply.time}>
                                                {reply.createdAt ? formatRelative(typeof reply.createdAt === "string" ? new Date(reply.createdAt).getTime() : reply.createdAt) : reply.time}
                                            </span>
                                        </div>
                                        <div className="msg-body" style={{ fontSize: '13px' }}>
                                            {reply.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={endRef} />
                        </div>
                    </>
                )}
            </div>

            {/* Archive timer selector (shown when thread hasn't been created yet) */}
            {!threadId && (
                <div style={{ padding: '6px 16px', borderTop: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.1)' }}>
                    <Clock size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Auto-archive after:</span>
                    <select
                        value={archiveAfter}
                        onChange={e => setArchiveAfter(Number(e.target.value))}
                        style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}
                    >
                        {ARCHIVE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="thread-input">
                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="thread-emoji-picker" style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: '16px',
                        marginBottom: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '8px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '4px',
                        zIndex: 100,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        {EMOJI_LIST.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleEmojiClick(emoji)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                }}
                                className="hover-bg-tertiary"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                <div className="chat-input-wrapper" style={{ minHeight: '40px', padding: '0 8px' }}>
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Reply in thread..."
                        style={{ fontSize: '13px' }}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    />
                    <button
                        className="input-icon-btn"
                        style={{ width: '28px', height: '28px', color: showEmojiPicker ? 'var(--accent-primary)' : undefined }}
                        onClick={() => setShowEmojiPicker(prev => !prev)}
                    >
                        <Smile size={16} />
                    </button>
                    <button
                        className={`input-icon-btn ${inputValue.trim() ? 'primary' : ''}`}
                        style={{ width: '28px', height: '28px', opacity: isSending ? 0.3 : inputValue.trim() ? 1 : 0.5 }}
                        onClick={handleSend}
                        disabled={isSending}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

function formatRelative(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return new Date(timestamp).toLocaleDateString();
}

export default ThreadPanel;
