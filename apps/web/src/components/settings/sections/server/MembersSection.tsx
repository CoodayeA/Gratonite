import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

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
    <section className="settings-section">
      <div className="server-settings-header-row">
        <div>
          <h2 className="settings-shell-section-heading">Members &amp; Moderation</h2>
          <p className="server-settings-muted">
            Kick and ban portal members, and manage the current ban list. Only portal owners can use these actions.
          </p>
        </div>
        <div className="server-settings-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={resetView}
            disabled={Boolean(memberActionUserId)}
          >
            Reset
          </button>
        </div>
      </div>

      {error && <div className="modal-error">{error}</div>}
      {memberActionFeedback && (
        <div className="server-settings-feedback" role="status" aria-live="polite">
          {memberActionFeedback}
        </div>
      )}

      {/* Panel navigation */}
      <div className="server-settings-inline-stats" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`discover-tag ${activePanel === 'members' ? 'active' : ''}`}
          onClick={() => setActivePanel('members')}
        >
          Members ({members.length})
        </button>
        <button
          type="button"
          className={`discover-tag ${activePanel === 'bans' ? 'active' : ''}`}
          onClick={() => setActivePanel('bans')}
        >
          Banned ({bans.length})
        </button>
      </div>

      {/* Members panel */}
      {activePanel === 'members' && (
        <div className="channel-permission-card">
          <div className="server-settings-inline-stats" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className={`discover-tag ${memberListFilter === 'all' ? 'active' : ''}`}
              onClick={() => setMemberListFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`discover-tag ${memberListFilter === 'moderatable' ? 'active' : ''}`}
              onClick={() => setMemberListFilter('moderatable')}
            >
              Moderatable
            </button>
            <button
              type="button"
              className={`discover-tag ${memberListFilter === 'owners' ? 'active' : ''}`}
              onClick={() => setMemberListFilter('owners')}
            >
              Owners
            </button>
          </div>
          <div className="channel-permission-row" style={{ marginBottom: 8 }}>
            <input
              className="input-field"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members by name or ID"
            />
          </div>
          <div className="channel-permission-row" style={{ marginBottom: 8 }}>
            <input
              className="input-field"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason (optional, applies to next ban action)"
              maxLength={200}
            />
          </div>
          <div className="server-settings-muted" style={{ marginBottom: 8 }}>
            {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'} shown
          </div>

          <div className="channel-permission-list">
            {filteredMembers.length === 0 && (
              <div className="server-settings-muted">No members match the current search.</div>
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
                <div key={member.userId} className="channel-permission-item server-member-admin-item">
                  <div className="server-member-admin-meta">
                    <div className="server-member-admin-name">{displayName}</div>
                    <div className="server-member-admin-subline">
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
                  <div className="server-member-admin-actions">
                    <button
                      type="button"
                      className="channel-permission-remove"
                      onClick={() => copyTextToClipboard(String(member.userId), 'Copied member ID.')}
                      disabled={isBusy}
                      title="Copy member ID"
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      className="channel-permission-remove"
                      onClick={() => handleKickMember(member.userId)}
                      disabled={actionsDisabled}
                      title={isOwner ? 'Cannot moderate the portal owner' : isSelf ? 'Use Leave Portal to leave yourself' : undefined}
                    >
                      {isBusy ? 'Working...' : 'Kick'}
                    </button>
                    <button
                      type="button"
                      className="emoji-admin-delete"
                      onClick={() => handleBanMember(member.userId)}
                      disabled={actionsDisabled}
                      title={isOwner ? 'Cannot moderate the portal owner' : isSelf ? 'Cannot ban your own account' : undefined}
                    >
                      {isBusy ? 'Working...' : 'Ban'}
                    </button>
                    {disabledReason && (
                      <span className="channel-permission-badge">{disabledReason}</span>
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
        <div className="channel-permission-card">
          <div className="channel-permission-title">Banned Users</div>
          <div className="server-settings-inline-stats" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className={`discover-tag ${banSort === 'recent' ? 'active' : ''}`}
              onClick={() => setBanSort('recent')}
            >
              Recent
            </button>
            <button
              type="button"
              className={`discover-tag ${banSort === 'name' ? 'active' : ''}`}
              onClick={() => setBanSort('name')}
            >
              Name
            </button>
            <span className="server-settings-stat-pill">{filteredSortedBans.length} shown</span>
            <button
              type="button"
              className="channel-permission-remove"
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
            className="input-field"
            value={banSearch}
            onChange={(e) => setBanSearch(e.target.value)}
            placeholder="Search banned users by name, username, ID, or reason"
            style={{ marginBottom: 8 }}
          />
          <div className="channel-permission-list">
            {bans.length === 0 && <div className="server-settings-muted">No bans in this portal.</div>}
            {bans.length > 0 && filteredSortedBans.length === 0 && (
              <div className="server-settings-muted">No banned users match the current search.</div>
            )}
            {filteredSortedBans.map((ban: any) => {
              const bannedSummary = bannedUserMap.get(String(ban.userId));
              const banKey = `${ban.guildId}:${ban.userId}`;
              return (
                <div key={banKey} className="channel-permission-item server-member-admin-item">
                  <div className="server-member-admin-meta">
                    <div className="server-member-admin-name">
                      {bannedSummary?.displayName ?? bannedSummary?.username ?? ban.userId}
                    </div>
                    <div className="server-member-admin-subline">
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
                  <div className="server-member-admin-actions">
                    {String(ban.reason ?? '').length > 96 && (
                      <button
                        type="button"
                        className="channel-permission-remove"
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
                      className="channel-permission-remove"
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
