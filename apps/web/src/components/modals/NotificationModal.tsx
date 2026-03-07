import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, CheckCircle2, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import Avatar from '../ui/Avatar';
import { buildDmRoute, buildGuildChannelRoute, normalizeLegacyRoute } from '../../lib/routes';

type Notification = {
    id: string;
    type: string;
    user: string;
    userId?: string;
    userColor: string;
    content: string;
    preview: string;
    date: string;
    read: boolean;
    channel: string;
};

const NotificationModal = ({ onClose }: { onClose: () => void }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'all' | 'mentions'>('all');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    useEffect(() => {
        setIsLoading(true);
        api.notifications.list(50)
            .then(data => {
                const mapped: Notification[] = data.map(n => ({
                    id: n.id,
                    type: n.type || 'message',
                    user: n.senderName || 'System',
                    userId: n.senderId ?? undefined,
                    userColor: '',
                    content: n.content,
                    preview: n.preview || '',
                    date: formatRelative(n.createdAt),
                    read: n.read,
                    channel: n.channelId
                        ? (n.guildId
                            ? buildGuildChannelRoute(n.guildId, n.channelId)
                            : buildDmRoute(n.channelId))
                        : '/',
                }));
                setNotifications(mapped);
            })
            .catch(() => {
                addToast({ title: 'Failed to load notifications', variant: 'error' });
            })
            .finally(() => setIsLoading(false));
    }, []);

    const filtered = notifications.filter(n => activeTab === 'all' || n.type === 'mention');

    const markAllRead = () => {
        api.notifications.markAllRead()
            .then(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))))
            .catch(() => addToast({ title: 'Failed to mark notifications as read', variant: 'error' }));
    };

    const clearAll = () => {
        api.notifications.clearAll()
            .then(() => setNotifications([]))
            .catch(() => addToast({ title: 'Failed to clear notifications', variant: 'error' }));
    };

    const dismissNotification = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        api.notifications.dismiss(id)
            .then(() => setNotifications(prev => prev.filter(n => n.id !== id)))
            .catch(() => addToast({ title: 'Failed to dismiss notification', variant: 'error' }));
    };

    const handleNotificationClick = (notif: Notification) => {
        api.notifications.markRead(notif.id).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        navigate(normalizeLegacyRoute(notif.channel));
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', justifyContent: 'flex-end', padding: '24px' }}>
            <div
                className="notification-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '420px',
                    borderRadius: '16px',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    animation: 'slideInRight 0.3s ease-out forwards',
                    height: 'max-content',
                    maxHeight: 'calc(100vh - 48px)',
                    background: 'var(--bg-primary)',
                }}
            >
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={20} color="var(--text-muted)" />
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Notifications</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '16px 24px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--stroke)' }}>
                    <button
                        onClick={() => setActiveTab('all')}
                        style={{ background: activeTab === 'all' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', color: activeTab === 'all' ? 'white' : 'var(--text-muted)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        For You
                    </button>
                    <button
                        onClick={() => setActiveTab('mentions')}
                        style={{ background: activeTab === 'mentions' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', color: activeTab === 'mentions' ? 'white' : 'var(--text-muted)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <AtSign size={14} /> Mentions
                    </button>

                    <div style={{ flex: 1 }} />
                    <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Mark Read
                    </button>
                    <button onClick={clearAll} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Clear all notifications">
                        <Trash2 size={14} /> Clear All
                    </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    {isLoading ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '14px' }}>Loading notifications...</span>
                        </div>
                    ) : (
                        <>
                            {filtered.map(notif => (
                                <div key={notif.id} onClick={() => handleNotificationClick(notif)} style={{ padding: '16px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', gap: '16px', background: notif.read ? 'transparent' : 'rgba(82, 109, 245, 0.05)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseOut={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(82, 109, 245, 0.05)'}>

                                    <div style={{ position: 'relative' }}>
                                        <Avatar
                                            userId={notif.userId || notif.id}
                                            displayName={notif.user}
                                            size={36}
                                        />
                                        {!notif.read && <div style={{ position: 'absolute', top: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-blue)', border: '2px solid var(--bg-primary)' }}></div>}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{notif.user}</span> <span style={{ color: 'var(--text-secondary)' }}>{notif.content}</span>
                                        </div>
                                        {notif.preview && (
                                            <div style={{ fontSize: '14px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px', borderLeft: '2px solid var(--stroke)', marginTop: '8px' }}>
                                                {notif.preview}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>{notif.date}</div>
                                    </div>

                                    <button onClick={(e) => dismissNotification(notif.id, e)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', alignSelf: 'flex-start', flexShrink: 0, transition: 'color 0.2s' }} onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}

                            {filtered.length === 0 && (
                                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Bell size={32} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>You're all caught up!</h3>
                                    <p style={{ fontSize: '14px' }}>No new notifications.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return d.toLocaleDateString();
}

export default NotificationModal;
