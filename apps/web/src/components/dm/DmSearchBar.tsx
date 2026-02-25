import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';

export function DmSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () => api.users.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  // Open dropdown when there are results or loading
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [debouncedQuery, results]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    async (userId: string) => {
      try {
        const channel = await api.relationships.openDm(userId);
        setQuery('');
        setDebouncedQuery('');
        setOpen(false);
        navigate(`/dm/${channel.id}`);
      } catch {
        // Silently handle errors — the user can retry
      }
    },
    [navigate],
  );

  const showDropdown = open && debouncedQuery.length >= 2;

  return (
    <div className="dm-search-bar" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search conversations..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (debouncedQuery.length >= 2) setOpen(true);
        }}
      />
      {showDropdown && (
        <div className="dm-search-dropdown">
          {isLoading && (
            <div className="dm-search-loading">Searching...</div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="dm-search-loading">No users found</div>
          )}
          {!isLoading &&
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                className="dm-search-result"
                onClick={() => handleSelect(user.id)}
              >
                <Avatar
                  name={user.displayName || user.username}
                  hash={user.avatarHash}
                  userId={user.id}
                  size={28}
                />
                <span className="dm-search-result-name">
                  {user.displayName || user.username}
                </span>
                <span className="dm-search-result-username">
                  @{user.username}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
