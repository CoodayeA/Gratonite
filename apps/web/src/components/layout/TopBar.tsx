import { useChannelsStore } from '@/stores/channels.store';
import { useUiStore } from '@/stores/ui.store';

interface TopBarProps {
  channelId?: string;
}

export function TopBar({ channelId }: TopBarProps) {
  const channel = useChannelsStore((s) => channelId ? s.channels.get(channelId) : undefined);
  const toggleMemberPanel = useUiStore((s) => s.toggleMemberPanel);

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
        <button className="topbar-btn" onClick={toggleMemberPanel} title="Toggle member list">
          👥
        </button>
      </div>
    </header>
  );
}
