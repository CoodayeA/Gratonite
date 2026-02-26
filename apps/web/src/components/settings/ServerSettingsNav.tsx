import type { CSSProperties } from 'react';

interface ServerSettingsNavProps {
  activeSection: string;
  onSelect: (section: string) => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'roles', label: 'Roles' },
  { id: 'channels', label: 'Channels' },
  { id: 'members', label: 'Members' },
  { id: 'invites', label: 'Invites' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'automod', label: 'AutoMod' },
  { id: 'bots', label: 'Bots' },
  { id: 'wiki', label: 'Wiki' },
  { id: 'events', label: 'Events' },
  { id: 'scheduled-messages', label: 'Scheduled Messages' },
  { id: 'soundboard', label: 'Soundboard' },
  { id: 'emoji', label: 'Emoji' },
  { id: 'appearance', label: 'Appearance' },
] as const;

const styles = {
  groupLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#6e6a80',
    letterSpacing: '0.05em',
    padding: '12px 16px',
    fontWeight: 600,
  } as CSSProperties,
  navItem: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    fontSize: 14,
    color: '#a8a4b8',
    borderRadius: 6,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    lineHeight: 1.4,
  } as CSSProperties,
  navItemActive: {
    background: '#413d58',
    color: '#e8e4e0',
  } as CSSProperties,
  navItemDanger: {
    color: '#f04747',
  } as CSSProperties,
  divider: {
    height: 1,
    background: '#4a4660',
    margin: '8px 16px',
  } as CSSProperties,
};

export function ServerSettingsNav({ activeSection, onSelect }: ServerSettingsNavProps) {
  return (
    <nav>
      <div style={styles.groupLabel}>Server Settings</div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          style={{
            ...styles.navItem,
            ...(activeSection === item.id ? styles.navItemActive : {}),
          }}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}

      <div style={styles.divider} />

      <button
        type="button"
        style={{ ...styles.navItem, ...styles.navItemDanger }}
        id="delete-server"
        onClick={() => onSelect('delete-server')}
      >
        Delete Server
      </button>
    </nav>
  );
}
