import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, CheckCircle2, Trash2, X, ChevronDown, ChevronRight, MessageSquare, Heart, UserPlus, Mail, Settings, Gavel } from 'lucide-react';
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
    dateRaw: number;
    read: boolean;
    channel: string;
    guildName?: string;
    guildId?: string;
};

type NotifGroup = {
    key: string;
    type: string;
    channel: string;
    label: string;
    items: Notification[];
    unreadCount: number;
};

type DaySection = {
    key: string;
    label: string;
    items: (Notification | NotifGroup)[];
};

type FilterTab = 'all' | 'mentions' | 'dms' | 'social' | 'system';

const FILTER_STORAGE_KEY = 'gratonite-notif-filter';

const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getFilterCategory(type: string): FilterTab {
    switch (type) {
        case 'mention': return 'mentions';
        case 'dm': return 'dms';
        case 'friend_request': return 'social';
        case 'auction_new_bid':
        case 'auction_outbid':
        case 'auction_won':
        case 'auction_sold':
        case 'auction_ended':
        case 'system':
            return 'system';
        default: return 'all';
    }
}

function groupNotifications(notifications: Notification[]): (Notification | NotifGroup)[] {
    const result: (Notification | NotifGroup)[] = [];
    const used = new Set<string>();

    for (let i = 0; i < notifications.length; i++) {
        if (used.has(notifications[i].id)) continue;
        const n = notifications[i];

        const group: Notification[] = [n];
        used.add(n.id);

        for (let j = i + 1; j < notifications.length; j++) {
            const m = notifications[j];
            if (used.has(m.id)) continue;
            if (m.type === n.type && m.channel === n.channel && Math.abs(m.dateRaw - n.dateRaw) < GROUP_WINDOW_MS) {
                group.push(m);
                used.add(m.id);
            }
        }

        if (group.length >= 2) {
            const typeLabels: Record<string, string> = {
                'message': 'messages',
                'mention': 'mentions',
                'reaction': 'reactions on your message',
                'friend_request': 'friend requests',
                'dm': 'direct messages',
                'auction_new_bid': 'auction bids',
                'auction_outbid': 'outbid alerts',
            };
            const typeLabel = typeLabels[n.type] || 'notifications';
            result.push({
                key: `group-${n.id}`,
                type: n.type,
                channel: n.channel,
                label: `${group.length} ${typeLabel}`,
                items: group,
                unreadCount: group.filter(g => !g.read).length,
            });
        } else {
            result.push(n);
        }
    }

    return result;
}

function groupByDay(items: (Notification | NotifGroup)[]): DaySection[] {
    const sections: DaySection[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekAgoStart = todayStart - 7 * 86400000;

    const getTimestamp = (item: Notification | NotifGroup): number => {
        if ('items' in item) return item.items[0].dateRaw;
        return item.dateRaw;
    };

    const buckets: Record<string, { label: string; order: number; items: (Notification | NotifGroup)[] }> = {};

    for (const item of items) {
        const ts = getTimestamp(item);
        let key: string;
        let label: string;
        let order: number;

        if (ts >= todayStart) {
            key = 'today';
            label = 'Today';
            order = 0;
        } else if (ts >= yesterdayStart) {
            key = 'yesterday';
            label = 'Yesterday';
            order = 1;
        } else if (ts >= weekAgoStart) {
            key = 'this-week';
            label = 'This Week';
            order = 2;
        } else {
            const d = new Date(ts);
            key = `${d.getFullYear()}-${d.getMonth()}`;
            label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            order = 3 + (Date.now() - ts);
        }

        if (!buckets[key]) {
            buckets[key] = { label, order, items: [] };
        }
        buckets[key].items.push(item);
    }

    const sorted = Object.entries(buckets).sort(([, a], [, b]) => a.order - b.order);
    for (const [key, bucket] of sorted) {
        sections.push({ key, label: bucket.label, items: bucket.items });
    }

    return sections;
}

function isGroup(item: Notification | NotifGroup): item is NotifGroup {
    return 'items' in item;
}

const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'mention': return <AtSign size={16} />;
        case 'dm': return <Mail size={16} />;
        case 'reaction': return <Heart size={16} />;
        case 'friend_request': return <UserPlus size={16} />;
        case 'auction_new_bid':
        case 'auction_outbid':
        case 'auction_won':
        case 'auction_sold':
        case 'auction_ended':
            return <Gavel size={16} />;
        case 'system': return <Settings size={16} />;
        default: return <MessageSquare size={16} />;
    }
};

