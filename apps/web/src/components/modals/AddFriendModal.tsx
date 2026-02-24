import { useState, useEffect, useRef, type FormEvent } from 'react';
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

export function AddFriendModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const activeModal = useUiStore((s) => s.activeModal);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
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
      <div className="modal-form">
        {error && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}
        <Input
          label="Search users"
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSuccess(''); setError(''); }}
          placeholder="Type a username..."
          autoFocus
        />

        <div className="new-dm-results">
          {searching && <div className="new-dm-searching">Searching...</div>}
          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <div className="new-dm-empty">No users found.</div>
          )}
          {results.map((user) => (
            <div key={user.id} className="new-dm-user-row add-friend-row">
              <Avatar name={user.displayName ?? user.username} hash={user.avatarHash} userId={user.id} size={32} />
              <div className="new-dm-user-info">
                <span className="new-dm-user-display">{user.displayName ?? user.username}</span>
                <span className="new-dm-user-username">@{user.username}</span>
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

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
