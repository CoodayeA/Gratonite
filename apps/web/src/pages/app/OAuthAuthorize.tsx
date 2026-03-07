import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'identify': 'Access your username and avatar',
  'email': 'Access your email address',
  'guilds': 'View your guilds',
  'guilds.join': 'Join guilds on your behalf',
  'messages.read': 'Read messages in your channels',
  'messages.write': 'Send messages on your behalf',
};

interface AppInfo {
  id: string;
  name: string;
  description: string | null;
  iconHash: string | null;
  scopes: string[];
}

export default function OAuthAuthorize() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') || '';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const scope = searchParams.get('scope') || '';
  const state = searchParams.get('state') || '';

  const [app, setApp] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) { setError('Missing client_id'); setLoading(false); return; }
    api.get<AppInfo>(`/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`)
      .then(data => { setApp(data); setLoading(false); })
      .catch(() => { setError('Application not found'); setLoading(false); });
  }, [clientId, scope]);

  const handleAuthorize = async (approved: boolean) => {
    setSubmitting(true);
    try {
      const result = await api.post<{ code?: string; redirectUri: string; state?: string }>('/oauth/authorize', {
        clientId, redirectUri, scope, state, approved,
      });
      if (result.redirectUri) {
        const url = approved && result.code
          ? `${redirectUri}?code=${result.code}&state=${encodeURIComponent(state)}`
          : result.redirectUri;
        window.location.href = url;
      }
    } catch {
      setError('Authorization failed');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <XCircle size={48} style={{ color: 'var(--error)', marginBottom: 16 }} />
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Error</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{error || 'Application not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 32, maxWidth: 440, width: '100%', border: '1px solid var(--stroke)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            {app.iconHash
              ? <img src={`/api/v1/files/${app.iconHash}`} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} />
              : <Shield size={32} style={{ color: '#000' }} />
            }
          </div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 20 }}>
            {app.name} wants to access your account
          </h2>
          {app.description && (
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>{app.description}</p>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            This will allow {app.name} to:
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {app.scopes.map(s => (
              <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: 'var(--text-primary)', fontSize: 14 }}>
                <CheckCircle size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {SCOPE_DESCRIPTIONS[s] || s}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => handleAuthorize(false)}
            disabled={submitting}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 6, border: '1px solid var(--stroke)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            Deny
          </button>
          <button
            onClick={() => handleAuthorize(true)}
            disabled={submitting}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 6, border: 'none',
              background: 'var(--accent-primary)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            {submitting ? 'Authorizing...' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  );
}
