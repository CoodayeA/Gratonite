import { useChannelsStore } from '@/stores/channels.store';
import { useUiStore } from '@/stores/ui.store';

interface TopBarProps {
  channelId?: string;
}

export function TopBar({ channelId }: TopBarProps) {
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const toggleMemberPanel = useUiStore((s) => s.toggleMemberPanel);
  const openModal = useUiStore((s) => s.openModal);

  return (
    <header className="topbar">
      <div className="topbar-info">
        {channel && (
          <>
            <span className="topbar-hash">#</span>
            <h1 className="topbar-channel-name">{channel.name}</h1>
            {channel.topic && (
              <>
                <span className="topbar-divider" />
                <span className="topbar-topic">{channel.topic}</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="topbar-actions">
        <button className="topbar-btn" onClick={() => openModal('invite')} title="Create invite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <button className="topbar-btn" onClick={toggleMemberPanel} title="Toggle member list">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
