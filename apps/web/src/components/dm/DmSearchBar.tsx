import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';

const styles = {
  container: {
    padding: 0,
    position: 'relative',
  } as React.CSSProperties,
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px 8px 32px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-input, #25243a)',
    border: '1px solid var(--stroke, #4a4660)',
    color: 'var(--text, #e8e4e0)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    outline: 'none',
    transition: 'border-color 0.15s ease, background 0.15s ease',
  } as React.CSSProperties,
  inputFocused: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px 8px 32px',
    borderRadius: 'var(--radius-sm)',
    background: 'color-mix(in srgb, var(--bg-input, #25243a) 90%, var(--accent, #d4af37) 10%)',
    border: '1px solid var(--accent, #d4af37)',
    color: 'var(--text, #e8e4e0)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    outline: 'none',
    transition: 'border-color 0.15s ease, background 0.15s ease',
  } as React.CSSProperties,
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 10,
    right: 10,
    background: 'var(--bg-elevated, #353348)',
    border: '1px solid var(--stroke, #4a4660)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    maxHeight: 240,
    overflowY: 'auto',
    zIndex: 10,
  } as React.CSSProperties,
  result: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  resultHover: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    cursor: 'pointer',
    border: 'none',
    background: 'var(--bg-soft, #413d58)',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  resultName: {
    color: 'var(--text, #e8e4e0)',
    fontSize: '0.875rem',
    fontWeight: 500,
  } as React.CSSProperties,
  resultUsername: {
    color: 'var(--text-muted, #a8a4b8)',
    fontSize: '0.75rem',
    marginLeft: 'auto',
  } as React.CSSProperties,
  loading: {
    padding: 12,
    textAlign: 'center',
    color: 'var(--text-muted, #a8a4b8)',
    fontSize: '0.8125rem',
  } as React.CSSProperties,
} as const;

export function DmSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hoveredResultId, setHoveredResultId] = useState<string | null>(null);
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
    <div style={styles.container} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search conversations..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setFocused(true);
          if (debouncedQuery.length >= 2) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        style={focused ? styles.inputFocused : styles.input}
      />
      {showDropdown && (
        <div style={styles.dropdown}>
          {isLoading && (
            <div style={styles.loading}>Searching...</div>
          )}
          {!isLoading && results.length === 0 && (
            <div style={styles.loading}>No users found</div>
          )}
          {!isLoading &&
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                style={hoveredResultId === user.id ? styles.resultHover : styles.result}
                onMouseEnter={() => setHoveredResultId(user.id)}
                onMouseLeave={() => setHoveredResultId(null)}
                onClick={() => handleSelect(user.id)}
              >
                <Avatar
                  name={user.displayName || user.username}
                  hash={user.avatarHash}
                  userId={user.id}
                  size={28}
                />
                <span style={styles.resultName}>
                  {user.displayName || user.username}
                </span>
                <span style={styles.resultUsername}>
                  @{user.username}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
