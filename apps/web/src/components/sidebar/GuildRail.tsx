import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuilds } from '@/hooks/useGuilds';
import { useUiStore } from '@/stores/ui.store';
import { useUnreadStore } from '@/stores/unread.store';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { UserBar } from '@/components/sidebar/UserBar';
import { api } from '@/lib/api';

/* ── CSS Variable tokens (inline style references) ────────────────────── */
const V = {
  bg:          'var(--bg, #2c2c3e)',
  bgElevated:  'var(--bg-elevated, #353348)',
  bgSoft:      'var(--bg-soft, #413d58)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
  railBg:      '#1a1a2e',
} as const;

/* ── Shared inline style objects ──────────────────────────────────────── */

const railStyle: React.CSSProperties = {
  width: 72,
  background: V.railBg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '16px 0',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

const iconBaseStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  flexShrink: 0,
  transition: 'background 0.15s ease, border-radius 0.15s ease',
};

const homeIconStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: V.accent,
  color: V.textOnGold,
  fontWeight: 800,
  fontSize: 22,
  fontFamily: 'inherit',
  letterSpacing: '-0.5px',
};

const dividerStyle: React.CSSProperties = {
  width: 32,
  height: 2,
  background: V.stroke,
  borderRadius: 1,
  flexShrink: 0,
};

const serverIconStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: V.bgElevated,
  color: V.text,
};

const serverIconActiveStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: V.bgSoft,
  color: V.text,
};

const addButtonStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: 'transparent',
  border: `1px solid ${V.stroke}`,
  color: V.textMuted,
  fontSize: 22,
  fontWeight: 300,
};

const discoverButtonStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: 'transparent',
  color: V.textMuted,
};

const utilityButtonStyle: React.CSSProperties = {
  ...iconBaseStyle,
  background: 'transparent',
  color: V.textMuted,
};

const guildListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  overflowY: 'auto',
  overflowX: 'hidden',
  flexGrow: 1,
  flexShrink: 1,
  minHeight: 0,
  width: '100%',
  scrollbarWidth: 'none',
};

const guildItemWrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
};

/* Active indicator pill (gold, left side) */
const activeIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 4,
  height: 32,
  borderRadius: '0 4px 4px 0',
  background: V.accent,
};

/* Hover indicator (smaller) */
const hoverIndicatorStyle: React.CSSProperties = {
  ...activeIndicatorStyle,
  height: 20,
  opacity: 0,
  transition: 'opacity 0.15s ease, height 0.15s ease',
};

/* Unread dot indicator (left side, white pill) */
const unreadIndicatorStyle: React.CSSProperties = {
  ...activeIndicatorStyle,
  height: 8,
  background: V.text,
};

const profileSlotStyle: React.CSSProperties = {
  width: 48,
  flexShrink: 0,
};

