import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import type { PresenceStatus } from '@/stores/presence.store';
import { useMemo } from 'react';

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
  invisible: 'Offline',
};

export function GroupMembersPanel({ channelId }: { channelId: string }) {
  const open = useUiStore((s) => s.dmInfoPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const queryClient = useQueryClient();

  // Get the recipientIds from the DM directory cache
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
    <aside className="group-members-panel">
      <div className="group-members-header">
        <span className="group-members-title">
          Members &mdash; {members.length}
        </span>
      </div>
      <div className="group-members-list">
        {members.map((member) => {
          const status: PresenceStatus = presenceMap.get(member.id) ?? 'offline';
          return (
            <button
              key={member.id}
              type="button"
              className="group-members-row"
              onClick={() => openModal('full-profile' as any, { userId: member.id })}
            >
              <Avatar
                name={member.displayName || member.username}
                hash={member.avatarHash}
                userId={member.id}
                size={32}
              />
              <span className="group-members-name">
                {member.displayName || member.username}
              </span>
              <span
                className={`group-members-status-dot group-members-status-${status}`}
                title={STATUS_LABELS[status] ?? 'Offline'}
              />
            </button>
          );
        })}
        {members.length === 0 && (
          <p className="group-members-empty">No members found</p>
        )}
      </div>
    </aside>
  );
}
