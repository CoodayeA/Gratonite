import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Inline style objects                                               */
/* ------------------------------------------------------------------ */

const styles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e8e4e0',
    margin: 0,
  },
  muted: {
    fontSize: 13,
    color: '#a8a4b8',
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  resetBtn: {
    background: 'transparent',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(240,71,71,0.12)',
    color: '#f04747',
    border: '1px solid rgba(240,71,71,0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: 13,
  },
  feedback: {
    background: 'rgba(212,175,55,0.10)',
    color: '#d4af37',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: 13,
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 12,
  },
  tab: {
    background: '#353348',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    borderRadius: 'var(--radius-lg)',
    padding: '5px 14px',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#d4af37',
    border: '1px solid #d4af37',
    color: '#1a1a2e',
    borderRadius: 'var(--radius-lg)',
    padding: '5px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
  },
  card: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e4e0',
    marginBottom: 8,
  },
  inputField: {
    width: '100%',
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 13,
    color: '#e8e4e0',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    background: '#353348',
  },
  memberItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: '#353348',
    flexWrap: 'wrap' as const,
  },
  memberMeta: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e8e4e0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  memberSubline: {
    fontSize: 11,
    color: '#6e6a80',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    marginTop: 2,
  },
  memberActions: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  badge: {
    fontSize: 11,
    color: '#a8a4b8',
    background: '#413d58',
    borderRadius: 10,
    padding: '2px 8px',
    whiteSpace: 'nowrap' as const,
  },
  statPill: {
    fontSize: 12,
    color: '#a8a4b8',
    background: '#413d58',
    borderRadius: 10,
    padding: '2px 10px',
    whiteSpace: 'nowrap' as const,
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    marginBottom: 8,
  },
  smallBtn: {
    background: 'transparent',
    border: '1px solid #4a4660',
    color: '#a8a4b8',
    borderRadius: 'var(--radius-sm)',
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  dangerBtn: {
    background: 'transparent',
    border: '1px solid rgba(240,71,71,0.4)',
    color: '#f04747',
    borderRadius: 'var(--radius-sm)',
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface MembersSectionProps {
  guildId: string;
}

export function MembersSection({ guildId }: MembersSectionProps) {
  const queryClient = useQueryClient();
  const guilds = useGuildsStore((s) => s.guilds);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const guild = guilds.get(guildId);

  const [error, setError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberListFilter, setMemberListFilter] = useState<'all' | 'owners' | 'moderatable'>('all');
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [memberActionFeedback, setMemberActionFeedback] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banSearch, setBanSearch] = useState('');
  const [banSort, setBanSort] = useState<'recent' | 'name'>('recent');
  const [expandedBanReasons, setExpandedBanReasons] = useState<Set<string>>(new Set());
  const [activePanel, setActivePanel] = useState<'members' | 'bans'>('members');

  const { data: members = [] } = useQuery({
    queryKey: ['members', guildId],
    queryFn: () => api.guilds.getMembers(guildId, 200),
    enabled: Boolean(guildId),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['guild-roles', guildId],
    queryFn: () => api.guilds.getRoles(guildId),
    enabled: Boolean(guildId),
  });

  const { data: bans = [] } = useQuery({
    queryKey: ['guild-bans', guildId],
    queryFn: () => api.guilds.getBans(guildId),
    enabled: Boolean(guildId),
  });

  const bannedUserIds = useMemo(
    () => Array.from(new Set((Array.isArray(bans) ? bans : []).map((ban: any) => String(ban.userId)).filter(Boolean))),
    [bans],
  );

  const { data: bannedUserSummaries = [] } = useQuery({
    queryKey: ['users', 'summaries', 'bans', guildId, bannedUserIds],
    queryFn: () => api.users.getSummaries(bannedUserIds),
    enabled: bannedUserIds.length > 0,
    staleTime: 30_000,
  });

  // Persist and restore state
  useEffect(() => {
    const key = `server_settings_admin_ui_v1:${guildId}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
      if (parsed['memberListFilter'] && ['all', 'owners', 'moderatable'].includes(parsed['memberListFilter'])) {
        setMemberListFilter((prev) => (prev === 'all' ? (parsed['memberListFilter'] as typeof prev) : prev));
      }
      if (parsed['memberSearch']) setMemberSearch((prev) => prev || String(parsed['memberSearch']));
      if (parsed['banSort'] && ['recent', 'name'].includes(parsed['banSort'])) {
        setBanSort((prev) => (prev === 'recent' ? (parsed['banSort'] as typeof prev) : prev));
      }
      if (parsed['banSearch']) setBanSearch((prev) => prev || String(parsed['banSearch']));
    } catch {
      // ignore malformed state
    }
  }, [guildId]);

  useEffect(() => {
    const key = `server_settings_admin_ui_v1:${guildId}`;
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    })();
    localStorage.setItem(key, JSON.stringify({ ...existing, memberListFilter, memberSearch, banSort, banSearch }));
  }, [guildId, memberListFilter, memberSearch, banSort, banSearch]);

  useEffect(() => {
    if (!memberActionFeedback) return;
    const timer = window.setTimeout(() => setMemberActionFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [memberActionFeedback]);

  const safeRoles = Array.isArray(roles) ? roles : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const everyoneRole = useMemo(() => safeRoles.find((role) => role.name === '@everyone'), [safeRoles]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    let next = safeMembers;
    if (memberListFilter === 'owners') {
      next = next.filter((member) => guild?.ownerId && guild.ownerId === member.userId);
    } else if (memberListFilter === 'moderatable') {
      next = next.filter((member) => member.userId !== guild?.ownerId && member.userId !== currentUserId);
    }
    if (!q) return next;
    return next.filter((member) => {
      const displayName =
        (member as any).user?.displayName ??
        (member as any).user?.username ??
        member.nickname ??
        member.userId;
      return String(displayName).toLowerCase().includes(q) || String(member.userId).includes(q);
    });
  }, [safeMembers, memberSearch, memberListFilter, guild?.ownerId, currentUserId]);

  const bannedUserMap = useMemo(() => {
    const map = new Map<string, { username: string; displayName: string }>();
    bannedUserSummaries.forEach((u) => map.set(String(u.id), { username: u.username, displayName: u.displayName }));
    return map;
  }, [bannedUserSummaries]);

  const filteredSortedBans = useMemo(() => {
    const q = banSearch.trim().toLowerCase();
    const rows = (Array.isArray(bans) ? [...bans] : []).filter((ban: any) => {
      if (!q) return true;
      const summary = bannedUserMap.get(String(ban.userId));
      return (
        String(summary?.displayName ?? '').toLowerCase().includes(q) ||
        String(summary?.username ?? '').toLowerCase().includes(q) ||
        String(ban.userId ?? '').includes(q) ||
        String(ban.reason ?? '').toLowerCase().includes(q)
      );
    });
    rows.sort((a, b) => {
      if (banSort === 'name') {
        const aSummary = bannedUserMap.get(String(a.userId));
        const bSummary = bannedUserMap.get(String(b.userId));
        const aName = aSummary?.displayName ?? aSummary?.username ?? String(a.userId);
        const bName = bSummary?.displayName ?? bSummary?.username ?? String(b.userId);
        return String(aName).localeCompare(String(bName));
      }
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });
    return rows;
  }, [bans, banSearch, banSort, bannedUserMap]);

  async function handleKickMember(userId: string) {
    if (!window.confirm('Kick this member from the portal? They can rejoin with an invite.')) return;
    setError('');
    setMemberActionUserId(userId);
    try {
      await api.guilds.kickMember(guildId, userId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members', guildId] }),
        queryClient.invalidateQueries({ queryKey: ['guild-bans', guildId] }),
      ]);
      setMemberActionFeedback('Member kicked.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function handleBanMember(userId: string) {
    if (!window.confirm('Ban this member from the portal? They will be removed and blocked from rejoining until unbanned.')) return;
    setError('');
    setMemberActionUserId(userId);
    try {
      await api.guilds.ban(guildId, userId, banReason.trim() || undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members', guildId] }),
        queryClient.invalidateQueries({ queryKey: ['guild-bans', guildId] }),
      ]);
      setMemberActionFeedback('Member banned.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function handleUnbanMember(userId: string) {
    if (!window.confirm('Unban this user and allow them to join again?')) return;
    setError('');
    setMemberActionUserId(userId);
    try {
      await api.guilds.unban(guildId, userId);
      await queryClient.invalidateQueries({ queryKey: ['guild-bans', guildId] });
      setMemberActionFeedback('User unbanned.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMemberActionUserId(null);
    }
  }

  async function copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMemberActionFeedback(successMessage);
    } catch {
      setMemberActionFeedback('Failed to copy ID.');
    }
  }

  function resetView() {
    setMemberSearch('');
    setMemberListFilter('all');
    setBanSearch('');
    setBanSort('recent');
    setBanReason('');
    setMemberActionFeedback('Member filters reset.');
    localStorage.removeItem(`server_settings_admin_ui_v1:${guildId}`);
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.heading}>Members &amp; Moderation</h2>
          <p style={styles.muted}>
            Kick and ban portal members, and manage the current ban list. Only portal owners can use these actions.
          </p>
        </div>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.resetBtn}
            onClick={resetView}
            disabled={Boolean(memberActionUserId)}
          >
            Reset
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {memberActionFeedback && (
        <div style={styles.feedback} role="status" aria-live="polite">
          {memberActionFeedback}
        </div>
      )}

      {/* Panel navigation */}
      <div style={styles.tabRow}>
        <button
          type="button"
          style={activePanel === 'members' ? styles.tabActive : styles.tab}
          onClick={() => setActivePanel('members')}
        >
          Members ({members.length})
        </button>
        <button
          type="button"
          style={activePanel === 'bans' ? styles.tabActive : styles.tab}
          onClick={() => setActivePanel('bans')}
        >
          Banned ({bans.length})
        </button>
      </div>

      {/* Members panel */}
      {activePanel === 'members' && (
        <div style={styles.card}>
          <div style={styles.statsRow}>
            <button
              type="button"
              style={memberListFilter === 'all' ? styles.tabActive : styles.tab}
              onClick={() => setMemberListFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              style={memberListFilter === 'moderatable' ? styles.tabActive : styles.tab}
              onClick={() => setMemberListFilter('moderatable')}
            >
              Moderatable
            </button>
            <button
              type="button"
              style={memberListFilter === 'owners' ? styles.tabActive : styles.tab}
              onClick={() => setMemberListFilter('owners')}
            >
              Owners
            </button>
          </div>
          <div style={{ ...styles.row, marginBottom: 8 }}>
            <input
              style={styles.inputField}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members by name or ID"
            />
          </div>
          <div style={{ ...styles.row, marginBottom: 8 }}>
            <input
              style={styles.inputField}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason (optional, applies to next ban action)"
              maxLength={200}
            />
          </div>
          <div style={{ ...styles.muted, marginBottom: 8 }}>
            {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'} shown
          </div>

          <div style={styles.list}>
            {filteredMembers.length === 0 && (
              <div style={styles.muted}>No members match the current search.</div>
            )}
            {filteredMembers.map((member) => {
              const profile = (member as any).user as
                | { id?: string; username?: string; displayName?: string; avatarHash?: string | null }
                | undefined;
              const displayName = profile?.displayName ?? profile?.username ?? member.nickname ?? member.userId;
              const isSelf = Boolean(currentUserId && currentUserId === member.userId);
              const isOwner = Boolean(guild?.ownerId && guild.ownerId === member.userId);
              const isBusy = memberActionUserId === member.userId;
              const actionsDisabled = isBusy || isSelf || isOwner;
              const disabledReason = isOwner ? 'Owner' : isSelf ? 'You' : '';
              return (
                <div key={member.userId} style={styles.memberItem}>
                  <div style={styles.memberMeta}>
                    <div style={styles.memberName}>{displayName}</div>
                    <div style={styles.memberSubline}>
                      ID: {member.userId}
                      {member.nickname ? ` | Nickname: ${member.nickname}` : ''}
                      {Array.isArray(member.roleIds)
                        ? ` | Roles: ${Math.max(0, member.roleIds.filter((id) => String(id) !== everyoneRole?.id).length)}`
                        : ''}
                      {isOwner ? ' | Owner' : ''}
                      {isSelf ? ' | You' : ''}
                      {member.communicationDisabledUntil ? ' | Timed out' : ''}
                    </div>
                  </div>
                  <div style={styles.memberActions}>
                    <button
                      type="button"
                      style={styles.smallBtn}
                      onClick={() => copyTextToClipboard(String(member.userId), 'Copied member ID.')}
                      disabled={isBusy}
                      title="Copy member ID"
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      style={styles.smallBtn}
                      onClick={() => handleKickMember(member.userId)}
                      disabled={actionsDisabled}
                      title={isOwner ? 'Cannot moderate the portal owner' : isSelf ? 'Use Leave Portal to leave yourself' : undefined}
                    >
                      {isBusy ? 'Working...' : 'Kick'}
                    </button>
                    <button
                      type="button"
                      style={styles.dangerBtn}
                      onClick={() => handleBanMember(member.userId)}
                      disabled={actionsDisabled}
                      title={isOwner ? 'Cannot moderate the portal owner' : isSelf ? 'Cannot ban your own account' : undefined}
                    >
                      {isBusy ? 'Working...' : 'Ban'}
                    </button>
                    {disabledReason && (
                      <span style={styles.badge}>{disabledReason}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bans panel */}
      {activePanel === 'bans' && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Banned Users</div>
          <div style={styles.statsRow}>
            <button
              type="button"
              style={banSort === 'recent' ? styles.tabActive : styles.tab}
              onClick={() => setBanSort('recent')}
            >
              Recent
            </button>
            <button
              type="button"
              style={banSort === 'name' ? styles.tabActive : styles.tab}
              onClick={() => setBanSort('name')}
            >
              Name
            </button>
            <span style={styles.statPill}>{filteredSortedBans.length} shown</span>
            <button
              type="button"
              style={styles.smallBtn}
              onClick={async () => {
                const ids = filteredSortedBans.map((ban: any) => String(ban.userId)).join('\n');
                try {
                  await navigator.clipboard.writeText(ids);
                  setMemberActionFeedback(`Copied ${filteredSortedBans.length} banned user ID${filteredSortedBans.length === 1 ? '' : 's'}.`);
                } catch {
                  setMemberActionFeedback('Failed to copy banned user IDs.');
                }
              }}
              disabled={filteredSortedBans.length === 0}
            >
              Copy IDs
            </button>
          </div>
          <input
            style={{ ...styles.inputField, marginBottom: 8 }}
            value={banSearch}
            onChange={(e) => setBanSearch(e.target.value)}
            placeholder="Search banned users by name, username, ID, or reason"
          />
          <div style={styles.list}>
            {bans.length === 0 && <div style={styles.muted}>No bans in this portal.</div>}
            {bans.length > 0 && filteredSortedBans.length === 0 && (
              <div style={styles.muted}>No banned users match the current search.</div>
            )}
            {filteredSortedBans.map((ban: any) => {
              const bannedSummary = bannedUserMap.get(String(ban.userId));
              const banKey = `${ban.guildId}:${ban.userId}`;
              return (
                <div key={banKey} style={styles.memberItem}>
                  <div style={styles.memberMeta}>
                    <div style={styles.memberName}>
                      {bannedSummary?.displayName ?? bannedSummary?.username ?? ban.userId}
                    </div>
                    <div style={styles.memberSubline}>
                      {bannedSummary?.username ? `@${bannedSummary.username} | ` : ''}
                      ID: {ban.userId}
                      {' | '}
                      {(() => {
                        const reason = String(ban.reason ?? '');
                        const expanded = expandedBanReasons.has(banKey);
                        if (!reason) return 'No reason provided';
                        if (reason.length <= 96 || expanded) return `Reason: ${reason}`;
                        return `Reason: ${reason.slice(0, 96)}...`;
                      })()}
                      {ban.createdAt ? ` | ${new Date(ban.createdAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div style={styles.memberActions}>
                    {String(ban.reason ?? '').length > 96 && (
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() => {
                          setExpandedBanReasons((prev) => {
                            const next = new Set(prev);
                            if (next.has(banKey)) next.delete(banKey);
                            else next.add(banKey);
                            return next;
                          });
                        }}
                        disabled={memberActionUserId === ban.userId}
                      >
                        {expandedBanReasons.has(banKey) ? 'Less' : 'More'}
                      </button>
                    )}
                    <button
                      type="button"
                      style={styles.smallBtn}
                      onClick={() => handleUnbanMember(ban.userId)}
                      disabled={memberActionUserId === ban.userId}
                    >
                      {memberActionUserId === ban.userId ? 'Working...' : 'Unban'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
