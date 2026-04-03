import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, FileText, Calendar, User, Hash, X, Bookmark, BookmarkPlus, Trash2, Edit2, Check, ChevronDown, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState } from '../../components/ui/EmptyState';

interface SearchResult {
  id: string;
  channelId: string;
  channelName: string | null;
  guildId: string | null;
  guildName: string | null;
  content: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  } | null;
}

interface SearchFilters {
  guildId?: string;
  channelId?: string;
  authorId?: string;
  /** Matches `GET /search/messages` `has` (file \| image \| embed \| link). */
  has?: string;
  mentionsMe?: boolean;
  before?: string;
  after?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: string;
}

const SAVED_SEARCHES_KEY = 'gratonite_saved_searches_v1';

const SEARCH_LIMIT = 25;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { guildId: routeGuildId } = useParams<{ guildId: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSavedPanel, setShowSavedPanel] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Load saved searches from localStorage on mount (migrate legacy `hasFile` → `has`)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<SavedSearch & { filters?: SearchFilters & { hasFile?: string } }>;
        const migrated = parsed.map(s => {
          const f = s.filters as SearchFilters & { hasFile?: string };
          if (f?.hasFile) {
            const { hasFile, ...rest } = f;
            return { ...s, filters: { ...rest, has: 'file' } };
          }
          return s as SavedSearch;
        });
        setSavedSearches(migrated);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Default server filter to current guild when opened from /guild/:guildId/search
  useEffect(() => {
    if (!routeGuildId) return;
    setFilters(prev => (prev.guildId ? prev : { ...prev, guildId: routeGuildId }));
  }, [routeGuildId]);

  // Persist saved searches to localStorage
  const persistSavedSearches = useCallback((searches: SavedSearch[]) => {
    try {
      localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveCurrentSearch = useCallback(() => {
    if (!newSearchName.trim()) return;

    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: newSearchName.trim(),
      query: query.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    persistSavedSearches(updated);
    setNewSearchName('');
    setIsSaving(false);
  }, [newSearchName, query, filters, savedSearches, persistSavedSearches]);

  const deleteSavedSearch = useCallback((id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    persistSavedSearches(updated);
  }, [savedSearches, persistSavedSearches]);

  const doSearchWithParams = useCallback(async (searchQuery: string, searchFilters: SearchFilters, searchOffset = 0, append = false) => {
    if (searchQuery.trim().length < 2) return;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setSearched(true);
      setError(false);
    }
    try {
      const data = await api.search.messages({
        query: searchQuery.trim(),
        guildId: searchFilters.guildId,
        channelId: searchFilters.channelId,
        authorId: searchFilters.authorId,
        before: searchFilters.before,
        after: searchFilters.after,
        has: searchFilters.has,
        mentionsMe: searchFilters.mentionsMe,
        limit: SEARCH_LIMIT,
        offset: searchOffset,
      });
      const newResults = data.results as SearchResult[];
      setResults(prev => append ? [...prev, ...newResults] : newResults);
      setHasMore(newResults.length >= SEARCH_LIMIT);
    } catch {
      setError(true);
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const applySavedSearch = useCallback((saved: SavedSearch) => {
    setQuery(saved.query);
    setFilters(saved.filters);
    setOffset(0);
    setHasMore(false);
    // Trigger search immediately
    setTimeout(() => {
      if (saved.query.trim().length >= 2) {
        doSearchWithParams(saved.query, saved.filters, 0, false);
      }
    }, 0);
  }, [doSearchWithParams]);

  const startEditing = useCallback((saved: SavedSearch) => {
    setEditingId(saved.id);
    setEditName(saved.name);
  }, []);

  const saveEdit = useCallback((id: string) => {
    if (!editName.trim()) return;
    const updated = savedSearches.map(s =>
      s.id === id ? { ...s, name: editName.trim() } : s
    );
    setSavedSearches(updated);
    persistSavedSearches(updated);
    setEditingId(null);
    setEditName('');
  }, [editName, savedSearches, persistSavedSearches]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  const doSearch = useCallback(() => {
    setOffset(0);
    setHasMore(false);
    doSearchWithParams(query, filters, 0, false);
  }, [query, filters, doSearchWithParams]);

  const loadMore = useCallback(() => {
    const nextOffset = offset + SEARCH_LIMIT;
    setOffset(nextOffset);
    doSearchWithParams(query, filters, nextOffset, true);
  }, [query, filters, offset, doSearchWithParams]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  const navigateToMessage = (result: SearchResult) => {
    if (result.guildId && result.channelId) {
      navigate(`/guild/${result.guildId}/channel/${result.channelId}`);
    }
  };

  const toggleFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Search Messages</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search messages..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 6,
                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={doSearch}
            disabled={loading || query.trim().length < 2}
            style={{
              padding: '10px 20px', borderRadius: 6, border: 'none',
              background: 'var(--accent-primary)', color: '#000', fontWeight: 600,
              cursor: query.trim().length < 2 ? 'not-allowed' : 'pointer', fontSize: 14,
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {/* Save search button */}
          <button
            onClick={() => setIsSaving(true)}
            disabled={!query.trim()}
            title="Save this search"
            style={{
              padding: '10px 12px', borderRadius: 6, border: '1px solid var(--stroke)',
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              cursor: query.trim() ? 'pointer' : 'not-allowed', fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <BookmarkPlus size={16} />
            Save
          </button>
        </div>

        {/* Save search dialog */}
        {isSaving && (
          <div style={{
            padding: 12, marginBottom: 16, borderRadius: 8,
            background: 'var(--bg-secondary)', border: '1px solid var(--stroke)',
            display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <Bookmark size={16} color="var(--accent-primary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Name this search:</span>
            <input
              type="text"
              placeholder="e.g., Bug reports from team"
              value={newSearchName}
              onChange={e => setNewSearchName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCurrentSearch(); if (e.key === 'Escape') setIsSaving(false); }}
              autoFocus
              style={{
                flex: 1, minWidth: 150, padding: '6px 10px', borderRadius: 4,
                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={saveCurrentSearch}
              disabled={!newSearchName.trim()}
              style={{
                padding: '6px 12px', borderRadius: 4, border: 'none',
                background: 'var(--accent-primary)', color: '#000', fontSize: 13, fontWeight: 600,
                cursor: newSearchName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setIsSaving(false); setNewSearchName(''); }}
              style={{
                padding: '6px 12px', borderRadius: 4, border: '1px solid var(--stroke)',
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => toggleFilter('has', 'file')}
          style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid var(--stroke)',
            background: filters.has === 'file' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: filters.has === 'file' ? '#000' : 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <FileText size={12} /> Has file
        </button>

        {filters.before && (
          <span style={{
            padding: '4px 12px', borderRadius: 16, background: 'var(--accent-primary)', color: '#000',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Calendar size={12} /> Before: {filters.before.split('T')[0]}
            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilters(prev => { const n = { ...prev }; delete n.before; return n; })} />
          </span>
        )}

        {filters.after && (
          <span style={{
            padding: '4px 12px', borderRadius: 16, background: 'var(--accent-primary)', color: '#000',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Calendar size={12} /> After: {filters.after.split('T')[0]}
            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilters(prev => { const n = { ...prev }; delete n.after; return n; })} />
          </span>
        )}

        <input
          type="date"
          onChange={e => e.target.value && setFilters(prev => ({ ...prev, before: new Date(e.target.value).toISOString() }))}
          style={{
            padding: '4px 8px', borderRadius: 16, border: '1px solid var(--stroke)',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12,
          }}
          title="Before date"
        />
        <input
          type="date"
          onChange={e => e.target.value && setFilters(prev => ({ ...prev, after: new Date(e.target.value).toISOString() }))}
          style={{
            padding: '4px 8px', borderRadius: 16, border: '1px solid var(--stroke)',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12,
          }}
          title="After date"
        />
      </div>

      {/* Skeleton loading rows */}
      {loading && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 8, marginBottom: 8, background: 'var(--bg-secondary)', border: '1px solid var(--stroke)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div className="skeleton-pulse" style={{ height: 12, width: 90, borderRadius: 4 }} />
                <div className="skeleton-pulse" style={{ height: 12, width: 60, borderRadius: 4 }} />
              </div>
              <div className="skeleton-pulse" style={{ height: 14, width: `${75 + (i % 3) * 10}%`, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <AlertCircle size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
          <p style={{ marginBottom: 12, fontSize: 14 }}>Search failed. Please try again.</p>
          <button
            onClick={doSearch}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: '#000', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <EmptyState
          type="search"
          title="No results found"
          description="Try adjusting your search filters or using different keywords."
        />
      )}

      {!loading && !error && !searched && (
        <EmptyState
          type="search"
          title="Search Messages"
          description="Enter a keyword above and press Enter to search across your messages. Use filters to narrow down results."
        />
      )}

        {!loading && results.map(r => (
          <div
            key={r.id}
            onClick={() => navigateToMessage(r)}
            style={{
              padding: 12, borderRadius: 8, marginBottom: 8, cursor: 'pointer',
              background: 'var(--bg-secondary)', border: '1px solid var(--stroke)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
                <User size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {r.author?.displayName || r.author?.username || 'Deleted User'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
              {r.guildName && (
                <span style={{
                  padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)', fontSize: 11,
                }}>
                  {r.guildName}
                </span>
              )}
              {r.channelName && (
                <span style={{
                  padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)', fontSize: 11,
                }}>
                  <Hash size={10} style={{ verticalAlign: 'middle' }} /> {r.channelName}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.4 }}>
              {r.content || '(attachment only)'}
            </div>
          </div>
        ))}

        {/* Load more / loading more */}
        {loadingMore && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading more results...
          </div>
        )}
        {!loading && !loadingMore && !error && hasMore && results.length > 0 && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <button
              onClick={loadMore}
              style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
            >
              Load more results
            </button>
          </div>
        )}
      </div>

      {/* Saved searches sidebar */}
      <div style={{
        width: 260, borderLeft: '1px solid var(--stroke)',
        background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
      }}>
        <div
          onClick={() => setShowSavedPanel(!showSavedPanel)}
          style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', borderBottom: '1px solid var(--stroke)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: 14,
          }}
        >
          {showSavedPanel ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Bookmark size={16} />
          <span>Saved Searches</span>
          <span style={{
            marginLeft: 'auto', fontSize: 11, padding: '2px 6px', borderRadius: 10,
            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          }}>
            {savedSearches.length}
          </span>
        </div>

        {showSavedPanel && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            {savedSearches.length === 0 ? (
              <div style={{
                padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
              }}>
                <Bookmark size={24} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div>No saved searches yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click Save to bookmark a search</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedSearches.map(saved => (
                  <div
                    key={saved.id}
                    style={{
                      padding: '10px 12px', borderRadius: 6,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                    }}
                  >
                    {editingId === saved.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(saved.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 4, fontSize: 13,
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => saveEdit(saved.id)}
                          style={{
                            padding: 4, borderRadius: 4, border: 'none',
                            background: 'var(--accent-primary)', color: '#000',
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: 4, borderRadius: 4, border: '1px solid var(--stroke)',
                            background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => applySavedSearch(saved)}
                          style={{
                            cursor: 'pointer', marginBottom: 6,
                          }}
                        >
                          <div style={{
                            fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {saved.name}
                          </div>
                          {saved.query && (
                            <div style={{
                              fontSize: 11, color: 'var(--text-muted)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              &ldquo;{saved.query}&rdquo;
                            </div>
                          )}
                          {(saved.filters.has || (saved.filters as { hasFile?: string }).hasFile || saved.filters.before || saved.filters.after || saved.filters.authorId || saved.filters.channelId) && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {(saved.filters.has === 'file' || (saved.filters as { hasFile?: string }).hasFile) && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                  background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)',
                                }}>file</span>
                              )}
                              {saved.filters.before && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                  background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)',
                                }}>before</span>
                              )}
                              {saved.filters.after && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                  background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)',
                                }}>after</span>
                              )}
                              {saved.filters.authorId && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                  background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)',
                                }}>from</span>
                              )}
                              {saved.filters.channelId && (
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                  background: 'rgba(88,101,242,0.15)', color: 'var(--accent-primary)',
                                }}>in:channel</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => startEditing(saved)}
                            title="Rename"
                            style={{
                              padding: 4, borderRadius: 4, border: 'none',
                              background: 'transparent', color: 'var(--text-muted)',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => deleteSavedSearch(saved.id)}
                            title="Delete"
                            style={{
                              padding: 4, borderRadius: 4, border: 'none',
                              background: 'transparent', color: 'var(--danger)',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
