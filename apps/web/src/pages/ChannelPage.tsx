import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChannelsStore } from '@/stores/channels.store';
import { TopBar } from '@/components/layout/TopBar';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { TypingIndicator } from '@/components/messages/TypingIndicator';

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const setCurrentChannel = useChannelsStore((s) => s.setCurrentChannel);
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
    }
    return () => setCurrentChannel(null);
  }, [channelId, setCurrentChannel]);

  if (!channelId) return null;

  return (
    <div className="channel-page">
      <TopBar channelId={channelId} />
      <MessageList channelId={channelId} />
      <TypingIndicator channelId={channelId} />
      <MessageComposer
        channelId={channelId}
        placeholder={channel ? `Message #${channel.name}` : 'Message #channel'}
      />
    </div>
  );
}
