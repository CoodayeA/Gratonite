import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
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
  cardInner: {
    background: 'rgba(0,0,0,0.15)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #4a4660',
    padding: 12,
    marginTop: 10,
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
  selectField: {
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 13,
    color: '#e8e4e0',
    outline: 'none',
    flex: 1,
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
  roleTarget: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e8e4e0',
    marginRight: 'auto',
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
  deleteBtn: {
    background: 'transparent',
    border: '1px solid rgba(240,71,71,0.4)',
    color: '#f04747',
    borderRadius: 'var(--radius-sm)',
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: 12,
    color: '#a8a4b8',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    marginBottom: 8,
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface RolesSectionProps {
  guildId: string;
}

export function RolesSection({ guildId }: RolesSectionProps) {
  const queryClient = useQueryClient();

  const [error, setError] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [selectedMemberForRoles, setSelectedMemberForRoles] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [rolesMemberSearch, setRolesMemberSearch] = useState('');
  const [assignRoleSearch, setAssignRoleSearch] = useState('');
  const [roleListSearch, setRoleListSearch] = useState('');
  const [roleListSort, setRoleListSort] = useState<'alpha' | 'memberCount' | 'mentionable'>('alpha');
  const [roleListSortDir, setRoleListSortDir] = useState<'asc' | 'desc'>('asc');
  const [roleListQuickFilter, setRoleListQuickFilter] = useState<'all' | 'custom' | 'mentionable'>('all');
  const [savingRoleMembership, setSavingRoleMembership] = useState(false);
  const [roleMembershipFeedback, setRoleMembershipFeedback] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'assign' | 'create'>('list');

  const { data: roles = [] } = useQuery({
    queryKey: ['guild-roles', guildId],
    queryFn: () => api.guilds.getRoles(guildId),
    enabled: Boolean(guildId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', guildId],
    queryFn: () => api.guilds.getMembers(guildId, 200),
    enabled: Boolean(guildId),
  });

  const { data: selectedMemberRoles = [] } = useQuery({
    queryKey: ['member-roles', guildId, selectedMemberForRoles],
    queryFn: () => api.guilds.getMemberRoles(guildId, selectedMemberForRoles),
    enabled: Boolean(guildId) && Boolean(selectedMemberForRoles),
  });

  // Persist and restore state
  useEffect(() => {
    const key = `server_settings_roles_state_v1:${guildId}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
      if (parsed['selectedMemberForRoles']) {
        setSelectedMemberForRoles((prev) => prev || String(parsed['selectedMemberForRoles']));
      }
      if (parsed['rolesMemberSearch']) {
        setRolesMemberSearch((prev) => prev || String(parsed['rolesMemberSearch']));
      }
      if (parsed['assignRoleSearch']) {
        setAssignRoleSearch((prev) => prev || String(parsed['assignRoleSearch']));
      }
    } catch {
      // ignore malformed state
    }
  }, [guildId]);

  useEffect(() => {
    const key = `server_settings_roles_state_v1:${guildId}`;
    localStorage.setItem(key, JSON.stringify({ selectedMemberForRoles, rolesMemberSearch, assignRoleSearch }));
  }, [guildId, selectedMemberForRoles, rolesMemberSearch, assignRoleSearch]);

  useEffect(() => {
    if (!roleMembershipFeedback) return;
    const timer = window.setTimeout(() => setRoleMembershipFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [roleMembershipFeedback]);

  const roleMemberCountByRoleId = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((member) => {
      (member.roleIds ?? []).forEach((roleId) => {
        const key = String(roleId);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
    return counts;
  }, [members]);

  const filteredRoleAssignMemberOptions = useMemo(() => {
    const q = rolesMemberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const displayName =
        (member as any).user?.displayName ??
        (member as any).user?.username ??
        member.nickname ??
        member.userId;
      return !q || String(displayName).toLowerCase().includes(q) || String(member.userId).includes(q);
    });
  }, [members, rolesMemberSearch]);

  const filteredAssignableRoles = useMemo(() => {
    const q = assignRoleSearch.trim().toLowerCase();
    return roles
      .filter((role) => role.name !== '@everyone')
      .filter((role) => !q || String(role.name).toLowerCase().includes(q));
  }, [roles, assignRoleSearch]);

  const selectedMemberRoleIdSet = useMemo(
    () => new Set(selectedMemberRoles.map((role) => String(role.id))),
    [selectedMemberRoles],
  );

  const filteredAvailableAssignableRoles = useMemo(
    () =>
      filteredAssignableRoles.filter(
        (role) => !selectedMemberForRoles || !selectedMemberRoleIdSet.has(String(role.id)),
      ),
    [filteredAssignableRoles, selectedMemberForRoles, selectedMemberRoleIdSet],
  );

  const assignRoleAlreadyPresent = Boolean(assignRoleId && selectedMemberRoleIdSet.has(String(assignRoleId)));

  const selectedMemberRoleTargetLabel = useMemo(() => {
    if (!selectedMemberForRoles) return '';
    const member = members.find((m) => m.userId === selectedMemberForRoles);
    return (
      (member as any)?.user?.displayName ??
      (member as any)?.user?.username ??
      member?.nickname ??
      selectedMemberForRoles
    );
  }, [members, selectedMemberForRoles]);

  const filteredRoleList = useMemo(() => {
    const q = roleListSearch.trim().toLowerCase();
    return roles
      .filter((role) => {
        if (roleListQuickFilter === 'custom') return role.name !== '@everyone';
        if (roleListQuickFilter === 'mentionable') return Boolean(role.mentionable) && role.name !== '@everyone';
        return true;
      })
      .filter((role) => !q || String(role.name).toLowerCase().includes(q));
  }, [roles, roleListSearch, roleListQuickFilter]);

  const roleStats = useMemo(
    () => ({
      total: roles.length,
      custom: roles.filter((role) => role.name !== '@everyone').length,
      mentionable: roles.filter((role) => role.mentionable && role.name !== '@everyone').length,
    }),
    [roles],
  );

  const sortedRoleList = useMemo(() => {
    const base = [...filteredRoleList];
    if (roleListSort === 'memberCount') {
      const sorted = base.sort((a, b) => {
        const countDiff =
          (roleMemberCountByRoleId.get(String(b.id)) ?? 0) -
          (roleMemberCountByRoleId.get(String(a.id)) ?? 0);
        if (countDiff !== 0) return countDiff;
        return String(a.name).localeCompare(String(b.name));
      });
      return roleListSortDir === 'asc' ? [...sorted].reverse() : sorted;
    }
    if (roleListSort === 'mentionable') {
      const sorted = base.sort((a, b) => {
        if (Boolean(b.mentionable) !== Boolean(a.mentionable)) return b.mentionable ? 1 : -1;
        return String(a.name).localeCompare(String(b.name));
      });
      return roleListSortDir === 'asc' ? [...sorted].reverse() : sorted;
    }
    const sorted = base.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return roleListSortDir === 'asc' ? sorted : [...sorted].reverse();
  }, [filteredRoleList, roleListSort, roleListSortDir, roleMemberCountByRoleId]);

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) return;
    setError('');
    setCreatingRole(true);
    try {
      await api.guilds.createRole(guildId, { name, mentionable: true });
      setNewRoleName('');
      await queryClient.invalidateQueries({ queryKey: ['guild-roles', guildId] });
      setRoleMembershipFeedback('Role created.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingRole(false);
    }
  }

  async function handleToggleRoleMentionable(roleId: string, nextMentionable: boolean) {
    setError('');
    try {
      await api.guilds.updateRole(guildId, roleId, { mentionable: nextMentionable });
      await queryClient.invalidateQueries({ queryKey: ['guild-roles', guildId] });
      setRoleMembershipFeedback(nextMentionable ? 'Role is now mentionable.' : 'Role mention disabled.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDeleteRole(roleId: string) {
    setError('');
    try {
      await api.guilds.deleteRole(guildId, roleId);
      await queryClient.invalidateQueries({ queryKey: ['guild-roles', guildId] });
      if (assignRoleId === roleId) setAssignRoleId('');
      if (selectedMemberForRoles) {
        await queryClient.invalidateQueries({ queryKey: ['member-roles', guildId, selectedMemberForRoles] });
      }
      setRoleMembershipFeedback('Role deleted.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleAssignRoleToMember() {
    if (!selectedMemberForRoles || !assignRoleId || assignRoleAlreadyPresent) return;
    setError('');
    setSavingRoleMembership(true);
    try {
      await api.guilds.assignMemberRole(guildId, selectedMemberForRoles, assignRoleId);
      await queryClient.invalidateQueries({ queryKey: ['member-roles', guildId, selectedMemberForRoles] });
      setAssignRoleId('');
      setRoleMembershipFeedback('Role assigned to member.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingRoleMembership(false);
    }
  }

  async function handleRemoveRoleFromMember(roleId: string) {
    if (!selectedMemberForRoles) return;
    setError('');
    setSavingRoleMembership(true);
    try {
      await api.guilds.removeMemberRole(guildId, selectedMemberForRoles, roleId);
      await queryClient.invalidateQueries({ queryKey: ['member-roles', guildId, selectedMemberForRoles] });
      setRoleMembershipFeedback('Role removed from member.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingRoleMembership(false);
    }
  }

  async function copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setRoleMembershipFeedback(successMessage);
    } catch {
      setRoleMembershipFeedback('Failed to copy ID.');
    }
  }

  function resetView() {
    setRolesMemberSearch('');
    setAssignRoleSearch('');
    setAssignRoleId('');
    setSelectedMemberForRoles('');
    setRoleListSearch('');
    setRoleListSort('alpha');
    setRoleListSortDir('asc');
    setRoleListQuickFilter('all');
    setRoleMembershipFeedback('Role filters reset.');
    localStorage.removeItem(`server_settings_roles_state_v1:${guildId}`);
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.heading}>Roles &amp; Groups</h2>
          <p style={styles.muted}>
            Roles power @group mentions. Create a role, make it mentionable, then assign members.
          </p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.resetBtn} onClick={resetView}>
            Reset
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {roleMembershipFeedback && (
        <div style={styles.feedback} role="status" aria-live="polite">
          {roleMembershipFeedback}
        </div>
      )}

      {/* Tab navigation */}
      <div style={styles.tabRow}>
        <button
          type="button"
          style={activeTab === 'list' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('list')}
        >
          All Roles ({roleStats.total})
        </button>
        <button
          type="button"
          style={activeTab === 'assign' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('assign')}
        >
          Assign Members
        </button>
        <button
          type="button"
          style={activeTab === 'create' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('create')}
        >
          + Create Role
        </button>
      </div>

      {/* Create Role tab */}
      {activeTab === 'create' && (
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={styles.cardTitle}>Create New Role</div>
          <p style={{ ...styles.muted, marginBottom: 8 }}>
            New roles are mentionable by default. You can change this after creation.
          </p>
          <div style={styles.row}>
            <input
              style={styles.inputField}
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Ex: raid-team"
              disabled={creatingRole}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRole();
              }}
            />
            <Button type="button" onClick={handleCreateRole} disabled={!newRoleName.trim() || creatingRole}>
              {creatingRole ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {/* Assign Members tab */}
      {activeTab === 'assign' && (
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={styles.cardTitle}>Assign Members to Roles</div>
          <p style={{ ...styles.muted, marginBottom: 8 }}>
            Select a member, then pick a role to assign. Existing roles for the selected member are shown below.
          </p>
          <input
            style={{ ...styles.inputField, marginBottom: 8 }}
            value={rolesMemberSearch}
            onChange={(e) => setRolesMemberSearch(e.target.value)}
            placeholder="Filter members by name or ID"
            disabled={savingRoleMembership}
          />
          <div style={{ ...styles.row, marginBottom: 8 }}>
            <select
              style={styles.selectField}
              value={selectedMemberForRoles}
              onChange={(e) => setSelectedMemberForRoles(e.target.value)}
              disabled={savingRoleMembership}
            >
              <option value="">Select member</option>
              {filteredRoleAssignMemberOptions.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {(member as any).user?.displayName ?? member.nickname ?? member.userId}
                </option>
              ))}
            </select>
          </div>
          <input
            style={{ ...styles.inputField, marginBottom: 8 }}
            value={assignRoleSearch}
            onChange={(e) => setAssignRoleSearch(e.target.value)}
            placeholder="Filter roles"
            disabled={!selectedMemberForRoles || savingRoleMembership}
          />
          <div style={styles.row}>
            <select
              style={styles.selectField}
              value={assignRoleId}
              onChange={(e) => setAssignRoleId(e.target.value)}
              disabled={!selectedMemberForRoles || savingRoleMembership}
            >
              <option value="">Select role</option>
              {filteredAvailableAssignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={handleAssignRoleToMember}
              disabled={!selectedMemberForRoles || !assignRoleId || savingRoleMembership || assignRoleAlreadyPresent}
            >
              {assignRoleAlreadyPresent ? 'Already Assigned' : 'Assign'}
            </Button>
          </div>
          {assignRoleAlreadyPresent && (
            <div style={{ ...styles.muted, marginTop: 2 }}>
              This member already has that role.
            </div>
          )}
          {selectedMemberForRoles && !assignRoleAlreadyPresent && filteredAvailableAssignableRoles.length === 0 && (
            <div style={{ ...styles.muted, marginTop: 2 }}>
              This member already has all available custom roles.
            </div>
          )}

          {selectedMemberForRoles && (
            <div style={styles.cardInner}>
              <div style={{ ...styles.statsRow, marginBottom: 6 }}>
                <span style={styles.statPill}>Managing: {selectedMemberRoleTargetLabel}</span>
                <button
                  type="button"
                  style={styles.smallBtn}
                  onClick={() => {
                    setSelectedMemberForRoles('');
                    setAssignRoleId('');
                    setAssignRoleSearch('');
                  }}
                  disabled={savingRoleMembership}
                >
                  Clear
                </button>
              </div>

              <div style={styles.list}>
                {selectedMemberRoles.filter((role) => role.name !== '@everyone').length === 0 && (
                  <div style={styles.muted}>This member has no custom roles yet.</div>
                )}
                {selectedMemberRoles
                  .filter((role) => role.name !== '@everyone')
                  .map((role) => (
                    <div key={role.id} style={styles.listItem}>
                      <span style={styles.roleTarget}>@{role.name}</span>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() => handleRemoveRoleFromMember(role.id)}
                        disabled={savingRoleMembership}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role List tab */}
      {activeTab === 'list' && (
        <div style={styles.card}>
          <div style={styles.statsRow}>
            <span style={styles.statPill}>{roleStats.total} total</span>
            <span style={styles.statPill}>{roleStats.custom} custom</span>
            <span style={styles.statPill}>{roleStats.mentionable} mentionable</span>
          </div>

          {/* Sort controls */}
          <div style={styles.statsRow}>
            <button
              type="button"
              style={roleListSort === 'alpha' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListSort('alpha')}
            >
              A-Z
            </button>
            <button
              type="button"
              style={roleListSort === 'memberCount' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListSort('memberCount')}
            >
              Members
            </button>
            <button
              type="button"
              style={roleListSort === 'mentionable' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListSort('mentionable')}
            >
              Mentionable
            </button>
            <button
              type="button"
              style={roleListSortDir === 'asc' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={roleListSortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {roleListSortDir === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>

          {/* Quick filters */}
          <div style={styles.statsRow}>
            <button
              type="button"
              style={roleListQuickFilter === 'all' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListQuickFilter('all')}
            >
              All Roles
            </button>
            <button
              type="button"
              style={roleListQuickFilter === 'custom' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListQuickFilter('custom')}
            >
              Custom Only
            </button>
            <button
              type="button"
              style={roleListQuickFilter === 'mentionable' ? styles.tabActive : styles.tab}
              onClick={() => setRoleListQuickFilter('mentionable')}
            >
              Mentionable Only
            </button>
          </div>

          <input
            style={{ ...styles.inputField, marginBottom: 8 }}
            value={roleListSearch}
            onChange={(e) => setRoleListSearch(e.target.value)}
            placeholder="Search roles..."
          />

          <div style={styles.list}>
            {roles.length === 0 && <div style={styles.muted}>No roles found.</div>}
            {roles.length > 0 && filteredRoleList.length === 0 && (
              <div style={styles.muted}>No roles match the current filter.</div>
            )}
            {sortedRoleList.map((role) => (
              <div key={role.id} style={styles.listItem}>
                <span style={styles.roleTarget}>@{role.name}</span>
                <span style={styles.badge}>
                  {(() => {
                    const count = roleMemberCountByRoleId.get(String(role.id)) ?? 0;
                    if (count > 99) return '99+ members';
                    return `${count} member${count === 1 ? '' : 's'}`;
                  })()}
                </span>
                <button
                  type="button"
                  style={styles.smallBtn}
                  onClick={() => copyTextToClipboard(String(role.id), 'Copied role ID.')}
                  title="Copy role ID"
                >
                  Copy ID
                </button>
                <label style={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={Boolean(role.mentionable)}
                    onChange={(e) => handleToggleRoleMentionable(role.id, e.target.checked)}
                    disabled={role.name === '@everyone'}
                  />
                  <span>Mentionable</span>
                </label>
                {role.name !== '@everyone' && (
                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={() => handleDeleteRole(role.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
