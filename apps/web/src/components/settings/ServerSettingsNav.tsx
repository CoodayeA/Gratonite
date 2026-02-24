interface ServerSettingsNavProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'roles', label: 'Roles' },
  { id: 'channels', label: 'Channels' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'invites', label: 'Invites' },
  { id: 'moderation', label: 'Moderation' },
] as const;

export function ServerSettingsNav({ activeSection, onSelect }: ServerSettingsNavProps) {
  return (
    <nav>
      <div className="settings-shell-group-label">Server Settings</div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`settings-shell-nav-item${activeSection === item.id ? ' active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}

      <div className="settings-shell-divider" />

      <button
        type="button"
        className="settings-shell-nav-item danger"
        id="delete-server"
        onClick={() => onSelect('delete-server')}
      >
        Delete Server
      </button>
    </nav>
  );
}
