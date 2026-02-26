import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState('');

  useEffect(() => {
    async function processToken() {
      // Extract token from URL fragment (#token=...)
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const token = params.get('token');

      if (!token) {
        setError('No authentication token received.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      // Store the access token
      setAccessToken(token);

      try {
        // Fetch user profile
        const me = await api.users.getMe();
        login({
          id: me.id,
          username: me.username,
          email: me.email,
          displayName: me.profile?.displayName ?? me.username,
          avatarHash: me.profile?.avatarHash ?? null,
          tier: me.profile?.tier ?? 'free',
        });

        navigate('/', { replace: true });
      } catch {
        setError('Failed to load your profile. Please try again.');
        setAccessToken(null);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    }

    void processToken();
  }, [login, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: '100%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--stroke)',
          borderRadius: 10,
          padding: 48,
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          gap: 20,
          textAlign: 'center' as const,
        }}
      >
        {error ? (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(220, 50, 50, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <p style={{ fontSize: 14, color: '#f87171', margin: 0 }}>{error}</p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
              Signing you in...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
