import PrivacyScoreWidget from '../../PrivacyScore';
import AccountRecoveryKitWidget from '../../AccountRecoveryKit';
import DataExportWidget from '../../../pages/app/DataExport';
import type { SettingsTabProps, UserProfileLike } from './types';

// PrivacyToggle — self-contained toggle with localStorage + API sync
import { useState } from 'react';
import { api } from '../../../lib/api';

const PrivacyToggle = ({
  label,
  description,
  storageKey,
  defaultValue,
  onChange,
}: {
  label: string;
  description: string;
  storageKey: string;
  defaultValue: boolean;
  onChange?: (val: boolean) => void;
}) => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultValue;
  });

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* no-op */ }
    api.users.updateSettings({ [storageKey]: next }).catch(() => { /* no-op */ });
    onChange?.(next);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{description}</div>
      </div>
      <div
        onClick={toggle}
        style={{
          width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
          background: enabled ? 'var(--accent-primary)' : 'var(--bg-elevated)',
          border: `1px solid ${enabled ? 'transparent' : 'var(--stroke)'}`,
          position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
        }}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%', background: 'white',
          position: 'absolute', top: '2px', left: enabled ? '22px' : '2px',
          transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  );
};

interface Props extends SettingsTabProps {
  userProfile?: UserProfileLike;
  onNavigateTab: (tab: string) => void;
}

const SettingsPrivacyTab = ({ userProfile, onNavigateTab }: Props) => {
  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Privacy &amp; Safety</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Control who can contact you and how messages are filtered.</p>

      {/* Privacy & Safety Quick Links */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Quick Links</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <button
            onClick={() => onNavigateTab('muted-users')}
            style={{
              width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 500, textAlign: 'left',
            }}
          >
            <span>View Blocked &amp; Muted Users</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Manage who you&apos;ve muted or blocked</span>
          </button>
          <div style={{ height: '1px', background: 'var(--stroke)' }} />
          <button
            onClick={() => {
              const el = document.getElementById('data-export-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 500, textAlign: 'left',
            }}
          >
            <span>Export Your Data</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Download a copy of your account data</span>
          </button>
          <div style={{ height: '1px', background: 'var(--stroke)' }} />
          <button
            onClick={() => {
              const el = document.getElementById('dm-privacy-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 500, textAlign: 'left',
            }}
          >
            <span>Direct Message Privacy</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Control who can send you DMs</span>
          </button>
        </div>
      </div>

      <div id="dm-privacy-section" style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Direct Messages</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle label="Filter message requests" description="Automatically filter DMs from people you don't know into Message Requests. Suspected spam will be moved to a separate Spam folder." storageKey="privacy-filter-message-requests" defaultValue={true} />
          <div style={{ height: '1px', background: 'var(--stroke)' }} />
          <PrivacyToggle label="Allow DMs from server members" description="Allow direct messages from people in your shared servers. When disabled, only friends can DM you directly." storageKey="privacy-allow-server-dms" defaultValue={true} />
          <div style={{ height: '1px', background: 'var(--stroke)' }} />
          <PrivacyToggle label="Allow DMs from everyone" description="When enabled, anyone on Gratonite can send you a direct message. When disabled, only friends and server members (if allowed above) can message you." storageKey="privacy-allow-all-dms" defaultValue={false} />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Server Privacy Defaults</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle label="Allow DMs from new server members" description="When you join a new server, allow members of that server to send you direct messages. You can override this per-server in server settings." storageKey="privacy-new-server-dms" defaultValue={true} />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Profile Visitors</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle label="Allow others to see when I view profiles" description="When enabled, your visits will appear in other users' profile visitors list." storageKey="privacy-profile-visitors" defaultValue={false} />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Streamer Mode</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle
            label="Enable Streamer Mode"
            description="Hides sensitive information like email addresses, invite links, and personal details behind a blur. Hover to reveal."
            storageKey="gratonite:streamer-mode"
            defaultValue={false}
            onChange={(val) => {
              if (val) document.body.classList.add('streamer-mode');
              else document.body.classList.remove('streamer-mode');
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Read Receipts</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle label="Show Read Receipts" description="Allow others to see when you've read their messages. When disabled, your read status won't be shared with other users." storageKey="gratonite:show-read-receipts" defaultValue={false} />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Safe Messaging</h3>
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
          <PrivacyToggle label="Scan messages from everyone" description="Automatically scan and filter direct messages from all users for explicit or harmful content." storageKey="privacy-scan-all-messages" defaultValue={true} />
          <div style={{ height: '1px', background: 'var(--stroke)' }} />
          <PrivacyToggle label="Block suspicious links" description="Automatically detect and block messages containing known phishing or malicious links." storageKey="privacy-block-suspicious-links" defaultValue={true} />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Privacy Score</h3>
        <PrivacyScoreWidget userSettings={{}} userProfile={userProfile} onNavigate={(tab: string) => onNavigateTab(tab)} />
      </div>

      <div id="data-export-section" style={{ marginBottom: '32px' }}>
        <DataExportWidget />
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Account Recovery</h3>
        <AccountRecoveryKitWidget userId={userProfile?.id || ''} username={userProfile?.username || ''} email={userProfile?.email || ''} />
      </div>
    </>
  );
};

export default SettingsPrivacyTab;
