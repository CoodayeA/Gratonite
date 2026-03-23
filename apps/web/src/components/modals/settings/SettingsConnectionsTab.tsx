import { useState, useEffect } from 'react';
import { Link2 } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../../lib/api';
import type { SettingsTabProps } from './types';

const PROVIDERS = ['github', 'twitch', 'steam', 'twitter', 'youtube', 'spotify'] as const;
type Provider = typeof PROVIDERS[number];

const PROVIDER_LABELS: Record<Provider, string> = {
  github: 'GitHub', twitch: 'Twitch', steam: 'Steam', twitter: 'Twitter / X', youtube: 'YouTube', spotify: 'Spotify',
};
const PROVIDER_URL_TEMPLATES: Record<Provider, string> = {
  github: 'https://github.com/', twitch: 'https://twitch.tv/', steam: 'https://steamcommunity.com/id/',
  twitter: 'https://x.com/', youtube: 'https://youtube.com/@', spotify: 'https://open.spotify.com/user/',
};

const SettingsConnectionsTab = ({ addToast }: SettingsTabProps) => {
  const [connectionUsernames, setConnectionUsernames] = useState<Record<Provider, string>>({
    github: '', twitch: '', steam: '', twitter: '', youtube: '', spotify: '',
  });
  const [connectionProfileUrls, setConnectionProfileUrls] = useState<Record<Provider, string>>({
    github: '', twitch: '', steam: '', twitter: '', youtube: '', spotify: '',
  });
  const [connectionSaving, setConnectionSaving] = useState<Provider | null>(null);
  const [connectionRemoving, setConnectionRemoving] = useState<Provider | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/users/@me/connections`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ provider: string; providerUsername?: string; profileUrl?: string }>) => {
        if (!Array.isArray(rows)) return;
        const usernames: Record<string, string> = {};
        const profileUrls: Record<string, string> = {};
        rows.forEach((r) => {
          usernames[r.provider] = r.providerUsername ?? '';
          profileUrls[r.provider] = r.profileUrl ?? '';
        });
        setConnectionUsernames(prev => ({ ...prev, ...usernames }) as Record<Provider, string>);
        setConnectionProfileUrls(prev => ({ ...prev, ...profileUrls }) as Record<Provider, string>);
      })
      .catch((err: unknown) => { if ((err as { name?: string })?.name === 'AbortError') return; });
    return () => controller.abort();
  }, []);

  const saveConnection = async (provider: Provider) => {
    const username = connectionUsernames[provider];
    if (!username.trim()) return;
    setConnectionSaving(provider);
    try {
      const explicitUrl = connectionProfileUrls[provider].trim();
      const autoUrl = PROVIDER_URL_TEMPLATES[provider] ? `${PROVIDER_URL_TEMPLATES[provider]}${username.trim()}` : undefined;
      const profileUrl = explicitUrl || autoUrl;
      await fetch(`${API_BASE}/users/@me/connections`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
        body: JSON.stringify({ provider, providerUsername: username.trim(), profileUrl }),
      });
      if (profileUrl && !explicitUrl) {
        setConnectionProfileUrls(prev => ({ ...prev, [provider]: profileUrl }));
      }
      addToast({ title: `${provider} connected`, variant: 'success' });
    } catch {
      addToast({ title: `Failed to save ${provider}`, variant: 'error' });
    } finally {
      setConnectionSaving(null);
    }
  };

  const removeConnection = async (provider: Provider) => {
    setConnectionRemoving(provider);
    try {
      await fetch(`${API_BASE}/users/@me/connections/${provider}`, {
        method: 'DELETE', credentials: 'include',
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      setConnectionUsernames(prev => ({ ...prev, [provider]: '' }));
      setConnectionProfileUrls(prev => ({ ...prev, [provider]: '' }));
      addToast({ title: `${provider} removed`, variant: 'success' });
    } catch {
      addToast({ title: `Failed to remove ${provider}`, variant: 'error' });
    } finally {
      setConnectionRemoving(null);
    }
  };

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Connected Accounts</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Link your third-party accounts to display them on your profile.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {PROVIDERS.map((provider) => {
          const hasUsername = !!connectionUsernames[provider].trim();
          const autoUrl = hasUsername ? `${PROVIDER_URL_TEMPLATES[provider]}${connectionUsernames[provider].trim()}` : '';
          const displayUrl = connectionProfileUrls[provider] || autoUrl;
          return (
            <div key={provider} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', opacity: connectionRemoving === provider ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: connectionRemoving === provider ? 'none' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Link2 size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{PROVIDER_LABELS[provider]}</span>
                {hasUsername && <span style={{ fontSize: '11px', color: 'var(--success, #10b981)', fontWeight: 500 }}>Connected</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder={`Your ${PROVIDER_LABELS[provider]} username`} value={connectionUsernames[provider]} onChange={e => setConnectionUsernames(prev => ({ ...prev, [provider]: e.target.value }))} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                  <button onClick={() => saveConnection(provider)} disabled={connectionSaving === provider || !connectionUsernames[provider].trim()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px', background: 'var(--accent-primary)', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap', opacity: (!connectionUsernames[provider].trim() || connectionSaving === provider) ? 0.6 : 1 }}>
                    {connectionSaving === provider ? 'Saving...' : 'Save'}
                  </button>
                  {hasUsername && (
                    <button onClick={() => removeConnection(provider)} disabled={connectionRemoving === provider} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', fontWeight: 600, fontSize: '13px', background: 'var(--bg-elevated)', color: 'var(--error)', cursor: 'pointer' }}>
                      {connectionRemoving === provider ? '...' : 'Remove'}
                    </button>
                  )}
                </div>
                {hasUsername && displayUrl && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={12} />
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{displayUrl}</a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SettingsConnectionsTab;
