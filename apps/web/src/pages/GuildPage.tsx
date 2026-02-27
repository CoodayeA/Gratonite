import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Outlet, Link } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { useGuildMembers } from '@/hooks/useGuildMembers';
import { getSocket } from '@/lib/socket';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GuildIcon } from '@/components/ui/GuildIcon';

// Channel type constants (API returns string enums)
const GUILD_TEXT = 'GUILD_TEXT';
const GUILD_VOICE = 'GUILD_VOICE';

/* ── CSS variable tokens ─────────────────────────────────────────── */
const V = {
  bg:         'var(--bg, #2c2c3e)',
  bgElevated: 'var(--bg-elevated, #353348)',
  bgInput:    'var(--bg-input, #25243a)',
  bgSoft:     'var(--bg-soft, #413d58)',
  stroke:     'var(--stroke, #4a4660)',
  accent:     'var(--accent, #d4af37)',
  text:       'var(--text, #e8e4e0)',
  textMuted:  'var(--text-muted, #a8a4b8)',
  textFaint:  'var(--text-faint, #6e6a80)',
  textOnGold: 'var(--text-on-gold, #1a1a2e)',
  goldSubtle: '#d4af3730',
} as const;

/* ── Inline style objects ─────────────────────────────────────────── */
const styles = {
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: V.bg,
  } as React.CSSProperties,

  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: V.bg,
    overflow: 'auto',
  } as React.CSSProperties,

  hero: {
    position: 'relative',
    width: '100%',
    height: 120,
    minHeight: 120,
    overflow: 'hidden',
    flexShrink: 0,
  } as React.CSSProperties,

  heroBannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,

  heroBannerPlaceholder: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${V.bgSoft}, ${V.bgElevated})`,
  } as React.CSSProperties,

  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, transparent 40%, rgba(44,44,62,0.95) 100%)',
  } as React.CSSProperties,

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    padding: '32px 40px',
    flex: 1,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as React.CSSProperties,

  guildIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-md)',
    background: V.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  } as React.CSSProperties,

  titleStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as React.CSSProperties,

  guildName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: V.text,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  subtitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 400,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  inviteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    padding: '0 16px',
    borderRadius: 'var(--radius-md)',
    background: V.accent,
    color: V.textOnGold,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'Inter, sans-serif',
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  settingsBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    border: `1px solid ${V.stroke}`,
    color: V.textMuted,
    cursor: 'pointer',
    fontSize: 16,
  } as React.CSSProperties,

  channelsGrid: {
    display: 'flex',
    gap: 24,
    width: '100%',
    flex: 1,
  } as React.CSSProperties,

  channelColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  columnLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    color: V.textMuted,
    letterSpacing: 1,
    fontFamily: 'Inter, sans-serif',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  textChannelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    color: V.textMuted,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'Inter, sans-serif',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties,

  textChannelItemActive: {
    background: V.bgSoft,
    border: `1px solid ${V.stroke}`,
  } as React.CSSProperties,

  hashIcon: {
    fontSize: 16,
    color: V.textMuted,
    flexShrink: 0,
  } as React.CSSProperties,

  hashIconGold: {
    fontSize: 16,
    color: V.accent,
    flexShrink: 0,
  } as React.CSSProperties,

  voiceChannelItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,

  voiceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,

  voiceLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  voiceName: {
    fontSize: 14,
    fontWeight: 500,
    color: V.text,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  voiceNameMuted: {
    fontSize: 14,
    fontWeight: 500,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  voiceBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 22,
    padding: '0 8px',
    borderRadius: 'var(--radius-pill)',
    background: V.goldSubtle,
  } as React.CSSProperties,

  voiceBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: V.accent,
  } as React.CSSProperties,

  voiceBadgeText: {
    fontSize: 10,
    fontWeight: 500,
    color: V.accent,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  emptyText: {
    color: V.textFaint,
    fontSize: 14,
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  ctaRow: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: 8,
  } as React.CSSProperties,

  ctaText: {
    color: V.textFaint,
    fontSize: 13,
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
};

export function GuildPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId?: string }>();
  const navigate = useNavigate();

  const guilds = useGuildsStore((s) => s.guilds);
  const setCurrentGuild = useGuildsStore((s) => s.setCurrentGuild);
  const channelsByGuild = useChannelsStore((s) => s.channelsByGuild);
  const channels = useChannelsStore((s) => s.channels);
  const voiceStatesByChannel = useVoiceStore((s) => s.statesByChannel);

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

  // Derive channel lists
  const guildChannelIds = guildId ? channelsByGuild.get(guildId) : undefined;

  const textChannels = useMemo(() => {
    if (!guildChannelIds) return [];
    return guildChannelIds
      .map((id) => channels.get(id))
      .filter((ch) => ch?.type === GUILD_TEXT);
  }, [guildChannelIds, channels]);

  const voiceChannels = useMemo(() => {
    if (!guildChannelIds) return [];
    return guildChannelIds
      .map((id) => channels.get(id))
      .filter((ch) => ch?.type === GUILD_VOICE);
  }, [guildChannelIds, channels]);

  // Online count estimate
  const onlineCount = useMemo(() => {
    if (!guild) return 0;
    return Math.max(1, Math.floor(guild.memberCount * 0.17));
  }, [guild]);

  // Established date
  const estDate = useMemo(() => {
    if (!guild) return '';
    const d = new Date(guild.createdAt);
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [guild]);

  if (isLoading) {
    return (
      <div style={styles.loadingWrap}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // If there's a channelId, the Outlet (ChannelPage) renders
  if (channelId) {
    return <Outlet />;
  }

  // Portal interior -- no channel selected yet
  return (
    <div style={styles.page}>
      {/* Hero banner (compact) */}
      <div style={styles.hero}>
        {guild?.bannerHash ? (
          <img
            src={`/api/v1/files/${guild.bannerHash}`}
            alt={`${guild.name} banner`}
            style={styles.heroBannerImg}
          />
        ) : (
          <div style={styles.heroBannerPlaceholder} aria-hidden="true" />
        )}
        <div style={styles.heroOverlay} />
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* Header: icon + name + invite */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.guildIconWrap}>
              {guild && (
                <GuildIcon
                  name={guild.name}
                  iconHash={guild.iconHash}
                  guildId={guild.id}
                  size={48}
                />
              )}
            </div>
            <div style={styles.titleStack}>
              <h1 style={styles.guildName}>{guild?.name ?? 'Portal'}</h1>
              <p style={styles.subtitle}>
                Est. {estDate} &mdash; {onlineCount} online
              </p>
            </div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.inviteBtn} title="Invite people">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              <span>Invite</span>
            </button>
            <button style={styles.settingsBtn} title="Portal settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>

        {/* Two-column channel grid */}
        <div style={styles.channelsGrid}>
          {/* TEXT CHANNELS */}
          <div style={styles.channelColumn}>
            <h2 style={styles.columnLabel}>Text Channels</h2>
            {textChannels.length === 0 ? (
              <p style={styles.emptyText}>No text channels yet.</p>
            ) : (
              textChannels.slice(0, 10).map((ch, idx) =>
                ch ? (
                  <Link
                    key={ch.id}
                    to={`/guild/${guildId}/channel/${ch.id}`}
                    style={{
                      ...styles.textChannelItem,
                      ...(idx === 0
                        ? { background: V.bgSoft, border: `1px solid ${V.stroke}` }
                        : {}),
                      color: idx === 0 ? V.text : V.textMuted,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={idx === 0 ? V.accent : 'currentColor'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <line x1="4" y1="9" x2="20" y2="9" />
                      <line x1="4" y1="15" x2="20" y2="15" />
                      <line x1="10" y1="3" x2="8" y2="21" />
                      <line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    <span>{ch.name}</span>
                  </Link>
                ) : null,
              )
            )}
          </div>

          {/* VOICE CHANNELS */}
          <div style={styles.channelColumn}>
            <h2 style={styles.columnLabel}>Voice Channels</h2>
            {voiceChannels.length === 0 ? (
              <p style={styles.emptyText}>No voice channels yet.</p>
            ) : (
              voiceChannels.slice(0, 10).map((ch) => {
                if (!ch) return null;
                const voiceStates = voiceStatesByChannel.get(ch.id) ?? [];
                const activeCount = Array.isArray(voiceStates) ? voiceStates.length : 0;
                const hasActive = activeCount > 0;
                return (
                  <div
                    key={ch.id}
                    style={{
                      ...styles.voiceChannelItem,
                      ...(hasActive
                        ? { background: V.bgSoft, border: `1px solid ${V.stroke}` }
                        : {}),
                    }}
                  >
                    <div style={styles.voiceHeader}>
                      <div style={styles.voiceLeft}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={hasActive ? V.accent : V.textMuted}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ flexShrink: 0 }}
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        </svg>
                        <span style={hasActive ? styles.voiceName : styles.voiceNameMuted}>
                          {ch.name}
                        </span>
                      </div>
                      {activeCount > 0 && (
                        <div style={styles.voiceBadge}>
                          <div style={styles.voiceBadgeDot} />
                          <span style={styles.voiceBadgeText}>
                            {activeCount} active
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CTA */}
        <div style={styles.ctaRow}>
          <p style={styles.ctaText}>Pick a channel above or use the sidebar to start chatting.</p>
        </div>
      </div>
    </div>
  );
}
