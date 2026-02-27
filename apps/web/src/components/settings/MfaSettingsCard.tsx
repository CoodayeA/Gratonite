import React, { useEffect, useMemo, useState } from 'react';
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

const styles = {
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
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  fieldControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  inlineNote: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  authError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  authSuccess: {
    padding: '10px 14px',
    background: 'rgba(61, 214, 140, 0.09)',
    border: '1px solid rgba(61, 214, 140, 0.22)',
    borderRadius: 'var(--radius-md)',
    color: '#89f0bb',
    fontSize: 13,
  } as React.CSSProperties,
  setupCard: {
    marginTop: 12,
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 12,
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'auto 1fr',
    background: 'rgba(255, 255, 255, 0.02)',
  } as React.CSSProperties,
  setupQrWrap: {
    width: 220,
    maxWidth: '100%',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: '#fff',
    padding: 8,
  } as React.CSSProperties,
  setupQr: {
    display: 'block',
    width: '100%',
    height: 'auto',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  setupMeta: {
    display: 'grid',
    gap: 10,
    alignContent: 'start',
  } as React.CSSProperties,
  actionsGrid: {
    marginTop: 12,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  actionCard: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 12,
    background: 'rgba(255, 255, 255, 0.02)',
    display: 'grid',
    gap: 10,
    alignContent: 'start',
  } as React.CSSProperties,
  backupCodes: {
    marginTop: 12,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  backupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: 8,
  } as React.CSSProperties,
  backupCode: {
    display: 'inline-flex',
    justifyContent: 'center',
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(8, 12, 22, 0.42)',
    color: 'var(--text)',
    fontSize: 12,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
};

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
    <div style={styles.card}>
      <div style={styles.field}>
        <div style={styles.fieldLabel}>Two-Factor Authentication (MFA)</div>
        <div style={styles.fieldValue}>
          Protect your account with a one-time code from an authenticator app.
        </div>
      </div>

      {loadingStatus ? <div style={styles.inlineNote}>Loading MFA status...</div> : null}
      {error ? <div style={styles.authError}>{error}</div> : null}
      {success ? <div style={styles.authSuccess}>{success}</div> : null}

      {status && (
        <div style={styles.fieldGrid}>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Status</div>
            <div style={styles.fieldValue}>{status.enabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Backup Codes</div>
            <div style={styles.fieldValue}>{status.backupCodeCount}</div>
          </div>
        </div>
      )}

      {!status?.enabled && (
        <div style={styles.fieldRow}>
          <Button onClick={handleStartSetup} loading={setupLoading}>
            Start MFA Setup
          </Button>
        </div>
      )}

      {setup && !status?.enabled && (
        <div style={styles.setupCard}>
          <div style={styles.setupQrWrap}>
            <img src={setup.qrCodeDataUrl} alt="MFA QR code" style={styles.setupQr} />
          </div>
          <div style={styles.setupMeta}>
            <div style={styles.inlineNote}>
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
            <div style={styles.fieldRow}>
              <Button onClick={handleEnable} disabled={!validSetupCode}>
                Enable MFA
              </Button>
            </div>
          </div>
        </div>
      )}

      {status?.enabled && (
        <div style={styles.actionsGrid}>
          <div style={styles.actionCard}>
            <div style={styles.inlineNote}>Disable MFA (requires current 6-digit code)</div>
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

          <div style={styles.actionCard}>
            <div style={styles.inlineNote}>Regenerate backup codes (invalidates previous codes)</div>
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
        <div style={styles.backupCodes}>
          <div style={styles.fieldLabel}>Backup Codes (save these now)</div>
          <div style={styles.backupGrid}>
            {backupCodes.map((code) => (
              <code key={code} style={styles.backupCode}>
                {code}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
