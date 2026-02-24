import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '@/stores/search.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMembersStore } from '@/stores/members.store';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatTimestamp } from '@/lib/utils';

interface SearchPanelProps {
  channelId: string;
}

export function SearchPanel({ channelId }: SearchPanelProps) {
  const navigate = useNavigate();
  const toggleSearchPanel = useUiStore((s) => s.toggleSearchPanel);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const channels = useChannelsStore((s) => s.channels);
  const membersByGuild = useMembersStore((s) => s.membersByGuild);
  const [input, setInput] = useState('');
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

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <div>
          <h3 className="search-panel-title">Search</h3>
          <span className="search-panel-subtitle">{title}</span>
        </div>
        <button className="search-panel-close" onClick={toggleSearchPanel} aria-label="Close">
          &times;
        </button>
      </div>
      <div className="search-panel-controls">
        <input
          className="search-input"
          placeholder="Search messages..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoFocus
        />
      </div>
      <div className="search-results">
        {isSearching && results.length === 0 && (
          <div className="search-loading">
            <LoadingSpinner size={20} />
          </div>
        )}
        {!isSearching && input.trim() && results.length === 0 && (
          <div className="search-empty">No results for "{input.trim()}".</div>
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

          return (
            <button
              key={result.id}
              className="search-result-item"
              onClick={() => {
                navigate(route);
                toggleSearchPanel();
              }}
            >
              <Avatar name={displayName} hash={avatarHash} userId={result.authorId} size={28} />
              <div className="search-result-body">
                <div className="search-result-meta">
                  <span className="search-result-author">{displayName}</span>
                  <span className="search-result-channel">#{channelName}</span>
                  <span className="search-result-time">{formatTimestamp(result.createdAt)}</span>
                </div>
                <div
                  className="search-result-content"
                  dangerouslySetInnerHTML={{ __html: result.highlight || result.content }}
                />
              </div>
            </button>
          );
        })}
        {results.length > 0 && results.length < totalCount && (
          <button className="search-load-more" onClick={() => loadMore()} disabled={isSearching}>
            {isSearching ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