const spacerStyle: React.CSSProperties = {
  flexGrow: 1,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

export function GuildRail() {
  // Triggers data fetch + syncs to store
  useGuilds();

  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const channels = useChannelsStore((s) => s.channels);
  const statesByChannel = useVoiceStore((s) => s.statesByChannel);
  const updateVoiceState = useVoiceStore((s) => s.updateVoiceState);
  const unreadCountByChannel = useUnreadStore((s) => s.unreadCountByChannel);
  const openModal = useUiStore((s) => s.openModal);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const navigate = useNavigate();
  const isGuildContext = !!useMatch('/guild/:guildId/*');
  const [tooltipGuild, setTooltipGuild] = useState<{ id: string; rect: DOMRect } | null>(null);
  const fetchedGuildsRef = useRef<Set<string>>(new Set());
  const [hoveredGuild, setHoveredGuild] = useState<string | null>(null);

  // Fetch voice states for all guilds on mount + when guild list changes
  useEffect(() => {
    guildOrder.forEach((guildId) => {
      if (fetchedGuildsRef.current.has(guildId)) return;
      fetchedGuildsRef.current.add(guildId);
      api.voice.getGuildVoiceStates(guildId).then((states) => {
        if (Array.isArray(states)) {
          states.forEach((state: any) => updateVoiceState(state));
        }
      }).catch(() => undefined);
    });
  }, [guildOrder, updateVoiceState]);

  // Build a map of guildId → voice channel info (channel name + user count)
  const guildVoiceInfo = useMemo(() => {
    const info = new Map<string, Array<{ channelId: string; channelName: string; userCount: number }>>();
    for (const [channelId, voiceStates] of statesByChannel.entries()) {
      if (!voiceStates || voiceStates.length === 0) continue;
      const ch = channels.get(channelId);
      if (!ch?.guildId) continue;
      const existing = info.get(ch.guildId) ?? [];
      existing.push({
        channelId,
        channelName: ch.name ?? 'Voice Channel',
        userCount: voiceStates.length,
      });
      info.set(ch.guildId, existing);
    }
    return info;
  }, [statesByChannel, channels]);

  const handleHomeClick = (e: React.MouseEvent) => {
    if (!isGuildContext) {
      // Already in DM context — toggle sidebar collapse
      e.preventDefault();
      toggleSidebar();
    } else {
      // In guild context — navigate to DM home and ensure sidebar is open
      e.preventDefault();
      if (sidebarCollapsed) toggleSidebar();
      navigate('/');
    }
  };

  const handleVoiceHover = useCallback((guildId: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipGuild({ id: guildId, rect });
  }, []);

  const handleVoiceLeave = useCallback(() => {
    setTooltipGuild(null);
  }, []);

  // Resolve the tooltip guild's voice channels
  const tooltipVoiceChannels = tooltipGuild ? guildVoiceInfo.get(tooltipGuild.id) : null;

  return (
    <nav className="guild-rail" style={railStyle}>
      {/* ── 1. Logo / Home Button (gold "G") ─────────────────────────── */}
      <NavLink
        to="/"
        className={`guild-rail-item guild-rail-home ${!isGuildContext ? 'is-dm-home' : ''}`}
        onClick={handleHomeClick}
        title={!isGuildContext ? 'Toggle DM sidebar' : 'Direct Messages'}
        style={{ textDecoration: 'none' }}
      >
        <div className="guild-rail-icon guild-rail-home-icon" style={homeIconStyle}>
          G
        </div>
      </NavLink>

      {/* ── 2. Divider ───────────────────────────────────────────────── */}
      <div className="guild-rail-divider" style={dividerStyle} />

      {/* ── Profile slot (preserved) ─────────────────────────────────── */}
      <div className="guild-rail-profile-slot" style={profileSlotStyle} title="Profile and status">
        <UserBar compact />
      </div>

      {/* ── 3. Server icons (scrollable guild list) ──────────────────── */}
      <div className="guild-rail-list" style={guildListStyle}>
        {guildOrder.map((id) => {
          const guild = guilds.get(id);
          if (!guild) return null;
          const voiceChannels = guildVoiceInfo.get(id);
          const hasVoice = voiceChannels && voiceChannels.length > 0;
          const totalVoiceUsers = hasVoice ? voiceChannels.reduce((sum, vc) => sum + vc.userCount, 0) : 0;

          // Compute unread count for this guild
          let guildUnread = 0;
          for (const [channelId, count] of unreadCountByChannel.entries()) {
            const ch = channels.get(channelId);
            if (ch?.guildId === guild.id) guildUnread += count;
          }

          const isHovered = hoveredGuild === id;

          return (
            <NavLink
              key={id}
              to={`/guild/${id}`}
              className={({ isActive }) =>
                `guild-rail-item ${isActive ? 'guild-rail-item-active' : ''}`
              }
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                setHoveredGuild(id);
                if (hasVoice) handleVoiceHover(id, e);
              }}
              onMouseLeave={() => {
                setHoveredGuild(null);
                if (hasVoice) handleVoiceLeave();
              }}
            >
              {({ isActive }) => (
                <div style={guildItemWrapperStyle}>
                  {/* Active indicator — gold pill on left */}
                  {isActive && <div style={activeIndicatorStyle} />}

                  {/* Hover indicator — smaller pill, only when not active */}
                  {!isActive && (
                    <div style={{ ...hoverIndicatorStyle, opacity: isHovered ? 1 : 0 }} />
                  )}

                  {/* Unread indicator — small white dot on left, only when not active and has unreads */}
                  {!isActive && guildUnread > 0 && !isHovered && (
                    <div style={unreadIndicatorStyle} />
                  )}

                  {/* Server icon */}
                  <div style={isActive ? serverIconActiveStyle : serverIconStyle}>
                    {guildUnread > 0 && (
                      <span className="guild-rail-unread-badge" aria-label={`${guildUnread} unread in ${guild.name}`}>
                        {guildUnread > 99 ? '99+' : guildUnread}
                      </span>
                    )}
                    {hasVoice && (
                      <span className="guild-rail-voice-badge" aria-label={`${totalVoiceUsers} in voice`} title="">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                      </span>
                    )}
                    <GuildIcon
                      name={guild.name}
                      iconHash={guild.iconHash}
                      guildId={guild.id}
                      size={48}
                    />
                  </div>
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* ── 4. Divider 2 ─────────────────────────────────────────────── */}
      <div className="guild-rail-divider" style={dividerStyle} />

      {/* ── 5. Add Server button (+) ─────────────────────────────────── */}
      <button
        className="guild-rail-item guild-rail-add guild-rail-create-join"
        onClick={() => openModal('create-guild')}
        title="Create or join a server"
        style={{ ...addButtonStyle, outline: 'none' }}
      >
        <span style={{ lineHeight: 1 }}>+</span>
      </button>

      {/* ── 6. Discover button (compass) ─────────────────────────────── */}
      <NavLink
        to="/discover"
        className="guild-rail-item guild-rail-utility"
        title="Find a new portal to join"
        style={{ textDecoration: 'none' }}
      >
        <div style={discoverButtonStyle} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </div>
      </NavLink>

      {/* ── Shop button (preserved) ──────────────────────────────────── */}
      <NavLink to="/shop" className="guild-rail-item guild-rail-utility" title="Open shop" style={{ textDecoration: 'none' }}>
        <div style={utilityButtonStyle} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 12H7L6 7Z" />
            <path d="M9 7a3 3 0 1 1 6 0" />
          </svg>
        </div>
      </NavLink>

      {/* ── Spacer ───────────────────────────────────────────────────── */}
      <div style={spacerStyle} />

      {/* ── Bottom divider ───────────────────────────────────────────── */}
      <div className="guild-rail-divider guild-rail-divider-bottom" style={dividerStyle} />

      {/* ── Footer (notifications + settings) ────────────────────────── */}
      <div className="guild-rail-footer" style={footerStyle}>
        <NavLink to="/notifications" className="guild-rail-item guild-rail-utility" title="Notifications" style={{ textDecoration: 'none' }}>
          <div style={utilityButtonStyle} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </div>
        </NavLink>
        <NavLink to="/settings" className="guild-rail-item guild-rail-utility" title="Settings" style={{ textDecoration: 'none' }}>
          <div style={utilityButtonStyle} className="guild-rail-settings-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
        </NavLink>
      </div>

      {/* ── Voice tooltip rendered via portal to avoid overflow:hidden clipping ── */}
      {tooltipGuild && tooltipVoiceChannels && tooltipVoiceChannels.length > 0 && createPortal(
        <div
          className="guild-rail-voice-tooltip"
          style={{
            position: 'fixed',
            left: tooltipGuild.rect.right + 12,
            top: tooltipGuild.rect.top + tooltipGuild.rect.height / 2,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="guild-rail-voice-tooltip-title">Voice Active</div>
          {tooltipVoiceChannels.map((vc) => (
            <div key={vc.channelId} className="guild-rail-voice-tooltip-channel">
              <span className="guild-rail-voice-tooltip-icon">🔊</span>
              <span className="guild-rail-voice-tooltip-name">{vc.channelName}</span>
              <span className="guild-rail-voice-tooltip-count">{vc.userCount}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </nav>
  );
}
