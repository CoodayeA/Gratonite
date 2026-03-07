import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Calendar, User, Hash, X } from 'lucide-react';
import { api } from '../../lib/api';

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
  hasFile?: string;
  before?: string;
  after?: string;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const doSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (filters.guildId) params.set('guildId', filters.guildId);
      if (filters.channelId) params.set('channelId', filters.channelId);
      if (filters.authorId) params.set('authorId', filters.authorId);
      if (filters.hasFile) params.set('hasFile', filters.hasFile);
      if (filters.before) params.set('before', filters.before);
      if (filters.after) params.set('after', filters.after);

      const data = await api.get<SearchResult[]>(`/search/messages?${params.toString()}`);
      setResults(data);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query, filters]);

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
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
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
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => toggleFilter('hasFile', 'true')}
          style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid var(--stroke)',
            background: filters.hasFile ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: filters.hasFile ? '#000' : 'var(--text-secondary)',
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

      {/* Results */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Searching...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No results found</div>
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
    </div>
  );
}
