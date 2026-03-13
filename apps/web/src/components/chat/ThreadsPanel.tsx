import { useState, useEffect, useMemo } from 'react';
import { X, MessageSquare, Search, Filter, Clock, Archive, Users, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { onThreadCreate } from '../../lib/socket';

type ThreadItem = {
    id: string;
    name: string;
    messageCount: number;
    createdAt: string;
    archived: boolean;
    creatorId?: string;
    creatorName?: string;
    lastActivityAt?: string;
    participantCount?: number;
};

type FilterTab = 'active' | 'archived';
type SortOption = 'recent' | 'participants' | 'replies';

interface ThreadsPanelProps {
    channelId: string;
    onClose: () => void;
    onThreadSelect?: (threadId: string) => void;
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

const ThreadsPanel = ({ channelId, onClose, onThreadSelect }: ThreadsPanelProps) => {
    const [threads, setThreads] = useState<ThreadItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterTab, setFilterTab] = useState<FilterTab>('active');
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

    // Fetch threads from API
    useEffect(() => {
        if (!channelId) return;
        setLoading(true);
        api.threads.list(channelId)
            .then((data: any[]) => {
                const items: ThreadItem[] = data.map((t: any) => ({
                    id: t.id,
                    name: t.name || 'Untitled Thread',
                    messageCount: t.messageCount ?? 0,
                    createdAt: t.createdAt,
                    archived: t.archived ?? false,
                    creatorId: t.creatorId,
                    creatorName: t.creatorName ?? 'Unknown',
                    lastActivityAt: t.lastActivityAt || t.updatedAt || t.createdAt,
                    participantCount: t.participantCount ?? 0,
                }));
                setThreads(items);
            })
            .catch(() => setThreads([]))
            .finally(() => setLoading(false));
    }, [channelId]);

    // Listen for new threads
    useEffect(() => {
        if (!channelId) return;
        const unsub = onThreadCreate((data: any) => {
            if (data.channelId !== channelId) return;
            setThreads(prev => {
                if (prev.some(t => t.id === data.id)) return prev;
                return [{
                    id: data.id,
                    name: data.name || 'Untitled Thread',
                    messageCount: 0,
                    createdAt: data.createdAt || new Date().toISOString(),
                    archived: false,
                    creatorId: data.creatorId,
                    creatorName: data.creatorName ?? 'Unknown',
                    lastActivityAt: data.createdAt || new Date().toISOString(),
                    participantCount: 1,
                }, ...prev];
            });
        });
        return unsub;
    }, [channelId]);

    const filtered = useMemo(() => {
        let result = threads
            .filter(t => filterTab === 'active' ? !t.archived : t.archived)
            .filter(t => !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

        switch (sortBy) {
            case 'recent':
                result.sort((a, b) => new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime());
                break;
            case 'participants':
                result.sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0));
                break;
            case 'replies':
                result.sort((a, b) => b.messageCount - a.messageCount);
                break;
        }
        return result;
    }, [threads, filterTab, sortBy, searchQuery]);

    const activeCount = threads.filter(t => !t.archived).length;
    const archivedCount = threads.filter(t => t.archived).length;

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div style={{
            width: '340px', flexShrink: 0, borderLeft: '1px solid var(--stroke)',
            background: 'var(--bg-secondary, #2f3136)', display: 'flex', flexDirection: 'column',
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
        }}>
            {/* Header */}
            <div style={{
                padding: '16px', borderBottom: '1px solid var(--stroke)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={18} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Threads</h3>
                    <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                        background: 'rgba(82, 109, 245, 0.12)', color: 'var(--accent-primary)',
                    }}>
                        {activeCount}
                    </span>
                </div>
                <button onClick={onClose} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '4px', borderRadius: '4px',
                }}>
                    <X size={18} />
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--stroke)' }}>
                {([
                    { key: 'active' as FilterTab, label: 'Active', count: activeCount },
                    { key: 'archived' as FilterTab, label: 'Archived', count: archivedCount },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilterTab(tab.key)}
                        style={{
                            flex: 1, padding: '10px', background: 'transparent', border: 'none',
                            borderBottom: filterTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: filterTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        {tab.key === 'archived' && <Archive size={13} />}
                        {tab.label}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({tab.count})</span>
                    </button>
                ))}
            </div>

            {/* Search + Sort */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '6px 10px',
                    border: '1px solid var(--stroke)',
                }}>
                    <Search size={14} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Search threads..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: '13px',
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'transparent', border: 'none', color: 'var(--text-muted)',
                            fontSize: '12px', cursor: 'pointer', fontWeight: 500,
                        }}
                    >
                        <Filter size={12} />
                        Sort: {sortBy === 'recent' ? 'Recent activity' : sortBy === 'participants' ? 'Most participants' : 'Most replies'}
                        <ChevronDown size={12} />
                    </button>
                    {sortDropdownOpen && (
                        <div style={{
                            position: 'absolute', top: '24px', left: 0, zIndex: 50,
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: '8px', padding: '4px', minWidth: '180px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}>
                            {([
                                { value: 'recent' as SortOption, label: 'Recent activity' },
                                { value: 'participants' as SortOption, label: 'Most participants' },
                                { value: 'replies' as SortOption, label: 'Most replies' },
                            ]).map(s => (
                                <div
                                    key={s.value}
                                    onClick={() => { setSortBy(s.value); setSortDropdownOpen(false); }}
                                    style={{
                                        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                                        fontSize: '13px', fontWeight: sortBy === s.value ? 600 : 400,
                                        color: sortBy === s.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        background: sortBy === s.value ? 'var(--bg-tertiary)' : 'transparent',
                                    }}
                                >
                                    {s.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Thread List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                        <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                        <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                            {searchQuery ? 'No threads found' : filterTab === 'archived' ? 'No archived threads' : 'No active threads'}
                        </p>
                        <p style={{ fontSize: '13px' }}>
                            {searchQuery ? 'Try a different search term.' : 'Start a thread by replying to a message.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {filtered.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => onThreadSelect?.(thread.id)}
                                style={{
                                    padding: '12px', borderRadius: '8px', cursor: 'pointer',
                                    background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    {thread.archived ? (
                                        <Archive size={14} color="var(--text-muted)" />
                                    ) : (
                                        <MessageSquare size={14} color="var(--accent-primary)" />
                                    )}
                                    <span style={{
                                        flex: 1, fontSize: '14px', fontWeight: 600,
                                        color: 'var(--text-primary)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {thread.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <MessageSquare size={11} /> {thread.messageCount}
                                    </span>
                                    {(thread.participantCount ?? 0) > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={11} /> {thread.participantCount}
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                        <Clock size={11} /> {timeAgo(thread.lastActivityAt || thread.createdAt)}
                                    </span>
                                </div>
                                {thread.creatorName && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        by {thread.creatorName}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ThreadsPanel;
