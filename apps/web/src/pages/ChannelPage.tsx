import { useEffect, useState, useCallback, Profiler } from 'react';
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
    <div className="dm-intro">
      <div className="dm-intro-icon">@</div>
      <div>
        <div className="dm-intro-title">{channel?.name ?? 'Direct Message'}</div>
        <div className="dm-intro-subtitle">
          This is the beginning of your direct message history.
        </div>
        <div className="dm-intro-chips">
          <span className="dm-intro-chip">Private</span>
          <span className="dm-intro-chip">Low latency</span>
        </div>
      </div>
    </div>
  ) : null;

  if (channel?.type === 'GUILD_STAGE_VOICE') {
    return (
      <div className="channel-page channel-page-voice">
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
      <div className="channel-page channel-page-voice">
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
    <div className={`channel-page ${isDm ? 'channel-page-dm' : 'channel-page-guild'}`}>
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
