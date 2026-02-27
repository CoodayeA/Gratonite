import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
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

  function handleManualSend() {
    // If there's exactly one search result, send to them
    if (results.length === 1 && results[0]) {
      handleSendRequest(results[0]);
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

  const totalPending = pendingIncoming.length + pendingOutgoing.length;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        color: V.text,
        fontFamily: 'inherit',
      } as React.CSSProperties}
    >
      {/* === Main Content === */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: V.bg,
        } as React.CSSProperties}
      >
        {/* Header with breadcrumb and tabs */}
        <div
          style={{
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: `1px solid ${V.stroke}`,
            flexShrink: 0,
          } as React.CSSProperties}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: V.text,
              marginRight: 8,
            } as React.CSSProperties}
          >
            Friends
          </span>
          <div style={{ height: 16, width: 1, background: V.stroke } as React.CSSProperties} />
          {/* Filter tabs */}
          {(['Online', 'All', 'Pending', 'Add Friend'] as const).map((tab) => {
            const isActive = tab === 'Add Friend';
            return (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'Add Friend') return; // already here
                  if (tab === 'Online') navigate('/friends');
                  if (tab === 'All') navigate('/friends');
                  if (tab === 'Pending') navigate('/friends');
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  background: isActive ? V.accent : 'transparent',
                  color: isActive ? V.textOnGold : V.textMuted,
                  transition: 'background 0.15s, color 0.15s',
                } as React.CSSProperties}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Body area - split into left main and right pending sidebar */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          } as React.CSSProperties}
        >
          {/* ── Left column: Search + Results ──────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px 32px',
            } as React.CSSProperties}
          >
            {/* Title */}
            <h1
              style={{
                margin: '0 0 4px',
                fontSize: 22,
                fontWeight: 700,
                color: V.text,
              } as React.CSSProperties}
            >
              Add Friend
            </h1>
            <p
              style={{
                margin: '0 0 20px',
                fontSize: 14,
                color: V.textMuted,
                lineHeight: 1.5,
              } as React.CSSProperties}
            >
              You can add friends with their Gratonite username or tag.
            </p>

            {/* Search bar row: input + Send Request button */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 16,
              } as React.CSSProperties}
            >
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setError(''); setSuccess(''); }}
                placeholder="Enter a Username#0000"
                autoFocus
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${V.stroke}`,
                  background: V.bgInput,
                  color: V.text,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                } as React.CSSProperties}
              />
              <button
                onClick={handleManualSend}
                disabled={results.length !== 1 || sendingTo !== null}
                style={{
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: results.length === 1 ? 'pointer' : 'default',
                  fontWeight: 700,
                  fontSize: 14,
                  background: V.accent,
                  color: V.textOnGold,
                  opacity: results.length === 1 ? 1 : 0.5,
                  transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (results.length === 1) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = results.length === 1 ? '1' : '0.5';
                }}
              >
                Send Request
              </button>
            </div>

            {/* Feedback messages */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#f0474720',
                  color: '#f04747',
                  fontSize: 13,
                  marginBottom: 12,
                } as React.CSSProperties}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#43b58120',
                  color: '#43b581',
                  fontSize: 13,
                  marginBottom: 12,
                } as React.CSSProperties}
              >
                {success}
              </div>
            )}

            {/* Search results */}
            {searching && (
              <div
                style={{
                  padding: '16px 0',
                  fontSize: 13,
                  color: V.textMuted,
                } as React.CSSProperties}
              >
                Searching...
              </div>
            )}
            {!searching && results.length > 0 && (
              <div style={{ marginBottom: 24 } as React.CSSProperties}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: V.textFaint,
                    marginBottom: 10,
                  } as React.CSSProperties}
                >
                  Search Results
                </div>
                {results.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 4,
                      background: V.bgElevated,
                      border: `1px solid ${V.stroke}`,
                    } as React.CSSProperties}
                  >
                    <Avatar name={u.displayName ?? u.username} hash={u.avatarHash} userId={u.id} size={40} />
                    <div style={{ flex: 1, minWidth: 0 } as React.CSSProperties}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: V.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        } as React.CSSProperties}
                      >
                        {u.displayName ?? u.username}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: V.textMuted,
                        } as React.CSSProperties}
                      >
                        @{u.username}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendRequest(u)}
                      disabled={sendingTo !== null}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: sendingTo === u.id ? 'default' : 'pointer',
                        fontWeight: 600,
                        fontSize: 12,
                        background: V.accent,
                        color: V.textOnGold,
                        opacity: sendingTo === u.id ? 0.6 : 1,
                        transition: 'opacity 0.15s',
                      } as React.CSSProperties}
                    >
                      {sendingTo === u.id ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!searching && results.length === 0 && query.trim().length >= 2 && (
              <div
                style={{
                  padding: '16px 0',
                  fontSize: 13,
                  color: V.textFaint,
                } as React.CSSProperties}
              >
                No users found matching &ldquo;{query.trim()}&rdquo;
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && query.trim().length < 2 && (
              <div style={{ marginBottom: 24 } as React.CSSProperties}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  } as React.CSSProperties}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: V.textFaint,
                    } as React.CSSProperties}
                  >
                    Recent Searches
                  </div>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: V.textMuted,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                    } as React.CSSProperties}
                  >
                    Clear
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  } as React.CSSProperties}
                >
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleRecentClick(term)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${V.stroke}`,
                        background: V.bgElevated,
                        color: V.textMuted,
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                      } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = V.bgSoft;
                        e.currentTarget.style.color = V.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = V.bgElevated;
                        e.currentTarget.style.color = V.textMuted;
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QR / Share section */}
            <div style={{ marginBottom: 24 } as React.CSSProperties}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: V.textFaint,
                  marginBottom: 12,
                } as React.CSSProperties}
              >
                Share via QR Code
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'flex-start',
                  padding: 20,
                  borderRadius: 'var(--radius-md)',
                  background: V.bgElevated,
                  border: `1px solid ${V.stroke}`,
                } as React.CSSProperties}
              >
                {/* QR placeholder */}
                <div style={{ flexShrink: 0 } as React.CSSProperties}>
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
                <div style={{ flex: 1 } as React.CSSProperties}>
                  <p
                    style={{
                      color: V.textMuted,
                      fontSize: 13,
                      margin: '0 0 12px',
                      lineHeight: 1.5,
                    } as React.CSSProperties}
                  >
                    Share this link with friends so they can find you on Gratonite.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: V.bgInput,
                      border: `1px solid ${V.stroke}`,
                    } as React.CSSProperties}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: V.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      } as React.CSSProperties}
                    >
                      {user?.username ? `@${user.username}` : shareUrl}
                    </code>
                    <button
                      onClick={handleCopyShareLink}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${V.stroke}`,
                        background: 'transparent',
                        color: V.textMuted,
                        fontSize: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s',
                      } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = V.bgSoft;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column: Pending Requests ────────────────────── */}
          <aside
            style={{
              width: 300,
              minWidth: 300,
              background: V.bgElevated,
              borderLeft: `1px solid ${V.stroke}`,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            <div
              style={{
                padding: '20px 16px 12px',
              } as React.CSSProperties}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: V.textFaint,
                  marginBottom: 16,
                } as React.CSSProperties}
              >
                Pending Requests {totalPending > 0 ? `\u2014 ${totalPending}` : ''}
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 12px',
              } as React.CSSProperties}
            >
              {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
                <div
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    color: V.textFaint,
                  } as React.CSSProperties}
                >
                  No pending friend requests.
                </div>
              )}

              {/* Incoming */}
              {pendingIncoming.length > 0 && (
                <div style={{ marginBottom: 16 } as React.CSSProperties}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: V.textMuted,
                      marginBottom: 8,
                      padding: '0 4px',
                    } as React.CSSProperties}
                  >
                    Incoming
                  </div>
                  {pendingIncoming.map((rel) => {
                    const u = pendingUsersById.get(rel.targetId);
                    if (!u) return null;
                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 8px',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 4,
                        } as React.CSSProperties}
                      >
                        <Avatar name={u.displayName} hash={u.avatarHash} userId={u.id} size={36} />
                        <div style={{ flex: 1, minWidth: 0 } as React.CSSProperties}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: V.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            } as React.CSSProperties}
                          >
                            {u.displayName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: V.textMuted,
                            } as React.CSSProperties}
                          >
                            @{u.username}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 } as React.CSSProperties}>
                          <button
                            type="button"
                            onClick={() => acceptMutation.mutate(u.id)}
                            disabled={acceptMutation.isPending}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 11,
                              background: '#43b581',
                              color: '#fff',
                              transition: 'opacity 0.15s',
                            } as React.CSSProperties}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => declineMutation.mutate(u.id)}
                            disabled={declineMutation.isPending}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 11,
                              background: '#f04747',
                              color: '#fff',
                              transition: 'opacity 0.15s',
                            } as React.CSSProperties}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Outgoing */}
              {pendingOutgoing.length > 0 && (
                <div style={{ marginBottom: 16 } as React.CSSProperties}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: V.textMuted,
                      marginBottom: 8,
                      padding: '0 4px',
                    } as React.CSSProperties}
                  >
                    Outgoing
                  </div>
                  {pendingOutgoing.map((rel) => {
                    const u = pendingUsersById.get(rel.targetId);
                    if (!u) return null;
                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 8px',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 4,
                        } as React.CSSProperties}
                      >
                        <Avatar name={u.displayName} hash={u.avatarHash} userId={u.id} size={36} />
                        <div style={{ flex: 1, minWidth: 0 } as React.CSSProperties}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: V.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            } as React.CSSProperties}
                          >
                            {u.displayName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: V.textMuted,
                            } as React.CSSProperties}
                          >
                            @{u.username}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: V.textFaint,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: V.bgSoft,
                          } as React.CSSProperties}
                        >
                          Pending
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Back to Friends button at bottom */}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${V.stroke}` } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => navigate('/friends')}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${V.stroke}`,
                  background: 'transparent',
                  color: V.textMuted,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = V.bgSoft;
                  e.currentTarget.style.color = V.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = V.textMuted;
                }}
              >
                Back to Friends
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
