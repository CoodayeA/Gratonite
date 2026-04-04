/**
 * Setup.tsx — Full-page setup wizard for first-time self-hosted instances.
 * Shown when the instance is unconfigured. Non-technical friendly.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, User, Wifi, Check, ArrowRight, ArrowLeft, Server, Lock } from 'lucide-react';
import { api } from '../lib/api';

function getPasswordStrength(password: string): { label: string; color: string } | null {
  if (!password) return null;
  if (password.length >= 16) return { label: 'Strong', color: '#22c55e' };
  if (password.length >= 10) return { label: 'Fair', color: '#f59e0b' };
  return { label: 'Weak', color: '#ef4444' };
}

type Step = 'domain' | 'admin' | 'relay' | 'done';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('domain');
  const [domain, setDomain] = useState('');
  const [domainValid, setDomainValid] = useState<boolean | null>(null);
  const [domainTesting, setDomainTesting] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [enableFederation, setEnableFederation] = useState(true);
  const [enableRelay, setEnableRelay] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to app if setup is already complete
    fetch('/api/v1/setup/status')
      .then(r => r.json())
      .then((data: { configured: boolean }) => {
        if (data.configured) {
          navigate('/');
        }
      })
      .catch(() => {
        // If endpoint is unavailable, assume not configured yet
      });
  }, [navigate]);

  const testDomain = async () => {
    if (!domain) return;
    setDomainTesting(true);
    try {
      const resp = await api.post('/setup/test-domain', { domain });
      setDomainValid((resp as any).reachable);
    } catch {
      setDomainValid(false);
    }
    setDomainTesting(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/setup/init', {
        domain,
        adminEmail,
        adminPassword,
        adminUsername,
        enableFederation,
        enableRelay,
      });
      setResult(resp);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Setup failed');
    }
    setLoading(false);
  };

  const steps: { key: Step; label: string; icon: typeof Globe }[] = [
    { key: 'domain', label: 'Server', icon: Globe },
    { key: 'admin', label: 'Account', icon: User },
    { key: 'relay', label: 'Network', icon: Wifi },
    { key: 'done', label: 'Done', icon: Check },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    background: '#0f0f1a',
    border: '1px solid #2e2e3e',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
    color: 'var(--text-primary)',
  };

  const primaryBtnBase: React.CSSProperties = {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: '#6366f1',
    border: 'none',
    cursor: 'pointer',
  };

  const backBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#2e2e3e',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <div style={{ width: '100%', maxWidth: '512px', borderRadius: '16px', overflow: 'hidden', background: '#1e1e2e', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Progress */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2e2e3e' }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px 0',
              fontSize: '14px',
              fontWeight: 500,
              color: step === s.key ? '#818cf8' : '#64748b',
              borderBottom: step === s.key ? '2px solid #818cf8' : '2px solid transparent',
            }}>
              <s.icon size={16} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '32px' }}>
          {/* Step 1: Domain */}
          {step === 'domain' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <Server size={48} style={{ color: '#818cf8', margin: '0 auto 16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Welcome to Gratonite</h1>
                <p style={{ fontSize: '14px', marginTop: '8px', color: '#94a3b8' }}>Let's set up your server. What's your domain?</p>
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>Server Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={e => { setDomain(e.target.value); setDomainValid(null); }}
                  placeholder="chat.example.com"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <button onClick={testDomain} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, background: '#818cf820', color: '#818cf8', border: 'none', cursor: 'pointer' }}>
                    {domainTesting ? 'Testing...' : 'Test Domain'}
                  </button>
                  {domainValid !== null && (
                    <span style={{ fontSize: '14px', color: domainValid ? 'var(--success)' : '#facc15' }}>
                      {domainValid ? 'Reachable!' : 'Not reachable yet (you can continue)'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setStep('admin')}
                disabled={!domain}
                style={{ ...primaryBtnBase, width: '100%', opacity: domain ? 1 : 0.5 }}
                onMouseEnter={() => setHoveredBtn('next1')}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <Lock size={48} style={{ color: '#818cf8', margin: '0 auto 16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Admin Account</h1>
                <p style={{ fontSize: '14px', marginTop: '8px', color: '#94a3b8' }}>This will be the first user with full admin access.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="admin" style={inputStyle} />
                  {adminUsername.toLowerCase().includes('admin') && (
                    <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                      Tip: Consider a less predictable username for better security.
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
                  {(() => {
                    const strength = getPasswordStrength(adminPassword);
                    return strength ? (
                      <p style={{ fontSize: '12px', color: strength.color, marginTop: '4px' }}>
                        Password strength: {strength.label}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep('domain')} style={backBtnStyle}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button onClick={() => setStep('relay')} disabled={!adminEmail || adminPassword.length < 8} style={{ ...primaryBtnBase, opacity: adminEmail && adminPassword.length >= 8 ? 1 : 0.5 }}>
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Network */}
          {step === 'relay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <Wifi size={48} style={{ color: '#818cf8', margin: '0 auto 16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Connect to the Network</h1>
                <p style={{ fontSize: '14px', marginTop: '8px', color: '#94a3b8' }}>Choose how your server connects to other Gratonite servers.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', cursor: 'pointer', background: enableFederation ? '#818cf815' : '#0f0f1a', border: `1px solid ${enableFederation ? '#818cf850' : '#2e2e3e'}` }}>
                  <input type="checkbox" checked={enableFederation} onChange={e => setEnableFederation(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Enable Federation</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>Let users from other servers join your communities</p>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', cursor: 'pointer', background: enableRelay ? '#818cf815' : '#0f0f1a', border: `1px solid ${enableRelay ? '#818cf850' : '#2e2e3e'}` }}>
                  <input type="checkbox" checked={enableRelay} onChange={e => setEnableRelay(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Connect via Relay</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>Works even behind NAT — no port forwarding needed</p>
                  </div>
                </label>
              </div>
              {error && <p style={{ fontSize: '14px', color: 'var(--danger)' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setStep('admin')} style={backBtnStyle}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading} style={{ ...primaryBtnBase, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Setting up...' : 'Finish Setup'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: '#22c55e20' }}>
                <Check size={40} style={{ color: 'var(--success)' }} />
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>You're all set!</h1>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                Your Gratonite server is configured at <strong style={{ color: 'var(--text-primary)' }}>{domain}</strong>.
              </p>
              {result.federationAddress && (
                <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                  Federation address: <strong style={{ color: 'var(--text-primary)' }}>{result.federationAddress}</strong>
                </p>
              )}
              <div style={{ padding: '16px', borderRadius: '8px', textAlign: 'left', fontSize: '14px', background: '#0f0f1a', color: '#94a3b8' }}>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Next steps:</p>
                <ol style={{ listStyleType: 'decimal', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Set <code style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', background: '#2e2e3e' }}>INSTANCE_DOMAIN={domain}</code> in your environment</li>
                  {result.federationEnabled && <li>Set <code style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', background: '#2e2e3e' }}>FEDERATION_ENABLED=true</code></li>}
                  {result.relayEnabled && <li>Set <code style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', background: '#2e2e3e' }}>RELAY_ENABLED=true</code></li>}
                  <li>Restart the server</li>
                </ol>
              </div>
              <a href="/app" style={{ display: 'block', width: '100%', padding: '12px', borderRadius: '8px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', background: '#6366f1', textDecoration: 'none' }}>
                Go to App
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
