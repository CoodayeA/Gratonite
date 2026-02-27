import React, { useEffect, useState, useCallback, Profiler } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useChannelsStore } from '@/stores/channels.store';
import { useUnreadStore } from '@/stores/unread.store';
import { useMessagesStore } from '@/stores/messages.store';
import { TopBar } from '@/components/layout/TopBar';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { PinnedMessagesPanel } from '@/components/messages/PinnedMessagesPanel';
import { SearchPanel } from '@/components/search/SearchPanel';
import { ThreadPanel } from '@/components/threads/ThreadPanel';
import { VoiceChannelView } from '@/components/voice/VoiceChannelView';
import { StageChannelView } from '@/components/StageChannelView';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui.store';
import { profileRender } from '@/lib/perf';
import type { Message } from '@gratonite/types';

/* ---------- styles ---------- */

const styles = {
  channelPage: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  } as React.CSSProperties,
  voicePage: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    background: 'radial-gradient(circle at 18% 6%, rgba(121, 223, 255, 0.08), transparent 38%), radial-gradient(circle at 86% 10%, rgba(138, 123, 255, 0.1), transparent 42%), radial-gradient(circle at top, rgba(12, 18, 30, 0.9), rgba(6, 10, 18, 1))',
  } as React.CSSProperties,
  dmIntro: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px 24px 16px',
    color: 'var(--text)',
    borderBottom: '1px solid var(--stroke)',
    background: 'var(--gold-subtle)',
    flexShrink: 0,
  } as React.CSSProperties,
  dmIntroLastChild: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  dmIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-pill)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg-purple-velvet)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,
  dmIntroTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  dmIntroSubtitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
    overflowWrap: 'anywhere',
  } as React.CSSProperties,
  dmIntroChips: {
    display: 'flex',
    gap: 6,
    marginTop: 6,
  } as React.CSSProperties,
  dmIntroChip: {
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 10,
    color: 'var(--text-faint)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  } as React.CSSProperties,
};

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const queryClient = useQueryClient();
  const setCurrentChannel = useChannelsStore((s) => s.setCurrentChannel);
  const markRead = useUnreadStore((s) => s.markRead);
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
  const pinnedPanelOpen = useUiStore((s) => s.pinnedPanelOpen);
  const searchPanelOpen = useUiStore((s) => s.searchPanelOpen);
  const threadPanelOpen = useUiStore((s) => s.threadPanelOpen);
  const openModal = useUiStore((s) => s.openModal);
  const setDmRecipientId = useUiStore((s) => s.setDmRecipientId);
  const setDmChannelContext = useUiStore((s) => s.setDmChannelContext);

  // Reply handling
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const handleReply = useCallback((msg: Message) => {
    if (channelId) setReplyingTo(channelId, msg);
  }, [channelId, setReplyingTo]);

  // Emoji picker for reactions
  const [emojiTarget, setEmojiTarget] = useState<{ messageId: string; x?: number; y?: number } | null>(null);
  const handleOpenEmojiPicker = useCallback((messageId: string, coords?: { x: number; y: number }) => {
    setEmojiTarget({ messageId, x: coords?.x, y: coords?.y });
  }, []);

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
      markRead(channelId);
    }
    return () => setCurrentChannel(null);
  }, [channelId, setCurrentChannel]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId || !isDm) return;
    socket.emit('CHANNEL_SUBSCRIBE', { channelId });
    return () => {
      socket.emit('CHANNEL_UNSUBSCRIBE', { channelId });
    };
  }, [channelId, isDm]);

  // Set the DM recipient ID and channel context in the UI store for the right panel
  useEffect(() => {
    if (channel?.type === 'DM' && channelId) {
      const dmChannels = (queryClient.getQueryData(['relationships', 'dms']) as Array<{ id: string; otherUserId?: string | null }> | undefined) ?? [];
      const dm = dmChannels.find((row) => row.id === channelId);
      const otherUserId = dm?.otherUserId ?? null;
      setDmRecipientId(otherUserId);
      setDmChannelContext('DM', channelId);
    } else if (channel?.type === 'GROUP_DM' && channelId) {
      setDmChannelContext('GROUP_DM', channelId);
      setDmRecipientId(null);
    } else {
      setDmChannelContext(null, null);
      setDmRecipientId(null);
    }
    return () => {
      setDmChannelContext(null, null);
      setDmRecipientId(null);
    };
  }, [channelId, channel?.type, queryClient, setDmRecipientId, setDmChannelContext]);

  if (!channelId) return null;

  const dmIntro = isDm ? (
    <div style={styles.dmIntro}>
      <div style={styles.dmIntroIcon}>@</div>
      <div style={styles.dmIntroLastChild}>
        <div style={styles.dmIntroTitle}>{channel?.name ?? 'Direct Message'}</div>
        <div style={styles.dmIntroSubtitle}>
          This is the beginning of your direct message history.
        </div>
        <div style={styles.dmIntroChips}>
          <span style={styles.dmIntroChip}>Private</span>
          <span style={styles.dmIntroChip}>Low latency</span>
        </div>
      </div>
    </div>
  ) : null;

  if (channel?.type === 'GUILD_STAGE_VOICE') {
    return (
      <div style={styles.voicePage}>
        <TopBar channelId={channelId} />
        <StageChannelView channelId={channelId} channelName={channel?.name ?? 'Stage'} />
        {searchPanelOpen && (
          <SearchPanel channelId={channelId} />
        )}
        {threadPanelOpen && !isDm && (
          <ThreadPanel channelId={channelId} />
        )}
      </div>
    );
  }

  if (channel?.type === 'GUILD_VOICE') {
    return (
      <div style={styles.voicePage}>
        <TopBar channelId={channelId} />
        <VoiceChannelView channelId={channelId} channelName={channel?.name ?? 'Voice'} />
        {searchPanelOpen && (
          <SearchPanel channelId={channelId} />
        )}
        {threadPanelOpen && !isDm && (
          <ThreadPanel channelId={channelId} />
        )}
      </div>
    );
  }

  return (
    <div style={styles.channelPage}>
      <TopBar channelId={channelId} />
      <Profiler id="MessageList" onRender={profileRender}>
        <MessageList
          channelId={channelId}
          intro={dmIntro}
          emptyTitle={isDm ? 'Start the conversation' : 'No messages yet.'}
          emptySubtitle={isDm
            ? 'Say hello or share something to get it going.'
            : 'Say something to get the conversation started.'}
          onReply={handleReply}
          onOpenEmojiPicker={handleOpenEmojiPicker}
        />
      </Profiler>
      <TypingIndicator channelId={channelId} />
      <MessageComposer
        channelId={channelId}
        placeholder={channel
          ? (isDm ? `Message @${channel.name ?? 'direct message'}` : `Message #${channel.name}`)
          : 'Message #channel'}
      />
      {pinnedPanelOpen && !isDm && (
        <PinnedMessagesPanel channelId={channelId} />
      )}
      {searchPanelOpen && (
        <SearchPanel channelId={channelId} />
      )}
      {threadPanelOpen && !isDm && (
        <ThreadPanel channelId={channelId} />
      )}
      {emojiTarget && (
        <EmojiPicker
          onSelect={(emoji) => {
            api.messages.addReaction(channelId!, emojiTarget.messageId, emoji).catch(console.error);
            setEmojiTarget(null);
          }}
          onAddEmoji={
            channel?.guildId
              ? () => {
                openModal('emoji-studio', { guildId: channel.guildId });
              }
              : undefined
          }
          onClose={() => setEmojiTarget(null)}
          x={emojiTarget.x}
          y={emojiTarget.y}
        />
      )}
    </div>
  );
}
