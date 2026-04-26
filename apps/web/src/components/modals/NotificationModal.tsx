import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, CheckCircle2, Trash2, X, ChevronDown, ChevronRight, MessageSquare, Heart, UserPlus, Mail, Settings, Gavel, BellOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import { useConfirm } from '../ui/ConfirmDialog';
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
    trustSummary?: string | null;
};

type NotificationTrustExplanation = {
    version: 1;
    type: string;
    summary: string;
    requiredLevel: 'all' | 'mentions' | 'always';
    effectiveLevel: 'all' | 'mentions' | 'nothing' | 'always';
    sourceScope: 'channel' | 'guild' | 'guild_default' | 'app_default' | 'direct' | 'system';
    sourceLabel: string;
    muted: boolean;
    mutedUntil: string | null;
    quietHoursActive: boolean;
    presence: string | null;
    realtimeSuppressed: boolean;
    delivery: 'realtime' | 'inbox_only';
    precedence: string[];
    details: string[];
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
const SNOOZE_KEY = 'gratonite:notif-snooze';

const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getFilterCategory(type: string): FilterTab {
    switch (type) {
        case 'mention': return 'mentions';
        case 'forum_reply': return 'mentions';
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
        case 'forum_reply': return <MessageSquare size={16} />;
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
    const { confirm } = useConfirm();
    const [activeTab, setActiveTab] = useState<FilterTab>(getSavedFilter);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [snoozedUntil, setSnoozedUntil] = useState<number | null>(() => {
        try { const v = localStorage.getItem(SNOOZE_KEY); return v ? Number(v) : null; } catch { return null; }
    });
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [explanations, setExplanations] = useState<Record<string, NotificationTrustExplanation | null>>({});
    const [openExplanations, setOpenExplanations] = useState<Set<string>>(new Set());
    const [loadingExplanationId, setLoadingExplanationId] = useState<string | null>(null);

    const handleTabChange = useCallback((tab: FilterTab) => {
        setActiveTab(tab);
        try { localStorage.setItem(FILTER_STORAGE_KEY, tab); } catch {}
    }, []);

    const dismissSnooze = useCallback(() => {
        setSnoozedUntil(null);
        try { localStorage.removeItem(SNOOZE_KEY); } catch {}
    }, []);

    const snooze = (minutes: number | 'tomorrow') => {
        let until: number;
        if (minutes === 'tomorrow') {
            const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0);
            until = d.getTime();
        } else {
            until = Date.now() + minutes * 60000;
        }
        setSnoozedUntil(until);
        try { localStorage.setItem(SNOOZE_KEY, String(until)); } catch {}
        setShowSnoozeMenu(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    // These must be declared before allVisibleIds to avoid TDZ when the
    // dependency array [daySections] is evaluated.
    const filtered = useMemo(() => {
        if (activeTab === 'all') return notifications;
        return notifications.filter(n => getFilterCategory(n.type) === activeTab);
    }, [notifications, activeTab]);

    const grouped = useMemo(() => groupNotifications(filtered), [filtered]);
    const daySections = useMemo(() => groupByDay(grouped), [grouped]);

    const allVisibleIds = useMemo(() => {
        const ids: string[] = [];
        for (const section of daySections) {
            for (const item of section.items) {
                if (isGroup(item)) item.items.forEach(n => ids.push(n.id));
                else ids.push(item.id);
            }
        }
        return ids;
    }, [daySections]);

    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(allVisibleIds));
    };

    const bulkMarkRead = () => {
        const ids = [...selectedIds];
        Promise.all(ids.map(id => api.notifications.markRead(id))).catch(() => {});
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
        setSelectedIds(new Set());
    };

    const bulkDismiss = () => {
        const ids = [...selectedIds];
        Promise.all(ids.map(id => api.notifications.dismiss(id))).catch(() => {});
        setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
        setSelectedIds(new Set());
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    useEffect(() => {
        if (snoozedUntil && snoozedUntil < Date.now()) dismissSnooze();
    }, []);

    useEffect(() => {
        if (!showSnoozeMenu) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element;
            if (!target.closest('.snooze-menu-container')) setShowSnoozeMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSnoozeMenu]);

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
                    trustSummary: n.trustSummary,
                }));
                setNotifications(mapped);
            })
            .catch(() => {
                addToast({ title: 'Failed to load notifications', variant: 'error' });
            })
            .finally(() => setIsLoading(false));
    }, []);

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

    const clearAll = async () => {
        if (notifications.length === 0) return;
        const ok = await confirm({
            title: 'Clear all notifications?',
            message: `This will permanently dismiss all ${notifications.length} notification${notifications.length === 1 ? '' : 's'}. You can't undo this.`,
            confirmLabel: 'Clear all',
            variant: 'danger',
        });
        if (!ok) return;
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

    const toggleExplanation = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenExplanations(prev => {
            const next = new Set(prev);
            if (next.has(notif.id)) next.delete(notif.id);
            else next.add(notif.id);
            return next;
        });

        if (explanations[notif.id] || loadingExplanationId === notif.id) return;

        setLoadingExplanationId(notif.id);
        try {
            const explanation = await api.notifications.explain(notif.id);
            setExplanations(prev => ({ ...prev, [notif.id]: explanation }));
        } catch {
            addToast({ title: 'Could not load notification explanation', variant: 'error' });
            setOpenExplanations(prev => {
                const next = new Set(prev);
                next.delete(notif.id);
                return next;
            });
        } finally {
            setLoadingExplanationId(current => current === notif.id ? null : current);
        }
    };

    const renderNotification = (notif: Notification) => (
        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="hover-notif-item" style={{ padding: '12px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', gap: '12px', background: notif.read ? 'transparent' : 'rgba(82, 109, 245, 0.05)', cursor: 'pointer', transition: 'background 0.2s' }}>
            <input
                type="checkbox"
                checked={selectedIds.has(notif.id)}
                onChange={e => { e.stopPropagation(); toggleSelect(notif.id); }}
                onClick={e => e.stopPropagation()}
                style={{ marginRight: '8px', marginTop: '4px', cursor: 'pointer', accentColor: 'var(--accent-blue)', flexShrink: 0 }}
            />
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
                <button
                    onClick={(e) => toggleExplanation(notif, e)}
                    style={{ marginTop: '8px', background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' as const }}
                >
                    {openExplanations.has(notif.id) ? 'Hide why I got this' : 'Why did I get this?'}
                </button>
                {openExplanations.has(notif.id) && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                        {loadingExplanationId === notif.id && !explanations[notif.id] ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading explanation…</div>
                        ) : (
                            <>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                    {explanations[notif.id]?.summary || notif.trustSummary || 'This notification matched your current delivery settings.'}
                                </div>
                                {explanations[notif.id]?.details?.length ? (
                                    <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
                                        {explanations[notif.id]?.details.map((detail) => (
                                            <li key={detail}>{detail}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </>
                        )}
                    </div>
                )}
            </div>
            <button onClick={(e) => dismissNotification(notif.id, e)} className="hover-text-primary" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', alignSelf: 'flex-start', flexShrink: 0, transition: 'color 0.2s' }}>
                <X size={16} />
            </button>
        </div>
    );

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '24px' }}>
            <div
                role="dialog" aria-modal="true"
                aria-label="Notifications"
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
                    maxHeight: 'calc(100dvh - 48px)',
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
                        <button onClick={markAllRead} title="Mark all as read" style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Mark all read
                        </button>
                        <div className="snooze-menu-container" style={{ position: 'relative' }}>
                            <button onClick={() => setShowSnoozeMenu(v => !v)} title="Snooze notifications" style={{ background: 'transparent', border: 'none', color: snoozedUntil ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <BellOff size={14} /> Snooze
                            </button>
                            {showSnoozeMenu && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, minWidth: '160px', overflow: 'hidden' }}>
                                    {([{ label: '15 minutes', value: 15 as const }, { label: '1 hour', value: 60 as const }, { label: '8 hours', value: 480 as const }, { label: 'Tomorrow 8am', value: 'tomorrow' as const }] as { label: string; value: number | 'tomorrow' }[]).map(opt => (
                                        <button key={opt.label} onClick={() => snooze(opt.value)} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}
                                            className="hover-notif-item">
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedIds.size > 0 && (
                            <button onClick={toggleSelectAll} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        <button onClick={clearAll} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Clear all notifications">
                            <Trash2 size={14} />
                        </button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Snooze banner */}
                {snoozedUntil && snoozedUntil > Date.now() && (
                    <div style={{ padding: '8px 16px', background: 'rgba(82, 109, 245, 0.15)', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <BellOff size={14} color="var(--accent-blue)" />
                        <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                            Notifications snoozed until {new Date(snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button onClick={dismissSnooze} style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Dismiss</button>
                    </div>
                )}

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

                {/* Bulk toolbar */}
                {selectedIds.size > 0 && (
                    <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>{selectedIds.size} selected</span>
                        <button onClick={bulkMarkRead} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} />Mark Read
                        </button>
                        <button onClick={bulkDismiss} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--error)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Trash2 size={12} />Dismiss
                        </button>
                    </div>
                )}

                {/* Notification List */}
                <div style={{ overflowY: 'auto', flex: 1, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    {isLoading ? (
                        <div role="status" aria-label="Loading notifications">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} style={{ padding: '12px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ width: `${50 + (i % 3) * 15}%`, height: '12px', borderRadius: '4px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        <div style={{ width: `${70 - (i % 4) * 10}%`, height: '10px', borderRadius: '4px', background: 'var(--bg-tertiary)', opacity: 0.7, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                    </div>
                                </div>
                            ))}
                            <span style={{ position: 'absolute', left: '-9999px' }}>Loading notifications...</span>
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
                                                    className="hover-notif-item"
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
