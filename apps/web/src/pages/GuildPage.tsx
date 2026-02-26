import { useEffect } from 'react';
import { useParams, useNavigate, Outlet, Link } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { useGuildMembers } from '@/hooks/useGuildMembers';
import { getSocket } from '@/lib/socket';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GuildIcon } from '@/components/ui/GuildIcon';

// Channel type constants (API returns string enums)
const GUILD_TEXT = 'GUILD_TEXT';

export function GuildPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId?: string }>();
  const navigate = useNavigate();

  const guilds = useGuildsStore((s) => s.guilds);
  const setCurrentGuild = useGuildsStore((s) => s.setCurrentGuild);
  const channelsByGuild = useChannelsStore((s) => s.channelsByGuild);
  const channels = useChannelsStore((s) => s.channels);

  const guild = guildId ? guilds.get(guildId) : undefined;

  // Fetch channels for this guild
  const { isLoading } = useGuildChannels(guildId);
  useGuildMembers(guildId);

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
  if (channelId) {
    return <Outlet />;
  }

  // Portal interior — no channel selected yet
  // Show a polished welcome/interior view for the portal
  const guildChannelIds = guildId ? channelsByGuild.get(guildId) : undefined;
  const textChannels = guildChannelIds
    ? guildChannelIds
        .map((id) => channels.get(id))
        .filter((ch) => ch?.type === GUILD_TEXT)
    : [];

  return (
    <div className="guild-page-interior">
      {/* Hero */}
      <div className="guild-interior-hero">
        {guild?.bannerHash ? (
          <img
            src={`/api/v1/files/${guild.bannerHash}`}
            alt={`${guild.name} banner`}
            className="guild-interior-banner-img"
          />
        ) : (
          <div className="guild-interior-banner-placeholder" aria-hidden="true" />
        )}
        <div className="guild-interior-banner-overlay" />

        <div className="guild-interior-identity">
          {guild && (
            <GuildIcon
              name={guild.name}
              iconHash={guild.iconHash}
              guildId={guild.id}
              size={64}
              className="guild-interior-icon"
            />
          )}
          <div>
            <h1 className="guild-interior-name">{guild?.name ?? 'Portal'}</h1>
            {guild?.description && (
              <p className="guild-interior-desc">{guild.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="guild-interior-body">
        {/* Channels quick-pick */}
        <section className="guild-interior-section">
          <h2 className="guild-interior-section-title">Channels</h2>
          {textChannels.length === 0 ? (
            <p className="guild-interior-empty">No text channels yet. Ask an admin to create one.</p>
          ) : (
            <ul className="guild-interior-channel-list" role="list">
              {textChannels.slice(0, 10).map((ch) =>
                ch ? (
                  <li key={ch.id} role="listitem">
                    <Link
                      to={`/guild/${guildId}/channel/${ch.id}`}
                      className="guild-interior-channel-link"
                    >
                      <span className="guild-interior-channel-hash" aria-hidden="true">#</span>
                      <span className="guild-interior-channel-name">{ch.name}</span>
                      {ch.topic && (
                        <span className="guild-interior-channel-topic">{ch.topic}</span>
                      )}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        {/* Portal stats */}
        {guild && (
          <section className="guild-interior-section">
            <h2 className="guild-interior-section-title">Portal Info</h2>
            <div className="guild-interior-stats">
              <div className="guild-interior-stat">
                <span className="guild-interior-stat-value">
                  {guild.memberCount.toLocaleString()}
                </span>
                <span className="guild-interior-stat-label">Members</span>
              </div>
              <div className="guild-interior-stat">
                <span className="guild-interior-stat-value">{guild.boostCount}</span>
                <span className="guild-interior-stat-label">Boosts</span>
              </div>
              <div className="guild-interior-stat">
                <span className="guild-interior-stat-value">Tier {guild.boostTier}</span>
                <span className="guild-interior-stat-label">Boost Tier</span>
              </div>
            </div>

            {/* Tags */}
            {guild.tags && guild.tags.length > 0 && (
              <div className="guild-interior-tags" aria-label="Portal tags">
                {guild.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="guild-interior-tag">#{tag}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Prompt to select a channel */}
        <div className="guild-interior-cta-row">
          <p className="guild-interior-cta-text">Pick a channel above or use the sidebar to start chatting.</p>
        </div>
      </div>
    </div>
  );
}
