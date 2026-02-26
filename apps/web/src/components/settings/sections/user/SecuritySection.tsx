import React from 'react';
import { MfaSettingsCard } from '@/components/settings/MfaSettingsCard';

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  card: {
    background: 'var(--bg-float)',
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 16,
        borderBottom: '1px solid var(--stroke)',
        marginBottom: 8,
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}>
          Security
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Manage two-factor authentication and account security settings.
        </p>
      </div>
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
