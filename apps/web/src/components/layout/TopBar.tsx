import React, { useState } from 'react';
import { useChannelsStore } from '@/stores/channels.store';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import { startOutgoingCall } from '@/lib/dmCall';
import { useCallStore } from '@/stores/call.store';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  stroke: 'var(--stroke, #4a4660)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
  textFaint: 'var(--text-faint, #6e6a80)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const topbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 16px',
  height: 'var(--topbar-height)',
  borderBottom: '1px solid rgba(74, 70, 96, 0.88)',
  background: 'linear-gradient(90deg, rgba(121, 223, 255, 0.05), transparent 35%), linear-gradient(270deg, rgba(138, 123, 255, 0.035), transparent 40%), rgba(17, 24, 40, 0.9)',
  backdropFilter: 'blur(14px) saturate(118%)',
  flexShrink: 0,
} as React.CSSProperties;

const topbarInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: '1 1 auto',
} as React.CSSProperties;

const topbarMobileNav = {
  display: 'none',
  alignItems: 'center',
  gap: 6,
} as React.CSSProperties;

const topbarBtnBase = {
  background: 'rgba(255, 255, 255, 0.02)',
  borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(163, 191, 239, 0.08)',
  color: V.textMuted,
  fontSize: 18,
  padding: 6,
  borderRadius: 10,
  transition: 'all 0.14s ease',
  flexShrink: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as React.CSSProperties;

const topbarBtnHover = {
  ...topbarBtnBase,
  background: 'linear-gradient(180deg, rgba(121, 223, 255, 0.08), rgba(138, 123, 255, 0.05))',
  borderColor: 'rgba(163, 191, 239, 0.16)',
  color: V.text,
} as React.CSSProperties;

const topbarBtnMobileNav = {
  ...topbarBtnBase,
  padding: 6,
} as React.CSSProperties;

const topbarDmInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flex: '1 1 auto',
} as React.CSSProperties;

const topbarDmInfoDiv = {
  minWidth: 0,
} as React.CSSProperties;

const topbarDmAvatar = {
  borderRadius: 10,
  background: 'rgba(212, 175, 55, 0.12)',
  border: '1px solid rgba(212, 175, 55, 0.2)',
} as React.CSSProperties;

const topbarDmName = {
  fontSize: 14,
  fontWeight: 600,
  color: V.text,
} as React.CSSProperties;

const topbarDmMeta = {
  fontSize: 11,
  color: V.textMuted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as React.CSSProperties;

const topbarHash = {
  color: V.textFaint,
  fontSize: 20,
  fontWeight: 600,
  opacity: 0.8,
} as React.CSSProperties;

const topbarChannelName = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  margin: 0,
} as React.CSSProperties;

const topbarDivider = {
  width: 1,
  height: 20,
  background: V.stroke,
} as React.CSSProperties;

const topbarTopic = {
  fontSize: 12,
  color: V.textMuted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as React.CSSProperties;

const topbarActions = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  flex: '1 1 auto',
  justifyContent: 'flex-end',
} as React.CSSProperties;

interface TopBarProps {
  channelId?: string;
}

