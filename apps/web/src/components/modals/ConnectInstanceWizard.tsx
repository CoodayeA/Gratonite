/**
 * ConnectInstanceWizard — 3-step modal for federating with a remote Gratonite instance.
 * Step 1: Enter instance URL
 * Step 2: Preview /.well-known/gratonite response
 * Step 3: Confirm and send federation handshake
 */
import { useState } from 'react';
import { Globe, ChevronRight, Check, X, AlertCircle, Loader2, Server } from 'lucide-react';
import { api } from '../../lib/api';

type Step = 1 | 2 | 3;

interface WellKnownPreview {
  host: string;
  wellKnown: {
    name?: string;
    domain?: string;
    version?: string;
    trustLevel?: string;
    description?: string;
    adminContact?: string;
    federationEnabled?: boolean;
    [key: string]: unknown;
  };
}

interface Props {
  onClose: () => void;
  onConnected?: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modal: React.CSSProperties = {
  background: 'var(--bg-primary, #0f0f1a)',
  border: '1px solid var(--stroke, #2a2a3e)',
  borderRadius: '16px',
  width: '480px',
  maxWidth: 'calc(100vw - 32px)',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid var(--stroke, #2a2a3e)',
  background: 'var(--bg-secondary, #1a1a2e)',
  color: 'var(--text-primary, #e2e8f0)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const Btn = ({ onClick, disabled, variant = 'primary', children }: {
  onClick: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      border: variant === 'ghost' ? '1px solid var(--stroke, #2a2a3e)' : 'none',
      background: variant === 'primary' ? 'var(--brand, #5865f2)' : 'transparent',
      color: 'var(--text-primary, #e2e8f0)',
      transition: 'opacity 0.15s',
    }}
  >
    {children}
  </button>
);

const StepIndicator = ({ current }: { current: Step }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
    {([1, 2, 3] as Step[]).map((s, i) => (
      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700,
          background: s < current ? '#10b981' : s === current ? 'var(--brand, #5865f2)' : 'var(--bg-tertiary, #252540)',
          color: s <= current ? '#fff' : 'var(--text-muted)',
          border: s === current ? '2px solid rgba(88,101,242,0.5)' : 'none',
        }}>
          {s < current ? <Check size={14} /> : s}
        </div>
        {i < 2 && <div style={{ width: '32px', height: '2px', background: s < current ? '#10b981' : 'var(--stroke, #2a2a3e)' }} />}
      </div>
    ))}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--stroke, #2a2a3e)' }}>
    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{value ?? '—'}</span>
  </div>
);

export default function ConnectInstanceWizard({ onClose, onConnected }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WellKnownPreview | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchPreview = async () => {
    if (!instanceUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const host = instanceUrl.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
      const result = await api.get(`/federation/well-known-preview?host=${encodeURIComponent(host)}`) as WellKnownPreview;
      setPreview(result);
      setStep(2);
    } catch (err: any) {
      setError(err?.message ?? 'Could not reach that instance. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendHandshake = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/federation/handshake', { instanceUrl: `https://${preview.host}` });
      setSuccess(true);
      setStep(3);
      onConnected?.();
    } catch (err: any) {
      setError(err?.message ?? 'Handshake failed. The remote instance may have rejected the request.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    1: 'Enter instance URL',
    2: 'Preview & verify',
    3: 'Done',
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal} role="dialog" aria-modal="true" aria-label="Connect remote instance">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(88,101,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} color="var(--brand, #5865f2)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Connect Instance</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{stepLabels[step]}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <StepIndicator current={step} />

        {/* Step 1 — enter URL */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter the domain of the remote Gratonite instance you want to federate with.
              We'll verify it supports federation before sending a handshake.
            </p>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Instance domain or URL
              </label>
              <input
                type="text"
                placeholder="example.social"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchPreview(); }}
                style={fieldStyle}
                autoFocus
              />
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle size={14} color="#ef4444" style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Btn onClick={onClose} variant="ghost">Cancel</Btn>
              <Btn onClick={fetchPreview} disabled={!instanceUrl.trim() || loading}>
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} /> : null}
                {loading ? ' Checking…' : 'Preview'} <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </Btn>
            </div>
          </div>
        )}

        {/* Step 2 — preview */}
        {step === 2 && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '10px', background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--stroke, #2a2a3e)' }}>
              <Server size={18} color="var(--text-muted)" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{preview.wellKnown.name ?? preview.host}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{preview.host}</div>
              </div>
            </div>
            <div>
              <InfoRow label="Software version" value={preview.wellKnown.version} />
              <InfoRow label="Federation" value={preview.wellKnown.federationEnabled !== false ? '✅ Enabled' : '❌ Disabled'} />
              <InfoRow label="Trust level" value={preview.wellKnown.trustLevel} />
              {preview.wellKnown.description && (
                <InfoRow label="Description" value={<span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{String(preview.wellKnown.description)}</span>} />
              )}
              {preview.wellKnown.adminContact && <InfoRow label="Admin contact" value={String(preview.wellKnown.adminContact)} />}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Connecting will send a signed handshake request. The remote instance admin must approve federation before users can interact across instances.
            </p>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle size={14} color="#ef4444" style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <Btn onClick={() => { setStep(1); setError(null); }} variant="ghost">← Back</Btn>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn onClick={onClose} variant="ghost">Cancel</Btn>
                <Btn onClick={sendHandshake} disabled={loading || preview.wellKnown.federationEnabled === false}>
                  {loading ? 'Connecting…' : 'Send Handshake'}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — success */}
        {step === 3 && success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={28} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Handshake sent!</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                A federation request was sent to <strong>{preview?.host}</strong>.
                The instance will appear in your connected instances once the remote admin approves it.
              </p>
            </div>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
