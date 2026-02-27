import { useEffect, useMemo, useState, useRef, type KeyboardEvent, type ChangeEvent, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Message } from '@gratonite/types';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarSprite } from '@/components/ui/AvatarSprite';
import { formatTimestamp, formatShortTimestamp } from '@/lib/utils';
import { useMessagesStore } from '@/stores/messages.store';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMembersStore } from '@/stores/members.store';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { MessageActionBar } from './MessageActionBar';
import { ReactionBar } from './ReactionBar';
import { AttachmentDisplay } from './AttachmentDisplay';
import { MarkdownText } from './MarkdownText';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { ProfilePopover } from '@/components/ui/ProfilePopover';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { ServerTagBadge } from '@/components/ui/ServerTagBadge';
import { resolveProfile } from '@gratonite/profile-resolver';
import { getAvatarDecorationById } from '@/lib/profileCosmetics';
import {
  DEFAULT_AVATAR_STUDIO_PREFS,
  readAvatarStudioPrefs,
  subscribeAvatarStudioChanges,
} from '@/lib/avatarStudio';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  onReply: (message: Message) => void;
  onOpenEmojiPicker: (messageId: string, coords?: { x: number; y: number }) => void;
}

const styles = {
  item: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '40px 1fr',
    gap: 12,
    padding: '3px 14px',
    margin: '0 8px',
    borderRadius: 'var(--radius-lg)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent',
    transition: 'background 0.14s ease, border-color 0.14s ease, transform 0.14s ease',
  } as React.CSSProperties,
  itemHover: {
    background: 'linear-gradient(90deg, rgba(121, 223, 255, 0.04), rgba(138, 123, 255, 0.03))',
    borderColor: 'rgba(163, 191, 239, 0.08)',
    transform: 'translateY(-1px)',
  } as React.CSSProperties,
  itemNotGrouped: {
    paddingTop: 8,
    marginTop: 5,
  } as React.CSSProperties,
  itemGrouped: {
    gridTemplateColumns: '40px 1fr',
    paddingTop: 1,
    paddingBottom: 1,
  } as React.CSSProperties,
  itemEditing: {
    background: 'rgba(212, 175, 55, 0.04)',
  } as React.CSSProperties,
  timestampInline: {
    gridColumn: 1,
    textAlign: 'right',
    fontSize: 10,
    color: 'var(--text-faint)',
    opacity: 0,
    transition: 'opacity 0.1s ease',
    paddingTop: 3,
  } as React.CSSProperties,
  timestampInlineVisible: {
    opacity: 1,
  } as React.CSSProperties,
  avatarSpriteButton: {
    marginTop: 2,
    border: 0,
    padding: 0,
    background: 'transparent',
    cursor: 'pointer',
  } as React.CSSProperties,
  body: {
    minWidth: 0,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  author: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text)',
    cursor: 'pointer',
  } as React.CSSProperties,
  timestamp: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  edited: {
    fontSize: 10,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  content: {
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.5,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  } as React.CSSProperties,
  replyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--text-faint)',
    marginBottom: 2,
    padding: '2px 0',
  } as React.CSSProperties,
  replyHeaderSvg: {
    flexShrink: 0,
    opacity: 0.6,
  } as React.CSSProperties,
  replyAuthor: {
    fontWeight: 600,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  replySnippet: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  editWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as React.CSSProperties,
  editInput: {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    resize: 'none',
    minHeight: 36,
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
  editActions: {
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  editHint: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
};

export function MessageItem({ message, isGrouped, onReply, onOpenEmojiPicker }: MessageItemProps) {
  const author = (message as Message & { author?: { displayName: string; avatarHash: string | null; username?: string; primaryColor?: number | null; accentColor?: number | null } }).author;
  const channel = useChannelsStore((s) => s.channels.get(message.channelId));
  const guildId = channel?.guildId ?? null;
  const { data: emojis = [] } = useQuery({
    queryKey: ['guild-emojis', guildId],
    queryFn: () => (guildId ? api.guilds.getEmojis(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
    staleTime: 300_000,
  });
  const isGuildChannel = Boolean(channel?.guildId);
  const member = useMembersStore((s) =>
    guildId ? s.membersByGuild.get(guildId)?.get(message.authorId) : undefined,
  );
  const resolved = resolveProfile(
    {
      displayName: author?.displayName,
      username: author?.username,
      avatarHash: author?.avatarHash ?? null,
      primaryColor: author?.primaryColor ?? null,
      accentColor: author?.accentColor ?? null,
    },
    {
      nickname: member?.profile?.nickname ?? member?.nickname,
      avatarHash: member?.profile?.avatarHash ?? null,
      bannerHash: member?.profile?.bannerHash ?? null,
      bio: member?.profile?.bio ?? null,
    },
  );
  const displayName = resolved.displayName;
  const avatarHash = resolved.avatarHash;
  const primaryColor = resolved.primaryColor;
  const accentColor = resolved.accentColor;
  const userId = useAuthStore((s) => s.user?.id);
  const currentUserDecorationId = useAuthStore((s) => s.user?.avatarDecorationId);
  const isOwn = message.authorId === userId;
  const ownDecorationHash =
    isOwn && currentUserDecorationId
      ? getAvatarDecorationById(currentUserDecorationId)?.assetHash ?? null
      : null;
  const [ownAvatarStudioPrefs, setOwnAvatarStudioPrefs] = useState(DEFAULT_AVATAR_STUDIO_PREFS);
  const useSpriteAvatar = isOwn && ownAvatarStudioPrefs.enabled;

  useEffect(() => {
    if (!userId) {
      setOwnAvatarStudioPrefs(DEFAULT_AVATAR_STUDIO_PREFS);
      return;
    }
    setOwnAvatarStudioPrefs(readAvatarStudioPrefs(userId));
    return subscribeAvatarStudioChanges((changedUserId) => {
      if (changedUserId !== userId) return;
      setOwnAvatarStudioPrefs(readAvatarStudioPrefs(userId));
    });
  }, [userId]);

  const editingMessageId = useMessagesStore((s) => s.editingMessageId);
  const setEditingMessage = useMessagesStore((s) => s.setEditingMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const addReaction = useMessagesStore((s) => s.addReaction);
  const removeReaction = useMessagesStore((s) => s.removeReaction);
  const openModal = useUiStore((s) => s.openModal);

  const isEditing = editingMessageId === message.id;
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [hovering, setHovering] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [profilePopover, setProfilePopover] = useState<{ x: number; y: number } | null>(null);

  const reactions = (message as any).reactions ?? [];
  const attachments = (message as any).attachments ?? [];
  const referencedMessage = (message as any).referencedMessage as (Message & { author?: { displayName: string; avatarHash?: string | null; username?: string } }) | undefined;
  const referencedAuthor = referencedMessage?.author;
  const referencedMember = useMembersStore((s) =>
    guildId && referencedMessage ? s.membersByGuild.get(guildId)?.get(referencedMessage.authorId) : undefined,
  );
  const referencedResolved = referencedMessage
    ? resolveProfile(
      {
        displayName: referencedAuthor?.displayName,
        username: referencedAuthor?.username,
        avatarHash: referencedAuthor?.avatarHash ?? null,
      },
      {
        nickname: referencedMember?.profile?.nickname ?? referencedMember?.nickname,
        avatarHash: referencedMember?.profile?.avatarHash ?? null,
      },
    )
    : null;
  const mentionIds = useMemo(() => {
    const content = message.content ?? '';
    const ids = new Set<string>();
    for (const match of content.matchAll(/<@!?(\d+)>/g)) {
      const id = match[1];
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [message.content]);
  const { data: mentionSummaries = [] } = useQuery({
    queryKey: ['users', 'summaries', 'mentions', mentionIds],
    queryFn: () => api.users.getSummaries(mentionIds),
    enabled: mentionIds.length > 0,
    staleTime: 60_000,
  });
  const mentionLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (guildId) {
      const guildMembers = useMembersStore.getState().membersByGuild.get(guildId);
      for (const id of mentionIds) {
        const m = guildMembers?.get(id);
        const nickname = m?.profile?.nickname ?? m?.nickname;
        const display = m?.user?.displayName;
        const username = m?.user?.username;
        if (nickname || display || username) {
          labels[id] = String(nickname ?? display ?? username);
        }
      }
    }
    for (const summary of mentionSummaries) {
      if (!labels[summary.id]) labels[summary.id] = summary.displayName ?? summary.username;
    }
    return labels;
  }, [guildId, mentionIds, mentionSummaries]);
  const roleMentionIds = useMemo(() => {
    const content = message.content ?? '';
    const ids = new Set<string>();
    for (const match of content.matchAll(/<@&(\d+)>/g)) {
      const id = match[1];
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [message.content]);
  const { data: guildRoles = [] } = useQuery({
    queryKey: ['guilds', guildId, 'roles'],
    queryFn: () => (guildId ? api.guilds.getRoles(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId) && roleMentionIds.length > 0,
    staleTime: 60_000,
  });
  const roleMentionLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const role of guildRoles as Array<{ id: string; name: string }>) {
      if (roleMentionIds.includes(String(role.id))) {
        labels[String(role.id)] = role.name;
      }
    }
    return labels;
  }, [guildRoles, roleMentionIds]);

  function handleEdit() {
    setEditContent(message.content ?? '');
    setEditingMessage(message.id);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  async function handleEditSave() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setEditingMessage(null);
      return;
    }
    try {
      await api.messages.edit(message.channelId, message.id, { content: trimmed });
      setEditingMessage(null);
    } catch (err) {
      console.error('[MessageItem] Edit failed:', err);
    }
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setEditingMessage(null);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
  }

  function handleDelete() {
    openModal('delete-message', { message, channelId: message.channelId });
  }

  function handlePin() {
    if (message.pinned) {
      api.messages.unpin(message.channelId, message.id)
        .then(() => {
          updateMessage(message.channelId, message.id, { pinned: false });
          queryClient.invalidateQueries({ queryKey: ['pins', message.channelId] });
        })
        .catch((err) => {
          console.error('[MessageItem] Unpin failed:', err);
        });
      return;
    }

    api.messages.pin(message.channelId, message.id)
      .then(() => {
        updateMessage(message.channelId, message.id, { pinned: true });
        queryClient.invalidateQueries({ queryKey: ['pins', message.channelId] });
      })
      .catch((err) => {
        console.error('[MessageItem] Pin failed:', err);
      });
  }

  function handleReactionToggle(emoji: string) {
    const selfId = userId ?? null;
    const r = reactions.find((r: any) => r.emoji === emoji);
    const iReacted = selfId ? r?.userIds?.includes(selfId) : false;
    if (iReacted) {
      if (selfId) removeReaction(message.channelId, message.id, emoji, selfId);
      api.messages.removeReaction(message.channelId, message.id, emoji).catch((err) => {
        console.error('[MessageItem] Remove reaction failed:', err);
        if (selfId) addReaction(message.channelId, message.id, emoji, selfId);
      });
    } else {
      if (selfId) addReaction(message.channelId, message.id, emoji, selfId);
      api.messages.addReaction(message.channelId, message.id, emoji).catch((err) => {
        console.error('[MessageItem] Add reaction failed:', err);
        if (selfId) removeReaction(message.channelId, message.id, emoji, selfId);
      });
    }
  }

  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isGrouped ? styles.itemGrouped : styles.itemNotGrouped),
    ...(isEditing ? styles.itemEditing : {}),
    ...(hovering ? styles.itemHover : {}),
  };

  const contextItems = [
    { label: 'Reply', onClick: () => onReply(message) },
    { label: 'Add Reaction', onClick: () => onOpenEmojiPicker(message.id, menu ? { x: menu.x, y: menu.y } : undefined) },
    ...(isOwn ? [{ label: 'Edit', onClick: handleEdit }] : []),
    { label: 'Pin', onClick: handlePin },
    ...(isGuildChannel ? [{ label: 'Create Thread', onClick: () => openModal('create-thread', { channelId: message.channelId, messageId: message.id }) }] : []),
    ...(isOwn ? [{ label: 'Delete', onClick: handleDelete, danger: true }] : []),
  ];

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (isEditing) return;
    setMenu({ x: e.clientX, y: e.clientY });
  }

  function handleOpenProfile(e: MouseEvent) {
    e.preventDefault();
    setProfilePopover({ x: e.clientX, y: e.clientY });
  }

  const timestampInlineStyle: React.CSSProperties = {
    ...styles.timestampInline,
    ...(hovering ? styles.timestampInlineVisible : {}),
  };

  if (isGrouped) {
    return (
      <div
        style={itemStyle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onContextMenu={handleContextMenu}
      >
        <span style={timestampInlineStyle}>{formatShortTimestamp(message.createdAt)}</span>
        <div>
          {isEditing ? (
            <div style={styles.editWrapper}>
              <textarea
                ref={editRef}
                style={styles.editInput}
                value={editContent}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={1}
              />
              <div style={styles.editActions}>
                <span style={styles.editHint}>Escape to cancel, Enter to save</span>
              </div>
            </div>
          ) : (
            <div style={styles.content}>
              <MarkdownText content={message.content ?? ''} mentionLabels={mentionLabels} roleMentionLabels={roleMentionLabels} emojis={emojis} />
            </div>
          )}
          {attachments.length > 0 && <AttachmentDisplay attachments={attachments} />}
          <ReactionBar
            reactions={reactions}
            onToggle={handleReactionToggle}
            onAddReaction={(event) => onOpenEmojiPicker(message.id, { x: event.clientX, y: event.clientY })}
          />
        </div>
        {hovering && !isEditing && (
            <MessageActionBar
              onReply={() => onReply(message)}
              onEdit={isOwn ? handleEdit : undefined}
              onDelete={isOwn ? handleDelete : undefined}
              onPin={handlePin}
              onReact={(event) => onOpenEmojiPicker(message.id, { x: event.clientX, y: event.clientY })}
              isOwn={isOwn}
              isPinned={Boolean(message.pinned)}
            />
        )}
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            items={contextItems}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={itemStyle}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onContextMenu={handleContextMenu}
    >
      {useSpriteAvatar ? (
        <button
          type="button"
          style={styles.avatarSpriteButton}
          onClick={handleOpenProfile}
          aria-label={`Open profile for ${displayName}`}
        >
          <AvatarSprite config={ownAvatarStudioPrefs.sprite} size={40} className="message-avatar-sprite" />
        </button>
      ) : (
        <Avatar
          name={displayName}
          hash={avatarHash}
          decorationHash={ownDecorationHash}
          userId={message.authorId}
          size={40}
          className="message-avatar"
          onClick={handleOpenProfile}
        />
      )}
      <div style={styles.body}>
        {referencedMessage && (
          <div style={styles.replyHeader}>
            <svg style={styles.replyHeaderSvg} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
            <span style={styles.replyAuthor}>{referencedResolved?.displayName ?? 'Unknown'}</span>
            <span style={styles.replySnippet}>{referencedMessage.content?.slice(0, 60)}</span>
          </div>
        )}
        <div style={styles.header}>
          <span style={styles.author} onClick={handleOpenProfile} role="button" tabIndex={0}>
            <DisplayNameText
              text={displayName}
              userId={message.authorId}
              guildId={guildId}
              context={isGuildChannel ? 'server' : 'dm_message'}
            />
          </span>
          <ServerTagBadge userId={message.authorId} />
          <span style={styles.timestamp}>{formatTimestamp(message.createdAt)}</span>
          {message.editedTimestamp && <span style={styles.edited}>(edited)</span>}
        </div>
        {isEditing ? (
          <div style={styles.editWrapper}>
            <textarea
              ref={editRef}
              style={styles.editInput}
              value={editContent}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
            />
            <div style={styles.editActions}>
              <span style={styles.editHint}>Escape to cancel, Enter to save</span>
            </div>
          </div>
        ) : (
          <div style={styles.content}>
            <MarkdownText content={message.content ?? ''} mentionLabels={mentionLabels} roleMentionLabels={roleMentionLabels} />
          </div>
        )}
        {attachments.length > 0 && <AttachmentDisplay attachments={attachments} />}
        <ReactionBar
          reactions={reactions}
          onToggle={handleReactionToggle}
          onAddReaction={(event) => onOpenEmojiPicker(message.id, { x: event.clientX, y: event.clientY })}
        />
      </div>
      {hovering && !isEditing && (
        <MessageActionBar
          onReply={() => onReply(message)}
          onEdit={isOwn ? handleEdit : undefined}
          onDelete={isOwn ? handleDelete : undefined}
          onPin={handlePin}
          onReact={(event) => onOpenEmojiPicker(message.id, { x: event.clientX, y: event.clientY })}
          isOwn={isOwn}
          isPinned={Boolean(message.pinned)}
        />
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={contextItems}
          onClose={() => setMenu(null)}
        />
      )}
      {profilePopover && author && (
          <ProfilePopover
            x={profilePopover.x}
            y={profilePopover.y}
            displayName={resolved.displayName}
            displayNameUserId={message.authorId}
            guildId={guildId}
            username={author.username ?? null}
            avatarHash={resolved.avatarHash}
            bannerHash={resolved.bannerHash}
            bio={resolved.bio}
            userId={message.authorId}
            primaryColor={primaryColor}
            accentColor={accentColor}
            onClose={() => setProfilePopover(null)}
          />
      )}
    </div>
  );
}
