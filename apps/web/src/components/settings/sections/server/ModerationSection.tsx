import React from 'react';

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  } as React.CSSProperties,
  muted: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  permissionCard: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: 10,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  permissionTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
};

interface ModerationSectionProps {
  guildId: string;
}

export function ModerationSection({ guildId: _guildId }: ModerationSectionProps) {
  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>Moderation</h2>
      <p style={styles.muted}>
        Audit log and AutoMod settings are coming soon.
      </p>
      <div style={styles.permissionCard}>
        <div style={styles.permissionTitle}>Coming Soon</div>
        <p style={{ ...styles.muted, marginTop: 8 }}>
          This section will include the audit log and automated moderation rules in a future update.
        </p>
      </div>
    </section>
  );
}
