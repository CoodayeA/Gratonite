interface ModerationSectionProps {
  guildId: string;
}

export function ModerationSection({ guildId: _guildId }: ModerationSectionProps) {
  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Moderation</h2>
      <p className="server-settings-muted">
        Audit log and AutoMod settings are coming soon.
      </p>
      <div className="channel-permission-card">
        <div className="channel-permission-title">Coming Soon</div>
        <p className="server-settings-muted" style={{ marginTop: 8 }}>
          This section will include the audit log and automated moderation rules in a future update.
        </p>
      </div>
    </section>
  );
}
