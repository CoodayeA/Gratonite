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
  card: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: 10,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
};

interface WikiSectionProps {
  guildId: string;
}

export function WikiSection({ guildId: _guildId }: WikiSectionProps) {
  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>Wiki</h2>
      <p style={styles.muted}>
        Server knowledge base settings and permissions are coming soon.
      </p>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Coming Soon</div>
        <p style={{ ...styles.muted, marginTop: 8 }}>
          This section will let you manage wiki pages, contributors, and visibility settings
          in a future update.
        </p>
      </div>
    </section>
  );
}
