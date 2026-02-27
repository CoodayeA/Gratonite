import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { api } from '@/lib/api';
import type { Channel } from '@gratonite/types';
import { useUnreadStore } from '@/stores/unread.store';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { startNamedInteraction } from '@/lib/perf';
import { useVoiceStore } from '@/stores/voice.store';
import { DmSearchBar } from '@/components/dm/DmSearchBar';
import { DmListItem } from '@/components/dm/DmListItem';
import type { VoiceState } from '@gratonite/types';

// Channel type constants (API returns string enums)
const GUILD_VOICE = 'GUILD_VOICE';
const GUILD_CATEGORY = 'GUILD_CATEGORY';
const GUILD_TEXT = 'GUILD_TEXT';
const GUILD_ANNOUNCEMENT = 'GUILD_ANNOUNCEMENT';
const GUILD_FORUM = 'GUILD_FORUM';
const DM = 'DM';
const GROUP_DM = 'GROUP_DM';

// Stable empty array to avoid creating new references on every selector call
const EMPTY_IDS: string[] = [];

// ─── Inline style objects ───────────────────────────────────────────────────

const styles = {
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--bg-elevated)',
    borderRight: '1px solid var(--stroke)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    borderBottom: '1px solid var(--stroke)',
    flexShrink: 0,
  } as React.CSSProperties,

  guildBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0 16px',
    height: 56,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,

  guildBtnStatic: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0 16px',
    height: 56,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'transparent',
    border: 'none',
    cursor: 'default',
  } as React.CSSProperties,

  guildName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  chevron: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginLeft: 8,
    flexShrink: 0,
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 8,
    right: 8,
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 0',
    zIndex: 50,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  } as React.CSSProperties,

  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.15s ease',
  } as React.CSSProperties,

  dropdownDanger: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--danger)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.15s ease',
  } as React.CSSProperties,

  dropdownDivider: {
    height: 1,
    background: 'var(--stroke)',
    margin: '4px 0',
  } as React.CSSProperties,

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px 8px',
  } as React.CSSProperties,

  headerAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    fontSize: 12,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
  } as React.CSSProperties,

  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 8px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--stroke) transparent',
  } as React.CSSProperties,

  section: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 8px 4px 8px',
  } as React.CSSProperties,

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-faint)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  } as React.CSSProperties,

  sectionAdd: {
    fontSize: 16,
    color: 'var(--text-faint)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  } as React.CSSProperties,

  channelItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    height: 34,
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    gap: 8,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  } as React.CSSProperties,

  channelItemActive: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    height: 34,
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'var(--bg-soft)',
    transition: 'background 0.15s ease, color 0.15s ease',
    gap: 8,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  } as React.CSSProperties,

  channelIcon: {
    fontSize: 14,
    color: 'var(--text-faint)',
    flexShrink: 0,
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  channelIconLock: {
    display: 'block',
  } as React.CSSProperties,

  channelLockBadge: {
    fontSize: 10,
    marginLeft: 2,
  } as React.CSSProperties,

  channelName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  dragHandle: {
    cursor: 'grab',
    color: 'var(--text-faint)',
    fontSize: 10,
    marginRight: 2,
    userSelect: 'none',
    flexShrink: 0,
    opacity: 0.4,
  } as React.CSSProperties,

  unreadBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-on-gold)',
    background: 'var(--accent)',
    borderRadius: 10,
    padding: '0 6px',
    minWidth: 20,
    height: 20,
    textAlign: 'center',
    lineHeight: '20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  category: {
    marginTop: 4,
  } as React.CSSProperties,

  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 8px 4px 8px',
  } as React.CSSProperties,

  categoryName: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-faint)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  categoryAdd: {
    fontSize: 16,
    color: 'var(--text-faint)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    transition: 'color 0.15s ease',
  } as React.CSSProperties,

  voicePresence: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingLeft: 24,
    paddingTop: 2,
    paddingBottom: 2,
    width: '100%',
  } as React.CSSProperties,

  voicePresenceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#a8a4b8',
  } as React.CSSProperties,

  voicePresenceDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#43b581',
    flexShrink: 0,
  } as React.CSSProperties,

  voicePresenceName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  voicePresenceMore: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#6e6a80',
    fontStyle: 'italic',
  } as React.CSSProperties,

  // DM panel styles
  dmPanel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  } as React.CSSProperties,

  dmPanelHeader: {
    padding: '20px 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flexShrink: 0,
  } as React.CSSProperties,

  dmPanelTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  dmPanelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  dmPanelAddBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
    padding: 0,
  } as React.CSSProperties,

  dmSearchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    height: 38,
    gap: 8,
    padding: '0 12px',
  } as React.CSSProperties,

  dmSearchIcon: {
    flexShrink: 0,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  dmList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--stroke) transparent',
  } as React.CSSProperties,

  dmEmpty: {
    padding: '24px 20px',
    textAlign: 'center',
    color: 'var(--text-faint)',
    fontSize: 13,
  } as React.CSSProperties,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseOrderId(value: string | null | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function ChannelIcon({ type, isPrivate }: { type: string | number; isPrivate?: boolean }) {
  if (type === GUILD_VOICE) {
    return (
      <span style={styles.channelIcon}>
        🔊
        {isPrivate && <span style={styles.channelLockBadge} aria-label="Private" title="Private channel">🔒</span>}
      </span>
    );
  }
  if (type === DM || type === GROUP_DM) return <span style={styles.channelIcon}>@</span>;
  return (
    <span style={styles.channelIcon}>
      {isPrivate ? (
        <svg style={styles.channelIconLock} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Private channel" role="img">
          <path d="M17 11V7a5 5 0 0 0-10 0v4H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2Zm-8-4a3 3 0 1 1 6 0v4H9V7Z"/>
        </svg>
      ) : '#'}
    </span>
  );
}

export function ChannelSidebar() {
  const navigate = useNavigate();
  const { guildId } = useParams<{ guildId: string }>();
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const user = useAuthStore((s) => s.user);
  const channels = useChannelsStore((s) => s.channels);
  const addChannel = useChannelsStore((s) => s.addChannel);
  const updateChannel = useChannelsStore((s) => s.updateChannel);
  const channelIds = useChannelsStore((s) =>
    guildId ? s.channelsByGuild.get(guildId) ?? EMPTY_IDS : EMPTY_IDS,
  );
  const openModal = useUiStore((s) => s.openModal);
  const unreadByChannel = useUnreadStore((s) => s.unreadByChannel);
  const unreadCountByChannel = useUnreadStore((s) => s.unreadCountByChannel);
  const beginChannelSwitch = (channelId: string) => {
    startNamedInteraction('channel_switch', 'channel_switch', { channelId });
  };

  const renderUnreadBadge = (channelId: string) => {
    if (!unreadByChannel.has(channelId)) return null;
    const count = unreadCountByChannel.get(channelId) ?? 1;
    return <span style={styles.unreadBadge}>{count > 99 ? '99+' : count}</span>;
  };

  const isOwner = guild?.ownerId === user?.id;

  const dmChannels = useMemo(() => {
    return Array.from(channels.values())
      .filter((ch) => ch.type === DM || ch.type === GROUP_DM)
      .sort((a, b) => {
        const aOrder = parseOrderId(a.lastMessageId);
        const bOrder = parseOrderId(b.lastMessageId);
        if (aOrder !== bOrder) return bOrder > aOrder ? 1 : -1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });
  }, [channels]);
  const voiceStatesByChannel = useVoiceStore((s) => s.statesByChannel);

  const { data: dmDirectory = [] } = useQuery({
    queryKey: ['relationships', 'dms'],
    queryFn: () =>
      api.relationships.getDmChannels() as Promise<
        Array<{ id: string; type: 'dm' | 'group_dm'; name: string | null; lastMessageId: string | null; otherUserId?: string | null; recipientIds?: string[]; lastMessageContent?: string | null; lastMessageAt?: string | null }>
      >,
    enabled: !!user,
  });

  const dmUserIds = useMemo(
    () =>
      Array.from(
        new Set(dmDirectory.map((dm) => dm.otherUserId).filter((id): id is string => Boolean(id))),
      ),
    [dmDirectory],
  );

  const { data: dmUsers = [] } = useQuery({
    queryKey: ['users', 'summaries', dmUserIds],
    queryFn: () => api.users.getSummaries(dmUserIds),
    enabled: dmUserIds.length > 0,
  });

  const dmUserNameById = useMemo(() => {
    const map = new Map<string, string>();
    dmUsers.forEach((u) => map.set(u.id, u.displayName || u.username || 'Direct Message'));
    return map;
  }, [dmUsers]);

  const guildVoiceUserIds = useMemo(() => {
    if (!guildId) return [] as string[];
    const ids = new Set<string>();
    for (const [channelId, states] of voiceStatesByChannel.entries()) {
      const channel = channels.get(channelId);
      if (!channel || channel.guildId !== guildId || channel.type !== GUILD_VOICE) continue;
      states.forEach((state) => ids.add(String(state.userId)));
    }
    return Array.from(ids);
  }, [channels, guildId, voiceStatesByChannel]);

  const { data: voiceUsers = [] } = useQuery({
    queryKey: ['users', 'summaries', 'voice-sidebar', guildVoiceUserIds],
    queryFn: () => api.users.getSummaries(guildVoiceUserIds),
    enabled: guildVoiceUserIds.length > 0,
  });

  const voiceUserNameById = useMemo(() => {
    const map = new Map<string, string>();
    voiceUsers.forEach((u) => map.set(u.id, u.displayName || u.username || 'User'));
    return map;
  }, [voiceUsers]);

  const dmDirectoryById = useMemo(() => {
    const map = new Map<string, { name: string | null; otherUserId?: string | null; lastMessageContent?: string | null; lastMessageAt?: string | null }>();
    dmDirectory.forEach((dm) => map.set(dm.id, { name: dm.name, otherUserId: dm.otherUserId ?? null, lastMessageContent: dm.lastMessageContent ?? null, lastMessageAt: dm.lastMessageAt ?? null }));
    return map;
  }, [dmDirectory]);

  useEffect(() => {
    dmDirectory.forEach((dm) => {
      const existing = channels.get(dm.id);
      const resolvedName =
        dm.name ?? (dm.otherUserId ? dmUserNameById.get(dm.otherUserId) : null) ?? existing?.name ?? 'Direct Message';

      if (!existing) {
        addChannel({
          id: dm.id,
          guildId: null,
          type: dm.type === 'group_dm' ? 'GROUP_DM' : 'DM',
          name: resolvedName,
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          lastMessageId: dm.lastMessageId ?? null,
          rateLimitPerUser: 0,
          defaultAutoArchiveDuration: null,
          defaultThreadRateLimitPerUser: null,
          defaultSortOrder: null,
          defaultForumLayout: null,
          availableTags: null,
          defaultReactionEmoji: null,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if ((existing.name ?? '') !== resolvedName) {
        updateChannel(dm.id, { name: resolvedName });
      }
    });
  }, [addChannel, channels, dmDirectory, dmUserNameById, updateChannel]);

  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [channelOrders, setChannelOrders] = useState<Record<string, string[]>>({});
  const [channelMenu, setChannelMenu] = useState<{
    x: number;
    y: number;
    channelId: string;
    parentId: string | null;
    section: 'text' | 'voice';
    type: string;
  } | null>(null);

  // Guild header dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close dropdown when navigating away from guild
  useEffect(() => {
    setDropdownOpen(false);
    setChannelMenu(null);
  }, [guildId]);

  const channelMenuItems = useMemo(() => {
    if (!channelMenu || !guildId) return [];

    const items: Array<{ label: string; onClick: () => void; danger?: boolean }> = [
      {
        label: channelMenu.section === 'voice' ? 'Create Voice Channel' : 'Create Text Channel',
        onClick: () => {
          openModal('create-channel', {
            guildId,
            parentId: channelMenu.parentId ?? undefined,
            type: channelMenu.section === 'voice' ? GUILD_VOICE : GUILD_TEXT,
          });
          setChannelMenu(null);
        },
      },
    ];

    if (isOwner && channelMenu.type !== GUILD_CATEGORY) {
      items.push({
        label: 'Delete Channel',
        danger: true,
        onClick: () => {
          openModal('delete-channel', { guildId, channelId: channelMenu.channelId });
          setChannelMenu(null);
        },
      });
    }

    return items;
  }, [channelMenu, guildId, isOwner, openModal]);

  // Fetch channels for this guild
  useGuildChannels(guildId);

  // Group channels by category
  const allChannels = channelIds
    .map((id) => channels.get(id))
    .filter((ch): ch is Channel => ch !== undefined)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const guildTextChannelIds = useMemo(() => {
    if (!guildId) return EMPTY_IDS;
    return channelIds.filter((id) => {
      const ch = channels.get(id);
      if (!ch) return false;
      return [GUILD_TEXT, GUILD_ANNOUNCEMENT, GUILD_FORUM].includes(ch.type);
    });
  }, [channelIds, channels, guildId]);

  const guildVoiceChannelIds = useMemo(() => {
    if (!guildId) return EMPTY_IDS;
    return channelIds.filter((id) => {
      const ch = channels.get(id);
      if (!ch) return false;
      return ch.type === GUILD_VOICE;
    });
  }, [channelIds, channels, guildId]);

  useEffect(() => {
    if (!guildId) return;
    try {
      const stored = window.localStorage.getItem(`gratonite:channel-sections:${guildId}`);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { textOpen?: boolean; voiceOpen?: boolean };
      if (typeof parsed.textOpen === 'boolean') setTextOpen(parsed.textOpen);
      if (typeof parsed.voiceOpen === 'boolean') setVoiceOpen(parsed.voiceOpen);
    } catch {
      // ignore
    }
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    try {
      window.localStorage.setItem(
        `gratonite:channel-sections:${guildId}`,
        JSON.stringify({ textOpen, voiceOpen }),
      );
    } catch {
      // ignore
    }
  }, [guildId, textOpen, voiceOpen]);

  function getOrderKey(section: 'text' | 'voice', categoryId: string | null) {
    return `gratonite:channel-order:${guildId ?? 'global'}:${section}:${categoryId ?? 'uncategorized'}`;
  }

  function getStoredOrder(key: string): string[] | undefined {
    if (channelOrders[key]) return channelOrders[key];
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return undefined;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as string[];
      return undefined;
    } catch {
      return undefined;
    }
  }

  function setStoredOrder(key: string, order: string[]) {
    setChannelOrders((prev) => ({ ...prev, [key]: order }));
    try {
      window.localStorage.setItem(key, JSON.stringify(order));
    } catch {
      // ignore
    }
  }

  function sortWithOrder(list: Channel[], order?: string[]) {
    if (!order || order.length === 0) return list;
    const index = new Map(order.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ai = index.get(a.id);
      const bi = index.get(b.id);
      if (ai === undefined && bi === undefined) return (a.position ?? 0) - (b.position ?? 0);
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }

  function handleDrop(
    event: React.DragEvent<HTMLAnchorElement>,
    section: 'text' | 'voice',
    categoryId: string | null,
    targetId: string,
    listIds: string[],
  ) {
    event.preventDefault();
    const data = event.dataTransfer.getData('application/gratonite-channel');
    if (!data) return;
    try {
      const payload = JSON.parse(data) as { id: string; section: 'text' | 'voice'; categoryId: string | null };
      if (payload.section !== section) return;
      if ((payload.categoryId ?? null) !== (categoryId ?? null)) return;
      if (payload.id === targetId) return;

      const order = listIds.filter((id) => id !== payload.id);
      const targetIndex = order.indexOf(targetId);
      const insertIndex = targetIndex < 0 ? order.length : targetIndex;
      order.splice(insertIndex, 0, payload.id);

      const key = getOrderKey(section, categoryId);
      setStoredOrder(key, order);
    } catch {
      // ignore
    }
  }

  function renderVoicePresence(channelId: string) {
    const states = (voiceStatesByChannel.get(channelId) ?? []) as VoiceState[];
    if (states.length === 0) return null;
    return (
      <div style={styles.voicePresence} aria-label={`${states.length} people in voice`}>
        {states.slice(0, 6).map((state) => {
          const userId = String(state.userId);
          const label =
            voiceUserNameById.get(userId) ??
            (userId === user?.id ? 'You' : `User ${userId.slice(-4)}`);
          return (
            <div key={userId} style={styles.voicePresenceItem}>
              <span style={styles.voicePresenceDot} aria-hidden="true" />
              <span style={styles.voicePresenceName}>{label}</span>
            </div>
          );
        })}
        {states.length > 6 && (
          <div style={styles.voicePresenceMore}>
            +{states.length - 6} more
          </div>
        )}
      </div>
    );
  }

  function renderGuildChannels(ids: string[], section: 'text' | 'voice') {
    const scopedChannels = ids
      .map((id) => channels.get(id))
      .filter((ch): ch is Channel => ch !== undefined)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const categories = scopedChannels.filter((ch) => ch.type === GUILD_CATEGORY);
    const uncategorized = scopedChannels.filter(
      (ch) => ch.type !== GUILD_CATEGORY && !ch.parentId,
    );

    const uncategorizedOrder = getStoredOrder(getOrderKey(section, null));
    const sortedUncategorized = sortWithOrder(uncategorized, uncategorizedOrder);

    return (
      <>
        {sortedUncategorized.map((ch) => (
          <NavLink
            key={ch.id}
            to={`/guild/${guildId}/channel/${ch.id}`}
            style={({ isActive }) => isActive ? styles.channelItemActive : styles.channelItem}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                'application/gratonite-channel',
                JSON.stringify({ id: ch.id, section, categoryId: null }),
              );
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) =>
              handleDrop(event, section, null, ch.id, sortedUncategorized.map((c) => c.id))
            }
            onContextMenu={(event) => {
              event.preventDefault();
              setChannelMenu({
                x: event.clientX,
                y: event.clientY,
                channelId: ch.id,
                parentId: null,
                section,
                type: ch.type,
              });
            }}
            onClick={() => beginChannelSwitch(ch.id)}
            onMouseEnter={(e) => {
              const link = e.currentTarget;
              if (!link.getAttribute('data-active')) {
                link.style.background = 'var(--bg-soft)';
              }
            }}
            onMouseLeave={(e) => {
              const link = e.currentTarget;
              if (!link.getAttribute('data-active')) {
                link.style.background = '';
              }
            }}
          >
            <span style={styles.dragHandle} aria-hidden="true">⋮⋮</span>
            <ChannelIcon type={ch.type} isPrivate={ch.isPrivate} />
            <span style={styles.channelName}>{ch.name}</span>
            {renderUnreadBadge(ch.id)}
            {section === 'voice' && renderVoicePresence(ch.id)}
          </NavLink>
        ))}

        {categories.map((cat) => {
          const children = scopedChannels.filter((ch) => ch.parentId === cat.id);
          const categoryOrder = getStoredOrder(getOrderKey(section, cat.id));
          const sortedChildren = sortWithOrder(children, categoryOrder);
          return (
            <div key={cat.id} style={styles.category}>
              <div style={styles.categoryHeader}>
                <span style={styles.categoryName}>{cat.name}</span>
                {guildId && (
                  <button
                    style={styles.categoryAdd}
                    onClick={() => openModal('create-channel', { guildId, parentId: cat.id })}
                    title={`Add channel to ${cat.name}`}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                  >
                    +
                  </button>
                )}
              </div>
              {sortedChildren.map((ch) => (
                <NavLink
                  key={ch.id}
                  to={`/guild/${guildId}/channel/${ch.id}`}
                  style={({ isActive }) => isActive ? styles.channelItemActive : styles.channelItem}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      'application/gratonite-channel',
                      JSON.stringify({ id: ch.id, section, categoryId: cat.id }),
                    );
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) =>
                    handleDrop(event, section, cat.id, ch.id, sortedChildren.map((c) => c.id))
                  }
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setChannelMenu({
                      x: event.clientX,
                      y: event.clientY,
                      channelId: ch.id,
                      parentId: cat.id,
                      section,
                      type: ch.type,
                    });
                  }}
                  onClick={() => beginChannelSwitch(ch.id)}
                  onMouseEnter={(e) => {
                    const link = e.currentTarget;
                    if (!link.getAttribute('data-active')) {
                      link.style.background = 'var(--bg-soft)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const link = e.currentTarget;
                    if (!link.getAttribute('data-active')) {
                      link.style.background = '';
                    }
                  }}
                >
                  <span style={styles.dragHandle} aria-hidden="true">⋮⋮</span>
                  <ChannelIcon type={ch.type} isPrivate={ch.isPrivate} />
                  <span style={styles.channelName}>{ch.name}</span>
                  {renderUnreadBadge(ch.id)}
                  {section === 'voice' && renderVoicePresence(ch.id)}
                </NavLink>
              ))}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header} ref={dropdownRef}>
        {guildId ? (
          <button
            style={styles.guildBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <h2 style={styles.guildName}>{guild?.name ?? 'Gratonite'}</h2>
            <span style={styles.chevron}>{dropdownOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
        ) : (
          <div style={styles.guildBtnStatic}>
            <h2 style={styles.guildName}>Direct Messages</h2>
          </div>
        )}

        {dropdownOpen && guildId && (
          <div style={styles.dropdown}>
            <button
              style={styles.dropdownItem}
              onClick={() => { openModal('invite'); setDropdownOpen(false); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Invite People
            </button>
            <button
              style={styles.dropdownItem}
              onClick={() => { openModal('settings', { type: 'server', guildId }); setDropdownOpen(false); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Portal Settings
            </button>
            <button
              style={styles.dropdownItem}
              onClick={() => { openModal('settings', { type: 'server', guildId, initialSection: 'overview' }); setDropdownOpen(false); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Portal Profile
            </button>
            <div style={styles.dropdownDivider} />
            <button
              style={styles.dropdownDanger}
              onClick={() => { openModal('leave-guild'); setDropdownOpen(false); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Leave Portal
            </button>
            {isOwner && (
              <button
                style={styles.dropdownDanger}
                onClick={() => { openModal('delete-guild'); setDropdownOpen(false); }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#413d58'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Delete Portal
              </button>
            )}
          </div>
        )}

        <div style={styles.headerActions} aria-label="Quick actions">
          {guildId ? (
            <>
              <button
                type="button"
                style={styles.headerAction}
                onClick={() => openModal('settings', { type: 'server', guildId })}
                title="Portal settings"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span>Settings</span>
              </button>
              <button
                type="button"
                style={styles.headerAction}
                onClick={() => openModal('invite')}
                title="Invite people"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <path d="M20 8v6" />
                  <path d="M23 11h-6" />
                </svg>
                <span>Invite</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              style={styles.headerAction}
              onClick={() => navigate('/settings')}
              title="Open settings"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#413d58'; e.currentTarget.style.color = '#e8e4e0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a8a4b8'; }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>

      <div style={styles.list}>
        {!guildId && (
          <div style={styles.dmPanel}>
            {/* Header section: Messages title + search + add friend */}
            <div style={styles.dmPanelHeader}>
              <div style={styles.dmPanelTitleRow}>
                <h2 style={styles.dmPanelTitle}>
                  Messages
                </h2>
                <button
                  type="button"
                  onClick={() => openModal('add-friend')}
                  title="Add a friend"
                  aria-label="Add a friend"
                  style={styles.dmPanelAddBtn}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <path d="M20 8v6" />
                    <path d="M23 11h-6" />
                  </svg>
                </button>
              </div>

              {/* Search bar with icon */}
              <div style={styles.dmSearchWrapper as React.CSSProperties}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={styles.dmSearchIcon as React.CSSProperties}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <DmSearchBar />
              </div>
            </div>

            {/* Conversation list (scrollable) */}
            <div style={styles.dmList as React.CSSProperties}>
              {dmChannels.length === 0 && (
                <div style={styles.dmEmpty as React.CSSProperties}>
                  No direct messages yet.
                </div>
              )}
              {dmChannels.map((ch) => {
                const meta = dmDirectoryById.get(ch.id);
                const name = ch.name ?? meta?.name ?? (meta?.otherUserId ? dmUserNameById.get(meta.otherUserId) : null) ?? 'Direct Message';
                const recipientId = meta?.otherUserId ?? '';
                const recipientAvatar = meta?.otherUserId ? dmUsers.find(u => u.id === meta.otherUserId)?.avatarHash ?? null : null;
                return (
                  <DmListItem
                    key={ch.id}
                    channelId={ch.id}
                    recipientName={name}
                    recipientAvatar={recipientAvatar}
                    recipientId={recipientId}
                    lastMessage={meta?.lastMessageContent}
                    lastMessageAt={meta?.lastMessageAt}
                    unreadCount={unreadCountByChannel.get(ch.id)}
                    channelType={ch.type}
                  />
                );
              })}
            </div>
          </div>
        )}

        {guildId && (
          <>
            <div style={styles.section}>
              <button
                style={styles.sectionTitle}
                onClick={() => setTextOpen((prev) => !prev)}
                type="button"
              >
                <span>{textOpen ? '▾' : '▸'}</span>
                <span>Text Channels</span>
              </button>
              <button
                style={styles.sectionAdd}
                onClick={() => openModal('create-channel', { guildId, type: GUILD_TEXT })}
                title="Create channel"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                +
              </button>
            </div>
            {textOpen && renderGuildChannels(guildTextChannelIds, 'text')}

            <div style={styles.section}>
              <button
                style={styles.sectionTitle}
                onClick={() => setVoiceOpen((prev) => !prev)}
                type="button"
              >
                <span>{voiceOpen ? '▾' : '▸'}</span>
                <span>Voice Channels</span>
              </button>
              <button
                style={styles.sectionAdd}
                onClick={() => openModal('create-channel', { guildId, type: GUILD_VOICE })}
                title="Create channel"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                +
              </button>
            </div>
            {voiceOpen && renderGuildChannels(guildVoiceChannelIds, 'voice')}
          </>
        )}
      </div>

      {channelMenu && channelMenuItems.length > 0 && (
        <ContextMenu
          x={channelMenu.x}
          y={channelMenu.y}
          items={channelMenuItems}
          onClose={() => setChannelMenu(null)}
        />
      )}
    </aside>
  );
}
