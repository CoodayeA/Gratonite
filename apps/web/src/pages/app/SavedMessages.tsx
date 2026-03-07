import { useState, useEffect } from 'react';
import { Bookmark, Trash2, ExternalLink, MessageSquare } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useNavigate } from 'react-router-dom';

type BookmarkItem = {
    id: string;
    messageId: string;
    note: string | null;
    createdAt: string;
    messageContent: string | null;
    messageAuthorId: string | null;
    messageCreatedAt: string;
    channelId: string;
    channelName: string;
    guildId: string | null;
    guildName: string | null;
    authorUsername: string | null;
    authorDisplayName: string | null;
};

export default function SavedMessages() {
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE}/api/v1/users/@me/bookmarks`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(r => r.json())
            .then(data => { setBookmarks(Array.isArray(data) ? data : []); })
            .catch(() => addToast({ title: 'Failed to load bookmarks', variant: 'error' }))
            .finally(() => setLoading(false));
    }, []);

    const removeBookmark = async (messageId: string) => {
        try {
            await fetch(`${API_BASE}/api/v1/users/@me/bookmarks/${messageId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            setBookmarks(prev => prev.filter(b => b.messageId !== messageId));
            addToast({ title: 'Bookmark removed', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to remove bookmark', variant: 'error' });
        }
    };

    const jumpToMessage = (b: BookmarkItem) => {
        if (b.guildId) {
            navigate(`/guild/${b.guildId}/channel/${b.channelId}?msg=${b.messageId}`);
        } else {
            navigate(`/dm/${b.channelId}?msg=${b.messageId}`);
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Bookmark size={24} color="var(--accent-primary)" />
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Saved Messages</h1>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{bookmarks.length} saved</span>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : bookmarks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <Bookmark size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ fontSize: '16px', fontWeight: 600 }}>No saved messages</p>
                    <p style={{ fontSize: '13px' }}>Right-click a message and choose "Bookmark Message" to save it here.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bookmarks.map(b => (
                        <div key={b.id} style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--stroke)',
                            borderRadius: '12px',
                            padding: '16px',
                            transition: 'border-color 0.15s',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {b.authorDisplayName || b.authorUsername || 'Unknown'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            in #{b.channelName}{b.guildName ? ` - ${b.guildName}` : ''}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                                            {new Date(b.messageCreatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
                                        {(b.messageContent || '(no text content)').slice(0, 300)}
                                    </div>
                                    {b.note && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                                            Note: {b.note}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button
                                        onClick={() => jumpToMessage(b)}
                                        title="Jump to message"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                                    >
                                        <ExternalLink size={14} />
                                    </button>
                                    <button
                                        onClick={() => removeBookmark(b.messageId)}
                                        title="Remove bookmark"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
