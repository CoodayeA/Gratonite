import { useUiStore } from '../../stores/ui.store';
import { Avatar } from '../ui/Avatar';

interface DmRecipient {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  bio?: string | null;
}

export function DmInfoPanel({ recipient }: { recipient: DmRecipient | null }) {
  const open = useUiStore((s) => s.dmInfoPanelOpen);
  if (!open || !recipient) return null;

  return (
    <aside className="dm-info-panel">
      <div className="dm-info-header">
        <Avatar
          name={recipient.displayName}
          hash={recipient.avatarHash}
          userId={recipient.id}
          size={80}
        />
        <h3>{recipient.displayName}</h3>
        <span className="dm-info-username">@{recipient.username}</span>
      </div>
      {recipient.bio && (
        <div className="dm-info-section">
          <h4>About Me</h4>
          <p>{recipient.bio}</p>
        </div>
      )}
    </aside>
  );
}
