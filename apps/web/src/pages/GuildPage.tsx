import { useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { getSocket } from '@/lib/socket';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Channel type constants (API returns string enums)
const GUILD_TEXT = 'GUILD_TEXT';

export function GuildPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId?: string }>();
  const navigate = useNavigate();

  const setCurrentGuild = useGuildsStore((s) => s.setCurrentGuild);
  const channelsByGuild = useChannelsStore((s) => s.channelsByGuild);
  const channels = useChannelsStore((s) => s.channels);

  // Fetch channels for this guild
  const { isLoading } = useGuildChannels(guildId);

  // Set current guild in store
  useEffect(() => {
    if (guildId) {
      setCurrentGuild(guildId);

      // Subscribe to guild events via gateway
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('GUILD_SUBSCRIBE', { guildId });
      }
    }

    return () => {
      setCurrentGuild(null);
    };
  }, [guildId, setCurrentGuild]);

  // Auto-redirect to first text channel if no channel selected
  useEffect(() => {
    if (channelId || isLoading || !guildId) return;

    const guildChannelIds = channelsByGuild.get(guildId);
    if (!guildChannelIds || guildChannelIds.length === 0) return;

    // Find first text channel
    const firstText = guildChannelIds
      .map((id) => channels.get(id))
      .find((ch) => ch?.type === GUILD_TEXT);

    if (firstText) {
      navigate(`/guild/${guildId}/channel/${firstText.id}`, { replace: true });
    }
  }, [channelId, isLoading, guildId, channelsByGuild, channels, navigate]);

  if (isLoading) {
    return (
      <div className="guild-page-loading">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // If there's a channelId, the Outlet (ChannelPage) renders
  // Otherwise show a placeholder
  if (!channelId) {
    return (
      <div className="guild-page-empty">
        <p>Select a channel to start chatting</p>
      </div>
    );
  }

  return <Outlet />;
}
