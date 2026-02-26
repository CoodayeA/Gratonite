import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';

/* ── CSS variable tokens ─────────────────────────────────────────── */
const V = {
  bg:          'var(--bg, #2c2c3e)',
  bgElevated:  'var(--bg-elevated, #353348)',
  bgSoft:      'var(--bg-soft, #413d58)',
  bgInput:     'var(--bg-input, #25243a)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
  goldSubtle:  '#d4af3730',
} as const;

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

interface Relationship {
  userId: string;
  targetId: string;
  type: 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing';
  createdAt: string;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

/** Read recent searches from localStorage */
function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem('add_friend_recent_v1');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

/** Save a recent search term */
function saveRecentSearch(term: string) {
  try {
    const existing = getRecentSearches();
    const updated = [term, ...existing.filter((t) => t !== term)].slice(0, 8);
    localStorage.setItem('add_friend_recent_v1', JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function AddFriendPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Pending friend requests ──────────────────────────────────────────
  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll(),
  });

  const pendingIncoming = useMemo(
    () => relationships.filter((r) => r.type === 'pending_incoming'),
    [relationships],
  );
  const pendingOutgoing = useMemo(
    () => relationships.filter((r) => r.type === 'pending_outgoing'),
    [relationships],
  );

  const pendingUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of [...pendingIncoming, ...pendingOutgoing]) {
      ids.add(rel.targetId);
      ids.add(rel.userId);
    }
    return Array.from(ids);
  }, [pendingIncoming, pendingOutgoing]);

  const { data: pendingUserSummaries = [] } = useQuery<UserSummary[]>({
    queryKey: ['users', 'summaries', pendingUserIds],
    queryFn: () => api.users.getSummaries(pendingUserIds),
    enabled: pendingUserIds.length > 0,
  });

  const pendingUsersById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const u of pendingUserSummaries) map.set(u.id, u);
    return map;
  }, [pendingUserSummaries]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.acceptFriendRequest(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
  });

  const declineMutation = useMutation({
    mutationFn: (userId: string) => api.relationships.removeFriend(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
  });

  // ── Debounced search ──────────────────────────────────────────────────
  useEffect(() => {
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
        saveRecentSearch(trimmed);
        setRecentSearches(getRecentSearches());
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleSendRequest(target: UserResult) {
    setError('');
    setSuccess('');
    setSendingTo(target.id);
    try {
      await api.relationships.sendFriendRequest(target.id);
      setSuccess(`Friend request sent to ${target.displayName ?? target.username}!`);
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSendingTo(null);
    }
  }

  function handleRecentClick(term: string) {
    setQuery(term);
  }

  function clearRecentSearches() {
    try { localStorage.removeItem('add_friend_recent_v1'); } catch { /* ignore */ }
    setRecentSearches([]);
  }

  // ── QR code section (placeholder — generates a shareable profile URL) ──
  const shareUrl = user ? `${window.location.origin}/invite/user/${user.username}` : '';

  const handleCopyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(
      () => setSuccess('Share link copied to clipboard!'),
      () => setError('Failed to copy link.'),
    );
  }, [shareUrl]);

  return (
    <div className="add-friend-page">
      <header className="add-friend-header">
        <div className="add-friend-eyebrow">Friends</div>
        <h1 className="add-friend-title">Add Friend</h1>
        <p className="add-friend-subtitle">
          Search by username to send a friend request, or share your link with friends.
        </p>
      </header>

      <div className="add-friend-content">
        {/* ── Left column: Search + Results ──────────────────────── */}
        <div className="add-friend-main">
          {/* Search bar */}
          <div className="add-friend-search-wrap">
            <input
              className="add-friend-search"
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(''); setSuccess(''); }}
              placeholder="Search by username..."
              autoFocus
            />
          </div>

          {error && <div className="add-friend-feedback add-friend-feedback--error">{error}</div>}
          {success && <div className="add-friend-feedback add-friend-feedback--success">{success}</div>}

          {/* Search results */}
          {searching && (
            <div className="add-friend-searching">Searching...</div>
          )}
          {!searching && results.length > 0 && (
            <section className="add-friend-results">
              <div className="add-friend-section-title">Search Results</div>
              {results.map((u) => (
                <div key={u.id} className="add-friend-user-row">
                  <Avatar name={u.displayName ?? u.username} hash={u.avatarHash} userId={u.id} size={40} />
                  <div className="add-friend-user-info">
                    <span className="add-friend-user-display">{u.displayName ?? u.username}</span>
                    <span className="add-friend-user-username">@{u.username}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendRequest(u)}
                    loading={sendingTo === u.id}
                    disabled={sendingTo !== null}
                  >
                    Send Request
                  </Button>
                </div>
              ))}
            </section>
          )}
          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <div className="add-friend-empty">No users found matching &ldquo;{query.trim()}&rdquo;</div>
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && query.trim().length < 2 && (
            <section className="add-friend-recent">
              <div className="add-friend-section-head">
                <div className="add-friend-section-title">Recent Searches</div>
                <button type="button" className="add-friend-clear-btn" onClick={clearRecentSearches}>
                  Clear
                </button>
              </div>
              <div className="add-friend-recent-list">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="add-friend-recent-chip"
                    onClick={() => handleRecentClick(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* QR / Share section */}
          <section className="add-friend-share">
            <div className="add-friend-section-title">Share Your Profile</div>
            <div className="add-friend-qr-section">
              <div className="add-friend-qr-placeholder">
                {/* QR placeholder — renders a visual grid pattern */}
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                  <rect width="120" height="120" rx="12" fill={V.bgSoft} />
                  <rect x="20" y="20" width="24" height="24" rx="2" fill={V.accent} opacity="0.5" />
                  <rect x="76" y="20" width="24" height="24" rx="2" fill={V.accent} opacity="0.5" />
                  <rect x="20" y="76" width="24" height="24" rx="2" fill={V.accent} opacity="0.5" />
                  <rect x="52" y="52" width="16" height="16" rx="2" fill={V.accent} opacity="0.7" />
                  <rect x="32" y="52" width="8" height="8" rx="1" fill={V.accent} opacity="0.3" />
                  <rect x="80" y="56" width="8" height="8" rx="1" fill={V.accent} opacity="0.3" />
                  <rect x="56" y="32" width="8" height="8" rx="1" fill={V.accent} opacity="0.3" />
                  <rect x="56" y="80" width="8" height="8" rx="1" fill={V.accent} opacity="0.3" />
                </svg>
              </div>
              <div className="add-friend-qr-info">
                <p style={{ color: V.textMuted, fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>
                  Share this link with friends so they can find you on Gratonite.
                </p>
                <div className="add-friend-share-url">
                  <code className="add-friend-share-code">{user?.username ? `@${user.username}` : shareUrl}</code>
                  <Button size="sm" variant="ghost" onClick={handleCopyShareLink}>
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right column: Pending Requests ────────────────────── */}
        <aside className="add-friend-sidebar">
          <div className="add-friend-section-title">
            Pending Requests
            {(pendingIncoming.length + pendingOutgoing.length) > 0 && (
              <span className="add-friend-badge">{pendingIncoming.length + pendingOutgoing.length}</span>
            )}
          </div>

          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
            <div className="add-friend-empty" style={{ padding: '24px 0' }}>
              No pending friend requests.
            </div>
          )}

          {/* Incoming */}
          {pendingIncoming.length > 0 && (
            <div className="add-friend-pending-section">
              <div className="add-friend-pending-label">Incoming</div>
              {pendingIncoming.map((rel) => {
                const u = pendingUsersById.get(rel.targetId);
                if (!u) return null;
                return (
                  <div key={u.id} className="add-friend-user-row">
                    <Avatar name={u.displayName} hash={u.avatarHash} userId={u.id} size={36} />
                    <div className="add-friend-user-info">
                      <span className="add-friend-user-display">{u.displayName}</span>
                      <span className="add-friend-user-username">@{u.username}</span>
                    </div>
                    <div className="add-friend-pending-actions">
                      <button
                        type="button"
                        className="add-friend-action-btn add-friend-action-btn--accept"
                        onClick={() => acceptMutation.mutate(u.id)}
                        disabled={acceptMutation.isPending}
                        title="Accept"
                      >
                        &#x2713;
                      </button>
                      <button
                        type="button"
                        className="add-friend-action-btn add-friend-action-btn--decline"
                        onClick={() => declineMutation.mutate(u.id)}
                        disabled={declineMutation.isPending}
                        title="Decline"
                      >
                        &#x2715;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outgoing */}
          {pendingOutgoing.length > 0 && (
            <div className="add-friend-pending-section">
              <div className="add-friend-pending-label">Outgoing</div>
              {pendingOutgoing.map((rel) => {
                const u = pendingUsersById.get(rel.targetId);
                if (!u) return null;
                return (
                  <div key={u.id} className="add-friend-user-row">
                    <Avatar name={u.displayName} hash={u.avatarHash} userId={u.id} size={36} />
                    <div className="add-friend-user-info">
                      <span className="add-friend-user-display">{u.displayName}</span>
                      <span className="add-friend-user-username">@{u.username}</span>
                    </div>
                    <span style={{ fontSize: 12, color: V.textFaint }}>Pending</span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="add-friend-back-btn"
            onClick={() => navigate('/friends')}
          >
            Back to Friends
          </button>
        </aside>
      </div>
    </div>
  );
}
