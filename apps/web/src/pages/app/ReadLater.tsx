import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Trash2, Check, Clock, Hash, MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/ToastManager';

interface ReadLaterItem {
    id: string;
    type: 'channel' | 'thread';
    channelId: string;
    channelName: string;
    guildId?: string;
    guildName?: string;
    threadId?: string;
    threadName?: string;
    addedAt: string;
    unreadCount: number;
}

const STORAGE_KEY = 'gratonite-read-later-queue';

function loadQueue(): ReadLaterItem[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function saveQueue(items: ReadLaterItem[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
}

function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

function estimateReadTime(unreadCount: number): string {
    const seconds = unreadCount * 3;
    if (seconds < 60) return '<1 min';
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const ReadLater = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [items, setItems] = useState<ReadLaterItem[]>([]);

    useEffect(() => {
        setItems(loadQueue());
    }, []);

    const handleRemove = useCallback((id: string) => {
        setItems(prev => {
            const next = prev.filter(item => item.id !== id);
            saveQueue(next);
            return next;
        });
        addToast({ title: 'Removed from Read Later', variant: 'info' });
    }, [addToast]);

    const handleMarkRead = useCallback((item: ReadLaterItem) => {
        setItems(prev => {
            const next = prev.map(i => i.id === item.id ? { ...i, unreadCount: 0 } : i);
            saveQueue(next);
            return next;
        });
        addToast({ title: 'Marked as read', variant: 'success' });
    }, [addToast]);

    const handleNavigate = useCallback((item: ReadLaterItem) => {
        if (item.guildId && item.channelId) {
            navigate(`/guild/${item.guildId}/channel/${item.channelId}`);
        } else {
            addToast({ title: 'Cannot navigate', description: 'Channel no longer available', variant: 'error' });
        }
    }, [navigate, addToast]);

    const totalUnread = items.reduce((acc, item) => acc + item.unreadCount, 0);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={20} color="var(--accent-primary)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Read Later</h2>
                    {items.length > 0 && (
                        <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                            background: 'rgba(82, 109, 245, 0.12)', color: 'var(--accent-primary)',
                        }}>
                            {items.length}
                        </span>
                    )}
                </div>
            </header>

            <div className="content-padding" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '32px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                            Read Later Queue
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Channels and threads you've saved to read later.
                            {totalUnread > 0 && (
                                <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    {totalUnread} unread message{totalUnread !== 1 ? 's' : ''} total
                                </span>
                            )}
                        </p>
                    </div>

                    {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0' }}>
                            <BookOpen size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Nothing here yet</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                Add channels or threads to your Read Later queue from channel headers.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {items.map(item => (
                                <div key={item.id} style={{
                                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                    borderRadius: '12px', padding: '16px 20px',
                                    display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'border-color 0.15s',
                                }}
                                className="hover-border-muted"
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'var(--bg-tertiary)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--accent-primary)', flexShrink: 0,
                                    }}>
                                        {item.type === 'thread' ? <MessageSquare size={20} /> : <Hash size={20} />}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => handleNavigate(item)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {item.type === 'thread' ? item.threadName : `#${item.channelName}`}
                                            </span>
                                            {item.unreadCount > 0 && (
                                                <span style={{
                                                    fontSize: '11px', fontWeight: 700, padding: '2px 6px',
                                                    borderRadius: '8px', background: 'var(--error)',
                                                    color: '#fff',
                                                }}>
                                                    {item.unreadCount}
                                                </span>
                                            )}
                                            <ChevronRight size={14} color="var(--text-muted)" />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {item.guildName && <span>{item.guildName}</span>}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={11} /> Added {formatRelativeDate(item.addedAt)}
                                            </span>
                                            {item.unreadCount > 0 && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    ~{estimateReadTime(item.unreadCount)} to read
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        {item.unreadCount > 0 && (
                                            <button
                                                onClick={() => handleMarkRead(item)}
                                                title="Mark Read"
                                                style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', color: 'var(--text-muted)',
                                                }}
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRemove(item.id)}
                                            title="Remove"
                                            style={{
                                                width: '32px', height: '32px', borderRadius: '8px',
                                                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', color: 'var(--text-muted)',
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReadLater;
