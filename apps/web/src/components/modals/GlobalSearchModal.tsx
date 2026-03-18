import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Hash, MessageSquare, User, Loader, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { buildDmRoute, buildGuildChannelRoute, normalizeLegacyRoute } from '../../lib/routes';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useDebounce } from '../../hooks/useDebounce';

type SearchResult = {
    id: string;
    type: 'user' | 'message' | 'channel';
    title: string;
    subtitle: string;
    route: string;
    targetUserId?: string;
    avatarHash?: string | null;
};

/** Parse inline search operators from the query string */
function parseSearchOperators(raw: string): {
    text: string;
    from: string;
    has: string;
    before: string;
    after: string;
    inChannel: string;
} {
    let text = raw;
    let from = '';
    let has = '';
    let before = '';
    let after = '';
    let inChannel = '';

    // Extract known operators
    const operatorRe = /\b(from|has|before|after|in):(\S+)/gi;
    text = raw.replace(operatorRe, (_, op, value) => {
        switch (op.toLowerCase()) {
            case 'from': from = value; break;
            case 'has': has = value; break;
            case 'before': before = value; break;
            case 'after': after = value; break;
            case 'in': inChannel = value; break;
        }
        return '';
    }).trim();

    return { text, from, has, before, after, inChannel };
}

