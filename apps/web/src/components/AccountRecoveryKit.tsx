import { useState } from 'react';
import { Download, Printer, AlertTriangle, Shield, Key } from 'lucide-react';

interface AccountRecoveryKitProps {
  userId: string;
  username: string;
  email: string;
  recoveryCodes?: string[];
  backupEmail?: string;
}

export default function AccountRecoveryKit({ userId, username, email, recoveryCodes, backupEmail }: AccountRecoveryKitProps) {
  const [showCodes, setShowCodes] = useState(false);

  const buildRecoveryHtml = (): string => {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const sanitize = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeUserId = sanitize(userId);
    const safeUsername = sanitize(username);
    const safeEmail = sanitize(email);
    const safeBackup = backupEmail ? sanitize(backupEmail) : '';
    const safeCodes = recoveryCodes?.map(c => sanitize(c)) || [];
    return [
      '<!DOCTYPE html><html><head><title>Gratonite Recovery Kit</title>',
      '<style>body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a1a;max-width:600px;margin:0 auto}',
      'h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}',
      'h2{font-size:16px;margin-top:24px;color:#444}.field{margin:8px 0;font-size:14px}',
      '.label{font-weight:600;display:inline-block;width:120px}',
      '.codes{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
      '.code{font-family:monospace;font-size:14px;padding:6px 10px;border:1px solid #ccc;border-radius:4px}',
      '.warning{margin-top:24px;padding:12px;border:2px solid #ef4444;border-radius:6px;font-size:13px}',
      '.footer{margin-top:32px;font-size:12px;color:#888;border-top:1px solid #ddd;padding-top:12px}</style></head><body>',
      '<h1>Gratonite Account Recovery Kit</h1>',
      '<h2>Account Information</h2>',
      `<div class="field"><span class="label">Account ID:</span> ${safeUserId}</div>`,
      `<div class="field"><span class="label">Username:</span> ${safeUsername}</div>`,
      `<div class="field"><span class="label">Email:</span> ${safeEmail}</div>`,
      safeBackup ? `<div class="field"><span class="label">Backup Email:</span> ${safeBackup}</div>` : '',
      `<div class="field"><span class="label">Generated:</span> ${date}</div>`,
      safeCodes.length > 0 ? [
        '<h2>Recovery Codes</h2>',
        '<p style="font-size:13px;color:#666">Each code can only be used once.</p>',
        `<div class="codes">${safeCodes.map(c => `<div class="code">${c}</div>`).join('')}</div>`,
      ].join('') : '',
      '<div class="warning"><strong>Store this document in a safe place.</strong> Anyone with these codes can access your account.</div>',
      `<div class="footer">Gratonite Recovery Kit — Generated ${date}</div>`,
      '</body></html>',
    ].join('');
  };

  const handlePrint = () => {
    const content = buildRecoveryHtml();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.focus();
        printWindow.print();
      });
    }
    // Revoke after a delay to allow print dialog
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDownload = () => {
    const content = buildRecoveryHtml();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gratonite-recovery-kit-${username}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        }}>
          <Key size={18} color="white" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Account Recovery Kit</h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Download a backup of your account recovery information</p>
        </div>
      </div>

      <div style={{
        background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <AlertTriangle size={16} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
          Store this in a safe place. Anyone with your recovery codes can access your account.
        </span>
      </div>

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowCodes(!showCodes)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 14px', color: 'var(--text-primary)',
              cursor: 'pointer', fontSize: '13px', width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <Shield size={14} />
            {showCodes ? 'Hide Recovery Codes' : 'Show Recovery Codes'}
          </button>
          {showCodes && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
              marginTop: '8px', padding: '12px',
              background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
            }}>
              {recoveryCodes.map((code, i) => (
                <code key={i} style={{
                  padding: '6px 10px', borderRadius: '4px', fontSize: '13px',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                }}>{code}</code>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleDownload} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '10px', borderRadius: '8px', border: 'none',
          background: 'var(--accent-primary)', color: 'white', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          <Download size={16} /> Download as File
        </button>
        <button onClick={handlePrint} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          <Printer size={16} /> Print
        </button>
      </div>
    </div>
  );
}
