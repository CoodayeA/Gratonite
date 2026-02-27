import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  } as React.CSSProperties,
  error: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  success: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(20, 184, 166, 0.12)',
    border: '1px solid rgba(20, 184, 166, 0.3)',
    color: 'var(--text)',
    fontSize: 13,
  } as React.CSSProperties,
  results: {
    maxHeight: 240,
    overflowY: 'auto',
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  searching: {
    padding: 16,
    textAlign: 'center',
    color: 'var(--text-faint)',
    fontSize: 13,
  } as React.CSSProperties,
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'none',
    color: 'var(--text)',
    cursor: 'default',
    fontFamily: 'var(--font-sans)',
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  userRowHover: {
    background: 'var(--bg-soft)',
  } as React.CSSProperties,
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  userDisplay: {
    fontWeight: 500,
    fontSize: 14,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  userUsername: {
    fontSize: 12,
    color: 'var(--text-faint)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '0 24px 20px',
    flexWrap: 'wrap',
  } as React.CSSProperties,
};

export function AddFriendModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const activeModal = useUiStore((s) => s.activeModal);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search as user types
  useEffect(() => {
    if (activeModal !== 'add-friend') return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.users.searchUsers(trimmed);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeModal]);

  function handleClose() {
    closeModal();
    setQuery('');
    setResults([]);
    setError('');
    setSuccess('');
    setLoading(false);
  }

  async function handleSendRequest(user: UserResult) {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.relationships.sendFriendRequest(user.id);
      setSuccess(`Friend request sent to ${user.displayName ?? user.username}!`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="add-friend" title="Add Friend" onClose={() => { setQuery(''); setResults([]); setError(''); setSuccess(''); }} size="sm">
      <div style={styles.form}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
        <Input
          label="Search users"
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSuccess(''); setError(''); }}
          placeholder="Type a username..."
          autoFocus
        />

        <div style={styles.results}>
          {searching && <div style={styles.searching}>Searching...</div>}
          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <div style={styles.searching}>No users found.</div>
          )}
          {results.map((user) => (
            <div
              key={user.id}
              style={{
                ...styles.userRow,
                ...(hoveredUserId === user.id ? styles.userRowHover : {}),
              }}
              onMouseEnter={() => setHoveredUserId(user.id)}
              onMouseLeave={() => setHoveredUserId(null)}
            >
              <Avatar name={user.displayName ?? user.username} hash={user.avatarHash} userId={user.id} size={32} />
              <div style={styles.userInfo}>
                <span style={styles.userDisplay}>{user.displayName ?? user.username}</span>
                <span style={styles.userUsername}>@{user.username}</span>
              </div>
              <Button
                size="sm"
                onClick={() => handleSendRequest(user)}
                disabled={loading}
              >
                Send Request
              </Button>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" type="button" onClick={handleClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
