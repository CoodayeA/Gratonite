import { useChannelsStore } from '@/stores/channels.store';
import { useUiStore } from '@/stores/ui.store';
import { Avatar } from '@/components/ui/Avatar';
import { startOutgoingCall } from '@/lib/dmCall';
import { useCallStore } from '@/stores/call.store';

interface TopBarProps {
  channelId?: string;
}

export function TopBar({ channelId }: TopBarProps) {
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const toggleMemberPanel = useUiStore((s) => s.toggleMemberPanel);
  const togglePinnedPanel = useUiStore((s) => s.togglePinnedPanel);
  const toggleSearchPanel = useUiStore((s) => s.toggleSearchPanel);
  const openModal = useUiStore((s) => s.openModal);
  const isDm = channel?.type === 'DM' || channel?.type === 'GROUP_DM';
  const channelLabel = channel?.name ?? (isDm ? 'Direct Message' : 'channel');
  const canInvite = Boolean(channel?.guildId);
  const showMembersToggle = Boolean(channel?.guildId);
  const toggleDmInfo = useUiStore((s) => s.toggleDmInfoPanel);
  const callStatus = useCallStore((s) => s.status);
  const callBusy = callStatus === 'connecting' || callStatus === 'connected';

  return (
    <header className={`topbar ${isDm ? 'topbar-dm' : ''}`}>
      <div className="topbar-info">
        {channel && (
          <>
            {isDm ? (
              <div className="topbar-dm-info">
                <Avatar name={channelLabel} size={28} className="topbar-dm-avatar" />
                <div>
                  <div className="topbar-dm-name">{channelLabel}</div>
                  <div className="topbar-dm-meta">Direct message</div>
                </div>
              </div>
            ) : (
              <>
                <span className="topbar-hash">#</span>
                <h1 className="topbar-channel-name">{channelLabel}</h1>
              </>
            )}
            {!isDm && channel.topic && (
              <>
                <span className="topbar-divider" />
                <span className="topbar-topic">{channel.topic}</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="topbar-actions">
        {isDm && (
          <>
            <button
              className="topbar-btn"
              title="Start voice call"
              disabled={callBusy}
              onClick={() => channelId && startOutgoingCall(channelId, { video: false })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.3 1.6.54 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.73-1.73a2 2 0 0 1 2.11-.45c.75.24 1.54.42 2.35.54a2 2 0 0 1 1.72 2z" />
              </svg>
            </button>
            <button
              className="topbar-btn"
              title="Start video call"
              disabled={callBusy}
              onClick={() => channelId && startOutgoingCall(channelId, { video: true })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </button>
            <button className="topbar-btn" title="User Info" onClick={toggleDmInfo}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </>
        )}
        {canInvite && (
          <button className="topbar-btn" onClick={() => openModal('invite')} title="Create invite">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        )}
        <button className="topbar-btn" onClick={toggleSearchPanel} title="Search messages">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        {showMembersToggle && (
          <button className="topbar-btn" onClick={toggleMemberPanel} title="Toggle member list">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>
        )}
        {!isDm && (
          <button className="topbar-btn" onClick={togglePinnedPanel} title="Pinned messages">
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
