import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import type { PresenceStatus } from '@/stores/presence.store';

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
  invisible: 'Offline',
};

const STATUS_COLORS: Record<string, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
  invisible: '#80848e',
};

const styles = {
  panel: {
    width: 340,
    background: 'rgba(11, 17, 28, 0.95)',
    borderLeft: '1px solid var(--stroke, #4a4660)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  header: {
    padding: 16,
    borderBottom: '1px solid var(--stroke, #4a4660)',
    flexShrink: 0,
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text, #e8e4e0)',
  } as React.CSSProperties,
  list: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 'var(--radius-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: 'inherit',
    font: 'inherit',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  rowHover: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: 'inherit',
    font: 'inherit',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  name: {
    fontSize: 14,
    color: 'var(--text, #e8e4e0)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--text-muted, #a8a4b8)',
    margin: 0,
  } as React.CSSProperties,
} as const;

export function GroupMembersPanel({ channelId }: { channelId: string }) {
  const open = useUiStore((s) => s.dmInfoPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const queryClient = useQueryClient();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const memberIds = useMemo(() => {
    const dmChannels = (
      queryClient.getQueryData(['relationships', 'dms']) as
        Array<{ id: string; type: string; recipientIds?: string[] }> | undefined
    ) ?? [];
    const channel = dmChannels.find((ch) => ch.id === channelId);
    return channel?.recipientIds ?? [];
  }, [channelId, queryClient]);

  const { data: members = [] } = useQuery({
    queryKey: ['users', 'summaries', 'group-dm', memberIds],
    queryFn: () => api.users.getSummaries(memberIds),
    enabled: memberIds.length > 0,
  });

  const { data: presences = [] } = useQuery({
    queryKey: ['users', 'presences', 'group-dm', memberIds],
    queryFn: () => api.users.getPresences(memberIds),
    enabled: memberIds.length > 0,
  });

  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceStatus>();
    for (const p of presences) {
      map.set(p.userId, p.status as PresenceStatus);
    }
    return map;
  }, [presences]);

  if (!open) return null;

  return (
    <aside style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>
          Members &mdash; {members.length}
        </span>
      </div>
      <div style={styles.list}>
        {members.map((member) => {
          const status: PresenceStatus = presenceMap.get(member.id) ?? 'offline';
          const dotColor = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
          return (
            <button
              key={member.id}
              type="button"
              style={hoveredId === member.id ? styles.rowHover : styles.row}
              onMouseEnter={() => setHoveredId(member.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => openModal('full-profile' as any, { userId: member.id })}
            >
              <Avatar
                name={member.displayName || member.username}
                hash={member.avatarHash}
                userId={member.id}
                size={32}
              />
              <span style={styles.name}>
                {member.displayName || member.username}
              </span>
              <span
                style={{ ...styles.statusDot, background: dotColor }}
                title={STATUS_LABELS[status] ?? 'Offline'}
              />
            </button>
          );
        })}
        {members.length === 0 && (
          <p style={styles.empty}>No members found</p>
        )}
      </div>
    </aside>
  );
}
