import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

interface MfaStatus {
  enabled: boolean;
  pendingSetup: boolean;
  backupCodeCount: number;
}

const CODE_RE = /^\d{6}$/;

export function MfaSettingsCard() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [setupLoading, setSetupLoading] = useState(false);
  const [setup, setSetup] = useState<null | {
    secret: string;
    qrCodeDataUrl: string;
    expiresInSeconds: number;
  }>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const validSetupCode = useMemo(() => CODE_RE.test(setupCode), [setupCode]);
  const validDisableCode = useMemo(() => CODE_RE.test(disableCode), [disableCode]);
  const validRegenCode = useMemo(() => CODE_RE.test(regenCode), [regenCode]);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      setStatus(await api.auth.getMfaStatus());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleStartSetup() {
    setError('');
    setSuccess('');
    setBackupCodes(null);
    setSetupLoading(true);
    try {
      const res = await api.auth.startMfaSetup();
      setSetup({
        secret: res.secret,
        qrCodeDataUrl: res.qrCodeDataUrl,
        expiresInSeconds: res.expiresInSeconds,
      });
      setSuccess('Scan the QR code in your authenticator app, then enter the 6-digit code to enable MFA.');
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleEnable() {
    if (!validSetupCode) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.auth.enableMfa(setupCode);
      setBackupCodes(res.backupCodes);
      setSetup(null);
      setSetupCode('');
      setSuccess('Two-factor authentication enabled. Save your backup codes somewhere safe.');
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDisable() {
    if (!validDisableCode) return;
    setError('');
    setSuccess('');
    try {
      await api.auth.disableMfa(disableCode);
      setDisableCode('');
      setBackupCodes(null);
      setSetup(null);
      setSuccess('Two-factor authentication disabled.');
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleRegenerateBackupCodes() {
    if (!validRegenCode) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.auth.regenerateMfaBackupCodes(regenCode);
      setBackupCodes(res.backupCodes);
      setRegenCode('');
      setSuccess('Backup codes regenerated. Your old backup codes no longer work.');
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-field">
        <div className="settings-field-label">Two-Factor Authentication (MFA)</div>
        <div className="settings-field-value">
          Protect your account with a one-time code from an authenticator app.
        </div>
      </div>

      {loadingStatus ? <div className="settings-inline-note">Loading MFA status...</div> : null}
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? <div className="auth-success">{success}</div> : null}

      {status && (
        <div className="settings-field-grid">
          <div className="settings-field">
            <div className="settings-field-label">Status</div>
            <div className="settings-field-value">{status.enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div className="settings-field">
            <div className="settings-field-label">Backup Codes</div>
            <div className="settings-field-value">{status.backupCodeCount}</div>
          </div>
        </div>
      )}

      {!status?.enabled && (
        <div className="settings-field-control settings-field-row">
          <Button onClick={handleStartSetup} loading={setupLoading}>
            Start MFA Setup
          </Button>
        </div>
      )}

      {setup && !status?.enabled && (
        <div className="mfa-setup-card">
          <div className="mfa-setup-qr-wrap">
            <img src={setup.qrCodeDataUrl} alt="MFA QR code" className="mfa-setup-qr" />
          </div>
          <div className="mfa-setup-meta">
            <div className="settings-inline-note">
              Expires in about {Math.floor(setup.expiresInSeconds / 60)} minutes.
            </div>
            <Input label="Manual Key" type="text" value={setup.secret} readOnly />
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              hint="Enter the code from your authenticator app to enable MFA."
            />
            <div className="settings-field-control settings-field-row">
              <Button onClick={handleEnable} disabled={!validSetupCode}>
                Enable MFA
              </Button>
            </div>
          </div>
        </div>
      )}

      {status?.enabled && (
        <div className="mfa-actions-grid">
          <div className="mfa-action-card">
            <div className="settings-inline-note">Disable MFA (requires current 6-digit code)</div>
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button variant="danger" onClick={handleDisable} disabled={!validDisableCode}>
              Disable MFA
            </Button>
          </div>

          <div className="mfa-action-card">
            <div className="settings-inline-note">Regenerate backup codes (invalidates previous codes)</div>
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              value={regenCode}
              onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button variant="ghost" onClick={handleRegenerateBackupCodes} disabled={!validRegenCode}>
              Regenerate Backup Codes
            </Button>
          </div>
        </div>
      )}

      {backupCodes && backupCodes.length > 0 && (
        <div className="mfa-backup-codes">
          <div className="settings-field-label">Backup Codes (save these now)</div>
          <div className="mfa-backup-grid">
            {backupCodes.map((code) => (
              <code key={code} className="mfa-backup-code">
                {code}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
