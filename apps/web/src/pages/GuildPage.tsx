import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Outlet, Link } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { useGuildMembers } from '@/hooks/useGuildMembers';
import { useMembersStore } from '@/stores/members.store';
import { getSocket } from '@/lib/socket';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GuildIcon } from '@/components/ui/GuildIcon';

// Channel type constants (API returns string enums)
const GUILD_TEXT = 'GUILD_TEXT';
const GUILD_VOICE = 'GUILD_VOICE';

/* ── CSS variable tokens ─────────────────────────────────────────── */
const V = {
  bg:          'var(--bg, #2c2c3e)',
  bgElevated:  'var(--bg-elevated, #353348)',
  bgSoft:      'var(--bg-soft, #413d58)',
  bgInput:     'var(--bg-input, #25243a)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
  goldSubtle:  '#d4af3730',
} as const;

export function GuildPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId?: string }>();
  const navigate = useNavigate();

  const setCurrentGuild = useGuildsStore((s) => s.setCurrentGuild);
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const channelsByGuild = useChannelsStore((s) => s.channelsByGuild);
  const channels = useChannelsStore((s) => s.channels);
  const membersByGuild = useMembersStore((s) => s.membersByGuild);

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

  // Derived channel lists
  const guildChannelIds = guildId ? channelsByGuild.get(guildId) ?? [] : [];
  const textChannels = useMemo(
    () => guildChannelIds.map((id) => channels.get(id)).filter((ch) => ch?.type === GUILD_TEXT),
    [guildChannelIds, channels],
  );
  const voiceChannels = useMemo(
    () => guildChannelIds.map((id) => channels.get(id)).filter((ch) => ch?.type === GUILD_VOICE),
    [guildChannelIds, channels],
  );
  const memberCount = guildId ? (membersByGuild.get(guildId)?.size ?? guild?.memberCount ?? 0) : 0;

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

  // Portal interior — shown when no channel is selected
  return (
    <div className="portal-interior">
      {/* ── Banner ──────────────────────────────────────────────── */}
      <div className="portal-interior-banner">
        {guild?.bannerHash ? (
          <img
            src={`/api/v1/files/${guild.bannerHash}`}
            alt=""
            className="portal-interior-banner-img"
          />
        ) : (
          <div className="portal-interior-banner-fallback" />
        )}
        <div className="portal-interior-banner-overlay" />
      </div>

      {/* ── Header info ─────────────────────────────────────────── */}
      <div className="portal-interior-header">
        <div className="portal-interior-icon-wrap">
          <GuildIcon
            name={guild?.name ?? 'Portal'}
            iconHash={guild?.iconHash ?? null}
            guildId={guildId ?? ''}
            size={72}
          />
        </div>
        <div className="portal-interior-meta">
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: V.text }}>
            {guild?.name ?? 'Portal'}
          </h1>
          {guild?.description && (
            <p style={{ margin: '4px 0 0', fontSize: 14, color: V.textMuted, lineHeight: 1.5 }}>
              {guild.description}
            </p>
          )}
          <div className="portal-interior-stats">
            <span className="portal-interior-stat">
              <span className="portal-interior-stat-dot portal-interior-stat-dot--members" />
              {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
            </span>
            <span className="portal-interior-stat">
              <span className="portal-interior-stat-dot portal-interior-stat-dot--channels" />
              {textChannels.length} Text {textChannels.length === 1 ? 'Channel' : 'Channels'}
            </span>
            {voiceChannels.length > 0 && (
              <span className="portal-interior-stat">
                <span className="portal-interior-stat-dot portal-interior-stat-dot--voice" />
                {voiceChannels.length} Voice
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Channel list ────────────────────────────────────────── */}
      <div className="portal-interior-body">
        <section className="portal-interior-section">
          <div className="portal-interior-section-title">Text Channels</div>
          {textChannels.length === 0 ? (
            <div className="portal-interior-empty">No text channels yet.</div>
          ) : (
            <div className="portal-interior-channel-list">
              {textChannels.map((ch) =>
                ch ? (
                  <Link
                    key={ch.id}
                    to={`/guild/${guildId}/channel/${ch.id}`}
                    className="portal-interior-channel-row"
                  >
                    <span className="portal-interior-channel-hash">#</span>
                    <span className="portal-interior-channel-name">{ch.name}</span>
                  </Link>
                ) : null,
              )}
            </div>
          )}
        </section>

        {voiceChannels.length > 0 && (
          <section className="portal-interior-section">
            <div className="portal-interior-section-title">Voice Channels</div>
            <div className="portal-interior-channel-list">
              {voiceChannels.map((ch) =>
                ch ? (
                  <div key={ch.id} className="portal-interior-channel-row portal-interior-channel-row--voice">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    <span className="portal-interior-channel-name">{ch.name}</span>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        {/* ── Quick actions ───────────────────────────────────────── */}
        <section className="portal-interior-section">
          <div className="portal-interior-section-title">Quick Actions</div>
          <div className="portal-interior-actions">
            {textChannels[0] && (
              <button
                type="button"
                className="portal-interior-action-btn portal-interior-action-btn--primary"
                onClick={() => navigate(`/guild/${guildId}/channel/${textChannels[0]!.id}`)}
              >
                Start Chatting
              </button>
            )}
            <Link
              to={`/portal/${guildId}/preview`}
              className="portal-interior-action-btn portal-interior-action-btn--ghost"
            >
              View Portal Preview
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
