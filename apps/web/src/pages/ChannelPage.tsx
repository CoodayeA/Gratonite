import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { useUnreadStore } from '@/stores/unread.store';
import { useMessagesStore } from '@/stores/messages.store';
import { TopBar } from '@/components/layout/TopBar';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { api } from '@/lib/api';
import type { Message } from '@gratonite/types';

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const setCurrentChannel = useChannelsStore((s) => s.setCurrentChannel);
  const markRead = useUnreadStore((s) => s.markRead);
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';

  // Reply handling
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const handleReply = useCallback((msg: Message) => {
    if (channelId) setReplyingTo(channelId, msg);
  }, [channelId, setReplyingTo]);

  // Emoji picker for reactions
  const [emojiTarget, setEmojiTarget] = useState<{ messageId: string } | null>(null);
  const handleOpenEmojiPicker = useCallback((messageId: string) => {
    setEmojiTarget({ messageId });
  }, []);

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
      markRead(channelId);
    }
    return () => setCurrentChannel(null);
  }, [channelId, setCurrentChannel]);

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

  return (
    <div className="channel-page">
      <TopBar channelId={channelId} />
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
      <TypingIndicator channelId={channelId} />
      <MessageComposer
        channelId={channelId}
        placeholder={channel
          ? (isDm ? `Message @${channel.name ?? 'direct message'}` : `Message #${channel.name}`)
          : 'Message #channel'}
      />
      {emojiTarget && (
        <EmojiPicker
          onSelect={(emoji) => {
            api.messages.addReaction(channelId!, emojiTarget.messageId, emoji).catch(console.error);
            setEmojiTarget(null);
          }}
          onClose={() => setEmojiTarget(null)}
        />
      )}
    </div>
  );
}
