import React, { useMemo, useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  DEFAULT_DISPLAY_NAME_PREFS,
  readDisplayNameStylePrefs,
  saveDisplayNameStylePrefs,
  subscribeDisplayNameStyleChanges,
} from '@/lib/displayNameStyles';

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
  fieldControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  toggle: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  } as React.CSSProperties,
  toggleInput: {
    display: 'none',
  } as React.CSSProperties,
  toggleIndicator: {
    width: 38,
    height: 20,
    borderRadius: 'var(--radius-pill)',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid var(--stroke)',
    position: 'relative',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  } as React.CSSProperties,
  toggleIndicatorChecked: {
    width: 38,
    height: 20,
    borderRadius: 'var(--radius-pill)',
    background: 'rgba(212, 175, 55, 0.35)',
    border: '1px solid rgba(212, 175, 55, 0.5)',
    position: 'relative',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  } as React.CSSProperties,
  rangeValue: {
    fontSize: 12,
    color: 'var(--text-muted)',
    minWidth: 48,
  } as React.CSSProperties,
};

export function AccessibilitySection() {
  const user = useAuthStore((s) => s.user);
  const [styleVersion, setStyleVersion] = useState(0);

  useEffect(() => subscribeDisplayNameStyleChanges(() => setStyleVersion((v) => v + 1)), []);

  const stylePrefs = useMemo(
    () => (user ? readDisplayNameStylePrefs(user.id) : DEFAULT_DISPLAY_NAME_PREFS),
    [user, styleVersion],
  );

  function toggleDisplayNameStyles(enabled: boolean) {
    if (!user) return;
    saveDisplayNameStylePrefs(user.id, {
      ...stylePrefs,
      stylesEnabled: enabled,
    });
  }

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
          Accessibility
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Adjust display preferences to improve readability and reduce visual complexity.
        </p>
      </div>
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Display Name Styles</div>
          <div style={styles.fieldControl}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={stylePrefs.stylesEnabled}
                onChange={(event) => toggleDisplayNameStyles(event.target.checked)}
              />
              <span style={stylePrefs.stylesEnabled ? styles.toggleIndicatorChecked : styles.toggleIndicator} className="settings-toggle-indicator" />
            </label>
            <span style={styles.rangeValue}>
              {stylePrefs.stylesEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
