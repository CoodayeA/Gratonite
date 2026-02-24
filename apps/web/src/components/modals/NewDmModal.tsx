import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore } from '@/stores/ui.store';
import { useChannelsStore } from '@/stores/channels.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

export function NewDmModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const activeModal = useUiStore((s) => s.activeModal);
  const addChannel = useChannelsStore((s) => s.addChannel);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search as user types
  useEffect(() => {
    if (activeModal !== 'new-dm') return;
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
    setLoading(false);
  }

  async function handleSelectUser(user: UserResult) {
    setError('');
    setLoading(true);
    try {
      const channel = await api.relationships.openDm(user.id);
      addChannel({
        id: channel.id,
        guildId: null,
        type: channel.type === 'group_dm' ? 'GROUP_DM' : 'DM',
        name: user.displayName ?? user.username ?? 'Direct Message',
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        lastMessageId: channel.lastMessageId ?? null,
        rateLimitPerUser: 0,
        defaultAutoArchiveDuration: null,
        defaultThreadRateLimitPerUser: null,
        defaultSortOrder: null,
        defaultForumLayout: null,
        availableTags: null,
        defaultReactionEmoji: null,
        createdAt: new Date().toISOString(),
      });
      handleClose();
      navigate(`/dm/${channel.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="new-dm" title="Start a New DM" onClose={() => { setQuery(''); setResults([]); setError(''); }} size="sm">
      <div className="modal-form">
        {error && <div className="modal-error">{error}</div>}
        <Input
          label="Search users"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a username..."
          autoFocus
        />

        <div className="new-dm-results">
          {searching && <div className="new-dm-searching">Searching...</div>}
          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <div className="new-dm-empty">No users found.</div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              className="new-dm-user-row"
              onClick={() => handleSelectUser(user)}
              disabled={loading}
            >
              <Avatar name={user.displayName ?? user.username} hash={user.avatarHash} userId={user.id} size={32} />
              <div className="new-dm-user-info">
                <span className="new-dm-user-display">{user.displayName ?? user.username}</span>
                <span className="new-dm-user-username">@{user.username}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}
