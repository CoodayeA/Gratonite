interface UserSettingsNavProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

const NAV_ITEMS = [
  { id: 'account', label: 'My Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'earn', label: 'Earn Gratonites' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'accessibility', label: 'Accessibility' },
] as const;

export function UserSettingsNav({ activeSection, onSelect }: UserSettingsNavProps) {
  return (
    <nav>
      <div className="settings-shell-group-label">User Settings</div>

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
        id="logout"
        onClick={() => onSelect('logout')}
      >
        Log Out
      </button>
    </nav>
  );
}
