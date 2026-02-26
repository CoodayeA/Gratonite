import React from 'react';
import { MfaSettingsCard } from '@/components/settings/MfaSettingsCard';

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
  card: {
    background: 'rgba(8, 12, 20, 0.6)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fieldValue: {
    fontSize: 14,
    color: 'var(--text)',
  } as React.CSSProperties,
};

export function SecuritySection() {
  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>Security</h2>
      <MfaSettingsCard />
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Email Verification</div>
          <div style={styles.fieldValue}>
            Email verification is enabled for new account rollout flows. Existing beta accounts may
            continue to sign in while migration completes.
          </div>
        </div>
      </div>
    </section>
  );
}
