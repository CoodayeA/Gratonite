import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '@/stores/search.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMembersStore } from '@/stores/members.store';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatTimestamp } from '@/lib/utils';

/**
 * Sanitize HTML to only allow <mark> tags (used for search highlighting).
 * All other HTML is escaped to prevent XSS. Only whitelisted <mark> tags
 * are re-introduced after full escaping.
 */
function sanitizeHighlight(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&lt;mark&gt;/gi, '<mark>')
    .replace(/&lt;\/mark&gt;/gi, '</mark>');
}

type FilterType = 'messages' | 'users' | 'channels';

interface SearchPanelProps {
  channelId: string;
}

const st = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#353348',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid #4a4660',
    flexShrink: 0,
  } as React.CSSProperties,
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#a8a4b8',
    fontSize: 20,
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    transition: 'color 0.15s',
    flexShrink: 0,
  } as React.CSSProperties,
  searchInput: {
    flex: 1,
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  bodyRow: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  } as React.CSSProperties,
  filterSidebar: {
    width: 160,
    flexShrink: 0,
    borderRight: '1px solid #4a4660',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as React.CSSProperties,
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6e6a80',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
  } as React.CSSProperties,
  filterBtnBase: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties,
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  resultCount: {
    fontSize: 13,
    color: '#a8a4b8',
    padding: '4px 4px 8px',
  } as React.CSSProperties,
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: 32,
  } as React.CSSProperties,
  empty: {
    color: '#6e6a80',
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
  } as React.CSSProperties,
  resultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#2c2c3e',
    border: '1px solid transparent',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'border-color 0.15s, background 0.15s',
    color: 'inherit',
  } as React.CSSProperties,
  resultBody: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  } as React.CSSProperties,
  resultAuthor: {
    color: '#d4af37',
    fontWeight: 600,
    fontSize: 14,
  } as React.CSSProperties,
  resultChannel: {
    color: '#6e6a80',
    fontSize: 12,
  } as React.CSSProperties,
  resultTime: {
    color: '#6e6a80',
    fontSize: 12,
    marginLeft: 'auto',
  } as React.CSSProperties,
  resultContent: {
    color: '#a8a4b8',
    fontSize: 13,
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as React.CSSProperties,
  loadMoreBtn: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    fontSize: 13,
    fontWeight: 500,
    padding: '10px 0',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s, color 0.15s',
    marginTop: 4,
  } as React.CSSProperties,
};

export function SearchPanel({ channelId }: SearchPanelProps) {
  const navigate = useNavigate();
  const toggleSearchPanel = useUiStore((s) => s.toggleSearchPanel);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const channels = useChannelsStore((s) => s.channels);
  const membersByGuild = useMembersStore((s) => s.membersByGuild);
  const [input, setInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('messages');
  const { results, isSearching, totalCount, search, clearSearch, loadMore } = useSearchStore();

  const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
  const guildId = channel?.guildId ?? null;

  useEffect(() => {
    return () => clearSearch();
  }, [clearSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = input.trim();
      if (!query) {
        clearSearch();
        return;
      }
      if (!isDm && !guildId) return;
      search({
        query,
        ...(isDm ? { channelId } : { guildId: guildId ?? undefined }),
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [input, search, clearSearch, channelId, isDm, guildId]);

  const title = useMemo(() => {
    if (isDm) return 'Search in this conversation';
    return 'Search this portal';
  }, [isDm]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'messages', label: 'Messages' },
    { key: 'users', label: 'Users' },
    { key: 'channels', label: 'Channels' },
  ];

  return (
    <div style={st.panel}>
      <div style={st.header}>
        <button
          style={st.backBtn}
          onClick={toggleSearchPanel}
          aria-label="Close"
          onMouseEnter={(e) => { e.currentTarget.style.color = '#e8e4e0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#a8a4b8'; }}
        >
          &#8592;
        </button>
        <input
          style={st.searchInput}
          placeholder={title}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoFocus
          onFocus={(e) => { e.currentTarget.style.borderColor = '#d4af37'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#4a4660'; }}
        />
      </div>
      <div style={st.bodyRow}>
        <div style={st.filterSidebar as React.CSSProperties}>
          <div style={st.filterLabel as React.CSSProperties}>Filter by</div>
          {filters.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                style={{
                  ...st.filterBtnBase,
                  background: isActive ? '#413d58' : 'transparent',
                  color: isActive ? '#d4af37' : '#a8a4b8',
                } as React.CSSProperties}
                onClick={() => setActiveFilter(f.key)}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = '#413d58';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div style={st.results as React.CSSProperties}>
          {results.length > 0 && input.trim() && (
            <div style={st.resultCount}>
              {totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;{input.trim()}&rdquo;
            </div>
          )}
          {isSearching && results.length === 0 && (
            <div style={st.loading}>
              <LoadingSpinner size={20} />
            </div>
          )}
          {!isSearching && input.trim() && results.length === 0 && (
            <div style={st.empty}>No results for &ldquo;{input.trim()}&rdquo;.</div>
          )}
          {results.map((result) => {
            const channelName = channels.get(result.channelId)?.name ?? 'Unknown channel';
            const member = result.guildId
              ? membersByGuild.get(result.guildId)?.get(result.authorId)
              : undefined;
            const displayName = member?.profile?.nickname
              ?? member?.nickname
              ?? member?.user?.displayName
              ?? member?.user?.username
              ?? 'Unknown';
            const avatarHash = member?.profile?.avatarHash ?? member?.user?.avatarHash ?? null;
            const route = result.guildId
              ? `/guild/${result.guildId}/channel/${result.channelId}`
              : `/dm/${result.channelId}`;

            // Sanitized highlight only allows <mark> tags -- safe for rendering
            const highlightHtml = sanitizeHighlight(result.highlight || result.content);

            return (
              <button
                key={result.id}
                style={st.resultItem as React.CSSProperties}
                onClick={() => {
                  navigate(route);
                  toggleSearchPanel();
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4a4660';
                  e.currentTarget.style.background = '#413d58';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.background = '#2c2c3e';
                }}
              >
                <Avatar name={displayName} hash={avatarHash} userId={result.authorId} size={32} />
                <div style={st.resultBody}>
                  <div style={st.resultMeta}>
                    <span style={st.resultAuthor}>{displayName}</span>
                    <span style={st.resultChannel}>#{channelName}</span>
                    <span style={st.resultTime}>{formatTimestamp(result.createdAt)}</span>
                  </div>
                  {/* eslint-disable-next-line react/no-danger -- sanitizeHighlight escapes all HTML except <mark> */}
                  <div
                    style={st.resultContent as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: highlightHtml }}
                  />
                </div>
              </button>
            );
          })}
          {results.length > 0 && results.length < totalCount && (
            <button
              style={st.loadMoreBtn as React.CSSProperties}
              onClick={() => loadMore()}
              disabled={isSearching}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#d4af37';
                e.currentTarget.style.color = '#d4af37';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#4a4660';
                e.currentTarget.style.color = '#a8a4b8';
              }}
            >
              {isSearching ? 'Loading...' : 'Load more results'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
