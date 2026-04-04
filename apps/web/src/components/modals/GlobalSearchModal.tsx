import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Hash, MessageSquare, User, Loader, X, SlidersHorizontal, HelpCircle, Bookmark, Trash2, Check, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { RemoteBadge } from '../ui/RemoteBadge';
import { buildDmRoute, buildGuildChannelRoute, normalizeLegacyRoute } from '../../lib/routes';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useDebounce } from '../../hooks/useDebounce';

const SAVED_SEARCHES_KEY = 'gratonite:saved-searches';

type SavedSearch = {
    id: string;
    query: string;
    createdAt: string;
};

function loadSavedSearches(): SavedSearch[] {
    try {
        return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]');
    } catch {
        return [];
    }
}

function persistSavedSearches(list: SavedSearch[]) {
    try {
        localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

type SearchResult = {
    id: string;
    type: 'user' | 'message' | 'channel';
    title: string;
    subtitle: string;
    route: string;
    targetUserId?: string;
    avatarHash?: string | null;
    isFederated?: boolean;
    federationAddress?: string | null;
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
    const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsScrollRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const debouncedQuery = useDebounce(query, 300);

    const saveSearch = useCallback((q: string) => {
        const trimmed = q.trim();
        if (!trimmed) return;
        setSavedSearches(prev => {
            if (prev.some(s => s.query === trimmed)) return prev;
            const next = [{ id: Date.now().toString(), query: trimmed, createdAt: new Date().toISOString() }, ...prev].slice(0, 20);
            persistSavedSearches(next);
            return next;
        });
    }, []);

    const deleteSearch = useCallback((id: string) => {
        setSavedSearches(prev => {
            const next = prev.filter(s => s.id !== id);
            persistSavedSearches(next);
            return next;
        });
    }, []);

    const commitRename = useCallback((id: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed) { setRenamingId(null); return; }
        setSavedSearches(prev => {
            const next = prev.map(s => s.id === id ? { ...s, query: trimmed } : s);
            persistSavedSearches(next);
            return next;
        });
        setRenamingId(null);
    }, [renameValue]);

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
                        isFederated: (u as any).isFederated ?? false,
                        federationAddress: (u as any).federationAddress ?? null,
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

    // Flat virtualized result rows: section headers + items
    type VRow =
        | { kind: 'section'; label: string }
        | { kind: 'user'; result: SearchResult }
        | { kind: 'message'; result: SearchResult };

    const virtualRows = useMemo<VRow[]>(() => {
        const rows: VRow[] = [];
        if (users.length > 0) {
            rows.push({ kind: 'section', label: 'Users' });
            users.forEach(u => rows.push({ kind: 'user', result: u }));
        }
        if (msgs.length > 0) {
            rows.push({ kind: 'section', label: 'Messages' });
            msgs.forEach(m => rows.push({ kind: 'message', result: m }));
        }
        return rows;
    }, [users, msgs]);

    const rowVirtualizer = useVirtualizer({
        count: virtualRows.length,
        getScrollElement: () => resultsScrollRef.current,
        estimateSize: (i) => virtualRows[i]?.kind === 'section' ? 32 : 52,
        overscan: 5,
    });

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: isMobile ? '0' : '15vh' }}>
            <div
                role="dialog" aria-modal="true"
                aria-label="Search"
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
                    <button
                        onClick={() => setShowSyntaxHelp(h => !h)}
                        title="Search syntax help"
                        aria-label="Search syntax help"
                        style={{ background: 'none', border: 'none', color: showSyntaxHelp ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                        <HelpCircle size={18} />
                    </button>
                    {isMobile ? (
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                            <X size={20} />
                        </button>
                    ) : (
                        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px', fontWeight: 600 }}>ESC</div>
                    )}
                </div>

                {/* Syntax help panel */}
                {showSyntaxHelp && (
                    <div style={{ padding: '12px 16px', background: 'rgba(88,101,242,0.06)', borderBottom: '1px solid var(--stroke)', fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Search operators</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[
                                ['from:alice', 'Messages from a specific user'],
                                ['has:image', 'Messages with images attached'],
                                ['has:file', 'Messages with any file attached'],
                                ['has:embed', 'Messages with link embeds'],
                                ['has:link', 'Messages containing a URL'],
                                ['in:channel-name', 'Messages in a specific channel'],
                                ['before:2024-01-01', 'Messages before a date'],
                                ['after:2024-01-01', 'Messages after a date'],
                            ].map(([op, desc]) => (
                                <div key={op} style={{ display: 'flex', gap: 12, color: 'var(--text-secondary)', alignItems: 'baseline' }}>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', whiteSpace: 'nowrap', minWidth: 140 }}>{op}</span>
                                    <span>{desc}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>Combine operators: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>from:alice has:file before:2024-06-01</span></div>
                    </div>
                )}

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

                <div style={{ flex: isMobile ? 1 : undefined, maxHeight: isMobile ? undefined : '400px', overflowY: 'auto', background: 'var(--bg-primary)' }} ref={resultsScrollRef}>
                    {!query ? (
                        /* Empty query — show saved searches or hint */
                        savedSearches.length === 0 ? (
                            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Search size={32} style={{ opacity: 0.5 }} />
                                <div>Search for messages, users, or channels</div>
                            </div>
                        ) : (
                            <div style={{ padding: '8px 0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Saved Searches</span>
                                    <button onClick={() => { setSavedSearches([]); persistSavedSearches([]); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', borderRadius: 4 }}>Clear all</button>
                                </div>
                                {savedSearches.map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {renamingId === s.id ? (
                                            <>
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                    style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: 4, padding: '3px 6px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                                                />
                                                <button onClick={() => commitRename(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', padding: 2 }}><Check size={14} /></button>
                                                <button onClick={() => setRenamingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}><X size={14} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <Bookmark size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                <span onClick={() => setQuery(s.query)} style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.query}</span>
                                                <button onClick={() => { setRenamingId(s.id); setRenameValue(s.query); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, opacity: 0.7 }} title="Rename"><Pencil size={12} /></button>
                                                <button onClick={() => deleteSearch(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, opacity: 0.7 }} title="Delete"><Trash2 size={12} /></button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
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
                        <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                No results found for &quot;{query}&quot;
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                    onClick={() => saveSearch(query)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                    <Bookmark size={12} /> Save search
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Virtualized results */
                        <div>
                            {/* Save search toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 2px', borderBottom: '1px solid var(--stroke)' }}>
                                <button
                                    onClick={() => saveSearch(query)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                    title="Save this search"
                                >
                                    <Bookmark size={12} /> Save search
                                </button>
                            </div>
                            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map(vItem => {
                                    const row = virtualRows[vItem.index];
                                    return (
                                        <div
                                            key={vItem.key}
                                            data-index={vItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
                                        >
                                            {row.kind === 'section' ? (
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 24px 4px' }}>{row.label}</div>
                                            ) : row.kind === 'user' ? (
                                                <div className="channel-item" onClick={() => handleResultClick(row.result)} style={{ cursor: 'pointer', padding: '8px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Avatar userId={row.result.id} displayName={row.result.title} avatarHash={row.result.avatarHash} size={24} />
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center' }}>{row.result.title}{row.result.isFederated && <RemoteBadge address={row.result.federationAddress} />}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.result.subtitle}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="channel-item" onClick={() => handleResultClick(row.result)} style={{ cursor: 'pointer', padding: '8px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <MessageSquare size={18} color="var(--text-secondary)" />
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{row.result.title}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.result.subtitle}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchModal;