const GlobalSearchModal = ({ onClose }: { onClose: () => void }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [filterFrom, setFilterFrom] = useState('');
    const [filterBefore, setFilterBefore] = useState('');
    const [filterAfter, setFilterAfter] = useState('');
    const [filterHas, setFilterHas] = useState('');
    const [filterInChannel, setFilterInChannel] = useState('');
    const [filterMentionsMe, setFilterMentionsMe] = useState(false);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const debouncedQuery = useDebounce(query, 300);

    // Parse inline operators from the query
    const parsed = useMemo(() => parseSearchOperators(query), [query]);
    // Effective filter values: inline operators take precedence, then UI filter fields
    const effectiveFrom = parsed.from || filterFrom;
    const effectiveHas = parsed.has || filterHas;
    const effectiveBefore = parsed.before || filterBefore;
    const effectiveAfter = parsed.after || filterAfter;
    const effectiveInChannel = parsed.inChannel || filterInChannel;
    const effectiveText = parsed.text;

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Show loading indicator while debouncing
    useEffect(() => {
        if (query.trim() && query !== debouncedQuery) setSearching(true);
    }, [query, debouncedQuery]);

    // Debounced search
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        setSearchError(false);
        let cancelled = false;
        (async () => {
            try {
                const searchParams: { query: string; limit: number; authorId?: string; channelId?: string; before?: string; after?: string; has?: string; mentionsMe?: boolean } = { query: effectiveText || debouncedQuery, limit: 15 };
                if (effectiveFrom.trim()) searchParams.authorId = effectiveFrom.trim();
                if (effectiveInChannel.trim()) searchParams.channelId = effectiveInChannel.trim();
                if (effectiveBefore) searchParams.before = effectiveBefore;
                if (effectiveAfter) searchParams.after = effectiveAfter;
                if (effectiveHas) searchParams.has = effectiveHas;
                if (filterMentionsMe) searchParams.mentionsMe = true;

                const hasMessageFilters = !!(effectiveFrom || effectiveInChannel || effectiveBefore || effectiveAfter || effectiveHas || filterMentionsMe);
                const [users, messages] = await Promise.all([
                    hasMessageFilters ? [] : api.users.searchUsers(effectiveText || debouncedQuery).catch(() => []),
                    api.search.messages(searchParams).catch(() => ({ results: [] })),
                ]);

                if (cancelled) return;
                const combined: SearchResult[] = [];
                for (const u of users as Array<Record<string, string>>) {
                    combined.push({
                        id: u.id,
                        type: 'user',
                        title: u.displayName || u.username,
                        subtitle: `@${u.username}`,
                        route: '',
                        targetUserId: u.id,
                        avatarHash: u.avatarHash || null,
                    });
                }
                for (const m of ((messages as Record<string, unknown>).results ?? []) as Array<Record<string, string>>) {
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
                if (!cancelled) { setResults([]); setSearchError(true); }
            } finally {
                if (!cancelled) setSearching(false);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedQuery, effectiveText, effectiveFrom, effectiveInChannel, effectiveBefore, effectiveAfter, effectiveHas, filterMentionsMe, retryCount]);

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
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: isMobile ? '0' : '15vh' }}>
            <div
                role="dialog" aria-modal="true"
                className="glass-panel"
                onClick={e => e.stopPropagation()}
                style={{
                    width: isMobile ? '100%' : 'min(600px, 95vw)',
                    borderRadius: isMobile ? '0' : '12px',
                    border: isMobile ? 'none' : '1px solid var(--stroke)',
                    boxShadow: isMobile ? 'none' : '0 20px 40px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    height: isMobile ? '100vh' : 'auto',
                    maxHeight: isMobile ? '100vh' : '90vh',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid var(--stroke)', gap: '12px', background: 'var(--bg-elevated)' }}>
                    <Search size={20} color="var(--text-muted)" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search... (try from:user has:file in:channel)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '16px', outline: 'none' }}
                    />
                    {isMobile ? (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                            <X size={20} />
                        </button>
                    ) : (
                        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px', fontWeight: 600 }}>ESC</div>
                    )}
                </div>

                {/* Advanced search filters — collapsible on mobile */}
                {isMobile && (
                    <button
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-elevated)', border: 'none', borderBottom: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', width: '100%' }}
                    >
                        <SlidersHorizontal size={14} />
                        Filters
                        {(filterFrom || filterBefore || filterAfter || filterHas || filterInChannel) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                    </button>
                )}
                {/* Active filter chips (from inline operators or manual filters) */}
                {(effectiveFrom || effectiveHas || effectiveBefore || effectiveAfter || effectiveInChannel) && (
                    <div style={{ display: 'flex', gap: 6, padding: '6px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)' }}>
                        {effectiveFrom && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                from:{effectiveFrom}
                                <button onClick={() => { setFilterFrom(''); setQuery(q => q.replace(/\bfrom:\S+/gi, '').trim()); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}><X size={10} /></button>
                            </span>
                        )}
                        {effectiveInChannel && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                in:{effectiveInChannel}
                                <button onClick={() => { setFilterInChannel(''); setQuery(q => q.replace(/\bin:\S+/gi, '').trim()); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}><X size={10} /></button>
                            </span>
                        )}
                        {effectiveHas && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                has:{effectiveHas}
                                <button onClick={() => { setFilterHas(''); setQuery(q => q.replace(/\bhas:\S+/gi, '').trim()); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}><X size={10} /></button>
                            </span>
                        )}
                        {effectiveBefore && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                before:{effectiveBefore}
                                <button onClick={() => { setFilterBefore(''); setQuery(q => q.replace(/\bbefore:\S+/gi, '').trim()); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}><X size={10} /></button>
                            </span>
                        )}
                        {effectiveAfter && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                after:{effectiveAfter}
                                <button onClick={() => { setFilterAfter(''); setQuery(q => q.replace(/\bafter:\S+/gi, '').trim()); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}><X size={10} /></button>
                            </span>
                        )}
                    </div>
                )}
                {(!isMobile || filtersExpanded) && (
                    <div style={{ display: 'flex', gap: 8, padding: '8px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', opacity: searching ? 0.5 : 1, pointerEvents: searching ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                        <input placeholder="from:user" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} disabled={searching} style={{ flex: '1 1 100px', minWidth: 80, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }} />
                        <input placeholder="in:channel" value={filterInChannel} onChange={e => setFilterInChannel(e.target.value)} disabled={searching} style={{ flex: '1 1 100px', minWidth: 80, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }} />
                        <input type="date" value={filterAfter} onChange={e => setFilterAfter(e.target.value)} disabled={searching} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }} title="After date" />
                        <input type="date" value={filterBefore} onChange={e => setFilterBefore(e.target.value)} disabled={searching} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }} title="Before date" />
                        <select value={filterHas} onChange={e => setFilterHas(e.target.value)} disabled={searching} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }}>
                            <option value="">has:...</option>
                            <option value="file">file</option>
                            <option value="image">image</option>
                            <option value="embed">embed</option>
                            <option value="link">link</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--stroke)', background: filterMentionsMe ? 'rgba(88,101,242,0.15)' : 'var(--bg-primary)', cursor: searching ? 'not-allowed' : 'pointer', fontSize: 12, color: filterMentionsMe ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: filterMentionsMe ? 600 : 400, whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={filterMentionsMe} onChange={e => setFilterMentionsMe(e.target.checked)} disabled={searching} style={{ accentColor: 'var(--accent-primary)' }} />
                            @mentions me
                        </label>
                    </div>
                )}

                <div style={{ flex: isMobile ? 1 : undefined, maxHeight: isMobile ? undefined : '400px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
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
                    ) : searchError ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            <div style={{ marginBottom: '8px' }}>Search failed. Please try again.</div>
                            <button onClick={() => { setSearchError(false); setRetryCount(c => c + 1); }} style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            No results found for &quot;{query}&quot;
                        </div>
                    ) : (
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {users.length > 0 && (
                                <>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px', marginTop: '8px', marginBottom: '4px' }}>Users</div>
                                    {users.map(u => (
                                        <div key={u.id} className="channel-item" onClick={() => handleResultClick(u)} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar userId={u.id} displayName={u.title} avatarHash={u.avatarHash} size={24} />
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