const TABS: { id: FilterTab; label: string; icon?: typeof AtSign }[] = [
    { id: 'all', label: 'All' },
    { id: 'mentions', label: 'Mentions', icon: AtSign },
    { id: 'dms', label: 'DMs', icon: Mail },
    { id: 'social', label: 'Social', icon: UserPlus },
    { id: 'system', label: 'System', icon: Settings },
];

function getSavedFilter(): FilterTab {
    try {
        const saved = localStorage.getItem(FILTER_STORAGE_KEY);
        if (saved && TABS.some(t => t.id === saved)) return saved as FilterTab;
    } catch {}
    return 'all';
}

const NotificationModal = ({ onClose }: { onClose: () => void }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<FilterTab>(getSavedFilter);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const handleTabChange = useCallback((tab: FilterTab) => {
        setActiveTab(tab);
        try { localStorage.setItem(FILTER_STORAGE_KEY, tab); } catch {}
    }, []);

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
                    dateRaw: new Date(n.createdAt).getTime(),
                    read: n.read,
                    channel: n.channelId
                        ? (n.guildId
                            ? buildGuildChannelRoute(n.guildId, n.channelId)
                            : buildDmRoute(n.channelId))
                        : '/',
                    guildName: n.guildName || undefined,
                    guildId: n.guildId || undefined,
                }));
                setNotifications(mapped);
            })
            .catch(() => {
                addToast({ title: 'Failed to load notifications', variant: 'error' });
            })
            .finally(() => setIsLoading(false));
    }, []);

    const filtered = useMemo(() => {
        if (activeTab === 'all') return notifications;
        return notifications.filter(n => getFilterCategory(n.type) === activeTab);
    }, [notifications, activeTab]);

    const grouped = useMemo(() => groupNotifications(filtered), [filtered]);
    const daySections = useMemo(() => groupByDay(grouped), [grouped]);

    const unreadByTab = useMemo(() => {
        const counts: Record<FilterTab, number> = { all: 0, mentions: 0, dms: 0, social: 0, system: 0 };
        for (const n of notifications) {
            if (!n.read) {
                counts.all++;
                const cat = getFilterCategory(n.type);
                if (cat !== 'all') counts[cat]++;
            }
        }
        return counts;
    }, [notifications]);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const markAllRead = () => {
        api.notifications.markAllRead()
            .then(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))))
            .catch(() => addToast({ title: 'Failed to mark notifications as read', variant: 'error' }));
    };

    const markGroupRead = (group: NotifGroup) => {
        const unreadIds = group.items.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;
        Promise.all(unreadIds.map(id => api.notifications.markRead(id))).catch(() => {});
        setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read: true } : n));
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

    const renderNotification = (notif: Notification) => (
        <div key={notif.id} onClick={() => handleNotificationClick(notif)} style={{ padding: '12px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', gap: '12px', background: notif.read ? 'transparent' : 'rgba(82, 109, 245, 0.05)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseOut={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(82, 109, 245, 0.05)'}>
            <div style={{ position: 'relative' }}>
                <Avatar userId={notif.userId || notif.id} displayName={notif.user} size={36} />
                {!notif.read && <div style={{ position: 'absolute', top: -2, right: -2, width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-blue)', border: '2px solid var(--bg-primary)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <TypeIcon type={notif.type} />
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{notif.user}</span>
                    {notif.guildName && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '8px', flexShrink: 0 }}>{notif.guildName}</span>
                    )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notif.content}
                </div>
                {notif.preview && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '6px', borderLeft: '2px solid var(--stroke)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {notif.preview}
                    </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{notif.date}</div>
            </div>
            <button onClick={(e) => dismissNotification(notif.id, e)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', alignSelf: 'flex-start', flexShrink: 0, transition: 'color 0.2s' }} onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <X size={16} />
            </button>
        </div>
    );

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '24px' }}>
            <div
                role="dialog" aria-modal="true"
                className="notification-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '440px',
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
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={20} color="var(--text-muted)" />
                        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Notifications</h2>
                        {unreadByTab.all > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--error)', color: '#fff', borderRadius: '10px', padding: '1px 7px', minWidth: '18px', textAlign: 'center' }}>
                                {unreadByTab.all > 99 ? '99+' : unreadByTab.all}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Mark Read
                        </button>
                        <button onClick={clearAll} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Clear all notifications">
                            <Trash2 size={14} />
                        </button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ padding: '8px 12px', display: 'flex', gap: '4px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-primary)', overflowX: 'auto' }}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        const count = unreadByTab[tab.id];
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                style={{
                                    background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                                    border: 'none',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                    padding: '5px 10px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                    transition: 'background 0.15s, color 0.15s',
                                    flexShrink: 0,
                                }}
                            >
                                {Icon && <Icon size={13} />}
                                {tab.label}
                                {count > 0 && (
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        background: isActive ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                        color: isActive ? '#fff' : 'var(--text-muted)',
                                        borderRadius: '8px',
                                        padding: '0 5px',
                                        minWidth: '16px',
                                        textAlign: 'center',
                                        lineHeight: '16px',
                                    }}>
                                        {count > 99 ? '99+' : count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Notification List */}
                <div style={{ overflowY: 'auto', flex: 1, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    {isLoading ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '14px' }}>Loading notifications...</span>
                        </div>
                    ) : daySections.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Bell size={32} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>You're all caught up!</h3>
                            <p style={{ fontSize: '14px' }}>
                                {activeTab === 'all' ? 'No new notifications.' : `No ${activeTab} notifications.`}
                            </p>
                        </div>
                    ) : (
                        daySections.map(section => (
                            <div key={section.key}>
                                <div style={{
                                    padding: '8px 24px 4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    position: 'sticky',
                                    top: 0,
                                    background: 'var(--bg-primary)',
                                    zIndex: 1,
                                }}>
                                    {section.label}
                                </div>
                                {section.items.map(item => {
                                    if (isGroup(item)) {
                                        const expanded = expandedGroups.has(item.key);
                                        return (
                                            <div key={item.key}>
                                                <div
                                                    onClick={() => toggleGroup(item.key)}
                                                    style={{
                                                        padding: '10px 24px', borderBottom: '1px solid var(--stroke)',
                                                        display: 'flex', gap: '12px', alignItems: 'center',
                                                        background: item.unreadCount > 0 ? 'rgba(82, 109, 245, 0.05)' : 'transparent',
                                                        cursor: 'pointer', transition: 'background 0.2s',
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                                    onMouseOut={e => e.currentTarget.style.background = item.unreadCount > 0 ? 'rgba(82, 109, 245, 0.05)' : 'transparent'}
                                                >
                                                    <div style={{
                                                        width: '36px', height: '36px', borderRadius: '50%',
                                                        background: 'var(--bg-tertiary)', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--text-muted)', position: 'relative', flexShrink: 0,
                                                    }}>
                                                        <TypeIcon type={item.type} />
                                                        {item.unreadCount > 0 && (
                                                            <div style={{
                                                                position: 'absolute', top: -4, right: -4,
                                                                background: 'var(--accent-blue)', color: 'white',
                                                                borderRadius: '10px', padding: '0 5px',
                                                                fontSize: '10px', fontWeight: 700, minWidth: '16px',
                                                                textAlign: 'center', lineHeight: '16px',
                                                                border: '2px solid var(--bg-primary)',
                                                            }}>{item.unreadCount}</div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {item.label}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                            {item.items[0].date}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        {item.unreadCount > 0 && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); markGroupRead(item); }}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: '4px', fontSize: '11px', fontWeight: 600 }}
                                                                title="Mark group as read"
                                                            >
                                                                <CheckCircle2 size={14} />
                                                            </button>
                                                        )}
                                                        {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                                                    </div>
                                                </div>
                                                {expanded && item.items.map(notif => renderNotification(notif))}
                                            </div>
                                        );
                                    }
                                    return renderNotification(item);
                                })}
                            </div>
                        ))
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
