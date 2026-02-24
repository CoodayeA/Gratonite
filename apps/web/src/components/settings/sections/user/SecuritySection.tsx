import { MfaSettingsCard } from '@/components/settings/MfaSettingsCard';

export function SecuritySection() {
  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Security</h2>
      <MfaSettingsCard />
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Email Verification</div>
          <div className="settings-field-value">
            Email verification is enabled for new account rollout flows. Existing beta accounts may
            continue to sign in while migration completes.
          </div>
        </div>
      </div>
    </section>
  );
}
