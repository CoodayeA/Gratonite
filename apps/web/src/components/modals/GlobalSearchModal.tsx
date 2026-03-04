import { useState, useEffect, useRef } from 'react';
import { Search, Hash, MessageSquare, User, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { buildDmRoute, buildGuildChannelRoute, normalizeLegacyRoute } from '../../lib/routes';

type SearchResult = {
    id: string;
    type: 'user' | 'message' | 'channel';
    title: string;
    subtitle: string;
    route: string;
    targetUserId?: string;
};

const GlobalSearchModal = ({ onClose }: { onClose: () => void }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Debounced search
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!query.trim()) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const [users, messages] = await Promise.all([
                    api.users.searchUsers(query).catch(() => []),
                    api.search.messages({ query, limit: 10 }).catch(() => ({ results: [] })),
                ]);

                const combined: SearchResult[] = [];
                for (const u of users as any[]) {
                    combined.push({
                        id: u.id,
                        type: 'user',
                        title: u.displayName || u.username,
                        subtitle: `@${u.username}`,
                        route: '',
                        targetUserId: u.id,
                    });
                }
                for (const m of (messages as any).results || []) {
                    combined.push({
                        id: m.id,
                        type: 'message',
                        title: m.highlight || (m.content?.slice(0, 80) + (m.content?.length > 80 ? '...' : '')) || 'Message',
                        subtitle: `from @${m.authorUsername || 'unknown'}${m.channelName ? ` in #${m.channelName}` : ''}`,
                        route: m.guildId
                            ? buildGuildChannelRoute(m.guildId, m.channelId)
                            : buildDmRoute(m.channelId),
                    });
                }
                setResults(combined);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [query]);

    const handleResultClick = async (result: SearchResult) => {
        try {
            if (result.type === 'user' && result.targetUserId) {
                const dmChannel = await api.relationships.openDm(result.targetUserId) as { id: string };
                navigate(buildDmRoute(dmChannel.id));
            } else {
                navigate(normalizeLegacyRoute(result.route));
            }
            onClose();
        } catch {
            // Keep modal open so user can retry/search another result
        }
    };

    const users = results.filter(r => r.type === 'user');
    const msgs = results.filter(r => r.type === 'message');

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '15vh' }}>
            <div
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '600px',
                    borderRadius: '12px',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke)', gap: '12px', background: 'var(--bg-elevated)' }}>
                    <Search size={20} color="var(--text-muted)" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search across all channels, messages, and users..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '16px', outline: 'none' }}
                    />
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px', fontWeight: 600 }}>ESC</div>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                    {!query ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Search size={32} style={{ opacity: 0.5 }} />
                            <div>Search for messages, users, or channels</div>
                        </div>
                    ) : searching ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Loader size={24} style={{ opacity: 0.5, animation: 'spin 1s linear infinite' }} />
                            <div>Searching...</div>
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {users.length > 0 && (
                                <>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px', marginTop: '8px', marginBottom: '4px' }}>Users</div>
                                    {users.map(u => (
                                        <div key={u.id} className="channel-item" onClick={() => handleResultClick(u)} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar userId={u.id} displayName={u.title} size={24} />
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{u.title}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.subtitle}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                            {msgs.length > 0 && (
                                <>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px', marginTop: '16px', marginBottom: '4px' }}>Messages</div>
                                    {msgs.map(m => (
                                        <div key={m.id} className="channel-item" onClick={() => handleResultClick(m)} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <MessageSquare size={18} color="var(--text-secondary)" />
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{m.title}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.subtitle}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchModal;
