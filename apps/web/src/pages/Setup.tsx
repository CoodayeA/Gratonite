/**
 * Setup.tsx — Full-page setup wizard for first-time self-hosted instances.
 * Shown when the instance is unconfigured. Non-technical friendly.
 */

import { useState, useEffect } from 'react';
import { Globe, User, Wifi, Check, ArrowRight, ArrowLeft, Server, Lock } from 'lucide-react';
import { api } from '../lib/api';

type Step = 'domain' | 'admin' | 'relay' | 'done';

export default function Setup() {
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#1e1e2e', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        {/* Progress */}
        <div className="flex border-b" style={{ borderColor: '#2e2e3e' }}>
          {steps.map((s, i) => (
            <div key={s.key} className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium ${step === s.key ? 'border-b-2' : ''}`}
              style={{ color: step === s.key ? '#818cf8' : '#64748b', borderColor: '#818cf8' }}>
              <s.icon size={16} />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="p-8">
          {/* Step 1: Domain */}
          {step === 'domain' && (
            <div className="space-y-6">
              <div className="text-center">
                <Server size={48} className="mx-auto mb-4" style={{ color: '#818cf8' }} />
                <h1 className="text-2xl font-bold text-white">Welcome to Gratonite</h1>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>Let's set up your server. What's your domain?</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Server Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={e => { setDomain(e.target.value); setDomainValid(null); }}
                  placeholder="chat.example.com"
                  className="w-full p-3 rounded-lg text-white text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2e2e3e' }}
                />
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={testDomain} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#818cf820', color: '#818cf8' }}>
                    {domainTesting ? 'Testing...' : 'Test Domain'}
                  </button>
                  {domainValid !== null && (
                    <span className={`text-sm ${domainValid ? 'text-green-400' : 'text-yellow-400'}`}>
                      {domainValid ? 'Reachable!' : 'Not reachable yet (you can continue)'}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setStep('admin')} disabled={!domain} className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#6366f1', opacity: domain ? 1 : 0.5 }}>
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 'admin' && (
            <div className="space-y-6">
              <div className="text-center">
                <Lock size={48} className="mx-auto mb-4" style={{ color: '#818cf8' }} />
                <h1 className="text-2xl font-bold text-white">Create Admin Account</h1>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>This will be the first user with full admin access.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-white">Username</label>
                  <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="admin" className="w-full p-3 rounded-lg text-white text-sm" style={{ background: '#0f0f1a', border: '1px solid #2e2e3e' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white">Email</label>
                  <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="w-full p-3 rounded-lg text-white text-sm" style={{ background: '#0f0f1a', border: '1px solid #2e2e3e' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white">Password</label>
                  <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="At least 8 characters" className="w-full p-3 rounded-lg text-white text-sm" style={{ background: '#0f0f1a', border: '1px solid #2e2e3e' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('domain')} className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2" style={{ background: '#2e2e3e', color: '#94a3b8' }}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button onClick={() => setStep('relay')} disabled={!adminEmail || adminPassword.length < 8} className="flex-1 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#6366f1', opacity: adminEmail && adminPassword.length >= 8 ? 1 : 0.5 }}>
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Network */}
          {step === 'relay' && (
            <div className="space-y-6">
              <div className="text-center">
                <Wifi size={48} className="mx-auto mb-4" style={{ color: '#818cf8' }} />
                <h1 className="text-2xl font-bold text-white">Connect to the Network</h1>
                <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>Choose how your server connects to other Gratonite servers.</p>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 rounded-lg cursor-pointer" style={{ background: enableFederation ? '#818cf815' : '#0f0f1a', border: `1px solid ${enableFederation ? '#818cf850' : '#2e2e3e'}` }}>
                  <input type="checkbox" checked={enableFederation} onChange={e => setEnableFederation(e.target.checked)} className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium text-white">Enable Federation</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>Let users from other servers join your communities</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 rounded-lg cursor-pointer" style={{ background: enableRelay ? '#818cf815' : '#0f0f1a', border: `1px solid ${enableRelay ? '#818cf850' : '#2e2e3e'}` }}>
                  <input type="checkbox" checked={enableRelay} onChange={e => setEnableRelay(e.target.checked)} className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-medium text-white">Connect via Relay</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>Works even behind NAT — no port forwarding needed</p>
                  </div>
                </label>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep('admin')} className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2" style={{ background: '#2e2e3e', color: '#94a3b8' }}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#6366f1', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Setting up...' : 'Finish Setup'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#22c55e20' }}>
                <Check size={40} className="text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">You're all set!</h1>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                Your Gratonite server is configured at <strong className="text-white">{domain}</strong>.
              </p>
              {result.federationAddress && (
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  Federation address: <strong className="text-white">{result.federationAddress}</strong>
                </p>
              )}
              <div className="p-4 rounded-lg text-left text-sm" style={{ background: '#0f0f1a', color: '#94a3b8' }}>
                <p className="font-medium text-white mb-2">Next steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Set <code className="text-xs px-1 py-0.5 rounded" style={{ background: '#2e2e3e' }}>INSTANCE_DOMAIN={domain}</code> in your environment</li>
                  {result.federationEnabled && <li>Set <code className="text-xs px-1 py-0.5 rounded" style={{ background: '#2e2e3e' }}>FEDERATION_ENABLED=true</code></li>}
                  {result.relayEnabled && <li>Set <code className="text-xs px-1 py-0.5 rounded" style={{ background: '#2e2e3e' }}>RELAY_ENABLED=true</code></li>}
                  <li>Restart the server</li>
                </ol>
              </div>
              <a href="/app" className="block w-full py-3 rounded-lg font-semibold text-white text-center" style={{ background: '#6366f1' }}>
                Go to App
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