export function TopBar({ channelId }: TopBarProps) {
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const toggleMemberPanel = useUiStore((s) => s.toggleMemberPanel);
  const togglePinnedPanel = useUiStore((s) => s.togglePinnedPanel);
  const toggleSearchPanel = useUiStore((s) => s.toggleSearchPanel);
  const toggleMobileGuildRail = useUiStore((s) => s.toggleMobileGuildRail);
  const toggleMobileChannelSidebar = useUiStore((s) => s.toggleMobileChannelSidebar);
  const openModal = useUiStore((s) => s.openModal);
  const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
  const channelLabel = channel?.name ?? (isDm ? 'Direct Message' : 'channel');
  const canInvite = Boolean(channel?.guildId);
  const showMembersToggle = Boolean(channel?.guildId);
  const toggleDmInfo = useUiStore((s) => s.toggleDmInfoPanel);
  const callStatus = useCallStore((s) => s.status);
  const callBusy = callStatus === 'connecting' || callStatus === 'connected';

  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const btn = (key: string) =>
    hoveredBtn === key ? topbarBtnHover : topbarBtnBase;

  const btnDisabled = {
    ...topbarBtnBase,
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties;

  return (
    <header style={topbarStyle}>
      <div style={topbarInfoStyle}>
        <div style={topbarMobileNav}>
          <button
            style={topbarBtnMobileNav}
            title="Open portals"
            onClick={toggleMobileGuildRail}
            onMouseEnter={() => setHoveredBtn('mobile-rail')}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 4v16M4 12h16" />
            </svg>
          </button>
          <button
            style={topbarBtnMobileNav}
            title="Open channels"
            onClick={toggleMobileChannelSidebar}
            onMouseEnter={() => setHoveredBtn('mobile-channels')}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
        {channel && (
          <>
            {isDm ? (
              <div style={topbarDmInfoStyle}>
                <Avatar name={channelLabel} size={28} style={topbarDmAvatar} />
                <div style={topbarDmInfoDiv}>
                  <div style={topbarDmName}>{channelLabel}</div>
                  <div style={topbarDmMeta}>Direct message</div>
                </div>
              </div>
            ) : (
              <>
                <span style={topbarHash}>#</span>
                <h1 style={topbarChannelName}>{channelLabel}</h1>
              </>
            )}
            {!isDm && channel.topic && (
              <>
                <span style={topbarDivider} />
                <span style={topbarTopic}>{channel.topic}</span>
              </>
            )}
          </>
        )}
      </div>
      <div style={topbarActions}>
        {isDm && (
          <>
            <button
              style={callBusy ? btnDisabled : btn('voice-call')}
              title="Start voice call"
              disabled={callBusy}
              onClick={() => channelId && startOutgoingCall(channelId, { video: false })}
              onMouseEnter={() => setHoveredBtn('voice-call')}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.73-1.73a2 2 0 0 1 2.11-.45c.75.24 1.54.42 2.35.54a2 2 0 0 1 1.72 2z" />
              </svg>
            </button>
            <button
              style={callBusy ? btnDisabled : btn('video-call')}
              title="Start video call"
              disabled={callBusy}
              onClick={() => channelId && startOutgoingCall(channelId, { video: true })}
              onMouseEnter={() => setHoveredBtn('video-call')}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </button>
            <button
              style={btn('dm-info')}
              title="User Info"
              onClick={toggleDmInfo}
              onMouseEnter={() => setHoveredBtn('dm-info')}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </>
        )}
        {canInvite && (
          <button
            style={btn('invite')}
            onClick={() => openModal('invite')}
            title="Create invite"
            onMouseEnter={() => setHoveredBtn('invite')}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        )}
        <button
          style={btn('search')}
          onClick={toggleSearchPanel}
          title="Search messages"
          onMouseEnter={() => setHoveredBtn('search')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button
          style={btn('bug-report')}
          onClick={() => openModal('bug-report', { route: window.location.pathname, channelLabel })}
          title="Report bug"
          aria-label="Report bug"
          onMouseEnter={() => setHoveredBtn('bug-report')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2h8" />
            <path d="M9 2v3.5l-2 2V11H5l-2 2 2 2h2v3.5l2 2V22h6v-1.5l2-2V15h2l2-2-2-2h-2V7.5l-2-2V2" />
            <circle cx="10" cy="10" r="1" />
            <circle cx="14" cy="14" r="1" />
          </svg>
        </button>
        {showMembersToggle && (
          <button
            style={btn('members')}
            onClick={toggleMemberPanel}
            title="Toggle member list"
            onMouseEnter={() => setHoveredBtn('members')}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>
        )}
        {!isDm && (
          <button
            style={btn('pinned')}
            onClick={togglePinnedPanel}
            title="Pinned messages"
            onMouseEnter={() => setHoveredBtn('pinned')}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
