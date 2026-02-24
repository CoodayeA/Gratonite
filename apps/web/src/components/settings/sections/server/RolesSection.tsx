import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

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
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Roles &amp; Groups</h2>
      <p className="server-settings-muted">
        Roles power @group mentions. Create a role, make it mentionable, then assign members.
      </p>

      {error && <div className="modal-error">{error}</div>}

      <div className="server-settings-inline-stats" style={{ marginBottom: 8 }}>
        <span className="server-settings-stat-pill">Admin workflow tools</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetView}>
          Reset Role View
        </button>
      </div>

      <div className="channel-permission-card" style={{ marginBottom: 12 }}>
        <div className="channel-permission-title">Create Role</div>
        <div className="channel-permission-row">
          <input
            className="input-field"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Ex: raid-team"
            disabled={creatingRole}
          />
          <Button type="button" onClick={handleCreateRole} disabled={!newRoleName.trim() || creatingRole}>
            {creatingRole ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>

      <div className="channel-permission-card" style={{ marginBottom: 12 }}>
        <div className="channel-permission-title">Assign Members to Roles</div>
        <input
          className="input-field"
          value={rolesMemberSearch}
          onChange={(e) => setRolesMemberSearch(e.target.value)}
          placeholder="Filter members"
          disabled={savingRoleMembership}
          style={{ marginBottom: 8 }}
        />
        <div className="channel-permission-row" style={{ marginBottom: 8 }}>
          <select
            className="input-field"
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
          className="input-field"
          value={assignRoleSearch}
          onChange={(e) => setAssignRoleSearch(e.target.value)}
          placeholder="Filter roles"
          disabled={!selectedMemberForRoles || savingRoleMembership}
          style={{ marginBottom: 8 }}
        />
        <div className="channel-permission-row">
          <select
            className="input-field"
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
          <div className="server-settings-muted" style={{ marginTop: 2 }}>
            This member already has that role.
          </div>
        )}
        {roleMembershipFeedback && (
          <div className="server-settings-feedback" style={{ marginTop: 2 }} role="status" aria-live="polite">
            {roleMembershipFeedback}
          </div>
        )}
        {selectedMemberForRoles && !assignRoleAlreadyPresent && filteredAvailableAssignableRoles.length === 0 && (
          <div className="server-settings-muted" style={{ marginTop: 2 }}>
            This member already has all available custom roles.
          </div>
        )}

        {selectedMemberForRoles && (
          <div className="server-settings-inline-stats" style={{ marginTop: 2 }}>
            <span className="server-settings-stat-pill">Managing: {selectedMemberRoleTargetLabel}</span>
            <button
              type="button"
              className="channel-permission-remove"
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
        )}

        {selectedMemberForRoles && (
          <div className="channel-permission-list" style={{ marginTop: 10 }}>
            {selectedMemberRoles.filter((role) => role.name !== '@everyone').length === 0 && (
              <div className="server-settings-muted">This member has no custom roles yet.</div>
            )}
            {selectedMemberRoles
              .filter((role) => role.name !== '@everyone')
              .map((role) => (
                <div key={role.id} className="channel-permission-item">
                  <span className="channel-permission-target">@{role.name}</span>
                  <button
                    type="button"
                    className="channel-permission-remove"
                    onClick={() => handleRemoveRoleFromMember(role.id)}
                    disabled={savingRoleMembership}
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="channel-permission-list">
        <div className="server-settings-inline-stats">
          <span className="server-settings-stat-pill">{roleStats.total} total roles</span>
          <span className="server-settings-stat-pill">{roleStats.custom} custom</span>
          <span className="server-settings-stat-pill">{roleStats.mentionable} mentionable</span>
        </div>
        <div className="server-settings-inline-stats">
          <button
            type="button"
            className={`discover-tag ${roleListSort === 'alpha' ? 'active' : ''}`}
            onClick={() => setRoleListSort('alpha')}
          >
            A-Z
          </button>
          <button
            type="button"
            className={`discover-tag ${roleListSort === 'memberCount' ? 'active' : ''}`}
            onClick={() => setRoleListSort('memberCount')}
          >
            Members
          </button>
          <button
            type="button"
            className={`discover-tag ${roleListSort === 'mentionable' ? 'active' : ''}`}
            onClick={() => setRoleListSort('mentionable')}
          >
            Mentionable
          </button>
          <button
            type="button"
            className={`discover-tag ${roleListSortDir === 'asc' ? 'active' : ''}`}
            onClick={() => setRoleListSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            title={roleListSortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {roleListSortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
        <div className="server-settings-inline-stats">
          <button
            type="button"
            className={`discover-tag ${roleListQuickFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRoleListQuickFilter('all')}
          >
            All Roles
          </button>
          <button
            type="button"
            className={`discover-tag ${roleListQuickFilter === 'custom' ? 'active' : ''}`}
            onClick={() => setRoleListQuickFilter('custom')}
          >
            Custom Only
          </button>
          <button
            type="button"
            className={`discover-tag ${roleListQuickFilter === 'mentionable' ? 'active' : ''}`}
            onClick={() => setRoleListQuickFilter('mentionable')}
          >
            Mentionable Only
          </button>
        </div>
        <input
          className="input-field"
          value={roleListSearch}
          onChange={(e) => setRoleListSearch(e.target.value)}
          placeholder="Filter roles"
        />
        {roles.length === 0 && <div className="server-settings-muted">No roles found.</div>}
        {roles.length > 0 && filteredRoleList.length === 0 && (
          <div className="server-settings-muted">No roles match the current filter.</div>
        )}
        {sortedRoleList.map((role) => (
          <div key={role.id} className="channel-permission-item">
            <span className="channel-permission-target">@{role.name}</span>
            <span className="channel-permission-badge">
              {(() => {
                const count = roleMemberCountByRoleId.get(String(role.id)) ?? 0;
                if (count > 99) return '99+ members';
                return `${count} member${count === 1 ? '' : 's'}`;
              })()}
            </span>
            <button
              type="button"
              className="channel-permission-remove"
              onClick={() => copyTextToClipboard(String(role.id), 'Copied role ID.')}
              title="Copy role ID"
            >
              Copy ID
            </button>
            <label className="channel-private-toggle" style={{ margin: 0, gap: 8 }}>
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
                className="channel-permission-remove"
                onClick={() => handleDeleteRole(role.id)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
