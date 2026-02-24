import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  DEFAULT_DISPLAY_NAME_PREFS,
  readDisplayNameStylePrefs,
  saveDisplayNameStylePrefs,
  subscribeDisplayNameStyleChanges,
} from '@/lib/displayNameStyles';

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
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Accessibility</h2>
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Display Name Styles</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={stylePrefs.stylesEnabled}
                onChange={(event) => toggleDisplayNameStyles(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">
              {stylePrefs.stylesEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
