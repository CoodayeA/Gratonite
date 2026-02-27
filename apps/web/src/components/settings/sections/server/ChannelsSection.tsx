import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { PermissionFlags } from '@gratonite/types';

const VIEW_CHANNEL_FLAG = PermissionFlags.VIEW_CHANNEL;

function hasFlag(value: string, flag: bigint) {
  return (BigInt(value) & flag) === flag;
}

function addFlag(value: string, flag: bigint) {
  return (BigInt(value) | flag).toString();
}

function removeFlag(value: string, flag: bigint) {
  return (BigInt(value) & ~flag).toString();
}

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  } as React.CSSProperties,
  muted: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  modalError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  inlineStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  } as React.CSSProperties,
  statPill: {
    fontSize: 11,
    color: 'var(--text-muted)',
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
  } as React.CSSProperties,
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  inputField: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
  } as React.CSSProperties,
  privateToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text)',
  } as React.CSSProperties,
  privateToggleInput: {
    width: 14,
    height: 14,
  } as React.CSSProperties,
  permissionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  } as React.CSSProperties,
  permissionCard: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: 10,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  permissionTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  permissionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    minWidth: 0,
  } as React.CSSProperties,
  permissionList: {
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  permissionItem: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(6, 10, 20, 0.55)',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  permissionTarget: {
    fontSize: 13,
    color: 'var(--text)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  permissionBadge: {
    fontSize: 11,
    borderRadius: 'var(--radius-pill)',
    padding: '3px 7px',
    border: '1px solid var(--stroke)',
  } as React.CSSProperties,
  badgeAllow: {
    fontSize: 11,
    borderRadius: 'var(--radius-pill)',
    padding: '3px 7px',
    color: '#9be8b6',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(155, 232, 182, 0.45)',
    background: 'rgba(155, 232, 182, 0.14)',
  } as React.CSSProperties,
  badgeDeny: {
    fontSize: 11,
    borderRadius: 'var(--radius-pill)',
    padding: '3px 7px',
    color: '#ffb0b0',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 125, 125, 0.45)',
    background: 'rgba(255, 125, 125, 0.12)',
  } as React.CSSProperties,
  permissionRemove: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 8px',
    fontSize: 12,
    flexShrink: 0,
    cursor: 'pointer',
  } as React.CSSProperties,
  permissionRemoveRight: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 8px',
    fontSize: 12,
    flexShrink: 0,
    marginLeft: 'auto',
    cursor: 'pointer',
  } as React.CSSProperties,
  feedback: {
    fontSize: 12,
    color: 'var(--text-muted)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '6px 8px',
    lineHeight: 1.35,
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  discoverTag: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(8, 12, 22, 0.34)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  discoverTagActive: {
    color: 'var(--text)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(121, 223, 255, 0.24)',
    background: 'rgba(121, 223, 255, 0.08)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
};

interface ChannelsSectionProps {
  guildId: string;
}

export function ChannelsSection({ guildId }: ChannelsSectionProps) {
  const queryClient = useQueryClient();

  const [error, setError] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [channelRoleSearch, setChannelRoleSearch] = useState('');
  const [channelMemberSearch, setChannelMemberSearch] = useState('');
  const [channelOverrideSearch, setChannelOverrideSearch] = useState('');
  const [channelOverrideTypeFilter, setChannelOverrideTypeFilter] = useState<'all' | 'role' | 'user'>('all');
  const [channelOverrideVisibilityFilter, setChannelOverrideVisibilityFilter] = useState<'all' | 'allow' | 'deny'>('all');
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [channelPermissionFeedback, setChannelPermissionFeedback] = useState('');

  const { data: channels = [] } = useQuery({
    queryKey: ['guild-channels', guildId],
    queryFn: () => api.channels.getGuildChannels(guildId),
    enabled: Boolean(guildId),
  });

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

  const { data: channelOverrides = [] } = useQuery({
    queryKey: ['channel-permissions', selectedChannelId],
    queryFn: () => api.channels.getPermissionOverrides(selectedChannelId),
    enabled: Boolean(selectedChannelId),
  });

  // Persist and restore state
  useEffect(() => {
    const key = `server_settings_channel_state_v1:${guildId}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, string>;
      if (parsed['selectedChannelId']) setSelectedChannelId((prev) => prev || String(parsed['selectedChannelId']));
      if (parsed['channelSearch']) setChannelSearch((prev) => prev || String(parsed['channelSearch']));
      if (parsed['channelRoleSearch']) setChannelRoleSearch((prev) => prev || String(parsed['channelRoleSearch']));
      if (parsed['channelMemberSearch']) setChannelMemberSearch((prev) => prev || String(parsed['channelMemberSearch']));
      if (parsed['channelOverrideSearch']) setChannelOverrideSearch((prev) => prev || String(parsed['channelOverrideSearch']));
      if (parsed['selectedRoleId']) setSelectedRoleId((prev) => prev || String(parsed['selectedRoleId']));
      if (parsed['selectedUserId']) setSelectedUserId((prev) => prev || String(parsed['selectedUserId']));
      if (parsed['channelOverrideTypeFilter'] && ['all', 'role', 'user'].includes(parsed['channelOverrideTypeFilter'])) {
        setChannelOverrideTypeFilter((prev) => (prev === 'all' ? (parsed['channelOverrideTypeFilter'] as typeof prev) : prev));
      }
      if (parsed['channelOverrideVisibilityFilter'] && ['all', 'allow', 'deny'].includes(parsed['channelOverrideVisibilityFilter'])) {
        setChannelOverrideVisibilityFilter((prev) => (prev === 'all' ? (parsed['channelOverrideVisibilityFilter'] as typeof prev) : prev));
      }
    } catch {
      // ignore malformed state
    }
  }, [guildId]);

  useEffect(() => {
    const key = `server_settings_channel_state_v1:${guildId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        selectedChannelId,
        channelSearch,
        channelRoleSearch,
        channelMemberSearch,
        channelOverrideSearch,
        selectedRoleId,
        selectedUserId,
        channelOverrideTypeFilter,
        channelOverrideVisibilityFilter,
      }),
    );
  }, [
    guildId,
    selectedChannelId,
    channelSearch,
    channelRoleSearch,
    channelMemberSearch,
    channelOverrideSearch,
    selectedRoleId,
    selectedUserId,
    channelOverrideTypeFilter,
    channelOverrideVisibilityFilter,
  ]);

  useEffect(() => {
    if (!channelPermissionFeedback) return;
    const timer = window.setTimeout(() => setChannelPermissionFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [channelPermissionFeedback]);

  const everyoneRole = useMemo(() => roles.find((role) => role.name === '@everyone'), [roles]);

  const everyoneOverride = useMemo(
    () =>
      channelOverrides.find(
        (override) => override.targetType === 'role' && override.targetId === everyoneRole?.id,
      ),
    [channelOverrides, everyoneRole],
  );

  const isPrivateChannel = Boolean(everyoneOverride && hasFlag(everyoneOverride.deny, VIEW_CHANNEL_FLAG));

  const channelGrantEntries = useMemo(
    () =>
      channelOverrides.filter(
        (override) =>
          hasFlag(override.allow, VIEW_CHANNEL_FLAG) || hasFlag(override.deny, VIEW_CHANNEL_FLAG),
      ),
    [channelOverrides],
  );

  const channelOverrideStateByTarget = useMemo(() => {
    const map = new Map<string, 'allow' | 'deny'>();
    channelGrantEntries.forEach((override) => {
      const key = `${override.targetType}:${override.targetId}`;
      if (hasFlag(override.allow, VIEW_CHANNEL_FLAG)) map.set(key, 'allow');
      else if (hasFlag(override.deny, VIEW_CHANNEL_FLAG)) map.set(key, 'deny');
    });
    return map;
  }, [channelGrantEntries]);

  const configurableChannels = useMemo(
    () => channels.filter((channel) => channel.type !== 'GUILD_CATEGORY'),
    [channels],
  );

  const filteredConfigurableChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return configurableChannels;
    return configurableChannels.filter(
      (channel) =>
        String(channel.name).toLowerCase().includes(q) ||
        String(channel.id).includes(q) ||
        String(channel.type).toLowerCase().includes(q),
    );
  }, [configurableChannels, channelSearch]);

  const filteredChannelRoleOptions = useMemo(() => {
    const q = channelRoleSearch.trim().toLowerCase();
    return roles.filter((role) => !q || String(role.name).toLowerCase().includes(q));
  }, [roles, channelRoleSearch]);

  const filteredChannelMemberOptions = useMemo(() => {
    const q = channelMemberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const displayName =
        (member as any).user?.displayName ??
        (member as any).user?.username ??
        member.nickname ??
        member.userId;
      return !q || String(displayName).toLowerCase().includes(q) || String(member.userId).includes(q);
    });
  }, [members, channelMemberSearch]);

  const filteredGrantableChannelRoleOptions = useMemo(
    () =>
      filteredChannelRoleOptions.filter(
        (role) => channelOverrideStateByTarget.get(`role:${role.id}`) !== 'allow',
      ),
    [filteredChannelRoleOptions, channelOverrideStateByTarget],
  );

  const filteredGrantableChannelMemberOptions = useMemo(
    () =>
      filteredChannelMemberOptions.filter(
        (member) => channelOverrideStateByTarget.get(`user:${member.userId}`) !== 'allow',
      ),
    [filteredChannelMemberOptions, channelOverrideStateByTarget],
  );

  const channelOverrideStats = useMemo(
    () => ({
      total: channelGrantEntries.length,
      allow: channelGrantEntries.filter((override) => hasFlag(override.allow, VIEW_CHANNEL_FLAG)).length,
      deny: channelGrantEntries.filter((override) => hasFlag(override.deny, VIEW_CHANNEL_FLAG)).length,
    }),
    [channelGrantEntries],
  );

  const channelOverrideGroupedStats = useMemo(() => {
    let roleAllow = 0;
    let roleDeny = 0;
    let userAllow = 0;
    let userDeny = 0;
    channelGrantEntries.forEach((override) => {
      const isAllow = hasFlag(override.allow, VIEW_CHANNEL_FLAG);
      const isDeny = hasFlag(override.deny, VIEW_CHANNEL_FLAG);
      if (override.targetType === 'role') {
        if (isAllow) roleAllow += 1;
        if (isDeny) roleDeny += 1;
      } else {
        if (isAllow) userAllow += 1;
        if (isDeny) userDeny += 1;
      }
    });
    return { roleAllow, roleDeny, userAllow, userDeny };
  }, [channelGrantEntries]);

  const filteredChannelGrantEntries = useMemo(() => {
    const q = channelOverrideSearch.trim().toLowerCase();
    if (!q) return channelGrantEntries;
    return channelGrantEntries.filter((override) => {
      const label =
        override.targetType === 'role'
          ? roles.find((role) => role.id === override.targetId)?.name ?? override.targetId
          : (members.find((member) => member.userId === override.targetId) as any)?.user?.displayName ??
            members.find((member) => member.userId === override.targetId)?.nickname ??
            override.targetId;
      return String(label).toLowerCase().includes(q) || String(override.targetId).includes(q);
    });
  }, [channelGrantEntries, channelOverrideSearch, roles, members]);

  const filteredChannelGrantEntriesByMode = useMemo(
    () =>
      filteredChannelGrantEntries.filter((override) => {
        if (channelOverrideTypeFilter !== 'all' && override.targetType !== channelOverrideTypeFilter) return false;
        if (channelOverrideVisibilityFilter === 'allow' && !hasFlag(override.allow, VIEW_CHANNEL_FLAG)) return false;
        if (channelOverrideVisibilityFilter === 'deny' && !hasFlag(override.deny, VIEW_CHANNEL_FLAG)) return false;
        return true;
      }),
    [filteredChannelGrantEntries, channelOverrideTypeFilter, channelOverrideVisibilityFilter],
  );

  const sortedChannelGrantEntries = useMemo(
    () =>
      [...filteredChannelGrantEntriesByMode].sort((a, b) => {
        if (a.targetType !== b.targetType) return a.targetType === 'role' ? -1 : 1;
        const aLabel =
          a.targetType === 'role'
            ? roles.find((role) => role.id === a.targetId)?.name ?? a.targetId
            : (members.find((member) => member.userId === a.targetId) as any)?.user?.displayName ??
              members.find((member) => member.userId === a.targetId)?.nickname ??
              a.targetId;
        const bLabel =
          b.targetType === 'role'
            ? roles.find((role) => role.id === b.targetId)?.name ?? b.targetId
            : (members.find((member) => member.userId === b.targetId) as any)?.user?.displayName ??
              members.find((member) => member.userId === b.targetId)?.nickname ??
              b.targetId;
        return String(aLabel).localeCompare(String(bLabel));
      }),
    [filteredChannelGrantEntriesByMode, roles, members],
  );

  const selectedRoleOverrideState = selectedRoleId
    ? channelOverrideStateByTarget.get(`role:${selectedRoleId}`) ?? null
    : null;
  const selectedUserOverrideState = selectedUserId
    ? channelOverrideStateByTarget.get(`user:${selectedUserId}`) ?? null
    : null;

  const visibleChannelOverrideCount = sortedChannelGrantEntries.length;
  const grantableRoleCount = filteredGrantableChannelRoleOptions.length;
  const grantableMemberCount = filteredGrantableChannelMemberOptions.length;

  async function refreshPermissions() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['channel-permissions', selectedChannelId] }),
      queryClient.invalidateQueries({ queryKey: ['guild-channels', guildId] }),
    ]);
  }

  async function handlePrivateToggle(nextPrivate: boolean) {
    if (!selectedChannelId || !everyoneRole) return;
    setError('');
    setSavingPermissions(true);
    try {
      const current = everyoneOverride ?? null;
      if (nextPrivate) {
        const nextAllow = current ? removeFlag(current.allow, VIEW_CHANNEL_FLAG) : '0';
        const nextDeny = current ? addFlag(current.deny, VIEW_CHANNEL_FLAG) : VIEW_CHANNEL_FLAG.toString();
        await api.channels.setPermissionOverride(selectedChannelId, everyoneRole.id, {
          targetType: 'role',
          allow: nextAllow,
          deny: nextDeny,
        });
      } else if (current) {
        const nextAllow = addFlag(current.allow, VIEW_CHANNEL_FLAG);
        const nextDeny = removeFlag(current.deny, VIEW_CHANNEL_FLAG);
        if (BigInt(nextAllow) === 0n && BigInt(nextDeny) === 0n) {
          await api.channels.deletePermissionOverride(selectedChannelId, everyoneRole.id);
        } else {
          await api.channels.setPermissionOverride(selectedChannelId, everyoneRole.id, {
            targetType: 'role',
            allow: nextAllow,
            deny: nextDeny,
          });
        }
      }
      await refreshPermissions();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function grantAccess(targetType: 'role' | 'user', targetId: string) {
    if (!selectedChannelId || !targetId) return;
    setError('');
    setSavingPermissions(true);
    try {
      await api.channels.setPermissionOverride(selectedChannelId, targetId, {
        targetType,
        allow: VIEW_CHANNEL_FLAG.toString(),
        deny: '0',
      });
      await refreshPermissions();
      setChannelPermissionFeedback(`Granted channel visibility to ${targetType === 'role' ? 'role' : 'member'}.`);
      if (targetType === 'role') setSelectedRoleId('');
      if (targetType === 'user') setSelectedUserId('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function removeOverride(targetId: string) {
    if (!selectedChannelId) return;
    setError('');
    setSavingPermissions(true);
    try {
      await api.channels.deletePermissionOverride(selectedChannelId, targetId);
      await refreshPermissions();
      setChannelPermissionFeedback('Removed visibility override.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleClearChannelOverrides() {
    if (!selectedChannelId || sortedChannelGrantEntries.length === 0) return;
    const count = sortedChannelGrantEntries.length;
    if (!window.confirm(`Remove ${count} visibility override${count === 1 ? '' : 's'} from this channel?`)) return;
    setError('');
    setSavingPermissions(true);
    try {
      const uniqueTargetIds = Array.from(new Set(sortedChannelGrantEntries.map((o) => o.targetId)));
      for (const targetId of uniqueTargetIds) {
        await api.channels.deletePermissionOverride(selectedChannelId, targetId);
      }
      await refreshPermissions();
      setChannelPermissionFeedback(`Removed ${uniqueTargetIds.length} shown override${uniqueTargetIds.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleClearAllChannelOverrides() {
    if (!selectedChannelId || channelGrantEntries.length === 0) return;
    const count = channelGrantEntries.length;
    if (!window.confirm(`Remove all ${count} visibility override${count === 1 ? '' : 's'} from this channel?`)) return;
    setError('');
    setSavingPermissions(true);
    try {
      const uniqueTargetIds = Array.from(new Set(channelGrantEntries.map((o) => o.targetId)));
      for (const targetId of uniqueTargetIds) {
        await api.channels.deletePermissionOverride(selectedChannelId, targetId);
      }
      await refreshPermissions();
      setChannelPermissionFeedback(`Removed all ${uniqueTargetIds.length} visibility override${uniqueTargetIds.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  }

  async function copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setChannelPermissionFeedback(successMessage);
    } catch {
      setChannelPermissionFeedback('Failed to copy ID.');
    }
  }

  function resetView() {
    setChannelSearch('');
    setChannelRoleSearch('');
    setChannelMemberSearch('');
    setChannelOverrideSearch('');
    setSelectedRoleId('');
    setSelectedUserId('');
    setChannelOverrideTypeFilter('all');
    setChannelOverrideVisibilityFilter('all');
    setChannelPermissionFeedback('Channel permission filters reset.');
    localStorage.removeItem(`server_settings_channel_state_v1:${guildId}`);
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>Channel Permissions</h2>
      <p style={styles.muted}>
        Configure private access and visibility overrides for each channel.
      </p>

      {error && <div style={styles.modalError}>{error}</div>}

      <div style={{ ...styles.inlineStats, marginBottom: 8 }}>
        <span style={styles.statPill}>Admin workflow tools</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetView}>
          Reset Filters
        </button>
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.inputLabel}>Channel</label>
        <input
          style={{ ...styles.inputField, marginBottom: 8 }}
          value={channelSearch}
          onChange={(e) => setChannelSearch(e.target.value)}
          placeholder="Filter channels"
        />
        <div style={styles.inputWrapper}>
          <select
            style={styles.inputField}
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
          >
            <option value="">Select a channel</option>
            {filteredConfigurableChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.type === 'GUILD_VOICE' ? '\uD83D\uDD0A' : '#'} {channel.name}
              </option>
            ))}
          </select>
        </div>
        {configurableChannels.length > 0 && filteredConfigurableChannels.length === 0 && (
          <div style={styles.muted}>No channels match the current filter.</div>
        )}
      </div>

      {selectedChannelId && (
        <>
          <label style={styles.privateToggle}>
            <input
              type="checkbox"
              style={styles.privateToggleInput}
              checked={isPrivateChannel}
              onChange={(e) => handlePrivateToggle(e.target.checked)}
              disabled={!everyoneRole || savingPermissions}
            />
            <span>Private channel (deny @everyone view)</span>
          </label>

          <div style={styles.permissionGrid}>
            <div style={styles.permissionCard}>
              <div style={styles.permissionTitle}>Grant Role Access</div>
              <input
                style={{ ...styles.inputField, marginBottom: 8 }}
                value={channelRoleSearch}
                onChange={(e) => setChannelRoleSearch(e.target.value)}
                placeholder="Filter roles"
                disabled={savingPermissions}
              />
              <div style={styles.permissionRow}>
                <select
                  style={styles.inputField}
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  disabled={savingPermissions}
                >
                  <option value="">Select role</option>
                  {filteredGrantableChannelRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  disabled={!selectedRoleId || savingPermissions || selectedRoleOverrideState === 'allow'}
                  onClick={() => grantAccess('role', selectedRoleId)}
                >
                  {selectedRoleOverrideState === 'allow' ? 'Already Granted' : 'Grant'}
                </Button>
              </div>
              {selectedRoleOverrideState === 'deny' && (
                <div style={styles.muted}>This role is currently hidden and will be switched to visible.</div>
              )}
              {selectedRoleOverrideState === 'allow' && selectedRoleId && (
                <div style={styles.muted}>This role already has visible access.</div>
              )}
              {!selectedRoleId && filteredChannelRoleOptions.length > 0 && filteredGrantableChannelRoleOptions.length === 0 && (
                <div style={styles.muted}>All matching roles already have visible access.</div>
              )}
            </div>

            <div style={styles.permissionCard}>
              <div style={styles.permissionTitle}>Grant Member Access</div>
              <input
                style={{ ...styles.inputField, marginBottom: 8 }}
                value={channelMemberSearch}
                onChange={(e) => setChannelMemberSearch(e.target.value)}
                placeholder="Filter members"
                disabled={savingPermissions}
              />
              <div style={styles.permissionRow}>
                <select
                  style={styles.inputField}
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={savingPermissions}
                >
                  <option value="">Select member</option>
                  {filteredGrantableChannelMemberOptions.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {(member as any).user?.displayName ?? member.nickname ?? member.userId}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  disabled={!selectedUserId || savingPermissions || selectedUserOverrideState === 'allow'}
                  onClick={() => grantAccess('user', selectedUserId)}
                >
                  {selectedUserOverrideState === 'allow' ? 'Already Granted' : 'Grant'}
                </Button>
              </div>
              {selectedUserOverrideState === 'deny' && (
                <div style={styles.muted}>This member is currently hidden and will be switched to visible.</div>
              )}
              {selectedUserOverrideState === 'allow' && selectedUserId && (
                <div style={styles.muted}>This member already has visible access.</div>
              )}
              {!selectedUserId && filteredChannelMemberOptions.length > 0 && filteredGrantableChannelMemberOptions.length === 0 && (
                <div style={styles.muted}>All matching members already have visible access.</div>
              )}
            </div>
          </div>

          <div style={styles.permissionList}>
            <div style={styles.inlineStats}>
              <span style={styles.statPill}>{channelOverrideStats.total} overrides</span>
              <span style={styles.statPill}>{channelOverrideStats.allow} visible</span>
              <span style={styles.statPill}>{channelOverrideStats.deny} hidden</span>
              <span style={styles.statPill}>{visibleChannelOverrideCount} shown</span>
              <span style={styles.statPill}>Roles: {channelOverrideGroupedStats.roleAllow}/{channelOverrideGroupedStats.roleDeny}</span>
              <span style={styles.statPill}>Members: {channelOverrideGroupedStats.userAllow}/{channelOverrideGroupedStats.userDeny}</span>
              <span style={styles.statPill}>{grantableRoleCount} grantable roles</span>
              <span style={styles.statPill}>{grantableMemberCount} grantable members</span>
            </div>
            {channelPermissionFeedback && (
              <div style={styles.feedback} role="status" aria-live="polite">
                {channelPermissionFeedback}
              </div>
            )}
            <div style={styles.inlineStats}>
              <button
                type="button"
                style={channelOverrideTypeFilter === 'all' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideTypeFilter('all')}
              >
                All Targets
              </button>
              <button
                type="button"
                style={channelOverrideTypeFilter === 'role' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideTypeFilter('role')}
              >
                Roles
              </button>
              <button
                type="button"
                style={channelOverrideTypeFilter === 'user' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideTypeFilter('user')}
              >
                Members
              </button>
              <button
                type="button"
                style={channelOverrideVisibilityFilter === 'all' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideVisibilityFilter('all')}
              >
                All States
              </button>
              <button
                type="button"
                style={channelOverrideVisibilityFilter === 'allow' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideVisibilityFilter('allow')}
              >
                Visible
              </button>
              <button
                type="button"
                style={channelOverrideVisibilityFilter === 'deny' ? styles.discoverTagActive : styles.discoverTag}
                onClick={() => setChannelOverrideVisibilityFilter('deny')}
              >
                Hidden
              </button>
            </div>
            <input
              style={styles.inputField}
              value={channelOverrideSearch}
              onChange={(e) => setChannelOverrideSearch(e.target.value)}
              placeholder="Filter overrides by role/member"
              disabled={savingPermissions}
            />
            {channelGrantEntries.length > 0 && (
              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.permissionRemove}
                  onClick={handleClearChannelOverrides}
                  disabled={savingPermissions || sortedChannelGrantEntries.length === 0}
                >
                  Clear Shown Overrides
                </button>
                <button
                  type="button"
                  style={styles.permissionRemove}
                  onClick={handleClearAllChannelOverrides}
                  disabled={savingPermissions || channelGrantEntries.length === 0}
                >
                  Clear All Overrides
                </button>
              </div>
            )}
            {channelGrantEntries.length === 0 && (
              <div style={styles.muted}>No visibility overrides set for this channel.</div>
            )}
            {channelGrantEntries.length > 0 && sortedChannelGrantEntries.length === 0 && (
              <div style={styles.muted}>No overrides match the current filter.</div>
            )}
            {sortedChannelGrantEntries.map((override) => {
              const isAllow = hasFlag(override.allow, VIEW_CHANNEL_FLAG);
              const label =
                override.targetType === 'role'
                  ? roles.find((role) => role.id === override.targetId)?.name ?? override.targetId
                  : (members.find((member) => member.userId === override.targetId) as any)?.user?.displayName ??
                    members.find((member) => member.userId === override.targetId)?.nickname ??
                    override.targetId;
              return (
                <div key={override.id} style={styles.permissionItem}>
                  <span style={styles.permissionTarget}>
                    {override.targetType === 'role' ? '@' : ''}{label}
                  </span>
                  <span style={styles.permissionBadge}>
                    {override.targetType === 'role' ? 'Role' : 'Member'}
                  </span>
                  <span style={isAllow ? styles.badgeAllow : styles.badgeDeny}>
                    {isAllow ? 'Can View' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    style={styles.permissionRemoveRight}
                    onClick={() => copyTextToClipboard(String(override.targetId), 'Copied target ID.')}
                    disabled={savingPermissions}
                    title="Copy target ID"
                  >
                    Copy ID
                  </button>
                  <button
                    type="button"
                    style={styles.permissionRemove}
                    onClick={() => removeOverride(override.targetId)}
                    disabled={savingPermissions}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
